-- =====================================================
-- DIAGNÓSTICO Y CORRECCIÓN DEL SISTEMA DE LÍMITES
-- =====================================================

-- 1) Verificar si el trigger existe
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgenabled as enabled
FROM pg_trigger 
WHERE tgname = 'on_order_created_decrement';

-- 2) Verificar el estado actual del tenant
SELECT 
  id,
  name,
  slug,
  subscription_tier,
  orders_limit,
  orders_remaining,
  orders_reset_date
FROM public.tenants;

-- 3) Si el trigger NO existe, crearlo:
DROP TRIGGER IF EXISTS on_order_created_decrement ON public.orders;

CREATE TRIGGER on_order_created_decrement
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.handle_new_order();

-- 4) Recrear la función handle_new_order con logging para debug
CREATE OR REPLACE FUNCTION public.handle_new_order()
RETURNS trigger AS $$
DECLARE
  v_can_accept boolean;
  v_reset_date timestamptz;
  v_orders_limit integer;
  v_orders_remaining integer;
BEGIN
  -- Log para debug
  RAISE NOTICE 'handle_new_order triggered for tenant_id: %', NEW.tenant_id;
  
  -- Obtener estado actual
  SELECT orders_reset_date, orders_limit, orders_remaining 
  INTO v_reset_date, v_orders_limit, v_orders_remaining
  FROM public.tenants
  WHERE id = NEW.tenant_id;

  RAISE NOTICE 'Current state - limit: %, remaining: %, reset_date: %', 
    v_orders_limit, v_orders_remaining, v_reset_date;

  -- Si la fecha de reset ya pasó y tiene límite, resetear automáticamente
  IF v_reset_date IS NOT NULL AND v_reset_date <= now() AND v_orders_limit IS NOT NULL THEN
    RAISE NOTICE 'Resetting orders for new day';
    UPDATE public.tenants
    SET 
      orders_remaining = orders_limit,
      orders_reset_date = (CURRENT_DATE + interval '1 day')::timestamptz
    WHERE id = NEW.tenant_id;
  END IF;

  -- Ahora verificar y decrementar
  v_can_accept := public.decrement_orders_remaining(NEW.tenant_id);
  
  RAISE NOTICE 'Can accept order: %', v_can_accept;
  
  IF NOT v_can_accept THEN
    RAISE EXCEPTION 'No quedan pedidos disponibles hoy. Los pedidos se renuevan mañana a las 00:00.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5) Verificar que la función decrement_orders_remaining funciona
CREATE OR REPLACE FUNCTION public.decrement_orders_remaining(p_tenant_id uuid)
RETURNS boolean AS $$
DECLARE
  v_remaining integer;
  v_limit integer;
BEGIN
  -- Obtener los valores actuales
  SELECT orders_remaining, orders_limit INTO v_remaining, v_limit
  FROM public.tenants
  WHERE id = p_tenant_id
  FOR UPDATE; -- Bloquear la fila para evitar race conditions

  RAISE NOTICE 'decrement_orders_remaining - limit: %, remaining: %', v_limit, v_remaining;

  -- Si el límite es NULL (ilimitado), siempre permitir
  IF v_limit IS NULL THEN
    RAISE NOTICE 'Unlimited plan, allowing order';
    RETURN true;
  END IF;

  -- Si no hay pedidos restantes, rechazar
  IF v_remaining IS NULL OR v_remaining <= 0 THEN
    RAISE NOTICE 'No orders remaining, rejecting';
    RETURN false;
  END IF;

  -- Decrementar el contador
  UPDATE public.tenants
  SET orders_remaining = orders_remaining - 1
  WHERE id = p_tenant_id;

  RAISE NOTICE 'Order accepted, decremented to: %', v_remaining - 1;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6) Test manual: Verificar si se decrementa correctamente
-- Reemplaza 'TU_TENANT_ID' con el UUID de tu tenant
-- SELECT public.decrement_orders_remaining('TU_TENANT_ID');
-- SELECT orders_remaining FROM public.tenants WHERE id = 'TU_TENANT_ID';

-- 7) Verificar que el trigger está registrado correctamente
SELECT 
  t.tgname AS trigger_name,
  p.proname AS function_name,
  CASE t.tgenabled
    WHEN 'O' THEN 'enabled (origin)'
    WHEN 'D' THEN 'DISABLED'
    WHEN 'R' THEN 'enabled (replica)'
    WHEN 'A' THEN 'enabled (always)'
    ELSE 'unknown'
  END AS status
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgrelid = 'public.orders'::regclass;
