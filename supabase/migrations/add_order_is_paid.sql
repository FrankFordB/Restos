-- ============================================================================
-- MIGRACIÓN: Agregar campo is_paid y internal_notes a orders
-- EJECUTAR EN: Supabase SQL Editor
-- ============================================================================

-- Agregar columna is_paid a la tabla orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;

-- Agregar columna paid_at para registro de cuándo se pagó
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ NULL;

-- Agregar columna internal_notes para comentarios internos del staff
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS internal_notes TEXT NULL;

-- Crear índice para búsquedas por estado de pago
CREATE INDEX IF NOT EXISTS orders_is_paid_idx ON public.orders(is_paid);

-- Comentarios
COMMENT ON COLUMN public.orders.is_paid IS 'Indica si el pedido fue pagado (confirmado manualmente o por pasarela)';
COMMENT ON COLUMN public.orders.paid_at IS 'Fecha y hora en que se confirmó el pago';
COMMENT ON COLUMN public.orders.internal_notes IS 'Notas internas del staff para cocina/preparación';

-- ============================================================================
-- Función para marcar un pedido como pagado
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mark_order_paid(
  p_order_id UUID,
  p_is_paid BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
BEGIN
  -- Obtener orden
  SELECT * INTO v_order 
  FROM public.orders 
  WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido no encontrado');
  END IF;
  
  -- Actualizar estado de pago
  UPDATE public.orders
  SET 
    is_paid = p_is_paid,
    paid_at = CASE 
      WHEN p_is_paid = TRUE AND paid_at IS NULL THEN NOW()
      WHEN p_is_paid = FALSE THEN NULL
      ELSE paid_at
    END
  WHERE id = p_order_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'is_paid', p_is_paid,
    'paid_at', CASE WHEN p_is_paid THEN NOW() ELSE NULL END
  );
END;
$$;

-- Permisos
GRANT EXECUTE ON FUNCTION public.mark_order_paid TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_order_paid TO service_role;

-- ============================================================================
-- Función para actualizar notas internas de un pedido
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_order_notes(
  p_order_id UUID,
  p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Actualizar notas internas
  UPDATE public.orders
  SET internal_notes = p_notes
  WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido no encontrado');
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'internal_notes', p_notes
  );
END;
$$;

-- Permisos para notas
GRANT EXECUTE ON FUNCTION public.update_order_notes TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_order_notes TO service_role;

-- ============================================================================
-- TEST: Verifica que se agregó la columna
-- ============================================================================
-- SELECT id, customer_name, is_paid, paid_at, internal_notes FROM orders LIMIT 5;
-- ============================================================================
