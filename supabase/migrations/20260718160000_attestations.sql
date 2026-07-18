-- Phase 3a: off-chain record integrity.
-- Stores the canonical-hash output for finalized dog records. Merkle batches and
-- on-chain references arrive in Phase 3b; until then every row stays 'pending'.

create type public.attestation_status as enum ('pending', 'confirmed', 'revoked');

create table public.attestations (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  dog_id uuid not null,
  record_version integer not null check (record_version >= 1),
  schema_version smallint not null check (schema_version >= 1),
  record_hash char(64) not null unique check (record_hash ~ '^[a-f0-9]{64}$'),
  salt char(64) not null check (salt ~ '^[a-f0-9]{64}$'),
  status public.attestation_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  revoked_at timestamptz,
  unique (dog_id, record_version),
  -- Cascade is the GDPR position: dropping the record and its salt leaves any
  -- published hash unlinkable and non-invertible.
  foreign key (dog_id, organization_id)
    references public.dogs(id, organization_id) on delete cascade,
  constraint attestations_pending_has_no_outcome
    check (status <> 'pending' or (confirmed_at is null and revoked_at is null)),
  constraint attestations_confirmed_has_timestamp
    check (status <> 'confirmed' or confirmed_at is not null),
  constraint attestations_revoked_has_timestamp
    check (status <> 'revoked' or revoked_at is not null),
  constraint attestations_confirmed_after_created
    check (confirmed_at is null or confirmed_at >= created_at),
  constraint attestations_revoked_after_created
    check (revoked_at is null or revoked_at >= created_at)
);

create index attestations_organization_dog_idx
  on public.attestations (organization_id, dog_id, record_version desc);
create index attestations_pending_idx
  on public.attestations (created_at)
  where status = 'pending';

create trigger attestations_set_updated_at
before update on public.attestations
for each row execute function public.set_updated_at();

create trigger attestations_audit
after insert or update or delete on public.attestations
for each row execute function public.audit_row_change();

-- Adds `salt` to the redaction list; otherwise the audit trail would republish
-- salts to every org member through audit_events.
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_record jsonb;
  after_record jsonb;
  source_record jsonb;
  target_organization_id uuid;
  target_entity_id text;
begin
  before_record := case when tg_op in ('UPDATE', 'DELETE')
    then to_jsonb(old) - array[
      'token_hash',
      'email',
      'key_hash',
      'signing_secret_ciphertext',
      'request_hash',
      'response_body',
      'salt'
    ] else null end;
  after_record := case when tg_op in ('INSERT', 'UPDATE')
    then to_jsonb(new) - array[
      'token_hash',
      'email',
      'key_hash',
      'signing_secret_ciphertext',
      'request_hash',
      'response_body',
      'salt'
    ] else null end;
  source_record := coalesce(after_record, before_record);
  target_organization_id := coalesce(
    (source_record ->> 'organization_id')::uuid,
    (source_record ->> 'id')::uuid
  );
  target_entity_id := coalesce(
    source_record ->> 'id',
    source_record ->> 'child_id',
    source_record ->> 'user_id'
  );

  insert into public.audit_events (
    organization_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data,
    request_id
  ) values (
    target_organization_id,
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    target_entity_id,
    before_record,
    after_record,
    coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-request-id'
  );

  return coalesce(new, old);
end;
$$;

alter table public.attestations enable row level security;

create policy attestations_select_member on public.attestations
for select to authenticated
using (public.is_org_member(organization_id));

revoke all on public.attestations from anon, authenticated;
-- `salt` is withheld: it is what stops an outsider brute-forcing a published hash,
-- so it leaves the database only through a deliberate proof-bundle path.
grant select (
  id,
  organization_id,
  dog_id,
  record_version,
  schema_version,
  record_hash,
  status,
  created_at,
  updated_at,
  confirmed_at,
  revoked_at
) on public.attestations to authenticated;
