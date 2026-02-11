-- ============================================================================
-- PARTE 1: Corregir políticas RLS (ejecutar PRIMERO)
-- ============================================================================

-- FIX 1: extras y extra_groups
DROP POLICY IF EXISTS "extra_groups_all" ON public.extra_groups;
DROP POLICY IF EXISTS "extras_all" ON public.extras;
DROP POLICY IF EXISTS "extra_groups_select_policy" ON public.extra_groups;
DROP POLICY IF EXISTS "extras_select_policy" ON public.extras;
DROP POLICY IF EXISTS "extra_groups_public_read" ON public.extra_groups;
DROP POLICY IF EXISTS "extras_public_read" ON public.extras;
DROP POLICY IF EXISTS "extra_groups_modify_owner" ON public.extra_groups;
DROP POLICY IF EXISTS "extras_modify_owner" ON public.extras;

CREATE POLICY "extra_groups_public_read" ON public.extra_groups
FOR SELECT USING (true);

CREATE POLICY "extras_public_read" ON public.extras
FOR SELECT USING (true);

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

-- FIX 2 & 3: RPC seguras para stock
DROP POLICY IF EXISTS "products_anon_update_stock" ON public.products;
DROP POLICY IF EXISTS "categories_anon_update_stock" ON public.product_categories;

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

GRANT EXECUTE ON FUNCTION public.decrement_product_stock TO anon;
GRANT EXECUTE ON FUNCTION public.decrement_product_stock TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_category_stock TO anon;
GRANT EXECUTE ON FUNCTION public.decrement_category_stock TO authenticated;

-- FIX 4: profiles INSERT
DROP POLICY IF EXISTS "profiles_insert_any" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_authenticated" ON public.profiles;

CREATE POLICY "profiles_insert_authenticated" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- FIX 5 & 6: orders/order_items DELETE
DROP POLICY IF EXISTS "orders_delete_all" ON public.orders;
DROP POLICY IF EXISTS "order_items_delete_all" ON public.order_items;
DROP POLICY IF EXISTS "orders_delete_owner" ON public.orders;
DROP POLICY IF EXISTS "order_items_delete_owner" ON public.order_items;

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

-- FIX 7: orders SELECT anon
DROP POLICY IF EXISTS "orders_select_recent_anon" ON public.orders;
DROP POLICY IF EXISTS "orders_select_anon" ON public.orders;
DROP POLICY IF EXISTS "orders_select_anon_mp" ON public.orders;

CREATE POLICY "orders_select_anon_mp" ON public.orders
FOR SELECT TO anon
USING (
  payment_method = 'mercadopago'
  AND created_at > NOW() - INTERVAL '2 hours'
);

-- FIX 8: categories SELECT
DROP POLICY IF EXISTS "categories_public_select" ON public.product_categories;

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
