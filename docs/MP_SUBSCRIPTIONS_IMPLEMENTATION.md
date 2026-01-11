# Sistema de Suscripciones Mercado Pago - Restos

## Arquitectura

El sistema usa **Mercado Pago Preapproval** (suscripciones automáticas) para cobros recurrentes mensuales.

```
┌─────────────┐     ┌────────────────┐     ┌──────────────┐
│   Frontend  │────▶│ Edge Functions │────▶│ Mercado Pago │
│  (React)    │◀────│  (Supabase)    │◀────│     API      │
└─────────────┘     └────────────────┘     └──────────────┘
       │                    │
       │                    ▼
       │            ┌──────────────┐
       └───────────▶│  Supabase DB │
                    │  (PostgreSQL)│
                    └──────────────┘
```

## Flujo de Suscripción

### 1. Usuario se suscribe
1. Usuario selecciona plan en `MPSubscriptionCheckout`
2. Frontend llama a Edge Function `create-subscription`
3. Edge Function crea Preapproval en MP
4. Edge Function guarda en `mp_subscriptions` con estado `pending`
5. Usuario es redirigido a MP para autorizar débito

### 2. Usuario autoriza
1. MP redirige a `back_url` con estado
2. MP envía webhook a `mp-subscription-webhook-v3`
3. Webhook procesa evento `preapproval.authorized`
4. RPC `process_subscription_webhook` actualiza estado a `authorized`

### 3. Primer pago
1. MP procesa el primer cobro automáticamente
2. MP envía webhook con evento `payment.approved`
3. Webhook llama RPC `process_subscription_payment`
4. RPC actualiza tenant con beneficios premium

### 4. Pagos recurrentes
1. MP cobra automáticamente cada mes
2. Webhooks notifican cada pago
3. Sistema actualiza `last_payment_at` y `next_payment_date`

### 5. Pago fallido
1. MP intenta cobrar y falla
2. Webhook recibe `payment.rejected`
3. Sistema incrementa `retry_count`
4. Si alcanza `max_retries`, activa período de gracia
5. Usuario recibe notificación

### 6. Cancelación
1. Usuario cancela desde dashboard
2. Edge Function `cancel-subscription` cancela en MP
3. Usuario mantiene acceso hasta fin del período
4. Al expirar, webhook actualiza a `free`

## Base de Datos

### Tablas

#### `mp_subscriptions`
Almacena las suscripciones de MP
- `mp_preapproval_id`: ID en Mercado Pago
- `status`: pending, authorized, active, paused, cancelled, expired, payment_failed
- `next_payment_date`: Próximo cobro

#### `mp_subscription_payments`
Historial de pagos
- `mp_payment_id`: ID del pago en MP
- `status`: pending, approved, rejected, refunded

#### `mp_webhook_events`
Auditoría de webhooks (anti-duplicados)
- `mp_event_id`: ID único del evento
- `status`: pending, processed, failed, ignored

### Columnas añadidas a `tenants`
- `mp_subscription_id`: FK a mp_subscriptions
- `subscription_status`: none, pending, active, paused, cancelled, payment_failed, grace_period
- `grace_period_until`: Fecha límite del período de gracia
- `next_billing_date`: Próximo cobro

## Edge Functions

### create-subscription
- **URL**: `/functions/v1/create-subscription`
- **Método**: POST
- **Auth**: Bearer token requerido
- **Body**: `{ plan: 'premium'|'premium_pro', tenant_id: UUID }`
- **Retorna**: `{ init_point, preapproval_id }`

### mp-subscription-webhook-v3
- **URL**: `/functions/v1/mp-subscription-webhook-v3`
- **Método**: POST
- **Auth**: Ninguna (validación por IP/firma)
- **Procesa**: Eventos de preapproval y payment

### cancel-subscription
- **URL**: `/functions/v1/cancel-subscription`
- **Método**: POST
- **Auth**: Bearer token requerido
- **Body**: `{ tenant_id: UUID, immediate?: boolean }`

## Configuración

### Variables de entorno (Supabase)
```bash
# Credenciales MP
MP_ACCESS_TOKEN=APP_USR-xxxx

# URL de la app (para back_url)
APP_URL=https://restos.app
```

### Mercado Pago Dashboard
1. Crear aplicación en MP Developers
2. Configurar webhook URL: `https://<project>.supabase.co/functions/v1/mp-subscription-webhook-v3`
3. Suscribirse a eventos:
   - `payment`
   - `subscription_preapproval`

## Seguridad

### Validaciones del Webhook
1. **Anti-duplicados**: Cada evento se guarda en `mp_webhook_events` con ID único
2. **Logging**: Todos los eventos se registran para auditoría
3. **Service Role**: Webhook usa service_role para bypasear RLS

### RLS Policies
- Usuarios solo ven sus propias suscripciones
- Service role tiene acceso completo para webhooks
- Funciones RPC usan SECURITY DEFINER

## Componentes Frontend

### MPSubscriptionCheckout
```jsx
<MPSubscriptionCheckout 
  tenantId={tenantId}
  userEmail={user.email}
  onSubscriptionCreated={handleSuccess}
/>
```

### API (mpSubscriptionsApi.ts)
```javascript
// Crear suscripción
await createMPSubscription({ tenantId, planTier, payerEmail })

// Obtener estado
await getSubscriptionStatus(tenantId)

// Cancelar
await cancelSubscription(tenantId)
```

## Deployment

### 1. Ejecutar migración SQL
```bash
# En Supabase SQL Editor, ejecutar:
# supabase/migrations/mp_subscriptions_schema.sql
```

### 2. Configurar secretos
```bash
supabase secrets set MP_ACCESS_TOKEN=APP_USR-xxxx
supabase secrets set APP_URL=https://restos.app
```

### 3. Deploy Edge Functions
```bash
supabase functions deploy create-subscription
supabase functions deploy mp-subscription-webhook-v3
supabase functions deploy cancel-subscription
```

### 4. Configurar webhook en MP
1. Ir a MP Developers > Tu aplicación > Webhooks
2. URL: `https://<project>.supabase.co/functions/v1/mp-subscription-webhook-v3`
3. Eventos: `payment`, `subscription_preapproval`

## Testing

### Sandbox
1. Usar `sandbox_init_point` en desarrollo
2. Credenciales de prueba de MP
3. Tarjetas de prueba:
   - Aprobada: 4509 9535 6623 3704 (CVV: 123, Venc: 11/25)
   - Rechazada: 4000 0000 0000 0002

### Verificar webhook
```bash
# Ver logs de la función
supabase functions logs mp-subscription-webhook-v3 --tail
```

## Migración desde sistema anterior

Si tienes suscripciones en `platform_subscriptions`:
1. Las suscripciones antiguas NO se migran automáticamente
2. Los usuarios deberán re-suscribirse con el nuevo sistema
3. Puedes dar un período de gracia manual

## Troubleshooting

### Webhook no llega
1. Verificar URL en MP Dashboard
2. Verificar que la función esté deployed
3. Ver logs: `supabase functions logs`

### Pago aprobado pero no se activa
1. Verificar `mp_webhook_events` para ver si llegó el evento
2. Verificar `mp_subscriptions.status`
3. Verificar logs de la función

### Usuario no puede suscribirse
1. Verificar que no tenga suscripción activa
2. Verificar permisos del tenant
3. Verificar credenciales MP
