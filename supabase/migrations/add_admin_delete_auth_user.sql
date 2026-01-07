-- Función para eliminar usuario completamente (incluyendo auth.users)
-- IMPORTANTE: Esta función usa la extensión pgcrypto y requiere permisos de admin

-- Primero, necesitas habilitar la extensión si no está habilitada
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Función para que el super_admin pueda eliminar usuarios de auth
-- NOTA: Esto requiere que el usuario tenga permisos de SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.admin_delete_auth_user(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
BEGIN
  -- Verificar que quien llama es super_admin
  SELECT role INTO v_caller_role 
  FROM public.profiles 
  WHERE user_id = auth.uid();
  
  IF v_caller_role != 'super_admin' THEN
    RAISE EXCEPTION 'Solo super_admin puede eliminar usuarios';
  END IF;

  -- Primero eliminar el profile
  DELETE FROM public.profiles WHERE user_id = p_user_id;
  
  -- Eliminar de auth.users (requiere permisos de service_role)
  -- NOTA: Esto solo funciona si la función se ejecuta con SECURITY DEFINER
  -- y el owner de la función tiene permisos suficientes
  DELETE FROM auth.users WHERE id = p_user_id;
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error al eliminar usuario: %', SQLERRM;
END;
$$;

-- Dar permisos solo a usuarios autenticados (el RLS dentro verificará si es super_admin)
GRANT EXECUTE ON FUNCTION public.admin_delete_auth_user(uuid) TO authenticated;

-- ALTERNATIVA MÁS SEGURA: Usar Supabase Edge Function
-- Si la función anterior no funciona por permisos, necesitas crear una Edge Function
-- que use el service_role key para llamar a supabase.auth.admin.deleteUser()
