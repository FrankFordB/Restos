-- ============================================================================
-- MIGRACIÓN COMPLETA: Sistema de Suscripciones Automatizado v2
-- 
-- Esta migración:
-- 1. Crea tabla de auditoría para tracking
-- 2. Crea tabla para suscripciones de MercadoPago
-- 3. Arregla las políticas RLS problemáticas
-- 4. Crea funciones RPC con SECURITY DEFINER
-- 5. Configura triggers necesarios
-- ============================================================================

-- ============================================================================
-- PASO 1: Tablas de soporte
-- ============================================================================

-- NOTA: La tabla subscription_audit_log ya existe con estructura diferente
-- Usamos la estructura existente con columnas: action, action_type, old_value, new_value, description, metadata

-- Tabla para suscripciones recurrentes de MercadoPago
CREATE TABLE IF NOT EXISTS public.mp_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  mp_preapproval_id TEXT UNIQUE, -- ID de la suscripción en MP
  mp_plan_id TEXT, -- ID del plan en MP
  status TEXT DEFAULT 'pending', -- pending, authorized, paused, cancelled
  payer_email TEXT,
  next_payment_date TIMESTAMPTZ,
  last_payment_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_mp_sub_tenant ON mp_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mp_sub_status ON mp_subscriptions(status);

-- ============================================================================
-- PASO 2: RLS para las nuevas tablas
-- ============================================================================

ALTER TABLE mp_subscriptions ENABLE ROW LEVEL SECURITY;

-- Políticas para mp_subscriptions
DROP POLICY IF EXISTS "mp_sub_select_own" ON mp_subscriptions;
CREATE POLICY "mp_sub_select_own" ON mp_subscriptions
  FOR SELECT USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE owner_user_id = auth.uid())
  );

-- ============================================================================
-- PASO 3: Función para programar cambio de tier
-- ============================================================================

DROP FUNCTION IF EXISTS public.schedule_tier_change(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.schedule_tier_change(
  p_tenant_id UUID,
  p_scheduled_tier TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant RECORD;
  v_valid_tiers TEXT[] := ARRAY['free', 'premium', 'premium_pro'];
BEGIN
  -- Validar tier
  IF NOT (p_scheduled_tier = ANY(v_valid_tiers)) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid tier. Must be one of: free, premium, premium_pro'
    );
  END IF;

  -- Obtener tenant actual
  SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tenant not found');
  END IF;

  -- Verificar que el usuario sea el owner
  IF v_tenant.owner_user_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  -- No permitir programar al mismo tier actual
  IF v_tenant.subscription_tier = p_scheduled_tier THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Cannot schedule change to current tier'
    );
  END IF;

  -- Actualizar el tenant con el cambio programado
  UPDATE public.tenants SET
    scheduled_tier = p_scheduled_tier,
    scheduled_at = NOW()
  WHERE id = p_tenant_id;

  -- Registrar en auditoría
  INSERT INTO public.subscription_audit_log (tenant_id, action, action_type, old_value, new_value, description, metadata)
  VALUES (
    p_tenant_id, 
    'SCHEDULED',
    'user',
    jsonb_build_object('tier', v_tenant.subscription_tier),
    jsonb_build_object('scheduled_tier', p_scheduled_tier),
    'Cambio de plan programado de ' || v_tenant.subscription_tier || ' a ' || p_scheduled_tier,
    jsonb_build_object(
      'premium_until', v_tenant.premium_until,
      'scheduled_from', v_tenant.subscription_tier
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'current_tier', v_tenant.subscription_tier,
    'scheduled_tier', p_scheduled_tier,
    'effective_date', v_tenant.premium_until
  );
END;
$$;

-- ============================================================================
-- PASO 4: Función para cancelar cambio programado
-- ============================================================================

DROP FUNCTION IF EXISTS public.cancel_scheduled_tier_change(UUID);
CREATE OR REPLACE FUNCTION public.cancel_scheduled_tier_change(
  p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant RECORD;
BEGIN
  -- Obtener tenant actual
  SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tenant not found');
  END IF;

  -- Verificar que el usuario sea el owner
  IF v_tenant.owner_user_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  -- Verificar que haya un cambio programado
  IF v_tenant.scheduled_tier IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'No scheduled change to cancel'
    );
  END IF;

  -- Registrar en auditoría ANTES de cancelar
  INSERT INTO public.subscription_audit_log (tenant_id, action, action_type, old_value, new_value, description, metadata)
  VALUES (
    p_tenant_id, 
    'CANCELLED',
    'user',
    jsonb_build_object('scheduled_tier', v_tenant.scheduled_tier),
    jsonb_build_object('scheduled_tier', NULL),
    'Cambio programado cancelado: ' || v_tenant.scheduled_tier,
    jsonb_build_object('cancelled_scheduled_tier', v_tenant.scheduled_tier)
  );

  -- Limpiar el cambio programado
  UPDATE public.tenants SET
    scheduled_tier = NULL,
    scheduled_at = NULL
  WHERE id = p_tenant_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Scheduled change cancelled',
    'current_tier', v_tenant.subscription_tier
  );
END;
$$;

-- ============================================================================
-- PASO 5: Función para procesar expiraciones (CRON)
-- Esta función es llamada por la Edge Function diariamente
-- ============================================================================

DROP FUNCTION IF EXISTS public.process_subscription_expirations();
CREATE OR REPLACE FUNCTION public.process_subscription_expirations()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant RECORD;
  v_new_tier TEXT;
  v_new_limit INT;
  v_processed INT := 0;
  v_results JSONB := '[]'::jsonb;
BEGIN
  -- Buscar todos los tenants con suscripción expirada
  FOR v_tenant IN 
    SELECT * FROM public.tenants 
    WHERE premium_until IS NOT NULL 
      AND premium_until < NOW() 
      AND subscription_tier != 'free'
  LOOP
    -- Determinar el nuevo tier
    v_new_tier := COALESCE(v_tenant.scheduled_tier, 'free');
    
    -- Determinar el nuevo límite de órdenes
    v_new_limit := CASE 
      WHEN v_new_tier = 'premium_pro' THEN NULL 
      WHEN v_new_tier = 'premium' THEN 80 
      ELSE 15 
    END;
    
    -- Actualizar el tenant
    UPDATE public.tenants SET
      subscription_tier = v_new_tier,
      premium_until = CASE 
        WHEN v_new_tier = 'free' THEN NULL 
        ELSE premium_until
      END,
      scheduled_tier = NULL,
      scheduled_at = NULL,
      orders_limit = v_new_limit,
      orders_remaining = v_new_limit
    WHERE id = v_tenant.id;
    
    -- Registrar en auditoría
    INSERT INTO public.subscription_audit_log (tenant_id, action, action_type, old_value, new_value, description, metadata)
    VALUES (
      v_tenant.id, 
      'EXPIRED',
      'cron',
      jsonb_build_object('tier', v_tenant.subscription_tier),
      jsonb_build_object('tier', v_new_tier),
      'Suscripción expirada: ' || v_tenant.subscription_tier || ' → ' || v_new_tier,
      jsonb_build_object(
        'had_scheduled_tier', v_tenant.scheduled_tier IS NOT NULL,
        'previous_premium_until', v_tenant.premium_until
      )
    );
    
    v_processed := v_processed + 1;
    v_results := v_results || jsonb_build_object(
      'tenant_id', v_tenant.id,
      'tenant_name', v_tenant.name,
      'old_tier', v_tenant.subscription_tier,
      'new_tier', v_new_tier
    );
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'processed', v_processed,
    'results', v_results,
    'processed_at', NOW()
  );
END;
$$;

-- ============================================================================
-- PASO 6: Función para obtener suscripciones a renovar
-- ============================================================================

-- Eliminar TODAS las versiones existentes de la función
DROP FUNCTION IF EXISTS public.get_subscriptions_to_renew();
DROP FUNCTION IF EXISTS public.get_subscriptions_to_renew(INT);
DROP FUNCTION IF EXISTS public.get_subscriptions_to_renew(INTEGER);
CREATE OR REPLACE FUNCTION public.get_subscriptions_to_renew(
  p_days_ahead INT DEFAULT 2
)
RETURNS TABLE (
  tenant_id UUID,
  tenant_name TEXT,
  subscription_tier TEXT,
  premium_until TIMESTAMPTZ,
  auto_renew BOOLEAN,
  owner_email TEXT,
  mp_preapproval_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id as tenant_id,
    t.name as tenant_name,
    t.subscription_tier,
    t.premium_until,
    t.auto_renew,
    p.email as owner_email,
    ms.mp_preapproval_id
  FROM public.tenants t
  LEFT JOIN auth.users p ON t.owner_user_id = p.id
  LEFT JOIN public.mp_subscriptions ms ON t.id = ms.tenant_id AND ms.status = 'authorized'
  WHERE 
    t.auto_renew = true
    AND t.scheduled_tier IS NULL
    AND t.premium_until IS NOT NULL
    AND t.premium_until > NOW()
    AND t.premium_until <= (NOW() + (p_days_ahead || ' days')::INTERVAL)
    AND t.subscription_tier != 'free';
END;
$$;

-- ============================================================================
-- PASO 7: Función para actualizar suscripción
-- ============================================================================

DROP FUNCTION IF EXISTS public.update_tenant_subscription(UUID, TEXT, TIMESTAMPTZ);
CREATE OR REPLACE FUNCTION public.update_tenant_subscription(
  p_tenant_id UUID,
  p_new_tier TEXT,
  p_premium_until TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant RECORD;
  v_new_limit INT;
  v_premium_until TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tenant not found');
  END IF;

  IF p_premium_until IS NOT NULL THEN
    v_premium_until := p_premium_until;
  ELSIF p_new_tier = 'free' THEN
    v_premium_until := NULL;
  ELSE
    v_premium_until := NOW() + INTERVAL '30 days';
  END IF;

  v_new_limit := CASE 
    WHEN p_new_tier = 'premium_pro' THEN NULL 
    WHEN p_new_tier = 'premium' THEN 80 
    ELSE 15 
  END;

  UPDATE public.tenants SET
    subscription_tier = p_new_tier,
    premium_until = v_premium_until,
    orders_limit = v_new_limit,
    orders_remaining = v_new_limit,
    scheduled_tier = CASE WHEN p_new_tier != 'free' THEN NULL ELSE scheduled_tier END,
    scheduled_at = CASE WHEN p_new_tier != 'free' THEN NULL ELSE scheduled_at END
  WHERE id = p_tenant_id;

  INSERT INTO public.subscription_audit_log (tenant_id, action, action_type, old_value, new_value, description, metadata)
  VALUES (
    p_tenant_id,
    CASE 
      WHEN p_new_tier = 'free' THEN 'DOWNGRADED'
      WHEN v_tenant.subscription_tier = 'free' THEN 'UPGRADED'
      WHEN p_new_tier = 'premium_pro' AND v_tenant.subscription_tier = 'premium' THEN 'UPGRADED'
      ELSE 'RENEWED'
    END,
    'system',
    jsonb_build_object('tier', v_tenant.subscription_tier),
    jsonb_build_object('tier', p_new_tier),
    'Suscripción actualizada: ' || v_tenant.subscription_tier || ' → ' || p_new_tier,
    jsonb_build_object('premium_until', v_premium_until)
  );

  RETURN jsonb_build_object(
    'success', true,
    'old_tier', v_tenant.subscription_tier,
    'new_tier', p_new_tier,
    'premium_until', v_premium_until
  );
END;
$$;

-- ============================================================================
-- PASO 8: Función para toggle auto_renew
-- ============================================================================

DROP FUNCTION IF EXISTS public.set_auto_renew(UUID, BOOLEAN);
CREATE OR REPLACE FUNCTION public.set_auto_renew(
  p_tenant_id UUID,
  p_auto_renew BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant RECORD;
BEGIN
  SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tenant not found');
  END IF;

  IF v_tenant.owner_user_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  IF p_auto_renew AND v_tenant.subscription_tier = 'free' THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Cannot enable auto-renew on free tier'
    );
  END IF;

  UPDATE public.tenants SET auto_renew = p_auto_renew WHERE id = p_tenant_id;

  RETURN jsonb_build_object(
    'success', true,
    'auto_renew', p_auto_renew
  );
END;
$$;

-- ============================================================================
-- PASO 9: Permisos
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.schedule_tier_change TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_scheduled_tier_change TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_auto_renew TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_subscription_expirations TO service_role;
GRANT EXECUTE ON FUNCTION public.get_subscriptions_to_renew TO service_role;
GRANT EXECUTE ON FUNCTION public.update_tenant_subscription TO authenticated, service_role;

GRANT SELECT ON public.mp_subscriptions TO authenticated;
GRANT ALL ON public.mp_subscriptions TO service_role;
