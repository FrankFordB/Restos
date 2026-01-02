-- Habilitar Realtime para la tabla products
-- Esto permite que los clientes vean cambios de stock en tiempo real

-- Habilitar replica identity para cambios realtime
ALTER TABLE public.products REPLICA IDENTITY FULL;

-- Agregar la tabla products a la publicación de Supabase Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
    RAISE NOTICE 'Tabla products agregada a supabase_realtime';
  ELSE
    RAISE NOTICE 'Tabla products ya está en supabase_realtime - OK';
  END IF;
END;
$$;

-- Policy para permitir UPDATE de stock por anon (necesario para decrementar stock al comprar)
DROP POLICY IF EXISTS "products_anon_update_stock" ON public.products;

CREATE POLICY "products_anon_update_stock" ON public.products
FOR UPDATE TO anon
USING (true)
WITH CHECK (true);

-- Nota: Si quieres ser más restrictivo, puedes usar una función RPC con SECURITY DEFINER
-- que solo permita modificar la columna stock
