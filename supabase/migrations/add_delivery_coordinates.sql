-- Agregar columnas de coordenadas GPS para delivery
-- Permite al repartidor encontrar la dirección del cliente fácilmente

ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS delivery_lat DOUBLE PRECISION DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS delivery_lng DOUBLE PRECISION DEFAULT NULL;

-- Comentarios descriptivos
COMMENT ON COLUMN public.orders.delivery_lat IS 'Latitud GPS del cliente para delivery';
COMMENT ON COLUMN public.orders.delivery_lng IS 'Longitud GPS del cliente para delivery';
