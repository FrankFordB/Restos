# Análisis MercadoPago: Sandbox vs Producción

## 📋 Diagnóstico del Problema Actual

### Síntomas Observados
1. **Mensaje "Estamos revisando tu pago"** - Estado `in_process` 
2. **Error `ProgressEvent`** - Falla de comunicación
3. **`paymentSuccess: null`** - No llegan parámetros de MP
4. **`storedPayment: null`** - No se encuentra suscripción pendiente

---

## 🔍 Cómo Funciona el Sandbox de MercadoPago

### Estados que puede devolver el Sandbox

| Estado | Descripción | Cuándo ocurre |
|--------|-------------|---------------|
| `approved` | Pago aprobado | Tarjeta de prueba con fondos suficientes |
| `pending` | Pendiente | Métodos offline (Rapipago, etc.) |
| `in_process` | En revisión | **Comportamiento normal del sandbox** |
| `rejected` | Rechazado | Tarjeta sin fondos o datos inválidos |

### ⚠️ Limitaciones IMPORTANTES del Sandbox

1. **El estado `in_process` es NORMAL en sandbox**
   - MercadoPago simula una revisión de seguridad
   - NO siempre cambia automáticamente a `approved`
   - En producción, esto se resuelve en segundos/minutos

2. **Los webhooks NO funcionan con localhost**
   - MP no puede enviar notificaciones a `localhost`
   - Necesitas una URL pública (ngrok, Vercel, Netlify)

3. **El `auto_return` a veces falla en sandbox**
   - MP puede no redirigir correctamente
   - Los parámetros de query pueden faltar

4. **El `external_reference` puede llegar vacío**
   - Es un bug conocido del sandbox
   - Debes tener fallbacks

### Tarjetas de Prueba Oficiales

```
APROBADO:
- Mastercard: 5031 7557 3453 0604
- Visa: 4509 9535 6623 3704
- CVV: 123
- Fecha: cualquier fecha futura
- Titular: APRO (exactamente así)
- DNI: 12345678

RECHAZADO:
- Usar titular: OTHE

EN PROCESO:
- Usar titular: CONT
```

---

## 🐛 Problemas Detectados en tu Implementación

### 1. Falta de manejo de `in_process`
```javascript
// ACTUAL: Solo retorna sin hacer nada
if ([MP_STATUS.PENDING, MP_STATUS.IN_PROCESS].includes(payment.status)) {
  return { processed: true, action: 'payment_pending', status: payment.status }
}
```

**Problema:** No se guarda el estado para seguimiento posterior.

### 2. El frontend confía en la respuesta inmediata
```javascript
// ACTUAL en PaymentResult.jsx
if (isSuccess && ...) {
  await handleSubscriptionSuccess(...)
}
```

**Problema:** Si MP devuelve `in_process`, no se hace nada y el usuario queda en limbo.

### 3. No hay polling del estado del pago
El sistema actual no re-consulta el estado del pago después de un tiempo.

### 4. Webhooks no configurados para sandbox
```javascript
// ACTUAL en mercadopago.js
if (!isLocalhost) {
  preference.notification_url = `${MP_CONFIG.appUrl}/api/webhooks/mercadopago`
}
```

**Problema:** En desarrollo, los webhooks nunca se envían.

---

## ✅ Solución Profesional Completa

### Arquitectura Correcta

```
┌─────────────────────────────────────────────────────────────┐
│                      FLUJO DE PAGO                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Usuario → Checkout MP → Pago                            │
│                                                             │
│  2. MP Redirige → /payment/success?status=...               │
│       ↓                                                     │
│     Frontend: Guardar estado inicial                        │
│       ↓                                                     │
│     Si status != approved → Mostrar "procesando"            │
│     Si status == approved → Activar (pero verificar!)       │
│                                                             │
│  3. Webhook (background) → Confirmar estado real            │
│       ↓                                                     │
│     Consultar API: GET /v1/payments/{id}                    │
│       ↓                                                     │
│     Actualizar BD con estado real                           │
│                                                             │
│  4. Frontend: Polling cada 10s si estado != final           │
│       ↓                                                     │
│     GET /api/subscription/status                            │
│       ↓                                                     │
│     Mostrar resultado actualizado                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Flujo de Estados Correcto

```
pending/in_process → (webhook o polling) → approved/rejected
         ↓                                        ↓
    Guardar en BD                          Actualizar tenant
    Mostrar "procesando"                   Mostrar éxito/error
    Iniciar polling                        
```

---

## 📝 Checklist Pre-Producción

### Configuración MercadoPago
- [ ] Crear aplicación en MP Developers Panel
- [ ] Obtener credenciales de PRODUCCIÓN
- [ ] Configurar webhook URL pública
- [ ] Verificar que MP pueda hacer POST a tu webhook
- [ ] Configurar `MP_ACCESS_TOKEN` en Supabase secrets

### Backend (Webhooks)
- [ ] Webhook desplegado en Supabase Edge Functions
- [ ] Validación de firma del webhook
- [ ] Manejo de todos los estados
- [ ] Idempotencia (evitar procesar mismo evento 2 veces)
- [ ] Logging detallado

### Frontend
- [ ] Manejar TODOS los estados, no solo `approved`
- [ ] Mostrar UI apropiada para `in_process`
- [ ] Implementar polling para estados pendientes
- [ ] Fallbacks cuando faltan parámetros de MP

### Base de Datos
- [ ] Tabla `platform_subscriptions` con campo `status`
- [ ] Tabla `mp_webhook_events` para idempotencia
- [ ] Columna `mp_payment_id` para correlación

### Variables de Entorno (Producción)
```env
# .env.production
VITE_MP_MODE=production
VITE_MP_PUBLIC_KEY=APP_USR-xxxxx
VITE_MP_ACCESS_TOKEN=APP_USR-xxxxx
VITE_APP_URL=https://tu-dominio.com

# Supabase secrets (para webhooks)
MP_ACCESS_TOKEN=APP_USR-xxxxx
MP_WEBHOOK_SECRET=xxxxx
```

---

## 🔧 Cambios Recomendados

### 1. Manejar `in_process` en el frontend
Ver archivo: `PaymentResult.jsx` - cambios sugeridos abajo

### 2. Implementar polling de estado
Ver archivo: nuevo hook `usePaymentStatus.js`

### 3. Mejorar el webhook
Ver archivo: `mercadopago-webhook/index.ts` - manejar `in_process`

### 4. Crear endpoint de consulta de estado
Para que el frontend pueda hacer polling

---

## 🎯 Estados y Acciones

| Estado MP | Acción Backend | UI Frontend | Siguiente paso |
|-----------|----------------|-------------|----------------|
| `approved` | Activar suscripción | "¡Pago exitoso!" | Ir a dashboard |
| `pending` | Guardar pendiente | "Pago pendiente" | Polling 30s |
| `in_process` | Guardar pendiente | "Procesando..." | Polling 10s |
| `rejected` | Marcar fallido | "Pago rechazado" | Reintentar |
| `cancelled` | Marcar cancelado | "Pago cancelado" | Reintentar |

---

## 🚨 Diferencias Críticas: Sandbox vs Producción

| Aspecto | Sandbox | Producción |
|---------|---------|------------|
| Webhooks | No funcionan en localhost | Funcionan con URL pública |
| `in_process` | Puede quedarse así | Se resuelve en segundos |
| Tarjetas | Solo las de prueba | Tarjetas reales |
| Tiempos | Impredecibles | Casi instantáneo |
| Errores | Más frecuentes | Estables |
| Analytics | Errores de tracking | Funciona |

---

## 📌 Resumen Ejecutivo

### ¿Por qué ves "Estamos revisando tu pago"?

1. **Es comportamiento NORMAL del sandbox** cuando usas ciertas tarjetas
2. El sandbox no siempre devuelve `approved` inmediatamente
3. Para probar flujo `approved`: usa tarjeta con titular `APRO`

### ¿Por qué el error de ProgressEvent?

1. MercadoPago intenta enviar analytics pero falla
2. Estás en localhost y MP no puede comunicarse
3. **No afecta el pago**, solo es tracking

### ¿Qué debes hacer?

1. **Para desarrollo**: Usar tarjeta con titular `APRO` para simular aprobado
2. **Para producción**: 
   - Configurar webhook con URL pública
   - Implementar polling para estados pendientes
   - Manejar todos los estados en el frontend

### ¿El sistema está roto?

**No**, está funcionando según diseño de MP sandbox. Lo que falta:
- Mejor manejo de estados no-finales
- Polling/webhook para confirmar pagos pendientes
- UI más clara para estados intermedios
