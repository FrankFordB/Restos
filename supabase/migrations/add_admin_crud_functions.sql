-- =====================================================
-- MIGRACIÓN: Admin CRUD para Super Admin Dashboard
-- =====================================================
-- Esta migración agrega las políticas RLS necesarias para
-- permitir que el super_admin gestione usuarios y tiendas
-- completamente desde el dashboard.
-- =====================================================

-- Eliminar políticas existentes si existen (para evitar errores de duplicado)
DROP POLICY IF EXISTS "super_admin_update_profiles" ON public.profiles;
DROP POLICY IF EXISTS "super_admin_insert_profiles" ON public.profiles;
DROP POLICY IF EXISTS "super_admin_select_profiles" ON public.profiles;
DROP POLICY IF EXISTS "super_admin_delete_profiles" ON public.profiles;
DROP POLICY IF EXISTS "super_admin_all_tenants" ON public.tenants;

-- =====================================================
-- FUNCIÓN AUXILIAR (SECURITY DEFINER para evitar recursión)
-- =====================================================
-- Esta función bypasea RLS y evita la recursión infinita
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
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

-- Función auxiliar para obtener el rol del usuario actual (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$$;

-- =====================================================
-- POLÍTICAS RLS PARA PROFILES (usando funciones que evitan recursión)
-- =====================================================

-- SELECT: Usuario puede ver su propio perfil, super_admin puede ver todos
CREATE POLICY "super_admin_select_profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_super_admin()
);

-- UPDATE: Usuario puede actualizar su propio perfil, super_admin puede actualizar todos
CREATE POLICY "super_admin_update_profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_super_admin()
)
WITH CHECK (
  user_id = auth.uid()
  OR public.is_super_admin()
);

-- INSERT: Solo super_admin puede insertar nuevos profiles (los usuarios se crean via auth)
CREATE POLICY "super_admin_insert_profiles"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR user_id = auth.uid()
);

-- DELETE: Solo super_admin puede eliminar profiles
CREATE POLICY "super_admin_delete_profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  public.is_super_admin()
);

-- =====================================================
-- POLÍTICAS RLS PARA TENANTS
-- =====================================================

-- Asegurarse de que super_admin pueda gestionar todos los tenants
CREATE POLICY "super_admin_all_tenants"
ON public.tenants
FOR ALL
TO authenticated
USING (
  public.is_super_admin()
  OR owner_user_id = auth.uid()
  OR id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid())
)
WITH CHECK (
  public.is_super_admin()
  OR owner_user_id = auth.uid()
);

-- =====================================================
-- FUNCIONES RPC PARA ADMIN
-- =====================================================

-- Función para crear un tenant con validación
CREATE OR REPLACE FUNCTION public.admin_create_tenant(
  p_name text,
  p_slug text,
  p_owner_user_id uuid DEFAULT NULL,
  p_is_public boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id uuid;
  v_result jsonb;
BEGIN
  -- Verificar que el usuario es super_admin
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- Verificar que el slug no exista
  IF EXISTS (SELECT 1 FROM public.tenants WHERE slug = p_slug) THEN
    RAISE EXCEPTION 'El slug ya está en uso';
  END IF;

  -- Si hay owner, verificar que no tenga ya una tienda
  IF p_owner_user_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.tenants WHERE owner_user_id = p_owner_user_id) THEN
      RAISE EXCEPTION 'Este usuario ya tiene una tienda asignada';
    END IF;
  END IF;

  -- Crear el tenant
  INSERT INTO public.tenants (name, slug, owner_user_id, is_public, subscription_tier)
  VALUES (p_name, p_slug, p_owner_user_id, p_is_public, 'free')
  RETURNING id INTO v_tenant_id;

  -- Si hay owner, actualizar su profile
  IF p_owner_user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET tenant_id = v_tenant_id, role = 'tenant_admin'
    WHERE user_id = p_owner_user_id;
  END IF;

  SELECT jsonb_build_object(
    'success', true,
    'tenant_id', v_tenant_id
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Función para vincular tenant a usuario
CREATE OR REPLACE FUNCTION public.admin_link_tenant_to_user(
  p_tenant_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_owner_id uuid;
BEGIN
  -- Verificar que el usuario es super_admin
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- Verificar que el usuario no tenga ya otra tienda
  IF EXISTS (
    SELECT 1 FROM public.tenants 
    WHERE owner_user_id = p_user_id AND id != p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Este usuario ya tiene una tienda asignada';
  END IF;

  -- Obtener owner anterior
  SELECT owner_user_id INTO v_old_owner_id
  FROM public.tenants WHERE id = p_tenant_id;

  -- Desvincular owner anterior si existe
  IF v_old_owner_id IS NOT NULL AND v_old_owner_id != p_user_id THEN
    UPDATE public.profiles
    SET tenant_id = NULL
    WHERE user_id = v_old_owner_id;
  END IF;

  -- Actualizar tenant
  UPDATE public.tenants
  SET owner_user_id = p_user_id
  WHERE id = p_tenant_id;

  -- Actualizar profile del nuevo owner
  UPDATE public.profiles
  SET tenant_id = p_tenant_id, role = 'tenant_admin'
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Función para desvincular tenant de usuario
CREATE OR REPLACE FUNCTION public.admin_unlink_tenant_from_user(
  p_tenant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  -- Verificar que el usuario es super_admin
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- Obtener owner actual
  SELECT owner_user_id INTO v_owner_id
  FROM public.tenants WHERE id = p_tenant_id;

  -- Desvincular del profile
  IF v_owner_id IS NOT NULL THEN
    UPDATE public.profiles
    SET tenant_id = NULL
    WHERE user_id = v_owner_id;
  END IF;

  -- Quitar owner del tenant
  UPDATE public.tenants
  SET owner_user_id = NULL
  WHERE id = p_tenant_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Otorgar permisos
GRANT EXECUTE ON FUNCTION public.is_super_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_tenant TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_link_tenant_to_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unlink_tenant_from_user TO authenticated;

-- =====================================================
-- NOTAS DE USO:
-- 1. Ejecuta este SQL en tu dashboard de Supabase
-- 2. Las funciones ya están conectadas con el frontend
-- 3. Solo usuarios con role='super_admin' pueden ejecutarlas
-- =====================================================
