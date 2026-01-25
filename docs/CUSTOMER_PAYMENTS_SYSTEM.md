# 💳 Sistema de Pagos de Clientes - MercadoPago Checkout Pro

## 📋 Resumen

Sistema completo de pagos para compras de clientes en tiendas usando **MercadoPago Checkout Pro**.
El dinero va **DIRECTO** a la cuenta del admin/tenant usando su propio `access_token`.

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                        │
│  Cliente hace click "Pagar con MercadoPago"                                 │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EDGE FUNCTION: create-store-preference                    │
│                                                                              │
│  1. ✅ Validar datos de entrada                                             │
│  2. ✅ Obtener credenciales MP del TENANT (no plataforma)                   │
│  3. ✅ RECALCULAR total desde DB (anti-fraude)                              │
│  4. ✅ Crear orden en DB con idempotency_key                                │
│  5. ✅ Crear preferencia en MP con external_reference                       │
│  6. ✅ Retornar init_point para redirección                                 │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MERCADOPAGO CHECKOUT PRO                             │
│                                                                              │
│  Cliente paga en el checkout de MP (tarjeta, débito, efectivo, etc)         │
│  MP redirige al usuario a back_urls según resultado                         │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
                    ▼            ▼            ▼
               success       pending      failure
                    │            │            │
                    └────────────┼────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PÁGINA: PaymentResult                                     │
│                                                                              │
│  - Muestra estado visual al usuario                                         │
│  - Actualiza estado local de la orden (UI)                                  │
│  - ⚠️ NO es la fuente de verdad (el webhook lo es)                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                 │
                                 │ (en paralelo)
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WEBHOOK: store-payment-webhook                            │
│                                                                              │
│  1. ✅ Validar firma del webhook (x-signature)                              │
│  2. ✅ Verificar idempotencia (mp_payment_id único)                         │
│  3. ✅ Consultar pago REAL en API de MercadoPago                            │
│  4. ✅ Validar: tenant correcto, monto coincide, currency ARS               │
│  5. ✅ Registrar evento en payment_events                                   │
│  6. ✅ Actualizar orden via función SQL idempotente                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📂 Archivos Creados/Modificados

### Backend (Edge Functions)

| Archivo | Descripción |
|---------|-------------|
| `supabase/functions/create-store-preference/index.ts` | Crea preferencia de pago usando token del TENANT |
| `supabase/functions/store-payment-webhook/index.ts` | Recibe y valida webhooks de MP |

### Frontend

| Archivo | Descripción |
|---------|-------------|
| `src/lib/customerPaymentsApi.js` | API para pagos de clientes |
| `src/lib/supabaseOrdersApi.js` | Actualizado con nuevos estados |
| `src/pages/Storefront/StorefrontPage.jsx` | Checkout actualizado |
| `src/pages/Payment/PaymentResult.jsx` | Manejo de resultados |

### Base de Datos

| Archivo | Descripción |
|---------|-------------|
| `supabase/migrations/add_customer_payments_system.sql` | Tablas y funciones SQL |

---

## 📊 Estados de Pago

| Estado | Descripción | Acción |
|--------|-------------|--------|
| `pending` | Orden creada, esperando pago | Mostrar botón MP |
| `processing_payment` | Pago en proceso (MP pendiente) | Mostrar "procesando" |
| `paid` | Pago aprobado y verificado | Confirmar orden |
| `rejected` | Pago rechazado por MP | Cancelar orden |
| `cancelled` | Orden cancelada | - |
| `expired` | Preferencia expirada (24h) | Permitir reintentar |
| `refunded` | Pago reembolsado | - |

---

## 🔒 Seguridad Implementada

### Anti-Fraude

1. **Recálculo de total en backend**: No confiar en el total del frontend
2. **Validación de productos desde DB**: Verificar precios reales
3. **Idempotency key única**: Evitar órdenes duplicadas
4. **Verificación de firma webhook**: Validar que el webhook es de MP
5. **Consulta directa a API de MP**: Confirmar estado real del pago
6. **Validación de monto**: Comparar total de orden vs monto pagado
7. **Validación de tenant**: Asegurar que el pago corresponde al tenant correcto

### Idempotencia

- Cada orden tiene un `idempotency_key` único
- La función `verify_and_complete_payment` es idempotente
- Los webhooks duplicados no procesan dos veces

---

## 🔧 Configuración Requerida

### Variables de Entorno (Supabase Edge Functions)

```env
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx

# App URL (para back_urls)
APP_URL=https://tudominio.com

# Webhook URL (opcional, se genera automáticamente)
WEBHOOK_URL=https://xxx.supabase.co/functions/v1/store-payment-webhook

# Token de fallback (opcional, para emergencias)
MP_FALLBACK_ACCESS_TOKEN=xxx
```

### Configuración del Tenant

Cada tenant debe configurar en su dashboard:

1. **Access Token** de MercadoPago (producción o sandbox)
2. **Public Key** (para futuro uso de Checkout Bricks)
3. **Webhook Secret** (opcional, para validación de firma)

---

## 📡 Endpoints

### Edge Function: create-store-preference

```
POST /functions/v1/create-store-preference
```

**Request:**
```json
{
  "tenantId": "uuid",
  "items": [
    {
      "productId": "uuid",
      "name": "Hamburguesa",
      "unitPrice": 1500,
      "qty": 2,
      "lineTotal": 3000,
      "extras": [],
      "comment": "Sin cebolla"
    }
  ],
  "customer": {
    "name": "Juan Pérez",
    "phone": "+5491123456789",
    "email": "juan@email.com"
  },
  "deliveryType": "domicilio",
  "deliveryAddress": "Av. Corrientes 1234",
  "deliveryNotes": "Timbre 2B"
}
```

**Response:**
```json
{
  "success": true,
  "orderId": "uuid",
  "preferenceId": "123456789-xxx",
  "initPoint": "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=...",
  "sandboxInitPoint": "https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=...",
  "total": 3000,
  "idempotencyKey": "ord_xxx"
}
```

### Webhook: store-payment-webhook

```
POST /functions/v1/store-payment-webhook
```

**Headers requeridos:**
- `x-signature`: Firma de MercadoPago
- `x-request-id`: ID único del request

**Payload de MP:**
```json
{
  "type": "payment",
  "action": "payment.created",
  "data": {
    "id": "123456789"
  }
}
```

---

## 🧪 Testing

### Tarjetas de Prueba (Sandbox)

| Tarjeta | Resultado |
|---------|-----------|
| 5031 7557 3453 0604 | Aprobado |
| 4509 9535 6623 3704 | Rechazado |

**Nombre del titular para aprobar:** `APRO`
**CVV:** Cualquier 3 dígitos
**Vencimiento:** Cualquier fecha futura

### Probar Webhook Local

```bash
# Usando Supabase CLI
supabase functions serve store-payment-webhook --env-file .env.local

# Enviar test webhook
curl -X POST http://localhost:54321/functions/v1/store-payment-webhook \
  -H "Content-Type: application/json" \
  -d '{"type":"payment","data":{"id":"123456"}}'
```

---

## 🚀 Deploy

### 1. Aplicar migración SQL

```bash
# En Supabase Dashboard > SQL Editor
# Ejecutar: supabase/migrations/add_customer_payments_system.sql
```

### 2. Deploy Edge Functions

```bash
supabase functions deploy create-store-preference
supabase functions deploy store-payment-webhook
```

### 3. Configurar Webhook en MercadoPago

1. Ir a [MercadoPago Developers](https://www.mercadopago.com.ar/developers)
2. Tu integración > Webhooks > Configurar notificaciones
3. URL: `https://TU_PROJECT.supabase.co/functions/v1/store-payment-webhook`
4. Eventos: `payment`

---

## 📈 Flujo Completo Paso a Paso

1. **Cliente** agrega productos al carrito
2. **Cliente** completa datos y selecciona "Pagar con MercadoPago"
3. **Frontend** llama a Edge Function `create-store-preference`
4. **Edge Function**:
   - Obtiene `access_token` del TENANT
   - Recalcula total desde DB
   - Crea orden con estado `pending`
   - Crea preferencia en MP
   - Retorna `init_point`
5. **Frontend** redirige a `init_point` de MercadoPago
6. **Cliente** paga en Checkout Pro de MP
7. **MercadoPago** redirige a `back_urls` según resultado
8. **PaymentResult** muestra estado visual (informativo)
9. **MercadoPago** envía webhook a `store-payment-webhook`
10. **Webhook**:
    - Valida firma
    - Consulta pago en API de MP
    - Verifica monto y tenant
    - Actualiza orden de forma idempotente
11. **Admin** ve la orden confirmada en su dashboard

---

## ⚠️ Notas Importantes

1. **NO confiar en `success_url`** para confirmar pagos - solo es UI
2. **El webhook es la fuente de verdad** para estados de pago
3. **Cada tenant usa SU token** - el dinero va directo a su cuenta
4. **La plataforma NO toca el dinero** de las ventas de tiendas
5. **Preferencias expiran en 24 horas** por defecto
