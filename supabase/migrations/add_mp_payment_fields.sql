-- Migración: Agregar campos de pago de MercadoPago a orders
-- Estos campos permiten trackear el estado de pago de MP

-- Agregar columnas de pago MP a la tabla orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS mp_payment_id text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS mp_preference_id text DEFAULT NULL;

-- Índice para buscar órdenes por payment_id de MP
CREATE INDEX IF NOT EXISTS idx_orders_mp_payment_id ON public.orders(mp_payment_id) WHERE mp_payment_id IS NOT NULL;

-- Actualizar política RLS para permitir que usuarios anónimos creen órdenes
-- (los clientes de la tienda no están autenticados)

-- Primero eliminar política existente si existe
DROP POLICY IF EXISTS "anon_can_insert_orders" ON public.orders;

-- Permitir que usuarios anónimos inserten órdenes
CREATE POLICY "anon_can_insert_orders" 
  ON public.orders
  FOR INSERT
  WITH CHECK (true);

-- Permitir que el sistema actualice órdenes (para webhooks de MP)
DROP POLICY IF EXISTS "system_can_update_orders" ON public.orders;

CREATE POLICY "system_can_update_orders"
  ON public.orders
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Comentarios
COMMENT ON COLUMN public.orders.payment_status IS 'Estado del pago MP: approved, pending, rejected, cancelled';
COMMENT ON COLUMN public.orders.mp_payment_id IS 'ID del pago en MercadoPago';
COMMENT ON COLUMN public.orders.mp_preference_id IS 'ID de la preferencia de pago en MercadoPago';
