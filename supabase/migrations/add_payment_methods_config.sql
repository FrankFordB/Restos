-- Migración: Agregar columna payment_methods_config a tenants
-- Esta columna almacena la configuración de métodos de pago habilitados por el dueño de la tienda

-- Agregar columna payment_methods_config de tipo JSONB con valor por defecto
ALTER TABLE IF EXISTS public.tenants
  ADD COLUMN IF NOT EXISTS payment_methods_config JSONB NOT NULL DEFAULT '{"efectivo": true, "tarjeta": true, "qr": true}'::jsonb;

-- Comentario para documentación
COMMENT ON COLUMN public.tenants.payment_methods_config IS 'Configuración de métodos de pago habilitados: efectivo (cash), tarjeta (card in store), qr (MercadoPago)';

-- Agregar columna delivery_pricing a tenants para precios de delivery
ALTER TABLE IF EXISTS public.tenants
  ADD COLUMN IF NOT EXISTS delivery_pricing JSONB NOT NULL DEFAULT '{"type": "free", "fixedPrice": 0, "freeThreshold": 0}'::jsonb;

-- Comentario para documentación
COMMENT ON COLUMN public.tenants.delivery_pricing IS 'Configuración de precios de delivery: type (free/fixed/threshold), fixedPrice, freeThreshold (envío gratis a partir de X)';
