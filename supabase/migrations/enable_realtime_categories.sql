-- Habilitar Realtime para la tabla product_categories
-- Esto permite que los clientes vean actualizaciones de stock en tiempo real

-- Habilitar replica identity para cambios realtime
ALTER TABLE public.product_categories REPLICA IDENTITY FULL;

-- Agregar la tabla product_categories a la publicación de Supabase Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'product_categories'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.product_categories;
    RAISE NOTICE 'Tabla product_categories agregada a supabase_realtime';
  ELSE
    RAISE NOTICE 'Tabla product_categories ya está en supabase_realtime - OK';
  END IF;
END $$;
