-- Trigger recomendado: crear profile automáticamente al registrar usuario
-- Ejecuta esto en Supabase SQL editor.

-- IMPORTANTE:
-- - Ejecuta este archivo como `postgres`/`supabase_admin`.
-- - Si lo ejecutas con un rol sin BYPASSRLS, y RLS está habilitado en public.profiles,
--   el insert puede fallar y Auth mostrará: "Database error saving new user".

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, email, role, tenant_id, account_status, premium_until, premium_source)
  values (new.id, new.email, 'tenant_admin', null, 'active', null, null)
  on conflict (user_id) do update
    set email = excluded.email;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Asignar owner a postgres para bypasear RLS
do $$
begin
  alter function public.handle_new_user() owner to postgres;
exception
  when insufficient_privilege then
    raise notice 'No se pudo cambiar owner a postgres. Ejecuta como supabase_admin.';
end;
$$;

-- Recrea trigger de forma segura (idempotente)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Nota: para convertir un usuario en super_admin, actualiza su fila en public.profiles
-- update public.profiles set role='super_admin' where user_id = '...';
