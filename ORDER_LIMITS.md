# Sistema de Límites de Pedidos por Suscripción

## Resumen
Sistema que limita la cantidad de pedidos mensuales según el plan de suscripción del tenant.

## Límites por Plan
| Plan | Pedidos/Mes |
|------|-------------|
| Free | 15 |
| Premium | 80 |
| Premium Pro | Ilimitado |

## Archivos Principales

### Base de Datos
- `supabase/migrations/add_order_limits.sql` - Migración para agregar:
  - Columnas `orders_remaining`, `orders_limit`, `orders_reset_date` en `tenants`
  - Trigger automático que decrementa `orders_remaining` al crear un pedido
  - Trigger que actualiza límites cuando cambia el plan de suscripción
  - Función `reset_monthly_orders()` para reseteo mensual
  - Realtime habilitado para la tabla `tenants`

### Frontend
- `src/shared/subscriptions.js` - Constantes `ORDER_LIMITS`
- `src/lib/supabaseApi.js` - Funciones:
  - `fetchOrderLimitsStatus(tenantId)`
  - `fetchOrderLimitsStatusBySlug(slug)` 
  - `subscribeToOrderLimits(tenantId, callback)` - Suscripción realtime
- `src/components/storefront/OrdersRemainingBadge/` - Badge visual con contador
- `src/components/storefront/StoreClosedModal/` - Modal para límite alcanzado
- `src/components/storefront/StoreHeader/` - Muestra el badge en el header
- `src/pages/Storefront/StorefrontPage.jsx` - Lógica de bloqueo de tienda
- `src/components/dashboard/SubscriptionStatus/` - Vista en panel admin

## Flujo de Funcionamiento

1. **Al crear un pedido:**
   - El trigger `on_order_created_decrement` valida si hay pedidos disponibles
   - Si hay pedidos, decrementa `orders_remaining`
   - Si no hay pedidos, lanza excepción y la orden no se crea

2. **En el Storefront:**
   - Se carga el estado inicial de límites
   - Se suscribe a cambios en tiempo real
   - Si `orders_remaining <= 0`, muestra modal de límite alcanzado
   - La tienda se bloquea para nuevas compras

3. **Actualización en tiempo real:**
   - Cualquier cambio en `orders_remaining` se refleja instantáneamente
   - El badge muestra el estado actual con colores según urgencia:
     - Verde: Normal (>40% restante)
     - Amarillo: Warning (20-40% restante)
     - Rojo: Crítico (<20% restante)

## Reset Mensual

La función `reset_monthly_orders()` debe ejecutarse mediante un cron job:

```sql
-- Opción 1: Usar pg_cron de Supabase
SELECT cron.schedule(
  'reset-monthly-orders',
  '0 0 1 * *', -- Primer día de cada mes a medianoche
  'SELECT public.reset_monthly_orders()'
);

-- Opción 2: Llamar manualmente
SELECT public.reset_monthly_orders();
```

## Cambio de Plan

Cuando un tenant cambia su plan:
- **Upgrade:** Se agregan los pedidos adicionales del nuevo plan
- **Downgrade:** Se mantienen los pedidos restantes pero no más del nuevo límite
- **A Premium Pro:** Se establece `NULL` (ilimitado)

## Consultas Útiles

```sql
-- Ver estado de un tenant
SELECT id, name, subscription_tier, orders_limit, orders_remaining, orders_reset_date 
FROM public.tenants WHERE slug = 'mi-tienda';

-- Ver todos los tenants con pedidos bajos
SELECT name, subscription_tier, orders_remaining, orders_limit
FROM public.tenants 
WHERE orders_limit IS NOT NULL 
  AND orders_remaining < 5
ORDER BY orders_remaining ASC;

-- Reset manual de un tenant específico
UPDATE public.tenants 
SET orders_remaining = orders_limit,
    orders_reset_date = date_trunc('month', now()) + interval '1 month'
WHERE slug = 'mi-tienda';
```
