# 🔍 Análisis Completo del Sistema de Suscripciones

## 1. DIAGNÓSTICO DE PROBLEMAS

### 1.1 Por qué el Downgrade no se Aplica

**PROBLEMA IDENTIFICADO:**

El sistema de downgrade programado tiene una función `process_expired_subscriptions()` que **nunca se ejecuta automáticamente**. Esta función existe en la base de datos pero no hay nada que la invoque.

```sql
-- Esta función existe pero no se llama automáticamente
public.process_expired_subscriptions()
```

**Flujo actual (ROTO):**
1. ✅ Usuario programa downgrade → se guarda `scheduled_tier`
2. ✅ Se muestra en la UI "Cambio programado"
3. ❌ Llega la fecha de expiración → NADA PASA
4. ❌ El usuario mantiene el tier premium indefinidamente

**CAUSA RAÍZ:** No hay un cron job, edge function, o trigger temporal que ejecute `process_expired_subscriptions()`.

---

### 1.2 Por qué Falla el Cobro Automático

**PROBLEMAS IDENTIFICADOS:**

1. **Edge Function no desplegada**: La función `auto-renewal/index.ts` existe localmente pero no está desplegada en Supabase.

2. **No hay cron job configurado**: No existe ningún cron que llame a la edge function.

3. **No hay método de pago guardado**: La UI no tiene flujo para que el usuario guarde su tarjeta para cobros automáticos.

4. **MercadoPago no soporta cobros recurrentes simples**: MP requiere usar "Suscripciones" (Subscription API) o "Pagos recurrentes" con card tokens, que tienen flujos específicos.

5. **RLS causa errores 500**: Las políticas de `tenants` causaban recursión infinita (ya se arregló pero puede haber secuelas).

---

## 2. ARQUITECTURA CORRECTA PROPUESTA

### 2.1 Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React + Vite)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  SubscriptionCheckout  │  SubscriptionStatus  │  SubscriptionPanel          │
│  - Upgrade             │  - Estado actual     │  - Historial                │
│  - Downgrade programado│  - Auto-renew toggle │  - Cancelar cambio          │
│  - Guardar tarjeta     │  - Próximo cobro     │  - Método de pago           │
└───────────────┬─────────────────┬─────────────────────┬─────────────────────┘
                │                 │                     │
                ▼                 ▼                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         API LAYER (Supabase Client)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  supabaseMercadopagoApi.js  │  supabaseSubscriptionApi.js                   │
│  - scheduleTierChange()      │  - getActiveSubscription()                   │
│  - cancelScheduledChange()   │  - getSubscriptionHistory()                  │
│  - savePaymentMethod()       │  - setAutoRenew()                            │
└───────────────┬─────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SUPABASE (Backend)                                 │
├──────────────────────┬──────────────────────┬───────────────────────────────┤
│     RPC Functions    │   Database Tables    │     Edge Functions            │
│                      │                      │                               │
│  schedule_tier_      │  tenants             │  process-subscriptions        │
│    change()          │  - scheduled_tier    │  (CRON diario 08:00)          │
│                      │  - scheduled_at      │                               │
│  cancel_scheduled_   │  - auto_renew        │  Responsabilidades:           │
│    tier_change()     │  - premium_until     │  1. Aplicar downgrades        │
│                      │                      │  2. Procesar auto-renovación  │
│  process_expired_    │  tenant_payment_     │  3. Enviar recordatorios      │
│    subscriptions()   │    methods           │  4. Loggear intentos          │
│                      │                      │                               │
│  update_tenant_      │  auto_renewal_log    │                               │
│    subscription()    │                      │                               │
│                      │  platform_           │                               │
│                      │    subscriptions     │                               │
└──────────────────────┴──────────────────────┴───────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MERCADOPAGO API                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Para UPGRADES:                  │  Para AUTO-RENOVACIÓN:                   │
│  - Checkout Pro (init_point)     │  - Opción A: MP Suscripciones            │
│  - Webhook para confirmar pago   │  - Opción B: Cobro con card token        │
│                                  │    (requiere PCI compliance)             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Flujo de Estados del Sistema

```
                              ┌─────────────────┐
                              │      FREE       │
                              │   Sin límite    │
                              │   de tiempo     │
                              └────────┬────────┘
                                       │
                         Upgrade (pago exitoso)
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PREMIUM / PRO                                   │
│                                                                              │
│  Estado: ACTIVO                                                              │
│  - premium_until = fecha futura                                              │
│  - subscription_tier = 'premium' | 'premium_pro'                             │
│  - scheduled_tier = NULL                                                     │
│  - auto_renew = true/false                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
          │                    │                    │
          │                    │                    │
    Downgrade            7 días antes          1 día antes
    programado           de expirar            de expirar
          │                    │                    │
          ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────────────┐
│  CAMBIO         │  │  ALERTA         │  │  AUTO-RENOVACIÓN                    │
│  PROGRAMADO     │  │  EXPIRANDO      │  │                                     │
│                 │  │                 │  │  IF auto_renew = true:              │
│  scheduled_tier │  │  Enviar email   │  │    - Intentar cobro                 │
│  = 'free' |     │  │  recordatorio   │  │    - Si exitoso: extender 30 días   │
│    'premium'    │  │                 │  │    - Si falla: notificar usuario    │
└─────────────────┘  └─────────────────┘  │                                     │
                                          │  IF auto_renew = false:             │
                                          │    - Enviar último recordatorio     │
                                          └─────────────────────────────────────┘
                                                         │
                                                         │
                                            Día de expiración (premium_until)
                                                         │
                                                         ▼
                              ┌─────────────────────────────────────────────────┐
                              │  PROCESO DE EXPIRACIÓN (CRON)                   │
                              │                                                 │
                              │  1. Buscar tenants con premium_until < NOW()    │
                              │                                                 │
                              │  2. Para cada uno:                              │
                              │     IF scheduled_tier:                          │
                              │       - Aplicar scheduled_tier                  │
                              │       - Limpiar scheduled_tier/at               │
                              │     ELSE:                                       │
                              │       - Pasar a FREE                            │
                              │                                                 │
                              │  3. Ajustar limits según nuevo tier             │
                              │  4. Loggear en subscription_history             │
                              └─────────────────────────────────────────────────┘
```

---

## 3. SOLUCIÓN: EDGE FUNCTION UNIFICADA

En lugar de tener múltiples cron jobs, crear UNA edge function que maneje todo:

### 3.1 Edge Function: `process-subscriptions`

```typescript
// supabase/functions/process-subscriptions/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface ProcessResult {
  expirations: { processed: number; details: any[] }
  renewals: { processed: number; success: number; failed: number; details: any[] }
  reminders: { sent: number; details: any[] }
}

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  
  const results: ProcessResult = {
    expirations: { processed: 0, details: [] },
    renewals: { processed: 0, success: 0, failed: 0, details: [] },
    reminders: { sent: 0, details: [] }
  }

  // ============================================================
  // PASO 1: Procesar suscripciones EXPIRADAS (premium_until < NOW)
  // Aplica downgrades programados o pasa a FREE
  // ============================================================
  
  const { data: expiredTenants } = await supabase
    .from('tenants')
    .select('id, name, subscription_tier, scheduled_tier, premium_until, auto_renew')
    .lt('premium_until', new Date().toISOString())
    .neq('subscription_tier', 'free')
  
  for (const tenant of expiredTenants || []) {
    const newTier = tenant.scheduled_tier || 'free'
    const newLimit = newTier === 'premium_pro' ? null : newTier === 'premium' ? 80 : 15
    
    await supabase
      .from('tenants')
      .update({
        subscription_tier: newTier,
        premium_until: null,
        scheduled_tier: null,
        scheduled_at: null,
        orders_limit: newLimit,
        orders_remaining: newLimit,
      })
      .eq('id', tenant.id)
    
    // Log del cambio
    await supabase.from('subscription_audit_log').insert({
      tenant_id: tenant.id,
      action: 'EXPIRED',
      old_tier: tenant.subscription_tier,
      new_tier: newTier,
      details: { scheduled: !!tenant.scheduled_tier }
    })
    
    results.expirations.processed++
    results.expirations.details.push({ 
      tenant_id: tenant.id, 
      from: tenant.subscription_tier, 
      to: newTier 
    })
  }

  // ============================================================
  // PASO 2: Procesar AUTO-RENOVACIONES (vence en 1-2 días)
  // Solo si auto_renew = true
  // ============================================================
  
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 2)
  
  const { data: toRenew } = await supabase
    .from('tenants')
    .select(`
      id, name, subscription_tier, premium_until, auto_renew,
      tenant_payment_methods!inner(mp_customer_id, mp_card_id)
    `)
    .eq('auto_renew', true)
    .is('scheduled_tier', null)
    .gte('premium_until', new Date().toISOString())
    .lte('premium_until', tomorrow.toISOString())
  
  for (const tenant of toRenew || []) {
    results.renewals.processed++
    
    const paymentMethod = tenant.tenant_payment_methods?.[0]
    
    if (!paymentMethod?.mp_card_id) {
      // No tiene método de pago - enviar recordatorio
      results.reminders.sent++
      results.reminders.details.push({ tenant_id: tenant.id, reason: 'no_payment_method' })
      continue
    }
    
    // Intentar cobro con MercadoPago
    // NOTA: Esto requiere implementar la lógica de MP con card tokens
    // Por ahora, simulamos el intento
    
    const paymentSuccess = false // TODO: Implementar cobro real
    
    if (paymentSuccess) {
      // Extender suscripción 30 días
      const newExpiry = new Date(tenant.premium_until)
      newExpiry.setDate(newExpiry.getDate() + 30)
      
      await supabase
        .from('tenants')
        .update({ premium_until: newExpiry.toISOString() })
        .eq('id', tenant.id)
      
      results.renewals.success++
    } else {
      // Falló el cobro
      await supabase.from('auto_renewal_log').insert({
        tenant_id: tenant.id,
        subscription_tier: tenant.subscription_tier,
        status: 'failed',
        error_message: 'Payment failed',
      })
      
      results.renewals.failed++
    }
  }

  // ============================================================
  // PASO 3: Enviar RECORDATORIOS (vence en 7 días)
  // ============================================================
  
  const inSevenDays = new Date()
  inSevenDays.setDate(inSevenDays.getDate() + 7)
  
  const { data: expiringSoon } = await supabase
    .from('tenants')
    .select('id, name, premium_until')
    .eq('auto_renew', false)
    .is('scheduled_tier', null)
    .gte('premium_until', new Date().toISOString())
    .lte('premium_until', inSevenDays.toISOString())
  
  for (const tenant of expiringSoon || []) {
    // TODO: Enviar email con Resend/SendGrid
    results.reminders.sent++
    results.reminders.details.push({ tenant_id: tenant.id, reason: 'expiring_soon' })
  }

  return new Response(JSON.stringify({
    success: true,
    timestamp: new Date().toISOString(),
    results
  }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

### 3.2 Configurar Cron Job

```sql
-- En Supabase SQL Editor (requiere extensión pg_cron)
-- Ejecutar la edge function todos los días a las 8:00 AM

SELECT cron.schedule(
  'process-subscriptions-daily',
  '0 8 * * *',  -- Todos los días a las 8:00
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/process-subscriptions',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

---

## 4. IMPLEMENTACIÓN DE AUTO-COBRO CON MERCADOPAGO

### 4.1 Problema con Cobros Recurrentes

MercadoPago NO permite cobrar directamente con un token de tarjeta guardado sin que el usuario autorice cada cobro, EXCEPTO si usas:

1. **Suscripciones de MercadoPago** (Subscriptions API)
2. **Pagos recurrentes con preauthorization** (requiere aprobación especial de MP)

### 4.2 Solución Recomendada: Usar MP Subscriptions API

En lugar de cobrar manualmente, crear una suscripción en MercadoPago:

```javascript
// Al activar auto_renew = true, crear suscripción en MP

export async function createMPSubscription(tenantId, tier, payerEmail) {
  const plans = {
    premium: 'PLAN_ID_PREMIUM',      // Crear en MP Dashboard
    premium_pro: 'PLAN_ID_PRO',      // Crear en MP Dashboard
  }
  
  const response = await fetch('https://api.mercadopago.com/preapproval', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      preapproval_plan_id: plans[tier],
      payer_email: payerEmail,
      external_reference: tenantId,
      back_url: `${APP_URL}/subscription/callback`,
    })
  })
  
  const data = await response.json()
  return data.init_point // URL para que el usuario autorice
}
```

### 4.3 Flujo con MP Subscriptions

```
Usuario activa auto-renew
         │
         ▼
┌─────────────────────────────────────┐
│  Crear preapproval en MercadoPago   │
│  → Redirigir a MP para autorizar    │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│  Usuario autoriza suscripción       │
│  en el sitio de MercadoPago         │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│  Webhook recibe confirmación        │
│  → Guardar preapproval_id           │
│  → Marcar auto_renew = true         │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│  MP cobra automáticamente cada mes  │
│  → Webhook recibe authorized_payment│
│  → Extender premium_until           │
└─────────────────────────────────────┘
```

---

## 5. TABLAS Y MIGRACIONES NECESARIAS

### 5.1 Nueva Migración: Sistema Completo

```sql
-- supabase/migrations/complete_subscription_automation.sql

-- ============================================================================
-- 1. Tabla de auditoría para cambios de suscripción
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subscription_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- UPGRADED, DOWNGRADED, EXPIRED, RENEWED, CANCELLED
  old_tier TEXT,
  new_tier TEXT,
  amount NUMERIC(10,2),
  payment_id TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant ON subscription_audit_log(tenant_id);
CREATE INDEX idx_audit_created ON subscription_audit_log(created_at);

-- ============================================================================
-- 2. Tabla para suscripciones de MercadoPago (preapprovals)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.mp_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  mp_preapproval_id TEXT NOT NULL UNIQUE, -- ID de la suscripción en MP
  mp_plan_id TEXT, -- ID del plan en MP
  status TEXT DEFAULT 'pending', -- pending, authorized, paused, cancelled
  payer_email TEXT,
  next_payment_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mp_sub_tenant ON mp_subscriptions(tenant_id);
CREATE INDEX idx_mp_sub_status ON mp_subscriptions(status);

-- ============================================================================
-- 3. RPC para procesar expiración (llamado por cron)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.process_subscription_expirations()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant RECORD;
  v_new_tier TEXT;
  v_processed INT := 0;
  v_results JSONB := '[]';
BEGIN
  FOR v_tenant IN 
    SELECT * FROM public.tenants 
    WHERE premium_until < NOW() 
      AND subscription_tier != 'free'
  LOOP
    v_new_tier := COALESCE(v_tenant.scheduled_tier, 'free');
    
    UPDATE public.tenants SET
      subscription_tier = v_new_tier,
      premium_until = NULL,
      scheduled_tier = NULL,
      scheduled_at = NULL,
      orders_limit = CASE 
        WHEN v_new_tier = 'premium_pro' THEN NULL 
        WHEN v_new_tier = 'premium' THEN 80 
        ELSE 15 
      END,
      orders_remaining = CASE 
        WHEN v_new_tier = 'premium_pro' THEN NULL 
        WHEN v_new_tier = 'premium' THEN 80 
        ELSE 15 
      END
    WHERE id = v_tenant.id;
    
    INSERT INTO subscription_audit_log (tenant_id, action, old_tier, new_tier, details)
    VALUES (v_tenant.id, 'EXPIRED', v_tenant.subscription_tier, v_new_tier, 
            jsonb_build_object('had_scheduled', v_tenant.scheduled_tier IS NOT NULL));
    
    v_processed := v_processed + 1;
    v_results := v_results || jsonb_build_object(
      'tenant_id', v_tenant.id,
      'old_tier', v_tenant.subscription_tier,
      'new_tier', v_new_tier
    );
  END LOOP;
  
  RETURN jsonb_build_object('processed', v_processed, 'results', v_results);
END;
$$;

-- ============================================================================
-- 4. Permisos
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.process_subscription_expirations TO service_role;
```

---

## 6. CHECKLIST DE IMPLEMENTACIÓN

### 6.1 Prioridad ALTA (Crítico)

- [ ] **Desplegar Edge Function** `process-subscriptions`
- [ ] **Configurar Cron Job** para ejecutar diariamente
- [ ] **Arreglar políticas RLS** de tenants (ejecutar fix_tenants_policies_complete.sql)
- [ ] **Probar downgrade programado** end-to-end

### 6.2 Prioridad MEDIA (Importante)

- [ ] **Implementar MP Subscriptions API** para auto-renovación real
- [ ] **Crear webhook** para recibir notificaciones de pago de MP
- [ ] **Agregar UI** para que usuario vea/gestione su suscripción MP
- [ ] **Enviar emails** de recordatorio (integrar Resend o SendGrid)

### 6.3 Prioridad BAJA (Nice to have)

- [ ] Dashboard de admin para ver todas las renovaciones
- [ ] Métricas de churn y retention
- [ ] Notificaciones push cuando falla un cobro
- [ ] Reintentos automáticos de cobro fallido

---

## 7. CONSIDERACIONES DE SEGURIDAD

1. **Nunca almacenar datos de tarjeta** - Solo tokens de MP
2. **Usar SECURITY DEFINER** en funciones RPC que modifiquen suscripciones
3. **Validar siempre el owner** antes de permitir cambios
4. **Loggear TODA acción** en `subscription_audit_log`
5. **Webhook con firma** - Verificar que las notificaciones vienen de MP

---

## 8. BUENAS PRÁCTICAS DE MERCADOPAGO

1. **Usar Checkout Pro** para pagos puntuales (upgrades)
2. **Usar Subscriptions API** para cobros recurrentes
3. **Implementar webhooks** para confirmar pagos (no confiar solo en redirect)
4. **Idempotency keys** para evitar cobros duplicados
5. **Ambiente Sandbox** para testing completo antes de producción
6. **Manejo de errores** - tener flujos para pagos rechazados, insuficiente fondos, etc.
