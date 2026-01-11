# 🔄 Sistema de Suscripciones MercadoPago - Implementación Completa

## 1. ARQUITECTURA GENERAL

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                        │
│  SubscriptionPanel → Botón "Suscribirse" → Redirect a MP                    │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EDGE FUNCTION                                        │
│                    /create-subscription                                      │
│                                                                              │
│  1. Validar usuario autenticado                                             │
│  2. Crear Preapproval en MercadoPago                                        │
│  3. Guardar subscription_id en DB                                           │
│  4. Retornar init_point (URL de pago)                                       │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MERCADOPAGO                                          │
│                                                                              │
│  Usuario acepta débito automático → MP gestiona cobros mensuales            │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WEBHOOK /mercadopago-subscription                         │
│                                                                              │
│  1. Validar firma y IP de MercadoPago                                       │
│  2. Verificar event_id único (anti-duplicados)                              │
│  3. Consultar estado real en API de MP                                      │
│  4. Actualizar DB según evento                                              │
│  5. Activar/Suspender beneficios                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. PLANES DE SUSCRIPCIÓN

| Plan | Precio ARS | Código MP | Beneficios |
|------|-----------|-----------|------------|
| Premium | $4,990/mes | `RESTO_PREMIUM_MONTHLY` | 80 pedidos, personalización |
| PRO | $7,990/mes | `RESTO_PRO_MONTHLY` | Ilimitado, todas las features |

---

## 3. ESTADOS DE SUSCRIPCIÓN

```
┌──────────────┐     Pago autorizado      ┌──────────────┐
│   pending    │ ───────────────────────► │   active     │
│  (esperando  │                          │  (beneficios │
│  autorizar)  │                          │   activos)   │
└──────────────┘                          └──────┬───────┘
                                                 │
                    ┌────────────────────────────┼────────────────────────────┐
                    │                            │                            │
                    ▼                            ▼                            ▼
           ┌──────────────┐            ┌──────────────┐            ┌──────────────┐
           │   paused     │            │ payment_     │            │  cancelled   │
           │  (pausada    │            │ failed       │            │  (cancelada  │
           │  por usuario)│            │ (en gracia)  │            │  definitivo) │
           └──────────────┘            └──────────────┘            └──────────────┘
                    │                            │
                    │     Pago exitoso           │
                    └────────────────────────────┘
                                 │
                                 ▼
                        ┌──────────────┐
                        │   active     │
                        └──────────────┘
```

---

## 4. EVENTOS DE WEBHOOK

| Evento | Acción |
|--------|--------|
| `subscription_preapproval.authorized` | Activar suscripción, dar beneficios |
| `subscription_preapproval.payment_approved` | Extender fecha de vencimiento 30 días |
| `subscription_preapproval.payment_failed` | Marcar como fallido, período de gracia 3 días |
| `subscription_preapproval.paused` | Pausar beneficios pero mantener datos |
| `subscription_preapproval.cancelled` | Cancelar y remover beneficios al vencer |
| `subscription_preapproval.expired` | Pasar a FREE inmediatamente |

---

## 5. BASE DE DATOS

### Tabla: `mp_subscriptions` (actualizada)

```sql
CREATE TABLE public.mp_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- MercadoPago IDs
  mp_preapproval_id TEXT UNIQUE NOT NULL,     -- ID de la suscripción
  mp_payer_id TEXT,                           -- ID del pagador en MP
  
  -- Plan
  plan_id TEXT NOT NULL,                      -- RESTO_PREMIUM_MONTHLY, RESTO_PRO_MONTHLY
  plan_tier TEXT NOT NULL,                    -- premium, premium_pro
  
  -- Estado
  status TEXT NOT NULL DEFAULT 'pending',     -- pending, authorized, active, paused, cancelled, expired
  
  -- Fechas
  start_date TIMESTAMPTZ,                     -- Cuando se autorizó
  next_billing_date TIMESTAMPTZ,              -- Próximo cobro
  last_payment_date TIMESTAMPTZ,              -- Último pago exitoso
  end_date TIMESTAMPTZ,                       -- Cuando termina (si se cancela)
  
  -- Período de gracia
  grace_period_ends TIMESTAMPTZ,              -- Hasta cuándo tiene beneficios si falla pago
  
  -- Pagos
  total_payments INT DEFAULT 0,               -- Cantidad de pagos exitosos
  last_payment_amount NUMERIC(10,2),          -- Monto del último pago
  
  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id)
);
```

### Tabla: `mp_webhook_events` (anti-duplicados)

```sql
CREATE TABLE public.mp_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,              -- ID único del evento de MP
  event_type TEXT NOT NULL,
  preapproval_id TEXT,
  payload JSONB,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  result TEXT                                  -- success, error, ignored
);
```

---

## 6. PERÍODO DE GRACIA

| Situación | Comportamiento |
|-----------|---------------|
| Pago falla | 3 días de gracia, beneficios activos |
| 2do intento falla | 3 días más de gracia |
| 3er intento falla | Suspender beneficios, notificar |
| Usuario paga manualmente | Reactivar inmediatamente |

---

## 7. SEGURIDAD

### Validación de Webhook

```typescript
// 1. Verificar header x-signature
const signature = req.headers.get('x-signature')
const requestId = req.headers.get('x-request-id')

// 2. Calcular HMAC
const manifest = `id:${data.id};request-id:${requestId};ts:${timestamp}`
const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET).update(manifest).digest('hex')

// 3. Comparar
if (hmac !== signatureParts.v1) {
  return new Response('Invalid signature', { status: 401 })
}

// 4. Verificar IP de MP (opcional pero recomendado)
const mpIPs = ['216.33.196.0/24', '209.225.49.0/24', ...]
```

### Anti-duplicados

```typescript
// Antes de procesar, verificar si ya procesamos este evento
const { data: existing } = await supabase
  .from('mp_webhook_events')
  .select('id')
  .eq('event_id', eventId)
  .single()

if (existing) {
  return new Response('Already processed', { status: 200 })
}
```

---

## 8. FLUJO COMPLETO

### Suscripción Nueva

1. Usuario hace clic en "Suscribirse a Premium"
2. Frontend llama a Edge Function `/create-subscription`
3. Edge Function crea Preapproval en MP con:
   - `reason`: "Suscripción Resto Premium"
   - `auto_recurring.frequency`: 1
   - `auto_recurring.frequency_type`: "months"
   - `auto_recurring.transaction_amount`: 4990
   - `back_url`: URL de callback
4. MP retorna `init_point` (URL de checkout)
5. Usuario es redirigido a MP, acepta débito
6. MP envía webhook `authorized`
7. Webhook activa beneficios en DB

### Cobro Mensual

1. MP cobra automáticamente cada 30 días
2. Si exitoso: webhook `payment_approved`
3. Si falla: webhook `payment_failed`, período de gracia
4. Si falla 3 veces: suspender, notificar

### Cancelación

1. Usuario cancela desde su panel
2. Frontend llama a Edge Function `/cancel-subscription`
3. Edge Function llama a MP API para cancelar
4. MP envía webhook `cancelled`
5. Beneficios activos hasta `next_billing_date`
6. Al llegar esa fecha, pasar a FREE

---

## 9. ARCHIVOS A CREAR

1. `supabase/functions/create-subscription/index.ts` - Crear suscripción
2. `supabase/functions/cancel-subscription/index.ts` - Cancelar suscripción  
3. `supabase/functions/mercadopago-subscription-webhook/index.ts` - Webhook
4. `supabase/migrations/mp_subscriptions_v2.sql` - Schema actualizado
5. `src/lib/supabaseSubscriptionApi.js` - API del frontend
6. Actualizar `SubscriptionPanel.jsx` - UI

---

## 10. VARIABLES DE ENTORNO REQUERIDAS

```env
# En Supabase Edge Functions
MP_ACCESS_TOKEN=APP_USR-xxx           # Token de producción
MP_WEBHOOK_SECRET=xxx                  # Secreto para validar webhooks
MP_PREMIUM_PLAN_ID=xxx                 # ID del plan Premium (opcional si usas preapproval directo)
MP_PRO_PLAN_ID=xxx                     # ID del plan PRO

# URLs
APP_URL=https://tuapp.com
WEBHOOK_URL=https://xxx.supabase.co/functions/v1/mercadopago-subscription-webhook
```
