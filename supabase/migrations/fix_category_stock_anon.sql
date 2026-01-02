-- Permitir que usuarios anónimos puedan decrementar el stock de categorías y productos
-- Esto es necesario para que cuando un cliente no logueado haga un pedido,
-- el sistema pueda actualizar el stock

-- ============================================
-- POLICY PARA CATEGORÍAS
-- ============================================
DROP POLICY IF EXISTS "categories_anon_update_stock" ON public.product_categories;

CREATE POLICY "categories_anon_update_stock" ON public.product_categories
FOR UPDATE TO anon
USING (true)
WITH CHECK (true);

-- ============================================
-- POLICY PARA PRODUCTOS
-- ============================================
DROP POLICY IF EXISTS "products_anon_update_stock" ON public.products;

CREATE POLICY "products_anon_update_stock" ON public.products
FOR UPDATE TO anon
USING (true)
WITH CHECK (true);

-- Nota: Estas policies permiten UPDATE en cualquier columna por anon.
-- Si quieres ser más restrictivo, puedes usar TRIGGERS para validar
-- que solo se modifica current_stock/stock.

-- Alternativa más segura: Usar una función RPC con SECURITY DEFINER
-- Ejemplo:
/*
CREATE OR REPLACE FUNCTION public.decrement_category_stock(
  p_category_id uuid,
  p_quantity integer
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

GRANT EXECUTE ON FUNCTION public.decrement_category_stock(uuid, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.decrement_category_stock(uuid, integer) TO authenticated;
*/
