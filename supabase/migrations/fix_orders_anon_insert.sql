-- Fix: Allow anonymous users to create orders in the storefront
-- This is needed because customers don't need to be logged in to place orders

-- Drop existing policies (both old and new names)
DROP POLICY IF EXISTS "orders_insert" ON public.orders;
DROP POLICY IF EXISTS "orders_insert_anon" ON public.orders;
DROP POLICY IF EXISTS "order_items_insert" ON public.order_items;
DROP POLICY IF EXISTS "order_items_insert_anon" ON public.order_items;

-- Allow anyone (including anon) to insert orders for any tenant
-- The tenant_id must be a valid public tenant
CREATE POLICY "orders_insert_anon" ON public.orders
FOR INSERT
TO anon, authenticated
WITH CHECK (
  -- The tenant must be public (visible in storefront)
  EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = orders.tenant_id
      AND t.is_public = true
  )
);

-- Allow anyone to insert order items if the order exists
CREATE POLICY "order_items_insert_anon" ON public.order_items
FOR INSERT
TO anon, authenticated
WITH CHECK (
  -- The order must exist
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
  )
);

-- Note: SELECT and UPDATE policies remain as they are (only tenant admins can see/update orders)
