-- ============================================================================
-- SISTEMA DE REFERIDOS - Migración Completa
-- ============================================================================
-- Este sistema implementa:
-- 1. Códigos de referido únicos por tenant/usuario
-- 2. Tracking de usos y conversiones
-- 3. Sistema de recompensas acumulables
-- 4. Antifraude multicapa
-- 5. Auditoría completa
-- ============================================================================

-- ============================================================================
-- 1. CONFIGURACIÓN GLOBAL DE REFERIDOS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.referral_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Umbrales de recompensa
  tier_1_referrals INTEGER NOT NULL DEFAULT 5,        -- Primer umbral
  tier_1_reward_months INTEGER NOT NULL DEFAULT 1,    -- Meses gratis
  tier_1_reward_plan TEXT NOT NULL DEFAULT 'premium', -- Plan de recompensa
  
  tier_2_referrals INTEGER NOT NULL DEFAULT 10,       -- Segundo umbral (5+5)
  tier_2_reward_months INTEGER NOT NULL DEFAULT 1,    -- Mes adicional
  tier_2_reward_plan TEXT NOT NULL DEFAULT 'premium',
  
  tier_3_referrals INTEGER NOT NULL DEFAULT 30,       -- Umbral especial
  tier_3_reward_months INTEGER NOT NULL DEFAULT 4,    -- 4 meses Premium Pro
  tier_3_reward_plan TEXT NOT NULL DEFAULT 'premium_pro',
  
  -- Límites antifraude
  max_referrals_per_user_per_month INTEGER NOT NULL DEFAULT 100,
  max_conversions_per_ip_per_day INTEGER NOT NULL DEFAULT 5,
  max_accounts_per_device INTEGER NOT NULL DEFAULT 3,
  
  -- Vencimiento de créditos
  credit_expiration_days INTEGER NOT NULL DEFAULT 365,
  
  -- Estado
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insertar configuración por defecto
INSERT INTO public.referral_config (id) 
VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 2. CÓDIGOS DE REFERIDO
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Propietario del código
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Código único (ejemplo: REST-ABC123)
  code TEXT NOT NULL UNIQUE,
  
  -- Estadísticas cacheadas (para performance)
  total_uses INTEGER NOT NULL DEFAULT 0,
  total_conversions INTEGER NOT NULL DEFAULT 0,
  total_pending INTEGER NOT NULL DEFAULT 0,
  total_rejected INTEGER NOT NULL DEFAULT 0,
  
  -- Estado
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Índices
  CONSTRAINT referral_codes_owner_unique UNIQUE (tenant_id, owner_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON public.referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_codes_tenant ON public.referral_codes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_owner ON public.referral_codes(owner_user_id);

-- ============================================================================
-- 3. REGISTRO DE USOS DE REFERIDOS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.referral_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relación con el código
  referral_code_id UUID NOT NULL REFERENCES public.referral_codes(id) ON DELETE RESTRICT,
  referrer_tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  
  -- Usuario referido
  referred_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  referred_tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  referred_email TEXT NOT NULL,
  
  -- Estado del referido
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',       -- Registrado pero no pagó
    'converted',     -- Pagó y fue validado
    'rejected',      -- Fraude, auto-referido o abuso
    'manual_review'  -- Sospechoso, requiere revisión
  )),
  
  -- Información del pago que convirtió
  conversion_payment_id TEXT,
  conversion_amount DECIMAL(12,2),
  conversion_currency TEXT DEFAULT 'ARS',
  conversion_plan TEXT,
  converted_at TIMESTAMPTZ,
  
  -- Información antifraude
  registration_ip TEXT,
  registration_user_agent TEXT,
  registration_device_fingerprint TEXT,
  conversion_ip TEXT,
  conversion_user_agent TEXT,
  
  -- Metadatos
  rejection_reason TEXT,
  review_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Evitar duplicados: un usuario solo puede ser referido UNA vez
  CONSTRAINT referral_uses_referred_unique UNIQUE (referred_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referral_uses_code ON public.referral_uses(referral_code_id);
CREATE INDEX IF NOT EXISTS idx_referral_uses_referrer ON public.referral_uses(referrer_tenant_id);
CREATE INDEX IF NOT EXISTS idx_referral_uses_referred ON public.referral_uses(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_uses_status ON public.referral_uses(status);
CREATE INDEX IF NOT EXISTS idx_referral_uses_created ON public.referral_uses(created_at);
CREATE INDEX IF NOT EXISTS idx_referral_uses_ip ON public.referral_uses(registration_ip);
CREATE INDEX IF NOT EXISTS idx_referral_uses_device ON public.referral_uses(registration_device_fingerprint);

-- ============================================================================
-- 4. RECOMPENSAS DE REFERIDOS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Beneficiario
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  
  -- Tipo de recompensa
  reward_type TEXT NOT NULL CHECK (reward_type IN (
    'tier_1',     -- 5 referidos = 1 mes premium
    'tier_2',     -- 10 referidos = 1 mes adicional
    'tier_3',     -- 30 referidos = 4 meses premium pro
    'bonus',      -- Bonus especial (promo, etc)
    'manual'      -- Asignado manualmente por admin
  )),
  
  -- Detalles de la recompensa
  reward_plan TEXT NOT NULL DEFAULT 'premium',
  reward_months INTEGER NOT NULL DEFAULT 1,
  reward_days INTEGER NOT NULL DEFAULT 0,
  
  -- Descripción
  description TEXT,
  
  -- Estado
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',    -- Pendiente de aplicar
    'applied',    -- Aplicado a la suscripción
    'expired',    -- Venció sin usarse
    'revoked'     -- Revocado por admin (fraude)
  )),
  
  -- Información de aplicación
  applied_at TIMESTAMPTZ,
  applied_to_subscription_id UUID,
  subscription_extended_until TIMESTAMPTZ,
  
  -- Vencimiento de créditos
  expires_at TIMESTAMPTZ,
  
  -- Revocación
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id),
  revocation_reason TEXT,
  
  -- Referido que generó esta recompensa (el que completó el umbral)
  triggered_by_referral_use_id UUID REFERENCES public.referral_uses(id),
  referral_count_at_trigger INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_tenant ON public.referral_rewards(tenant_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_user ON public.referral_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_status ON public.referral_rewards(status);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_expires ON public.referral_rewards(expires_at);

-- ============================================================================
-- 5. FLAGS DE FRAUDE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.referral_fraud_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Usuario afectado
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  referral_use_id UUID REFERENCES public.referral_uses(id) ON DELETE SET NULL,
  
  -- Tipo de flag
  flag_type TEXT NOT NULL CHECK (flag_type IN (
    'self_referral',           -- Auto-referido
    'duplicate_ip',            -- IP duplicada sospechosa
    'duplicate_device',        -- Mismo dispositivo
    'duplicate_payment_method', -- Mismo método de pago
    'velocity_abuse',          -- Demasiados referidos muy rápido
    'pattern_abuse',           -- Patrón sospechoso
    'chargeback',              -- Chargeback en pago
    'manual_flag'              -- Marcado por admin
  )),
  
  -- Severidad
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  
  -- Detalles
  description TEXT,
  evidence JSONB,
  
  -- Resolución
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT,
  resolution_action TEXT CHECK (resolution_action IN (
    'dismissed',    -- Falso positivo
    'confirmed',    -- Fraude confirmado
    'warning',      -- Advertencia, sin acción
    'blocked'       -- Usuario bloqueado
  )),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fraud_flags_user ON public.referral_fraud_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_flags_tenant ON public.referral_fraud_flags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fraud_flags_type ON public.referral_fraud_flags(flag_type);
CREATE INDEX IF NOT EXISTS idx_fraud_flags_unresolved ON public.referral_fraud_flags(is_resolved) WHERE is_resolved = false;

-- ============================================================================
-- 6. AUDITORÍA DE REFERIDOS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.referral_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Entidad afectada
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'referral_code',
    'referral_use',
    'referral_reward',
    'fraud_flag',
    'config'
  )),
  entity_id UUID,
  
  -- Usuario y tenant
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  
  -- Acción
  action TEXT NOT NULL CHECK (action IN (
    -- Códigos
    'code_created',
    'code_deactivated',
    'code_reactivated',
    
    -- Usos
    'referral_registered',
    'referral_converted',
    'referral_rejected',
    'referral_marked_review',
    
    -- Recompensas
    'reward_created',
    'reward_applied',
    'reward_expired',
    'reward_revoked',
    
    -- Fraude
    'fraud_detected',
    'fraud_resolved',
    
    -- Config
    'config_updated',
    
    -- Admin
    'admin_manual_action'
  )),
  
  -- Detalles
  description TEXT,
  old_value JSONB,
  new_value JSONB,
  metadata JSONB,
  
  -- Info de request
  ip_address TEXT,
  user_agent TEXT,
  
  -- Actor
  performed_by UUID REFERENCES auth.users(id),
  performed_by_role TEXT,
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.referral_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON public.referral_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON public.referral_audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.referral_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.referral_audit_logs(created_at);

-- ============================================================================
-- 7. FUNCIONES AUXILIARES
-- ============================================================================

-- Generar código de referido único
CREATE OR REPLACE FUNCTION public.generate_referral_code(p_prefix TEXT DEFAULT 'REF')
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    -- Generar código: PREFIX-XXXXXX (6 caracteres alfanuméricos)
    v_code := p_prefix || '-' || upper(substr(md5(random()::text), 1, 6));
    
    -- Verificar que no existe
    SELECT EXISTS(SELECT 1 FROM public.referral_codes WHERE code = v_code) INTO v_exists;
    
    EXIT WHEN NOT v_exists;
  END LOOP;
  
  RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- Obtener o crear código de referido para un tenant
CREATE OR REPLACE FUNCTION public.get_or_create_referral_code(
  p_tenant_id UUID,
  p_user_id UUID
)
RETURNS TABLE (
  code_id UUID,
  code TEXT,
  is_new BOOLEAN
) AS $$
DECLARE
  v_existing RECORD;
  v_new_code TEXT;
  v_new_id UUID;
BEGIN
  -- Buscar código existente
  SELECT rc.id, rc.code INTO v_existing
  FROM public.referral_codes rc
  WHERE rc.tenant_id = p_tenant_id AND rc.owner_user_id = p_user_id;
  
  IF FOUND THEN
    RETURN QUERY SELECT v_existing.id, v_existing.code, false;
    RETURN;
  END IF;
  
  -- Crear nuevo código
  v_new_code := public.generate_referral_code('REST');
  v_new_id := gen_random_uuid();
  
  INSERT INTO public.referral_codes (id, tenant_id, owner_user_id, code)
  VALUES (v_new_id, p_tenant_id, p_user_id, v_new_code);
  
  -- Log de auditoría
  INSERT INTO public.referral_audit_logs (
    entity_type, entity_id, user_id, tenant_id, action, description, performed_by
  ) VALUES (
    'referral_code', v_new_id, p_user_id, p_tenant_id, 
    'code_created', 'Código de referido creado: ' || v_new_code, p_user_id
  );
  
  RETURN QUERY SELECT v_new_id, v_new_code, true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Registrar uso de código de referido
CREATE OR REPLACE FUNCTION public.register_referral_use(
  p_code TEXT,
  p_referred_user_id UUID,
  p_referred_email TEXT,
  p_ip TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_device_fingerprint TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  referral_use_id UUID
) AS $$
DECLARE
  v_code_record RECORD;
  v_existing_use RECORD;
  v_config RECORD;
  v_use_id UUID;
  v_ip_count INTEGER;
  v_device_count INTEGER;
BEGIN
  -- Obtener configuración
  SELECT * INTO v_config FROM public.referral_config LIMIT 1;
  
  IF NOT v_config.is_active THEN
    RETURN QUERY SELECT false, 'Sistema de referidos desactivado', NULL::UUID;
    RETURN;
  END IF;
  
  -- Buscar código
  SELECT * INTO v_code_record
  FROM public.referral_codes
  WHERE code = upper(p_code) AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Código de referido inválido', NULL::UUID;
    RETURN;
  END IF;
  
  -- Verificar auto-referido
  IF v_code_record.owner_user_id = p_referred_user_id THEN
    -- Crear flag de fraude
    INSERT INTO public.referral_fraud_flags (
      user_id, flag_type, severity, description
    ) VALUES (
      p_referred_user_id, 'self_referral', 'high', 'Intento de auto-referido'
    );
    
    RETURN QUERY SELECT false, 'No puedes usar tu propio código de referido', NULL::UUID;
    RETURN;
  END IF;
  
  -- Verificar si ya fue referido
  SELECT * INTO v_existing_use
  FROM public.referral_uses
  WHERE referred_user_id = p_referred_user_id;
  
  IF FOUND THEN
    RETURN QUERY SELECT false, 'Este usuario ya fue referido anteriormente', NULL::UUID;
    RETURN;
  END IF;
  
  -- Verificar límites de IP
  IF p_ip IS NOT NULL THEN
    SELECT COUNT(*) INTO v_ip_count
    FROM public.referral_uses
    WHERE registration_ip = p_ip
      AND created_at > now() - interval '1 day';
    
    IF v_ip_count >= v_config.max_conversions_per_ip_per_day THEN
      INSERT INTO public.referral_fraud_flags (
        user_id, flag_type, severity, description, evidence
      ) VALUES (
        p_referred_user_id, 'duplicate_ip', 'medium', 
        'Demasiados registros desde la misma IP',
        jsonb_build_object('ip', p_ip, 'count', v_ip_count)
      );
      
      RETURN QUERY SELECT false, 'Límite de registros excedido', NULL::UUID;
      RETURN;
    END IF;
  END IF;
  
  -- Verificar límites de dispositivo
  IF p_device_fingerprint IS NOT NULL THEN
    SELECT COUNT(*) INTO v_device_count
    FROM public.referral_uses
    WHERE registration_device_fingerprint = p_device_fingerprint;
    
    IF v_device_count >= v_config.max_accounts_per_device THEN
      INSERT INTO public.referral_fraud_flags (
        user_id, flag_type, severity, description, evidence
      ) VALUES (
        p_referred_user_id, 'duplicate_device', 'high', 
        'Demasiadas cuentas desde el mismo dispositivo',
        jsonb_build_object('device', p_device_fingerprint, 'count', v_device_count)
      );
      
      RETURN QUERY SELECT false, 'Límite de cuentas por dispositivo excedido', NULL::UUID;
      RETURN;
    END IF;
  END IF;
  
  -- Crear uso de referido
  v_use_id := gen_random_uuid();
  
  INSERT INTO public.referral_uses (
    id, referral_code_id, referrer_tenant_id, referrer_user_id,
    referred_user_id, referred_email, status,
    registration_ip, registration_user_agent, registration_device_fingerprint
  ) VALUES (
    v_use_id, v_code_record.id, v_code_record.tenant_id, v_code_record.owner_user_id,
    p_referred_user_id, p_referred_email, 'pending',
    p_ip, p_user_agent, p_device_fingerprint
  );
  
  -- Actualizar contador del código
  UPDATE public.referral_codes
  SET total_uses = total_uses + 1, total_pending = total_pending + 1, updated_at = now()
  WHERE id = v_code_record.id;
  
  -- Log de auditoría
  INSERT INTO public.referral_audit_logs (
    entity_type, entity_id, user_id, tenant_id, action, 
    description, metadata, ip_address, user_agent
  ) VALUES (
    'referral_use', v_use_id, p_referred_user_id, v_code_record.tenant_id,
    'referral_registered', 'Nuevo referido registrado',
    jsonb_build_object('code', p_code, 'referrer', v_code_record.owner_user_id),
    p_ip, p_user_agent
  );
  
  RETURN QUERY SELECT true, 'Referido registrado exitosamente', v_use_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Convertir referido después de pago exitoso
CREATE OR REPLACE FUNCTION public.convert_referral(
  p_referred_user_id UUID,
  p_payment_id TEXT,
  p_amount DECIMAL,
  p_currency TEXT DEFAULT 'ARS',
  p_plan TEXT DEFAULT 'premium',
  p_ip TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  reward_created BOOLEAN,
  reward_type TEXT,
  new_total_conversions INTEGER
) AS $$
DECLARE
  v_use_record RECORD;
  v_code_record RECORD;
  v_config RECORD;
  v_total_conversions INTEGER;
  v_reward_created BOOLEAN := false;
  v_reward_type TEXT := NULL;
  v_reward_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Obtener configuración
  SELECT * INTO v_config FROM public.referral_config LIMIT 1;
  
  -- Buscar uso pendiente
  SELECT * INTO v_use_record
  FROM public.referral_uses
  WHERE referred_user_id = p_referred_user_id
    AND status = 'pending'
  FOR UPDATE;
  
  IF NOT FOUND THEN
    -- Verificar si ya fue convertido
    SELECT status INTO v_use_record
    FROM public.referral_uses
    WHERE referred_user_id = p_referred_user_id;
    
    IF v_use_record.status = 'converted' THEN
      RETURN QUERY SELECT false, 'Este referido ya fue convertido', false, NULL::TEXT, 0;
    ELSE
      RETURN QUERY SELECT false, 'No hay referido pendiente para este usuario', false, NULL::TEXT, 0;
    END IF;
    RETURN;
  END IF;
  
  -- Actualizar uso como convertido
  UPDATE public.referral_uses
  SET 
    status = 'converted',
    conversion_payment_id = p_payment_id,
    conversion_amount = p_amount,
    conversion_currency = p_currency,
    conversion_plan = p_plan,
    converted_at = now(),
    conversion_ip = p_ip,
    conversion_user_agent = p_user_agent,
    updated_at = now()
  WHERE id = v_use_record.id;
  
  -- Actualizar contadores del código
  UPDATE public.referral_codes
  SET 
    total_conversions = total_conversions + 1,
    total_pending = total_pending - 1,
    updated_at = now()
  WHERE id = v_use_record.referral_code_id
  RETURNING total_conversions INTO v_total_conversions;
  
  -- Verificar si se alcanzó un umbral de recompensa
  v_expires_at := now() + (v_config.credit_expiration_days || ' days')::interval;
  
  -- Tier 3: 30 referidos = 4 meses Premium Pro
  IF v_total_conversions = v_config.tier_3_referrals THEN
    v_reward_id := gen_random_uuid();
    v_reward_type := 'tier_3';
    
    INSERT INTO public.referral_rewards (
      id, tenant_id, user_id, reward_type, reward_plan, reward_months,
      description, expires_at, triggered_by_referral_use_id, referral_count_at_trigger
    ) VALUES (
      v_reward_id, v_use_record.referrer_tenant_id, v_use_record.referrer_user_id,
      'tier_3', v_config.tier_3_reward_plan, v_config.tier_3_reward_months,
      '¡Felicidades! Alcanzaste ' || v_config.tier_3_referrals || ' referidos. ' ||
      v_config.tier_3_reward_months || ' meses de ' || v_config.tier_3_reward_plan || ' gratis.',
      v_expires_at, v_use_record.id, v_total_conversions
    );
    
    v_reward_created := true;
    
  -- Tier 2: 10 referidos = 1 mes adicional
  ELSIF v_total_conversions = v_config.tier_2_referrals THEN
    v_reward_id := gen_random_uuid();
    v_reward_type := 'tier_2';
    
    INSERT INTO public.referral_rewards (
      id, tenant_id, user_id, reward_type, reward_plan, reward_months,
      description, expires_at, triggered_by_referral_use_id, referral_count_at_trigger
    ) VALUES (
      v_reward_id, v_use_record.referrer_tenant_id, v_use_record.referrer_user_id,
      'tier_2', v_config.tier_2_reward_plan, v_config.tier_2_reward_months,
      '¡Increíble! Alcanzaste ' || v_config.tier_2_referrals || ' referidos. ' ||
      v_config.tier_2_reward_months || ' mes adicional de ' || v_config.tier_2_reward_plan || ' gratis.',
      v_expires_at, v_use_record.id, v_total_conversions
    );
    
    v_reward_created := true;
    
  -- Tier 1: Cada 5 referidos = 1 mes
  ELSIF v_total_conversions % v_config.tier_1_referrals = 0 THEN
    v_reward_id := gen_random_uuid();
    v_reward_type := 'tier_1';
    
    INSERT INTO public.referral_rewards (
      id, tenant_id, user_id, reward_type, reward_plan, reward_months,
      description, expires_at, triggered_by_referral_use_id, referral_count_at_trigger
    ) VALUES (
      v_reward_id, v_use_record.referrer_tenant_id, v_use_record.referrer_user_id,
      'tier_1', v_config.tier_1_reward_plan, v_config.tier_1_reward_months,
      'Alcanzaste ' || v_total_conversions || ' referidos. ' ||
      v_config.tier_1_reward_months || ' mes de ' || v_config.tier_1_reward_plan || ' gratis.',
      v_expires_at, v_use_record.id, v_total_conversions
    );
    
    v_reward_created := true;
  END IF;
  
  -- Log de auditoría
  INSERT INTO public.referral_audit_logs (
    entity_type, entity_id, user_id, tenant_id, action,
    description, metadata, ip_address, user_agent
  ) VALUES (
    'referral_use', v_use_record.id, p_referred_user_id, v_use_record.referrer_tenant_id,
    'referral_converted', 'Referido convertido con pago ' || p_payment_id,
    jsonb_build_object(
      'payment_id', p_payment_id, 
      'amount', p_amount, 
      'plan', p_plan,
      'total_conversions', v_total_conversions,
      'reward_created', v_reward_created,
      'reward_type', v_reward_type
    ),
    p_ip, p_user_agent
  );
  
  -- Log de recompensa si se creó
  IF v_reward_created THEN
    INSERT INTO public.referral_audit_logs (
      entity_type, entity_id, user_id, tenant_id, action,
      description, metadata
    ) VALUES (
      'referral_reward', v_reward_id, v_use_record.referrer_user_id, v_use_record.referrer_tenant_id,
      'reward_created', 'Nueva recompensa: ' || v_reward_type,
      jsonb_build_object('reward_type', v_reward_type, 'conversions', v_total_conversions)
    );
  END IF;
  
  RETURN QUERY SELECT true, 'Referido convertido exitosamente', v_reward_created, v_reward_type, v_total_conversions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar recompensa a suscripción
CREATE OR REPLACE FUNCTION public.apply_referral_reward(
  p_reward_id UUID,
  p_applied_by UUID DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  new_premium_until TIMESTAMPTZ
) AS $$
DECLARE
  v_reward RECORD;
  v_tenant RECORD;
  v_new_premium_until TIMESTAMPTZ;
BEGIN
  -- Obtener recompensa con lock
  SELECT * INTO v_reward
  FROM public.referral_rewards
  WHERE id = p_reward_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Recompensa no encontrada', NULL::TIMESTAMPTZ;
    RETURN;
  END IF;
  
  IF v_reward.status != 'pending' THEN
    RETURN QUERY SELECT false, 'Esta recompensa ya fue ' || v_reward.status, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;
  
  IF v_reward.expires_at < now() THEN
    UPDATE public.referral_rewards
    SET status = 'expired', updated_at = now()
    WHERE id = p_reward_id;
    
    RETURN QUERY SELECT false, 'Esta recompensa ha expirado', NULL::TIMESTAMPTZ;
    RETURN;
  END IF;
  
  -- Obtener tenant actual
  SELECT * INTO v_tenant
  FROM public.tenants
  WHERE id = v_reward.tenant_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Tenant no encontrado', NULL::TIMESTAMPTZ;
    RETURN;
  END IF;
  
  -- Calcular nueva fecha de expiración
  -- Si tiene suscripción activa, sumar desde el final actual
  -- Si no tiene o expiró, sumar desde ahora
  IF v_tenant.premium_until IS NOT NULL AND v_tenant.premium_until > now() THEN
    v_new_premium_until := v_tenant.premium_until + 
      (v_reward.reward_months || ' months')::interval + 
      (v_reward.reward_days || ' days')::interval;
  ELSE
    v_new_premium_until := now() + 
      (v_reward.reward_months || ' months')::interval + 
      (v_reward.reward_days || ' days')::interval;
  END IF;
  
  -- Actualizar tenant
  UPDATE public.tenants
  SET 
    subscription_tier = CASE 
      WHEN v_reward.reward_plan = 'premium_pro' THEN 'premium_pro'
      WHEN v_reward.reward_plan = 'premium' AND subscription_tier = 'free' THEN 'premium'
      ELSE subscription_tier  -- Mantener si ya es igual o superior
    END,
    premium_until = v_new_premium_until,
    updated_at = now()
  WHERE id = v_reward.tenant_id;
  
  -- Marcar recompensa como aplicada
  UPDATE public.referral_rewards
  SET 
    status = 'applied',
    applied_at = now(),
    subscription_extended_until = v_new_premium_until,
    updated_at = now()
  WHERE id = p_reward_id;
  
  -- Log de auditoría
  INSERT INTO public.referral_audit_logs (
    entity_type, entity_id, user_id, tenant_id, action,
    description, old_value, new_value, performed_by
  ) VALUES (
    'referral_reward', p_reward_id, v_reward.user_id, v_reward.tenant_id,
    'reward_applied', 
    'Recompensa aplicada: ' || v_reward.reward_months || ' meses de ' || v_reward.reward_plan,
    jsonb_build_object('old_premium_until', v_tenant.premium_until),
    jsonb_build_object('new_premium_until', v_new_premium_until),
    COALESCE(p_applied_by, v_reward.user_id)
  );
  
  RETURN QUERY SELECT true, 'Recompensa aplicada exitosamente', v_new_premium_until;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revocar recompensa (admin)
CREATE OR REPLACE FUNCTION public.revoke_referral_reward(
  p_reward_id UUID,
  p_revoked_by UUID,
  p_reason TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_reward RECORD;
BEGIN
  SELECT * INTO v_reward
  FROM public.referral_rewards
  WHERE id = p_reward_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Recompensa no encontrada';
    RETURN;
  END IF;
  
  IF v_reward.status = 'revoked' THEN
    RETURN QUERY SELECT false, 'Esta recompensa ya fue revocada';
    RETURN;
  END IF;
  
  UPDATE public.referral_rewards
  SET 
    status = 'revoked',
    revoked_at = now(),
    revoked_by = p_revoked_by,
    revocation_reason = p_reason,
    updated_at = now()
  WHERE id = p_reward_id;
  
  -- Log de auditoría
  INSERT INTO public.referral_audit_logs (
    entity_type, entity_id, user_id, tenant_id, action,
    description, metadata, performed_by
  ) VALUES (
    'referral_reward', p_reward_id, v_reward.user_id, v_reward.tenant_id,
    'reward_revoked', 'Recompensa revocada: ' || p_reason,
    jsonb_build_object('reason', p_reason, 'previous_status', v_reward.status),
    p_revoked_by
  );
  
  RETURN QUERY SELECT true, 'Recompensa revocada exitosamente';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Obtener estadísticas de referidos de un tenant
CREATE OR REPLACE FUNCTION public.get_referral_stats(p_tenant_id UUID)
RETURNS TABLE (
  total_referrals INTEGER,
  pending_referrals INTEGER,
  converted_referrals INTEGER,
  rejected_referrals INTEGER,
  pending_rewards INTEGER,
  applied_rewards INTEGER,
  total_reward_months INTEGER,
  next_reward_at INTEGER,
  referral_code TEXT
) AS $$
DECLARE
  v_code RECORD;
  v_next_reward INTEGER;
  v_config RECORD;
BEGIN
  SELECT * INTO v_config FROM public.referral_config LIMIT 1;
  
  SELECT * INTO v_code
  FROM public.referral_codes
  WHERE tenant_id = p_tenant_id
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      0, 0, 0, 0, 0, 0, 0,
      v_config.tier_1_referrals,
      NULL::TEXT;
    RETURN;
  END IF;
  
  -- Calcular cuántos faltan para la próxima recompensa
  v_next_reward := v_config.tier_1_referrals - (v_code.total_conversions % v_config.tier_1_referrals);
  IF v_next_reward = v_config.tier_1_referrals AND v_code.total_conversions > 0 THEN
    v_next_reward := 0;
  END IF;
  
  RETURN QUERY
  SELECT 
    v_code.total_uses,
    v_code.total_pending,
    v_code.total_conversions,
    v_code.total_rejected,
    (SELECT COUNT(*)::INTEGER FROM public.referral_rewards WHERE tenant_id = p_tenant_id AND status = 'pending'),
    (SELECT COUNT(*)::INTEGER FROM public.referral_rewards WHERE tenant_id = p_tenant_id AND status = 'applied'),
    (SELECT COALESCE(SUM(reward_months), 0)::INTEGER FROM public.referral_rewards WHERE tenant_id = p_tenant_id AND status IN ('pending', 'applied')),
    v_next_reward,
    v_code.code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. RLS (Row Level Security)
-- ============================================================================

ALTER TABLE public.referral_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_uses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_fraud_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_audit_logs ENABLE ROW LEVEL SECURITY;

-- Config: solo super_admin puede modificar, todos pueden leer
CREATE POLICY "Config read by all" ON public.referral_config
  FOR SELECT USING (true);

CREATE POLICY "Config modify by super_admin" ON public.referral_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Codes: usuarios ven sus propios códigos
CREATE POLICY "Codes read own" ON public.referral_codes
  FOR SELECT USING (
    owner_user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Codes insert own" ON public.referral_codes
  FOR INSERT WITH CHECK (owner_user_id = auth.uid());

-- Uses: referrers ven sus usos, referidos ven su propio registro
CREATE POLICY "Uses read own" ON public.referral_uses
  FOR SELECT USING (
    referrer_user_id = auth.uid() OR
    referred_user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Rewards: usuarios ven sus recompensas
CREATE POLICY "Rewards read own" ON public.referral_rewards
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Fraud flags: solo super_admin
CREATE POLICY "Fraud flags super_admin only" ON public.referral_fraud_flags
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Audit logs: usuarios ven logs relacionados a ellos
CREATE POLICY "Audit read own" ON public.referral_audit_logs
  FOR SELECT USING (
    user_id = auth.uid() OR
    tenant_id IN (SELECT id FROM public.tenants WHERE owner_user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- ============================================================================
-- 9. TRIGGERS PARA ACTUALIZAR TIMESTAMPS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_referral_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_referral_config_timestamp
  BEFORE UPDATE ON public.referral_config
  FOR EACH ROW EXECUTE FUNCTION public.update_referral_updated_at();

CREATE TRIGGER update_referral_codes_timestamp
  BEFORE UPDATE ON public.referral_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_referral_updated_at();

CREATE TRIGGER update_referral_uses_timestamp
  BEFORE UPDATE ON public.referral_uses
  FOR EACH ROW EXECUTE FUNCTION public.update_referral_updated_at();

CREATE TRIGGER update_referral_rewards_timestamp
  BEFORE UPDATE ON public.referral_rewards
  FOR EACH ROW EXECUTE FUNCTION public.update_referral_updated_at();

CREATE TRIGGER update_referral_fraud_flags_timestamp
  BEFORE UPDATE ON public.referral_fraud_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_referral_updated_at();

-- ============================================================================
-- 10. CRON JOB PARA EXPIRAR CRÉDITOS (ejecutar con pg_cron)
-- ============================================================================
-- SELECT cron.schedule('expire-referral-credits', '0 0 * * *', $$
--   UPDATE public.referral_rewards 
--   SET status = 'expired', updated_at = now()
--   WHERE status = 'pending' AND expires_at < now();
-- $$);
