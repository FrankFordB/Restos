-- Migración: Agregar columna delivery_config a tenants
-- Esta columna almacena la configuración de tipos de envío habilitados

-- Agregar columna delivery_config de tipo JSONB con valor por defecto
ALTER TABLE IF EXISTS public.tenants
  ADD COLUMN IF NOT EXISTS delivery_config JSONB NOT NULL DEFAULT '{"mostrador": true, "domicilio": true, "mesa": true}'::jsonb;

-- Comentario para documentación
COMMENT ON COLUMN public.tenants.delivery_config IS 'Configuración de tipos de envío habilitados: mostrador, domicilio, mesa';
