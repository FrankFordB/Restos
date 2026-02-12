-- Migration: Add focal_point column to product_categories table
-- Stores the focal point (x, y) as a JSONB object for image positioning in category cards

ALTER TABLE public.product_categories
ADD COLUMN IF NOT EXISTS focal_point JSONB DEFAULT NULL;

COMMENT ON COLUMN public.product_categories.focal_point IS 'Punto focal de la imagen como {x: number, y: number} en porcentaje (0-100)';
