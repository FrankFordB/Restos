-- ============================================================================
-- SISTEMA ROBUSTO DE CONTROL DE SUSCRIPCIONES
-- ============================================================================
-- Ejecutar en Supabase SQL Editor
-- Versión: 2.0.0
-- Fecha: 2026-01-10
-- ============================================================================
-- Este sistema garantiza:
-- 1. Control centralizado de estado de suscripción
-- 2. Downgrade automático al vencer
-- 3. Validación en cada acción sensible
-- 4. Limpieza de configuraciones premium al bajar de plan
-- 5. Protección contra fraude y manipulación
-- ============================================================================

-- ============================================================================
-- 1. FUNCIÓN: Verificar si el tenant tiene permiso para una feature
-- ============================================================================
CREATE OR REPLACE FUNCTION public.tenant_has_feature(
  p_tenant_id UUID,
  p_feature TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier TEXT;
  v_until TIMESTAMPTZ;
  v_status TEXT;
  v_effective_tier TEXT;
BEGIN
  -- Obtener estado actual del tenant
  SELECT subscription_tier, premium_until, subscription_status
  INTO v_tier, v_until, v_status
  FROM public.tenants
  WHERE id = p_tenant_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Si está cancelado o suspendido, tratar como FREE
  IF v_status IN ('cancelled', 'suspended') THEN
    v_effective_tier := 'free';
  -- Si tiene tier premium pero venció, tratar como FREE
  ELSIF v_tier != 'free' AND v_until IS NOT NULL AND v_until < NOW() THEN
    v_effective_tier := 'free';
  ELSE
    v_effective_tier := v_tier;
  END IF;

  -- Verificar features según tier
  CASE p_feature
    -- Features de Premium Pro
    WHEN 'page_builder' THEN
      RETURN v_effective_tier = 'premium_pro';
    WHEN 'unlimited_orders' THEN
      RETURN v_effective_tier = 'premium_pro';
    WHEN 'advanced_analytics' THEN
      RETURN v_effective_tier = 'premium_pro';
    WHEN 'video_widget' THEN
      RETURN v_effective_tier = 'premium_pro';
    WHEN 'advanced_hero' THEN
      RETURN v_effective_tier = 'premium_pro';
      
    -- Features de Premium
    WHEN 'carousel_widget' THEN
      RETURN v_effective_tier IN ('premium', 'premium_pro');
    WHEN 'gallery_widget' THEN
      RETURN v_effective_tier IN ('premium', 'premium_pro');
    WHEN 'map_widget' THEN
      RETURN v_effective_tier IN ('premium', 'premium_pro');
    WHEN 'custom_cards' THEN
      RETURN v_effective_tier IN ('premium', 'premium_pro');
    WHEN 'custom_fonts' THEN
      RETURN v_effective_tier IN ('premium', 'premium_pro');
    WHEN 'extra_categories' THEN
      RETURN v_effective_tier IN ('premium', 'premium_pro');
      
    -- Features básicas (todos)
    WHEN 'basic_widgets' THEN
      RETURN TRUE;
    WHEN 'basic_theme' THEN
      RETURN TRUE;
      
    ELSE
      RETURN FALSE;
  END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tenant_has_feature TO authenticated, anon;


-- ============================================================================
-- 2. FUNCIÓN: Obtener tier efectivo (considerando vencimiento)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_effective_tier(p_tenant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier TEXT;
  v_until TIMESTAMPTZ;
  v_status TEXT;
BEGIN
  SELECT subscription_tier, premium_until, subscription_status
  INTO v_tier, v_until, v_status
  FROM public.tenants
  WHERE id = p_tenant_id;

  IF NOT FOUND THEN
    RETURN 'free';
  END IF;

  -- Si está cancelado o suspendido, es FREE
  IF v_status IN ('cancelled', 'suspended') THEN
    RETURN 'free';
  END IF;

  -- Si tiene tier premium pero venció, es FREE
  IF v_tier != 'free' AND v_until IS NOT NULL AND v_until < NOW() THEN
    RETURN 'free';
  END IF;

  RETURN v_tier;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_effective_tier TO authenticated, anon;


-- ============================================================================
-- 3. FUNCIÓN: Ejecutar downgrade automático
-- ============================================================================
CREATE OR REPLACE FUNCTION public.execute_subscription_downgrade(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant RECORD;
  v_old_tier TEXT;
BEGIN
  -- Obtener tenant
  SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tenant not found');
  END IF;

  v_old_tier := v_tenant.subscription_tier;

  -- Si ya es free, no hacer nada
  IF v_old_tier = 'free' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Already on free tier');
  END IF;

  -- Actualizar tenant a FREE
  UPDATE public.tenants SET
    subscription_tier = 'free',
    subscription_status = 'active',
    premium_until = NULL,
    auto_renew = FALSE,
    orders_limit = 15,
    orders_remaining = 15,
    scheduled_tier = NULL,
    scheduled_at = NULL
  WHERE id = p_tenant_id;

  -- Resetear tema a valores por defecto FREE
  UPDATE public.tenant_themes SET
    product_card_layout = 'classic',
    hero_animation = 'none',
    font_family = NULL,
    updated_at = NOW()
  WHERE tenant_id = p_tenant_id;

  -- Log del cambio
  INSERT INTO public.subscription_logs (
    tenant_id,
    event_type,
    old_tier,
    new_tier,
    description,
    created_at
  ) VALUES (
    p_tenant_id,
    'auto_downgrade',
    v_old_tier,
    'free',
    'Downgrade automático por vencimiento de suscripción',
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'old_tier', v_old_tier,
    'new_tier', 'free',
    'message', 'Downgrade ejecutado correctamente'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.execute_subscription_downgrade TO service_role;


-- ============================================================================
-- 4. FUNCIÓN: Verificar y procesar suscripciones vencidas
-- (Para ser llamada por cron job)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.process_expired_subscriptions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired_tenant RECORD;
  v_processed INTEGER := 0;
  v_errors INTEGER := 0;
  v_result JSONB;
BEGIN
  -- Buscar tenants con suscripción vencida
  FOR v_expired_tenant IN
    SELECT id, name, subscription_tier, premium_until
    FROM public.tenants
    WHERE 
      subscription_tier != 'free'
      AND premium_until IS NOT NULL
      AND premium_until < NOW()
      AND subscription_status = 'active'
  LOOP
    BEGIN
      -- Verificar si hay un downgrade programado
      IF v_expired_tenant.scheduled_tier IS NOT NULL THEN
        -- Aplicar el tier programado
        UPDATE public.tenants SET
          subscription_tier = v_expired_tenant.scheduled_tier,
          subscription_status = 'active',
          premium_until = NULL,
          scheduled_tier = NULL,
          scheduled_at = NULL,
          orders_limit = CASE 
            WHEN v_expired_tenant.scheduled_tier = 'premium_pro' THEN NULL
            WHEN v_expired_tenant.scheduled_tier = 'premium' THEN 80
            ELSE 15
          END,
          orders_remaining = CASE 
            WHEN v_expired_tenant.scheduled_tier = 'premium_pro' THEN NULL
            WHEN v_expired_tenant.scheduled_tier = 'premium' THEN 80
            ELSE 15
          END
        WHERE id = v_expired_tenant.id;
      ELSE
        -- Ejecutar downgrade a free
        SELECT public.execute_subscription_downgrade(v_expired_tenant.id) INTO v_result;
      END IF;
      
      v_processed := v_processed + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'processed', v_processed,
    'errors', v_errors,
    'timestamp', NOW()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_expired_subscriptions TO service_role;


-- ============================================================================
-- 5. TABLA: subscription_logs (Auditoría de cambios)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.subscription_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  old_tier TEXT,
  new_tier TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_logs_tenant ON public.subscription_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscription_logs_event ON public.subscription_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_subscription_logs_created ON public.subscription_logs(created_at);

ALTER TABLE public.subscription_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscription_logs_admin_all" ON public.subscription_logs
  FOR ALL USING (public.is_super_admin());

CREATE POLICY "subscription_logs_owner_read" ON public.subscription_logs
  FOR SELECT USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE owner_user_id = auth.uid())
  );


-- ============================================================================
-- 6. FUNCIÓN: Validar acción premium (para usar en endpoints)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.validate_premium_action(
  p_tenant_id UUID,
  p_action TEXT,
  p_required_tier TEXT DEFAULT 'premium'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_effective_tier TEXT;
  v_tier_order JSONB := '{"free": 0, "premium": 1, "premium_pro": 2}'::JSONB;
  v_required_order INTEGER;
  v_current_order INTEGER;
BEGIN
  -- Obtener tier efectivo
  v_effective_tier := public.get_effective_tier(p_tenant_id);
  
  -- Obtener orden de tiers
  v_required_order := (v_tier_order->>p_required_tier)::INTEGER;
  v_current_order := (v_tier_order->>v_effective_tier)::INTEGER;
  
  IF v_current_order IS NULL THEN
    v_current_order := 0;
  END IF;
  
  IF v_required_order IS NULL THEN
    v_required_order := 1;
  END IF;
  
  -- Validar
  IF v_current_order >= v_required_order THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'current_tier', v_effective_tier,
      'action', p_action
    );
  ELSE
    RETURN jsonb_build_object(
      'allowed', false,
      'current_tier', v_effective_tier,
      'required_tier', p_required_tier,
      'action', p_action,
      'message', 'Tu plan actual no incluye este beneficio. Actualiza a ' || p_required_tier || ' para acceder.'
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_premium_action TO authenticated;


-- ============================================================================
-- 7. FUNCIÓN: Procesar webhook de MercadoPago
-- ============================================================================
CREATE OR REPLACE FUNCTION public.process_mp_subscription_webhook(
  p_event_type TEXT,
  p_subscription_id TEXT,
  p_status TEXT,
  p_tenant_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_result JSONB;
BEGIN
  -- Buscar tenant por subscription_id si no se proporciona
  IF p_tenant_id IS NULL THEN
    SELECT tenant_id INTO v_tenant_id
    FROM public.platform_subscriptions
    WHERE mp_subscription_id = p_subscription_id
    ORDER BY created_at DESC
    LIMIT 1;
  ELSE
    v_tenant_id := p_tenant_id;
  END IF;

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tenant not found for subscription');
  END IF;

  -- Procesar según tipo de evento
  CASE p_event_type
    WHEN 'subscription.cancelled', 'subscription.expired' THEN
      -- Ejecutar downgrade
      SELECT public.execute_subscription_downgrade(v_tenant_id) INTO v_result;
      
      -- Actualizar subscription status
      UPDATE public.platform_subscriptions SET
        status = 'cancelled',
        cancelled_at = NOW()
      WHERE mp_subscription_id = p_subscription_id;
      
    WHEN 'payment.failed', 'subscription.paused' THEN
      -- Marcar como past_due
      UPDATE public.tenants SET
        subscription_status = 'past_due'
      WHERE id = v_tenant_id;
      
      -- Log
      INSERT INTO public.subscription_logs (tenant_id, event_type, description)
      VALUES (v_tenant_id, 'payment_failed', 'Pago fallido - cuenta en estado past_due');
      
    WHEN 'payment.approved', 'subscription.authorized' THEN
      -- Reactivar si estaba en past_due
      UPDATE public.tenants SET
        subscription_status = 'active'
      WHERE id = v_tenant_id AND subscription_status = 'past_due';
      
    ELSE
      RETURN jsonb_build_object('success', true, 'message', 'Event type not handled');
  END CASE;

  RETURN jsonb_build_object(
    'success', true,
    'event_type', p_event_type,
    'tenant_id', v_tenant_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_mp_subscription_webhook TO service_role;


-- ============================================================================
-- 8. TRIGGER: Validar cambios en tenant_themes (bloquear features premium)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.validate_theme_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_effective_tier TEXT;
BEGIN
  -- Obtener tier efectivo
  v_effective_tier := public.get_effective_tier(NEW.tenant_id);

  -- Si es FREE, restringir opciones premium
  IF v_effective_tier = 'free' THEN
    -- Forzar valores FREE
    NEW.product_card_layout := 'classic';
    NEW.hero_animation := 'none';
    NEW.font_family := NULL;
  END IF;

  -- Si es PREMIUM (no PRO), restringir opciones PRO
  IF v_effective_tier = 'premium' THEN
    -- Hero animations avanzadas solo en PRO
    IF NEW.hero_animation IN ('parallax_depth', 'cube_rotate', 'reveal_wipe', 'zoom_blur') THEN
      NEW.hero_animation := 'static';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_theme_changes_trigger ON public.tenant_themes;
CREATE TRIGGER validate_theme_changes_trigger
  BEFORE INSERT OR UPDATE ON public.tenant_themes
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_theme_changes();


-- ============================================================================
-- 9. FUNCIÓN: Obtener estado completo de suscripción
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_subscription_status(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant RECORD;
  v_effective_tier TEXT;
  v_days_remaining INTEGER;
  v_is_expired BOOLEAN;
BEGIN
  SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Tenant not found');
  END IF;

  v_effective_tier := public.get_effective_tier(p_tenant_id);
  
  v_is_expired := (
    v_tenant.subscription_tier != 'free' 
    AND v_tenant.premium_until IS NOT NULL 
    AND v_tenant.premium_until < NOW()
  );
  
  v_days_remaining := CASE
    WHEN v_tenant.premium_until IS NULL THEN 0
    WHEN v_tenant.premium_until < NOW() THEN 0
    ELSE EXTRACT(DAY FROM (v_tenant.premium_until - NOW()))::INTEGER
  END;

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'stored_tier', v_tenant.subscription_tier,
    'effective_tier', v_effective_tier,
    'subscription_status', v_tenant.subscription_status,
    'premium_until', v_tenant.premium_until,
    'is_expired', v_is_expired,
    'days_remaining', v_days_remaining,
    'auto_renew', v_tenant.auto_renew,
    'orders_limit', v_tenant.orders_limit,
    'orders_remaining', v_tenant.orders_remaining,
    'scheduled_tier', v_tenant.scheduled_tier,
    'scheduled_at', v_tenant.scheduled_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_subscription_status TO authenticated;


-- ============================================================================
-- 10. Habilitar pg_cron para procesamiento automático (si está disponible)
-- ============================================================================
-- NOTA: pg_cron debe estar habilitado en tu proyecto Supabase
-- Ve a Database > Extensions y habilita pg_cron

-- Luego ejecuta esto para crear el job:
/*
SELECT cron.schedule(
  'process-expired-subscriptions',
  '0 * * * *',  -- Cada hora
  $$SELECT public.process_expired_subscriptions()$$
);
*/

-- Para verificar jobs programados:
-- SELECT * FROM cron.job;

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================
