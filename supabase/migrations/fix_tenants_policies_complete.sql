-- ============================================================================
-- FIX COMPLETO: Políticas de tenants sin recursión
-- ============================================================================
-- EJECUTAR ESTE SCRIPT COMPLETO EN SUPABASE SQL EDITOR
-- ============================================================================

-- PASO 1: Eliminar TODAS las políticas de tenants para empezar limpio
DO $$
DECLARE
    policy_name text;
BEGIN
    FOR policy_name IN (
        SELECT policyname FROM pg_policies WHERE tablename = 'tenants' AND schemaname = 'public'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.tenants', policy_name);
    END LOOP;
END $$;

-- PASO 2: Función helper para obtener tenant_ids del usuario (bypassa RLS)
CREATE OR REPLACE FUNCTION public.get_my_tenant_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.tenants WHERE owner_user_id = auth.uid()
$$;

-- PASO 3: Crear políticas limpias para tenants

-- SELECT: Super admin ve todo
CREATE POLICY "tenants_select_admin" ON public.tenants
FOR SELECT TO authenticated
USING (public.is_super_admin());

-- SELECT: Owner ve su tenant
CREATE POLICY "tenants_select_owner" ON public.tenants
FOR SELECT TO authenticated
USING (owner_user_id = auth.uid());

-- SELECT: Usuarios autenticados ven tenants públicos
CREATE POLICY "tenants_select_public_auth" ON public.tenants
FOR SELECT TO authenticated
USING (is_public = true);

-- SELECT: Anónimos ven tenants públicos (para storefront)
CREATE POLICY "tenants_select_public_anon" ON public.tenants
FOR SELECT TO anon
USING (is_public = true);

-- INSERT: Super admin o el owner
CREATE POLICY "tenants_insert" ON public.tenants
FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin() OR owner_user_id = auth.uid());

-- UPDATE: Super admin puede todo
CREATE POLICY "tenants_update_admin" ON public.tenants
FOR UPDATE TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- UPDATE: Owner puede actualizar su tenant (campos protegidos via trigger)
CREATE POLICY "tenants_update_owner" ON public.tenants
FOR UPDATE TO authenticated
USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid());

-- DELETE: Solo super admin
CREATE POLICY "tenants_delete_admin" ON public.tenants
FOR DELETE TO authenticated
USING (public.is_super_admin());

-- PASO 4: Trigger para proteger campos que owner no puede cambiar
CREATE OR REPLACE FUNCTION public.protect_tenant_premium_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Super admin puede cambiar todo
  IF public.is_super_admin() THEN
    RETURN NEW;
  END IF;
  
  -- Owner no puede cambiar premium_until ni subscription_tier
  IF NEW.premium_until IS DISTINCT FROM OLD.premium_until THEN
    NEW.premium_until := OLD.premium_until;
  END IF;
  
  IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier THEN
    NEW.subscription_tier := OLD.subscription_tier;
  END IF;
  
  -- Owner no puede cambiar scheduled_tier ni scheduled_at (solo via RPC)
  IF NEW.scheduled_tier IS DISTINCT FROM OLD.scheduled_tier THEN
    NEW.scheduled_tier := OLD.scheduled_tier;
  END IF;
  
  IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN
    NEW.scheduled_at := OLD.scheduled_at;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_tenant_premium_fields_trigger ON public.tenants;
CREATE TRIGGER protect_tenant_premium_fields_trigger
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_tenant_premium_fields();

-- PASO 5: Verificar que todo está bien
SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'tenants' AND schemaname = 'public'
ORDER BY cmd, policyname;
