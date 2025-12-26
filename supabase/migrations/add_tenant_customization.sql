-- Migración para agregar campos de personalización del restaurante
-- Ejecutar en Supabase SQL Editor

-- Agregar columnas de personalización al tenant
ALTER TABLE IF EXISTS public.tenants
  ADD COLUMN IF NOT EXISTS logo TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS slogan TEXT,
  ADD COLUMN IF NOT EXISTS welcome_modal_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS welcome_modal_title TEXT,
  ADD COLUMN IF NOT EXISTS welcome_modal_message TEXT,
  ADD COLUMN IF NOT EXISTS welcome_modal_image TEXT;

-- Comentarios para documentación
COMMENT ON COLUMN public.tenants.logo IS 'URL del logo del restaurante';
COMMENT ON COLUMN public.tenants.description IS 'Descripción larga del restaurante';
COMMENT ON COLUMN public.tenants.slogan IS 'Slogan o frase corta del restaurante';
COMMENT ON COLUMN public.tenants.welcome_modal_enabled IS 'Si se muestra el modal de bienvenida a usuarios no logueados';
COMMENT ON COLUMN public.tenants.welcome_modal_title IS 'Título personalizado del modal de bienvenida';
COMMENT ON COLUMN public.tenants.welcome_modal_message IS 'Mensaje personalizado del modal de bienvenida';
COMMENT ON COLUMN public.tenants.welcome_modal_image IS 'Imagen personalizada del modal de bienvenida';
