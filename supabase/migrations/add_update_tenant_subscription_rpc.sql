-- ============================================================================
-- FUNCIÓN RPC: update_tenant_subscription
-- Permite a un usuario actualizar la suscripción de su propio tenant
-- Usa SECURITY DEFINER para bypass de RLS
-- ============================================================================

-- Primero eliminar si existe
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
  
  -- Actualizar tenant
  UPDATE public.tenants
  SET 
    subscription_tier = p_tier,
    premium_until = p_expires_at,
    subscription_status = 'active',
    orders_limit = v_orders_limit,
    orders_remaining = v_orders_limit
  WHERE id = p_tenant_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'tier', p_tier,
    'expires_at', p_expires_at
  );
END;
$fn$;

-- Permitir a usuarios autenticados ejecutar esta funcion
GRANT EXECUTE ON FUNCTION public.update_tenant_subscription TO authenticated;
