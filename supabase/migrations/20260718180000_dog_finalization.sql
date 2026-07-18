-- Phase 3a: finalize lifecycle for dog records.
--
-- Finalization is orthogonal to dog_status (a finalized dog can still retire or
-- die), so it is a timestamp, not a status value. `record_version` is the version
-- the hash spec commits to: a material edit to a finalized record bumps it and
-- clears `finalized_at`, leaving the prior attestation valid for its version
-- while the new draft awaits re-finalization.

alter table public.dogs
  add column record_version integer not null default 1 check (record_version >= 1),
  add column finalized_at timestamptz;

-- Both columns are deliberately absent from the authenticated update grant:
-- clients read them but only triggers and finalize_dog_record() may write them.

create or replace function public.definalize_on_material_edit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.finalized_at is not null and (
    new.registered_name is distinct from old.registered_name
    or new.call_name is distinct from old.call_name
    or new.breed is distinct from old.breed
    or new.sex is distinct from old.sex
    or new.birth_date is distinct from old.birth_date
    or new.microchip_hash is distinct from old.microchip_hash
  ) then
    new.record_version := old.record_version + 1;
    new.finalized_at := null;
  end if;
  return new;
end;
$$;

create trigger dogs_definalize_on_material_edit
before update on public.dogs
for each row execute function public.definalize_on_material_edit();

-- Parentage is part of the attested record but lives in dog_parents, so changes
-- there must reach the child row: bump the version when finalized, and always
-- touch updated_at so an in-flight finalize sees the record moved underneath it.
create or replace function public.touch_child_on_parent_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_child_id uuid := case when tg_op = 'DELETE' then old.child_id else new.child_id end;
begin
  update public.dogs
  set record_version = record_version
        + (case when finalized_at is not null then 1 else 0 end),
      finalized_at = null
  where id = target_child_id;

  return coalesce(new, old);
end;
$$;

create trigger dog_parents_touch_child
after insert or update or delete on public.dog_parents
for each row execute function public.touch_child_on_parent_change();

-- Finalizes a dog record: verifies the caller reviewed the exact bytes being
-- attested, then atomically inserts the attestation, requests batching via the
-- outbox, and stamps the dog. The hash itself is computed by the application —
-- the expected_* arguments are how the database confirms nothing moved between
-- that computation and this call (the dogs row lock serializes against the
-- parent-change trigger's update).
create or replace function public.finalize_dog_record(
  dog_id uuid,
  record_hash text,
  salt text,
  schema_version smallint,
  expected_updated_at timestamptz,
  expected_sire_id uuid default null,
  expected_dam_id uuid default null
)
returns public.attestations
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  dog_row public.dogs;
  current_sire_id uuid;
  current_dam_id uuid;
  created_attestation public.attestations;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select * into dog_row
  from public.dogs
  where id = finalize_dog_record.dog_id
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'not authorized to finalize this record';
  end if;
  if not public.has_org_role(
      dog_row.organization_id, array['owner', 'admin']::public.organization_role[])
    or not public.has_entitlement(dog_row.organization_id, 'registry.write') then
    raise exception using errcode = '42501', message = 'not authorized to finalize this record';
  end if;

  if dog_row.status = 'archived' then
    raise exception using errcode = '55000', message = 'archived records cannot be finalized';
  end if;

  if dog_row.finalized_at is not null then
    raise exception using errcode = '55000', message = 'record is already finalized';
  end if;

  select parent_id into current_sire_id
  from public.dog_parents
  where child_id = dog_row.id and kind = 'sire';
  select parent_id into current_dam_id
  from public.dog_parents
  where child_id = dog_row.id and kind = 'dam';

  if dog_row.updated_at is distinct from finalize_dog_record.expected_updated_at
    or current_sire_id is distinct from finalize_dog_record.expected_sire_id
    or current_dam_id is distinct from finalize_dog_record.expected_dam_id then
    raise exception using errcode = '55000', message = 'record changed since it was reviewed';
  end if;

  insert into public.attestations (
    organization_id,
    dog_id,
    record_version,
    schema_version,
    record_hash,
    salt
  ) values (
    dog_row.organization_id,
    dog_row.id,
    dog_row.record_version,
    finalize_dog_record.schema_version,
    finalize_dog_record.record_hash,
    finalize_dog_record.salt
  )
  returning * into created_attestation;

  insert into public.outbox_events (
    organization_id,
    topic,
    aggregate_type,
    aggregate_id,
    payload
  ) values (
    dog_row.organization_id,
    'attestation.requested',
    'attestations',
    created_attestation.id::text,
    jsonb_build_object(
      'attestation_id', created_attestation.id,
      'dog_id', dog_row.id,
      'record_version', dog_row.record_version
    )
  );

  update public.dogs
  set finalized_at = now(), updated_by = current_user_id
  where id = dog_row.id;

  return created_attestation;
end;
$$;

revoke all on function
  public.finalize_dog_record(uuid, text, text, smallint, timestamptz, uuid, uuid)
from public;
grant execute on function
  public.finalize_dog_record(uuid, text, text, smallint, timestamptz, uuid, uuid)
to authenticated;
