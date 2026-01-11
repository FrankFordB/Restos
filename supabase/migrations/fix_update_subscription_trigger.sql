-- ============================================================================
-- FIX: update_tenant_subscription debe setear app.subscription_update = 'true'
-- para que el trigger prevent_owner_premium_change permita el cambio
-- ============================================================================

-- Actualizar la función para incluir el flag de sesión
CREATE OR REPLACE FUNCTION public.update_tenant_subscription(
  p_tenant_id UUID,
  p_tier TEXT,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant RECORD;
  v_orders_limit INTEGER;
  v_premium_until TIMESTAMPTZ;
BEGIN
  -- IMPORTANTE: Setear flag para que el trigger permita el cambio
  PERFORM set_config('app.subscription_update', 'true', true);

  SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tenant no encontrado');
  END IF;
  
  IF p_tier NOT IN ('free', 'premium', 'premium_pro') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tier inválido: ' || p_tier);
  END IF;
  
  IF p_expires_at IS NOT NULL THEN
    v_premium_until := p_expires_at;
  ELSIF p_tier = 'free' THEN
    v_premium_until := NULL;
  ELSE
    v_premium_until := NOW() + INTERVAL '30 days';
  END IF;
  
  v_orders_limit := CASE 
    WHEN p_tier = 'premium_pro' THEN NULL 
    WHEN p_tier = 'premium' THEN 80
    ELSE 15 
  END;
  
  -- Actualizar tenant - limpiar is_gifted porque es una compra real
  UPDATE public.tenants
  SET 
    subscription_tier = p_tier,
    premium_until = v_premium_until,
    subscription_status = 'active',
    orders_limit = v_orders_limit,
    orders_remaining = v_orders_limit,
    is_gifted = FALSE,
    purchased_premium_tier = NULL,
    purchased_premium_starts_at = NULL,
    purchased_premium_until = NULL,
    scheduled_tier = CASE WHEN p_tier != 'free' THEN NULL ELSE scheduled_tier END,
    scheduled_at = CASE WHEN p_tier != 'free' THEN NULL ELSE scheduled_at END
  WHERE id = p_tenant_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'new_tier', p_tier,
    'premium_until', v_premium_until,
    'orders_limit', v_orders_limit,
    'is_gifted', FALSE
  );
END;
$$;

-- También actualizar gift_subscription para usar el flag
CREATE OR REPLACE FUNCTION public.gift_subscription(
  p_tenant_id UUID,
  p_tier TEXT,
  p_days INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant RECORD;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- IMPORTANTE: Setear flag para que el trigger permita el cambio
  PERFORM set_config('app.subscription_update', 'true', true);

  -- Solo super_admin puede regalar
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Solo super_admin puede regalar suscripciones';
  END IF;

  SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant no encontrado';
  END IF;

  -- Si es FREE, quitar el regalo
  IF p_tier = 'free' THEN
    UPDATE public.tenants
    SET 
      subscription_tier = 'free',
      premium_until = NULL,
      is_gifted = FALSE,
      orders_remaining = 15,
      orders_limit = 15
    WHERE id = p_tenant_id;

    BEGIN
      INSERT INTO public.subscription_history (
        tenant_id, action, old_values, new_values, notes, performed_by
      ) VALUES (
        p_tenant_id,
        'GIFT_REMOVED',
        jsonb_build_object('tier', v_tenant.subscription_tier, 'is_gifted', v_tenant.is_gifted),
        jsonb_build_object('tier', 'free', 'is_gifted', FALSE),
        'Super admin quitó el regalo',
        auth.uid()
      );
    EXCEPTION WHEN undefined_table THEN
      NULL;
    END;

    RETURN jsonb_build_object(
      'success', TRUE,
      'tier', 'free',
      'is_gifted', FALSE,
      'message', 'Regalo removido.'
    );
  END IF;

  IF p_tier NOT IN ('premium', 'premium_pro') THEN
    RAISE EXCEPTION 'Tier inválido';
  END IF;

  v_expires_at := NOW() + (p_days || ' days')::INTERVAL;

  UPDATE public.tenants
  SET 
    subscription_tier = p_tier,
    premium_until = v_expires_at,
    is_gifted = TRUE,
    orders_remaining = CASE 
      WHEN p_tier = 'premium_pro' THEN NULL
      WHEN p_tier = 'premium' THEN 80
      ELSE orders_remaining
    END,
    orders_limit = CASE 
      WHEN p_tier = 'premium_pro' THEN NULL
      WHEN p_tier = 'premium' THEN 80
      ELSE orders_limit
    END
  WHERE id = p_tenant_id;

  BEGIN
    INSERT INTO public.subscription_history (
      tenant_id, action, old_values, new_values, notes, performed_by
    ) VALUES (
      p_tenant_id,
      'GIFTED',
      jsonb_build_object('tier', v_tenant.subscription_tier, 'is_gifted', v_tenant.is_gifted),
      jsonb_build_object('tier', p_tier, 'premium_until', v_expires_at, 'is_gifted', TRUE),
      'Suscripción regalada: ' || p_tier || ' por ' || p_days || ' días',
      auth.uid()
    );
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', TRUE,
    'tier', p_tier,
    'expires_at', v_expires_at,
    'days', p_days,
    'is_gifted', TRUE
  );
END;
$$;

-- También actualizar purchase_subscription
CREATE OR REPLACE FUNCTION public.purchase_subscription(
  p_tenant_id UUID,
  p_tier TEXT,
  p_expires_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant RECORD;
  v_gift_expires_at TIMESTAMPTZ;
  v_duration INTERVAL;
BEGIN
  -- IMPORTANTE: Setear flag para que el trigger permita el cambio
  PERFORM set_config('app.subscription_update', 'true', true);

  SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant no encontrado';
  END IF;

  IF p_tier NOT IN ('premium', 'premium_pro') THEN
    RAISE EXCEPTION 'Tier inválido';
  END IF;

  v_duration := p_expires_at - NOW();

  -- Verificar si tiene regalo activo
  IF v_tenant.is_gifted AND v_tenant.premium_until > NOW() THEN
    v_gift_expires_at := v_tenant.premium_until;
    
    -- Upgrade inmediato
    IF p_tier = 'premium_pro' AND v_tenant.subscription_tier = 'premium' THEN
      UPDATE public.tenants
      SET 
        subscription_tier = 'premium_pro',
        premium_until = v_gift_expires_at + v_duration,
        is_gifted = FALSE,
        purchased_premium_tier = NULL,
        purchased_premium_starts_at = NULL,
        purchased_premium_until = NULL,
        orders_remaining = NULL,
        orders_limit = NULL
      WHERE id = p_tenant_id;

      RETURN jsonb_build_object(
        'success', TRUE,
        'pending', FALSE,
        'tier', 'premium_pro',
        'expires_at', v_gift_expires_at + v_duration,
        'message', 'Upgrade a Premium Pro activado!'
      );
    END IF;
    
    -- Compra pendiente
    UPDATE public.tenants
    SET 
      purchased_premium_tier = p_tier,
      purchased_premium_starts_at = v_gift_expires_at,
      purchased_premium_until = v_gift_expires_at + v_duration
    WHERE id = p_tenant_id;

    RETURN jsonb_build_object(
      'success', TRUE,
      'pending', TRUE,
      'tier', p_tier,
      'starts_at', v_gift_expires_at,
      'expires_at', v_gift_expires_at + v_duration,
      'message', 'Tu suscripción iniciará cuando termine el regalo'
    );
  ELSE
    -- Activar inmediatamente
    UPDATE public.tenants
    SET 
      subscription_tier = p_tier,
      premium_until = p_expires_at,
      is_gifted = FALSE,
      purchased_premium_tier = NULL,
      purchased_premium_starts_at = NULL,
      purchased_premium_until = NULL,
      orders_remaining = CASE 
        WHEN p_tier = 'premium_pro' THEN NULL
        WHEN p_tier = 'premium' THEN 80
        ELSE 15
      END,
      orders_limit = CASE 
        WHEN p_tier = 'premium_pro' THEN NULL
        WHEN p_tier = 'premium' THEN 80
        ELSE 15
      END
    WHERE id = p_tenant_id;

    RETURN jsonb_build_object(
      'success', TRUE,
      'pending', FALSE,
      'tier', p_tier,
      'expires_at', p_expires_at,
      'is_gifted', FALSE
    );
  END IF;
END;
$$;

-- Permisos
GRANT EXECUTE ON FUNCTION public.update_tenant_subscription(UUID, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_tenant_subscription(UUID, TEXT, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_tenant_subscription(UUID, TEXT, TIMESTAMPTZ) TO anon;
GRANT EXECUTE ON FUNCTION public.gift_subscription(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_subscription(UUID, TEXT, TIMESTAMPTZ) TO authenticated;

-- Mensaje
DO $$
BEGIN
  RAISE NOTICE '✅ FIX aplicado: funciones RPC ahora setean app.subscription_update = true';
  RAISE NOTICE '   Esto permite que el trigger permita los cambios de suscripción';
END;
$$;
