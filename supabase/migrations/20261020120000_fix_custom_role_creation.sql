-- Custom roles use role_key and role_name.  The legacy enum-backed name
-- column is intentionally null for custom roles.
create or replace function public.admin_create_custom_role(
  p_role_key text,
  p_role_name text,
  p_description text,
  p_permissions text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  created_role public.roles%rowtype;
begin
  if p_role_key not like 'custom-%'
     or p_role_key !~ '^custom-[a-z0-9]+(-[a-z0-9]+)*$' then
    return jsonb_build_object('status', 'invalid_role_key');
  end if;

  if cardinality(coalesce(p_permissions, array[]::text[])) = 0 then
    return jsonb_build_object('status', 'permissions_required');
  end if;

  if 'dev.console' = any(coalesce(p_permissions, array[]::text[])) then
    return jsonb_build_object('status', 'restricted_permissions');
  end if;

  insert into public.roles (role_key, role_name, label, description)
  values (p_role_key, p_role_name, p_role_name, nullif(p_description, ''))
  on conflict (role_key) do nothing
  returning * into created_role;

  if created_role.role_key is null then
    return jsonb_build_object('status', 'role_exists');
  end if;

  insert into public.permissions (role_key, route_hash)
  select created_role.role_key, permission
  from unnest(p_permissions) as permission
  where permission is not null
    and btrim(permission) <> ''
  on conflict (role_key, route_hash) do nothing;

  return jsonb_build_object(
    'status', 'created',
    'role', jsonb_build_object(
      'role_key', created_role.role_key,
      'role_name', created_role.role_name,
      'label', created_role.label,
      'description', created_role.description
    )
  );
end;
$$;
