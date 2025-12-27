-- =====================================================
-- FIX COMPLETO: Permitir pedidos de usuarios anónimos
-- Ejecutar en Supabase Dashboard → SQL Editor
-- =====================================================

-- 1. GRANT: Dar permisos de INSERT al rol anon en las tablas
GRANT INSERT ON public.orders TO anon;
GRANT INSERT ON public.order_items TO anon;
GRANT SELECT ON public.tenants TO anon;
GRANT SELECT ON public.products TO anon;

-- 2. Asegurar que las secuencias también tengan permisos (para auto-increment)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- 3. Eliminar TODAS las políticas de INSERT existentes
DROP POLICY IF EXISTS "orders_insert" ON public.orders;
DROP POLICY IF EXISTS "orders_insert_anon" ON public.orders;
DROP POLICY IF EXISTS "orders_insert_public" ON public.orders;
DROP POLICY IF EXISTS "order_items_insert" ON public.order_items;
DROP POLICY IF EXISTS "order_items_insert_anon" ON public.order_items;
DROP POLICY IF EXISTS "order_items_insert_public" ON public.order_items;

-- 4. Crear política de INSERT para orders (anon + authenticated)
CREATE POLICY "orders_insert_anon" ON public.orders
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = orders.tenant_id
      AND t.is_public = true
  )
);

-- 5. Crear política de INSERT para order_items (anon + authenticated)
CREATE POLICY "order_items_insert_anon" ON public.order_items
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
  )
);

-- 6. Asegurar que los tenants sean públicos (IMPORTANTE)
UPDATE public.tenants 
SET is_public = true 
WHERE is_public IS NULL OR is_public = false;

-- 7. Verificar políticas creadas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename IN ('orders', 'order_items')
ORDER BY tablename, policyname;
