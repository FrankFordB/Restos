-- Habilitar Realtime para la tabla orders
-- Esto permite que los cambios en pedidos se transmitan en tiempo real

-- Habilitar replica identity para que DELETE funcione correctamente
ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- Agregar la tabla orders a la publicación de Supabase Realtime
-- Solo si no existe ya (evita error 42710)
DO $$
BEGIN
  -- Verificar si la tabla ya está en la publicación
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    RAISE NOTICE 'Tabla orders agregada a supabase_realtime';
  ELSE
    RAISE NOTICE 'Tabla orders ya está en supabase_realtime - OK';
  END IF;
END $$;
