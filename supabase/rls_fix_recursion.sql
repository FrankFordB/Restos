-- ============================================================================
-- FIX: Infinite recursion en policies de profiles
-- ============================================================================
-- EJECUTA ESTE SCRIPT COMPLETO EN SUPABASE SQL EDITOR
-- 
-- El problema: las funciones is_super_admin(), current_role(), current_tenant_id()
-- consultan public.profiles, pero las policies de profiles usaban esas funciones,
-- causando recursión infinita.
--
-- SOLUCIÓN: Para la tabla profiles, usar SOLO auth.uid() directo.
-- Las funciones helper se usan SOLO en otras tablas (tenants, products, etc.)
-- ============================================================================

-- ============================================================================
-- PASO 1: Deshabilitar RLS temporalmente para limpiar todo
-- ============================================================================
alter table public.profiles disable row level security;

-- ============================================================================
-- PASO 2: Eliminar TODAS las policies existentes de profiles (sin IF EXISTS)
-- ============================================================================
do $$
declare
    policy_name text;
begin
    for policy_name in (
        select policyname from pg_policies where tablename = 'profiles'
    ) loop
        execute format('drop policy %I on public.profiles', policy_name);
    end loop;
end $$;

-- ============================================================================
-- PASO 3: Crear funciones helper con SECURITY DEFINER
-- Estas funciones BYPASSEAN RLS porque se ejecutan como el owner (postgres)
-- ============================================================================

-- Función para obtener el role del usuario actual (bypassa RLS)
create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where user_id = auth.uid()
$$;

-- Función para verificar si es super_admin (bypassa RLS)
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'super_admin' from public.profiles where user_id = auth.uid()),
    false
  )
$$;

-- Función para obtener el tenant_id del usuario actual (bypassa RLS)
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.profiles where user_id = auth.uid()
$$;

-- Mantener current_role() por compatibilidad
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where user_id = auth.uid()
$$;

-- ============================================================================
-- PASO 4: Configurar permisos de las funciones
-- ============================================================================
revoke all on function public.get_my_role() from public;
revoke all on function public.is_super_admin() from public;
revoke all on function public.current_tenant_id() from public;
revoke all on function public.current_role() from public;

grant execute on function public.get_my_role() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.current_tenant_id() to authenticated;
grant execute on function public.current_role() to authenticated;
grant execute on function public.is_super_admin() to anon;

-- ============================================================================
-- PASO 5: Habilitar RLS nuevamente
-- ============================================================================
alter table public.profiles enable row level security;

-- ============================================================================
-- PASO 6: Crear policies SEGURAS para profiles (SIN recursión)
-- 
-- IMPORTANTE: Estas policies NO usan funciones que consulten profiles.
-- Solo usan auth.uid() directamente o verifican role inline.
-- ============================================================================

-- SELECT: Usuario puede ver su propio perfil
create policy "profiles_select_own" on public.profiles
for select
to authenticated
using (user_id = auth.uid());

-- SELECT: Super admin puede ver todos (usando función SECURITY DEFINER)
-- La función is_super_admin() tiene SECURITY DEFINER, así que bypassa RLS
create policy "profiles_select_all_for_admin" on public.profiles
for select
to authenticated
using (public.is_super_admin());

-- INSERT: El trigger de auth.users necesita insertar perfiles nuevos
-- Como el trigger es SECURITY DEFINER, esto funciona sin problemas
create policy "profiles_insert_new" on public.profiles
for insert
with check (true);

-- UPDATE: Usuario puede actualizar su propio perfil
-- Restricción: no puede cambiar su role a super_admin (salvo que ya lo sea)
create policy "profiles_update_own" on public.profiles
for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and (
    -- Si el nuevo role NO es super_admin, OK
    role in ('user', 'tenant_admin')
    -- O si YA era super_admin (verificado con función SECURITY DEFINER)
    or public.is_super_admin()
  )
);

-- UPDATE: Super admin puede actualizar cualquier perfil
create policy "profiles_update_all_for_admin" on public.profiles
for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- DELETE: Solo super admin puede eliminar perfiles (opcional)
create policy "profiles_delete_for_admin" on public.profiles
for delete
to authenticated
using (public.is_super_admin());

-- ============================================================================
-- PASO 7: Verificar que todo funciona
-- ============================================================================
-- Ejecuta esta query para probar:
-- select * from public.profiles where user_id = auth.uid();
--
-- Si ves tu perfil sin errores, ¡funcionó!
-- ============================================================================

-- ============================================================================
-- NOTAS DE SEGURIDAD:
-- 
-- 1. Las funciones SECURITY DEFINER se ejecutan con permisos del owner (postgres),
--    lo que les permite bypassear RLS al consultar profiles.
--
-- 2. Las policies de profiles NUNCA llaman directamente a consultas sobre profiles,
--    solo usan auth.uid() o funciones SECURITY DEFINER.
--
-- 3. Las otras tablas (tenants, products, etc.) pueden usar is_super_admin()
--    y current_tenant_id() sin problemas porque esas funciones bypassean RLS.
-- ============================================================================
