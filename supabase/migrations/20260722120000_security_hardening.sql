-- Defense-in-depth: serialize owner changes, reduce direct client privileges,
-- constrain credentials, and limit evidence uploads to entitled safe formats.

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
  -- Membership updates for one organization must evaluate the owner invariant
  -- serially; otherwise two concurrent demotions could both observe an owner.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(old.organization_id::text, 0)
  );

  removing_owner := old.role = 'owner'
    and (tg_op = 'DELETE' or new.role <> 'owner');

  -- Parent deletion removes the organization before cascading memberships.
  -- The owner invariant must stand down only for that tenant teardown.
  organization_remains := exists (
    select 1
    from public.organizations organization
    where organization.id = old.organization_id
  );

  if organization_remains and auth.uid() is not null and (
    (removing_owner and not public.has_org_role(
      old.organization_id,
      array['owner']::public.organization_role[]
    ))
    or (tg_op = 'UPDATE' and old.role <> 'owner' and new.role = 'owner'
      and not public.has_org_role(
        old.organization_id,
        array['owner']::public.organization_role[]
      ))
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

alter table public.api_keys
  add constraint api_keys_scopes_allowlist
  check (scopes <@ array['dogs:read']::text[] and cardinality(scopes) <= 1);

revoke update (name, scopes, last_used_at) on public.api_keys from authenticated;

-- Outbound webhook delivery needs DNS/IP validation and redirect re-validation
-- to resist SSRF. Keep the dormant table read-only until that worker exists.
revoke insert, update, delete on public.webhook_endpoints from authenticated;
revoke update (url, subscribed_events, signing_secret_ciphertext, enabled, updated_at)
  on public.webhook_endpoints from authenticated;

drop policy documents_insert_editor on public.documents;
create policy documents_insert_editor on public.documents
for insert to authenticated
with check (
  public.has_org_role(
    organization_id,
    array['owner', 'admin', 'member']::public.organization_role[]
  )
  and public.has_entitlement(organization_id, 'registry.write')
  and uploaded_by = auth.uid()
);

drop policy evidence_insert_editor on storage.objects;
create policy evidence_insert_editor on storage.objects
for insert to authenticated
with check (
  bucket_id = 'pedigree-evidence'
  and public.has_org_role(
    public.storage_organization_id(name),
    array['owner', 'admin', 'member']::public.organization_role[]
  )
  and public.has_entitlement(
    public.storage_organization_id(name),
    'registry.write'
  )
);

update storage.buckets
set public = false,
    file_size_limit = 26214400,
    allowed_mime_types = array[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp'
    ]::text[]
where id = 'pedigree-evidence';

-- Future objects/functions start closed; each migration must grant explicitly.
alter default privileges in schema public
  revoke all on tables from anon, authenticated;
alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;
