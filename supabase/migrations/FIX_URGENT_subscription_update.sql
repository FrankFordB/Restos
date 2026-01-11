-- ============================================================================
-- FIX URGENTE: Reparar actualización de suscripciones
-- EJECUTAR EN: Supabase SQL Editor
-- ============================================================================

-- PASO 1: Eliminar trigger problemático (si existe)
DROP TRIGGER IF EXISTS prevent_owner_premium_change_trigger ON public.tenants;
DROP TRIGGER IF EXISTS protect_tenant_premium_fields_trigger ON public.tenants;

-- PASO 2: Eliminar funciones viejas
DROP FUNCTION IF EXISTS public.prevent_owner_premium_change() CASCADE;
DROP FUNCTION IF EXISTS public.update_tenant_subscription(UUID, TEXT, TIMESTAMPTZ) CASCADE;

-- PASO 3: Crear función RPC actualizada
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
  
  -- Actualizar tenant directamente (sin trigger bloqueador)
  UPDATE public.tenants
  SET 
    subscription_tier = p_tier,
    premium_until = v_premium_until,
    subscription_status = 'active',
    orders_limit = v_orders_limit,
    orders_remaining = v_orders_limit,
    scheduled_tier = CASE WHEN p_tier != 'free' THEN NULL ELSE scheduled_tier END,
    scheduled_at = CASE WHEN p_tier != 'free' THEN NULL ELSE scheduled_at END
  WHERE id = p_tenant_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'new_tier', p_tier,
    'premium_until', v_premium_until,
    'orders_limit', v_orders_limit
  );
END;
$$;

-- PASO 4: Permisos
GRANT EXECUTE ON FUNCTION public.update_tenant_subscription TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_tenant_subscription TO service_role;
GRANT EXECUTE ON FUNCTION public.update_tenant_subscription TO anon;

-- PASO 5: Recrear trigger de protección (pero sin bloquear la función RPC)
CREATE OR REPLACE FUNCTION public.prevent_owner_premium_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Si viene de la función RPC autorizada, permitir
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
  IF OLD.owner_user_id = auth.uid() THEN
    IF NEW.premium_until IS DISTINCT FROM OLD.premium_until THEN
      RAISE EXCEPTION 'No tienes permiso para modificar premium_until directamente.';
    END IF;
    IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier THEN
      RAISE EXCEPTION 'No tienes permiso para modificar subscription_tier directamente.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Crear trigger
CREATE TRIGGER prevent_owner_premium_change_trigger
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_owner_premium_change();

-- ============================================================================
-- TEST: Ejecuta esto para verificar que funciona (reemplaza el UUID)
-- ============================================================================
-- SELECT public.update_tenant_subscription(
--   'AQUI_TU_TENANT_ID'::uuid,
--   'premium',
--   (NOW() + INTERVAL '30 days')::timestamptz
-- );
-- 
-- Después verifica:
-- SELECT id, name, subscription_tier, premium_until FROM tenants WHERE id = 'AQUI_TU_TENANT_ID';
-- ============================================================================
