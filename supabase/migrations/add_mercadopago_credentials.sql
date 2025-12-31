-- Migración: Sistema de credenciales MercadoPago para tenants
-- Cada tenant puede configurar sus propias credenciales de MP para recibir pagos

-- Tabla para credenciales de MercadoPago de cada tenant
CREATE TABLE IF NOT EXISTS public.tenant_mercadopago (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- Credenciales de producción
  access_token text NULL,
  public_key text NULL,
  -- Credenciales de sandbox/test
  sandbox_access_token text NULL,
  sandbox_public_key text NULL,
  -- Modo actual (sandbox o production)
  is_sandbox boolean NOT NULL DEFAULT true,
  -- Estado de la configuración
  is_configured boolean NOT NULL DEFAULT false,
  -- Webhook secret para validar notificaciones
  webhook_secret text NULL,
  -- Metadatos
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger para updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'tenant_mercadopago_set_updated_at'
  ) THEN
    CREATE TRIGGER tenant_mercadopago_set_updated_at
    BEFORE UPDATE ON public.tenant_mercadopago
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- RLS para tenant_mercadopago
ALTER TABLE public.tenant_mercadopago ENABLE ROW LEVEL SECURITY;

-- Solo el dueño del tenant puede ver/editar sus credenciales
CREATE POLICY "tenant_mercadopago_owner_select" ON public.tenant_mercadopago
  FOR SELECT USING (
    tenant_id IN (
      SELECT t.id FROM public.tenants t
      WHERE t.owner_user_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "tenant_mercadopago_owner_insert" ON public.tenant_mercadopago
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT t.id FROM public.tenants t
      WHERE t.owner_user_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "tenant_mercadopago_owner_update" ON public.tenant_mercadopago
  FOR UPDATE USING (
    tenant_id IN (
      SELECT t.id FROM public.tenants t
      WHERE t.owner_user_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "tenant_mercadopago_owner_delete" ON public.tenant_mercadopago
  FOR DELETE USING (
    tenant_id IN (
      SELECT t.id FROM public.tenants t
      WHERE t.owner_user_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Tabla para historial de suscripciones de la plataforma
CREATE TABLE IF NOT EXISTS public.platform_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- Info del pago
  mp_preference_id text NULL,
  mp_payment_id text NULL,
  mp_subscription_id text NULL,
  -- Plan comprado
  plan_tier text NOT NULL CHECK (plan_tier IN ('premium', 'premium_pro')),
  billing_period text NOT NULL CHECK (billing_period IN ('monthly', 'yearly')),
  -- Montos
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'ARS',
  -- Estado
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'cancelled', 'refunded', 'expired')),
  -- Fechas
  paid_at timestamptz NULL,
  expires_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_subscriptions_tenant_idx ON public.platform_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS platform_subscriptions_status_idx ON public.platform_subscriptions(status);
CREATE INDEX IF NOT EXISTS platform_subscriptions_mp_payment_idx ON public.platform_subscriptions(mp_payment_id);

-- Trigger para updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'platform_subscriptions_set_updated_at'
  ) THEN
    CREATE TRIGGER platform_subscriptions_set_updated_at
    BEFORE UPDATE ON public.platform_subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- RLS para platform_subscriptions
ALTER TABLE public.platform_subscriptions ENABLE ROW LEVEL SECURITY;

-- Dueños pueden ver sus suscripciones
CREATE POLICY "platform_subscriptions_owner_select" ON public.platform_subscriptions
  FOR SELECT USING (
    tenant_id IN (
      SELECT t.id FROM public.tenants t
      WHERE t.owner_user_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Solo super_admin o sistema pueden insertar/modificar
CREATE POLICY "platform_subscriptions_admin_insert" ON public.platform_subscriptions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "platform_subscriptions_admin_update" ON public.platform_subscriptions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Agregar columnas de MP a orders para pagos de tiendas
ALTER TABLE IF EXISTS public.orders
  ADD COLUMN IF NOT EXISTS mp_preference_id text,
  ADD COLUMN IF NOT EXISTS mp_payment_id text,
  ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'pending';

COMMENT ON COLUMN public.orders.mp_preference_id IS 'ID de preferencia de MercadoPago';
COMMENT ON COLUMN public.orders.mp_payment_id IS 'ID de pago de MercadoPago';
COMMENT ON COLUMN public.orders.payment_method IS 'Método de pago: cash, mercadopago, card, etc';
