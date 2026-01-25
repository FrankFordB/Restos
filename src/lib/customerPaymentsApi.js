/**
 * Customer Payments API - MercadoPago Checkout Pro
 * 
 * Implementación según documentación oficial de MercadoPago:
 * https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/landing
 * 
 * FLUJO:
 * 1. Cliente agrega productos al carrito
 * 2. Cliente hace checkout → createCustomerPaymentPreference()
 * 3. Se crea la orden en DB + preferencia en MercadoPago
 * 4. Cliente es redirigido a MercadoPago para pagar
 * 5. MercadoPago redirige de vuelta con el resultado
 * 6. Webhook de MP confirma el pago (opcional pero recomendado)
 * 
 * IMPORTANTE: El dinero va DIRECTO al admin/tenant usando SU access_token
 */

import { supabase, isSupabaseConfigured } from './supabaseClient'
import { getTenantActiveCredentials } from './supabaseMercadopagoApi'

// ============================================================================
// CONSTANTES
// ============================================================================

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing_payment',
  PAID: 'paid',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  REFUNDED: 'refunded',
}

export const MP_STATUS_MAP = {
  approved: PAYMENT_STATUS.PAID,
  pending: PAYMENT_STATUS.PROCESSING,
  in_process: PAYMENT_STATUS.PROCESSING,
  rejected: PAYMENT_STATUS.REJECTED,
  cancelled: PAYMENT_STATUS.CANCELLED,
  refunded: PAYMENT_STATUS.REFUNDED,
}

// ============================================================================
// FUNCIÓN PRINCIPAL: CREAR PREFERENCIA DE PAGO
// ============================================================================

/**
 * Crea una preferencia de pago de MercadoPago Checkout Pro
 * 
 * @param {Object} params
 * @param {string} params.tenantId - ID del tenant/tienda
 * @param {Array} params.items - Items del carrito
 * @param {Object} params.customer - Datos del cliente { name, phone, email }
 * @param {string} params.deliveryType - 'mostrador' | 'domicilio' | 'mesa'
 * @param {string} params.deliveryAddress - Dirección (solo para domicilio)
 * @param {string} params.deliveryNotes - Notas adicionales
 * @returns {Promise<Object>} { orderId, preferenceId, initPoint, total }
 */
export async function createCustomerPaymentPreference({
  tenantId,
  items,
  customer = {},
  deliveryType = 'mostrador',
  deliveryAddress = null,
  deliveryNotes = null,
}) {
  // Validaciones
  if (!isSupabaseConfigured) {
    throw new Error('Supabase no está configurado')
  }

  if (!tenantId) {
    throw new Error('tenantId es requerido')
  }

  if (!items || items.length === 0) {
    throw new Error('El carrito está vacío')
  }

  console.log('🛒 Iniciando checkout MercadoPago para tenant:', tenantId)

  // 1. Obtener credenciales MP del tenant
  const credentials = await getTenantActiveCredentials(tenantId)
  
  if (!credentials || !credentials.accessToken) {
    throw new Error('El local no tiene configurado MercadoPago. Contacta al administrador.')
  }

  console.log('✅ Credenciales MP obtenidas (sandbox:', credentials.isSandbox, ')')

  // 2. Obtener datos del tenant
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, slug, name')
    .eq('id', tenantId)
    .single()

  if (tenantError || !tenant) {
    throw new Error('Tienda no encontrada')
  }

  // 3. Formatear y calcular items
  const formattedItems = items.map(item => {
    const unitPrice = Number(item.unitPrice || item.product?.price || item.price || 0)
    const qty = Number(item.qty || item.quantity || 1)
    const extrasTotal = (item.extras || []).reduce((sum, e) => sum + Number(e.price || 0), 0)
    
    return {
      productId: item.productId || item.product?.id || null,
      name: item.name || item.product?.name || 'Producto',
      unitPrice: unitPrice,
      qty: qty,
      lineTotal: (unitPrice + extrasTotal) * qty,
      extras: item.extras || [],
      comment: item.comment || null,
    }
  })

  const total = formattedItems.reduce((sum, item) => sum + item.lineTotal, 0)
  
  if (total <= 0) {
    throw new Error('El total del carrito debe ser mayor a 0')
  }

  console.log('💰 Total calculado:', total)

  // 4. Crear orden en la base de datos
  // IMPORTANTE: Usamos status='pending' pero is_paid=false
  // La orden NO debe aparecer al vendedor hasta que el pago sea confirmado
  // El filtro en el dashboard debe excluir órdenes con payment_method='mercadopago' y is_paid=false
  const idempotencyKey = `ord_${crypto.randomUUID()}`
  
  const orderData = {
    tenant_id: tenantId,
    status: 'pending',
    total: total,
    currency: 'ARS',
    customer_name: customer.name || null,
    customer_phone: customer.phone || null,
    is_paid: false, // Importante: marcamos como NO pagado
    payment_method: 'mercadopago', // Para filtrar en el dashboard
  }

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert(orderData)
    .select('id')
    .single()

  if (orderError) {
    console.error('❌ Error creando orden:', orderError)
    throw new Error('Error al crear la orden: ' + orderError.message)
  }

  const orderId = order.id
  console.log('📋 Orden creada:', orderId)

  // 5. Insertar items de la orden
  const orderItems = formattedItems.map(item => ({
    order_id: orderId,
    product_id: item.productId,
    name: item.name,
    unit_price: item.unitPrice,
    qty: item.qty,
    line_total: item.lineTotal,
  }))

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItems)

  if (itemsError) {
    console.error('❌ Error insertando items:', itemsError)
    // Eliminar la orden si fallan los items
    await supabase.from('orders').delete().eq('id', orderId)
    throw new Error('Error al crear los items de la orden')
  }

  console.log('📦 Items insertados:', orderItems.length)

  // 6. Crear preferencia en MercadoPago
  const appUrl = import.meta.env.VITE_APP_URL || window.location.origin

  // Items para MercadoPago
  const mpItems = formattedItems.map((item, index) => ({
    id: item.productId || `item_${index}`,
    title: item.extras?.length 
      ? `${item.name} + ${item.extras.map(e => e.name).join(', ')}`
      : item.name,
    description: item.comment || item.name,
    quantity: item.qty,
    currency_id: 'ARS',
    unit_price: Math.round((item.lineTotal / item.qty) * 100) / 100, // Precio unitario incluyendo extras
  }))

  // External reference para identificar el pago
  const externalReference = JSON.stringify({
    type: 'customer_purchase',
    orderId: orderId,
    tenantId: tenantId,
    tenantSlug: tenant.slug,
  })

  // Configuración de la preferencia según MercadoPago
  const preferencePayload = {
    items: mpItems,
    payer: {
      name: customer.name || undefined,
      email: customer.email || undefined,
      phone: customer.phone ? {
        number: customer.phone,
      } : undefined,
    },
    external_reference: externalReference,
    back_urls: {
      success: `${appUrl}/tienda/${tenant.slug}/checkout/success?order=${orderId}`,
      failure: `${appUrl}/tienda/${tenant.slug}/checkout/failure?order=${orderId}`,
      pending: `${appUrl}/tienda/${tenant.slug}/checkout/pending?order=${orderId}`,
    },
    auto_return: 'approved', // Solo retorna automático en approved
    statement_descriptor: (tenant.name || 'TIENDA').substring(0, 22).toUpperCase(),
    expires: true,
    expiration_date_from: new Date().toISOString(),
    expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 horas
    metadata: {
      order_id: orderId,
      tenant_id: tenantId,
      tenant_slug: tenant.slug,
      delivery_type: deliveryType,
      delivery_address: deliveryAddress || '',
      delivery_notes: deliveryNotes || '',
    },
  }

  // Limpiar campos undefined del payer
  if (!preferencePayload.payer.name) delete preferencePayload.payer.name
  if (!preferencePayload.payer.email) delete preferencePayload.payer.email
  if (!preferencePayload.payer.phone) delete preferencePayload.payer.phone
  if (Object.keys(preferencePayload.payer).length === 0) {
    delete preferencePayload.payer
  }

  console.log('🔄 Creando preferencia en MercadoPago...')

  // Llamar a la API de MercadoPago
  const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${credentials.accessToken}`,
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(preferencePayload),
  })

  if (!mpResponse.ok) {
    const mpError = await mpResponse.json().catch(() => ({ message: 'Error desconocido' }))
    console.error('❌ Error de MercadoPago:', mpError)
    
    // Marcar orden como fallida
    await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', orderId)
    
    throw new Error(mpError.message || `Error de MercadoPago: ${mpResponse.status}`)
  }

  const mpData = await mpResponse.json()
  console.log('✅ Preferencia creada:', mpData.id)

  // 7. Actualizar orden con el ID de preferencia (si la columna existe)
  const { error: updateError } = await supabase
    .from('orders')
    .update({ mp_preference_id: mpData.id })
    .eq('id', orderId)
  
  if (updateError) {
    console.warn('⚠️ No se pudo guardar mp_preference_id (columna puede no existir)')
  }

  // 8. Determinar qué init_point usar
  const initPoint = credentials.isSandbox 
    ? mpData.sandbox_init_point 
    : mpData.init_point

  console.log('🎯 Init point:', initPoint)
  console.log('🧪 Modo sandbox:', credentials.isSandbox)

  return {
    orderId,
    preferenceId: mpData.id,
    initPoint,
    sandboxInitPoint: mpData.sandbox_init_point,
    productionInitPoint: mpData.init_point,
    total,
    idempotencyKey,
    isSandbox: credentials.isSandbox,
  }
}

// ============================================================================
// VERIFICAR ESTADO DE PAGO
// ============================================================================

/**
 * Verifica el estado de un pago en MercadoPago
 * Se usa cuando el usuario vuelve del checkout
 * 
 * @param {string} tenantId - ID del tenant
 * @param {string} paymentId - ID del pago de MercadoPago
 * @returns {Promise<Object>} Estado del pago
 */
export async function verifyPaymentStatus(tenantId, paymentId) {
  if (!paymentId) {
    return { status: 'unknown', message: 'No payment ID provided' }
  }

  const credentials = await getTenantActiveCredentials(tenantId)
  
  if (!credentials || !credentials.accessToken) {
    throw new Error('No se pueden verificar credenciales de MercadoPago')
  }

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: {
      'Authorization': `Bearer ${credentials.accessToken}`,
    },
  })

  if (!response.ok) {
    console.error('Error verificando pago:', response.status)
    return { status: 'error', message: 'No se pudo verificar el pago' }
  }

  const payment = await response.json()

  return {
    status: payment.status,
    statusDetail: payment.status_detail,
    paymentId: payment.id,
    externalReference: payment.external_reference,
    transactionAmount: payment.transaction_amount,
    currencyId: payment.currency_id,
    payerEmail: payment.payer?.email,
    dateCreated: payment.date_created,
    dateApproved: payment.date_approved,
  }
}

// ============================================================================
// ACTUALIZAR ORDEN DESPUÉS DEL PAGO
// ============================================================================

/**
 * Actualiza el estado de la orden basado en el resultado del pago
 * 
 * @param {string} orderId - ID de la orden
 * @param {string} mpStatus - Estado de MercadoPago (approved, pending, rejected, etc)
 * @param {Object} paymentData - Datos adicionales del pago
 */
export async function updateOrderFromPayment(orderId, mpStatus, paymentData = {}) {
  const newStatus = MP_STATUS_MAP[mpStatus] || PAYMENT_STATUS.PENDING
  
  const updateData = {
    status: mpStatus === 'approved' ? 'confirmed' : 'pending',
  }

  // Agregar campos de pago si la migración fue aplicada
  const paymentFields = {
    payment_status: newStatus,
    mp_payment_id: paymentData.paymentId || null,
    mp_status: mpStatus,
    mp_status_detail: paymentData.statusDetail || null,
    mp_payer_email: paymentData.payerEmail || null,
    mp_transaction_amount: paymentData.transactionAmount || null,
    is_paid: mpStatus === 'approved',
    paid_at: mpStatus === 'approved' ? new Date().toISOString() : null,
  }

  // Intentar actualizar con todos los campos
  const { error } = await supabase
    .from('orders')
    .update({ ...updateData, ...paymentFields })
    .eq('id', orderId)

  if (error) {
    // Si falla, intentar solo con campos básicos
    console.warn('Actualizando solo campos básicos:', error.message)
    await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
  }

  return { success: true, newStatus }
}

// ============================================================================
// OBTENER ORDEN CON ESTADO DE PAGO
// ============================================================================

/**
 * Obtiene una orden con su estado de pago
 */
export async function getOrderWithPaymentStatus(orderId) {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_items (*)
    `)
    .eq('id', orderId)
    .single()

  if (error) {
    throw new Error('Orden no encontrada')
  }

  return data
}

// ============================================================================
// OBTENER PEDIDOS DE UN TENANT
// ============================================================================

/**
 * Obtiene los pedidos de un tenant con filtros opcionales
 */
export async function getTenantOrders(tenantId, { status, paymentStatus, limit = 50 } = {}) {
  let query = supabase
    .from('orders')
    .select(`
      *,
      order_items (*)
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status) {
    query = query.eq('status', status)
  }

  if (paymentStatus) {
    query = query.eq('payment_status', paymentStatus)
  }

  const { data, error } = await query

  if (error) {
    throw new Error('Error obteniendo pedidos: ' + error.message)
  }

  return data
}

// ============================================================================
// HELPER: Parsear external_reference de MercadoPago
// ============================================================================

export function parseExternalReference(externalReference) {
  try {
    return JSON.parse(externalReference)
  } catch {
    return null
  }
}

// ============================================================================
// EXPORTAR CONSTANTES ÚTILES
// ============================================================================

export const MP_CHECKOUT_PRO = {
  // Estados de pago de MercadoPago
  STATUS: {
    APPROVED: 'approved',
    PENDING: 'pending',
    IN_PROCESS: 'in_process',
    REJECTED: 'rejected',
    CANCELLED: 'cancelled',
    REFUNDED: 'refunded',
  },
  
  // Detalles de estado
  STATUS_DETAIL: {
    ACCREDITED: 'accredited',
    PENDING_CONTINGENCY: 'pending_contingency',
    PENDING_REVIEW_MANUAL: 'pending_review_manual',
    CC_REJECTED_BAD_FILLED_DATE: 'cc_rejected_bad_filled_date',
    CC_REJECTED_BAD_FILLED_OTHER: 'cc_rejected_bad_filled_other',
    CC_REJECTED_BAD_FILLED_SECURITY_CODE: 'cc_rejected_bad_filled_security_code',
    CC_REJECTED_BLACKLIST: 'cc_rejected_blacklist',
    CC_REJECTED_CALL_FOR_AUTHORIZE: 'cc_rejected_call_for_authorize',
    CC_REJECTED_CARD_DISABLED: 'cc_rejected_card_disabled',
    CC_REJECTED_CARD_ERROR: 'cc_rejected_card_error',
    CC_REJECTED_DUPLICATED_PAYMENT: 'cc_rejected_duplicated_payment',
    CC_REJECTED_HIGH_RISK: 'cc_rejected_high_risk',
    CC_REJECTED_INSUFFICIENT_AMOUNT: 'cc_rejected_insufficient_amount',
    CC_REJECTED_INVALID_INSTALLMENTS: 'cc_rejected_invalid_installments',
    CC_REJECTED_MAX_ATTEMPTS: 'cc_rejected_max_attempts',
    CC_REJECTED_OTHER_REASON: 'cc_rejected_other_reason',
  },
}
