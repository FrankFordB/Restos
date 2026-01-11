-- ============================================================================
-- FIX: Permitir que la función RPC update_tenant_subscription pueda actualizar
-- los campos premium_until y subscription_tier
-- El problema es que el trigger prevent_owner_premium_change bloquea incluso
-- cuando se llama desde SECURITY DEFINER
-- ============================================================================

-- Opción 1: Usar una variable de contexto para indicar que viene de RPC autorizado
-- Primero, actualizar la función RPC para establecer un flag

DROP FUNCTION IF EXISTS public.update_tenant_subscription(uuid, text, timestamptz);

CREATE OR REPLACE FUNCTION public.update_tenant_subscription(
  p_tenant_id uuid,
  p_tier text,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
  v_tenant record;
  v_orders_limit integer;
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
  IF p_tier NOT IN ('free', 'premium', 'premium_pro') THEN
    RAISE EXCEPTION 'Tier invalido: %', p_tier;
  END IF;
  
  -- Determinar limites segun tier
  v_orders_limit := CASE 
    WHEN p_tier = 'premium_pro' THEN NULL 
    WHEN p_tier = 'premium' THEN 80
    ELSE 15 
  END;
  
  -- Establecer variable de sesión para bypass del trigger
  PERFORM set_config('app.subscription_update', 'true', true);
  
  -- Actualizar tenant
  UPDATE public.tenants
  SET 
    subscription_tier = p_tier,
    premium_until = p_expires_at,
    subscription_status = 'active',
    orders_limit = v_orders_limit,
    orders_remaining = v_orders_limit
  WHERE id = p_tenant_id;
  
  -- Limpiar variable de sesión
  PERFORM set_config('app.subscription_update', 'false', true);
  
  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'tier', p_tier,
    'expires_at', p_expires_at
  );
END;
$fn$;

-- Actualizar el trigger para respetar el flag de la función RPC
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
  
  -- Si es owner, no permitir cambios a premium_until ni subscription_tier
  IF OLD.owner_user_id = auth.uid() THEN
    IF NEW.premium_until IS DISTINCT FROM OLD.premium_until THEN
      RAISE EXCEPTION 'No tienes permiso para modificar premium_until';
    END IF;
    IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier THEN
      RAISE EXCEPTION 'No tienes permiso para modificar subscription_tier';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Permitir a usuarios autenticados ejecutar esta funcion
GRANT EXECUTE ON FUNCTION public.update_tenant_subscription TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_tenant_subscription TO service_role;
