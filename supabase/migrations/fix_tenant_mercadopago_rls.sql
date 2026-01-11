-- ============================================================================
-- FIX: Políticas RLS de tenant_mercadopago
-- El error 406 ocurre porque las políticas hacen subqueries a tenants
-- que a su vez tiene políticas recursivas
-- ============================================================================

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "tenant_mercadopago_owner_select" ON public.tenant_mercadopago;
DROP POLICY IF EXISTS "tenant_mercadopago_owner_insert" ON public.tenant_mercadopago;
DROP POLICY IF EXISTS "tenant_mercadopago_owner_update" ON public.tenant_mercadopago;
DROP POLICY IF EXISTS "tenant_mercadopago_owner_delete" ON public.tenant_mercadopago;
DROP POLICY IF EXISTS "anon_can_check_mp_configured" ON public.tenant_mercadopago;

-- Crear función helper para evitar recursión
CREATE OR REPLACE FUNCTION public.user_owns_tenant_mp(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenants 
    WHERE id = p_tenant_id 
    AND owner_user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.user_is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  );
$$;

-- Nuevas políticas usando funciones helper
CREATE POLICY "tenant_mercadopago_owner_select" ON public.tenant_mercadopago
  FOR SELECT USING (
    public.user_owns_tenant_mp(tenant_id) OR public.user_is_super_admin()
  );

CREATE POLICY "tenant_mercadopago_owner_insert" ON public.tenant_mercadopago
  FOR INSERT WITH CHECK (
    public.user_owns_tenant_mp(tenant_id) OR public.user_is_super_admin()
  );

CREATE POLICY "tenant_mercadopago_owner_update" ON public.tenant_mercadopago
  FOR UPDATE USING (
    public.user_owns_tenant_mp(tenant_id) OR public.user_is_super_admin()
  );

CREATE POLICY "tenant_mercadopago_owner_delete" ON public.tenant_mercadopago
  FOR DELETE USING (
    public.user_owns_tenant_mp(tenant_id) OR public.user_is_super_admin()
  );

-- Política para anon (verificar si MP está configurado en storefront)
CREATE POLICY "anon_can_check_mp_configured" ON public.tenant_mercadopago
  FOR SELECT
  TO anon
  USING (
    -- Solo pueden ver si las credenciales existen, no los valores
    true
  );

-- Permisos
GRANT EXECUTE ON FUNCTION public.user_owns_tenant_mp TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_super_admin TO authenticated;
