-- Esquema recomendado para Supabase (PostgreSQL)
-- Ejecuta esto en Supabase SQL editor.

-- 1) Perfiles (role + tenant)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text null,
  full_name text null,
  role text not null default 'user' check (role in ('super_admin','tenant_admin','user')),
  tenant_id uuid null,
  account_status text not null default 'active' check (account_status in ('active','cancelled')),
  premium_until timestamptz null,
  premium_source text null check (premium_source in ('gift') or premium_source is null),
  created_at timestamptz not null default now()
);

-- Migración segura: columnas nuevas
alter table if exists public.profiles
  add column if not exists email text;

alter table if exists public.profiles
  add column if not exists full_name text;

-- ----------------------------------------------------------------------------
-- Auto-crear/actualizar profile con email desde auth.users
-- (Necesita ejecutarse con permisos elevados en Supabase SQL editor)
-- ----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, email, role)
  values (new.id, new.email, 'user')
  on conflict (user_id) do update
    set email = excluded.email;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'on_auth_user_created'
  ) then
    create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
  end if;
end;
$$;

-- Migración segura: default y constraint de role (idempotente)
alter table if exists public.profiles
  alter column role set default 'user';

do $$
begin
  -- reemplazamos el constraint de role si existía con una lista vieja
  if exists (
    select 1 from pg_constraint
    where conname = 'profiles_role_check'
  ) then
    alter table public.profiles drop constraint profiles_role_check;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_role_check check (role in ('super_admin','tenant_admin','user'));
  end if;
end;
$$;

-- Migración segura (si ya existía la tabla antes de agregar premium/status)
alter table if exists public.profiles
  add column if not exists account_status text not null default 'active';

-- Asegura el check constraint si la tabla existía (idempotente)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_account_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_account_status_check check (account_status in ('active','cancelled'));
  end if;
end;
$$;

alter table if exists public.profiles
  add column if not exists premium_until timestamptz;

alter table if exists public.profiles
  add column if not exists premium_source text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_premium_source_check'
  ) then
    alter table public.profiles
      add constraint profiles_premium_source_check check (premium_source in ('gift') or premium_source is null);
  end if;
end;
$$;

-- 2) Tenants (restaurantes)
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  is_public boolean not null default true,
  premium_until timestamptz null,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

-- Migración segura (si ya existía la tabla antes de agregar is_public)
alter table if exists public.tenants
  add column if not exists is_public boolean not null default true;

-- Migración segura (si ya existía la tabla antes de agregar premium_until)
alter table if exists public.tenants
  add column if not exists premium_until timestamptz;

-- Migración segura (subscription_tier: free, premium, premium_pro)
alter table if exists public.tenants
  add column if not exists subscription_tier text not null default 'free';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tenants_subscription_tier_check'
  ) then
    alter table public.tenants
      add constraint tenants_subscription_tier_check check (subscription_tier in ('free','premium','premium_pro'));
  end if;
end;
$$;

-- 3) Productos
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  price numeric(10,2) not null,
  description text null,
  image_url text null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Migración segura (si ya existía la tabla antes de agregar image_url)
alter table if exists public.products
  add column if not exists image_url text;

create index if not exists products_tenant_id_idx on public.products(tenant_id);

-- 4) Tema por tenant (variables CSS)
create table if not exists public.tenant_themes (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  primary_color text not null default '#111827',
  accent_color text not null default '#f59e0b',
  background_color text not null default '#ffffff',
  text_color text not null default '#111827',
  radius text not null default '12px',
  -- Card customization
  product_card_layout text not null default 'classic',
  card_bg text null,
  card_text text null,
  card_price text null,
  card_button text null,
  updated_at timestamptz not null default now()
);

-- Migración segura para columnas de cards
alter table if exists public.tenant_themes
  add column if not exists product_card_layout text not null default 'classic';
alter table if exists public.tenant_themes
  add column if not exists card_bg text;
alter table if exists public.tenant_themes
  add column if not exists card_text text;
alter table if exists public.tenant_themes
  add column if not exists card_price text;
alter table if exists public.tenant_themes
  add column if not exists card_button text;

-- helper trigger para updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'tenant_themes_set_updated_at'
  ) then
    create trigger tenant_themes_set_updated_at
    before update on public.tenant_themes
    for each row execute function public.set_updated_at();
  end if;
end;
$$;

-- 5) Pedidos
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_name text null,
  customer_phone text null,
  status text not null default 'paid' check (status in ('pending','paid','cancelled','fulfilled')),
  currency text not null default 'USD',
  total numeric(10,2) not null,
  created_at timestamptz not null default now()
);

create index if not exists orders_tenant_id_created_at_idx on public.orders(tenant_id, created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid null references public.products(id) on delete set null,
  name text not null,
  unit_price numeric(10,2) not null,
  qty integer not null check (qty > 0),
  line_total numeric(10,2) not null,
  created_at timestamptz not null default now()
);

create index if not exists order_items_order_id_idx on public.order_items(order_id);

-- 6) Storage (fotos de productos)
-- Crea/asegura un bucket público para servir imágenes por URL.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = excluded.public;

-- -----------------------------------------------------------------------------
-- Super admin bootstrap (paso manual)
-- -----------------------------------------------------------------------------
-- Para convertir al usuario "franco_burgoa1@hotmail.com" en super_admin:
-- 1) Primero el usuario debe existir en Supabase Auth (que se registre / inicie sesión al menos 1 vez).
-- 2) Ejecuta este bloque en el SQL Editor de Supabase (requiere permisos de owner/service_role
--    porque consulta auth.users).
--
do $$
declare
  v_user_id uuid;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = lower('francolucianoburgoa@gmail.com')
  limit 1;

  if v_user_id is null then
    raise exception 'No existe auth.users para ese email (primero debe registrarse)';
  end if;

  update public.profiles
  set role = 'super_admin'
  where user_id = v_user_id;
end $$;
