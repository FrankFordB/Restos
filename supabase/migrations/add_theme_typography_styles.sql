-- ============================================
-- ADD TYPOGRAPHY AND STYLE COLUMNS TO TENANT_THEMES
-- Columnas para tipografía, estilos de cards, botones y layout
-- ============================================

-- Tipografía
ALTER TABLE IF EXISTS public.tenant_themes
  ADD COLUMN IF NOT EXISTS font_family text null default 'Inter';

-- Estilos
ALTER TABLE IF EXISTS public.tenant_themes
  ADD COLUMN IF NOT EXISTS card_style text null default 'glass';

ALTER TABLE IF EXISTS public.tenant_themes
  ADD COLUMN IF NOT EXISTS button_style text null default 'rounded';

ALTER TABLE IF EXISTS public.tenant_themes
  ADD COLUMN IF NOT EXISTS layout_style text null default 'modern';

-- Verificación
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tenant_themes'
    AND column_name = 'font_family'
  ) THEN
    RAISE NOTICE 'SUCCESS: font_family column exists in tenant_themes table';
  ELSE
    RAISE EXCEPTION 'ERROR: font_family column was not created';
  END IF;
END;
$$;
