# Sistema de Control de Suscripciones v2.0

## Arquitectura

El sistema implementa un **control centralizado de suscripciones** con las siguientes características:

1. **Validación siempre en backend** - Nunca confiar en flags del frontend
2. **Downgrade automático** - Cuando expira la suscripción
3. **Webhooks MercadoPago** - Procesamiento de eventos de pago
4. **Cron jobs** - Verificación periódica de inconsistencias
5. **Auditoría completa** - Logs de todos los cambios

---

## Componentes Creados

### 1. Migración SQL (`subscription_enforcement_system.sql`)

**Funciones principales:**

| Función | Descripción |
|---------|-------------|
| `tenant_has_feature(tenant_id, feature)` | Verifica si el tenant tiene acceso a una feature |
| `get_effective_tier(tenant_id)` | Retorna el tier efectivo (considera expiración) |
| `execute_subscription_downgrade(tenant_id)` | Ejecuta downgrade a FREE |
| `process_expired_subscriptions()` | Procesa todas las suscripciones vencidas |
| `validate_premium_action(tenant_id, action, required_tier)` | Valida acción contra el backend |
| `process_mp_subscription_webhook(...)` | Procesa webhooks de MercadoPago |
| `get_subscription_status(tenant_id)` | Retorna estado completo de suscripción |

**Tabla de auditoría:**
- `subscription_logs` - Registra todos los cambios de suscripción

**Trigger:**
- `validate_theme_changes_trigger` - Bloquea configuraciones premium en temas

### 2. Hook React (`useSubscription.js`)

```jsx
import { useSubscription } from '../shared/useSubscription';

function MyComponent() {
  const {
    tier,                    // 'free' | 'premium' | 'premium_pro'
    hasFeature,              // (feature: string) => boolean
    hasTierAccess,           // (tier: string) => boolean
    validateAction,          // Validación contra backend
    isPremium,               // boolean
    isPremiumPro,            // boolean
    isFree,                  // boolean
    isExpired,               // boolean
    isExpiringSoon,          // boolean (< 7 días)
    daysRemaining,           // number
    orderLimits,             // { limit, remaining, isUnlimited, percentage }
    refresh,                 // () => Promise<void>
  } = useSubscription();
}
```

### 3. Componente Guard (`SubscriptionGuard.jsx`)

```jsx
import SubscriptionGuard from './components/ui/SubscriptionGuard';

// Por tier
<SubscriptionGuard requiredTier="premium">
  <PremiumFeature />
</SubscriptionGuard>

// Por feature
<SubscriptionGuard feature="page_builder">
  <PageBuilder />
</SubscriptionGuard>

// Con overlay
<SubscriptionGuard 
  requiredTier="premium_pro" 
  showOverlay
  overlayMessage="Disponible en Premium Pro"
>
  <AdvancedStats />
</SubscriptionGuard>

// Con validación backend
<SubscriptionGuard 
  feature="unlimited_orders"
  validateOnRender
>
  <UnlimitedOrders />
</SubscriptionGuard>
```

### 4. Edge Functions

| Function | Path | Descripción |
|----------|------|-------------|
| `mp-subscription-webhook-v2` | `/functions/v1/mp-subscription-webhook-v2` | Procesa webhooks de MercadoPago |
| `process-subscriptions-cron` | `/functions/v1/process-subscriptions-cron` | Cron job de verificación |

---

## Instalación

### 1. Ejecutar migración SQL

```sql
-- En Supabase SQL Editor
-- Copiar contenido de: supabase/migrations/subscription_enforcement_system.sql
```

### 2. Configurar pg_cron (opcional)

Si tu proyecto tiene pg_cron habilitado:

```sql
SELECT cron.schedule(
  'process-expired-subscriptions',
  '0 * * * *',  -- Cada hora
  $$SELECT public.process_expired_subscriptions()$$
);
```

### 3. Deploy Edge Functions

```bash
# Webhook MercadoPago
supabase functions deploy mp-subscription-webhook-v2

# Cron job (alternativa a pg_cron)
supabase functions deploy process-subscriptions-cron
```

### 4. Configurar variables de entorno

```bash
# En Supabase Dashboard > Edge Functions > Secrets
MERCADOPAGO_ACCESS_TOKEN=APP_USR-xxx
CRON_SECRET=tu-secret-seguro
```

### 5. Configurar webhook en MercadoPago

```
URL: https://tu-proyecto.supabase.co/functions/v1/mp-subscription-webhook-v2
Eventos: subscription.*, payment.*
```

---

## Flujo de Validación

```
┌─────────────────┐
│   Frontend      │
│  (useSubscription)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  get_subscription│
│  _status()      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ get_effective   │ ← Considera expiración
│ _tier()         │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
 ACTIVO    EXPIRADO
    │         │
    ▼         ▼
 Permitir   Denegar
```

## Flujo de Downgrade Automático

```
┌─────────────────┐
│  Cron Job       │ (cada hora)
│  o Webhook      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ premium_until < │
│ NOW() ?         │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    NO        SÍ
    │         │
    ▼         ▼
  Nada   ┌────────────┐
         │ auto_renew?│
         └────┬───────┘
              │
         ┌────┴────┐
         │         │
        SÍ        NO
         │         │
         ▼         ▼
      past_due   execute_
                 subscription_
                 downgrade()
                     │
                     ▼
              ┌──────────────┐
              │ • tier→free  │
              │ • reset tema │
              │ • log cambio │
              └──────────────┘
```

---

## Features por Tier

### FREE
- `basic_widgets`
- `basic_theme`
- `basic_products`

### PREMIUM
- Todo de FREE +
- `carousel_widget`
- `gallery_widget`
- `map_widget`
- `custom_cards`
- `custom_fonts`
- `extra_categories`
- `priority_support`

### PREMIUM PRO
- Todo de PREMIUM +
- `page_builder`
- `unlimited_orders`
- `advanced_analytics`
- `video_widget`
- `advanced_hero`
- `api_access`

---

## Seguridad

### Anti-Fraude

1. **Validación siempre en backend** - Las funciones RPC validan el tier real
2. **Trigger en temas** - Bloquea guardar configuraciones premium sin permiso
3. **Logs de auditoría** - Todo cambio queda registrado
4. **Verificación periódica** - Cron job corrige inconsistencias

### RLS Policies

```sql
-- Solo super_admin puede ver todos los logs
CREATE POLICY "subscription_logs_admin_all" ON public.subscription_logs
  FOR ALL USING (public.is_super_admin());

-- Owners solo ven sus propios logs
CREATE POLICY "subscription_logs_owner_read" ON public.subscription_logs
  FOR SELECT USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE owner_user_id = auth.uid())
  );
```

---

## Eventos de MercadoPago Manejados

| Evento | Acción |
|--------|--------|
| `subscription.authorized` | Estado → active |
| `subscription.cancelled` | Downgrade a FREE |
| `subscription.expired` | Downgrade a FREE |
| `subscription.paused` | Estado → past_due |
| `payment.approved` | Reactivar si past_due |
| `payment.rejected` | Estado → past_due |

---

## Monitoreo

### Ver suscripciones vencidas

```sql
SELECT id, name, subscription_tier, premium_until
FROM tenants
WHERE subscription_tier != 'free'
  AND premium_until < NOW();
```

### Ver logs recientes

```sql
SELECT * FROM subscription_logs
ORDER BY created_at DESC
LIMIT 100;
```

### Ver ejecuciones de cron

```sql
SELECT * FROM subscription_logs
WHERE event_type = 'cron_execution'
ORDER BY created_at DESC;
```

---

## Troubleshooting

### El downgrade no se ejecutó

1. Verificar que `premium_until` esté correctamente seteado
2. Revisar logs: `SELECT * FROM subscription_logs WHERE tenant_id = 'xxx'`
3. Ejecutar manualmente: `SELECT execute_subscription_downgrade('tenant-id')`

### El cron no corre

1. Verificar pg_cron está habilitado
2. Si usas Edge Function, verificar que está configurado en Supabase Dashboard
3. Ejecutar manualmente: `SELECT process_expired_subscriptions()`

### Webhook no procesa

1. Verificar URL en MercadoPago
2. Revisar logs de Edge Function en Supabase Dashboard
3. Verificar `MERCADOPAGO_ACCESS_TOKEN` está configurado
