-- Migración para agregar campos de información personal al perfil
-- Ejecutar en Supabase SQL Editor

-- Agregar columnas de información personal
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS phone_country_code TEXT DEFAULT '+54',
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS document_type TEXT,
  ADD COLUMN IF NOT EXISTS document_number TEXT,
  ADD COLUMN IF NOT EXISTS billing_address TEXT;

-- Comentarios para documentación
COMMENT ON COLUMN public.profiles.phone_country_code IS 'Código de país del teléfono (ej: +54)';
COMMENT ON COLUMN public.profiles.phone_number IS 'Número de teléfono sin código de país';
COMMENT ON COLUMN public.profiles.document_type IS 'Tipo de documento (DNI, CUIT, Pasaporte, etc.)';
COMMENT ON COLUMN public.profiles.document_number IS 'Número de documento';
COMMENT ON COLUMN public.profiles.billing_address IS 'Dirección de facturación';
