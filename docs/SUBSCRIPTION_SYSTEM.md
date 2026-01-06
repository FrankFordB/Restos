# 🎯 Sistema de Suscripciones con MercadoPago

## Índice
1. [Visión General](#visión-general)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Planes de Suscripción](#planes-de-suscripción)
4. [Diagrama de Estados](#diagrama-de-estados)
5. [Base de Datos](#base-de-datos)
6. [Integración MercadoPago](#integración-mercadopago)
7. [Webhooks](#webhooks)
8. [Seguridad](#seguridad)
9. [Endpoints API](#endpoints-api)
10. [Sistema de Auditoría](#sistema-de-auditoría)
11. [Tareas Programadas](#tareas-programadas)
12. [Manejo de Errores](#manejo-de-errores)
13. [Panel de Usuario](#panel-de-usuario)
14. [Panel de Superadmin](#panel-de-superadmin)

---

## Visión General

### Objetivo
Sistema de suscripciones automatizado donde los usuarios pueden:
- Suscribirse a planes pagos (PREMIUM, PREMIUM PRO)
- Gestionar su suscripción (cancelar, renovar, cambiar plan)
- El sistema maneja automáticamente vencimientos, downgrades y renovaciones

### Principios
- **100% Automatizado**: Sin intervención manual para altas, bajas y renovaciones
- **Seguro**: Credenciales encriptadas, validación de webhooks, RLS en BD
- **Auditable**: Log completo de todas las acciones
- **Resiliente**: Manejo de errores, reintentos, idempotencia

---

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  PremiumModal         SubscriptionPanel       AdminSubscriptionsPage         │
│  (Selección plan)     (Usuario ve su plan)    (Super admin gestiona)         │
└───────────┬─────────────────────┬─────────────────────┬─────────────────────┘
            │                     │                     │
            ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          API LAYER (Supabase)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  supabaseMercadopagoApi.js    supabaseSubscriptionApi.js                     │
│  mercadopago.js               supabaseAuditApi.js                            │
└───────────┬─────────────────────┬─────────────────────┬─────────────────────┘
            │                     │                     │
            ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DATABASE (Supabase/PostgreSQL)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  tenants                  platform_subscriptions      subscription_audit_log │
│  subscription_plans       mp_webhook_events           admin_gift_log         │
└─────────────────────────────────────────────────────────────────────────────┘
            │                                           ▲
            ▼                                           │
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MERCADOPAGO API                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Checkout Pro      Webhooks IPN      Payment API                             │
│  (Preferencias)    (Notificaciones)  (Consultas)                             │
└─────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CRON JOBS (Supabase Edge Functions)                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  check_expirations      send_reminders      process_auto_renew               │
│  (Cada hora)            (Diario 9am)        (Cuando expira)                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Planes de Suscripción

### FREE (Gratis)
| Característica | Valor |
|----------------|-------|
| Pedidos/día | 15 |
| Widgets | Básicos (Hero, Grid, Texto) |
| Layouts de cards | 1 (Clásico) |
| Soporte | Comunidad |
| Precio | $0 |

### PREMIUM ⭐
| Característica | Valor |
|----------------|-------|
| Pedidos/día | 80 |
| Widgets | +5 (Carrusel, Galería, Mapa, Banner, Categorías) |
| Layouts de cards | +3 (Horizontal, Overlay, Compacto) |
| Estilos | +2 (Contorno, Elevado) |
| Soporte | Prioritario |
| Precio Mensual | $9.99 USD |
| Precio Anual | $99 USD (17% descuento) |

### PREMIUM PRO 👑
| Característica | Valor |
|----------------|-------|
| Pedidos/día | Ilimitado |
| Widgets | +6 (Testimonios, Video, Newsletter, FAQ, Team, Stats) |
| Layouts de cards | +4 (Magazine, Minimal, Polaroid, Banner) |
| Estilos | +1 (Minimalista) |
| Page Builder | Completo |
| Templates | Premium |
| Soporte | VIP 24/7 |
| Precio Mensual | $19.99 USD |
| Precio Anual | $199 USD (17% descuento) |

---

## Diagrama de Estados

### Estados de Suscripción

```
                                    ┌──────────────┐
                                    │              │
                       ┌───────────▶│     FREE     │◀────────────────┐
                       │            │              │                 │
                       │            └──────┬───────┘                 │
                       │                   │                         │
                       │                   │ Usuario compra plan     │
                       │                   ▼                         │
                       │            ┌──────────────┐                 │
         Pago          │            │              │                 │
         rechazado     │            │   PENDING    │                 │ Suscripción
         o cancelado   │            │   PAYMENT    │                 │ expiró
                       │            └──────┬───────┘                 │
                       │                   │                         │
                       │                   │ Pago aprobado          │
                       │                   ▼                         │
                       │            ┌──────────────┐                 │
                       │            │              │                 │
                       ├────────────│    ACTIVE    │─────────────────┤
                       │            │   (PREMIUM)  │                 │
                       │            └──────┬───────┘                 │
                       │                   │                         │
                       │                   │ Usuario cancela         │
                       │                   ▼                         │
                       │            ┌──────────────┐                 │
                       │            │              │                 │
                       └────────────│  CANCELLED   │─────────────────┘
                                    │ (grace period)                 │
                                    └──────────────┘
```

### Estados de Pago (MercadoPago)

```
┌────────────┐     ┌────────────┐     ┌────────────┐
│  pending   │────▶│ in_process │────▶│  approved  │
└────────────┘     └────────────┘     └─────┬──────┘
      │                   │                 │
      │                   │                 ▼
      │                   │          ┌────────────┐
      │                   └─────────▶│  rejected  │
      │                              └────────────┘
      │
      ▼
┌────────────┐     ┌────────────┐
│ cancelled  │     │  refunded  │
└────────────┘     └────────────┘
                          │
                          ▼
                   ┌────────────┐
                   │charged_back│
                   └────────────┘
```

---

## Base de Datos

### Tablas Principales

#### `subscription_plans` - Definición de planes
```sql
CREATE TABLE public.subscription_plans (
  id text PRIMARY KEY,  -- 'free', 'premium', 'premium_pro'
  name text NOT NULL,
  description text,
  price_monthly numeric(10,2) NOT NULL DEFAULT 0,
  price_yearly numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  -- Límites
  orders_per_day integer,  -- null = unlimited
  -- Features JSON
  features jsonb NOT NULL DEFAULT '{}',
  -- Estado
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

#### `platform_subscriptions` - Historial de suscripciones
```sql
CREATE TABLE public.platform_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- Plan info
  plan_id text NOT NULL REFERENCES subscription_plans(id),
  billing_period text NOT NULL CHECK (billing_period IN ('monthly', 'yearly')),
  -- MercadoPago
  mp_preference_id text,
  mp_payment_id text,
  mp_subscription_id text,
  -- Montos
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  -- Estado
  status text NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'approved', 'cancelled', 'refunded', 'expired', 'failed')),
  -- Origen
  source text NOT NULL DEFAULT 'payment' 
    CHECK (source IN ('payment', 'gift', 'trial', 'migration')),
  gifted_by uuid REFERENCES auth.users(id),
  gift_reason text,
  -- Fechas
  starts_at timestamptz,
  expires_at timestamptz,
  cancelled_at timestamptz,
  paid_at timestamptz,
  -- Idempotencia
  idempotency_key text UNIQUE,
  -- Metadata
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

#### `mp_webhook_events` - Eventos de webhook
```sql
CREATE TABLE public.mp_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identificadores MP
  mp_event_id text NOT NULL,
  mp_event_type text NOT NULL,
  mp_resource_id text,
  mp_resource_type text,
  -- Procesamiento
  status text NOT NULL DEFAULT 'received' 
    CHECK (status IN ('received', 'processing', 'processed', 'failed', 'ignored')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  -- Payload
  raw_payload jsonb NOT NULL,
  processed_payload jsonb,
  -- Idempotencia
  signature text,
  is_valid_signature boolean,
  -- Metadata
  ip_address text,
  user_agent text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índice para idempotencia
CREATE UNIQUE INDEX idx_mp_webhook_events_idempotent 
  ON mp_webhook_events(mp_event_id, mp_resource_id);
```

#### `subscription_audit_log` - Log de auditoría
```sql
CREATE TABLE public.subscription_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Contexto
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES platform_subscriptions(id) ON DELETE SET NULL,
  -- Acción
  action text NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('system', 'user', 'admin', 'webhook', 'cron')),
  -- Detalles
  old_value jsonb,
  new_value jsonb,
  description text,
  -- Metadata
  ip_address text,
  user_agent text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscription_audit_log_tenant ON subscription_audit_log(tenant_id);
CREATE INDEX idx_subscription_audit_log_action ON subscription_audit_log(action);
CREATE INDEX idx_subscription_audit_log_created ON subscription_audit_log(created_at DESC);
```

#### `admin_gift_log` - Log de regalos de superadmin
```sql
CREATE TABLE public.admin_gift_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Quién recibe
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- Quién otorga
  admin_user_id uuid NOT NULL REFERENCES auth.users(id),
  admin_email text NOT NULL,
  -- Qué se otorga
  plan_tier text NOT NULL CHECK (plan_tier IN ('premium', 'premium_pro')),
  days_granted integer NOT NULL,
  reason text NOT NULL,
  -- Resultado
  new_expires_at timestamptz NOT NULL,
  previous_tier text,
  previous_expires_at timestamptz,
  -- Metadata
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_gift_log_tenant ON admin_gift_log(tenant_id);
CREATE INDEX idx_admin_gift_log_admin ON admin_gift_log(admin_user_id);
```

### Columnas adicionales en `tenants`
```sql
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'free',
ADD COLUMN IF NOT EXISTS premium_until timestamptz,
ADD COLUMN IF NOT EXISTS orders_limit integer DEFAULT 15,
ADD COLUMN IF NOT EXISTS orders_remaining integer DEFAULT 15,
ADD COLUMN IF NOT EXISTS orders_reset_date timestamptz,
ADD COLUMN IF NOT EXISTS auto_renew boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'active'
  CHECK (subscription_status IN ('active', 'cancelled', 'suspended'));
```

---

## Integración MercadoPago

### Variables de Entorno

```env
# Credenciales de la PLATAFORMA (para cobrar suscripciones)
VITE_MP_PUBLIC_KEY=APP_USR-xxx
VITE_MP_ACCESS_TOKEN=APP_USR-xxx

# Sandbox (desarrollo)
VITE_MP_SANDBOX_PUBLIC_KEY=TEST-xxx
VITE_MP_SANDBOX_ACCESS_TOKEN=TEST-xxx

# Modo: 'sandbox' o 'production'
VITE_MP_MODE=sandbox

# URL de la app
VITE_APP_URL=https://tudominio.com

# Webhook secret (para validar firma)
MP_WEBHOOK_SECRET=tu_secret_seguro
```

### Flujo de Pago Checkout Pro

```
┌─────────┐         ┌─────────────┐         ┌────────────────┐
│ Usuario │         │   Frontend  │         │   Supabase     │
└────┬────┘         └──────┬──────┘         └───────┬────────┘
     │                     │                        │
     │ 1. Selecciona plan  │                        │
     │────────────────────▶│                        │
     │                     │                        │
     │                     │ 2. Crea suscripción    │
     │                     │   pendiente            │
     │                     │───────────────────────▶│
     │                     │                        │
     │                     │ 3. Genera preferencia  │
     │                     │   MercadoPago          │
     │                     │─────────────────────────────────────▶ MercadoPago
     │                     │                        │
     │                     │◀──────────────────────────────────── preference_id
     │                     │                        │              + init_point
     │ 4. Redirect a MP    │                        │
     │◀────────────────────│                        │
     │                     │                        │
     │ [Usuario paga en MP]│                        │
     │                     │                        │
     │ 5. Redirect back    │                        │
     │────────────────────▶│                        │
     │                     │                        │
     │                     │ 6. Actualiza estado   │
     │                     │───────────────────────▶│
     │                     │                        │
     │ 7. Muestra éxito    │                        │
     │◀────────────────────│                        │
```

### Payload de Preferencia

```javascript
const preference = {
  items: [{
    id: `subscription_${tenantId}_${planTier}_${billingPeriod}`,
    title: `Suscripción ${tierLabel} ${periodLabel} - Restos`,
    description: `Plan ${tierLabel} para ${tenantName}`,
    quantity: 1,
    currency_id: 'ARS',
    unit_price: amount,
  }],
  payer: {
    email: payerEmail,
  },
  external_reference: JSON.stringify({
    type: 'subscription',
    tenantId,
    planTier,
    billingPeriod,
    subscriptionId,  // ID de platform_subscriptions
    idempotencyKey: `sub_${tenantId}_${Date.now()}`,
  }),
  back_urls: {
    success: `${APP_URL}/payment/success?type=subscription&tenant=${tenantId}`,
    failure: `${APP_URL}/payment/failure?type=subscription&tenant=${tenantId}`,
    pending: `${APP_URL}/payment/pending?type=subscription&tenant=${tenantId}`,
  },
  auto_return: 'approved',
  notification_url: `${APP_URL}/api/webhooks/mercadopago`,
  statement_descriptor: 'RESTOS',
}
```

---

## Webhooks

### Endpoint de Webhook

```javascript
// Supabase Edge Function: functions/mercadopago-webhook/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'https://deno.land/std@0.177.0/crypto/mod.ts'

serve(async (req) => {
  // 1. Validar método
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  // 2. Obtener headers y body
  const signature = req.headers.get('x-signature')
  const requestId = req.headers.get('x-request-id')
  const body = await req.text()
  
  // 3. Validar firma
  const webhookSecret = Deno.env.get('MP_WEBHOOK_SECRET')
  const isValidSignature = validateSignature(signature, body, webhookSecret)
  
  if (!isValidSignature) {
    console.error('Invalid webhook signature')
    return new Response('Invalid signature', { status: 401 })
  }

  const payload = JSON.parse(body)

  // 4. Idempotencia: verificar si ya procesamos este evento
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  )

  const { data: existingEvent } = await supabase
    .from('mp_webhook_events')
    .select('id, status')
    .eq('mp_event_id', payload.id)
    .eq('mp_resource_id', payload.data?.id)
    .single()

  if (existingEvent?.status === 'processed') {
    return new Response(JSON.stringify({ 
      status: 'already_processed',
      event_id: existingEvent.id 
    }), { status: 200 })
  }

  // 5. Registrar evento
  const { data: event, error: insertError } = await supabase
    .from('mp_webhook_events')
    .upsert({
      mp_event_id: payload.id,
      mp_event_type: payload.type,
      mp_resource_id: payload.data?.id,
      mp_resource_type: payload.type?.split('.')[0],
      raw_payload: payload,
      status: 'processing',
      signature,
      is_valid_signature: true,
      ip_address: req.headers.get('x-forwarded-for'),
      user_agent: req.headers.get('user-agent'),
    })
    .select()
    .single()

  // 6. Procesar según tipo
  try {
    switch (payload.type) {
      case 'payment':
        await processPaymentWebhook(supabase, payload)
        break
      case 'subscription_preapproval':
        await processSubscriptionWebhook(supabase, payload)
        break
      default:
        console.log('Unhandled webhook type:', payload.type)
    }

    // 7. Marcar como procesado
    await supabase
      .from('mp_webhook_events')
      .update({ 
        status: 'processed',
        processed_at: new Date().toISOString()
      })
      .eq('id', event.id)

    return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })

  } catch (error) {
    // 8. Registrar error
    await supabase
      .from('mp_webhook_events')
      .update({ 
        status: 'failed',
        last_error: error.message,
        attempts: (event?.attempts || 0) + 1
      })
      .eq('id', event.id)

    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})

async function processPaymentWebhook(supabase, payload) {
  const paymentId = payload.data.id
  
  // Obtener info del pago desde MP API
  const accessToken = Deno.env.get('MP_ACCESS_TOKEN')
  const paymentRes = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    { headers: { 'Authorization': `Bearer ${accessToken}` }}
  )
  const payment = await paymentRes.json()

  // Parsear external_reference
  const externalRef = JSON.parse(payment.external_reference || '{}')
  
  if (externalRef.type !== 'subscription') return

  const { tenantId, planTier, billingPeriod, subscriptionId } = externalRef

  // Actualizar según estado
  if (payment.status === 'approved') {
    // Calcular fecha de expiración
    const expiresAt = new Date()
    if (billingPeriod === 'yearly') {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1)
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + 1)
    }

    // Actualizar suscripción
    await supabase
      .from('platform_subscriptions')
      .update({
        status: 'approved',
        mp_payment_id: paymentId,
        paid_at: new Date().toISOString(),
        starts_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .eq('id', subscriptionId)

    // Actualizar tenant
    await supabase
      .from('tenants')
      .update({
        subscription_tier: planTier,
        premium_until: expiresAt.toISOString(),
        orders_limit: planTier === 'premium_pro' ? null : 80,
        orders_remaining: planTier === 'premium_pro' ? null : 80,
      })
      .eq('id', tenantId)

    // Log de auditoría
    await supabase.from('subscription_audit_log').insert({
      tenant_id: tenantId,
      subscription_id: subscriptionId,
      action: 'subscription_activated',
      action_type: 'webhook',
      new_value: { plan_tier: planTier, expires_at: expiresAt },
      description: `Suscripción ${planTier} activada vía pago MP`,
    })

  } else if (['rejected', 'cancelled'].includes(payment.status)) {
    await supabase
      .from('platform_subscriptions')
      .update({
        status: 'failed',
        mp_payment_id: paymentId,
      })
      .eq('id', subscriptionId)

    await supabase.from('subscription_audit_log').insert({
      tenant_id: tenantId,
      subscription_id: subscriptionId,
      action: 'payment_failed',
      action_type: 'webhook',
      new_value: { status: payment.status, status_detail: payment.status_detail },
      description: `Pago rechazado: ${payment.status_detail}`,
    })
  }
}

function validateSignature(signature, body, secret) {
  if (!signature || !secret) return false
  
  // MercadoPago usa formato: ts=xxx,v1=xxx
  const parts = signature.split(',').reduce((acc, part) => {
    const [key, value] = part.split('=')
    acc[key] = value
    return acc
  }, {})
  
  const timestamp = parts.ts
  const v1 = parts.v1
  
  // Crear firma esperada
  const signedPayload = `${timestamp}.${body}`
  const expectedSignature = createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex')
  
  return v1 === expectedSignature
}
```

### Tipos de Webhook a Manejar

| Tipo | Acción |
|------|--------|
| `payment` | Actualizar estado de suscripción |
| `subscription_preapproval` | Suscripciones recurrentes |
| `subscription_authorized_payment` | Pago recurrente autorizado |
| `chargebacks` | Contracargo - suspender cuenta |
| `refunds` | Reembolso - degradar a FREE |

---

## Seguridad

### 1. Credenciales

```javascript
// ❌ NUNCA hacer esto
const accessToken = 'APP_USR-xxx'

// ✅ Siempre usar variables de entorno
const accessToken = import.meta.env.VITE_MP_ACCESS_TOKEN
// O mejor aún, en backend:
const accessToken = Deno.env.get('MP_ACCESS_TOKEN')
```

### 2. Validación de Webhooks

```javascript
// Siempre validar la firma antes de procesar
if (!validateWebhookSignature(signature, body, secret)) {
  return new Response('Unauthorized', { status: 401 })
}
```

### 3. RLS (Row Level Security)

```sql
-- Solo super_admin puede ver todas las suscripciones
CREATE POLICY "admin_view_all_subscriptions" ON platform_subscriptions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- Usuarios solo ven sus propias suscripciones
CREATE POLICY "tenant_view_own_subscriptions" ON platform_subscriptions
  FOR SELECT USING (
    tenant_id IN (
      SELECT t.id FROM tenants t 
      WHERE t.owner_user_id = auth.uid()
    )
  );
```

### 4. Rate Limiting

```sql
-- Función para verificar rate limit de webhooks
CREATE OR REPLACE FUNCTION check_webhook_rate_limit(p_ip text)
RETURNS boolean AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM mp_webhook_events
  WHERE ip_address = p_ip
    AND created_at > now() - interval '1 minute';
  
  RETURN v_count < 100;  -- Max 100 requests/min
END;
$$ LANGUAGE plpgsql;
```

### 5. Idempotencia

```javascript
// Generar key única para cada operación
const idempotencyKey = `sub_${tenantId}_${planTier}_${Date.now()}`

// Verificar antes de procesar
const existing = await supabase
  .from('platform_subscriptions')
  .select('id')
  .eq('idempotency_key', idempotencyKey)
  .single()

if (existing) {
  return existing  // Ya procesado, retornar existente
}
```

---

## Endpoints API

### Suscripciones

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/subscriptions/create` | Crear suscripción pendiente |
| `GET` | `/api/subscriptions/:tenantId` | Obtener suscripción activa |
| `GET` | `/api/subscriptions/:tenantId/history` | Historial de suscripciones |
| `POST` | `/api/subscriptions/:id/cancel` | Cancelar suscripción |
| `POST` | `/api/subscriptions/:id/renew` | Renovar suscripción |

### Admin

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/admin/subscriptions` | Todas las suscripciones |
| `POST` | `/api/admin/subscriptions/gift` | Regalar días |
| `POST` | `/api/admin/subscriptions/:id/extend` | Extender suscripción |
| `POST` | `/api/admin/subscriptions/:id/expire` | Forzar expiración |
| `GET` | `/api/admin/audit-log` | Ver log de auditoría |

### Webhooks

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/webhooks/mercadopago` | Recibir eventos MP |

---

## Sistema de Auditoría

### Acciones Registradas

```javascript
const AUDIT_ACTIONS = {
  // Sistema
  SUBSCRIPTION_CREATED: 'subscription_created',
  SUBSCRIPTION_ACTIVATED: 'subscription_activated',
  SUBSCRIPTION_EXPIRED: 'subscription_expired',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
  SUBSCRIPTION_RENEWED: 'subscription_renewed',
  
  // Usuario
  USER_UPGRADED: 'user_upgraded',
  USER_DOWNGRADED: 'user_downgraded',
  USER_CANCELLED: 'user_cancelled',
  AUTO_RENEW_ENABLED: 'auto_renew_enabled',
  AUTO_RENEW_DISABLED: 'auto_renew_disabled',
  
  // Admin
  ADMIN_GIFT: 'admin_gift',
  ADMIN_EXTEND: 'admin_extend',
  ADMIN_EXPIRE: 'admin_expire',
  ADMIN_REFUND: 'admin_refund',
  
  // Pagos
  PAYMENT_RECEIVED: 'payment_received',
  PAYMENT_FAILED: 'payment_failed',
  PAYMENT_REFUNDED: 'payment_refunded',
  CHARGEBACK_RECEIVED: 'chargeback_received',
  
  // Cron
  CRON_EXPIRATION_CHECK: 'cron_expiration_check',
  CRON_REMINDER_SENT: 'cron_reminder_sent',
  CRON_AUTO_RENEW: 'cron_auto_renew',
}
```

### Ejemplo de Log

```json
{
  "id": "uuid",
  "tenant_id": "tenant-uuid",
  "user_id": "admin-uuid",
  "action": "admin_gift",
  "action_type": "admin",
  "old_value": {
    "subscription_tier": "free",
    "premium_until": null
  },
  "new_value": {
    "subscription_tier": "premium",
    "premium_until": "2024-03-01T00:00:00Z"
  },
  "description": "Superadmin otorgó 30 días de Premium",
  "metadata": {
    "reason": "Compensación por falla del servicio",
    "days_granted": 30
  },
  "ip_address": "192.168.1.1",
  "created_at": "2024-02-01T10:30:00Z"
}
```

---

## Tareas Programadas

### 1. Verificar Expiración (cada hora)

```sql
-- pg_cron job
SELECT cron.schedule(
  'expire-subscriptions',
  '0 * * * *',
  $$
  SELECT expire_all_subscriptions();
  INSERT INTO subscription_audit_log (action, action_type, description)
  VALUES ('cron_expiration_check', 'cron', 'Verificación automática de expiración');
  $$
);
```

### 2. Enviar Recordatorios (diario 9am)

```sql
SELECT cron.schedule(
  'send-expiration-reminders',
  '0 9 * * *',
  $$
  SELECT send_expiration_reminders();
  $$
);
```

```javascript
// Supabase Edge Function
async function sendExpirationReminders() {
  const supabase = createClient(/*...*/)
  
  // Tenants que expiran en 7, 3, 1 días
  const { data: expiring } = await supabase
    .from('tenants')
    .select('id, name, owner_user_id, premium_until, profiles!tenants_owner_user_id_fkey(email)')
    .gt('premium_until', new Date().toISOString())
    .lt('premium_until', new Date(Date.now() + 7*24*60*60*1000).toISOString())
  
  for (const tenant of expiring) {
    const daysLeft = Math.ceil(
      (new Date(tenant.premium_until) - new Date()) / (24*60*60*1000)
    )
    
    if ([7, 3, 1].includes(daysLeft)) {
      await sendEmail({
        to: tenant.profiles.email,
        subject: `Tu suscripción expira en ${daysLeft} día(s)`,
        template: 'expiration-reminder',
        data: { tenantName: tenant.name, daysLeft }
      })
      
      await supabase.from('subscription_audit_log').insert({
        tenant_id: tenant.id,
        action: 'reminder_sent',
        action_type: 'cron',
        description: `Recordatorio enviado: ${daysLeft} días restantes`
      })
    }
  }
}
```

### 3. Auto-renovación

```javascript
async function processAutoRenewals() {
  const supabase = createClient(/*...*/)
  
  // Tenants que expiran hoy con auto_renew activo
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  
  const { data: toRenew } = await supabase
    .from('tenants')
    .select('*, platform_subscriptions!inner(*)')
    .eq('auto_renew', true)
    .lt('premium_until', today.toISOString())
    .gt('premium_until', new Date(today.getTime() - 24*60*60*1000).toISOString())
  
  for (const tenant of toRenew) {
    const lastSub = tenant.platform_subscriptions[0]
    
    // Crear nueva preferencia de pago
    const preference = await createSubscriptionPreference({
      tenantId: tenant.id,
      planTier: tenant.subscription_tier,
      billingPeriod: lastSub.billing_period,
      amount: lastSub.amount,
    })
    
    // Notificar al usuario que debe completar el pago
    await sendEmail({
      to: tenant.profiles.email,
      subject: 'Tu suscripción necesita renovación',
      template: 'auto-renew-payment',
      data: { paymentLink: preference.initPoint }
    })
  }
}
```

---

## Manejo de Errores

### Códigos de Error

| Código | Significado | Acción |
|--------|-------------|--------|
| `SUB001` | Plan no encontrado | Verificar plan_id |
| `SUB002` | Tenant no encontrado | Verificar tenant_id |
| `SUB003` | Suscripción ya activa | Mostrar info actual |
| `SUB004` | Pago fallido | Reintentar o cambiar método |
| `SUB005` | Webhook inválido | Loguear y alertar |
| `MP001` | Error API MercadoPago | Reintentar con backoff |
| `MP002` | Credenciales inválidas | Verificar tokens |
| `MP003` | Preferencia expirada | Crear nueva |

### Reintentos con Backoff

```javascript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt === maxRetries) throw error
      
      const delay = Math.pow(2, attempt) * 1000  // 2s, 4s, 8s
      await new Promise(r => setTimeout(r, delay))
    }
  }
}
```

### Alertas

```javascript
// Alertar cuando fallan webhooks consecutivos
async function checkWebhookHealth() {
  const { count } = await supabase
    .from('mp_webhook_events')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'failed')
    .gte('created_at', new Date(Date.now() - 60*60*1000).toISOString())
  
  if (count > 10) {
    await sendSlackAlert('🚨 Más de 10 webhooks fallidos en la última hora')
  }
}
```

---

## Panel de Usuario

### Componente: SubscriptionPanel

```jsx
function SubscriptionPanel({ tenantId }) {
  const { data: subscription } = useSubscription(tenantId)
  const { data: history } = useSubscriptionHistory(tenantId)
  
  return (
    <div className="subscriptionPanel">
      {/* Plan actual */}
      <div className="subscriptionPanel__current">
        <h3>Tu Plan: {subscription.tier}</h3>
        <p>Válido hasta: {formatDate(subscription.expiresAt)}</p>
        <p>Días restantes: {subscription.daysRemaining}</p>
        
        <Toggle
          label="Renovación automática"
          checked={subscription.autoRenew}
          onChange={handleToggleAutoRenew}
        />
      </div>

      {/* Acciones */}
      <div className="subscriptionPanel__actions">
        {subscription.tier !== 'free' && (
          <Button onClick={handleCancel}>Cancelar suscripción</Button>
        )}
        {subscription.tier !== 'premium_pro' && (
          <Button onClick={() => setShowUpgrade(true)}>Mejorar plan</Button>
        )}
      </div>

      {/* Historial */}
      <div className="subscriptionPanel__history">
        <h4>Historial de pagos</h4>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Plan</th>
              <th>Monto</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {history.map(payment => (
              <tr key={payment.id}>
                <td>{formatDate(payment.paidAt)}</td>
                <td>{payment.planTier}</td>
                <td>{formatCurrency(payment.amount)}</td>
                <td><PaymentStatus status={payment.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

---

## Panel de Superadmin

### Vista de Suscripciones

```jsx
function AdminSubscriptionsPage() {
  const { data: summary } = useSubscriptionsSummary()
  
  return (
    <div className="adminSubscriptions">
      {/* KPIs */}
      <div className="adminSubscriptions__stats">
        <StatCard label="Total Premium" value={summary.premium} />
        <StatCard label="Total Pro" value={summary.premiumPro} />
        <StatCard label="Por expirar (7 días)" value={summary.expiringSoon} />
        <StatCard label="Expirados" value={summary.expired} />
      </div>

      {/* Tabla */}
      <table className="adminSubscriptions__table">
        <thead>
          <tr>
            <th>Tenant</th>
            <th>Plan</th>
            <th>Expira</th>
            <th>Días</th>
            <th>Auto-renew</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {summary.subscriptions.map(sub => (
            <tr key={sub.tenant_id}>
              <td>{sub.tenant_name}</td>
              <td><TierBadge tier={sub.subscription_tier} /></td>
              <td>{formatDate(sub.premium_until)}</td>
              <td className={sub.days_remaining < 7 ? 'warning' : ''}>
                {sub.days_remaining}
              </td>
              <td>{sub.auto_renew ? '✅' : '❌'}</td>
              <td>
                <Button onClick={() => openGiftModal(sub)}>
                  Regalar días
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Modal para regalar */}
      <GiftSubscriptionModal
        open={showGiftModal}
        tenant={selectedTenant}
        onGift={handleGift}
      />
    </div>
  )
}
```

### Regalar Suscripción

```javascript
async function giftSubscription(tenantId, { planTier, days, reason }) {
  // Calcular nueva fecha de expiración
  const tenant = await getTenant(tenantId)
  const currentExpiry = tenant.premium_until 
    ? new Date(tenant.premium_until) 
    : new Date()
  
  const newExpiry = new Date(Math.max(currentExpiry, new Date()))
  newExpiry.setDate(newExpiry.getDate() + days)

  // Actualizar tenant
  await supabase.from('tenants').update({
    subscription_tier: planTier,
    premium_until: newExpiry.toISOString(),
  }).eq('id', tenantId)

  // Crear registro de suscripción
  await supabase.from('platform_subscriptions').insert({
    tenant_id: tenantId,
    plan_id: planTier,
    billing_period: 'custom',
    amount: 0,
    status: 'approved',
    source: 'gift',
    gifted_by: getCurrentUserId(),
    gift_reason: reason,
    starts_at: new Date().toISOString(),
    expires_at: newExpiry.toISOString(),
  })

  // Log de regalo
  await supabase.from('admin_gift_log').insert({
    tenant_id: tenantId,
    admin_user_id: getCurrentUserId(),
    admin_email: getCurrentUserEmail(),
    plan_tier: planTier,
    days_granted: days,
    reason: reason,
    new_expires_at: newExpiry.toISOString(),
    previous_tier: tenant.subscription_tier,
    previous_expires_at: tenant.premium_until,
  })

  // Auditoría
  await supabase.from('subscription_audit_log').insert({
    tenant_id: tenantId,
    user_id: getCurrentUserId(),
    action: 'admin_gift',
    action_type: 'admin',
    old_value: { 
      tier: tenant.subscription_tier, 
      expires: tenant.premium_until 
    },
    new_value: { 
      tier: planTier, 
      expires: newExpiry.toISOString() 
    },
    description: `Superadmin otorgó ${days} días de ${planTier}: ${reason}`,
  })
}
```

---

## Checklist de Implementación

### Fase 1: Base de Datos
- [ ] Crear tabla `subscription_plans`
- [ ] Crear tabla `platform_subscriptions` (actualizar existente)
- [ ] Crear tabla `mp_webhook_events`
- [ ] Crear tabla `subscription_audit_log`
- [ ] Crear tabla `admin_gift_log`
- [ ] Agregar columnas a `tenants`
- [ ] Configurar RLS para todas las tablas
- [ ] Crear índices necesarios

### Fase 2: Webhooks
- [ ] Crear Edge Function para webhooks
- [ ] Implementar validación de firma
- [ ] Implementar procesamiento de `payment`
- [ ] Implementar idempotencia
- [ ] Configurar logging

### Fase 3: API
- [ ] Implementar `supabaseSubscriptionApi.js`
- [ ] Implementar `supabaseAuditApi.js`
- [ ] Actualizar `supabaseMercadopagoApi.js`
- [ ] Actualizar `mercadopago.js`

### Fase 4: Frontend
- [ ] Actualizar `PremiumModal` con nuevo flujo
- [ ] Crear `SubscriptionPanel` para usuarios
- [ ] Crear `AdminSubscriptionsPage` para superadmin
- [ ] Crear `GiftSubscriptionModal`
- [ ] Crear `PaymentHistoryTable`

### Fase 5: Automatización
- [ ] Configurar cron para expiración
- [ ] Configurar cron para recordatorios
- [ ] Implementar auto-renovación
- [ ] Configurar alertas

### Fase 6: Testing
- [ ] Tests unitarios de funciones
- [ ] Tests de integración con MP sandbox
- [ ] Tests de flujo completo
- [ ] Tests de webhooks con ngrok

### Fase 7: Producción
- [ ] Configurar variables de entorno producción
- [ ] Configurar webhook URL en MP dashboard
- [ ] Migrar datos existentes
- [ ] Monitoreo y alertas

---

## Próximos Pasos

1. **Ejecutar migraciones SQL** para crear las nuevas tablas
2. **Implementar Edge Function** para webhooks
3. **Actualizar frontend** con nuevos componentes
4. **Probar en sandbox** con tarjetas de prueba de MP
5. **Configurar cron jobs** en Supabase

---

*Documento generado el 6 de enero de 2026*
*Versión: 1.0.0*
