# Sistema de Auto-Renovación con MercadoPago

## Descripción
Este sistema permite que las suscripciones se renueven automáticamente **1 día antes de expirar** usando MercadoPago.

## Componentes

### 1. Migración SQL
Archivo: `supabase/migrations/add_auto_renewal_system.sql`

Crea:
- `tenant_payment_methods`: Almacena tarjetas guardadas para cobros automáticos
- `auto_renewal_log`: Log de intentos de renovación
- `get_subscriptions_to_renew()`: Función que retorna suscripciones a renovar
- `log_renewal_attempt()`: Registra intentos de cobro

### 2. Edge Function
Archivo: `supabase/functions/auto-renewal/index.ts`

Se ejecuta diariamente y:
1. Busca suscripciones que vencen en 1-2 días con `auto_renew = true`
2. Si tiene tarjeta guardada, cobra automáticamente
3. Si no tiene tarjeta, envía recordatorio por email
4. Registra el resultado en `auto_renewal_log`

### 3. API Cliente
Archivo: `src/lib/supabaseMercadopagoApi.js`

Nuevas funciones:
- `getSubscriptionsToRenew()`: Obtiene suscripciones pendientes de renovar
- `savePaymentMethod()`: Guarda tarjeta para cobros automáticos
- `getSavedPaymentMethod()`: Obtiene tarjeta guardada
- `deletePaymentMethod()`: Elimina método de pago
- `logRenewalAttempt()`: Registra intento de renovación
- `getRenewalHistory()`: Historial de renovaciones

## Configuración del Cron Job

### Opción 1: pg_cron (recomendado)

```sql
-- Habilitar extensión pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Programar ejecución diaria a las 8:00 AM
SELECT cron.schedule(
  'daily-auto-renewal',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://tu-proyecto.supabase.co/functions/v1/auto-renewal',
    headers := '{"Authorization": "Bearer tu_service_role_key"}'::jsonb
  )
  $$
);
```

### Opción 2: GitHub Actions

```yaml
# .github/workflows/auto-renewal.yml
name: Auto Renewal
on:
  schedule:
    - cron: '0 11 * * *' # 8:00 AM Argentina (UTC-3)

jobs:
  renew:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger auto-renewal
        run: |
          curl -X POST "${{ secrets.SUPABASE_URL }}/functions/v1/auto-renewal" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_KEY }}"
```

## Variables de Entorno Requeridas

En Supabase Edge Functions:
- `SUPABASE_URL`: URL del proyecto
- `SUPABASE_SERVICE_ROLE_KEY`: Clave de servicio (generada automáticamente)
- `MERCADOPAGO_ACCESS_TOKEN`: Token de acceso de MercadoPago (producción)

## Flujo de Renovación

```
Día N (hoy)
    │
    ├── Usuario activa auto_renew
    ├── Usuario guarda tarjeta (opcional pero necesario para cobro automático)
    │
Día N+29 (1 día antes de vencer)
    │
    ├── Cron ejecuta Edge Function a las 8:00 AM
    │   │
    │   ├── get_subscriptions_to_renew() → Encuentra suscripción
    │   │
    │   ├── ¿Tiene tarjeta guardada?
    │   │   │
    │   │   ├── SÍ → Cobra con MercadoPago
    │   │   │       │
    │   │   │       ├── Aprobado → Extiende 30 días
    │   │   │       └── Rechazado → Log error + email
    │   │   │
    │   │   └── NO → Envía email recordatorio
    │   │
    │   └── log_renewal_attempt() → Registra resultado
    │
Día N+30 (expira)
    │
    └── Si no se renovó, expira normalmente
```

## Interfaz de Usuario

En `SubscriptionStatus` se muestra:
- Toggle de renovación automática
- Fecha del próximo cobro (1 día antes de expirar)
- Info de tarjeta guardada (si existe)

En `SubscriptionPanel`:
- Alerta de cambio programado
- Opción de cancelar cambio programado

## Seguridad

- Las tarjetas se almacenan como tokens de MercadoPago (nunca datos sensibles)
- Los cobros se hacen server-side con service_role_key
- RLS protege los datos de métodos de pago

## Testing

Para probar manualmente:

```bash
# Llamar la Edge Function
curl -X POST "https://tu-proyecto.supabase.co/functions/v1/auto-renewal" \
  -H "Authorization: Bearer TU_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```
