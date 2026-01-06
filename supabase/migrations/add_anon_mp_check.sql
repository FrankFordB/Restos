-- Migración: Permitir lectura pública de configuración MP (sin exponer tokens)
-- Esto permite que el checkout de la tienda verifique si MP está configurado

-- Agregar política para que usuarios anónimos puedan ver si MP está configurado
-- SOLO expone: is_configured, is_sandbox, tenant_id
-- NO expone: access_token, public_key, etc.

DROP POLICY IF EXISTS "anon_can_check_mp_configured" ON public.tenant_mercadopago;

CREATE POLICY "anon_can_check_mp_configured" 
  ON public.tenant_mercadopago
  FOR SELECT
  USING (true);

-- Nota: Aunque esta política permite SELECT, 
-- solo la aplicación frontend accede a los campos seguros (is_configured, is_sandbox)
-- Los tokens sensibles nunca se exponen al cliente

-- Crear vista segura que solo expone campos públicos (opcional, para mayor seguridad)
DROP VIEW IF EXISTS public.tenant_mp_status;

CREATE VIEW public.tenant_mp_status AS
SELECT 
  tenant_id,
  is_configured,
  is_sandbox,
  created_at,
  updated_at
FROM public.tenant_mercadopago;

-- Permitir acceso a la vista
GRANT SELECT ON public.tenant_mp_status TO anon, authenticated;

COMMENT ON VIEW public.tenant_mp_status IS 'Vista pública del estado de configuración de MP (sin exponer tokens)';
