begin;
select plan(8);

select ok(
  not has_table_privilege('authenticated', 'public.webhook_endpoints', 'INSERT'),
  'authenticated clients cannot create outbound webhook targets'
);
select ok(
  not has_column_privilege('authenticated', 'public.webhook_endpoints', 'url', 'UPDATE'),
  'authenticated clients cannot alter outbound webhook targets'
);
select ok(
  has_column_privilege('authenticated', 'public.api_keys', 'revoked_at', 'UPDATE'),
  'organization admins can revoke API keys'
);
select ok(
  not has_column_privilege('authenticated', 'public.api_keys', 'scopes', 'UPDATE'),
  'authenticated clients cannot expand API key scopes'
);
select matches(
  pg_get_constraintdef(oid),
  'dogs:read'::text,
  'API key scopes have a database allowlist'::text
)
from pg_constraint
where conname = 'api_keys_scopes_allowlist';
select is(
  (select allowed_mime_types from storage.buckets where id = 'pedigree-evidence'),
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[],
  'evidence bucket accepts only safe document and image formats'
);
select matches(
  (select with_check::text from pg_policies
   where schemaname = 'public' and tablename = 'documents'
     and policyname = 'documents_insert_editor'),
  'has_entitlement'::text,
  'document metadata writes require an active entitlement'::text
);
select matches(
  pg_get_functiondef('public.guard_organization_owner()'::regprocedure),
  'pg_advisory_xact_lock'::text,
  'owner membership changes are serialized'::text
);

select * from finish();
rollback;
