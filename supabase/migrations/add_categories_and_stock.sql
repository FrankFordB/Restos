-- Migración para agregar categorías de productos y control de stock.

-- 1) Tabla de categorías de productos
create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists product_categories_tenant_id_idx on public.product_categories(tenant_id);

-- 2) Columnas nuevas en la tabla de productos
alter table if exists public.products
  add column if not exists category_id uuid null references public.product_categories(id) on delete set null;

alter table if exists public.products
  add column if not exists stock integer;

alter table if exists public.products
  add column if not exists track_stock boolean not null default false;

alter table if exists public.products
  add column if not exists sort_order integer not null default 0;

create index if not exists products_category_id_idx on public.products(category_id);
