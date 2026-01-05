-- ============================================
-- FIX: Aumentar precisión de campos numéricos para precios altos
-- numeric(10,2) máximo = 99,999,999.99
-- numeric(14,2) máximo = 999,999,999,999.99 (casi un trillón)
-- ============================================

-- 1) Tabla orders - campo total
ALTER TABLE public.orders 
  ALTER COLUMN total TYPE numeric(14,2);

-- 2) Tabla order_items - campos unit_price y line_total
ALTER TABLE public.order_items 
  ALTER COLUMN unit_price TYPE numeric(14,2);

ALTER TABLE public.order_items 
  ALTER COLUMN line_total TYPE numeric(14,2);

-- 3) Tabla products - campo price
ALTER TABLE public.products 
  ALTER COLUMN price TYPE numeric(14,2);

-- 4) Tabla products - campo cost (si existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'products' 
    AND column_name = 'cost'
  ) THEN
    ALTER TABLE public.products ALTER COLUMN cost TYPE numeric(14,2);
  END IF;
END;
$$;

-- ============================================
-- VERIFICACIÓN
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'SUCCESS: Campos numéricos actualizados a numeric(14,2)';
  RAISE NOTICE 'Nuevo máximo: 999,999,999,999.99 (casi un trillón)';
END;
$$;
