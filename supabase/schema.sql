-- Esquema recomendado para Supabase (PostgreSQL)
-- Ejecuta esto en Supabase SQL editor.

-- 1) Perfiles (role + tenant)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('super_admin','tenant_admin')),
  tenant_id uuid null,
  created_at timestamptz not null default now()
);

-- 2) Tenants (restaurantes)
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

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
  updated_at timestamptz not null default now()
);

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
