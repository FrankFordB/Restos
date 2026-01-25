-- Migración: Sistema de Pagos de Clientes (Customer Purchases)
-- Implementa el flujo completo de Checkout Pro con validación de webhooks
-- El dinero va directo al admin/tenant usando SU access_token

-- ============================================================================
-- 1. TABLA: payment_events (Registro de webhooks)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identificadores
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- Datos de MercadoPago
  mp_payment_id text UNIQUE,
  mp_preference_id text,
  mp_event_id text,
  mp_event_type text,
  -- Tipo de flujo
  flow_type text NOT NULL DEFAULT 'customer_purchase' 
    CHECK (flow_type IN ('customer_purchase', 'admin_subscription')),
  -- Validación
  signature_valid boolean DEFAULT false,
  ip_address text,
  user_agent text,
  -- Estado
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'processing', 'verified', 'completed', 'failed', 'duplicate')),
  -- Payload completo (para auditoría)
  raw_payload jsonb,
  verification_result jsonb,
  -- Error info
  error_message text,
  retry_count integer DEFAULT 0,
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  verified_at timestamptz
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_payment_events_order ON public.payment_events(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_tenant ON public.payment_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_mp_payment ON public.payment_events(mp_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_mp_event ON public.payment_events(mp_event_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_status ON public.payment_events(status);
CREATE INDEX IF NOT EXISTS idx_payment_events_flow ON public.payment_events(flow_type);

-- ============================================================================
-- 2. ACTUALIZAR TABLA orders CON NUEVOS ESTADOS
-- ============================================================================

-- Agregar columnas adicionales para el sistema de pagos
ALTER TABLE IF EXISTS public.orders
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'processing_payment', 'paid', 'rejected', 'cancelled', 'expired', 'refunded')),
  ADD COLUMN IF NOT EXISTS mp_status text,
  ADD COLUMN IF NOT EXISTS mp_status_detail text,
  ADD COLUMN IF NOT EXISTS mp_payer_email text,
  ADD COLUMN IF NOT EXISTS mp_transaction_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS mp_currency_id text DEFAULT 'ARS',
  ADD COLUMN IF NOT EXISTS idempotency_key text UNIQUE,
  ADD COLUMN IF NOT EXISTS payment_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_verification_data jsonb;

-- Índice para idempotencia
CREATE INDEX IF NOT EXISTS idx_orders_idempotency ON public.orders(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_mp_payment ON public.orders(mp_payment_id);

-- ============================================================================
-- 3. RLS PARA payment_events
-- ============================================================================

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si existen (hacer idempotente)
DROP POLICY IF EXISTS "payment_events_tenant_select" ON public.payment_events;
DROP POLICY IF EXISTS "payment_events_system_insert" ON public.payment_events;
DROP POLICY IF EXISTS "payment_events_system_update" ON public.payment_events;

-- Dueños de tenant pueden ver sus eventos
CREATE POLICY "payment_events_tenant_select" ON public.payment_events
  FOR SELECT USING (
    tenant_id IN (
      SELECT t.id FROM public.tenants t
      WHERE t.owner_user_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Solo el sistema (service_role) puede insertar/actualizar
CREATE POLICY "payment_events_system_insert" ON public.payment_events
  FOR INSERT WITH CHECK (
    -- Permitir desde service_role (webhooks) o super_admin
    auth.uid() IS NULL OR
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "payment_events_system_update" ON public.payment_events
  FOR UPDATE USING (
    auth.uid() IS NULL OR
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- ============================================================================
-- 4. FUNCIÓN: Verificar y actualizar pago (idempotente)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.verify_and_complete_payment(
  p_order_id uuid,
  p_mp_payment_id text,
  p_mp_status text,
  p_mp_status_detail text,
  p_transaction_amount numeric,
  p_currency_id text,
  p_payer_email text,
  p_verification_data jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_result jsonb;
BEGIN
  -- Obtener orden actual con lock
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ORDER_NOT_FOUND',
      'message', 'Orden no encontrada'
    );
  END IF;
  
  -- Verificar idempotencia: si ya está pagada con el mismo payment_id, ignorar
  IF v_order.payment_status = 'paid' AND v_order.mp_payment_id = p_mp_payment_id THEN
    RETURN jsonb_build_object(
      'success', true,
      'action', 'ALREADY_PROCESSED',
      'message', 'Pago ya fue procesado anteriormente'
    );
  END IF;
  
  -- Validar que el monto coincide (anti-fraude)
  IF v_order.total != p_transaction_amount THEN
    -- Registrar discrepancia pero NO rechazar automáticamente
    -- (puede haber descuentos, shipping, etc)
    RAISE WARNING 'Discrepancia de monto: orden=% vs pago=%', v_order.total, p_transaction_amount;
  END IF;
  
  -- Actualizar según estado de MP
  IF p_mp_status = 'approved' THEN
    UPDATE public.orders
    SET 
      payment_status = 'paid',
      mp_payment_id = p_mp_payment_id,
      mp_status = p_mp_status,
      mp_status_detail = p_mp_status_detail,
      mp_transaction_amount = p_transaction_amount,
      mp_currency_id = p_currency_id,
      mp_payer_email = p_payer_email,
      is_paid = true,
      paid_at = now(),
      payment_verified_at = now(),
      payment_verification_data = p_verification_data,
      -- Cambiar estado de orden a confirmado si estaba pending
      status = CASE WHEN status = 'pending' THEN 'confirmed' ELSE status END
    WHERE id = p_order_id;
    
    v_result := jsonb_build_object(
      'success', true,
      'action', 'PAYMENT_APPROVED',
      'message', 'Pago aprobado y orden confirmada',
      'order_id', p_order_id,
      'new_status', 'paid'
    );
    
  ELSIF p_mp_status IN ('pending', 'in_process') THEN
    UPDATE public.orders
    SET 
      payment_status = 'processing_payment',
      mp_payment_id = p_mp_payment_id,
      mp_status = p_mp_status,
      mp_status_detail = p_mp_status_detail,
      mp_payer_email = p_payer_email
    WHERE id = p_order_id;
    
    v_result := jsonb_build_object(
      'success', true,
      'action', 'PAYMENT_PENDING',
      'message', 'Pago en proceso',
      'order_id', p_order_id,
      'new_status', 'processing_payment'
    );
    
  ELSIF p_mp_status IN ('rejected', 'cancelled') THEN
    UPDATE public.orders
    SET 
      payment_status = p_mp_status,
      mp_payment_id = p_mp_payment_id,
      mp_status = p_mp_status,
      mp_status_detail = p_mp_status_detail
    WHERE id = p_order_id;
    
    v_result := jsonb_build_object(
      'success', true,
      'action', 'PAYMENT_FAILED',
      'message', 'Pago rechazado o cancelado',
      'order_id', p_order_id,
      'new_status', p_mp_status
    );
    
  ELSIF p_mp_status = 'refunded' THEN
    UPDATE public.orders
    SET 
      payment_status = 'refunded',
      mp_status = p_mp_status,
      mp_status_detail = p_mp_status_detail
    WHERE id = p_order_id;
    
    v_result := jsonb_build_object(
      'success', true,
      'action', 'PAYMENT_REFUNDED',
      'message', 'Pago reembolsado',
      'order_id', p_order_id,
      'new_status', 'refunded'
    );
    
  ELSE
    v_result := jsonb_build_object(
      'success', false,
      'action', 'UNKNOWN_STATUS',
      'message', 'Estado de pago desconocido: ' || p_mp_status,
      'mp_status', p_mp_status
    );
  END IF;
  
  RETURN v_result;
END;
$$;

-- ============================================================================
-- 5. FUNCIÓN: Recalcular total de orden desde items (anti-fraude)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.recalculate_order_total(p_order_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_calculated_total numeric;
BEGIN
  SELECT COALESCE(SUM(line_total), 0)
  INTO v_calculated_total
  FROM public.order_items
  WHERE order_id = p_order_id;
  
  RETURN v_calculated_total;
END;
$$;

-- ============================================================================
-- 6. FUNCIÓN: Crear orden con items y generar idempotency_key
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_order_for_payment(
  p_tenant_id uuid,
  p_items jsonb,
  p_customer_name text DEFAULT NULL,
  p_customer_phone text DEFAULT NULL,
  p_delivery_type text DEFAULT 'mostrador',
  p_delivery_address text DEFAULT NULL,
  p_delivery_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_total numeric := 0;
  v_item record;
  v_idempotency_key text;
BEGIN
  -- Generar clave de idempotencia única
  v_idempotency_key := 'ord_' || gen_random_uuid()::text;
  
  -- Calcular total desde items
  SELECT COALESCE(SUM((item->>'lineTotal')::numeric), 0)
  INTO v_total
  FROM jsonb_array_elements(p_items) AS item;
  
  -- Crear orden
  INSERT INTO public.orders (
    tenant_id,
    status,
    payment_status,
    total,
    currency,
    customer_name,
    customer_phone,
    delivery_type,
    delivery_address,
    delivery_notes,
    payment_method,
    idempotency_key
  ) VALUES (
    p_tenant_id,
    'pending',
    'pending',
    v_total,
    'ARS',
    p_customer_name,
    p_customer_phone,
    p_delivery_type,
    p_delivery_address,
    p_delivery_notes,
    'mercadopago',
    v_idempotency_key
  )
  RETURNING id INTO v_order_id;
  
  -- Insertar items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.order_items (
      order_id,
      product_id,
      name,
      unit_price,
      qty,
      line_total,
      extras,
      comment
    ) VALUES (
      v_order_id,
      (v_item.value->>'productId')::uuid,
      v_item.value->>'name',
      (v_item.value->>'unitPrice')::numeric,
      (v_item.value->>'qty')::integer,
      (v_item.value->>'lineTotal')::numeric,
      COALESCE(v_item.value->'extras', '[]'::jsonb),
      v_item.value->>'comment'
    );
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'idempotency_key', v_idempotency_key,
    'total', v_total
  );
END;
$$;

-- ============================================================================
-- 7. COMENTARIOS
-- ============================================================================

COMMENT ON TABLE public.payment_events IS 'Registro de todos los webhooks de MercadoPago para auditoría';
COMMENT ON COLUMN public.orders.payment_status IS 'Estado del pago: pending, processing_payment, paid, rejected, cancelled, expired, refunded';
COMMENT ON COLUMN public.orders.idempotency_key IS 'Clave única para evitar procesar el mismo pago dos veces';
COMMENT ON FUNCTION public.verify_and_complete_payment IS 'Verifica y completa un pago de forma idempotente';
COMMENT ON FUNCTION public.recalculate_order_total IS 'Recalcula el total de una orden desde sus items (anti-fraude)';
