-- Migración: Agregar 'mercadopago' como método de pago válido
-- Ejecutar en Supabase SQL Editor

-- Eliminar el constraint existente y recrearlo con 'mercadopago'
DO $$
BEGIN
  -- Eliminar constraint existente si existe
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_payment_method_check'
  ) THEN
    ALTER TABLE public.orders DROP CONSTRAINT orders_payment_method_check;
  END IF;

  -- Crear nuevo constraint incluyendo 'mercadopago'
  ALTER TABLE public.orders
    ADD CONSTRAINT orders_payment_method_check 
    CHECK (payment_method IN ('efectivo', 'tarjeta', 'qr', 'transferencia', 'mercadopago'));
END;
$$;

-- Actualizar comentario
COMMENT ON COLUMN public.orders.payment_method IS 'Método de pago: efectivo, tarjeta, qr, transferencia, mercadopago';
