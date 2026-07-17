begin;
select plan(20);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'owner-a@example.test'),
  ('00000000-0000-4000-8000-000000000002', 'member-a@example.test'),
  ('00000000-0000-4000-8000-000000000003', 'viewer-a@example.test'),
  ('00000000-0000-4000-8000-000000000004', 'owner-b@example.test'),
  ('00000000-0000-4000-8000-000000000005', 'new-owner@example.test');

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
    '00000000-0000-4000-8000-000000000004'
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
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000003',
    'viewer',
    '00000000-0000-4000-8000-000000000001'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000004',
    'owner',
    '00000000-0000-4000-8000-000000000004'
  );

insert into public.organization_billing (organization_id) values
  ('10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002');

insert into public.organization_entitlements (organization_id, entitlement_key, value, source)
values (
  '10000000-0000-4000-8000-000000000001',
  'registry.write',
  'true'::jsonb,
  'test'
);

insert into public.dogs (
  id,
  organization_id,
  registered_name,
  breed,
  sex,
  birth_date,
  created_by
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
    '2020-01-01',
    '00000000-0000-4000-8000-000000000004'
  );

insert into public.organization_invitations (
  organization_id,
  email,
  role,
  token_hash,
  invited_by,
  expires_at
) values (
  '10000000-0000-4000-8000-000000000001',
  'invitee@example.test',
  'member',
  decode(repeat('ab', 32), 'hex'),
  '00000000-0000-4000-8000-000000000001',
  now() + interval '1 day'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.organizations),
  1::bigint,
  'member sees only its organization'
);
select is((select count(*) from public.dogs), 1::bigint, 'member sees only tenant dogs');
select is((select count(*) from public.audit_events), 8::bigint, 'member sees only tenant audit events');
select ok(
  (
    select not (after_data ? 'email') and not (after_data ? 'token_hash')
    from public.audit_events
    where entity_type = 'organization_invitations'
  ),
  'audit data excludes invitation secrets'
);
select is((select count(*) from public.organization_billing), 0::bigint, 'member cannot see billing');

select lives_ok(
  $$
    insert into public.dogs (
      organization_id, registered_name, breed, sex, birth_date, created_by
    ) values (
      '10000000-0000-4000-8000-000000000001',
      'Member Dog',
      'Retriever',
      'unknown',
      '2023-01-01',
      '00000000-0000-4000-8000-000000000002'
    )
  $$,
  'member can create a dog in its tenant'
);
select lives_ok(
  $$
    update public.dogs
    set registered_name = 'Dog A Updated'
    where id = '20000000-0000-4000-8000-000000000001'
  $$,
  'member can update allowed dog fields'
);
select is(
  (
    select updated_by
    from public.dogs
    where id = '20000000-0000-4000-8000-000000000001'
  ),
  '00000000-0000-4000-8000-000000000002'::uuid,
  'dog update actor is set by the database'
);
select throws_ok(
  $$
    update public.dogs
    set created_by = '00000000-0000-4000-8000-000000000002'
    where id = '20000000-0000-4000-8000-000000000001'
  $$,
  '42501',
  'permission denied for table dogs',
  'client cannot mutate dog system fields'
);

select throws_ok(
  $$
    insert into public.dog_parents (
      organization_id, child_id, parent_id, kind, created_by
    ) values (
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002',
      'sire',
      '00000000-0000-4000-8000-000000000002'
    )
  $$,
  'P0002',
  'query returned no rows',
  'cross-tenant pedigree link is rejected'
);

set local role postgres;
select is(
  (
    select count(*)
    from public.outbox_events
    where organization_id = '10000000-0000-4000-8000-000000000001'
  ),
  3::bigint,
  'registry mutations commit matching durable outbox events'
);
select ok(
  not exists (
    select 1
    from public.outbox_events
    where payload ?| array['notes', 'microchip_hash', 'registered_name']
  ),
  'outbox payloads exclude private registry fields'
);
update public.organization_entitlements
set value = 'false'::jsonb
where organization_id = '10000000-0000-4000-8000-000000000001'
  and entitlement_key = 'registry.write';
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
select throws_ok(
  $$
    insert into public.dogs (
      organization_id, registered_name, breed, sex, birth_date, created_by
    ) values (
      '10000000-0000-4000-8000-000000000001',
      'Unentitled Dog',
      'Retriever',
      'unknown',
      '2023-01-01',
      '00000000-0000-4000-8000-000000000002'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "dogs"',
  'disabled write entitlement blocks registry changes'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
select is((select count(*) from public.dogs), 2::bigint, 'viewer can read tenant dogs');
select throws_ok(
  $$
    insert into public.dogs (
      organization_id, registered_name, breed, sex, birth_date, created_by
    ) values (
      '10000000-0000-4000-8000-000000000001',
      'Viewer Dog',
      'Retriever',
      'unknown',
      '2023-01-01',
      '00000000-0000-4000-8000-000000000003'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "dogs"',
  'viewer cannot create dogs'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select is((select count(*) from public.organization_billing), 1::bigint, 'owner can see tenant billing');
select throws_ok(
  $$
    delete from public.organization_memberships
    where organization_id = '10000000-0000-4000-8000-000000000001'
      and user_id = '00000000-0000-4000-8000-000000000001'
  $$,
  '23514',
  'organization must retain an owner',
  'last owner cannot be removed'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000005","role":"authenticated"}',
  true
);
select lives_ok(
  $$select public.create_organization('  Fresh Kennel  ', '  Fresh-Slug  ')$$,
  'authenticated user can create an organization through the guarded function'
);
select is(
  (
    select name::text || ':' || slug
    from public.organizations
    where slug = 'fresh-slug'
  ),
  'Fresh Kennel:fresh-slug',
  'organization function normalizes name and slug'
);
select is(
  (
    select role::text
    from public.organization_memberships
    where organization_id = (
      select id from public.organizations where slug = 'fresh-slug'
    ) and user_id = '00000000-0000-4000-8000-000000000005'
  ),
  'owner',
  'organization creator receives owner role'
);

select * from finish();
rollback;
