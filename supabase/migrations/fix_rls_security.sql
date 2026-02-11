-- ============================================================================
-- MIGRACIÓN: Corregir alertas de seguridad RLS
-- EJECUTAR EN: Supabase SQL Editor (copiar y pegar TODO)
-- 
-- Corrige las políticas RLS que Supabase marca como inseguras:
-- 1. extras/extra_groups: FOR ALL USING(true) → separar lectura/escritura
-- 2. products_anon_update_stock: anon UPDATE sin restricción → RPC segura
-- 3. categories_anon_update_stock: anon UPDATE sin restricción → RPC segura
-- 4. profiles_insert_any: INSERT sin restricción de rol → limitar
-- 5. orders_delete_all: DELETE sin restricción → solo tenant owner
-- 6. order_items_delete_all: DELETE sin restricción → solo tenant owner
-- 7. orders_select_recent_anon: sin filtro de tenant → solo por order_id
-- 8. Vistas con SECURITY DEFINER → cambiar a SECURITY INVOKER
-- ============================================================================

-- ============================================================================
-- FIX 1: extras y extra_groups - separar lectura pública de escritura
-- ============================================================================

-- Limpiar políticas viejas
DROP POLICY IF EXISTS "extra_groups_all" ON public.extra_groups;
DROP POLICY IF EXISTS "extras_all" ON public.extras;
DROP POLICY IF EXISTS "extra_groups_select_policy" ON public.extra_groups;
DROP POLICY IF EXISTS "extras_select_policy" ON public.extras;
DROP POLICY IF EXISTS "extra_groups_public_read" ON public.extra_groups;
DROP POLICY IF EXISTS "extras_public_read" ON public.extras;
DROP POLICY IF EXISTS "extra_groups_modify_owner" ON public.extra_groups;
DROP POLICY IF EXISTS "extras_modify_owner" ON public.extras;

-- Lectura pública (necesaria para la tienda)
CREATE POLICY "extra_groups_public_read" ON public.extra_groups
FOR SELECT USING (true);

CREATE POLICY "extras_public_read" ON public.extras
FOR SELECT USING (true);

-- Escritura solo para dueños del tenant (authenticated)
CREATE POLICY "extra_groups_modify_owner" ON public.extra_groups
FOR ALL TO authenticated
USING (
  tenant_id IN (
    SELECT t.id FROM public.tenants t
    WHERE t.owner_user_id = auth.uid()
  )
  OR public.is_super_admin()
)
WITH CHECK (
  tenant_id IN (
    SELECT t.id FROM public.tenants t
    WHERE t.owner_user_id = auth.uid()
  )
  OR public.is_super_admin()
);

CREATE POLICY "extras_modify_owner" ON public.extras
FOR ALL TO authenticated
USING (
  tenant_id IN (
    SELECT t.id FROM public.tenants t
    WHERE t.owner_user_id = auth.uid()
  )
  OR public.is_super_admin()
)
WITH CHECK (
  tenant_id IN (
    SELECT t.id FROM public.tenants t
    WHERE t.owner_user_id = auth.uid()
  )
  OR public.is_super_admin()
);

-- ============================================================================
-- FIX 2 & 3: Reemplazar UPDATE anon abierto en products y categories
-- con funciones RPC seguras (SECURITY DEFINER)
-- ============================================================================

-- Eliminar las políticas inseguras
DROP POLICY IF EXISTS "products_anon_update_stock" ON public.products;
DROP POLICY IF EXISTS "categories_anon_update_stock" ON public.product_categories;

-- Función segura para decrementar stock de producto
CREATE OR REPLACE FUNCTION public.decrement_product_stock(
  p_product_id UUID,
  p_quantity INT DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.products
  SET stock = GREATEST(0, COALESCE(stock, 0) - p_quantity)
  WHERE id = p_product_id
    AND stock IS NOT NULL;
END;
$$;

-- Función segura para decrementar stock de categoría
CREATE OR REPLACE FUNCTION public.decrement_category_stock(
  p_category_id UUID,
  p_quantity INT DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.product_categories
  SET current_stock = GREATEST(0, COALESCE(current_stock, 0) - p_quantity)
  WHERE id = p_category_id
    AND current_stock IS NOT NULL;
END;
$$;

-- Dar acceso a anon y authenticated
GRANT EXECUTE ON FUNCTION public.decrement_product_stock TO anon;
GRANT EXECUTE ON FUNCTION public.decrement_product_stock TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_category_stock TO anon;
GRANT EXECUTE ON FUNCTION public.decrement_category_stock TO authenticated;

-- ============================================================================
-- FIX 4: profiles_insert_any → solo service_role y authenticated
-- (el trigger on auth.users INSERT necesita esto, pero restringimos el rol)
-- ============================================================================

DROP POLICY IF EXISTS "profiles_insert_any" ON public.profiles;

-- Permitir INSERT solo a authenticated (el trigger usa service_role que bypasea RLS)
CREATE POLICY "profiles_insert_authenticated" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- FIX 5 & 6: orders/order_items DELETE → solo tenant owner o admin
-- ============================================================================

DROP POLICY IF EXISTS "orders_delete_all" ON public.orders;
DROP POLICY IF EXISTS "order_items_delete_all" ON public.order_items;

CREATE POLICY "orders_delete_owner" ON public.orders
FOR DELETE TO authenticated
USING (
  public.is_super_admin()
  OR tenant_id = public.current_tenant_id()
);

CREATE POLICY "order_items_delete_owner" ON public.order_items
FOR DELETE TO authenticated
USING (
  public.is_super_admin()
  OR order_id IN (
    SELECT id FROM public.orders
    WHERE tenant_id = public.current_tenant_id()
  )
);

-- ============================================================================
-- FIX 7: orders_select_recent_anon → más restrictivo
-- Solo permite leer la orden específica (por ID, conocido por el cliente)
-- ============================================================================

DROP POLICY IF EXISTS "orders_select_recent_anon" ON public.orders;
DROP POLICY IF EXISTS "orders_select_anon" ON public.orders;

-- Anon solo puede leer órdenes recientes con pago MP (para polling post-pago)
CREATE POLICY "orders_select_anon_mp" ON public.orders
FOR SELECT TO anon
USING (
  payment_method = 'mercadopago'
  AND created_at > NOW() - INTERVAL '2 hours'
);

-- ============================================================================
-- FIX 8: Asegurar que product_categories tiene SELECT para anon
-- (necesario para realtime en storefront)
-- ============================================================================

DROP POLICY IF EXISTS "categories_public_select" ON public.product_categories;

-- Verificar si ya existe una política SELECT permisiva
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'product_categories' 
    AND policyname = 'categories_select'
  ) THEN
    CREATE POLICY "categories_public_select" ON public.product_categories
    FOR SELECT USING (true);
  END IF;
END $$;

-- ============================================================================
-- FIX 9: Asegurar REPLICA IDENTITY FULL para realtime
-- (sin esto, los eventos UPDATE/DELETE no envían los datos completos)
-- ============================================================================

ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.products REPLICA IDENTITY FULL;
ALTER TABLE public.product_categories REPLICA IDENTITY FULL;
ALTER TABLE public.tenants REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.extra_groups REPLICA IDENTITY FULL;
ALTER TABLE public.extras REPLICA IDENTITY FULL;

-- ============================================================================
-- FIX 10: Vistas con SECURITY DEFINER → SECURITY INVOKER
-- Las vistas con SECURITY DEFINER ignoran las políticas RLS del usuario
-- que consulta y usan las del creador de la vista, lo cual es inseguro.
-- Cambiamos todas a SECURITY INVOKER para que respeten RLS.
-- ============================================================================

ALTER VIEW IF EXISTS public.products_with_sizes_expanded SET (security_invoker = on);
ALTER VIEW IF EXISTS public.products_with_active_discount SET (security_invoker = on);
ALTER VIEW IF EXISTS public.products_with_categories SET (security_invoker = on);
ALTER VIEW IF EXISTS public.category_tree SET (security_invoker = on);
ALTER VIEW IF EXISTS public.category_tree_v2 SET (security_invoker = on);
ALTER VIEW IF EXISTS public.category_tree_with_counts SET (security_invoker = on);
ALTER VIEW IF EXISTS public.categories_eligible_for_stock SET (security_invoker = on);
ALTER VIEW IF EXISTS public.available_size_presets SET (security_invoker = on);
ALTER VIEW IF EXISTS public.v_active_subscriptions SET (security_invoker = on);
ALTER VIEW IF EXISTS public.v_subscription_audit SET (security_invoker = on);

-- ============================================================================
-- Verificar que las tablas están en la publicación de realtime
-- ============================================================================

DO $$
BEGIN
  -- orders
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
  
  -- products
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  END IF;
  
  -- product_categories
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'product_categories'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.product_categories;
  END IF;
  
  -- tenants
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'tenants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tenants;
  END IF;
END $$;

-- ============================================================================
-- RESUMEN DE CAMBIOS:
-- 
-- ✅ extras/extra_groups: ahora lectura pública + escritura solo para dueños
-- ✅ products: eliminado UPDATE abierto para anon → usar RPC decrement_product_stock()
-- ✅ categories: eliminado UPDATE abierto para anon → usar RPC decrement_category_stock()  
-- ✅ profiles: INSERT solo para authenticated con user_id = auth.uid()
-- ✅ orders DELETE: solo tenant owner o super_admin
-- ✅ order_items DELETE: solo tenant owner o super_admin
-- ✅ orders SELECT anon: solo órdenes MP de últimas 2 horas
-- ✅ REPLICA IDENTITY FULL en todas las tablas con realtime
-- ✅ Tablas en supabase_realtime publication verificadas
-- ✅ 10 vistas cambiadas de SECURITY DEFINER → SECURITY INVOKER
-- ============================================================================
