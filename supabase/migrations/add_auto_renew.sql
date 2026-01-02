-- Migración: Agregar campo auto_renew a tenants para renovación automática de suscripciones

-- Agregar columna auto_renew para indicar si el tenant quiere renovación automática
ALTER TABLE IF EXISTS public.tenants
  ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT FALSE;

-- Comentario para documentar el propósito
COMMENT ON COLUMN public.tenants.auto_renew IS 'Indica si la suscripción se renovará automáticamente al vencer';
