-- Migración: Agregar campo cost a productos para cálculo de márgenes
-- Este campo es interno y no debe mostrarse a clientes

-- Agregar columna cost para el costo del producto
ALTER TABLE IF EXISTS public.products
  ADD COLUMN IF NOT EXISTS cost NUMERIC(10,2) NULL DEFAULT NULL;

-- Comentario para documentar el propósito
COMMENT ON COLUMN public.products.cost IS 'Costo interno del producto para cálculo de márgenes. No visible a clientes.';

-- Índice para búsquedas de productos con costo definido (reportes)
CREATE INDEX IF NOT EXISTS products_cost_idx ON public.products(cost) WHERE cost IS NOT NULL;
