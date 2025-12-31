-- Migración para agregar configuración de sonido de notificaciones a tenants
-- Ejecutar en Supabase SQL Editor

-- Agregar columnas de configuración de sonido
ALTER TABLE IF EXISTS public.tenants
  ADD COLUMN IF NOT EXISTS sound_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE IF EXISTS public.tenants
  ADD COLUMN IF NOT EXISTS sound_repeat_count integer NOT NULL DEFAULT 3;

ALTER TABLE IF EXISTS public.tenants
  ADD COLUMN IF NOT EXISTS sound_delay_ms integer NOT NULL DEFAULT 1500;

-- Agregar constraint para validar repeat_count entre 1 y 10
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tenants_sound_repeat_count_check'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_sound_repeat_count_check CHECK (sound_repeat_count >= 1 AND sound_repeat_count <= 10);
  END IF;
END;
$$;

-- Agregar constraint para validar delay_ms valores permitidos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tenants_sound_delay_ms_check'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_sound_delay_ms_check CHECK (sound_delay_ms IN (500, 1000, 1500, 2000, 3000, 5000));
  END IF;
END;
$$;

-- Comentarios para documentación
COMMENT ON COLUMN public.tenants.sound_enabled IS 'Habilita o deshabilita el sonido de notificación de nuevos pedidos';
COMMENT ON COLUMN public.tenants.sound_repeat_count IS 'Número de veces que se repite el sonido (1-10)';
COMMENT ON COLUMN public.tenants.sound_delay_ms IS 'Delay en milisegundos entre cada repetición del sonido';
