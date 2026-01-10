-- ============================================================================
-- MIGRACIÓN: Sistema de Downgrade Programado
-- Permite a los usuarios programar un cambio de plan para cuando expire su suscripción actual
-- ============================================================================

-- Agregar columnas para el downgrade programado
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS scheduled_tier text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS scheduled_at timestamptz DEFAULT NULL;

-- Comentarios
COMMENT ON COLUMN public.tenants.scheduled_tier IS 'Tier programado para cuando expire la suscripción actual (free, premium, premium_pro)';
COMMENT ON COLUMN public.tenants.scheduled_at IS 'Fecha en que se programó el cambio de tier';

-- ============================================================================
-- FUNCIÓN RPC: schedule_tier_change
-- Programa un cambio de tier para cuando expire la suscripción actual
-- ============================================================================

DROP FUNCTION IF EXISTS public.schedule_tier_change(uuid, text);

CREATE OR REPLACE FUNCTION public.schedule_tier_change(
  p_tenant_id uuid,
  p_scheduled_tier text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
  v_tenant record;
BEGIN
  -- Obtener tenant y verificar propiedad
  SELECT * INTO v_tenant 
  FROM public.tenants 
  WHERE id = p_tenant_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant no encontrado: %', p_tenant_id;
  END IF;
  
  -- Verificar que el usuario es owner del tenant o super_admin
  IF v_tenant.owner_user_id != auth.uid() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'No tienes permisos para modificar este tenant';
  END IF;
  
  -- Validar tier
  IF p_scheduled_tier NOT IN ('free', 'premium', 'premium_pro') THEN
    RAISE EXCEPTION 'Tier invalido: %', p_scheduled_tier;
  END IF;
  
  -- No permitir programar el mismo tier que ya tiene
  IF v_tenant.subscription_tier = p_scheduled_tier THEN
    RAISE EXCEPTION 'Ya tienes este plan activo';
  END IF;
  
  -- Programar el cambio de tier
  UPDATE public.tenants
  SET 
    scheduled_tier = p_scheduled_tier,
    scheduled_at = NOW()
  WHERE id = p_tenant_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'current_tier', v_tenant.subscription_tier,
    'scheduled_tier', p_scheduled_tier,
    'expires_at', v_tenant.premium_until,
    'message', 'Cambio de plan programado. Tu plan actual seguirá activo hasta ' || 
               COALESCE(to_char(v_tenant.premium_until, 'DD/MM/YYYY'), 'que expire')
  );
END;
$fn$;

-- ============================================================================
-- FUNCIÓN RPC: cancel_scheduled_tier_change
-- Cancela un cambio de tier programado
-- ============================================================================

DROP FUNCTION IF EXISTS public.cancel_scheduled_tier_change(uuid);

CREATE OR REPLACE FUNCTION public.cancel_scheduled_tier_change(
  p_tenant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
  v_tenant record;
BEGIN
  -- Obtener tenant y verificar propiedad
  SELECT * INTO v_tenant 
  FROM public.tenants 
  WHERE id = p_tenant_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant no encontrado: %', p_tenant_id;
  END IF;
  
  -- Verificar que el usuario es owner del tenant o super_admin
  IF v_tenant.owner_user_id != auth.uid() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'No tienes permisos para modificar este tenant';
  END IF;
  
  -- Cancelar el cambio programado
  UPDATE public.tenants
  SET 
    scheduled_tier = NULL,
    scheduled_at = NULL
  WHERE id = p_tenant_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'message', 'Cambio de plan cancelado. Mantendrás tu plan actual.'
  );
END;
$fn$;

-- ============================================================================
-- FUNCIÓN RPC: process_expired_subscriptions
-- Procesa las suscripciones expiradas y aplica los cambios programados
-- Esta función debe ser llamada por un cron job o edge function
-- ============================================================================

DROP FUNCTION IF EXISTS public.process_expired_subscriptions();

CREATE OR REPLACE FUNCTION public.process_expired_subscriptions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
  v_tenant record;
  v_processed integer := 0;
  v_results jsonb := '[]'::jsonb;
BEGIN
  -- Buscar tenants con suscripción expirada
  FOR v_tenant IN 
    SELECT * FROM public.tenants 
    WHERE premium_until IS NOT NULL 
      AND premium_until < NOW()
      AND subscription_tier != 'free'
  LOOP
    -- Determinar el nuevo tier
    DECLARE
      v_new_tier text;
      v_new_limit integer;
    BEGIN
      -- Si hay un tier programado, usarlo; si no, pasar a free
      v_new_tier := COALESCE(v_tenant.scheduled_tier, 'free');
      
      -- Determinar límites según el nuevo tier
      v_new_limit := CASE 
        WHEN v_new_tier = 'premium_pro' THEN NULL 
        WHEN v_new_tier = 'premium' THEN 80
        ELSE 15 
      END;
      
      -- Actualizar el tenant
      UPDATE public.tenants
      SET 
        subscription_tier = v_new_tier,
        premium_until = NULL,
        scheduled_tier = NULL,
        scheduled_at = NULL,
        orders_limit = v_new_limit,
        orders_remaining = v_new_limit
      WHERE id = v_tenant.id;
      
      v_processed := v_processed + 1;
      v_results := v_results || jsonb_build_object(
        'tenant_id', v_tenant.id,
        'old_tier', v_tenant.subscription_tier,
        'new_tier', v_new_tier
      );
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'processed', v_processed,
    'results', v_results
  );
END;
$fn$;

-- Permisos
GRANT EXECUTE ON FUNCTION public.schedule_tier_change TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_scheduled_tier_change TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_expired_subscriptions TO service_role;
