-- ============================================
-- MIGRACIÓN COMBINADA: FOOTER + THEME STYLES
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- ============================================
-- PARTE 1: FOOTER LOCATION COLUMNS
-- ============================================

-- Ubicación con mapa
ALTER TABLE IF EXISTS public.store_footer_settings
  ADD COLUMN IF NOT EXISTS location_address text null;

ALTER TABLE IF EXISTS public.store_footer_settings
  ADD COLUMN IF NOT EXISTS location_lat decimal(10, 8) null;

ALTER TABLE IF EXISTS public.store_footer_settings
  ADD COLUMN IF NOT EXISTS location_lng decimal(11, 8) null;

-- Código de país para teléfono
ALTER TABLE IF EXISTS public.store_footer_settings
  ADD COLUMN IF NOT EXISTS phone_country_code text null default '+54';

-- Usar términos del sitio principal
ALTER TABLE IF EXISTS public.store_footer_settings
  ADD COLUMN IF NOT EXISTS use_site_terms boolean not null default false;

-- ============================================
-- PARTE 2: THEME TYPOGRAPHY AND STYLES
-- ============================================

-- Tipografía
ALTER TABLE IF EXISTS public.tenant_themes
  ADD COLUMN IF NOT EXISTS font_family text null default 'Inter';

-- Estilos visuales
ALTER TABLE IF EXISTS public.tenant_themes
  ADD COLUMN IF NOT EXISTS card_style text null default 'glass';

ALTER TABLE IF EXISTS public.tenant_themes
  ADD COLUMN IF NOT EXISTS button_style text null default 'rounded';

ALTER TABLE IF EXISTS public.tenant_themes
  ADD COLUMN IF NOT EXISTS layout_style text null default 'modern';

-- ============================================
-- VERIFICACIÓN
-- ============================================
DO $$
BEGIN
  -- Verificar footer columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'store_footer_settings'
    AND column_name = 'location_address'
  ) THEN
    RAISE EXCEPTION 'ERROR: location_address column was not created';
  END IF;

  -- Verificar theme columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tenant_themes'
    AND column_name = 'font_family'
  ) THEN
    RAISE EXCEPTION 'ERROR: font_family column was not created';
  END IF;

  RAISE NOTICE 'SUCCESS: All columns created successfully!';
END;
$$;
