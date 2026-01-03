-- Cambiar sistema de límites de pedidos de mensual a DIARIO
-- Los pedidos se reinician cada día a medianoche (hora local del servidor)

-- 1) Renombrar columna para claridad (reset_date ahora es diario)
-- No es necesario renombrar, solo actualizamos el comportamiento

-- 2) Actualizar todos los tenants con la fecha de reset para mañana
UPDATE public.tenants
SET orders_reset_date = (CURRENT_DATE + interval '1 day')::timestamptz
WHERE orders_reset_date IS NOT NULL;

-- 3) Función para resetear pedidos DIARIAMENTE (reemplaza la mensual)
CREATE OR REPLACE FUNCTION public.reset_daily_orders()
RETURNS void AS $$
BEGIN
  UPDATE public.tenants
  SET 
    orders_remaining = orders_limit,
    orders_reset_date = (CURRENT_DATE + interval '1 day')::timestamptz
  WHERE orders_limit IS NOT NULL
    AND orders_reset_date <= now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mantener la función mensual por compatibilidad pero que llame a la diaria
CREATE OR REPLACE FUNCTION public.reset_monthly_orders()
RETURNS void AS $$
BEGIN
  -- Ahora llama a la función diaria
  PERFORM public.reset_daily_orders();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4) Función mejorada para verificar y resetear automáticamente al consultar
-- Esto asegura que si pasó el día, se resetean los pedidos automáticamente
CREATE OR REPLACE FUNCTION public.get_orders_status(p_tenant_id uuid)
RETURNS TABLE(
  orders_remaining integer,
  orders_limit integer,
  orders_reset_date timestamptz,
  is_unlimited boolean,
  needs_reset boolean
) AS $$
DECLARE
  v_reset_date timestamptz;
  v_needs_reset boolean := false;
BEGIN
  -- Verificar si necesita reset
  SELECT t.orders_reset_date INTO v_reset_date
  FROM public.tenants t
  WHERE t.id = p_tenant_id;

  -- Si la fecha de reset ya pasó, resetear automáticamente
  IF v_reset_date IS NOT NULL AND v_reset_date <= now() THEN
    UPDATE public.tenants t
    SET 
      orders_remaining = t.orders_limit,
      orders_reset_date = (CURRENT_DATE + interval '1 day')::timestamptz
    WHERE t.id = p_tenant_id
      AND t.orders_limit IS NOT NULL;
    v_needs_reset := true;
  END IF;

  -- Retornar el estado actual
  RETURN QUERY
  SELECT 
    t.orders_remaining,
    t.orders_limit,
    t.orders_reset_date,
    (t.orders_limit IS NULL) as is_unlimited,
    v_needs_reset as needs_reset
  FROM public.tenants t
  WHERE t.id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5) Modificar handle_new_order para verificar reset antes de decrementar
CREATE OR REPLACE FUNCTION public.handle_new_order()
RETURNS trigger AS $$
DECLARE
  v_can_accept boolean;
  v_reset_date timestamptz;
  v_orders_limit integer;
BEGIN
  -- Primero verificar si necesita reset diario
  SELECT orders_reset_date, orders_limit INTO v_reset_date, v_orders_limit
  FROM public.tenants
  WHERE id = NEW.tenant_id;

  -- Si la fecha de reset ya pasó y tiene límite, resetear automáticamente
  IF v_reset_date IS NOT NULL AND v_reset_date <= now() AND v_orders_limit IS NOT NULL THEN
    UPDATE public.tenants
    SET 
      orders_remaining = orders_limit,
      orders_reset_date = (CURRENT_DATE + interval '1 day')::timestamptz
    WHERE id = NEW.tenant_id;
  END IF;

  -- Ahora verificar y decrementar
  v_can_accept := public.decrement_orders_remaining(NEW.tenant_id);
  
  IF NOT v_can_accept THEN
    RAISE EXCEPTION 'No quedan pedidos disponibles hoy. Los pedidos se renuevan mañana a las 00:00.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6) Actualizar la función de cambio de suscripción para usar reset diario
CREATE OR REPLACE FUNCTION public.handle_subscription_tier_change()
RETURNS trigger AS $$
DECLARE
  v_new_limit integer;
  v_old_limit integer;
BEGIN
  -- Solo actuar si cambió el tier
  IF NEW.subscription_tier = OLD.subscription_tier THEN
    RETURN NEW;
  END IF;

  v_new_limit := public.get_order_limit_for_tier(NEW.subscription_tier);
  v_old_limit := public.get_order_limit_for_tier(OLD.subscription_tier);

  -- Actualizar el límite
  NEW.orders_limit := v_new_limit;

  -- Establecer nueva fecha de reset (mañana)
  NEW.orders_reset_date := (CURRENT_DATE + interval '1 day')::timestamptz;

  -- Si el nuevo plan tiene más pedidos, agregar la diferencia
  IF v_new_limit IS NULL THEN
    -- Ilimitado
    NEW.orders_remaining := NULL;
  ELSIF v_old_limit IS NULL THEN
    -- Venía de ilimitado, establecer el nuevo límite completo
    NEW.orders_remaining := v_new_limit;
  ELSIF v_new_limit > v_old_limit THEN
    -- Upgrade: agregar la diferencia de pedidos
    NEW.orders_remaining := COALESCE(OLD.orders_remaining, 0) + (v_new_limit - v_old_limit);
  ELSE
    -- Downgrade: mantener los pedidos restantes pero no más del nuevo límite
    NEW.orders_remaining := LEAST(COALESCE(OLD.orders_remaining, v_new_limit), v_new_limit);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7) Función helper para saber cuánto tiempo falta para el reset
CREATE OR REPLACE FUNCTION public.get_time_until_reset(p_tenant_id uuid)
RETURNS interval AS $$
DECLARE
  v_reset_date timestamptz;
BEGIN
  SELECT orders_reset_date INTO v_reset_date
  FROM public.tenants
  WHERE id = p_tenant_id;

  IF v_reset_date IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN GREATEST(v_reset_date - now(), interval '0 seconds');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =====================================================
-- CONFIGURACIÓN DE CRON JOB (pg_cron)
-- =====================================================
-- Si tienes pg_cron habilitado en Supabase, puedes programar el reset automático:
-- 
-- SELECT cron.schedule(
--   'reset-daily-orders',
--   '0 0 * * *',  -- Todos los días a medianoche
--   $$SELECT public.reset_daily_orders()$$
-- );
--
-- Para verificar jobs programados:
-- SELECT * FROM cron.job;
--
-- Para eliminar un job:
-- SELECT cron.unschedule('reset-daily-orders');
-- =====================================================

-- Comentario: Para probar el reset diario manualmente:
-- SELECT public.reset_daily_orders();

-- Comentario: Para ver el estado con auto-reset:
-- SELECT * FROM public.get_orders_status('tu-tenant-id');

-- Comentario: Para ver tiempo restante hasta el reset:
-- SELECT public.get_time_until_reset('tu-tenant-id');
