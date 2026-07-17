begin;
select plan(34);

select has_table('public', 'organizations', 'organizations exists');
select has_table('public', 'organization_memberships', 'memberships exists');
select has_table('public', 'dogs', 'dogs exists');
select has_table('public', 'dog_parents', 'pedigree links exist');
select has_table('public', 'documents', 'evidence metadata exists');
select has_table('public', 'organization_billing', 'billing state exists');
select has_table('public', 'organization_entitlements', 'entitlements exist');
select has_table('public', 'billing_webhook_events', 'billing webhook inbox exists');
select has_table('public', 'idempotency_keys', 'idempotency records exist');
select has_table('public', 'outbox_events', 'durable outbox exists');
select has_table('public', 'api_keys', 'API key metadata exists');
select has_table('public', 'webhook_endpoints', 'outbound webhook endpoints exist');
select has_table('public', 'webhook_deliveries', 'webhook delivery history exists');
select has_table('public', 'usage_counters', 'usage counters exist');
select has_table('public', 'audit_events', 'audit trail exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.organizations'::regclass),
  'organizations RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.organization_memberships'::regclass),
  'memberships RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.dogs'::regclass),
  'dogs RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.dog_parents'::regclass),
  'pedigree links RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.documents'::regclass),
  'documents RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.organization_billing'::regclass),
  'billing RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.audit_events'::regclass),
  'audit RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.organization_entitlements'::regclass),
  'entitlements RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.billing_webhook_events'::regclass),
  'billing webhook inbox RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.idempotency_keys'::regclass),
  'idempotency RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.outbox_events'::regclass),
  'outbox RLS enabled'
);

select has_function('public', 'is_org_member', array['uuid'], 'membership helper exists');
select has_function(
  'public',
  'has_org_role',
  array['uuid', 'organization_role[]'],
  'role helper exists'
);
select has_function(
  'public',
  'has_entitlement',
  array['uuid', 'text'],
  'entitlement helper exists'
);
select has_function(
  'public',
  'create_organization',
  array['text', 'text'],
  'safe onboarding function exists'
);
select has_function(
  'public',
  'claim_outbox_events',
  array['integer'],
  'worker outbox claim function exists'
);
select has_function(
  'public',
  'consume_api_request',
  array['uuid', 'integer'],
  'atomic API quota function exists'
);
select has_function(
  'public',
  'enqueue_registry_event',
  array[]::text[],
  'transactional registry outbox trigger exists'
);
select policies_are(
  'public',
  'audit_events',
  array['audit_events_select_member'],
  'audit records are read-only to clients'
);

select * from finish();
rollback;
