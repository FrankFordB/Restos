-- ============================================================================
-- FIX FINAL: Sistema de suscripciones completo
-- Este archivo reemplaza las funciones anteriores y asegura que el RPC
-- pueda actualizar el tenant sin ser bloqueado por el trigger
-- ============================================================================
-- EJECUTAR EN: Supabase SQL Editor (https://supabase.com/dashboard/project/YOUR_PROJECT/sql)
-- ============================================================================

-- PASO 1: Actualizar la función RPC update_tenant_subscription
-- Incluye el bypass del trigger usando variable de sesión

DROP FUNCTION IF EXISTS public.update_tenant_subscription(UUID, TEXT, TIMESTAMPTZ);
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
  -- Obtener tenant
  SELECT * INTO v_tenant 
  FROM public.tenants 
  WHERE id = p_tenant_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tenant no encontrado');
  END IF;
  
  -- Verificar que el usuario es owner del tenant o super_admin
  -- NOTA: auth.uid() puede ser NULL si se llama sin sesión (ej: desde webhook)
  IF auth.uid() IS NOT NULL THEN
    IF v_tenant.owner_user_id != auth.uid() AND NOT public.is_super_admin() THEN
      RETURN jsonb_build_object('success', false, 'error', 'No tienes permisos para modificar este tenant');
    END IF;
  END IF;
  
  -- Validar tier
  IF p_tier NOT IN ('free', 'premium', 'premium_pro') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tier inválido: ' || p_tier);
  END IF;
  
  -- Calcular fecha de expiración
  IF p_expires_at IS NOT NULL THEN
    v_premium_until := p_expires_at;
  ELSIF p_tier = 'free' THEN
    v_premium_until := NULL;
  ELSE
    v_premium_until := NOW() + INTERVAL '30 days';
  END IF;
  
  -- Determinar límites según tier
  v_orders_limit := CASE 
    WHEN p_tier = 'premium_pro' THEN NULL 
    WHEN p_tier = 'premium' THEN 80
    ELSE 15 
  END;
  
  -- *** IMPORTANTE: Establecer variable de sesión para bypass del trigger ***
  PERFORM set_config('app.subscription_update', 'true', true);
  
  -- Actualizar tenant
  UPDATE public.tenants
  SET 
    subscription_tier = p_tier,
    premium_until = v_premium_until,
    subscription_status = 'active',
    orders_limit = v_orders_limit,
    orders_remaining = v_orders_limit,
    -- Limpiar tier programado si se actualiza a no-free
    scheduled_tier = CASE WHEN p_tier != 'free' THEN NULL ELSE scheduled_tier END,
    scheduled_at = CASE WHEN p_tier != 'free' THEN NULL ELSE scheduled_at END
  WHERE id = p_tenant_id;
  
  -- Limpiar variable de sesión
  PERFORM set_config('app.subscription_update', 'false', true);
  
  -- Log de auditoría (si existe la tabla)
  BEGIN
    INSERT INTO public.subscription_audit_log (tenant_id, action, action_type, old_value, new_value, description, metadata)
    VALUES (
      p_tenant_id,
      CASE 
        WHEN p_tier = 'free' THEN 'DOWNGRADED'
        WHEN v_tenant.subscription_tier = 'free' THEN 'UPGRADED'
        WHEN p_tier = 'premium_pro' AND v_tenant.subscription_tier = 'premium' THEN 'UPGRADED'
        ELSE 'RENEWED'
      END,
      'system',
      jsonb_build_object('tier', v_tenant.subscription_tier),
      jsonb_build_object('tier', p_tier),
      'Suscripción actualizada: ' || COALESCE(v_tenant.subscription_tier, 'free') || ' → ' || p_tier,
      jsonb_build_object('premium_until', v_premium_until)
    );
  EXCEPTION WHEN undefined_table THEN
    -- subscription_audit_log no existe, ignorar
    NULL;
  END;
  
  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'old_tier', v_tenant.subscription_tier,
    'new_tier', p_tier,
    'premium_until', v_premium_until,
    'orders_limit', v_orders_limit
  );
END;
$$;

-- PASO 2: Actualizar el trigger para respetar el flag de la función RPC

CREATE OR REPLACE FUNCTION public.prevent_owner_premium_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Si viene de la función RPC autorizada (variable de sesión), permitir
  IF current_setting('app.subscription_update', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- Si es super_admin, permitir todo
  IF public.is_super_admin() THEN
    RETURN NEW;
  END IF;
  
  -- Si el usuario no está autenticado (servicio/webhook), permitir
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Si es owner, no permitir cambios directos a premium_until ni subscription_tier
  -- (deben usar la función RPC)
  IF OLD.owner_user_id = auth.uid() THEN
    IF NEW.premium_until IS DISTINCT FROM OLD.premium_until THEN
      RAISE EXCEPTION 'No tienes permiso para modificar premium_until directamente. Usa la función de suscripción.';
    END IF;
    IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier THEN
      RAISE EXCEPTION 'No tienes permiso para modificar subscription_tier directamente. Usa la función de suscripción.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Asegurar que el trigger existe
DROP TRIGGER IF EXISTS prevent_owner_premium_change_trigger ON public.tenants;
CREATE TRIGGER prevent_owner_premium_change_trigger
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_owner_premium_change();

-- PASO 3: Asegurar permisos

GRANT EXECUTE ON FUNCTION public.update_tenant_subscription TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_tenant_subscription TO service_role;
GRANT EXECUTE ON FUNCTION public.update_tenant_subscription TO anon;

-- ============================================================================
-- VERIFICACIÓN: Ejecuta esto para probar que funciona
-- ============================================================================
-- SELECT public.update_tenant_subscription(
--   'TU_TENANT_ID'::uuid,
--   'premium',
--   (NOW() + INTERVAL '30 days')::timestamptz
-- );
-- ============================================================================
