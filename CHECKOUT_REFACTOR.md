# Refactorización del Flujo de Checkout - Procesar Pedido

## Descripción General
Se ha refactorizado completamente el flujo de checkout en una **single page** que reemplaza las cards de productos cuando el usuario presiona "Ir a Pagar". Ahora el proceso es más fluido y permite volver al carrito si falta algo.

## Cambios Principales

### 1. **Estado del Checkout** (StorefrontPage.jsx)
```javascript
// Antes: Modal de checkout
const [showCheckoutModal, setShowCheckoutModal] = useState(false)

// Ahora: Single page checkout
const [isCheckingOut, setIsCheckingOut] = useState(false)
const [checkoutData, setCheckoutData] = useState({
  customerName: '',
  customerPhone: '',
  deliveryType: 'mostrador',
  deliveryAddress: '',
  deliveryNotes: '',
  paymentMethod: 'efectivo',
})
const [checkoutLoading, setCheckoutLoading] = useState(false)
const [checkoutError, setCheckoutError] = useState(null)
```

### 2. **Componente CheckoutPage (Nueva Single Page)**

#### Características:
- ✅ **Validación de Campos**: 
  - Nombre del cliente (requerido)
  - Teléfono del cliente (requerido)
  - Dirección de entrega (requerida solo si es domicilio)
  
- ✅ **Estados Visuales**:
  - Campos con checkmark (✓) cuando son válidos
  - Botón "Procesar Pago" **deshabilitado** hasta que todos los datos estén completos
  - Indicador visual del progreso de validación

- ✅ **Botón "Volver al Carrito"**:
  - Permite regresar si se olvida algo
  - Limpia los datos del checkout
  - Mantiene el carrito intacto

- ✅ **Resumen Visual**:
  - Items del carrito con cantidad y precio
  - Total resaltado en color
  - Scrolleable si hay muchos items

- ✅ **Formulario Dinámico**:
  - Tipo de Entrega: Mostrador, A Domicilio, En Mesa
  - Dirección de entrega solo aparece si es "A Domicilio"
  - Forma de Pago: Efectivo, Tarjeta, QR

#### Validación:
```javascript
const isNameValid = checkoutData.customerName.trim().length > 0
const isPhoneValid = checkoutData.customerPhone.trim().length > 0
const isAddressValid = checkoutData.deliveryType === 'domicilio' 
  ? checkoutData.deliveryAddress.trim().length > 0 
  : true

const isAllDataValid = isNameValid && isPhoneValid && isAddressValid
const canProcessPayment = isAllDataValid && !checkoutLoading
```

### 3. **Flujo de Navegación**

#### Antes:
```
Mostrar Products → Carrito (panel lateral) → Presionar "Procesar Pedido" → Modal aparece
```

#### Ahora:
```
Mostrar Products → Carrito (panel lateral) → Presionar "Procesar Pedido"
  ↓
  CheckoutPage (Single Page - reemplaza las cards)
  ├─ Formulario con validación en tiempo real
  ├─ Botón "Volver al Carrito" (si falta algo)
  └─ Botón "Procesar Pago" (deshabilitado hasta validar)
       ↓
       Enviar orden al Dashboard
```

### 4. **Sincronización entre StorefrontPage y Dashboard**

Cuando el usuario confirma el pago:

1. **StorefrontPage** envía los datos:
```javascript
const res = await dispatch(
  createPaidOrder({
    tenantId,
    items: orderItemsPayload,
    total: cartTotal,
    customer_name: checkoutData.customerName,
    customer_phone: checkoutData.customerPhone,
    delivery_type: checkoutData.deliveryType,
    delivery_address: checkoutData.deliveryType === 'domicilio' ? checkoutData.deliveryAddress : null,
    delivery_notes: checkoutData.deliveryNotes,
    payment_method: checkoutData.paymentMethod,
  })
)
```

2. **Dashboard (OrdersManager)** recibe automáticamente:
   - El pedido aparece en el panel de "Pedidos"
   - Se puede filtrar por estado, tipo de entrega, pago
   - Se puede imprimir, enviar WhatsApp, etc.

### 5. **Estilos CSS Nuevos**

Se agregaron ~400 líneas de CSS responsive para:
- `.checkoutPage` - Contenedor principal con animación
- `.checkoutPage__header` - Encabezado con botón "Volver"
- `.checkoutPage__container` - Layout de 2 columnas (form + actions sidebar)
- `.checkoutPage__form` - Formulario con secciones
- `.checkoutPage__section` - Secciones con bordes y estilos
- `.checkoutPage__input` - Campos con validación visual
- `.checkoutPage__deliveryType` - Botones de tipo entrega
- `.checkoutPage__paymentMethod` - Botones de forma de pago
- `.checkoutPage__btnProcess` - Botón principal (enabled/disabled)
- `.checkoutPage__validation` - Mensajes de validación
- Responsive para mobile, tablet y desktop

## Comportamiento Visual

### Estado Inicial (Carrito Visible):
```
┌─────────────────────────────────┐
│  PRODUCTOS                      │
│  - Pizza Margherita             │
│  - Milanesa                     │
│  - Fernet                       │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│  CARRITO                        │
│  Items: 3                       │
│  Total: $450.00                 │
│  [Procesar Pedido]              │
└─────────────────────────────────┘
```

### Estado Checkout (Procesar Pedido):
```
        [← Volver]     Procesar Pedido
        
┌────────────────────────────────┐    ┌──────────┐
│ Resumen:                       │    │ ← Volver │
│ Items: 3 | Total: $450.00      │    │          │
│ - Pizza Margherita x1 $150.00  │    │ [✓ PROC] │
│ - Milanesa x1 $200.00          │    │  PAGO    │
│ - Fernet x1 $100.00            │    │(disabled)│
│                                │    │          │
│ Datos del Cliente:             │    └──────────┘
│ Nombre: [________________] ✓   │
│ Teléfono: [____________] ✓    │
│                                │
│ Tipo de Entrega:               │
│ [🍴 Mostrador] [🚚 A Domicilio] [🏠 Mesa]
│                                │
│ Forma de Pago:                 │
│ [💵 Efectivo] [💳 Tarjeta] [📱 QR]
│                                │
│ Completa todos los campos...   │
└────────────────────────────────┘
```

## Archivos Modificados

1. **src/pages/Storefront/StorefrontPage.jsx**
   - Reemplazo de `showCheckoutModal` por `isCheckingOut`
   - Nueva estructura condicional: `{isCheckingOut && <CheckoutPage .../>}`
   - Nueva función `CheckoutPage()` con validación completa

2. **src/pages/Storefront/StorefrontPage.css**
   - Agregados ~400 líneas de estilos para `.checkoutPage__*`
   - Incluye animaciones, transiciones y estilos responsive

## Flujo de Datos

```
StorefrontPage (cart state)
    ↓
CheckoutPage (checkoutData state)
    ├─ Validación en tiempo real
    ├─ Botones enabled/disabled según validación
    └─ onSuccess() callback
         ↓
    createPaidOrder() Redux action
         ↓
    Supabase: INSERT INTO orders
         ↓
    Dashboard (OrdersManager)
         ├─ fetchOrdersForTenant()
         └─ Orden aparece en lista
```

## Testing Checklist

- [ ] Presionar "Procesar Pedido" muestra CheckoutPage
- [ ] Campos tienen validación visual (✓ cuando son válidos)
- [ ] Botón "Procesar Pago" deshabilitado hasta completar campos
- [ ] Botón "Volver al Carrito" limpia el formulario
- [ ] Puede cambiar tipo de entrega dinámicamente
- [ ] Dirección solo aparece si selecciona "A Domicilio"
- [ ] Mensaje de validación muestra campos faltantes
- [ ] Presionar "Procesar Pago" envía orden a dashboard
- [ ] Orden aparece en OrdersManager con datos correctos
- [ ] Responsive en mobile (1 columna)

## Ventajas de esta Implementación

✅ **UX Mejorada**:
- Single page hace el flujo más lineal
- Validación clara de qué falta
- Botón "Volver" si se olvida algo

✅ **Validación Robusta**:
- Campos requeridos claramente marcados
- Validación dinámico basado en tipo de entrega
- Botón deshabilitado visualmente hasta validar

✅ **Sincronización Automática**:
- Dashboard se actualiza automáticamente
- Órdenes visibles al instante
- Datos consistentes entre ambas páginas

✅ **Responsive Design**:
- 2 columnas en desktop
- 1 columna en mobile
- Sticky sidebar con acciones
