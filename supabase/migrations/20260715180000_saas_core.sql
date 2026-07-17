-- PedigreePal SaaS core: tenant isolation, registry records, evidence, billing, audit.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

create type public.organization_role as enum ('owner', 'admin', 'member', 'viewer');
create type public.dog_sex as enum ('male', 'female', 'unknown');
create type public.dog_status as enum ('active', 'retired', 'deceased', 'archived');
create type public.parent_kind as enum ('sire', 'dam');
create type public.subscription_status as enum (
  'trialing',
  'active',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'unpaid',
  'paused'
);
create type public.billing_plan as enum ('trial', 'starter', 'pro');
create type public.async_status as enum ('pending', 'processing', 'completed', 'dead');
create type public.delivery_status as enum ('pending', 'delivered', 'retrying', 'failed');

create table public.organizations (
  id uuid primary key default extensions.gen_random_uuid(),
  name extensions.citext not null check (
    char_length(name::text) between 2 and 120 and name::text ~ '[^[:space:]]'
  ),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role not null default 'member',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.organization_invitations (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email extensions.citext not null,
  role public.organization_role not null default 'member' check (role <> 'owner'),
  token_hash bytea not null unique,
  invited_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at),
  check (accepted_at is null or accepted_at >= created_at)
);

create table public.dogs (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  registered_name text not null check (char_length(registered_name) between 1 and 120),
  call_name text check (call_name is null or char_length(call_name) <= 80),
  breed text not null check (char_length(breed) between 1 and 120),
  sex public.dog_sex not null default 'unknown',
  birth_date date not null,
  microchip_hash char(64) check (microchip_hash is null or microchip_hash ~ '^[a-f0-9]{64}$'),
  status public.dog_status not null default 'active',
  notes text check (notes is null or char_length(notes) <= 2000),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

create unique index dogs_organization_microchip_hash_key
  on public.dogs (organization_id, microchip_hash)
  where microchip_hash is not null;
create index dogs_organization_status_idx on public.dogs (organization_id, status);
create index dogs_organization_name_idx on public.dogs (organization_id, registered_name);

create table public.dog_parents (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  child_id uuid not null,
  parent_id uuid not null,
  kind public.parent_kind not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (child_id, kind),
  unique (child_id, parent_id),
  foreign key (child_id, organization_id)
    references public.dogs(id, organization_id) on delete cascade,
  foreign key (parent_id, organization_id)
    references public.dogs(id, organization_id) on delete restrict,
  check (child_id <> parent_id)
);

create index dog_parents_parent_idx on public.dog_parents (parent_id);
create index dog_parents_organization_idx on public.dog_parents (organization_id);

create table public.documents (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  dog_id uuid,
  storage_path text not null unique check (storage_path <> ''),
  file_name text not null check (char_length(file_name) between 1 and 255),
  media_type text not null check (char_length(media_type) between 1 and 120),
  byte_size bigint not null check (byte_size between 1 and 26214400),
  sha256 char(64) not null check (sha256 ~ '^[a-f0-9]{64}$'),
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (dog_id, organization_id)
    references public.dogs(id, organization_id) on delete cascade
);

create index documents_organization_idx on public.documents (organization_id);
create index documents_dog_idx on public.documents (dog_id);

create table public.organization_billing (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  plan public.billing_plan not null default 'trial',
  status public.subscription_status not null default 'trialing',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_entitlements (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entitlement_key text not null check (entitlement_key ~ '^[a-z][a-z0-9_.-]{1,79}$'),
  value jsonb not null default 'true'::jsonb,
  source text not null default 'billing',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, entitlement_key)
);

create table public.billing_webhook_events (
  id bigint generated always as identity primary key,
  provider text not null default 'stripe',
  event_id text not null,
  event_type text not null,
  payload_hash char(64) not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  processed_at timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  unique (provider, event_id)
);

create table public.idempotency_keys (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  idempotency_key text not null check (char_length(idempotency_key) between 16 and 128),
  request_hash char(64) not null check (request_hash ~ '^[a-f0-9]{64}$'),
  response_status integer check (response_status between 100 and 599),
  response_body jsonb,
  locked_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  primary key (organization_id, idempotency_key),
  check (expires_at > created_at)
);

create table public.outbox_events (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  topic text not null check (topic ~ '^[a-z][a-z0-9_.-]{1,119}$'),
  aggregate_type text not null,
  aggregate_id text not null,
  payload jsonb not null default '{}'::jsonb,
  status public.async_status not null default 'pending',
  attempts integer not null default 0 check (attempts between 0 and 100),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index outbox_events_claim_idx
  on public.outbox_events (status, available_at, created_at)
  where status in ('pending', 'processing');

create table public.api_keys (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  key_prefix text not null check (key_prefix ~ '^pp_(live|test)_[A-Za-z0-9]{6,16}$'),
  key_hash char(64) not null unique check (key_hash ~ '^[a-f0-9]{64}$'),
  scopes text[] not null default '{}',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index api_keys_organization_idx on public.api_keys (organization_id, created_at desc);

create table public.webhook_endpoints (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  url text not null check (url ~ '^https://'),
  subscribed_events text[] not null default '{}',
  signing_secret_ciphertext bytea not null,
  enabled boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index webhook_endpoints_organization_idx
  on public.webhook_endpoints (organization_id, enabled);

create table public.webhook_deliveries (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  endpoint_id uuid not null references public.webhook_endpoints(id) on delete cascade,
  outbox_event_id uuid not null references public.outbox_events(id) on delete cascade,
  status public.delivery_status not null default 'pending',
  attempts integer not null default 0 check (attempts between 0 and 100),
  response_status integer check (response_status between 100 and 599),
  next_attempt_at timestamptz not null default now(),
  last_error_code text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  unique (endpoint_id, outbox_event_id)
);

create index webhook_deliveries_retry_idx
  on public.webhook_deliveries (status, next_attempt_at)
  where status in ('pending', 'retrying');

create table public.usage_counters (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  metric text not null check (metric ~ '^[a-z][a-z0-9_.-]{1,79}$'),
  period_start timestamptz not null,
  period_end timestamptz not null,
  value bigint not null default 0 check (value >= 0),
  updated_at timestamptz not null default now(),
  primary key (organization_id, metric, period_start),
  check (period_end > period_start)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  request_id text check (request_id is null or char_length(request_id) <= 64),
  created_at timestamptz not null default now()
);

create index audit_events_organization_created_idx
  on public.audit_events (organization_id, created_at desc);
create index audit_events_entity_idx
  on public.audit_events (organization_id, entity_type, entity_id);

create or replace function public.is_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = target_organization_id
      and membership.user_id = auth.uid()
  );
$$;

create or replace function public.has_org_role(
  target_organization_id uuid,
  allowed_roles public.organization_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = target_organization_id
      and membership.user_id = auth.uid()
      and membership.role = any (allowed_roles)
  );
$$;

create or replace function public.has_entitlement(
  target_organization_id uuid,
  target_entitlement_key text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select entitlement.value = 'true'::jsonb
    from public.organization_entitlements entitlement
    where entitlement.organization_id = target_organization_id
      and entitlement.entitlement_key = target_entitlement_key
  ), false);
$$;

revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.has_org_role(uuid, public.organization_role[]) from public;
revoke all on function public.has_entitlement(uuid, text) from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, public.organization_role[]) to authenticated;
grant execute on function public.has_entitlement(uuid, text) to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.validate_dog_birth_date()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.birth_date > current_date then
    raise exception using errcode = '23514', message = 'birth_date cannot be in the future';
  end if;
  return new;
end;
$$;

create or replace function public.validate_parent_assignment()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  child_record public.dogs%rowtype;
  parent_record public.dogs%rowtype;
begin
  select * into strict child_record
    from public.dogs
    where id = new.child_id and organization_id = new.organization_id;
  select * into strict parent_record
    from public.dogs
    where id = new.parent_id and organization_id = new.organization_id;

  if parent_record.birth_date >= child_record.birth_date then
    raise exception using errcode = '23514', message = 'parent must be older than child';
  end if;
  if new.kind = 'sire' and parent_record.sex <> 'male' then
    raise exception using errcode = '23514', message = 'sire must be male';
  end if;
  if new.kind = 'dam' and parent_record.sex <> 'female' then
    raise exception using errcode = '23514', message = 'dam must be female';
  end if;

  return new;
end;
$$;

create or replace function public.protect_dog_system_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id <> old.organization_id
    or new.created_by <> old.created_by
    or new.created_at <> old.created_at then
    raise exception using errcode = '42501', message = 'dog system fields are immutable';
  end if;

  if auth.uid() is not null then
    new.updated_by = auth.uid();
  end if;
  return new;
end;
$$;

create or replace function public.guard_organization_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  removing_owner boolean;
begin
  removing_owner := old.role = 'owner'
    and (tg_op = 'DELETE' or new.role <> 'owner');

  if auth.uid() is not null and (
    (removing_owner and not public.has_org_role(old.organization_id, array['owner']::public.organization_role[]))
    or (tg_op = 'UPDATE' and old.role <> 'owner' and new.role = 'owner'
      and not public.has_org_role(old.organization_id, array['owner']::public.organization_role[]))
  ) then
    raise exception using errcode = '42501', message = 'only an owner can change owner membership';
  end if;

  if removing_owner and not exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = old.organization_id
      and membership.role = 'owner'
      and membership.user_id <> old.user_id
  ) then
    raise exception using errcode = '23514', message = 'organization must retain an owner';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

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
      'response_body'
    ] else null end;
  after_record := case when tg_op in ('INSERT', 'UPDATE')
    then to_jsonb(new) - array[
      'token_hash',
      'email',
      'key_hash',
      'signing_secret_ciphertext',
      'request_hash',
      'response_body'
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

create or replace function public.enqueue_registry_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organization_id uuid;
  event_topic text;
  aggregate_identifier text;
begin
  target_organization_id := case
    when tg_op = 'DELETE' then old.organization_id
    else new.organization_id
  end;
  if tg_table_name = 'dogs' then
    event_topic := case
      when tg_op = 'INSERT' then 'dog.created'
      when tg_op = 'DELETE' then 'dog.deleted'
      when new.status = 'archived' and old.status <> 'archived' then 'dog.archived'
      else 'dog.updated'
    end;
    aggregate_identifier := case when tg_op = 'DELETE' then old.id::text else new.id::text end;
  else
    event_topic := 'pedigree.' || lower(tg_op);
    aggregate_identifier := case
      when tg_op = 'DELETE' then old.child_id::text
      else new.child_id::text
    end;
  end if;

  insert into public.outbox_events (
    organization_id,
    topic,
    aggregate_type,
    aggregate_id,
    payload
  ) values (
    target_organization_id,
    event_topic,
    tg_table_name,
    aggregate_identifier,
    jsonb_build_object('record_id', aggregate_identifier, 'event', event_topic)
  );

  return coalesce(new, old);
end;
$$;

create or replace function public.create_organization(organization_name text, organization_slug text)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_organization public.organizations;
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  insert into public.organizations (name, slug, created_by)
  values (btrim(organization_name), lower(btrim(organization_slug)), current_user_id)
  returning * into created_organization;

  insert into public.organization_memberships (organization_id, user_id, role, created_by)
  values (created_organization.id, current_user_id, 'owner', current_user_id);

  insert into public.organization_billing (organization_id, current_period_end)
  values (created_organization.id, now() + interval '14 days');

  insert into public.organization_entitlements (organization_id, entitlement_key, value, source)
  values
    (created_organization.id, 'registry.write', 'true'::jsonb, 'trial'),
    (created_organization.id, 'team.member_limit', '5'::jsonb, 'trial'),
    (created_organization.id, 'evidence.storage_bytes', '1073741824'::jsonb, 'trial'),
    (created_organization.id, 'api.requests_per_minute', '120'::jsonb, 'trial');

  return created_organization;
end;
$$;

create or replace function public.claim_outbox_events(batch_size integer default 25)
returns setof public.outbox_events
language sql
security definer
set search_path = ''
as $$
  with claimed as (
    select event.id
    from public.outbox_events event
    where event.status = 'pending'
      and event.available_at <= now()
    order by event.created_at
    for update skip locked
    limit least(greatest(batch_size, 1), 100)
  )
  update public.outbox_events event
  set status = 'processing',
      locked_at = now(),
      attempts = event.attempts + 1
  from claimed
  where event.id = claimed.id
  returning event.*;
$$;

create or replace function public.consume_api_request(
  target_organization_id uuid,
  max_requests integer default 120
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_allowed boolean;
  window_start timestamptz := date_trunc('minute', now());
begin
  insert into public.usage_counters (
    organization_id,
    metric,
    period_start,
    period_end,
    value
  ) values (
    target_organization_id,
    'api.requests',
    window_start,
    window_start + interval '1 minute',
    1
  )
  on conflict (organization_id, metric, period_start)
  do update set
    value = public.usage_counters.value + 1,
    updated_at = now()
  where public.usage_counters.value < least(greatest(max_requests, 1), 10000)
  returning true into request_allowed;

  return coalesce(request_allowed, false);
end;
$$;

revoke all on function public.create_organization(text, text) from public;
grant execute on function public.create_organization(text, text) to authenticated;
revoke all on function public.claim_outbox_events(integer) from public;
grant execute on function public.claim_outbox_events(integer) to service_role;
revoke all on function public.consume_api_request(uuid, integer) from public;
grant execute on function public.consume_api_request(uuid, integer) to service_role;

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();
create trigger memberships_set_updated_at
before update on public.organization_memberships
for each row execute function public.set_updated_at();
create trigger billing_set_updated_at
before update on public.organization_billing
for each row execute function public.set_updated_at();
create trigger entitlements_set_updated_at
before update on public.organization_entitlements
for each row execute function public.set_updated_at();
create trigger webhook_endpoints_set_updated_at
before update on public.webhook_endpoints
for each row execute function public.set_updated_at();
create trigger dogs_set_updated_at
before update on public.dogs
for each row execute function public.set_updated_at();
create trigger dogs_protect_system_fields
before update on public.dogs
for each row execute function public.protect_dog_system_fields();
create trigger dogs_validate_birth_date
before insert or update of birth_date on public.dogs
for each row execute function public.validate_dog_birth_date();
create trigger dog_parents_validate
before insert or update on public.dog_parents
for each row execute function public.validate_parent_assignment();
create trigger memberships_guard_owner
before update or delete on public.organization_memberships
for each row execute function public.guard_organization_owner();

create trigger organizations_audit
after insert or update or delete on public.organizations
for each row execute function public.audit_row_change();
create trigger memberships_audit
after insert or update or delete on public.organization_memberships
for each row execute function public.audit_row_change();
create trigger invitations_audit
after insert or update or delete on public.organization_invitations
for each row execute function public.audit_row_change();
create trigger dogs_audit
after insert or update or delete on public.dogs
for each row execute function public.audit_row_change();
create trigger dog_parents_audit
after insert or update or delete on public.dog_parents
for each row execute function public.audit_row_change();
create trigger dogs_outbox
after insert or update or delete on public.dogs
for each row execute function public.enqueue_registry_event();
create trigger dog_parents_outbox
after insert or update or delete on public.dog_parents
for each row execute function public.enqueue_registry_event();
create trigger documents_audit
after insert or update or delete on public.documents
for each row execute function public.audit_row_change();
create trigger billing_audit
after insert or update or delete on public.organization_billing
for each row execute function public.audit_row_change();
create trigger entitlements_audit
after insert or update or delete on public.organization_entitlements
for each row execute function public.audit_row_change();
create trigger api_keys_audit
after insert or update or delete on public.api_keys
for each row execute function public.audit_row_change();
create trigger webhook_endpoints_audit
after insert or update or delete on public.webhook_endpoints
for each row execute function public.audit_row_change();

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.dogs enable row level security;
alter table public.dog_parents enable row level security;
alter table public.documents enable row level security;
alter table public.organization_billing enable row level security;
alter table public.organization_entitlements enable row level security;
alter table public.billing_webhook_events enable row level security;
alter table public.idempotency_keys enable row level security;
alter table public.outbox_events enable row level security;
alter table public.api_keys enable row level security;
alter table public.webhook_endpoints enable row level security;
alter table public.webhook_deliveries enable row level security;
alter table public.usage_counters enable row level security;
alter table public.audit_events enable row level security;

create policy organizations_select_member on public.organizations
for select to authenticated
using (public.is_org_member(id));
create policy organizations_update_admin on public.organizations
for update to authenticated
using (public.has_org_role(id, array['owner', 'admin']::public.organization_role[]))
with check (public.has_org_role(id, array['owner', 'admin']::public.organization_role[]));
create policy organizations_delete_owner on public.organizations
for delete to authenticated
using (public.has_org_role(id, array['owner']::public.organization_role[]));

create policy memberships_select_member on public.organization_memberships
for select to authenticated
using (public.is_org_member(organization_id));
create policy memberships_insert_admin on public.organization_memberships
for insert to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin']::public.organization_role[])
  and (role <> 'owner' or public.has_org_role(organization_id, array['owner']::public.organization_role[]))
);
create policy memberships_update_admin on public.organization_memberships
for update to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin']::public.organization_role[]))
with check (
  public.has_org_role(organization_id, array['owner', 'admin']::public.organization_role[])
  and (role <> 'owner' or public.has_org_role(organization_id, array['owner']::public.organization_role[]))
);
create policy memberships_delete_admin on public.organization_memberships
for delete to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin']::public.organization_role[]));

create policy invitations_select_admin on public.organization_invitations
for select to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin']::public.organization_role[]));
create policy invitations_insert_admin on public.organization_invitations
for insert to authenticated
with check (public.has_org_role(organization_id, array['owner', 'admin']::public.organization_role[]));
create policy invitations_update_admin on public.organization_invitations
for update to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin']::public.organization_role[]))
with check (public.has_org_role(organization_id, array['owner', 'admin']::public.organization_role[]));
create policy invitations_delete_admin on public.organization_invitations
for delete to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin']::public.organization_role[]));

create policy dogs_select_member on public.dogs
for select to authenticated
using (public.is_org_member(organization_id));
create policy dogs_insert_editor on public.dogs
for insert to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'member']::public.organization_role[])
  and public.has_entitlement(organization_id, 'registry.write')
  and created_by = auth.uid()
);
create policy dogs_update_editor on public.dogs
for update to authenticated
using (
  public.has_org_role(organization_id, array['owner', 'admin', 'member']::public.organization_role[])
  and public.has_entitlement(organization_id, 'registry.write')
)
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'member']::public.organization_role[])
  and public.has_entitlement(organization_id, 'registry.write')
);
create policy dogs_delete_admin on public.dogs
for delete to authenticated
using (
  public.has_org_role(organization_id, array['owner', 'admin']::public.organization_role[])
  and public.has_entitlement(organization_id, 'registry.write')
);

create policy dog_parents_select_member on public.dog_parents
for select to authenticated
using (public.is_org_member(organization_id));
create policy dog_parents_insert_editor on public.dog_parents
for insert to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'member']::public.organization_role[])
  and public.has_entitlement(organization_id, 'registry.write')
  and created_by = auth.uid()
);
create policy dog_parents_update_editor on public.dog_parents
for update to authenticated
using (
  public.has_org_role(organization_id, array['owner', 'admin', 'member']::public.organization_role[])
  and public.has_entitlement(organization_id, 'registry.write')
)
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'member']::public.organization_role[])
  and public.has_entitlement(organization_id, 'registry.write')
);
create policy dog_parents_delete_admin on public.dog_parents
for delete to authenticated
using (
  public.has_org_role(organization_id, array['owner', 'admin']::public.organization_role[])
  and public.has_entitlement(organization_id, 'registry.write')
);

create policy documents_select_member on public.documents
for select to authenticated
using (public.is_org_member(organization_id));
create policy documents_insert_editor on public.documents
for insert to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'member']::public.organization_role[])
  and uploaded_by = auth.uid()
);
create policy documents_delete_admin on public.documents
for delete to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin']::public.organization_role[]));

create policy billing_select_admin on public.organization_billing
for select to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin']::public.organization_role[]));

create policy entitlements_select_member on public.organization_entitlements
for select to authenticated
using (public.is_org_member(organization_id));

create policy outbox_select_admin on public.outbox_events
for select to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin']::public.organization_role[]));

create policy api_keys_select_admin on public.api_keys
for select to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin']::public.organization_role[]));
create policy api_keys_insert_admin on public.api_keys
for insert to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin']::public.organization_role[])
  and created_by = auth.uid()
);
create policy api_keys_update_admin on public.api_keys
for update to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin']::public.organization_role[]))
with check (public.has_org_role(organization_id, array['owner', 'admin']::public.organization_role[]));

create policy webhook_endpoints_select_admin on public.webhook_endpoints
for select to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin']::public.organization_role[]));
create policy webhook_endpoints_insert_admin on public.webhook_endpoints
for insert to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin']::public.organization_role[])
  and created_by = auth.uid()
);
create policy webhook_endpoints_update_admin on public.webhook_endpoints
for update to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin']::public.organization_role[]))
with check (public.has_org_role(organization_id, array['owner', 'admin']::public.organization_role[]));
create policy webhook_endpoints_delete_admin on public.webhook_endpoints
for delete to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin']::public.organization_role[]));

create policy webhook_deliveries_select_admin on public.webhook_deliveries
for select to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin']::public.organization_role[]));

create policy usage_counters_select_admin on public.usage_counters
for select to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin']::public.organization_role[]));

create policy audit_events_select_member on public.audit_events
for select to authenticated
using (public.is_org_member(organization_id));

revoke all on all tables in schema public from anon, authenticated;
grant select on public.organizations,
  public.organization_memberships,
  public.dogs,
  public.dog_parents,
  public.documents,
  public.organization_entitlements,
  public.outbox_events,
  public.webhook_deliveries,
  public.usage_counters,
  public.audit_events to authenticated;
grant select (id, organization_id, email, role, invited_by, expires_at, accepted_at, created_at)
  on public.organization_invitations to authenticated;
grant select (organization_id, plan, status, current_period_end, created_at, updated_at)
  on public.organization_billing to authenticated;
grant select (id, organization_id, name, key_prefix, scopes, created_by, created_at, last_used_at, revoked_at)
  on public.api_keys to authenticated;
grant select (id, organization_id, url, subscribed_events, enabled, created_by, created_at, updated_at)
  on public.webhook_endpoints to authenticated;
grant delete on public.organizations to authenticated;
grant update (name, slug) on public.organizations to authenticated;
grant insert, delete on public.organization_memberships to authenticated;
grant update (role) on public.organization_memberships to authenticated;
grant insert, delete on public.organization_invitations to authenticated;
grant update (role, expires_at, accepted_at) on public.organization_invitations to authenticated;
grant insert, delete on public.dogs to authenticated;
grant update (
  registered_name,
  call_name,
  breed,
  sex,
  birth_date,
  microchip_hash,
  status,
  notes,
  updated_by,
  updated_at
) on public.dogs to authenticated;
grant insert, delete on public.dog_parents to authenticated;
grant update (parent_id) on public.dog_parents to authenticated;
grant insert, delete on public.documents to authenticated;
grant insert on public.api_keys to authenticated;
grant update (name, scopes, last_used_at, revoked_at) on public.api_keys to authenticated;
grant insert, delete on public.webhook_endpoints to authenticated;
grant update (url, subscribed_events, signing_secret_ciphertext, enabled, updated_at)
  on public.webhook_endpoints to authenticated;
insert into storage.buckets (id, name, public, file_size_limit)
values ('pedigree-evidence', 'pedigree-evidence', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create or replace function public.storage_organization_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  first_segment text := split_part(object_name, '/', 1);
begin
  if first_segment ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return first_segment::uuid;
  end if;
  return null;
end;
$$;

create policy evidence_select_member on storage.objects
for select to authenticated
using (
  bucket_id = 'pedigree-evidence'
  and public.is_org_member(public.storage_organization_id(name))
);
create policy evidence_insert_editor on storage.objects
for insert to authenticated
with check (
  bucket_id = 'pedigree-evidence'
  and public.has_org_role(
    public.storage_organization_id(name),
    array['owner', 'admin', 'member']::public.organization_role[]
  )
);
create policy evidence_delete_admin on storage.objects
for delete to authenticated
using (
  bucket_id = 'pedigree-evidence'
  and public.has_org_role(
    public.storage_organization_id(name),
    array['owner', 'admin']::public.organization_role[]
  )
);
