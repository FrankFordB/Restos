-- ============================================
-- FIX: Sistema de límites de pedidos
-- 1. Reset diario a las 00:00 hora de Argentina (UTC-3)
-- 2. Corregir upgrade de suscripción para que actualice pedidos inmediatamente
-- ============================================

-- Zona horaria de Argentina
-- 'America/Argentina/Buenos_Aires' = UTC-3

-- ============================================
-- 1) Función helper para obtener medianoche de Argentina del próximo día
-- ============================================
CREATE OR REPLACE FUNCTION public.get_next_argentina_midnight()
RETURNS timestamptz AS $$
BEGIN
  -- Obtener la fecha actual en Argentina y sumar 1 día para obtener el próximo reset
  -- Luego convertir de vuelta a timestamptz (UTC)
  RETURN (
    ((now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date + interval '1 day') 
    AT TIME ZONE 'America/Argentina/Buenos_Aires'
  )::timestamptz;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 2) Función para verificar si es necesario resetear (basado en hora de Argentina)
-- ============================================
CREATE OR REPLACE FUNCTION public.needs_daily_reset(p_reset_date timestamptz)
RETURNS boolean AS $$
BEGIN
  -- Si no hay fecha de reset, no necesita reset
  IF p_reset_date IS NULL THEN
    RETURN false;
  END IF;
  
  -- Verificar si la fecha de reset ya pasó (en hora UTC)
  RETURN p_reset_date <= now();
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 3) Actualizar función de reset diario para usar hora de Argentina
-- ============================================
CREATE OR REPLACE FUNCTION public.reset_daily_orders()
RETURNS void AS $$
BEGIN
  UPDATE public.tenants
  SET 
    orders_remaining = orders_limit,
    orders_reset_date = public.get_next_argentina_midnight()
  WHERE orders_limit IS NOT NULL
    AND orders_reset_date <= now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4) Actualizar función get_orders_status para auto-reset con hora Argentina
-- ============================================
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
      orders_reset_date = public.get_next_argentina_midnight()
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

-- ============================================
-- 5) Actualizar trigger handle_new_order para usar hora Argentina
-- ============================================
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
      orders_reset_date = public.get_next_argentina_midnight()
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

-- ============================================
-- 6) CORREGIR: Función de cambio de suscripción - UPGRADE da pedidos completos del nuevo plan
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_subscription_tier_change()
RETURNS trigger AS $$
DECLARE
  v_new_limit integer;
  v_old_limit integer;
BEGIN
  -- Solo actuar si cambió el tier
  IF NEW.subscription_tier IS NOT DISTINCT FROM OLD.subscription_tier THEN
    RETURN NEW;
  END IF;

  v_new_limit := public.get_order_limit_for_tier(NEW.subscription_tier);
  v_old_limit := public.get_order_limit_for_tier(OLD.subscription_tier);

  -- Actualizar el límite
  NEW.orders_limit := v_new_limit;

  -- ========================================
  -- CAMBIO IMPORTANTE: Premium Pro = TODO NULL (ilimitado)
  -- ========================================
  IF v_new_limit IS NULL THEN
    -- Plan ilimitado (premium_pro) - TODO debe ser NULL
    NEW.orders_remaining := NULL;
    NEW.orders_reset_date := NULL;  -- No necesita reset
  ELSIF v_old_limit IS NULL THEN
    -- Venía de ilimitado (downgrade), establecer el nuevo límite completo
    NEW.orders_remaining := v_new_limit;
    NEW.orders_reset_date := public.get_next_argentina_midnight();
  ELSIF v_new_limit > COALESCE(v_old_limit, 0) THEN
    -- UPGRADE: Dar los pedidos COMPLETOS del nuevo plan
    NEW.orders_remaining := v_new_limit;
    NEW.orders_reset_date := public.get_next_argentina_midnight();
  ELSE
    -- Downgrade: mantener los pedidos restantes pero no más del nuevo límite
    NEW.orders_remaining := LEAST(COALESCE(OLD.orders_remaining, v_new_limit), v_new_limit);
    NEW.orders_reset_date := public.get_next_argentina_midnight();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7) Asegurarse que el trigger existe
-- ============================================
DO $$
BEGIN
  -- Eliminar trigger si existe para recrearlo
  DROP TRIGGER IF EXISTS on_subscription_tier_change ON public.tenants;
  
  -- Crear el trigger
  CREATE TRIGGER on_subscription_tier_change
    BEFORE UPDATE ON public.tenants
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_subscription_tier_change();
    
  RAISE NOTICE 'Trigger on_subscription_tier_change created successfully';
END;
$$;

-- ============================================
-- 8) Función para obtener tiempo restante hasta reset (hora Argentina)
-- ============================================
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

-- ============================================
-- 9) Actualizar todos los tenants existentes con la fecha de reset correcta
-- ============================================
UPDATE public.tenants
SET orders_reset_date = public.get_next_argentina_midnight()
WHERE orders_limit IS NOT NULL;

-- ============================================
-- VERIFICACIÓN
-- ============================================
DO $$
DECLARE
  v_next_midnight timestamptz;
  v_now_argentina text;
BEGIN
  v_next_midnight := public.get_next_argentina_midnight();
  v_now_argentina := (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::text;
  
  RAISE NOTICE '====================================';
  RAISE NOTICE 'Hora actual en Argentina: %', v_now_argentina;
  RAISE NOTICE 'Próximo reset (medianoche Argentina): %', v_next_midnight;
  RAISE NOTICE '====================================';
  RAISE NOTICE 'SUCCESS: Migración completada';
  RAISE NOTICE '- Reset diario a las 00:00 Argentina';
  RAISE NOTICE '- Upgrade ahora da pedidos completos del nuevo plan';
END;
$$;

-- ============================================
-- CONFIGURACIÓN DE CRON JOB (pg_cron)
-- ============================================
-- Para programar el reset automático a las 00:00 Argentina (03:00 UTC):
-- 
-- SELECT cron.schedule(
--   'reset-daily-orders-argentina',
--   '0 3 * * *',  -- 03:00 UTC = 00:00 Argentina
--   $$SELECT public.reset_daily_orders()$$
-- );
--
-- Para verificar jobs programados:
-- SELECT * FROM cron.job;
--
-- Para eliminar un job anterior:
-- SELECT cron.unschedule('reset-daily-orders');
-- ============================================
