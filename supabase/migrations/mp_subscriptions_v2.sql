-- ============================================================================
-- Sistema de Suscripciones MercadoPago v2
-- Tablas y funciones para manejar Preapprovals de MP
-- ============================================================================

-- ============================================================================
-- 1. TABLA: mp_subscriptions (recrear con estructura correcta)
-- ============================================================================

-- Eliminar tabla anterior si existe
DROP TABLE IF EXISTS public.mp_subscriptions CASCADE;

CREATE TABLE public.mp_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- MercadoPago IDs
  mp_preapproval_id TEXT UNIQUE NOT NULL,     -- ID de la suscripción en MP
  mp_payer_id TEXT,                           -- ID del pagador en MP
  mp_payer_email TEXT,                        -- Email del pagador
  
  -- Plan
  plan_id TEXT NOT NULL,                      -- RESTO_PREMIUM_MONTHLY, RESTO_PRO_MONTHLY
  plan_tier TEXT NOT NULL,                    -- premium, premium_pro
  plan_amount NUMERIC(10,2) NOT NULL,         -- Monto mensual
  
  -- Estado (source of truth viene del webhook)
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'authorized', 'active', 'paused', 'cancelled', 'expired', 'payment_failed')),
  
  -- Fechas
  start_date TIMESTAMPTZ,                     -- Cuando se autorizó por primera vez
  next_billing_date TIMESTAMPTZ,              -- Próximo cobro programado
  last_payment_date TIMESTAMPTZ,              -- Último pago exitoso
  end_date TIMESTAMPTZ,                       -- Cuando termina (si se cancela)
  
  -- Período de gracia (3 días después de pago fallido)
  grace_period_ends TIMESTAMPTZ,              -- Hasta cuándo tiene beneficios si falla pago
  failed_payments_count INT DEFAULT 0,        -- Intentos fallidos consecutivos
  
  -- Contadores
  total_payments INT DEFAULT 0,               -- Cantidad de pagos exitosos totales
  last_payment_amount NUMERIC(10,2),          -- Monto del último pago
  
  -- External reference para trackear
  external_reference TEXT,                    -- tenant_id + plan para trackear
  
  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Un tenant solo puede tener una suscripción activa
  UNIQUE(tenant_id)
);

CREATE INDEX idx_mp_sub_tenant ON public.mp_subscriptions(tenant_id);
CREATE INDEX idx_mp_sub_status ON public.mp_subscriptions(status);
CREATE INDEX idx_mp_sub_preapproval ON public.mp_subscriptions(mp_preapproval_id);
CREATE INDEX idx_mp_sub_next_billing ON public.mp_subscriptions(next_billing_date);

-- ============================================================================
-- 2. TABLA: mp_webhook_events (anti-duplicados y auditoría)
-- ============================================================================

-- Eliminar y recrear para asegurar estructura correcta
DROP TABLE IF EXISTS public.mp_webhook_events CASCADE;

CREATE TABLE public.mp_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificación única del evento
  event_id TEXT UNIQUE NOT NULL,              -- x-request-id de MP
  event_type TEXT NOT NULL,                   -- subscription_preapproval, payment, etc.
  action TEXT,                                -- created, updated, payment.approved, etc.
  
  -- Datos
  mp_resource_id TEXT,                        -- ID del recurso en MP (preapproval_id, payment_id)
  mp_resource_type TEXT,                      -- subscription_preapproval, payment
  
  -- Payload completo
  payload JSONB NOT NULL DEFAULT '{}',
  
  -- Procesamiento
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  processing_result TEXT,                     -- success, error, ignored, duplicate
  error_message TEXT,
  
  -- IP para auditoría
  source_ip TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mp_events_event_id ON public.mp_webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_mp_events_resource ON public.mp_webhook_events(mp_resource_id);
CREATE INDEX IF NOT EXISTS idx_mp_events_created ON public.mp_webhook_events(created_at DESC);

-- ============================================================================
-- 3. TABLA: mp_payments (historial de pagos)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.mp_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.mp_subscriptions(id) ON DELETE SET NULL,
  
  -- MercadoPago
  mp_payment_id TEXT UNIQUE NOT NULL,
  mp_preapproval_id TEXT,
  
  -- Detalles del pago
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'ARS',
  status TEXT NOT NULL,                       -- approved, rejected, pending, cancelled
  status_detail TEXT,                         -- Detalle del estado
  
  -- Fechas
  payment_date TIMESTAMPTZ NOT NULL,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mp_payments_tenant ON public.mp_payments(tenant_id);
CREATE INDEX idx_mp_payments_subscription ON public.mp_payments(subscription_id);
CREATE INDEX idx_mp_payments_status ON public.mp_payments(status);

-- ============================================================================
-- 4. RLS
-- ============================================================================

ALTER TABLE public.mp_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mp_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mp_payments ENABLE ROW LEVEL SECURITY;

-- mp_subscriptions: Usuario ve su suscripción
DROP POLICY IF EXISTS "mp_sub_select_own" ON public.mp_subscriptions;
CREATE POLICY "mp_sub_select_own" ON public.mp_subscriptions
  FOR SELECT USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE owner_user_id = auth.uid())
  );

-- mp_webhook_events: Solo service_role (webhooks)
-- No hay política para usuarios normales

-- mp_payments: Usuario ve sus pagos
DROP POLICY IF EXISTS "mp_payments_select_own" ON public.mp_payments;
CREATE POLICY "mp_payments_select_own" ON public.mp_payments
  FOR SELECT USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE owner_user_id = auth.uid())
  );

-- ============================================================================
-- 5. FUNCIÓN: Activar suscripción (llamada por webhook)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.activate_mp_subscription(
  p_preapproval_id TEXT,
  p_payer_id TEXT DEFAULT NULL,
  p_payer_email TEXT DEFAULT NULL,
  p_next_billing_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription RECORD;
  v_tenant_id UUID;
  v_plan_tier TEXT;
  v_orders_limit INT;
BEGIN
  -- Buscar la suscripción
  SELECT * INTO v_subscription 
  FROM public.mp_subscriptions 
  WHERE mp_preapproval_id = p_preapproval_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Subscription not found');
  END IF;
  
  v_tenant_id := v_subscription.tenant_id;
  v_plan_tier := v_subscription.plan_tier;
  
  -- Determinar límite de órdenes
  v_orders_limit := CASE 
    WHEN v_plan_tier = 'premium_pro' THEN NULL 
    WHEN v_plan_tier = 'premium' THEN 80 
    ELSE 15 
  END;
  
  -- Actualizar suscripción
  UPDATE public.mp_subscriptions SET
    status = 'active',
    mp_payer_id = COALESCE(p_payer_id, mp_payer_id),
    mp_payer_email = COALESCE(p_payer_email, mp_payer_email),
    start_date = COALESCE(start_date, NOW()),
    next_billing_date = COALESCE(p_next_billing_date, NOW() + INTERVAL '30 days'),
    failed_payments_count = 0,
    grace_period_ends = NULL,
    updated_at = NOW()
  WHERE mp_preapproval_id = p_preapproval_id;
  
  -- Actualizar tenant
  UPDATE public.tenants SET
    subscription_tier = v_plan_tier,
    premium_until = COALESCE(p_next_billing_date, NOW() + INTERVAL '30 days'),
    orders_limit = v_orders_limit,
    orders_remaining = v_orders_limit,
    scheduled_tier = NULL,
    scheduled_at = NULL
  WHERE id = v_tenant_id;
  
  -- Auditoría
  INSERT INTO public.subscription_audit_log (tenant_id, action, action_type, old_value, new_value, description, metadata)
  VALUES (
    v_tenant_id,
    'ACTIVATED',
    'webhook',
    jsonb_build_object('status', v_subscription.status),
    jsonb_build_object('status', 'active', 'tier', v_plan_tier),
    'Suscripción activada vía MercadoPago',
    jsonb_build_object('preapproval_id', p_preapproval_id)
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', v_tenant_id,
    'plan_tier', v_plan_tier,
    'next_billing_date', p_next_billing_date
  );
END;
$$;

-- ============================================================================
-- 6. FUNCIÓN: Registrar pago exitoso (llamada por webhook)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.register_mp_payment(
  p_preapproval_id TEXT,
  p_payment_id TEXT,
  p_amount NUMERIC,
  p_payment_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription RECORD;
  v_next_billing TIMESTAMPTZ;
BEGIN
  -- Buscar la suscripción
  SELECT * INTO v_subscription 
  FROM public.mp_subscriptions 
  WHERE mp_preapproval_id = p_preapproval_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Subscription not found');
  END IF;
  
  -- Calcular próxima fecha de cobro (30 días desde el pago)
  v_next_billing := p_payment_date + INTERVAL '30 days';
  
  -- Registrar pago
  INSERT INTO public.mp_payments (tenant_id, subscription_id, mp_payment_id, mp_preapproval_id, amount, status, payment_date)
  VALUES (v_subscription.tenant_id, v_subscription.id, p_payment_id, p_preapproval_id, p_amount, 'approved', p_payment_date)
  ON CONFLICT (mp_payment_id) DO NOTHING;
  
  -- Actualizar suscripción
  UPDATE public.mp_subscriptions SET
    status = 'active',
    last_payment_date = p_payment_date,
    last_payment_amount = p_amount,
    next_billing_date = v_next_billing,
    total_payments = total_payments + 1,
    failed_payments_count = 0,
    grace_period_ends = NULL,
    updated_at = NOW()
  WHERE mp_preapproval_id = p_preapproval_id;
  
  -- Extender beneficios del tenant
  UPDATE public.tenants SET
    premium_until = v_next_billing
  WHERE id = v_subscription.tenant_id;
  
  -- Auditoría
  INSERT INTO public.subscription_audit_log (tenant_id, action, action_type, old_value, new_value, description, metadata)
  VALUES (
    v_subscription.tenant_id,
    'PAYMENT_RECEIVED',
    'webhook',
    jsonb_build_object('last_payment', v_subscription.last_payment_date),
    jsonb_build_object('payment_date', p_payment_date, 'amount', p_amount),
    'Pago mensual recibido - $' || p_amount,
    jsonb_build_object('payment_id', p_payment_id, 'preapproval_id', p_preapproval_id)
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', v_subscription.tenant_id,
    'next_billing_date', v_next_billing
  );
END;
$$;

-- ============================================================================
-- 7. FUNCIÓN: Marcar pago fallido (llamada por webhook)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_mp_payment_failed(
  p_preapproval_id TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription RECORD;
  v_grace_ends TIMESTAMPTZ;
  v_should_suspend BOOLEAN;
BEGIN
  -- Buscar la suscripción
  SELECT * INTO v_subscription 
  FROM public.mp_subscriptions 
  WHERE mp_preapproval_id = p_preapproval_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Subscription not found');
  END IF;
  
  -- Calcular período de gracia (3 días)
  v_grace_ends := NOW() + INTERVAL '3 days';
  
  -- Determinar si debemos suspender (más de 3 intentos fallidos)
  v_should_suspend := (v_subscription.failed_payments_count >= 2);
  
  -- Actualizar suscripción
  UPDATE public.mp_subscriptions SET
    status = CASE WHEN v_should_suspend THEN 'payment_failed' ELSE status END,
    failed_payments_count = failed_payments_count + 1,
    grace_period_ends = v_grace_ends,
    updated_at = NOW()
  WHERE mp_preapproval_id = p_preapproval_id;
  
  -- Si hay que suspender, quitar beneficios
  IF v_should_suspend THEN
    UPDATE public.tenants SET
      subscription_tier = 'free',
      premium_until = NULL,
      orders_limit = 15,
      orders_remaining = 15
    WHERE id = v_subscription.tenant_id;
  END IF;
  
  -- Auditoría
  INSERT INTO public.subscription_audit_log (tenant_id, action, action_type, old_value, new_value, description, metadata)
  VALUES (
    v_subscription.tenant_id,
    'PAYMENT_FAILED',
    'webhook',
    jsonb_build_object('failed_count', v_subscription.failed_payments_count),
    jsonb_build_object('failed_count', v_subscription.failed_payments_count + 1, 'suspended', v_should_suspend),
    'Pago fallido' || CASE WHEN v_should_suspend THEN ' - Beneficios suspendidos' ELSE ' - Período de gracia activo' END,
    jsonb_build_object('preapproval_id', p_preapproval_id, 'reason', p_reason)
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', v_subscription.tenant_id,
    'grace_period_ends', v_grace_ends,
    'suspended', v_should_suspend,
    'failed_count', v_subscription.failed_payments_count + 1
  );
END;
$$;

-- ============================================================================
-- 8. FUNCIÓN: Cancelar suscripción (llamada por webhook o usuario)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cancel_mp_subscription(
  p_preapproval_id TEXT,
  p_immediate BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription RECORD;
  v_end_date TIMESTAMPTZ;
BEGIN
  -- Buscar la suscripción
  SELECT * INTO v_subscription 
  FROM public.mp_subscriptions 
  WHERE mp_preapproval_id = p_preapproval_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Subscription not found');
  END IF;
  
  -- Determinar fecha de fin
  -- Si inmediato, ahora. Si no, al final del período pagado.
  v_end_date := CASE 
    WHEN p_immediate THEN NOW()
    ELSE COALESCE(v_subscription.next_billing_date, NOW())
  END;
  
  -- Actualizar suscripción
  UPDATE public.mp_subscriptions SET
    status = 'cancelled',
    end_date = v_end_date,
    updated_at = NOW()
  WHERE mp_preapproval_id = p_preapproval_id;
  
  -- Si es inmediato, quitar beneficios ahora
  IF p_immediate THEN
    UPDATE public.tenants SET
      subscription_tier = 'free',
      premium_until = NULL,
      orders_limit = 15,
      orders_remaining = 15,
      scheduled_tier = NULL,
      scheduled_at = NULL
    WHERE id = v_subscription.tenant_id;
  ELSE
    -- Programar downgrade para cuando termine el período
    UPDATE public.tenants SET
      scheduled_tier = 'free',
      scheduled_at = NOW()
    WHERE id = v_subscription.tenant_id;
  END IF;
  
  -- Auditoría
  INSERT INTO public.subscription_audit_log (tenant_id, action, action_type, old_value, new_value, description, metadata)
  VALUES (
    v_subscription.tenant_id,
    'CANCELLED',
    'webhook',
    jsonb_build_object('status', v_subscription.status),
    jsonb_build_object('status', 'cancelled', 'end_date', v_end_date),
    'Suscripción cancelada' || CASE WHEN p_immediate THEN ' inmediatamente' ELSE ' - Beneficios hasta ' || v_end_date::DATE END,
    jsonb_build_object('preapproval_id', p_preapproval_id, 'immediate', p_immediate)
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', v_subscription.tenant_id,
    'end_date', v_end_date,
    'immediate', p_immediate
  );
END;
$$;

-- ============================================================================
-- 9. FUNCIÓN: Pausar suscripción
-- ============================================================================

CREATE OR REPLACE FUNCTION public.pause_mp_subscription(
  p_preapproval_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription RECORD;
BEGIN
  SELECT * INTO v_subscription 
  FROM public.mp_subscriptions 
  WHERE mp_preapproval_id = p_preapproval_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Subscription not found');
  END IF;
  
  UPDATE public.mp_subscriptions SET
    status = 'paused',
    updated_at = NOW()
  WHERE mp_preapproval_id = p_preapproval_id;
  
  INSERT INTO public.subscription_audit_log (tenant_id, action, action_type, description, metadata)
  VALUES (
    v_subscription.tenant_id,
    'PAUSED',
    'webhook',
    'Suscripción pausada',
    jsonb_build_object('preapproval_id', p_preapproval_id)
  );
  
  RETURN jsonb_build_object('success', true, 'tenant_id', v_subscription.tenant_id);
END;
$$;

-- ============================================================================
-- 10. FUNCIÓN: Crear registro de suscripción (al crear preapproval)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_mp_subscription_record(
  p_tenant_id UUID,
  p_preapproval_id TEXT,
  p_plan_id TEXT,
  p_plan_tier TEXT,
  p_amount NUMERIC,
  p_external_reference TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.mp_subscriptions (
    tenant_id, mp_preapproval_id, plan_id, plan_tier, plan_amount, external_reference, status
  ) VALUES (
    p_tenant_id, p_preapproval_id, p_plan_id, p_plan_tier, p_amount, p_external_reference, 'pending'
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    mp_preapproval_id = p_preapproval_id,
    plan_id = p_plan_id,
    plan_tier = p_plan_tier,
    plan_amount = p_amount,
    external_reference = p_external_reference,
    status = 'pending',
    updated_at = NOW();
  
  RETURN jsonb_build_object('success', true, 'preapproval_id', p_preapproval_id);
END;
$$;

-- ============================================================================
-- 11. PERMISOS
-- ============================================================================

-- Funciones que llama el webhook (service_role)
GRANT EXECUTE ON FUNCTION public.activate_mp_subscription TO service_role;
GRANT EXECUTE ON FUNCTION public.register_mp_payment TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_mp_payment_failed TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_mp_subscription TO service_role;
GRANT EXECUTE ON FUNCTION public.pause_mp_subscription TO service_role;
GRANT EXECUTE ON FUNCTION public.create_mp_subscription_record TO service_role;

-- Tablas
GRANT SELECT ON public.mp_subscriptions TO authenticated;
GRANT SELECT ON public.mp_payments TO authenticated;
GRANT ALL ON public.mp_subscriptions TO service_role;
GRANT ALL ON public.mp_payments TO service_role;
GRANT ALL ON public.mp_webhook_events TO service_role;
