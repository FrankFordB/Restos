-- Agregar columna para diseño de cards de categorías
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS mobile_category_card_design TEXT DEFAULT 'default';
