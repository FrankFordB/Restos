-- ============================================================================
-- FIX: Recursión infinita en políticas de tenant_payment_methods y auto_renewal_log
-- ============================================================================
-- El problema: Las políticas hacen SELECT a tenants, que tiene sus propias
-- políticas que pueden causar recursión.
-- 
-- SOLUCIÓN: Usar funciones SECURITY DEFINER que bypasean RLS
-- ============================================================================

-- Función helper para obtener tenant_ids del usuario actual (bypassa RLS)
CREATE OR REPLACE FUNCTION public.get_my_tenant_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.tenants WHERE owner_user_id = auth.uid()
$$;

-- ============================================================================
-- Eliminar políticas problemáticas de tenant_payment_methods
-- ============================================================================
DROP POLICY IF EXISTS "Tenants can view own payment methods" ON public.tenant_payment_methods;
DROP POLICY IF EXISTS "Tenants can manage own payment methods" ON public.tenant_payment_methods;

-- Crear políticas nuevas usando la función helper
CREATE POLICY "Tenants can view own payment methods"
  ON public.tenant_payment_methods
  FOR SELECT
  USING (tenant_id IN (SELECT get_my_tenant_ids()));

CREATE POLICY "Tenants can insert own payment methods"
  ON public.tenant_payment_methods
  FOR INSERT
  WITH CHECK (tenant_id IN (SELECT get_my_tenant_ids()));

CREATE POLICY "Tenants can update own payment methods"
  ON public.tenant_payment_methods
  FOR UPDATE
  USING (tenant_id IN (SELECT get_my_tenant_ids()));

CREATE POLICY "Tenants can delete own payment methods"
  ON public.tenant_payment_methods
  FOR DELETE
  USING (tenant_id IN (SELECT get_my_tenant_ids()));

-- ============================================================================
-- Eliminar políticas problemáticas de auto_renewal_log
-- ============================================================================
DROP POLICY IF EXISTS "Tenants can view own renewal log" ON public.auto_renewal_log;

-- Crear política nueva usando la función helper
CREATE POLICY "Tenants can view own renewal log"
  ON public.auto_renewal_log
  FOR SELECT
  USING (tenant_id IN (SELECT get_my_tenant_ids()));

-- ============================================================================
-- Arreglar la política de tenants para auto_renew
-- El update de auto_renew debe funcionar sin recursión
-- ============================================================================

-- Asegurar que exista una política para UPDATE que no cause recursión
-- Solo permitir al owner actualizar su propio tenant
DROP POLICY IF EXISTS "Owners can update own tenant" ON public.tenants;

CREATE POLICY "Owners can update own tenant"
  ON public.tenants
  FOR UPDATE
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());
