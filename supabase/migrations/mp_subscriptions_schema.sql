-- ============================================================================
-- SCHEMA: Sistema de Suscripciones con Mercado Pago Preapproval
-- Suscripciones automáticas recurrentes (débito automático)
-- ============================================================================

-- ============================================================================
-- OPCIÓN 1: Recrear tablas desde cero (borra datos existentes)
-- ============================================================================
DROP TABLE IF EXISTS public.mp_webhook_events CASCADE;
DROP TABLE IF EXISTS public.mp_subscription_payments CASCADE;
DROP TABLE IF EXISTS public.mp_subscriptions CASCADE;

-- ============================================================================
-- OPCIÓN 2: Si la tabla ya existe, añadir columnas faltantes
-- ============================================================================
DO $$
BEGIN
  -- Añadir columnas faltantes a mp_subscriptions si la tabla existe
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mp_subscriptions') THEN
    -- next_payment_date
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'mp_subscriptions' AND column_name = 'next_payment_date') THEN
      ALTER TABLE public.mp_subscriptions ADD COLUMN next_payment_date DATE;
    END IF;
    
    -- billing_day
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'mp_subscriptions' AND column_name = 'billing_day') THEN
      ALTER TABLE public.mp_subscriptions ADD COLUMN billing_day INTEGER CHECK (billing_day BETWEEN 1 AND 28);
    END IF;
    
    -- grace_period_days
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'mp_subscriptions' AND column_name = 'grace_period_days') THEN
      ALTER TABLE public.mp_subscriptions ADD COLUMN grace_period_days INTEGER DEFAULT 3;
    END IF;
    
    -- retry_count
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'mp_subscriptions' AND column_name = 'retry_count') THEN
      ALTER TABLE public.mp_subscriptions ADD COLUMN retry_count INTEGER DEFAULT 0;
    END IF;
    
    -- max_retries
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'mp_subscriptions' AND column_name = 'max_retries') THEN
      ALTER TABLE public.mp_subscriptions ADD COLUMN max_retries INTEGER DEFAULT 3;
    END IF;
    
    -- authorized_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'mp_subscriptions' AND column_name = 'authorized_at') THEN
      ALTER TABLE public.mp_subscriptions ADD COLUMN authorized_at TIMESTAMPTZ;
    END IF;
    
    -- first_payment_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'mp_subscriptions' AND column_name = 'first_payment_at') THEN
      ALTER TABLE public.mp_subscriptions ADD COLUMN first_payment_at TIMESTAMPTZ;
    END IF;
    
    -- last_payment_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'mp_subscriptions' AND column_name = 'last_payment_at') THEN
      ALTER TABLE public.mp_subscriptions ADD COLUMN last_payment_at TIMESTAMPTZ;
    END IF;
    
    -- cancelled_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'mp_subscriptions' AND column_name = 'cancelled_at') THEN
      ALTER TABLE public.mp_subscriptions ADD COLUMN cancelled_at TIMESTAMPTZ;
    END IF;
  END IF;
END $$;

-- Tabla para guardar las suscripciones de MP (Preapproval)
CREATE TABLE IF NOT EXISTS public.mp_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Datos de Mercado Pago
  mp_preapproval_id TEXT UNIQUE,          -- ID de la suscripción en MP
  mp_payer_id TEXT,                        -- ID del pagador en MP
  mp_payer_email TEXT,                     -- Email del pagador
  
  -- Plan y precio
  plan_tier TEXT NOT NULL DEFAULT 'premium' CHECK (plan_tier IN ('premium', 'premium_pro')),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ARS',
  
  -- Estado de la suscripción
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Esperando autorización del usuario
    'authorized',   -- Usuario autorizó, esperando primer pago
    'active',       -- Activa y pagando
    'paused',       -- Pausada temporalmente
    'cancelled',    -- Cancelada por el usuario
    'expired',      -- Expirada
    'payment_failed' -- Último pago falló
  )),
  
  -- Fechas importantes
  authorized_at TIMESTAMPTZ,              -- Cuándo el usuario autorizó
  first_payment_at TIMESTAMPTZ,           -- Primer pago exitoso
  last_payment_at TIMESTAMPTZ,            -- Último pago exitoso
  next_payment_date DATE,                 -- Próximo cobro programado
  cancelled_at TIMESTAMPTZ,               -- Si fue cancelada
  
  -- Configuración
  billing_day INTEGER CHECK (billing_day BETWEEN 1 AND 28), -- Día del mes para cobrar
  grace_period_days INTEGER DEFAULT 3,    -- Días de gracia después de fallo
  retry_count INTEGER DEFAULT 0,          -- Intentos de cobro fallidos
  max_retries INTEGER DEFAULT 3,          -- Máximo de reintentos
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Solo puede haber una suscripción activa por tenant
  CONSTRAINT unique_active_subscription UNIQUE (tenant_id, status) 
    DEFERRABLE INITIALLY DEFERRED
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_mp_subscriptions_tenant ON public.mp_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mp_subscriptions_status ON public.mp_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_mp_subscriptions_preapproval ON public.mp_subscriptions(mp_preapproval_id);
CREATE INDEX IF NOT EXISTS idx_mp_subscriptions_next_payment ON public.mp_subscriptions(next_payment_date);

-- Tabla para registrar todos los pagos de suscripciones
CREATE TABLE IF NOT EXISTS public.mp_subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.mp_subscriptions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Datos del pago de MP
  mp_payment_id TEXT UNIQUE,              -- ID del pago en MP
  mp_authorized_payment_id TEXT,          -- ID del authorized_payment en MP
  
  -- Monto
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ARS',
  
  -- Estado
  status TEXT NOT NULL CHECK (status IN (
    'pending',
    'approved',
    'rejected',
    'refunded',
    'charged_back'
  )),
  status_detail TEXT,                     -- Detalle del estado (ej: "cc_rejected_insufficient_amount")
  
  -- Fechas
  payment_date TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  
  -- Período que cubre este pago
  period_start DATE,
  period_end DATE,
  
  -- Metadata
  raw_webhook_data JSONB,                 -- Datos crudos del webhook para debugging
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mp_payments_subscription ON public.mp_subscription_payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_mp_payments_tenant ON public.mp_subscription_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mp_payments_status ON public.mp_subscription_payments(status);

-- Tabla para registrar eventos de webhook (anti-duplicados y auditoría)
CREATE TABLE IF NOT EXISTS public.mp_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificación del evento
  mp_event_id TEXT UNIQUE,                -- ID único del evento de MP
  event_type TEXT NOT NULL,               -- Tipo de evento (payment, subscription_preapproval, etc.)
  action TEXT NOT NULL,                   -- Acción (created, updated, etc.)
  
  -- Datos
  resource_id TEXT,                       -- ID del recurso afectado
  raw_data JSONB,                         -- Datos crudos del webhook
  
  -- Procesamiento
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed', 'ignored')),
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Seguridad
  source_ip TEXT,
  signature_valid BOOLEAN,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mp_webhook_event_id ON public.mp_webhook_events(mp_event_id);
CREATE INDEX IF NOT EXISTS idx_mp_webhook_status ON public.mp_webhook_events(status);

-- Actualizar columnas del tenant para suscripciones
ALTER TABLE public.tenants 
  ADD COLUMN IF NOT EXISTS mp_subscription_id UUID REFERENCES public.mp_subscriptions(id),
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none' 
    CHECK (subscription_status IN ('none', 'pending', 'active', 'paused', 'cancelled', 'payment_failed', 'grace_period')),
  ADD COLUMN IF NOT EXISTS grace_period_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_billing_date DATE;

-- ============================================================================
-- FUNCIONES RPC
-- ============================================================================

-- Eliminar TODAS las versiones de las funciones (sin importar la firma)
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Eliminar todas las versiones de cancel_mp_subscription
  FOR r IN SELECT oid::regprocedure FROM pg_proc WHERE proname = 'cancel_mp_subscription' AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.oid::regprocedure || ' CASCADE';
  END LOOP;
  
  -- Eliminar todas las versiones de process_subscription_webhook
  FOR r IN SELECT oid::regprocedure FROM pg_proc WHERE proname = 'process_subscription_webhook' AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.oid::regprocedure || ' CASCADE';
  END LOOP;
  
  -- Eliminar todas las versiones de process_subscription_payment
  FOR r IN SELECT oid::regprocedure FROM pg_proc WHERE proname = 'process_subscription_payment' AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.oid::regprocedure || ' CASCADE';
  END LOOP;
  
  -- Eliminar todas las versiones de create_mp_subscription
  FOR r IN SELECT oid::regprocedure FROM pg_proc WHERE proname = 'create_mp_subscription' AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.oid::regprocedure || ' CASCADE';
  END LOOP;
END $$;

-- Función para procesar webhook de suscripción
CREATE OR REPLACE FUNCTION public.process_subscription_webhook(
  p_mp_preapproval_id TEXT,
  p_status TEXT,
  p_payer_id TEXT DEFAULT NULL,
  p_payer_email TEXT DEFAULT NULL,
  p_next_payment_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription RECORD;
  v_tenant_id UUID;
  v_new_tier TEXT;
BEGIN
  -- Buscar suscripción
  SELECT * INTO v_subscription 
  FROM mp_subscriptions 
  WHERE mp_preapproval_id = p_mp_preapproval_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Subscription not found');
  END IF;
  
  v_tenant_id := v_subscription.tenant_id;
  v_new_tier := v_subscription.plan_tier;
  
  -- Actualizar suscripción
  UPDATE mp_subscriptions SET
    status = p_status,
    mp_payer_id = COALESCE(p_payer_id, mp_payer_id),
    mp_payer_email = COALESCE(p_payer_email, mp_payer_email),
    next_payment_date = COALESCE(p_next_payment_date, next_payment_date),
    authorized_at = CASE WHEN p_status = 'authorized' AND authorized_at IS NULL THEN NOW() ELSE authorized_at END,
    cancelled_at = CASE WHEN p_status = 'cancelled' THEN NOW() ELSE cancelled_at END,
    updated_at = NOW()
  WHERE id = v_subscription.id;
  
  -- Actualizar tenant según estado
  IF p_status = 'active' THEN
    -- Suscripción activa: dar beneficios premium
    PERFORM set_config('app.subscription_update', 'true', true);
    UPDATE tenants SET
      subscription_tier = v_new_tier,
      subscription_status = 'active',
      premium_until = COALESCE(p_next_payment_date, CURRENT_DATE) + INTERVAL '35 days',
      next_billing_date = p_next_payment_date,
      mp_subscription_id = v_subscription.id,
      orders_limit = CASE WHEN v_new_tier = 'premium_pro' THEN NULL ELSE 80 END,
      orders_remaining = CASE WHEN v_new_tier = 'premium_pro' THEN NULL ELSE 80 END
    WHERE id = v_tenant_id;
    PERFORM set_config('app.subscription_update', 'false', true);
    
  ELSIF p_status = 'authorized' THEN
    -- Autorizado pero sin pago aún
    UPDATE tenants SET
      subscription_status = 'pending',
      mp_subscription_id = v_subscription.id
    WHERE id = v_tenant_id;
    
  ELSIF p_status IN ('cancelled', 'expired') THEN
    -- Cancelada: quitar beneficios
    PERFORM set_config('app.subscription_update', 'true', true);
    UPDATE tenants SET
      subscription_tier = 'free',
      subscription_status = p_status,
      premium_until = NULL,
      next_billing_date = NULL,
      orders_limit = 15,
      orders_remaining = 15
    WHERE id = v_tenant_id;
    PERFORM set_config('app.subscription_update', 'false', true);
    
  ELSIF p_status = 'paused' THEN
    UPDATE tenants SET
      subscription_status = 'paused'
    WHERE id = v_tenant_id;
    
  ELSIF p_status = 'payment_failed' THEN
    -- Pago falló: período de gracia
    UPDATE tenants SET
      subscription_status = 'grace_period',
      grace_period_until = CURRENT_DATE + v_subscription.grace_period_days
    WHERE id = v_tenant_id;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', v_subscription.id,
    'tenant_id', v_tenant_id,
    'new_status', p_status
  );
END;
$$;

-- Función para procesar pago de suscripción
CREATE OR REPLACE FUNCTION public.process_subscription_payment(
  p_mp_preapproval_id TEXT,
  p_mp_payment_id TEXT,
  p_amount DECIMAL,
  p_status TEXT,
  p_status_detail TEXT DEFAULT NULL,
  p_period_start DATE DEFAULT NULL,
  p_period_end DATE DEFAULT NULL,
  p_raw_data JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription RECORD;
  v_payment_id UUID;
BEGIN
  -- Buscar suscripción
  SELECT * INTO v_subscription 
  FROM mp_subscriptions 
  WHERE mp_preapproval_id = p_mp_preapproval_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Subscription not found');
  END IF;
  
  -- Insertar o actualizar pago
  INSERT INTO mp_subscription_payments (
    subscription_id, tenant_id, mp_payment_id, amount, currency,
    status, status_detail, period_start, period_end, 
    processed_at, raw_webhook_data
  ) VALUES (
    v_subscription.id, v_subscription.tenant_id, p_mp_payment_id, p_amount, 'ARS',
    p_status, p_status_detail, p_period_start, p_period_end,
    NOW(), p_raw_data
  )
  ON CONFLICT (mp_payment_id) DO UPDATE SET
    status = EXCLUDED.status,
    status_detail = EXCLUDED.status_detail,
    processed_at = NOW()
  RETURNING id INTO v_payment_id;
  
  -- Si el pago fue aprobado, actualizar suscripción
  IF p_status = 'approved' THEN
    UPDATE mp_subscriptions SET
      status = 'active',
      last_payment_at = NOW(),
      first_payment_at = COALESCE(first_payment_at, NOW()),
      next_payment_date = COALESCE(p_period_end, CURRENT_DATE) + INTERVAL '1 month',
      retry_count = 0,
      updated_at = NOW()
    WHERE id = v_subscription.id;
    
    -- Activar beneficios en tenant
    PERFORM process_subscription_webhook(
      p_mp_preapproval_id, 
      'active', 
      NULL, 
      NULL,
      (COALESCE(p_period_end, CURRENT_DATE) + INTERVAL '1 month')::DATE
    );
    
  ELSIF p_status = 'rejected' THEN
    -- Incrementar contador de reintentos
    UPDATE mp_subscriptions SET
      retry_count = retry_count + 1,
      status = CASE 
        WHEN retry_count + 1 >= max_retries THEN 'payment_failed'
        ELSE status 
      END,
      updated_at = NOW()
    WHERE id = v_subscription.id;
    
    -- Si alcanzó máximo de reintentos, activar período de gracia
    IF v_subscription.retry_count + 1 >= v_subscription.max_retries THEN
      PERFORM process_subscription_webhook(p_mp_preapproval_id, 'payment_failed');
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'subscription_id', v_subscription.id,
    'payment_status', p_status
  );
END;
$$;

-- Función para crear una nueva suscripción (llamada después de crear en MP)
CREATE OR REPLACE FUNCTION public.create_mp_subscription(
  p_tenant_id UUID,
  p_mp_preapproval_id TEXT,
  p_plan_tier TEXT,
  p_amount DECIMAL,
  p_payer_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription_id UUID;
BEGIN
  -- Verificar que no haya otra suscripción activa
  IF EXISTS (
    SELECT 1 FROM mp_subscriptions 
    WHERE tenant_id = p_tenant_id 
    AND status IN ('active', 'authorized', 'pending')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ya existe una suscripción activa');
  END IF;
  
  -- Crear suscripción
  INSERT INTO mp_subscriptions (
    tenant_id, mp_preapproval_id, plan_tier, amount, mp_payer_email, status
  ) VALUES (
    p_tenant_id, p_mp_preapproval_id, p_plan_tier, p_amount, p_payer_email, 'pending'
  )
  RETURNING id INTO v_subscription_id;
  
  -- Asociar al tenant
  UPDATE tenants SET
    mp_subscription_id = v_subscription_id,
    subscription_status = 'pending'
  WHERE id = p_tenant_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', v_subscription_id
  );
END;
$$;

-- Función para cancelar suscripción
CREATE OR REPLACE FUNCTION public.cancel_mp_subscription(
  p_tenant_id UUID DEFAULT NULL,
  p_preapproval_id TEXT DEFAULT NULL,
  p_immediate BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription RECORD;
BEGIN
  -- Buscar suscripción por tenant_id o preapproval_id
  IF p_preapproval_id IS NOT NULL THEN
    SELECT * INTO v_subscription FROM mp_subscriptions WHERE mp_preapproval_id = p_preapproval_id;
  ELSIF p_tenant_id IS NOT NULL THEN
    SELECT * INTO v_subscription 
    FROM mp_subscriptions 
    WHERE tenant_id = p_tenant_id 
    AND status IN ('active', 'authorized', 'pending')
    ORDER BY created_at DESC
    LIMIT 1;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Missing tenant_id or preapproval_id');
  END IF;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active subscription found');
  END IF;
  
  -- Marcar como cancelada
  UPDATE mp_subscriptions SET
    status = 'cancelled',
    cancelled_at = NOW(),
    updated_at = NOW()
  WHERE id = v_subscription.id;
  
  -- Si es cancelación inmediata, quitar beneficios ahora
  IF p_immediate THEN
    PERFORM set_config('app.subscription_update', 'true', true);
    UPDATE tenants SET
      subscription_tier = 'free',
      subscription_status = 'cancelled',
      premium_until = NULL,
      next_billing_date = NULL,
      orders_limit = 15,
      orders_remaining = 15
    WHERE id = v_subscription.tenant_id;
    PERFORM set_config('app.subscription_update', 'false', true);
  ELSE
    -- Mantener beneficios hasta fin del período pero marcar como cancelando
    UPDATE tenants SET
      subscription_status = 'cancelled',
      -- scheduled_tier ya no necesario, el webhook hará el downgrade
      auto_renew = false
    WHERE id = v_subscription.tenant_id;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', v_subscription.id,
    'mp_preapproval_id', v_subscription.mp_preapproval_id,
    'immediate', p_immediate
  );
END;
$$;

-- Permisos
GRANT EXECUTE ON FUNCTION public.process_subscription_webhook TO service_role;
GRANT EXECUTE ON FUNCTION public.process_subscription_payment TO service_role;
GRANT EXECUTE ON FUNCTION public.create_mp_subscription TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_mp_subscription TO authenticated;

-- RLS para las nuevas tablas
ALTER TABLE public.mp_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mp_subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mp_webhook_events ENABLE ROW LEVEL SECURITY;

-- Políticas: usuarios solo ven sus propias suscripciones
CREATE POLICY "Users can view own subscriptions"
  ON public.mp_subscriptions FOR SELECT
  USING (
    tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid())
    OR public.is_super_admin()
  );

CREATE POLICY "Users can view own payments"
  ON public.mp_subscription_payments FOR SELECT
  USING (
    tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid())
    OR public.is_super_admin()
  );

-- Service role tiene acceso total para webhooks
CREATE POLICY "Service role full access subscriptions"
  ON public.mp_subscriptions FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access payments"
  ON public.mp_subscription_payments FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access webhooks"
  ON public.mp_webhook_events FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');
