-- =====================================================
-- SISTEMA DE EXPIRACIÓN AUTOMÁTICA DE SUSCRIPCIONES
-- =====================================================
-- Cuando premium_until pasa, el tenant vuelve a FREE automáticamente

-- 1) Función para verificar y degradar suscripciones expiradas
CREATE OR REPLACE FUNCTION public.check_subscription_expiration(p_tenant_id uuid DEFAULT NULL)
RETURNS TABLE(
  tenant_id uuid,
  tenant_name text,
  old_tier text,
  new_tier text,
  was_expired boolean
) AS $$
BEGIN
  -- Si se especifica un tenant, solo verificar ese
  IF p_tenant_id IS NOT NULL THEN
    RETURN QUERY
    WITH expired AS (
      UPDATE public.tenants t
      SET 
        subscription_tier = 'free',
        orders_limit = 15,
        orders_remaining = LEAST(COALESCE(orders_remaining, 15), 15)
      WHERE t.id = p_tenant_id
        AND t.subscription_tier != 'free'
        AND t.premium_until IS NOT NULL
        AND t.premium_until < now()
      RETURNING t.id, t.name, 'expired'::text as old_tier
    )
    SELECT 
      e.id,
      e.name,
      e.old_tier,
      'free'::text,
      true
    FROM expired e
    UNION ALL
    SELECT 
      t.id,
      t.name,
      t.subscription_tier,
      t.subscription_tier,
      false
    FROM public.tenants t
    WHERE t.id = p_tenant_id
      AND NOT EXISTS (SELECT 1 FROM expired e WHERE e.id = t.id);
  ELSE
    -- Verificar todos los tenants
    RETURN QUERY
    WITH expired AS (
      UPDATE public.tenants t
      SET 
        subscription_tier = 'free',
        orders_limit = 15,
        orders_remaining = LEAST(COALESCE(orders_remaining, 15), 15)
      WHERE t.subscription_tier != 'free'
        AND t.premium_until IS NOT NULL
        AND t.premium_until < now()
      RETURNING t.id, t.name, t.subscription_tier as old_tier
    )
    SELECT 
      e.id,
      e.name,
      e.old_tier,
      'free'::text,
      true
    FROM expired e;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2) Función que se ejecuta en cada consulta del tenant para auto-verificar
CREATE OR REPLACE FUNCTION public.get_tenant_with_subscription_check(p_tenant_id uuid)
RETURNS TABLE(
  id uuid,
  name text,
  slug text,
  subscription_tier text,
  premium_until timestamptz,
  orders_limit integer,
  orders_remaining integer,
  orders_reset_date timestamptz,
  is_expired boolean
) AS $$
DECLARE
  v_is_expired boolean := false;
BEGIN
  -- Verificar si está expirado y actualizar si es necesario
  UPDATE public.tenants t
  SET 
    subscription_tier = 'free',
    orders_limit = 15,
    orders_remaining = LEAST(COALESCE(t.orders_remaining, 15), 15)
  WHERE t.id = p_tenant_id
    AND t.subscription_tier != 'free'
    AND t.premium_until IS NOT NULL
    AND t.premium_until < now();
  
  IF FOUND THEN
    v_is_expired := true;
  END IF;

  -- Retornar los datos actualizados
  RETURN QUERY
  SELECT 
    t.id,
    t.name,
    t.slug,
    t.subscription_tier,
    t.premium_until,
    t.orders_limit,
    t.orders_remaining,
    t.orders_reset_date,
    v_is_expired
  FROM public.tenants t
  WHERE t.id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3) Función para degradar TODOS los expirados (para cron)
CREATE OR REPLACE FUNCTION public.expire_all_subscriptions()
RETURNS integer AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.tenants
  SET 
    subscription_tier = 'free',
    orders_limit = 15,
    orders_remaining = LEAST(COALESCE(orders_remaining, 15), 15)
  WHERE subscription_tier != 'free'
    AND premium_until IS NOT NULL
    AND premium_until < now();
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RAISE NOTICE 'Expired % subscriptions', v_count;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4) Programar cron job para verificar expiración cada hora
-- (Solo funciona si pg_cron está habilitado)
DO $$
BEGIN
  -- Intentar crear el cron job
  PERFORM cron.schedule(
    'expire-subscriptions',
    '0 * * * *',  -- Cada hora en el minuto 0
    'SELECT public.expire_all_subscriptions()'
  );
  RAISE NOTICE 'Cron job expire-subscriptions creado correctamente';
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'pg_cron no disponible - usar verificación manual';
  WHEN OTHERS THEN
    RAISE NOTICE 'Error al crear cron job: %', SQLERRM;
END;
$$;

-- 5) Función para otorgar días premium (para uso del admin)
CREATE OR REPLACE FUNCTION public.grant_premium_days(
  p_tenant_id uuid,
  p_tier text,
  p_days integer
)
RETURNS TABLE(
  tenant_id uuid,
  tenant_name text,
  new_tier text,
  premium_until timestamptz,
  orders_limit integer,
  orders_remaining integer
) AS $$
DECLARE
  v_new_limit integer;
BEGIN
  -- Determinar el límite de pedidos según el tier
  v_new_limit := CASE 
    WHEN p_tier = 'free' THEN 15
    WHEN p_tier = 'premium' THEN 80
    WHEN p_tier = 'premium_pro' THEN NULL
    ELSE 15
  END;

  -- Actualizar el tenant
  UPDATE public.tenants t
  SET 
    subscription_tier = p_tier,
    premium_until = CASE 
      WHEN p_tier = 'free' THEN NULL
      ELSE COALESCE(
        CASE WHEN t.premium_until > now() THEN t.premium_until ELSE now() END,
        now()
      ) + (p_days || ' days')::interval
    END,
    orders_limit = v_new_limit,
    orders_remaining = CASE 
      WHEN v_new_limit IS NULL THEN NULL
      ELSE GREATEST(COALESCE(t.orders_remaining, 0), 0) + 
           COALESCE(v_new_limit - COALESCE(t.orders_limit, 15), 0)
    END
  WHERE t.id = p_tenant_id;

  -- Retornar el resultado
  RETURN QUERY
  SELECT 
    t.id,
    t.name,
    t.subscription_tier,
    t.premium_until,
    t.orders_limit,
    t.orders_remaining
  FROM public.tenants t
  WHERE t.id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6) Arreglar el tenant actual que está mal (tu caso específico)
-- Primero verificamos el estado actual
SELECT id, name, subscription_tier, premium_until, orders_limit, orders_remaining
FROM public.tenants
WHERE id = 'ce995c99-8960-4141-847b-1a3d2f2b9cd4';

-- Si premium_until ya pasó, ejecutar esto para corregirlo:
-- SELECT * FROM public.check_subscription_expiration('ce995c99-8960-4141-847b-1a3d2f2b9cd4');

-- =====================================================
-- CONSULTAS ÚTILES
-- =====================================================

-- Ver todos los tenants con su estado de suscripción:
-- SELECT name, subscription_tier, premium_until, 
--        CASE WHEN premium_until < now() THEN 'EXPIRADO' ELSE 'ACTIVO' END as status
-- FROM public.tenants
-- ORDER BY premium_until DESC NULLS LAST;

-- Forzar expiración de todas las suscripciones vencidas:
-- SELECT public.expire_all_subscriptions();

-- Otorgar 30 días premium a un tenant:
-- SELECT * FROM public.grant_premium_days('tenant-uuid-here', 'premium', 30);

-- Verificar y corregir un tenant específico:
-- SELECT * FROM public.check_subscription_expiration('tenant-uuid-here');
