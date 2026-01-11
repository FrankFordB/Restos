-- ============================================================================
-- FIX: Recursión infinita en política tenants_update_owner
-- ============================================================================
-- El problema: La política tenants_update_owner hace un subquery SELECT a la 
-- misma tabla tenants, lo cual activa las políticas de SELECT y causa recursión.
--
-- SOLUCIÓN: Usar una función SECURITY DEFINER que bypasee RLS para verificar
-- que premium_until y subscription_tier no cambien.
-- ============================================================================

-- Función para verificar que el owner no cambie campos protegidos
CREATE OR REPLACE FUNCTION public.check_tenant_protected_fields(
  p_tenant_id UUID,
  p_new_premium_until TIMESTAMPTZ,
  p_new_subscription_tier TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_premium_until TIMESTAMPTZ;
  v_current_tier TEXT;
BEGIN
  -- Obtener valores actuales (bypassa RLS por ser SECURITY DEFINER)
  SELECT premium_until, subscription_tier
  INTO v_current_premium_until, v_current_tier
  FROM public.tenants
  WHERE id = p_tenant_id;
  
  -- Verificar que no cambien
  RETURN (
    p_new_premium_until IS NOT DISTINCT FROM v_current_premium_until
    AND p_new_subscription_tier IS NOT DISTINCT FROM v_current_tier
  );
END;
$$;

-- Eliminar la política problemática
DROP POLICY IF EXISTS "tenants_update_owner" ON public.tenants;

-- Crear nueva política sin subqueries recursivos
-- Opción simplificada: permitir update si es owner (la verificación de campos
-- protegidos se hace a nivel de aplicación o con trigger)
CREATE POLICY "tenants_update_owner" ON public.tenants
FOR UPDATE
TO authenticated
USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid());

-- Trigger para prevenir que owners cambien premium_until o subscription_tier
CREATE OR REPLACE FUNCTION public.prevent_owner_premium_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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

-- Crear trigger solo si no existe
DROP TRIGGER IF EXISTS prevent_owner_premium_change_trigger ON public.tenants;
CREATE TRIGGER prevent_owner_premium_change_trigger
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_owner_premium_change();
