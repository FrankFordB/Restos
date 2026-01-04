-- ============================================
-- ADD LOCATION COLUMNS TO STORE_FOOTER_SETTINGS
-- Columnas para ubicación con Google Maps
-- ============================================

-- Ubicación con Google Maps
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

-- Verificación
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'store_footer_settings'
    AND column_name = 'location_address'
  ) THEN
    RAISE NOTICE 'SUCCESS: location_address column exists in store_footer_settings table';
  ELSE
    RAISE EXCEPTION 'ERROR: location_address column was not created';
  END IF;
END;
$$;
