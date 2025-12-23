-- Trigger recomendado: crear profile automáticamente al registrar usuario
-- Ejecuta esto en Supabase SQL editor.

-- IMPORTANTE:
-- - Ejecuta este archivo como `postgres`/`supabase_admin`.
-- - Si lo ejecutas con un rol sin BYPASSRLS, y RLS está habilitado en public.profiles,
--   el insert puede fallar y Auth mostrará: "Database error saving new user".

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, role, tenant_id)
  values (new.id, 'tenant_admin', null)
  on conflict (user_id) do nothing;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Recrea trigger de forma segura (idempotente)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Nota: para convertir un usuario en super_admin, actualiza su fila en public.profiles
-- update public.profiles set role='super_admin' where user_id = '...';
