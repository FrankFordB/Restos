-- ============================================================================
-- MIGRACIÓN: Corregir flujo de pago MercadoPago
-- EJECUTAR EN: Supabase SQL Editor (copiar y pegar TODO)
-- 
-- Corrige:
-- 1. CHECK constraint en orders.status no permite 'confirmed'
-- 2. No hay política SELECT para anon en orders
-- 3. No hay política SELECT para anon en order_items
-- 4. No hay política UPDATE para anon en orders (fallback)
-- 5. Permiso para anon en mark_order_paid
-- ============================================================================

-- FIX 1: Eliminar constraints de status y recrear con 'confirmed'
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT conname FROM pg_constraint 
    WHERE conrelid = 'public.orders'::regclass 
    AND contype = 'c' 
    AND pg_get_constraintdef(oid) LIKE '%status%'
  LOOP
    EXECUTE 'ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
  END LOOP;
END $$;

ALTER TABLE public.orders
ADD CONSTRAINT orders_status_check 
CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'paid', 'fulfilled'));

-- FIX 2: Política SELECT anon para orders (polling post-pago)
DROP POLICY IF EXISTS "orders_select_anon" ON public.orders;
DROP POLICY IF EXISTS "orders_select_recent_anon" ON public.orders;

CREATE POLICY "orders_select_recent_anon" ON public.orders
FOR SELECT TO anon
USING (created_at > NOW() - INTERVAL '24 hours');

-- FIX 3: Política SELECT anon para order_items
DROP POLICY IF EXISTS "order_items_select_anon" ON public.order_items;

CREATE POLICY "order_items_select_anon" ON public.order_items
FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_items.order_id 
    AND orders.created_at > NOW() - INTERVAL '24 hours'
  )
);

-- FIX 4: Política UPDATE anon para orders (fallback de confirmación de pago)
DROP POLICY IF EXISTS "orders_update_anon_payment" ON public.orders;

CREATE POLICY "orders_update_anon_payment" ON public.orders
FOR UPDATE TO anon
USING (
  payment_method = 'mercadopago' 
  AND is_paid = false 
  AND created_at > NOW() - INTERVAL '24 hours'
)
WITH CHECK (
  payment_method = 'mercadopago'
  AND created_at > NOW() - INTERVAL '24 hours'
);

-- FIX 5: Permitir anon ejecutar mark_order_paid (para fallback)
GRANT EXECUTE ON FUNCTION public.mark_order_paid TO anon;
