-- ============================================================================
-- FIX: schedule_tier_change - Asegurar que el UPDATE funcione
-- Ejecutar en Supabase SQL Editor
-- ============================================================================

-- Primero verificamos el estado actual
SELECT id, name, subscription_tier, scheduled_tier, scheduled_at, premium_until
FROM public.tenants
WHERE id = 'ba6e8fc1-0751-40ea-b581-8fb8708fa29f';

-- Eliminar todas las versiones anteriores de la función
DROP FUNCTION IF EXISTS public.schedule_tier_change(uuid, text);

-- Recrear la función con SECURITY DEFINER y search_path correcto
CREATE OR REPLACE FUNCTION public.schedule_tier_change(
  p_tenant_id UUID,
  p_scheduled_tier TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant RECORD;
  v_rows_affected INT;
BEGIN
  -- Obtener tenant actual
  SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tenant not found');
  END IF;

  -- Verificar que el usuario sea el owner o super_admin
  IF v_tenant.owner_user_id != auth.uid() THEN
    -- Verificar si es super_admin
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() AND role = 'super_admin'
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
    END IF;
  END IF;

  -- Validar tier
  IF p_scheduled_tier NOT IN ('free', 'premium', 'premium_pro') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid tier');
  END IF;

  -- No permitir programar al mismo tier actual
  IF v_tenant.subscription_tier = p_scheduled_tier THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Cannot schedule change to current tier'
    );
  END IF;

  -- Actualizar el tenant con el cambio programado
  UPDATE public.tenants SET
    scheduled_tier = p_scheduled_tier,
    scheduled_at = NOW()
  WHERE id = p_tenant_id;
  
  -- Verificar cuántas filas se actualizaron
  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  
  IF v_rows_affected = 0 THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'UPDATE failed - no rows affected',
      'tenant_id', p_tenant_id
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'rows_updated', v_rows_affected,
    'current_tier', v_tenant.subscription_tier,
    'scheduled_tier', p_scheduled_tier,
    'effective_date', v_tenant.premium_until
  );
END;
$$;

-- Dar permisos
GRANT EXECUTE ON FUNCTION public.schedule_tier_change TO authenticated;

-- ============================================================================
-- También arreglar cancel_scheduled_tier_change
-- ============================================================================

DROP FUNCTION IF EXISTS public.cancel_scheduled_tier_change(UUID);

CREATE OR REPLACE FUNCTION public.cancel_scheduled_tier_change(
  p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant RECORD;
  v_rows_affected INT;
BEGIN
  -- Obtener tenant actual
  SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tenant not found');
  END IF;

  -- Verificar que el usuario sea el owner o super_admin
  IF v_tenant.owner_user_id != auth.uid() THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() AND role = 'super_admin'
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
    END IF;
  END IF;

  -- Limpiar scheduled_tier
  UPDATE public.tenants SET
    scheduled_tier = NULL,
    scheduled_at = NULL
  WHERE id = p_tenant_id;
  
  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'rows_updated', v_rows_affected,
    'message', 'Cambio programado cancelado'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_scheduled_tier_change TO authenticated;

-- ============================================================================
-- TEST: Probar que funcione
-- ============================================================================

-- Esto debería actualizar el tenant:
-- SELECT public.schedule_tier_change('ba6e8fc1-0751-40ea-b581-8fb8708fa29f', 'free');

-- Verificar después:
-- SELECT id, scheduled_tier, scheduled_at FROM public.tenants WHERE id = 'ba6e8fc1-0751-40ea-b581-8fb8708fa29f';
