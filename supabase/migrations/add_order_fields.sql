-- Migración: Agregar campos para datos completos de pedidos
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar columnas para tipo de entrega, dirección, notas y método de pago
ALTER TABLE IF EXISTS public.orders
  ADD COLUMN IF NOT EXISTS delivery_type text NOT NULL DEFAULT 'mostrador';

ALTER TABLE IF EXISTS public.orders
  ADD COLUMN IF NOT EXISTS delivery_address text NULL;

ALTER TABLE IF EXISTS public.orders
  ADD COLUMN IF NOT EXISTS delivery_notes text NULL;

ALTER TABLE IF EXISTS public.orders
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'efectivo';

-- 2. Agregar constraint para delivery_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_delivery_type_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_delivery_type_check 
      CHECK (delivery_type IN ('mostrador', 'domicilio', 'mesa'));
  END IF;
END;
$$;

-- 3. Agregar constraint para payment_method
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_payment_method_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_payment_method_check 
      CHECK (payment_method IN ('efectivo', 'tarjeta', 'qr', 'transferencia'));
  END IF;
END;
$$;

-- 4. Actualizar el constraint de status para incluir todos los estados necesarios
DO $$
BEGIN
  -- Eliminar constraint existente si existe
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_status_check'
  ) THEN
    ALTER TABLE public.orders DROP CONSTRAINT orders_status_check;
  END IF;

  -- Crear nuevo constraint con todos los estados
  ALTER TABLE public.orders
    ADD CONSTRAINT orders_status_check 
    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'paid', 'fulfilled'));
END;
$$;

-- 5. Comentarios para documentación
COMMENT ON COLUMN public.orders.delivery_type IS 'Tipo de entrega: mostrador, domicilio, mesa';
COMMENT ON COLUMN public.orders.delivery_address IS 'Dirección de entrega (solo para domicilio)';
COMMENT ON COLUMN public.orders.delivery_notes IS 'Notas adicionales de entrega';
COMMENT ON COLUMN public.orders.payment_method IS 'Método de pago: efectivo, tarjeta, qr, transferencia';
