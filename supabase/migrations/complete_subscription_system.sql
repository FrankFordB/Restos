-- ============================================================================
-- SISTEMA COMPLETO DE SUSCRIPCIONES CON MERCADOPAGO
-- ============================================================================
-- Ejecutar en Supabase SQL Editor
-- Versión: 1.0.0
-- Fecha: 2026-01-06
-- ============================================================================

-- ============================================================================
-- 1. TABLA: subscription_plans (Definición de planes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id text PRIMARY KEY,  -- 'free', 'premium', 'premium_pro'
  name text NOT NULL,
  description text,
  -- Precios
  price_monthly numeric(10,2) NOT NULL DEFAULT 0,
  price_yearly numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  -- Límites
  orders_per_day integer,  -- null = unlimited
  max_products integer,
  max_categories integer,
  -- Features como JSON para flexibilidad
  features jsonb NOT NULL DEFAULT '{}',
  -- Estado
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'subscription_plans_set_updated_at'
  ) THEN
    CREATE TRIGGER subscription_plans_set_updated_at
    BEFORE UPDATE ON public.subscription_plans
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- Insertar planes por defecto
INSERT INTO public.subscription_plans (id, name, description, price_monthly, price_yearly, orders_per_day, display_order, features)
VALUES 
  ('free', 'Gratis', 'Plan básico para comenzar', 0, 0, 15, 1, '{
    "widgets": ["hero", "products_grid", "featured_products", "text_block", "contact_form", "social_links"],
    "card_layouts": ["classic"],
    "card_styles": ["glass", "solid"],
    "hero_styles": ["static"]
  }'::jsonb),
  ('premium', 'Premium', 'Para negocios en crecimiento', 9.99, 99, 80, 2, '{
    "widgets": ["hero", "products_grid", "featured_products", "text_block", "contact_form", "social_links", "products_carousel", "image_gallery", "categories", "banner", "map"],
    "card_layouts": ["classic", "horizontal", "overlay", "compact"],
    "card_styles": ["glass", "solid", "outlined", "elevated"],
    "hero_styles": ["static", "slide_fade", "zoom_ken", "slide_scale"]
  }'::jsonb),
  ('premium_pro', 'Premium Pro', 'Todo incluido para profesionales', 19.99, 199, NULL, 3, '{
    "widgets": ["hero", "products_grid", "featured_products", "text_block", "contact_form", "social_links", "products_carousel", "image_gallery", "categories", "banner", "map", "testimonials", "video", "newsletter", "faq", "team", "stats"],
    "card_layouts": ["classic", "horizontal", "overlay", "compact", "magazine", "minimal", "polaroid", "banner"],
    "card_styles": ["glass", "solid", "outlined", "elevated", "minimal"],
    "hero_styles": ["static", "slide_fade", "zoom_ken", "slide_scale", "parallax_depth", "cube_rotate", "reveal_wipe", "zoom_blur"],
    "page_builder": true
  }'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  orders_per_day = EXCLUDED.orders_per_day,
  features = EXCLUDED.features,
  display_order = EXCLUDED.display_order;

-- RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscription_plans_public_read" ON public.subscription_plans
  FOR SELECT USING (true);

CREATE POLICY "subscription_plans_admin_all" ON public.subscription_plans
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'super_admin')
  );


-- ============================================================================
-- 2. ACTUALIZAR TABLA: platform_subscriptions
-- ============================================================================

-- Eliminar tabla anterior si existe con estructura incorrecta y recrear
-- (Comentar si ya tienes datos importantes)
-- DROP TABLE IF EXISTS public.platform_subscriptions;

CREATE TABLE IF NOT EXISTS public.platform_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Plan info
  plan_tier text NOT NULL DEFAULT 'premium' REFERENCES subscription_plans(id),
  billing_period text NOT NULL CHECK (billing_period IN ('monthly', 'yearly', 'custom')),
  
  -- MercadoPago
  mp_preference_id text,
  mp_payment_id text,
  mp_subscription_id text,
  mp_merchant_order_id text,
  
  -- Montos
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'ARS',
  
  -- Estado
  status text NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'approved', 'cancelled', 'refunded', 'expired', 'failed')),
  
  -- Origen del pago
  source text NOT NULL DEFAULT 'payment' 
    CHECK (source IN ('payment', 'gift', 'trial', 'migration', 'renewal')),
  
  -- Para regalos de admin
  gifted_by uuid REFERENCES auth.users(id),
  gift_reason text,
  
  -- Fechas importantes
  starts_at timestamptz,
  expires_at timestamptz,
  cancelled_at timestamptz,
  paid_at timestamptz,
  
  -- Idempotencia (evitar duplicados)
  idempotency_key text UNIQUE,
  
  -- Datos adicionales
  metadata jsonb DEFAULT '{}',
  payer_email text,
  payer_name text,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_platform_subscriptions_tenant ON public.platform_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_platform_subscriptions_status ON public.platform_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_platform_subscriptions_mp_preference ON public.platform_subscriptions(mp_preference_id);
CREATE INDEX IF NOT EXISTS idx_platform_subscriptions_expires ON public.platform_subscriptions(expires_at);

-- Trigger updated_at
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

-- RLS
ALTER TABLE public.platform_subscriptions ENABLE ROW LEVEL SECURITY;

-- Super admin puede ver todo
CREATE POLICY "platform_subscriptions_admin_all" ON public.platform_subscriptions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Tenant admin puede ver sus propias suscripciones
CREATE POLICY "platform_subscriptions_tenant_select" ON public.platform_subscriptions
  FOR SELECT USING (
    tenant_id IN (
      SELECT t.id FROM public.tenants t WHERE t.owner_user_id = auth.uid()
    )
  );

-- Tenant admin puede crear suscripciones para su tenant
CREATE POLICY "platform_subscriptions_tenant_insert" ON public.platform_subscriptions
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT t.id FROM public.tenants t WHERE t.owner_user_id = auth.uid()
    )
  );


-- ============================================================================
-- 3. TABLA: mp_webhook_events (Eventos de webhook)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.mp_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificadores de MercadoPago
  mp_event_id text NOT NULL,
  mp_event_type text NOT NULL,
  mp_resource_id text,
  mp_resource_type text,
  mp_action text,
  
  -- Estado de procesamiento
  status text NOT NULL DEFAULT 'received' 
    CHECK (status IN ('received', 'processing', 'processed', 'failed', 'ignored', 'duplicate')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  last_error text,
  next_retry_at timestamptz,
  
  -- Payload
  raw_payload jsonb NOT NULL,
  processed_payload jsonb,
  
  -- Validación
  signature text,
  is_valid_signature boolean,
  
  -- Resultado
  result_subscription_id uuid REFERENCES platform_subscriptions(id),
  result_action text,
  
  -- Metadata request
  ip_address text,
  user_agent text,
  
  -- Timestamps
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índice único para idempotencia
CREATE UNIQUE INDEX IF NOT EXISTS idx_mp_webhook_events_idempotent 
  ON public.mp_webhook_events(mp_event_id, mp_resource_id) 
  WHERE mp_resource_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mp_webhook_events_status ON public.mp_webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_mp_webhook_events_created ON public.mp_webhook_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mp_webhook_events_retry ON public.mp_webhook_events(next_retry_at) 
  WHERE status = 'failed' AND attempts < max_attempts;

-- RLS - Solo admin puede ver webhooks
ALTER TABLE public.mp_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mp_webhook_events_admin_all" ON public.mp_webhook_events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Permitir insert desde service role (webhooks)
CREATE POLICY "mp_webhook_events_service_insert" ON public.mp_webhook_events
  FOR INSERT WITH CHECK (true);


-- ============================================================================
-- 4. TABLA: subscription_audit_log (Auditoría)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subscription_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Contexto
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES platform_subscriptions(id) ON DELETE SET NULL,
  
  -- Acción realizada
  action text NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('system', 'user', 'admin', 'webhook', 'cron')),
  
  -- Valores antes/después
  old_value jsonb,
  new_value jsonb,
  
  -- Descripción legible
  description text,
  
  -- Metadata de la request
  ip_address text,
  user_agent text,
  session_id text,
  
  -- Datos adicionales
  metadata jsonb DEFAULT '{}',
  
  -- Timestamp
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para búsqueda
CREATE INDEX IF NOT EXISTS idx_subscription_audit_log_tenant ON public.subscription_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscription_audit_log_user ON public.subscription_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_audit_log_action ON public.subscription_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_subscription_audit_log_action_type ON public.subscription_audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_subscription_audit_log_created ON public.subscription_audit_log(created_at DESC);

-- RLS
ALTER TABLE public.subscription_audit_log ENABLE ROW LEVEL SECURITY;

-- Solo admin puede ver logs
CREATE POLICY "subscription_audit_log_admin_select" ON public.subscription_audit_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Sistema puede insertar (service role)
CREATE POLICY "subscription_audit_log_service_insert" ON public.subscription_audit_log
  FOR INSERT WITH CHECK (true);


-- ============================================================================
-- 5. TABLA: admin_gift_log (Regalos de admin)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_gift_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Quién recibe el regalo
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tenant_name text,
  
  -- Quién otorga el regalo (debe ser super_admin)
  admin_user_id uuid NOT NULL REFERENCES auth.users(id),
  admin_email text NOT NULL,
  
  -- Qué se otorga
  plan_tier text NOT NULL CHECK (plan_tier IN ('premium', 'premium_pro')),
  days_granted integer NOT NULL CHECK (days_granted > 0),
  reason text NOT NULL,
  
  -- Resultado
  subscription_id uuid REFERENCES platform_subscriptions(id),
  new_expires_at timestamptz NOT NULL,
  
  -- Estado anterior
  previous_tier text,
  previous_expires_at timestamptz,
  
  -- Metadata
  ip_address text,
  
  -- Timestamp
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_admin_gift_log_tenant ON public.admin_gift_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_gift_log_admin ON public.admin_gift_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_gift_log_created ON public.admin_gift_log(created_at DESC);

-- RLS
ALTER TABLE public.admin_gift_log ENABLE ROW LEVEL SECURITY;

-- Solo admin puede ver y crear
CREATE POLICY "admin_gift_log_admin_all" ON public.admin_gift_log
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'super_admin')
  );


-- ============================================================================
-- 6. ACTUALIZAR TABLA: tenants (Agregar columnas de suscripción)
-- ============================================================================

-- Agregar columnas si no existen
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'free',
ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS premium_until timestamptz,
ADD COLUMN IF NOT EXISTS auto_renew boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS orders_limit integer DEFAULT 15,
ADD COLUMN IF NOT EXISTS orders_remaining integer DEFAULT 15,
ADD COLUMN IF NOT EXISTS orders_reset_date timestamptz;

-- Constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenants_subscription_tier_check'
  ) THEN
    ALTER TABLE public.tenants
    ADD CONSTRAINT tenants_subscription_tier_check 
    CHECK (subscription_tier IN ('free', 'premium', 'premium_pro'));
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenants_subscription_status_check'
  ) THEN
    ALTER TABLE public.tenants
    ADD CONSTRAINT tenants_subscription_status_check 
    CHECK (subscription_status IN ('active', 'cancelled', 'suspended', 'past_due'));
  END IF;
END;
$$;


-- ============================================================================
-- 7. FUNCIONES DE UTILIDAD
-- ============================================================================

-- Función para obtener días restantes de suscripción
CREATE OR REPLACE FUNCTION public.get_subscription_days_remaining(p_tenant_id uuid)
RETURNS integer AS $$
DECLARE
  v_premium_until timestamptz;
  v_days integer;
BEGIN
  SELECT premium_until INTO v_premium_until
  FROM public.tenants
  WHERE id = p_tenant_id;
  
  IF v_premium_until IS NULL THEN
    RETURN 0;
  END IF;
  
  v_days := EXTRACT(DAY FROM (v_premium_until - now()));
  RETURN GREATEST(v_days, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Función para verificar si tenant tiene plan activo
CREATE OR REPLACE FUNCTION public.is_subscription_active(p_tenant_id uuid)
RETURNS boolean AS $$
DECLARE
  v_tier text;
  v_until timestamptz;
BEGIN
  SELECT subscription_tier, premium_until 
  INTO v_tier, v_until
  FROM public.tenants
  WHERE id = p_tenant_id;
  
  IF v_tier = 'free' THEN
    RETURN true;  -- Free siempre está "activo"
  END IF;
  
  IF v_until IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN v_until > now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Función para expirar suscripciones vencidas
CREATE OR REPLACE FUNCTION public.expire_subscriptions()
RETURNS TABLE(
  tenant_id uuid,
  tenant_name text,
  old_tier text,
  expired_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  WITH expired AS (
    UPDATE public.tenants t
    SET 
      subscription_tier = 'free',
      subscription_status = 'active',
      orders_limit = 15,
      orders_remaining = LEAST(COALESCE(orders_remaining, 15), 15)
    WHERE t.subscription_tier != 'free'
      AND t.premium_until IS NOT NULL
      AND t.premium_until < now()
    RETURNING t.id, t.name, t.subscription_tier as old_tier, now() as expired_at
  )
  SELECT e.id, e.name, e.old_tier, e.expired_at FROM expired e;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Función para regalar suscripción (solo super_admin)
CREATE OR REPLACE FUNCTION public.gift_subscription(
  p_tenant_id uuid,
  p_plan_tier text,
  p_days integer,
  p_reason text,
  p_admin_user_id uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_tenant record;
  v_new_expires timestamptz;
  v_subscription_id uuid;
  v_admin_email text;
  v_result jsonb;
BEGIN
  -- Validar plan
  IF p_plan_tier NOT IN ('premium', 'premium_pro') THEN
    RAISE EXCEPTION 'Plan inválido: %', p_plan_tier;
  END IF;
  
  -- Validar días
  IF p_days <= 0 OR p_days > 365 THEN
    RAISE EXCEPTION 'Días inválidos: % (debe ser 1-365)', p_days;
  END IF;
  
  -- Obtener tenant actual
  SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant no encontrado: %', p_tenant_id;
  END IF;
  
  -- Calcular nueva fecha de expiración
  IF v_tenant.premium_until IS NOT NULL AND v_tenant.premium_until > now() THEN
    v_new_expires := v_tenant.premium_until + (p_days || ' days')::interval;
  ELSE
    v_new_expires := now() + (p_days || ' days')::interval;
  END IF;
  
  -- Obtener email del admin
  SELECT email INTO v_admin_email 
  FROM auth.users 
  WHERE id = COALESCE(p_admin_user_id, auth.uid());
  
  -- Crear registro de suscripción
  INSERT INTO public.platform_subscriptions (
    tenant_id, plan_tier, billing_period, amount, currency,
    status, source, gifted_by, gift_reason,
    starts_at, expires_at, paid_at
  ) VALUES (
    p_tenant_id, p_plan_tier, 'custom', 0, 'USD',
    'approved', 'gift', COALESCE(p_admin_user_id, auth.uid()), p_reason,
    now(), v_new_expires, now()
  )
  RETURNING id INTO v_subscription_id;
  
  -- Actualizar tenant
  UPDATE public.tenants
  SET 
    subscription_tier = p_plan_tier,
    premium_until = v_new_expires,
    subscription_status = 'active',
    orders_limit = CASE WHEN p_plan_tier = 'premium_pro' THEN NULL ELSE 80 END,
    orders_remaining = CASE WHEN p_plan_tier = 'premium_pro' THEN NULL ELSE 80 END
  WHERE id = p_tenant_id;
  
  -- Registrar en log de regalos
  INSERT INTO public.admin_gift_log (
    tenant_id, tenant_name, admin_user_id, admin_email,
    plan_tier, days_granted, reason, subscription_id,
    new_expires_at, previous_tier, previous_expires_at
  ) VALUES (
    p_tenant_id, v_tenant.name, COALESCE(p_admin_user_id, auth.uid()), v_admin_email,
    p_plan_tier, p_days, p_reason, v_subscription_id,
    v_new_expires, v_tenant.subscription_tier, v_tenant.premium_until
  );
  
  -- Registrar auditoría
  INSERT INTO public.subscription_audit_log (
    tenant_id, user_id, subscription_id,
    action, action_type,
    old_value, new_value, description
  ) VALUES (
    p_tenant_id, COALESCE(p_admin_user_id, auth.uid()), v_subscription_id,
    'admin_gift', 'admin',
    jsonb_build_object('tier', v_tenant.subscription_tier, 'expires_at', v_tenant.premium_until),
    jsonb_build_object('tier', p_plan_tier, 'expires_at', v_new_expires, 'days', p_days),
    format('Superadmin otorgó %s días de %s: %s', p_days, p_plan_tier, p_reason)
  );
  
  -- Retornar resultado
  v_result := jsonb_build_object(
    'success', true,
    'subscription_id', v_subscription_id,
    'tenant_id', p_tenant_id,
    'plan_tier', p_plan_tier,
    'days_granted', p_days,
    'new_expires_at', v_new_expires,
    'previous_tier', v_tenant.subscription_tier,
    'previous_expires_at', v_tenant.premium_until
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Función para activar suscripción después de pago
CREATE OR REPLACE FUNCTION public.activate_subscription(
  p_subscription_id uuid,
  p_payment_id text,
  p_payer_email text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_sub record;
  v_expires_at timestamptz;
  v_orders_limit integer;
BEGIN
  -- Obtener suscripción
  SELECT * INTO v_sub 
  FROM public.platform_subscriptions 
  WHERE id = p_subscription_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Suscripción no encontrada: %', p_subscription_id;
  END IF;
  
  IF v_sub.status = 'approved' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Ya activada');
  END IF;
  
  -- Calcular fecha de expiración
  IF v_sub.billing_period = 'yearly' THEN
    v_expires_at := now() + interval '1 year';
  ELSE
    v_expires_at := now() + interval '1 month';
  END IF;
  
  -- Determinar límites
  v_orders_limit := CASE 
    WHEN v_sub.plan_tier = 'premium_pro' THEN NULL 
    WHEN v_sub.plan_tier = 'premium' THEN 80
    ELSE 15 
  END;
  
  -- Actualizar suscripción
  UPDATE public.platform_subscriptions
  SET 
    status = 'approved',
    mp_payment_id = p_payment_id,
    payer_email = COALESCE(p_payer_email, payer_email),
    starts_at = now(),
    expires_at = v_expires_at,
    paid_at = now()
  WHERE id = p_subscription_id;
  
  -- Actualizar tenant
  UPDATE public.tenants
  SET 
    subscription_tier = v_sub.plan_tier,
    premium_until = v_expires_at,
    subscription_status = 'active',
    orders_limit = v_orders_limit,
    orders_remaining = v_orders_limit
  WHERE id = v_sub.tenant_id;
  
  -- Auditoría
  INSERT INTO public.subscription_audit_log (
    tenant_id, subscription_id,
    action, action_type,
    new_value, description
  ) VALUES (
    v_sub.tenant_id, p_subscription_id,
    'subscription_activated', 'webhook',
    jsonb_build_object('plan', v_sub.plan_tier, 'expires_at', v_expires_at, 'payment_id', p_payment_id),
    format('Suscripción %s activada vía pago', v_sub.plan_tier)
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', v_sub.tenant_id,
    'plan_tier', v_sub.plan_tier,
    'expires_at', v_expires_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Función para cancelar suscripción
CREATE OR REPLACE FUNCTION public.cancel_subscription(
  p_tenant_id uuid,
  p_immediate boolean DEFAULT false,
  p_reason text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_tenant record;
BEGIN
  SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant no encontrado';
  END IF;
  
  IF v_tenant.subscription_tier = 'free' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Ya es plan gratuito');
  END IF;
  
  -- Marcar suscripción activa como cancelada
  UPDATE public.platform_subscriptions
  SET 
    status = 'cancelled',
    cancelled_at = now()
  WHERE tenant_id = p_tenant_id
    AND status = 'approved'
    AND (expires_at IS NULL OR expires_at > now());
  
  IF p_immediate THEN
    -- Degradar inmediatamente
    UPDATE public.tenants
    SET 
      subscription_tier = 'free',
      subscription_status = 'cancelled',
      premium_until = now(),
      orders_limit = 15,
      orders_remaining = LEAST(COALESCE(orders_remaining, 15), 15),
      auto_renew = false
    WHERE id = p_tenant_id;
  ELSE
    -- Mantener beneficios hasta vencimiento
    UPDATE public.tenants
    SET 
      subscription_status = 'cancelled',
      auto_renew = false
    WHERE id = p_tenant_id;
  END IF;
  
  -- Auditoría
  INSERT INTO public.subscription_audit_log (
    tenant_id, user_id,
    action, action_type,
    old_value, new_value, description
  ) VALUES (
    p_tenant_id, auth.uid(),
    'subscription_cancelled', 'user',
    jsonb_build_object('tier', v_tenant.subscription_tier, 'premium_until', v_tenant.premium_until),
    jsonb_build_object('immediate', p_immediate, 'reason', p_reason),
    CASE 
      WHEN p_immediate THEN 'Suscripción cancelada inmediatamente'
      ELSE format('Suscripción cancelada, activa hasta %s', v_tenant.premium_until)
    END
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'immediate', p_immediate,
    'active_until', CASE WHEN p_immediate THEN now() ELSE v_tenant.premium_until END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- 8. VISTAS ÚTILES
-- ============================================================================

-- Vista de suscripciones activas con info del tenant
CREATE OR REPLACE VIEW public.v_active_subscriptions AS
SELECT 
  t.id as tenant_id,
  t.name as tenant_name,
  t.slug as tenant_slug,
  t.subscription_tier,
  t.subscription_status,
  t.premium_until,
  t.auto_renew,
  public.get_subscription_days_remaining(t.id) as days_remaining,
  ps.id as latest_subscription_id,
  ps.plan_tier as latest_plan,
  ps.billing_period,
  ps.amount as latest_amount,
  ps.paid_at as latest_paid_at,
  p.email as owner_email
FROM public.tenants t
LEFT JOIN LATERAL (
  SELECT * FROM public.platform_subscriptions ps
  WHERE ps.tenant_id = t.id AND ps.status = 'approved'
  ORDER BY ps.created_at DESC
  LIMIT 1
) ps ON true
LEFT JOIN public.profiles p ON p.user_id = t.owner_user_id
WHERE t.subscription_tier != 'free'
ORDER BY t.premium_until ASC;


-- Vista de log de auditoría con nombres
CREATE OR REPLACE VIEW public.v_subscription_audit AS
SELECT 
  sal.*,
  t.name as tenant_name,
  p.email as user_email
FROM public.subscription_audit_log sal
LEFT JOIN public.tenants t ON t.id = sal.tenant_id
LEFT JOIN public.profiles p ON p.user_id = sal.user_id
ORDER BY sal.created_at DESC;


-- ============================================================================
-- 9. CRON JOBS (requiere pg_cron extension)
-- ============================================================================

-- Nota: Ejecutar solo si pg_cron está habilitado en tu proyecto Supabase

-- Job para expirar suscripciones cada hora
-- SELECT cron.schedule(
--   'expire-subscriptions-hourly',
--   '0 * * * *',
--   $$
--   SELECT public.expire_subscriptions();
--   INSERT INTO public.subscription_audit_log (action, action_type, description)
--   VALUES ('cron_expiration_check', 'cron', 'Verificación automática de expiración');
--   $$
-- );


-- ============================================================================
-- 10. GRANTS PARA SERVICE ROLE
-- ============================================================================

-- Permitir al service role ejecutar funciones de suscripción
GRANT EXECUTE ON FUNCTION public.gift_subscription TO service_role;
GRANT EXECUTE ON FUNCTION public.activate_subscription TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_subscription TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_subscriptions TO service_role;
GRANT EXECUTE ON FUNCTION public.get_subscription_days_remaining TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_subscription_active TO authenticated;


-- ============================================================================
-- FIN DE LA MIGRACIÓN
-- ============================================================================

-- Verificar tablas creadas
DO $$
BEGIN
  RAISE NOTICE '✅ Migración completada exitosamente';
  RAISE NOTICE 'Tablas creadas/actualizadas:';
  RAISE NOTICE '  - subscription_plans';
  RAISE NOTICE '  - platform_subscriptions';
  RAISE NOTICE '  - mp_webhook_events';
  RAISE NOTICE '  - subscription_audit_log';
  RAISE NOTICE '  - admin_gift_log';
  RAISE NOTICE 'Funciones creadas:';
  RAISE NOTICE '  - gift_subscription()';
  RAISE NOTICE '  - activate_subscription()';
  RAISE NOTICE '  - cancel_subscription()';
  RAISE NOTICE '  - expire_subscriptions()';
END;
$$;
