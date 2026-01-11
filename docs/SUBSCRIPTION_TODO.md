# 🚀 Acciones Pendientes - Sistema de Suscripciones

## RESUMEN EJECUTIVO

### Problemas Identificados

| Problema | Causa Raíz | Estado |
|----------|-----------|--------|
| Downgrade no se aplica | No hay cron que llame `process_subscription_expirations()` | 🔴 No funciona |
| Auto-renovación no funciona | Edge Function no desplegada, no hay cron | 🔴 No funciona |
| Error 500 en actualizaciones | RLS recursivo en tabla `tenants` | 🟡 Parcialmente arreglado |

---

## ARCHIVOS CREADOS EN ESTA SESIÓN

1. **[docs/SUBSCRIPTION_ANALYSIS.md](docs/SUBSCRIPTION_ANALYSIS.md)** - Análisis completo del sistema
2. **[supabase/migrations/complete_subscription_system_v2.sql](supabase/migrations/complete_subscription_system_v2.sql)** - Migración SQL completa
3. **[supabase/functions/process-subscriptions/index.ts](supabase/functions/process-subscriptions/index.ts)** - Edge Function unificada

---

## PASOS PARA ACTIVAR EL SISTEMA

### Paso 1: Ejecutar la Migración SQL

```bash
# En la terminal de Supabase CLI
supabase db push

# O manualmente en el SQL Editor de Supabase Dashboard:
# Copiar y ejecutar el contenido de complete_subscription_system_v2.sql
```

### Paso 2: Desplegar la Edge Function

```bash
# En la raíz del proyecto
supabase functions deploy process-subscriptions
```

### Paso 3: Configurar el Cron Job

**Opción A: Usar Supabase Cron (pg_cron)**

```sql
-- Ejecutar en SQL Editor de Supabase
-- Primero habilitar pg_cron si no está habilitado
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Programar ejecución diaria a las 11:00 UTC (8:00 Argentina)
SELECT cron.schedule(
  'process-subscriptions-daily',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://<TU-PROJECT-ID>.supabase.co/functions/v1/process-subscriptions',
    headers := '{"Authorization": "Bearer <TU-SERVICE-ROLE-KEY>", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

**Opción B: Usar Servicio Externo**

- **Cron-job.org** (gratis): Llamar al endpoint cada día
- **GitHub Actions** (gratis): Workflow con schedule
- **Vercel Cron** (si ya usas Vercel)

### Paso 4: Verificar RLS de Tenants

```sql
-- Verificar que no haya recursión
-- Si hay error, ejecutar fix_tenants_policies_complete.sql
SELECT * FROM tenants LIMIT 1;
```

### Paso 5: Probar el Sistema

```bash
# Llamar manualmente a la Edge Function para probar
curl -X POST https://<TU-PROJECT-ID>.supabase.co/functions/v1/process-subscriptions \
  -H "Authorization: Bearer <TU-SERVICE-ROLE-KEY>" \
  -H "Content-Type: application/json"
```

---

## IMPLEMENTACIÓN FUTURA: Auto-Cobro con MercadoPago

El sistema actual **NO cobra automáticamente**. Para implementar cobros recurrentes reales:

### Opción Recomendada: MP Subscriptions API

1. **Crear planes en MercadoPago Dashboard**:
   - Plan "Premium Mensual" - $X/mes
   - Plan "PRO Mensual" - $Y/mes

2. **Cuando usuario activa auto-renew**:
   - Crear preapproval en MP
   - Redirigir a MP para autorizar
   - Guardar `preapproval_id` en `mp_subscriptions`

3. **Webhook de MP recibe pagos**:
   - Extender `premium_until` 30 días
   - Actualizar `last_payment_date`

### Documentación de MercadoPago
- [Suscripciones](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/landing)
- [Webhooks](https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks)

---

## ARQUITECTURA FINAL

```
┌────────────────────────────────────────────────────────────────┐
│                     CRON (Diario 08:00)                        │
└───────────────────────────┬────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│               Edge Function: process-subscriptions              │
│                                                                 │
│  1. process_subscription_expirations()                          │
│     → Aplica downgrades programados                             │
│     → Pasa a FREE si no hay scheduled_tier                      │
│                                                                 │
│  2. get_subscriptions_to_renew()                                │
│     → Identifica suscripciones próximas a vencer                │
│     → Con auto_renew=true                                       │
│                                                                 │
│  3. Enviar recordatorios (7 días antes)                         │
│     → Para usuarios sin auto_renew                              │
└────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│                      Base de Datos                              │
│                                                                 │
│  tenants                    subscription_audit_log              │
│  ├─ subscription_tier       ├─ action (SCHEDULED, EXPIRED...)  │
│  ├─ premium_until           ├─ old_tier                        │
│  ├─ scheduled_tier          ├─ new_tier                        │
│  ├─ scheduled_at            └─ details                         │
│  └─ auto_renew                                                  │
│                                                                 │
│  mp_subscriptions                                               │
│  ├─ mp_preapproval_id                                           │
│  ├─ status                                                      │
│  └─ next_payment_date                                           │
└────────────────────────────────────────────────────────────────┘
```

---

## CHECKLIST FINAL

- [ ] Ejecutar `complete_subscription_system_v2.sql` en Supabase
- [ ] Verificar que no hay errores RLS
- [ ] Desplegar `process-subscriptions` Edge Function
- [ ] Configurar cron job (pg_cron o externo)
- [ ] Probar programar downgrade → esperar expiración → verificar cambio
- [ ] (Futuro) Implementar MP Subscriptions para auto-cobro real
