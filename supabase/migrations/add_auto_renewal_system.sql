-- Migración: Sistema de auto-renovación con MercadoPago
-- Este sistema permite que las suscripciones se renueven automáticamente 1 día antes de expirar

-- Tabla para almacenar tokens de pago guardados (para cobros automáticos)
CREATE TABLE IF NOT EXISTS public.tenant_payment_methods (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  mp_customer_id TEXT, -- ID del customer en MercadoPago
  mp_card_id TEXT, -- ID de la tarjeta guardada (card_token para cobros recurrentes)
  last_four_digits TEXT, -- Últimos 4 dígitos de la tarjeta
  card_brand TEXT, -- Visa, Mastercard, etc.
  expiration_month INTEGER,
  expiration_year INTEGER,
  is_default BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, mp_card_id)
);

-- Tabla para log de intentos de renovación automática
CREATE TABLE IF NOT EXISTS public.auto_renewal_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subscription_tier TEXT NOT NULL,
  billing_period TEXT DEFAULT 'monthly',
  amount NUMERIC(10,2),
  status TEXT DEFAULT 'pending', -- pending, success, failed
  mp_payment_id TEXT,
  error_message TEXT,
  attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_payment_methods_tenant ON public.tenant_payment_methods(tenant_id);
CREATE INDEX IF NOT EXISTS idx_renewal_log_tenant ON public.auto_renewal_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_renewal_log_status ON public.auto_renewal_log(status);

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

-- RLS para tenant_payment_methods
ALTER TABLE public.tenant_payment_methods ENABLE ROW LEVEL SECURITY;

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

-- RLS para auto_renewal_log
ALTER TABLE public.auto_renewal_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view own renewal log"
  ON public.auto_renewal_log
  FOR SELECT
  USING (tenant_id IN (SELECT get_my_tenant_ids()));

-- Función para obtener suscripciones que vencen mañana y tienen auto_renew activo
CREATE OR REPLACE FUNCTION public.get_subscriptions_to_renew()
RETURNS TABLE (
  tenant_id UUID,
  tenant_name TEXT,
  owner_email TEXT,
  subscription_tier TEXT,
  premium_until TIMESTAMP WITH TIME ZONE,
  mp_customer_id TEXT,
  mp_card_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id AS tenant_id,
    t.name AS tenant_name,
    p.email AS owner_email,
    t.subscription_tier,
    t.premium_until,
    pm.mp_customer_id,
    pm.mp_card_id
  FROM public.tenants t
  LEFT JOIN public.profiles p ON t.owner_user_id = p.id
  LEFT JOIN public.tenant_payment_methods pm ON t.id = pm.tenant_id AND pm.is_default = true
  WHERE 
    t.auto_renew = true
    AND t.subscription_tier IN ('premium', 'premium_pro')
    AND t.premium_until IS NOT NULL
    -- Vence mañana (entre 0 y 2 días)
    AND t.premium_until >= NOW()
    AND t.premium_until <= NOW() + INTERVAL '2 days'
    -- No tiene un cambio de tier programado (downgrade)
    AND t.scheduled_tier IS NULL;
END;
$$;

-- Función para registrar intento de renovación
CREATE OR REPLACE FUNCTION public.log_renewal_attempt(
  p_tenant_id UUID,
  p_tier TEXT,
  p_amount NUMERIC,
  p_status TEXT,
  p_payment_id TEXT DEFAULT NULL,
  p_error TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.auto_renewal_log (
    tenant_id,
    subscription_tier,
    amount,
    status,
    mp_payment_id,
    error_message,
    processed_at
  ) VALUES (
    p_tenant_id,
    p_tier,
    p_amount,
    p_status,
    p_payment_id,
    p_error,
    CASE WHEN p_status != 'pending' THEN NOW() ELSE NULL END
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- Comentarios
COMMENT ON TABLE public.tenant_payment_methods IS 'Métodos de pago guardados para renovación automática';
COMMENT ON TABLE public.auto_renewal_log IS 'Log de intentos de renovación automática';
COMMENT ON FUNCTION public.get_subscriptions_to_renew IS 'Obtiene suscripciones que deben renovarse (vencen en 1-2 días con auto_renew activo)';
