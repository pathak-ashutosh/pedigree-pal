begin;
select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'owner-a@example.test'),
  ('00000000-0000-4000-8000-000000000002', 'member-a@example.test'),
  ('00000000-0000-4000-8000-000000000003', 'owner-b@example.test');

insert into public.organizations (id, name, slug, created_by) values
  (
    '10000000-0000-4000-8000-000000000001',
    'Kennel A',
    'kennel-a',
    '00000000-0000-4000-8000-000000000001'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'Kennel B',
    'kennel-b',
    '00000000-0000-4000-8000-000000000003'
  );

insert into public.organization_memberships (organization_id, user_id, role, created_by) values
  (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    'owner',
    '00000000-0000-4000-8000-000000000001'
  ),
  (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    'member',
    '00000000-0000-4000-8000-000000000001'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000003',
    'owner',
    '00000000-0000-4000-8000-000000000003'
  );

insert into public.organization_entitlements (organization_id, entitlement_key, value, source)
values ('10000000-0000-4000-8000-000000000001', 'registry.write', 'true'::jsonb, 'test');

insert into public.organization_billing (organization_id) values
  ('10000000-0000-4000-8000-000000000001');

insert into public.dogs (
  id, organization_id, registered_name, breed, sex, birth_date, created_by
) values
  (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'Dog A',
    'Retriever',
    'female',
    '2022-01-01',
    '00000000-0000-4000-8000-000000000001'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    'Dog B',
    'Retriever',
    'male',
    '2021-01-01',
    '00000000-0000-4000-8000-000000000003'
  );

insert into public.attestations (
  organization_id, dog_id, record_version, schema_version, record_hash, salt
) values (
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  1,
  1,
  repeat('a', 64),
  repeat('b', 64)
);

-- The guards must still hold while the organization is alive.
select throws_ok(
  $$
    delete from public.organization_memberships
    where organization_id = '10000000-0000-4000-8000-000000000001'
      and user_id = '00000000-0000-4000-8000-000000000001'
  $$,
  '23514',
  'organization must retain an owner',
  'the last owner is still protected in a living organization'
);
select lives_ok(
  $$
    delete from public.organization_memberships
    where organization_id = '10000000-0000-4000-8000-000000000001'
      and user_id = '00000000-0000-4000-8000-000000000002'
  $$,
  'a non-owner membership can still be removed'
);
select lives_ok(
  $$delete from public.dogs where id = '20000000-0000-4000-8000-000000000001'$$,
  'a single dog can still be deleted'
);
select ok(
  exists (
    select 1 from public.audit_events
    where entity_type = 'dogs' and action = 'delete'
      and organization_id = '10000000-0000-4000-8000-000000000001'
  ),
  'deleting one record still writes an audit row'
);
select ok(
  exists (
    select 1 from public.outbox_events
    where topic = 'dog.deleted'
      and organization_id = '10000000-0000-4000-8000-000000000001'
  ),
  'deleting one record still enqueues an outbox event'
);

-- Tenant teardown.
select lives_ok(
  $$delete from public.organizations where id = '10000000-0000-4000-8000-000000000001'$$,
  'an organization can be deleted'
);
select is(
  (select count(*) from public.organizations where id = '10000000-0000-4000-8000-000000000001'),
  0::bigint,
  'the organization row is gone'
);
select is(
  (select count(*) from public.organization_memberships
   where organization_id = '10000000-0000-4000-8000-000000000001'),
  0::bigint,
  'memberships are removed with the organization'
);
select is(
  (select count(*) from public.dogs where organization_id = '10000000-0000-4000-8000-000000000001'),
  0::bigint,
  'dogs are removed with the organization'
);
select is(
  (select count(*) from public.attestations
   where organization_id = '10000000-0000-4000-8000-000000000001'),
  0::bigint,
  'attestations and their salts are removed with the organization'
);
select is(
  (select count(*) from public.audit_events
   where organization_id = '10000000-0000-4000-8000-000000000001'),
  0::bigint,
  'the audit trail is erased with the organization, leaving no record contents'
);
select is(
  (select count(*) from public.organization_billing
   where organization_id = '10000000-0000-4000-8000-000000000001'),
  0::bigint,
  'billing state is removed with the organization'
);
select is(
  (select count(*) from public.outbox_events
   where organization_id = '10000000-0000-4000-8000-000000000001'),
  0::bigint,
  'no outbox events are left pointing at the deleted organization'
);

-- The neighbouring tenant is untouched.
select is(
  (select count(*) from public.organizations where id = '10000000-0000-4000-8000-000000000002'),
  1::bigint,
  'another organization survives'
);
select is(
  (select count(*) from public.dogs where organization_id = '10000000-0000-4000-8000-000000000002'),
  1::bigint,
  'another tenant keeps its dogs'
);

-- An owner deleting through the client role, which is how the app would do it.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
select lives_ok(
  $$delete from public.organizations where id = '10000000-0000-4000-8000-000000000002'$$,
  'an owner can delete their own organization through RLS'
);

select * from finish();
rollback;
