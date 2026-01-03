-- Sistema de límites de pedidos por suscripción
-- Free: 15 pedidos/mes, Premium: 80 pedidos/mes, Premium Pro: ilimitado

-- 1) Agregar columnas para el sistema de límites de pedidos
ALTER TABLE IF EXISTS public.tenants
  ADD COLUMN IF NOT EXISTS orders_limit integer DEFAULT 15;

ALTER TABLE IF EXISTS public.tenants
  ADD COLUMN IF NOT EXISTS orders_remaining integer DEFAULT 15;

ALTER TABLE IF EXISTS public.tenants
  ADD COLUMN IF NOT EXISTS orders_reset_date timestamptz DEFAULT (date_trunc('month', now()) + interval '1 month');

-- 2) Actualizar límites según el plan de suscripción existente
-- (null = ilimitado para premium_pro)
UPDATE public.tenants 
SET orders_limit = CASE 
  WHEN subscription_tier = 'free' THEN 15
  WHEN subscription_tier = 'premium' THEN 80
  WHEN subscription_tier = 'premium_pro' THEN NULL
  ELSE 15
END,
orders_remaining = CASE 
  WHEN subscription_tier = 'free' THEN 15
  WHEN subscription_tier = 'premium' THEN 80
  WHEN subscription_tier = 'premium_pro' THEN NULL
  ELSE 15
END
WHERE orders_limit IS NOT NULL OR orders_remaining IS NOT NULL OR subscription_tier IS NOT NULL;

-- 3) Función para obtener el límite según el plan
CREATE OR REPLACE FUNCTION public.get_order_limit_for_tier(tier text)
RETURNS integer AS $$
BEGIN
  RETURN CASE 
    WHEN tier = 'free' THEN 15
    WHEN tier = 'premium' THEN 80
    WHEN tier = 'premium_pro' THEN NULL -- NULL = ilimitado
    ELSE 15
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4) Función para decrementar pedidos restantes
-- Retorna true si se pudo decrementar, false si no hay pedidos disponibles
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

  -- Si el límite es NULL (ilimitado), siempre permitir
  IF v_limit IS NULL THEN
    RETURN true;
  END IF;

  -- Si no hay pedidos restantes, rechazar
  IF v_remaining IS NULL OR v_remaining <= 0 THEN
    RETURN false;
  END IF;

  -- Decrementar el contador
  UPDATE public.tenants
  SET orders_remaining = orders_remaining - 1
  WHERE id = p_tenant_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5) Función para verificar si quedan pedidos (para consulta rápida)
CREATE OR REPLACE FUNCTION public.can_accept_orders(p_tenant_id uuid)
RETURNS boolean AS $$
DECLARE
  v_remaining integer;
  v_limit integer;
BEGIN
  SELECT orders_remaining, orders_limit INTO v_remaining, v_limit
  FROM public.tenants
  WHERE id = p_tenant_id;

  -- Si el límite es NULL (ilimitado), siempre permitir
  IF v_limit IS NULL THEN
    RETURN true;
  END IF;

  -- Si quedan pedidos, permitir
  RETURN v_remaining IS NOT NULL AND v_remaining > 0;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 6) Trigger para decrementar automáticamente al crear un pedido
CREATE OR REPLACE FUNCTION public.handle_new_order()
RETURNS trigger AS $$
DECLARE
  v_can_accept boolean;
BEGIN
  -- Verificar y decrementar en una sola operación atómica
  v_can_accept := public.decrement_orders_remaining(NEW.tenant_id);
  
  IF NOT v_can_accept THEN
    RAISE EXCEPTION 'No quedan pedidos disponibles en tu plan. Actualiza tu suscripción para continuar.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear el trigger si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_order_created_decrement'
  ) THEN
    CREATE TRIGGER on_order_created_decrement
    BEFORE INSERT ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_order();
  END IF;
END;
$$;

-- 7) Función para actualizar límites cuando cambia el plan de suscripción
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

  -- Si el nuevo plan tiene más pedidos, agregar la diferencia
  -- Si es ilimitado (NULL), dejar en NULL
  IF v_new_limit IS NULL THEN
    NEW.orders_remaining := NULL;
  ELSIF v_old_limit IS NULL THEN
    -- Venía de ilimitado, establecer el nuevo límite
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

-- Crear el trigger si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_subscription_tier_change'
  ) THEN
    CREATE TRIGGER on_subscription_tier_change
    BEFORE UPDATE ON public.tenants
    FOR EACH ROW EXECUTE FUNCTION public.handle_subscription_tier_change();
  END IF;
END;
$$;

-- 8) Función para resetear pedidos mensualmente (llamar desde cron o manualmente)
CREATE OR REPLACE FUNCTION public.reset_monthly_orders()
RETURNS void AS $$
BEGIN
  UPDATE public.tenants
  SET 
    orders_remaining = orders_limit,
    orders_reset_date = date_trunc('month', now()) + interval '1 month'
  WHERE orders_limit IS NOT NULL
    AND orders_reset_date <= now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9) Habilitar Realtime para tenants (para ver cambios de orders_remaining en tiempo real)
ALTER TABLE public.tenants REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'tenants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tenants;
    RAISE NOTICE 'Tabla tenants agregada a supabase_realtime';
  ELSE
    RAISE NOTICE 'Tabla tenants ya está en supabase_realtime - OK';
  END IF;
END;
$$;

-- 10) Grants para que anon pueda leer orders_remaining (para mostrar en storefront)
-- Ya debería tener SELECT por las políticas existentes, pero aseguramos

-- Comentario: Para probar el reset mensual manualmente:
-- SELECT public.reset_monthly_orders();

-- Comentario: Para verificar el estado de un tenant:
-- SELECT id, name, subscription_tier, orders_limit, orders_remaining, orders_reset_date 
-- FROM public.tenants WHERE slug = 'tu-slug';
