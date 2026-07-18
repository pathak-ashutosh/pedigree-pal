begin;
select plan(19);

select has_table('public', 'attestations', 'attestations exist');
select has_type('public', 'attestation_status', 'attestation status enum exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.attestations'::regclass),
  'attestations RLS enabled'
);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'owner-a@example.test'),
  ('00000000-0000-4000-8000-000000000004', 'owner-b@example.test');

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
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000004',
    'owner',
    '00000000-0000-4000-8000-000000000004'
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

insert into public.attestations (
  organization_id, dog_id, record_version, schema_version, record_hash, salt
) values
  (
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    1,
    1,
    repeat('a', 64),
    repeat('b', 64)
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    1,
    1,
    repeat('c', 64),
    repeat('d', 64)
  );

select is(
  (select status::text from public.attestations where record_hash = repeat('a', 64)),
  'pending',
  'new attestations start pending'
);

select throws_ok(
  $$
    insert into public.attestations (
      organization_id, dog_id, record_version, schema_version, record_hash, salt
    ) values (
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      1,
      1,
      repeat('e', 64),
      repeat('f', 64)
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "attestations_dog_id_record_version_key"',
  'a record version is attested at most once'
);

select throws_ok(
  $$
    insert into public.attestations (
      organization_id, dog_id, record_version, schema_version, record_hash, salt
    ) values (
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      2,
      1,
      repeat('a', 64),
      repeat('f', 64)
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "attestations_record_hash_key"',
  'record hashes are globally unique'
);

select throws_ok(
  $$
    insert into public.attestations (
      organization_id, dog_id, record_version, schema_version, record_hash, salt
    ) values (
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      2,
      1,
      'NOTHEX',
      repeat('f', 64)
    )
  $$,
  '23514',
  'new row for relation "attestations" violates check constraint "attestations_record_hash_check"',
  'record hash must be lowercase hex'
);

select throws_ok(
  $$
    update public.attestations
    set status = 'confirmed'
    where record_hash = repeat('a', 64)
  $$,
  '23514',
  'new row for relation "attestations" violates check constraint "attestations_confirmed_has_timestamp"',
  'confirmed attestations must carry a confirmation time'
);

select lives_ok(
  $$
    update public.attestations
    set status = 'confirmed', confirmed_at = now(), updated_at = 'epoch'
    where record_hash = repeat('a', 64)
  $$,
  'a confirmation with a timestamp is accepted'
);

select is(
  (
    select updated_at
    from public.attestations
    where record_hash = repeat('a', 64)
  ),
  now(),
  'the database stamps updated_at, overriding the client value'
);

select ok(
  not exists (
    select 1
    from public.audit_events
    where entity_type = 'attestations'
      and (after_data ? 'salt' or before_data ? 'salt')
  ),
  'audit data excludes attestation salts'
);
select ok(
  exists (
    select 1
    from public.audit_events
    where entity_type = 'attestations' and after_data ? 'record_hash'
  ),
  'audit data retains the record hash'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.attestations),
  1::bigint,
  'a member sees only its tenant attestations'
);
select is(
  (select record_hash from public.attestations),
  repeat('a', 64)::bpchar,
  'the visible attestation is the tenant one'
);
select throws_ok(
  $$select salt from public.attestations$$,
  '42501',
  'permission denied for table attestations',
  'members cannot read attestation salts'
);
select throws_ok(
  $$
    insert into public.attestations (
      organization_id, dog_id, record_version, schema_version, record_hash, salt
    ) values (
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      3,
      1,
      repeat('9', 64),
      repeat('8', 64)
    )
  $$,
  '42501',
  'permission denied for table attestations',
  'members cannot forge attestations'
);
select throws_ok(
  $$update public.attestations set status = 'revoked'$$,
  '42501',
  'permission denied for table attestations',
  'members cannot alter attestations'
);
select throws_ok(
  $$delete from public.attestations$$,
  '42501',
  'permission denied for table attestations',
  'members cannot delete attestations'
);

set local role postgres;
delete from public.dogs where id = '20000000-0000-4000-8000-000000000001';
select is(
  (select count(*) from public.attestations where dog_id = '20000000-0000-4000-8000-000000000001'),
  0::bigint,
  'deleting a dog crypto-shreds its attestations'
);

select * from finish();
rollback;
