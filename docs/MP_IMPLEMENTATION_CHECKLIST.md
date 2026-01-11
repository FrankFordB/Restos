# ✅ Checklist de Implementación - Suscripciones MercadoPago

## Archivos Creados

| Archivo | Descripción | Estado |
|---------|-------------|--------|
| `docs/MP_SUBSCRIPTIONS_ARCHITECTURE.md` | Documentación de arquitectura | ✅ Creado |
| `supabase/migrations/mp_subscriptions_v2.sql` | Schema y funciones SQL | ✅ Creado |
| `supabase/functions/create-subscription/index.ts` | Edge Function crear suscripción | ✅ Creado |
| `supabase/functions/cancel-subscription/index.ts` | Edge Function cancelar suscripción | ✅ Creado |
| `supabase/functions/mercadopago-subscription-webhook/index.ts` | Webhook para recibir eventos | ✅ Creado |
| `supabase/functions/_shared/cors.ts` | Headers CORS compartidos | ✅ Creado |
| `src/lib/supabaseSubscriptionApi.js` | Funciones MP agregadas | ✅ Actualizado |

---

## Pasos de Implementación

### 1. Configurar Variables de Entorno en Supabase

```bash
# En Supabase Dashboard > Edge Functions > Secrets
# O usando CLI:
supabase secrets set MP_ACCESS_TOKEN=APP_USR-xxxx
supabase secrets set MP_WEBHOOK_SECRET=xxxx  # Opcional pero recomendado
supabase secrets set APP_URL=https://tuapp.com
```

### 2. Ejecutar Migración SQL

```sql
-- En Supabase SQL Editor
-- Copiar y ejecutar: supabase/migrations/mp_subscriptions_v2.sql
```

### 3. Desplegar Edge Functions

```bash
cd supabase
supabase functions deploy create-subscription
supabase functions deploy cancel-subscription
supabase functions deploy mercadopago-subscription-webhook
```

### 4. Configurar Webhook en MercadoPago

1. Ir a [MercadoPago Developers](https://www.mercadopago.com.ar/developers/panel)
2. Ir a "Integraciones" > Tu aplicación
3. En "Webhooks" > "Notificaciones de pago"
4. URL: `https://TU-PROJECT-ID.supabase.co/functions/v1/mercadopago-subscription-webhook`
5. Eventos a escuchar:
   - `subscription_preapproval`
   - `payment`

### 5. Actualizar UI (Opcional)

Agregar en `SubscriptionPanel.jsx`:

```jsx
import { 
  createMPSubscription, 
  cancelMPSubscription,
  getActiveMPSubscription,
  getMPSubscriptionStatusMessage,
  MP_PLANS 
} from '../lib/supabaseSubscriptionApi'

// Botón para suscribirse
const handleSubscribe = async (plan) => {
  const result = await createMPSubscription(tenantId, plan)
  if (result.success) {
    // Redirigir a MercadoPago
    window.location.href = result.init_point
  } else {
    showError(result.error)
  }
}
```

---

## Flujo de Pruebas

### Test 1: Crear Suscripción
1. Usuario hace clic en "Suscribirse a Premium"
2. Es redirigido a MercadoPago
3. Autoriza el débito
4. Webhook recibe evento `authorized`
5. Verificar que `mp_subscriptions` tiene status `active`
6. Verificar que `tenants.subscription_tier` = `premium`

### Test 2: Cobro Automático (Sandbox)
1. En sandbox, simular cobro mensual
2. Webhook recibe `payment_approved`
3. Verificar que `next_billing_date` se extiende 30 días

### Test 3: Pago Fallido
1. Simular pago rechazado
2. Webhook recibe `payment_failed`
3. Verificar `failed_payments_count` incrementa
4. Verificar `grace_period_ends` se setea

### Test 4: Cancelación
1. Usuario cancela suscripción
2. Verificar que beneficios continúan hasta `next_billing_date`
3. Cuando llega esa fecha, tenant pasa a FREE

---

## Variables de Entorno Requeridas

| Variable | Descripción | Dónde Obtenerla |
|----------|-------------|-----------------|
| `MP_ACCESS_TOKEN` | Token de acceso de producción | MercadoPago Developers > Credenciales |
| `MP_WEBHOOK_SECRET` | Secreto para validar webhooks | MercadoPago Developers > Webhooks |
| `APP_URL` | URL de tu aplicación | Tu dominio de producción |

---

## Errores Comunes

### "No authenticated session"
- El usuario no está logueado
- El token expiró

### "Not authorized for this tenant"
- El usuario no es dueño del tenant
- Verificar `owner_user_id` en tabla `tenants`

### "Ya tienes una suscripción activa"
- El tenant ya tiene una suscripción pendiente o activa
- Debe cancelar la existente primero

### Webhook no recibe eventos
- Verificar URL del webhook en MercadoPago
- Verificar que la Edge Function está desplegada
- Revisar logs en Supabase Dashboard

---

## Seguridad Implementada

1. ✅ **Validación de usuario**: Solo el dueño del tenant puede crear/cancelar
2. ✅ **Anti-duplicados**: `event_id` único en `mp_webhook_events`
3. ✅ **Fuente de verdad**: Siempre consultamos a MP antes de actualizar
4. ✅ **SECURITY DEFINER**: Funciones SQL corren con permisos elevados
5. ✅ **Auditoría**: Todo cambio se registra en `subscription_audit_log`
6. ⚠️ **Validación de firma**: Implementada pero comentada (descomentar en producción)
7. ⚠️ **Validación de IP**: Implementada pero comentada (descomentar en producción)

---

## Próximos Pasos

1. [ ] Actualizar UI de `SubscriptionPanel.jsx` con botones de MP
2. [ ] Agregar página de historial de pagos
3. [ ] Implementar notificaciones por email (Resend/SendGrid)
4. [ ] Agregar métricas de MRR y churn
5. [ ] Configurar alertas de pagos fallidos
