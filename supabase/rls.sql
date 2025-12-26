-- RLS recomendado (Supabase)
-- IMPORTANTE: Ajusta según tus necesidades.

alter table public.profiles enable row level security;
alter table public.tenants enable row level security;
alter table public.products enable row level security;
alter table public.tenant_themes enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Hacer el script re-ejecutable (evita: "policy ... already exists")
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_insert_admin" on public.profiles;

drop policy if exists "tenants_select" on public.tenants;
drop policy if exists "tenants_public_select" on public.tenants;
drop policy if exists "tenants_insert_admin" on public.tenants;
drop policy if exists "tenants_update_admin_or_owner" on public.tenants;
drop policy if exists "tenants_update_owner" on public.tenants;
drop policy if exists "tenants_update_premium_admin" on public.tenants;

drop policy if exists "products_select" on public.products;
drop policy if exists "products_public_select_active" on public.products;
drop policy if exists "products_modify" on public.products;

drop policy if exists "themes_select" on public.tenant_themes;
drop policy if exists "themes_public_select" on public.tenant_themes;
drop policy if exists "themes_modify" on public.tenant_themes;

drop policy if exists "orders_select" on public.orders;
drop policy if exists "orders_insert" on public.orders;
drop policy if exists "orders_insert_anon" on public.orders;
drop policy if exists "orders_update" on public.orders;

drop policy if exists "order_items_select" on public.order_items;
drop policy if exists "order_items_insert" on public.order_items;
drop policy if exists "order_items_insert_anon" on public.order_items;
drop policy if exists "order_items_update" on public.order_items;

-- Helper: role del usuario
create or replace function public.current_role()
returns text as $$
  select role from public.profiles where user_id = auth.uid();
$$ language sql stable security definer set search_path = public;

create or replace function public.current_tenant_id()
returns uuid as $$
  select tenant_id from public.profiles where user_id = auth.uid();
$$ language sql stable security definer set search_path = public;

-- Helper seguro para evitar recursión de RLS:
-- No uses current_role() directamente dentro de policies sobre public.profiles.
create or replace function public.is_super_admin()
returns boolean as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'super_admin'
  );
$$ language sql stable security definer set search_path = public;

-- Intentar asignar owner a postgres (bypass RLS) cuando se ejecute como admin.
do $$
begin
  begin
    alter function public.current_role() owner to postgres;
    alter function public.current_tenant_id() owner to postgres;
    alter function public.is_super_admin() owner to postgres;
  exception
    when insufficient_privilege then
      raise notice 'No se pudo cambiar owner de funciones a postgres. Ejecuta este archivo como postgres/supabase_admin para evitar errores de RLS/recursión.';
  end;
end
$$;

-- PROFILES: cada usuario puede leer/editar su perfil; super_admin puede leer todo
-- IMPORTANTE: Permitimos que usuarios cancelados lean su propio perfil para verificación de baneo
create policy "profiles_select_own_or_admin" on public.profiles
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_super_admin()
);

-- Política permisiva para INSERT - el trigger necesita poder insertar
create policy "profiles_insert_any" on public.profiles
for insert
with check (true);

create policy "profiles_update_own" on public.profiles
for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and account_status = 'active'
  and role = 'tenant_admin'
);

-- Admin: puede actualizar cualquier perfil (incluye cancelar, premium, etc.)
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- TENANTS: tenant_admin solo su tenant; super_admin todo
create policy "tenants_select" on public.tenants
for select
to authenticated
using (
  public.is_super_admin()
  or id = public.current_tenant_id()
  or owner_user_id = auth.uid()
);

-- Tienda pública (sin login): lectura de tenants
create policy "tenants_public_select" on public.tenants
for select
to anon
using (is_public = true);

create policy "tenants_insert_admin" on public.tenants
for insert
to authenticated
with check (public.is_super_admin() or owner_user_id = auth.uid());

-- Owner puede actualizar su tenant, pero NO tocar premium_until ni subscription_tier
create policy "tenants_update_owner" on public.tenants
for update
to authenticated
using (owner_user_id = auth.uid())
with check (
  owner_user_id = auth.uid()
  and premium_until is not distinct from (select t.premium_until from public.tenants t where t.id = public.tenants.id)
  and subscription_tier is not distinct from (select t.subscription_tier from public.tenants t where t.id = public.tenants.id)
);

-- Solo super_admin puede tocar premium_until, subscription_tier (y cualquier otro campo)
create policy "tenants_update_premium_admin" on public.tenants
for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- PRODUCTS: tenant_admin solo su tenant; super_admin todo
create policy "products_select" on public.products
for select
to authenticated
using (
  public.is_super_admin()
  or tenant_id = public.current_tenant_id()
);

-- Tienda pública (sin login): solo productos activos
create policy "products_public_select_active" on public.products
for select
to anon
using (active = true);

create policy "products_modify" on public.products
for all
to authenticated
using (
  public.is_super_admin()
  or tenant_id = public.current_tenant_id()
)
with check (
  public.is_super_admin()
  or tenant_id = public.current_tenant_id()
);

-- TENANT_THEMES: tenant_admin solo su tenant; super_admin todo
create policy "themes_select" on public.tenant_themes
for select
to authenticated
using (
  public.is_super_admin()
  or tenant_id = public.current_tenant_id()
);

-- Tienda pública (sin login): lectura del tema
create policy "themes_public_select" on public.tenant_themes
for select
to anon
using (true);

-- ORDERS: tenant_admin solo su tenant; super_admin todo
create policy "orders_select" on public.orders
for select
to authenticated
using (
  public.is_super_admin()
  or tenant_id = public.current_tenant_id()
);

-- INSERT: usuarios anónimos y autenticados pueden crear pedidos en tenants públicos
create policy "orders_insert_anon" on public.orders
for insert
to anon, authenticated
with check (
  exists (
    select 1 from public.tenants t
    where t.id = orders.tenant_id
      and t.is_public = true
  )
);

create policy "orders_update" on public.orders
for update
to authenticated
using (
  public.is_super_admin()
  or tenant_id = public.current_tenant_id()
)
with check (
  public.is_super_admin()
  or tenant_id = public.current_tenant_id()
);

-- ORDER_ITEMS: se accede por pertenecer a un order del tenant
create policy "order_items_select" on public.order_items
for select
to authenticated
using (
  public.is_super_admin()
  or exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and o.tenant_id = public.current_tenant_id()
  )
);

-- INSERT: usuarios anónimos y autenticados pueden agregar items a pedidos existentes
create policy "order_items_insert_anon" on public.order_items
for insert
to anon, authenticated
with check (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
  )
);

create policy "order_items_update" on public.order_items
for update
to authenticated
using (
  public.is_super_admin()
  or exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and o.tenant_id = public.current_tenant_id()
  )
)
with check (
  public.is_super_admin()
  or exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and o.tenant_id = public.current_tenant_id()
  )
);

create policy "themes_modify" on public.tenant_themes
for all
to authenticated
using (
  public.is_super_admin()
  or tenant_id = public.current_tenant_id()
)
with check (
  public.is_super_admin()
  or tenant_id = public.current_tenant_id()
);

-- STORAGE (product-images)
-- Nota: esto controla permisos sobre storage.objects.
do $$
begin
  -- En algunos proyectos, el SQL Editor puede estar ejecutando como un rol
  -- que NO es dueño de storage.objects (y fallará con: "must be owner of table objects").
  -- Para no bloquear la instalación completa, intentamos aplicar RLS/policies y
  -- si falta privilegio, solo mostramos un aviso.
  begin
    alter table storage.objects enable row level security;
  exception
    when insufficient_privilege then
      raise notice 'Saltando Storage RLS/policies: falta privilegio/owner sobre storage.objects. Ejecuta esta sección como postgres/supabase_admin o configura policies en Dashboard.';
      return;
    when others then
      raise notice 'Saltando Storage RLS/policies por error: %', sqlerrm;
      return;
  end;

  execute 'drop policy if exists "product_images_public_select" on storage.objects';
  execute 'drop policy if exists "product_images_insert" on storage.objects';
  execute 'drop policy if exists "product_images_update" on storage.objects';
  execute 'drop policy if exists "product_images_delete" on storage.objects';

  -- Lectura pública de imágenes (para mostrarlas en /store/:slug)
  execute $policy$
    create policy "product_images_public_select" on storage.objects
    for select
    to anon
    using (bucket_id = 'product-images')
  $policy$;

  -- Subida/edición/borrado: solo usuarios autenticados.
  -- IMPORTANTE:
  -- Usar public.current_tenant_id() aquí puede fallar si profiles.tenant_id está NULL
  -- o si hay problemas de permisos/owner con las funciones SECURITY DEFINER.
  -- Para destrabar la subida de imágenes de forma confiable, usamos el patrón estándar:
  -- el usuario autenticado solo puede escribir sobre objetos de los que es owner.
  execute $policy$
    create policy "product_images_insert" on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'product-images'
      and owner = auth.uid()
    )
  $policy$;

  execute $policy$
    create policy "product_images_update" on storage.objects
    for update
    to authenticated
    using (
      bucket_id = 'product-images'
      and owner = auth.uid()
    )
    with check (
      bucket_id = 'product-images'
      and owner = auth.uid()
    )
  $policy$;

  execute $policy$
    create policy "product_images_delete" on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'product-images'
      and owner = auth.uid()
    )
  $policy$;
end
$$;
