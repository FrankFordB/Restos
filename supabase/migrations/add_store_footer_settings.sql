-- ============================================
-- STORE FOOTER SETTINGS
-- Footer personalizado por tienda
-- ============================================

-- Tabla para configuración de footer por tienda
create table if not exists public.store_footer_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  
  -- Información básica
  store_name text null,
  short_description text null,
  
  -- Contacto
  address text null,
  city text null,
  country text null,
  phone text null,
  whatsapp text null,
  email text null,
  
  -- Redes sociales
  instagram_url text null,
  facebook_url text null,
  twitter_url text null,
  tiktok_url text null,
  youtube_url text null,
  
  -- Horarios (JSON con días y horas)
  business_hours jsonb null default '[]'::jsonb,
  
  -- Enlaces personalizados (JSON array)
  custom_links jsonb null default '[]'::jsonb,
  
  -- Configuración visual
  show_address boolean not null default true,
  show_phone boolean not null default true,
  show_email boolean not null default true,
  show_social boolean not null default true,
  show_hours boolean not null default true,
  show_payment_methods boolean not null default true,
  
  -- Métodos de pago aceptados
  accepts_cash boolean not null default true,
  accepts_card boolean not null default false,
  accepts_mercadopago boolean not null default false,
  accepts_transfer boolean not null default false,
  
  -- Texto legal personalizado
  legal_text text null,
  copyright_text text null,
  
  -- Ubicación con Google Maps
  location_address text null,
  location_lat decimal(10, 8) null,
  location_lng decimal(11, 8) null,
  
  -- Código de país para teléfono
  phone_country_code text null default '+54',
  
  -- Usar términos del sitio principal
  use_site_terms boolean not null default false,
  
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trigger para updated_at
do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'store_footer_settings_set_updated_at'
  ) then
    create trigger store_footer_settings_set_updated_at
    before update on public.store_footer_settings
    for each row execute function public.set_updated_at();
  end if;
end;
$$;

-- RLS Policies
alter table public.store_footer_settings enable row level security;

-- Lectura pública (para mostrar footer en tiendas)
drop policy if exists "store_footer_settings_select_public" on public.store_footer_settings;
create policy "store_footer_settings_select_public"
  on public.store_footer_settings for select
  using (true);

-- Escritura solo para dueños de la tienda o super_admin
drop policy if exists "store_footer_settings_insert_owner" on public.store_footer_settings;
create policy "store_footer_settings_insert_owner"
  on public.store_footer_settings for insert
  with check (
    exists (
      select 1 from public.tenants t
      where t.id = tenant_id
      and t.owner_user_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
      and p.role = 'super_admin'
    )
  );

drop policy if exists "store_footer_settings_update_owner" on public.store_footer_settings;
create policy "store_footer_settings_update_owner"
  on public.store_footer_settings for update
  using (
    exists (
      select 1 from public.tenants t
      where t.id = tenant_id
      and t.owner_user_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
      and p.role = 'super_admin'
    )
  );

drop policy if exists "store_footer_settings_delete_owner" on public.store_footer_settings;
create policy "store_footer_settings_delete_owner"
  on public.store_footer_settings for delete
  using (
    exists (
      select 1 from public.tenants t
      where t.id = tenant_id
      and t.owner_user_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
      and p.role = 'super_admin'
    )
  );

-- ============================================
-- AMPLIACIÓN DE PROFILES (campos adicionales para registro profesional)
-- ============================================

-- Campos adicionales para el perfil de usuario
alter table if exists public.profiles
  add column if not exists phone_country_code text;
  
alter table if exists public.profiles
  add column if not exists phone_number text;

alter table if exists public.profiles
  add column if not exists document_type text;

alter table if exists public.profiles
  add column if not exists document_number text;

alter table if exists public.profiles
  add column if not exists country text;

alter table if exists public.profiles
  add column if not exists city text;

alter table if exists public.profiles
  add column if not exists billing_address text;

-- ============================================
-- AMPLIACIÓN DE TENANTS (campos adicionales)
-- ============================================

alter table if exists public.tenants
  add column if not exists business_type text;

alter table if exists public.tenants
  add column if not exists logo_url text;

alter table if exists public.tenants
  add column if not exists description text;

alter table if exists public.tenants
  add column if not exists phone text;

alter table if exists public.tenants
  add column if not exists email text;

alter table if exists public.tenants
  add column if not exists address text;

alter table if exists public.tenants
  add column if not exists city text;

alter table if exists public.tenants
  add column if not exists country text;

-- Crear footer settings automáticamente cuando se crea un tenant
create or replace function public.create_store_footer_on_tenant_insert()
returns trigger as $$
begin
  insert into public.store_footer_settings (tenant_id, store_name)
  values (new.id, new.name)
  on conflict (tenant_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'on_tenant_created_create_footer'
  ) then
    create trigger on_tenant_created_create_footer
    after insert on public.tenants
    for each row execute function public.create_store_footer_on_tenant_insert();
  end if;
end;
$$;

-- Crear footer settings para tenants existentes que no lo tengan
insert into public.store_footer_settings (tenant_id, store_name)
select t.id, t.name
from public.tenants t
where not exists (
  select 1 from public.store_footer_settings sfs
  where sfs.tenant_id = t.id
)
on conflict (tenant_id) do nothing;
