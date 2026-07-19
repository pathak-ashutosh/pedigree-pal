-- Deleting an organization was impossible: three guards written for the
-- single-row case also fired during the cascade that tears the tenant down.
--
-- 1. `guard_organization_owner()` rejected removal of the last owner, which is
--    exactly what cascading to organization_memberships does.
-- 2. `audit_row_change()` inserted an audit row for every cascaded child, each
--    referencing an organization row that no longer existed, violating
--    audit_events_organization_id_fkey.
-- 3. `enqueue_registry_event()` did the same against outbox_events for every
--    cascaded dog and pedigree link.
--
-- All three now stand down once the organization itself is gone. Audit rows are
-- deliberately not written for a tenant teardown rather than being preserved:
-- `audit_events.before_data` holds record contents, and `audit_events` already
-- cascades away with the organization, so writing them would both fail the FK
-- and work against the erasure policy in docs/trust-layer-plan.md.

create or replace function public.guard_organization_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  removing_owner boolean;
  organization_remains boolean;
begin
  removing_owner := old.role = 'owner'
    and (tg_op = 'DELETE' or new.role <> 'owner');

  -- False only while the parent organization is being deleted, when protecting
  -- its owner would block the teardown.
  organization_remains := exists (
    select 1 from public.organizations organization
    where organization.id = old.organization_id
  );

  if organization_remains and auth.uid() is not null and (
    (removing_owner and not public.has_org_role(old.organization_id, array['owner']::public.organization_role[]))
    or (tg_op = 'UPDATE' and old.role <> 'owner' and new.role = 'owner'
      and not public.has_org_role(old.organization_id, array['owner']::public.organization_role[]))
  ) then
    raise exception using errcode = '42501', message = 'only an owner can change owner membership';
  end if;

  if organization_remains and removing_owner and not exists (
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
  redacted_columns text[] := array[
    'token_hash',
    'email',
    'key_hash',
    'signing_secret_ciphertext',
    'request_hash',
    'response_body',
    'salt'
  ];
begin
  before_record := case when tg_op in ('UPDATE', 'DELETE')
    then to_jsonb(old) - redacted_columns else null end;
  after_record := case when tg_op in ('INSERT', 'UPDATE')
    then to_jsonb(new) - redacted_columns else null end;
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

  -- Only a DELETE can outlive its organization; INSERT and UPDATE are protected
  -- by the row's own foreign key, so the hot path skips this lookup.
  if tg_op = 'DELETE' and not exists (
    select 1 from public.organizations organization
    where organization.id = target_organization_id
  ) then
    return old;
  end if;

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

  -- Nothing subscribes to a tenant that no longer exists, and its webhook
  -- endpoints have been cascaded away too.
  if tg_op = 'DELETE' and not exists (
    select 1 from public.organizations organization
    where organization.id = target_organization_id
  ) then
    return old;
  end if;

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

-- Deletion now works, which makes the client-role path dangerous: the cascade
-- takes organization_billing with it, including stripe_subscription_id, so a
-- tenant could erase itself while its Stripe subscription kept billing and
-- later webhooks failed to find the row. Nothing cancels the subscription
-- today. Until a workflow exists that cancels in Stripe first, deletion is
-- service-role only; the database is ready for it, the tenant cannot trigger
-- it. Tracked as "data export/deletion" in docs/status.md.
drop policy if exists organizations_delete_owner on public.organizations;
revoke delete on public.organizations from authenticated;
