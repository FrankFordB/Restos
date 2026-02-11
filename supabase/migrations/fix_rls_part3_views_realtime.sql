-- ============================================================================
-- PARTE 3: Vistas SECURITY INVOKER + Realtime Publication (ejecutar TERCERO)
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

-- Verificar realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'product_categories'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.product_categories;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'tenants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tenants;
  END IF;
END $$;
