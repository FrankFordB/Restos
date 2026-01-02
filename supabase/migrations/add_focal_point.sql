-- Migration: Add focal_point column to products table
-- This stores the focal point (x, y) as a JSONB object for image positioning

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS focal_point JSONB DEFAULT NULL;

-- Comment explaining the column
COMMENT ON COLUMN public.products.focal_point IS 'Punto focal de la imagen como {x: number, y: number} en porcentaje (0-100)';
