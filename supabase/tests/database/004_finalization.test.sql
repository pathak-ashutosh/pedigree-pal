begin;
select plan(20);

select has_column('public', 'dogs', 'record_version', 'dogs carry a record version');
select has_column('public', 'dogs', 'finalized_at', 'dogs carry a finalize marker');

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'owner-a@example.test'),
  ('00000000-0000-4000-8000-000000000002', 'member-a@example.test');

insert into public.organizations (id, name, slug, created_by) values (
  '10000000-0000-4000-8000-000000000001',
  'Kennel A',
  'kennel-a',
  '00000000-0000-4000-8000-000000000001'
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
  );

insert into public.organization_entitlements (organization_id, entitlement_key, value, source)
values (
  '10000000-0000-4000-8000-000000000001',
  'registry.write',
  'true'::jsonb,
  'test'
);

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
    '10000000-0000-4000-8000-000000000001',
    'Sire A',
    'Retriever',
    'male',
    '2020-01-01',
    '00000000-0000-4000-8000-000000000001'
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    'Archived Dog',
    'Retriever',
    'female',
    '2021-01-01',
    '00000000-0000-4000-8000-000000000001'
  );

update public.dogs
set status = 'archived'
where id = '20000000-0000-4000-8000-000000000003';

select is(
  (select record_version from public.dogs where id = '20000000-0000-4000-8000-000000000001'),
  1,
  'new dogs start at record version 1'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    update public.dogs
    set finalized_at = now()
    where id = '20000000-0000-4000-8000-000000000001'
  $$,
  '42501',
  'permission denied for table dogs',
  'clients cannot stamp finalized_at directly'
);
select throws_ok(
  $$
    update public.dogs
    set record_version = 5
    where id = '20000000-0000-4000-8000-000000000001'
  $$,
  '42501',
  'permission denied for table dogs',
  'clients cannot forge the record version'
);
select throws_ok(
  $$
    select public.finalize_dog_record(
      '20000000-0000-4000-8000-000000000001',
      repeat('1', 64),
      repeat('2', 64),
      1::smallint,
      (select updated_at from public.dogs where id = '20000000-0000-4000-8000-000000000001')
    )
  $$,
  '42501',
  'not authorized to finalize this record',
  'members cannot finalize records'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    select public.finalize_dog_record(
      '20000000-0000-4000-8000-000000000001',
      repeat('1', 64),
      repeat('2', 64),
      1::smallint,
      now() - interval '1 hour'
    )
  $$,
  '55000',
  'record changed since it was reviewed',
  'a stale record snapshot is rejected'
);
select throws_ok(
  $$
    select public.finalize_dog_record(
      '20000000-0000-4000-8000-000000000001',
      repeat('1', 64),
      repeat('2', 64),
      1::smallint,
      (select updated_at from public.dogs where id = '20000000-0000-4000-8000-000000000001'),
      '20000000-0000-4000-8000-000000000002'
    )
  $$,
  '55000',
  'record changed since it was reviewed',
  'a stale parent snapshot is rejected'
);
select lives_ok(
  $$
    select public.finalize_dog_record(
      '20000000-0000-4000-8000-000000000001',
      repeat('1', 64),
      repeat('2', 64),
      1::smallint,
      (select updated_at from public.dogs where id = '20000000-0000-4000-8000-000000000001')
    )
  $$,
  'an owner can finalize a reviewed record'
);
select is(
  (
    select record_version::text || ':' || status::text
    from public.attestations
    where dog_id = '20000000-0000-4000-8000-000000000001'
  ),
  '1:pending',
  'finalization stores a pending attestation for version 1'
);
select ok(
  (
    select finalized_at is not null
    from public.dogs
    where id = '20000000-0000-4000-8000-000000000001'
  ),
  'finalization stamps the dog record'
);

set local role postgres;
select ok(
  exists (
    select 1
    from public.outbox_events
    where topic = 'attestation.requested'
      and payload ?& array['attestation_id', 'dog_id', 'record_version']
      and not payload ?| array['registered_name', 'notes', 'microchip_hash', 'salt', 'record_hash']
  ),
  'finalization enqueues a minimal batching request'
);
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    select public.finalize_dog_record(
      '20000000-0000-4000-8000-000000000001',
      repeat('5', 64),
      repeat('6', 64),
      1::smallint,
      (select updated_at from public.dogs where id = '20000000-0000-4000-8000-000000000001')
    )
  $$,
  '55000',
  'record is already finalized',
  'a finalized record cannot be finalized twice'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
update public.dogs
set registered_name = 'Dog A Corrected'
where id = '20000000-0000-4000-8000-000000000001';

select is(
  (select record_version from public.dogs where id = '20000000-0000-4000-8000-000000000001'),
  2,
  'a material edit to a finalized record bumps the version'
);
select ok(
  (
    select finalized_at is null
    from public.dogs
    where id = '20000000-0000-4000-8000-000000000001'
  ),
  'a material edit clears the finalize marker'
);

update public.dogs
set breed = 'Golden Retriever'
where id = '20000000-0000-4000-8000-000000000001';
select is(
  (select record_version from public.dogs where id = '20000000-0000-4000-8000-000000000001'),
  2,
  'draft edits do not bump the version'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select lives_ok(
  $$
    select public.finalize_dog_record(
      '20000000-0000-4000-8000-000000000001',
      repeat('3', 64),
      repeat('4', 64),
      1::smallint,
      (select updated_at from public.dogs where id = '20000000-0000-4000-8000-000000000001')
    )
  $$,
  'the corrected record can be finalized as version 2'
);

update public.dogs
set notes = 'Vet visit booked'
where id = '20000000-0000-4000-8000-000000000001';
select ok(
  (
    select finalized_at is not null and record_version = 2
    from public.dogs
    where id = '20000000-0000-4000-8000-000000000001'
  ),
  'non-material edits keep the record finalized'
);

insert into public.dog_parents (
  organization_id, child_id, parent_id, kind, created_by
) values (
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  'sire',
  '00000000-0000-4000-8000-000000000001'
);
select ok(
  (
    select record_version = 3 and finalized_at is null
    from public.dogs
    where id = '20000000-0000-4000-8000-000000000001'
  ),
  'a pedigree change bumps the version and clears the finalize marker'
);

select throws_ok(
  $$
    select public.finalize_dog_record(
      '20000000-0000-4000-8000-000000000003',
      repeat('7', 64),
      repeat('8', 64),
      1::smallint,
      (select updated_at from public.dogs where id = '20000000-0000-4000-8000-000000000003')
    )
  $$,
  '55000',
  'archived records cannot be finalized',
  'archived records cannot be finalized'
);

select * from finish();
rollback;
