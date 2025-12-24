-- ============================================================================
-- SCHEMA V2: Sistema de Personalización Avanzada
-- Ejecutar en Supabase SQL Editor DESPUÉS de schema.sql
-- ============================================================================

-- 1) Añadir nivel de suscripción a tenants
-- ----------------------------------------------------------------------------
alter table if exists public.tenants
  add column if not exists subscription_tier text not null default 'free'
    check (subscription_tier in ('free', 'premium', 'premium_pro'));

-- Migrar tenants con premium_until activo a 'premium'
update public.tenants
set subscription_tier = 'premium'
where premium_until is not null and premium_until > now() and subscription_tier = 'free';

-- 2) Extender tenant_themes con más opciones
-- ----------------------------------------------------------------------------
alter table if exists public.tenant_themes
  add column if not exists font_family text default 'Inter';

alter table if exists public.tenant_themes
  add column if not exists font_heading text default 'Inter';

alter table if exists public.tenant_themes
  add column if not exists logo_url text;

alter table if exists public.tenant_themes
  add column if not exists favicon_url text;

alter table if exists public.tenant_themes
  add column if not exists cover_image_url text;

alter table if exists public.tenant_themes
  add column if not exists card_style text default 'glass'
    check (card_style in ('glass', 'solid', 'outlined', 'elevated', 'minimal'));

alter table if exists public.tenant_themes
  add column if not exists button_style text default 'rounded'
    check (button_style in ('rounded', 'pill', 'square', 'soft'));

alter table if exists public.tenant_themes
  add column if not exists layout_style text default 'modern'
    check (layout_style in ('modern', 'classic', 'minimal', 'bold'));

-- 3) Tabla de configuración de página (Page Builder)
-- ----------------------------------------------------------------------------
create table if not exists public.tenant_page_config (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  page_type text not null default 'storefront' check (page_type in ('storefront', 'home', 'about', 'contact')),
  blocks jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  is_published boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id, page_type)
);

create index if not exists tenant_page_config_tenant_idx on public.tenant_page_config(tenant_id);

-- Trigger para updated_at
do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'tenant_page_config_set_updated_at'
  ) then
    create trigger tenant_page_config_set_updated_at
    before update on public.tenant_page_config
    for each row execute function public.set_updated_at();
  end if;
end;
$$;

-- 4) Tabla de widgets/bloques personalizados
-- ----------------------------------------------------------------------------
create table if not exists public.tenant_widgets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  widget_type text not null check (widget_type in (
    'hero', 'products_grid', 'products_carousel', 'text_block', 
    'image_gallery', 'testimonials', 'contact_form', 'map',
    'featured_products', 'categories', 'banner', 'video',
    'social_links', 'newsletter', 'faq', 'team', 'stats'
  )),
  title text,
  content jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tenant_widgets_tenant_idx on public.tenant_widgets(tenant_id, sort_order);

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'tenant_widgets_set_updated_at'
  ) then
    create trigger tenant_widgets_set_updated_at
    before update on public.tenant_widgets
    for each row execute function public.set_updated_at();
  end if;
end;
$$;

-- 5) Plantillas prearmadas
-- ----------------------------------------------------------------------------
create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  thumbnail_url text,
  category text not null default 'restaurant' check (category in ('restaurant', 'cafe', 'bakery', 'food_truck', 'bar', 'general')),
  tier_required text not null default 'free' check (tier_required in ('free', 'premium', 'premium_pro')),
  theme_config jsonb not null default '{}'::jsonb,
  blocks_config jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Insertar plantillas de ejemplo
insert into public.templates (name, description, category, tier_required, theme_config, blocks_config) values
(
  'Restaurante Moderno',
  'Diseño limpio y moderno para restaurantes de alta gama',
  'restaurant',
  'free',
  '{"primary_color": "#0f172a", "accent_color": "#f97316", "card_style": "glass", "layout_style": "modern"}',
  '[{"type": "hero", "config": {}}, {"type": "featured_products", "config": {}}, {"type": "products_grid", "config": {}}]'
),
(
  'Cafetería Acogedora',
  'Estilo cálido y acogedor perfecto para cafeterías',
  'cafe',
  'free',
  '{"primary_color": "#78350f", "accent_color": "#d97706", "card_style": "solid", "layout_style": "classic"}',
  '[{"type": "hero", "config": {}}, {"type": "products_carousel", "config": {}}, {"type": "testimonials", "config": {}}]'
),
(
  'Food Truck Vibrante',
  'Colores llamativos y diseño dinámico para food trucks',
  'food_truck',
  'premium',
  '{"primary_color": "#dc2626", "accent_color": "#fbbf24", "card_style": "elevated", "layout_style": "bold"}',
  '[{"type": "hero", "config": {}}, {"type": "banner", "config": {}}, {"type": "products_carousel", "config": {}}, {"type": "social_links", "config": {}}]'
),
(
  'Panadería Artesanal',
  'Diseño elegante con toques artesanales',
  'bakery',
  'premium',
  '{"primary_color": "#7c2d12", "accent_color": "#ea580c", "card_style": "outlined", "layout_style": "classic"}',
  '[{"type": "hero", "config": {}}, {"type": "image_gallery", "config": {}}, {"type": "products_grid", "config": {}}, {"type": "contact_form", "config": {}}]'
),
(
  'Bar & Lounge Premium',
  'Diseño oscuro y sofisticado con efectos premium',
  'bar',
  'premium_pro',
  '{"primary_color": "#1e1b4b", "accent_color": "#a855f7", "card_style": "glass", "layout_style": "modern"}',
  '[{"type": "hero", "config": {}}, {"type": "video", "config": {}}, {"type": "products_carousel", "config": {}}, {"type": "image_gallery", "config": {}}, {"type": "testimonials", "config": {}}, {"type": "newsletter", "config": {}}]'
)
on conflict do nothing;

-- 6) Categorías de productos (para mejor organización)
-- ----------------------------------------------------------------------------
create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists product_categories_tenant_idx on public.product_categories(tenant_id, sort_order);

-- Añadir category_id a products
alter table if exists public.products
  add column if not exists category_id uuid references public.product_categories(id) on delete set null;

alter table if exists public.products
  add column if not exists sort_order integer default 0;

alter table if exists public.products
  add column if not exists featured boolean default false;

-- 7) RLS para nuevas tablas
-- ----------------------------------------------------------------------------
alter table public.tenant_page_config enable row level security;
alter table public.tenant_widgets enable row level security;
alter table public.templates enable row level security;
alter table public.product_categories enable row level security;

-- Policies para tenant_page_config
drop policy if exists "page_config_select" on public.tenant_page_config;
create policy "page_config_select" on public.tenant_page_config
for select to authenticated
using (
  public.is_super_admin()
  or tenant_id = public.current_tenant_id()
  or exists (select 1 from public.tenants t where t.id = tenant_id and t.owner_user_id = auth.uid())
);

drop policy if exists "page_config_public_select" on public.tenant_page_config;
create policy "page_config_public_select" on public.tenant_page_config
for select to anon
using (is_published = true);

drop policy if exists "page_config_modify" on public.tenant_page_config;
create policy "page_config_modify" on public.tenant_page_config
for all to authenticated
using (
  public.is_super_admin()
  or exists (select 1 from public.tenants t where t.id = tenant_id and t.owner_user_id = auth.uid())
)
with check (
  public.is_super_admin()
  or exists (select 1 from public.tenants t where t.id = tenant_id and t.owner_user_id = auth.uid())
);

-- Policies para tenant_widgets
drop policy if exists "widgets_select" on public.tenant_widgets;
create policy "widgets_select" on public.tenant_widgets
for select to authenticated
using (
  public.is_super_admin()
  or tenant_id = public.current_tenant_id()
  or exists (select 1 from public.tenants t where t.id = tenant_id and t.owner_user_id = auth.uid())
);

drop policy if exists "widgets_public_select" on public.tenant_widgets;
create policy "widgets_public_select" on public.tenant_widgets
for select to anon
using (is_visible = true);

drop policy if exists "widgets_modify" on public.tenant_widgets;
create policy "widgets_modify" on public.tenant_widgets
for all to authenticated
using (
  public.is_super_admin()
  or exists (select 1 from public.tenants t where t.id = tenant_id and t.owner_user_id = auth.uid())
)
with check (
  public.is_super_admin()
  or exists (select 1 from public.tenants t where t.id = tenant_id and t.owner_user_id = auth.uid())
);

-- Policies para templates (públicas, solo lectura)
drop policy if exists "templates_public_select" on public.templates;
create policy "templates_public_select" on public.templates
for select to authenticated, anon
using (is_active = true);

drop policy if exists "templates_admin_modify" on public.templates;
create policy "templates_admin_modify" on public.templates
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- Policies para product_categories
drop policy if exists "categories_select" on public.product_categories;
create policy "categories_select" on public.product_categories
for select to authenticated
using (
  public.is_super_admin()
  or tenant_id = public.current_tenant_id()
);

drop policy if exists "categories_public_select" on public.product_categories;
create policy "categories_public_select" on public.product_categories
for select to anon
using (is_visible = true);

drop policy if exists "categories_modify" on public.product_categories;
create policy "categories_modify" on public.product_categories
for all to authenticated
using (
  public.is_super_admin()
  or tenant_id = public.current_tenant_id()
)
with check (
  public.is_super_admin()
  or tenant_id = public.current_tenant_id()
);
