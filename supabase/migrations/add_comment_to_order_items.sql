-- ============================================================================
-- AGREGAR COLUMNA COMMENT A ORDER_ITEMS
-- ============================================================================
-- Ejecutar en Supabase SQL Editor
-- Esta migración agrega el campo comment a los items de pedido para guardar
-- las instrucciones especiales del cliente (sin sal, sin salsa, etc.)
-- ============================================================================

-- Agregar columna comment a order_items
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS comment TEXT NULL;

-- Comentario para documentar
COMMENT ON COLUMN public.order_items.comment IS 'Instrucciones especiales del cliente para este producto (ej: sin sal, sin salsa)';

-- Verificar que se agregó correctamente
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'order_items' 
  AND table_schema = 'public'
ORDER BY ordinal_position;
