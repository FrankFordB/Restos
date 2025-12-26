-- =============================================
-- FIX: ALLOW DELETE ON ORDERS TABLE
-- Run this in Supabase SQL Editor
-- =============================================

-- Drop existing delete policies if any
DROP POLICY IF EXISTS "orders_delete_policy" ON orders;
DROP POLICY IF EXISTS "orders_delete_all" ON orders;
DROP POLICY IF EXISTS "order_items_delete_policy" ON order_items;
DROP POLICY IF EXISTS "order_items_delete_all" ON order_items;

-- Create permissive DELETE policy for orders
CREATE POLICY "orders_delete_all" ON orders
    FOR DELETE USING (true);

-- Create permissive DELETE policy for order_items
CREATE POLICY "order_items_delete_all" ON order_items
    FOR DELETE USING (true);

-- Alternative: If you want tenant-based restriction, use this instead:
-- CREATE POLICY "orders_delete_own" ON orders
--     FOR DELETE USING (tenant_id = auth.uid()::text OR tenant_id IN (
--         SELECT id::text FROM tenants WHERE owner_id = auth.uid()
--     ));

-- Verify policies are created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('orders', 'order_items');
