-- Ensure opening_hours column exists and has proper structure
-- Run this migration if opening hours are not working

-- 1. Add column if not exists
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS opening_hours JSONB DEFAULT '[]'::jsonb;

-- 2. Add comment for documentation
COMMENT ON COLUMN public.tenants.opening_hours IS 
  'JSON array of opening hours: [{day: "lunes", open: "09:00", close: "22:00", enabled: true}]';

-- 3. Create index for performance (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_tenants_opening_hours 
ON public.tenants USING gin (opening_hours);

-- 4. Verify the column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tenants' 
    AND column_name = 'opening_hours'
  ) THEN
    RAISE NOTICE 'SUCCESS: opening_hours column exists in tenants table';
  ELSE
    RAISE EXCEPTION 'ERROR: opening_hours column was not created';
  END IF;
END
$$;

-- 5. Example: Set sample opening hours for testing (commented out)
-- UPDATE public.tenants 
-- SET opening_hours = '[
--   {"day": "lunes", "open": "09:00", "close": "22:00", "enabled": true},
--   {"day": "martes", "open": "09:00", "close": "22:00", "enabled": true},
--   {"day": "miercoles", "open": "09:00", "close": "22:00", "enabled": true},
--   {"day": "jueves", "open": "09:00", "close": "22:00", "enabled": true},
--   {"day": "viernes", "open": "09:00", "close": "23:00", "enabled": true},
--   {"day": "sabado", "open": "10:00", "close": "23:00", "enabled": true},
--   {"day": "domingo", "open": "10:00", "close": "21:00", "enabled": false}
-- ]'::jsonb
-- WHERE slug = 'tu-restaurante';
