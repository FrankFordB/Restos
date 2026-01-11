-- ============================================================================
-- Migración: Agregar campos para suscripciones regaladas por super admin
-- ============================================================================
-- 
-- Campos nuevos:
-- - is_gifted: indica si la suscripción actual es un regalo del super admin
-- - purchased_premium_starts_at: fecha en que iniciará una suscripción comprada
--   (para cuando el usuario compra mientras tiene días regalados activos)
-- - purchased_premium_tier: tier de la suscripción comprada que espera
-- - purchased_premium_until: fecha de expiración de la suscripción comprada
-- ============================================================================

-- 0. Crear tabla subscription_history si no existe
CREATE TABLE IF NOT EXISTS public.subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  notes TEXT,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para subscription_history
CREATE INDEX IF NOT EXISTS idx_subscription_history_tenant_id ON public.subscription_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_created_at ON public.subscription_history(created_at DESC);

-- RLS para subscription_history
ALTER TABLE public.subscription_history ENABLE ROW LEVEL SECURITY;

-- Solo super_admin puede ver todo, owners pueden ver su propio historial
DROP POLICY IF EXISTS "subscription_history_select" ON public.subscription_history;
CREATE POLICY "subscription_history_select" ON public.subscription_history
  FOR SELECT USING (
    public.is_super_admin() 
    OR tenant_id IN (SELECT id FROM public.tenants WHERE owner_user_id = auth.uid())
  );

-- Solo funciones SECURITY DEFINER pueden insertar
DROP POLICY IF EXISTS "subscription_history_insert" ON public.subscription_history;
CREATE POLICY "subscription_history_insert" ON public.subscription_history
  FOR INSERT WITH CHECK (TRUE);

COMMENT ON TABLE public.subscription_history IS 'Historial de cambios en suscripciones de tenants';

-- 1. Agregar columnas a tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS is_gifted BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS purchased_premium_starts_at TIMESTAMPTZ NULL;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS purchased_premium_tier TEXT NULL
    CHECK (purchased_premium_tier IN ('premium', 'premium_pro') OR purchased_premium_tier IS NULL);

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS purchased_premium_until TIMESTAMPTZ NULL;

-- Comentarios
COMMENT ON COLUMN public.tenants.is_gifted IS 'Indica si la suscripción actual fue regalada por el super admin';
COMMENT ON COLUMN public.tenants.purchased_premium_starts_at IS 'Fecha de inicio de una suscripción comprada que está esperando (cuando hay regalo activo)';
COMMENT ON COLUMN public.tenants.purchased_premium_tier IS 'Tier de la suscripción comprada que está esperando';
COMMENT ON COLUMN public.tenants.purchased_premium_until IS 'Fecha de expiración de la suscripción comprada que está esperando';

-- 2. Función para regalar suscripción (usada por super admin)
-- Permite regalar premium/pro temporalmente, O bajar a free (quitar regalo)
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
  -- Solo super_admin puede regalar
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Solo super_admin puede regalar suscripciones';
  END IF;

  -- Obtener tenant actual
  SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant no encontrado';
  END IF;

  -- Si es FREE, simplemente quitar el regalo y dejar que el usuario pueda comprar
  IF p_tier = 'free' THEN
    UPDATE public.tenants
    SET 
      subscription_tier = 'free',
      premium_until = NULL,
      is_gifted = FALSE,
      -- NO limpiar purchased_premium_* para que si tenía compra pendiente, se active
      orders_remaining = 15,
      orders_limit = 15
    WHERE id = p_tenant_id;

    -- Registrar en historial
    INSERT INTO public.subscription_history (
      tenant_id,
      action,
      old_values,
      new_values,
      notes,
      performed_by
    ) VALUES (
      p_tenant_id,
      'GIFT_REMOVED',
      jsonb_build_object('tier', v_tenant.subscription_tier, 'is_gifted', v_tenant.is_gifted),
      jsonb_build_object('tier', 'free', 'is_gifted', FALSE),
      'Super admin quitó el regalo - usuario puede comprar su propia suscripción',
      auth.uid()
    );

    RETURN jsonb_build_object(
      'success', TRUE,
      'tier', 'free',
      'is_gifted', FALSE,
      'message', 'Regalo removido. El usuario puede comprar su propia suscripción.'
    );
  END IF;

  -- Validar tier para regalo
  IF p_tier NOT IN ('premium', 'premium_pro') THEN
    RAISE EXCEPTION 'Tier inválido. Debe ser free, premium o premium_pro';
  END IF;

  -- Calcular fecha de expiración
  v_expires_at := NOW() + (p_days || ' days')::INTERVAL;

  -- Actualizar tenant con regalo
  UPDATE public.tenants
  SET 
    subscription_tier = p_tier,
    premium_until = v_expires_at,
    is_gifted = TRUE,
    -- Mantener suscripción comprada pendiente si existe
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

  -- Registrar en historial
  INSERT INTO public.subscription_history (
    tenant_id,
    action,
    old_values,
    new_values,
    notes,
    performed_by
  ) VALUES (
    p_tenant_id,
    'GIFTED',
    jsonb_build_object('tier', v_tenant.subscription_tier, 'is_gifted', v_tenant.is_gifted),
    jsonb_build_object('tier', p_tier, 'premium_until', v_expires_at, 'is_gifted', TRUE),
    'Suscripción regalada por super admin: ' || p_tier || ' por ' || p_days || ' días',
    auth.uid()
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'tier', p_tier,
    'expires_at', v_expires_at,
    'days', p_days,
    'is_gifted', TRUE
  );
END;
$$;

-- 3. Función para comprar suscripción (permite comprar aunque tenga regalo activo)
-- También maneja upgrades: premium -> premium_pro
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
  -- Obtener tenant actual
  SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant no encontrado';
  END IF;

  -- Validar tier
  IF p_tier NOT IN ('premium', 'premium_pro') THEN
    RAISE EXCEPTION 'Tier inválido';
  END IF;

  -- Calcular duración de la compra
  v_duration := p_expires_at - NOW();

  -- Verificar si tiene regalo activo
  IF v_tenant.is_gifted AND v_tenant.premium_until > NOW() THEN
    -- Tiene regalo activo
    v_gift_expires_at := v_tenant.premium_until;
    
    -- Si es un UPGRADE (premium -> premium_pro), activar inmediatamente
    IF p_tier = 'premium_pro' AND v_tenant.subscription_tier = 'premium' THEN
      UPDATE public.tenants
      SET 
        subscription_tier = 'premium_pro',
        premium_until = v_gift_expires_at + v_duration, -- Sumar al tiempo del regalo
        is_gifted = FALSE, -- Ya no es regalo, es compra
        purchased_premium_tier = NULL,
        purchased_premium_starts_at = NULL,
        purchased_premium_until = NULL,
        orders_remaining = NULL,
        orders_limit = NULL
      WHERE id = p_tenant_id;

      INSERT INTO public.subscription_history (
        tenant_id, action, old_values, new_values, notes, performed_by
      ) VALUES (
        p_tenant_id,
        'UPGRADE_FROM_GIFT',
        jsonb_build_object('tier', v_tenant.subscription_tier, 'is_gifted', TRUE),
        jsonb_build_object('tier', 'premium_pro', 'expires_at', v_gift_expires_at + v_duration),
        'Upgrade de regalo Premium a Premium Pro comprado',
        auth.uid()
      );

      RETURN jsonb_build_object(
        'success', TRUE,
        'pending', FALSE,
        'tier', 'premium_pro',
        'expires_at', v_gift_expires_at + v_duration,
        'message', 'Upgrade a Premium Pro activado!'
      );
    END IF;
    
    -- No es upgrade, la compra queda pendiente
    UPDATE public.tenants
    SET 
      purchased_premium_tier = p_tier,
      purchased_premium_starts_at = v_gift_expires_at,
      purchased_premium_until = v_gift_expires_at + v_duration
    WHERE id = p_tenant_id;

    INSERT INTO public.subscription_history (
      tenant_id, action, old_values, new_values, notes, performed_by
    ) VALUES (
      p_tenant_id,
      'PURCHASED_PENDING',
      jsonb_build_object('tier', v_tenant.subscription_tier, 'is_gifted', TRUE),
      jsonb_build_object(
        'purchased_tier', p_tier, 
        'starts_at', v_gift_expires_at,
        'expires_at', v_gift_expires_at + v_duration
      ),
      'Suscripción comprada - iniciará cuando termine el regalo: ' || v_gift_expires_at::TEXT,
      auth.uid()
    );

    RETURN jsonb_build_object(
      'success', TRUE,
      'pending', TRUE,
      'tier', p_tier,
      'starts_at', v_gift_expires_at,
      'expires_at', v_gift_expires_at + v_duration,
      'message', 'Tu suscripción iniciará cuando termine el regalo el ' || TO_CHAR(v_gift_expires_at, 'DD/MM/YYYY')
    );
  ELSE
    -- No tiene regalo activo o ya expiró - activar inmediatamente
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

    INSERT INTO public.subscription_history (
      tenant_id, action, old_values, new_values, notes, performed_by
    ) VALUES (
      p_tenant_id,
      'PURCHASED',
      jsonb_build_object('tier', v_tenant.subscription_tier, 'is_gifted', v_tenant.is_gifted),
      jsonb_build_object('tier', p_tier, 'expires_at', p_expires_at, 'is_gifted', FALSE),
      'Suscripción comprada y activada: ' || p_tier,
      auth.uid()
    );

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

-- 4. Actualizar update_tenant_subscription para manejar is_gifted
-- Esta función es usada por pagos normales (no regalos)
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
    is_gifted = FALSE, -- Ya no es regalo, es compra
    -- Limpiar compra pendiente si estamos activando
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

-- 5. Función CRON para activar suscripciones pendientes cuando termine el regalo
CREATE OR REPLACE FUNCTION public.activate_pending_subscriptions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_tenant RECORD;
BEGIN
  FOR v_tenant IN 
    SELECT * FROM public.tenants 
    WHERE is_gifted = TRUE 
      AND premium_until <= NOW()
      AND purchased_premium_tier IS NOT NULL
      AND purchased_premium_starts_at IS NOT NULL
  LOOP
    UPDATE public.tenants
    SET 
      subscription_tier = purchased_premium_tier,
      premium_until = purchased_premium_until,
      is_gifted = FALSE,
      purchased_premium_tier = NULL,
      purchased_premium_starts_at = NULL,
      purchased_premium_until = NULL,
      orders_remaining = CASE 
        WHEN purchased_premium_tier = 'premium_pro' THEN NULL
        WHEN purchased_premium_tier = 'premium' THEN 80
        ELSE 15
      END,
      orders_limit = CASE 
        WHEN purchased_premium_tier = 'premium_pro' THEN NULL
        WHEN purchased_premium_tier = 'premium' THEN 80
        ELSE 15
      END
    WHERE id = v_tenant.id;

    INSERT INTO public.subscription_history (
      tenant_id, action, old_values, new_values, notes, performed_by
    ) VALUES (
      v_tenant.id,
      'GIFT_EXPIRED_PURCHASED_ACTIVATED',
      jsonb_build_object('tier', v_tenant.subscription_tier, 'is_gifted', TRUE),
      jsonb_build_object('tier', v_tenant.purchased_premium_tier, 'expires_at', v_tenant.purchased_premium_until),
      'Regalo expirado - suscripción comprada activada automáticamente',
      NULL
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 6. Función para que tenants con regalo expirado sin compra vuelvan a free
CREATE OR REPLACE FUNCTION public.expire_gifted_subscriptions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_tenant RECORD;
BEGIN
  FOR v_tenant IN 
    SELECT * FROM public.tenants 
    WHERE is_gifted = TRUE 
      AND premium_until <= NOW()
      AND purchased_premium_tier IS NULL
  LOOP
    UPDATE public.tenants
    SET 
      subscription_tier = 'free',
      premium_until = NULL,
      is_gifted = FALSE,
      orders_remaining = 15,
      orders_limit = 15
    WHERE id = v_tenant.id;

    INSERT INTO public.subscription_history (
      tenant_id, action, old_values, new_values, notes, performed_by
    ) VALUES (
      v_tenant.id,
      'GIFT_EXPIRED',
      jsonb_build_object('tier', v_tenant.subscription_tier, 'is_gifted', TRUE),
      jsonb_build_object('tier', 'free', 'is_gifted', FALSE),
      'Regalo expirado - volviendo a plan gratuito',
      NULL
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 7. Permisos
GRANT EXECUTE ON FUNCTION public.gift_subscription(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_subscription(UUID, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_pending_subscriptions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_gifted_subscriptions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_tenant_subscription(UUID, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_tenant_subscription(UUID, TEXT, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_tenant_subscription(UUID, TEXT, TIMESTAMPTZ) TO anon;

-- Mensaje final
DO $$
BEGIN
  RAISE NOTICE '✅ Migración completada: sistema de regalo de suscripciones';
  RAISE NOTICE '   - Super admin puede regalar premium/pro temporalmente';
  RAISE NOTICE '   - Super admin puede bajar a free (el usuario puede comprar después)';
  RAISE NOTICE '   - Usuario puede comprar y se suma después del regalo';
  RAISE NOTICE '   - Upgrades (premium->pro) se activan inmediatamente';
END;
$$;
