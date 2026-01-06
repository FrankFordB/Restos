/**
 * MercadoPago Service
 * 
 * Este servicio maneja dos tipos de pagos:
 * 1. Suscripciones de la plataforma (dinero va al dueño de la plataforma)
 * 2. Pagos de tiendas (dinero va a cada tenant)
 */

// Configuración del dueño de la plataforma
const MP_CONFIG = {
  publicKey: import.meta.env.VITE_MP_PUBLIC_KEY || '',
  accessToken: import.meta.env.VITE_MP_ACCESS_TOKEN || '',
  sandboxPublicKey: import.meta.env.VITE_MP_SANDBOX_PUBLIC_KEY || '',
  sandboxAccessToken: import.meta.env.VITE_MP_SANDBOX_ACCESS_TOKEN || '',
  mode: import.meta.env.VITE_MP_MODE || 'sandbox',
  appUrl: import.meta.env.VITE_APP_URL || 'http://localhost:5173',
}

/**
 * Verifica si las credenciales de plataforma están configuradas
 */
export const isPlatformMPConfigured = () => {
  const isConfigured = MP_CONFIG.mode === 'sandbox'
    ? Boolean(MP_CONFIG.sandboxPublicKey && MP_CONFIG.sandboxAccessToken)
    : Boolean(MP_CONFIG.publicKey && MP_CONFIG.accessToken)
  
  return isConfigured
}

/**
 * Obtiene las credenciales activas de la plataforma según el modo
 */
export const getPlatformCredentials = () => {
  if (MP_CONFIG.mode === 'sandbox') {
    return {
      publicKey: MP_CONFIG.sandboxPublicKey,
      accessToken: MP_CONFIG.sandboxAccessToken,
      isSandbox: true,
    }
  }
  return {
    publicKey: MP_CONFIG.publicKey,
    accessToken: MP_CONFIG.accessToken,
    isSandbox: false,
  }
}

/**
 * Obtiene la URL base de la app
 */
export const getAppUrl = () => MP_CONFIG.appUrl

// ============================================================================
// SUSCRIPCIONES DE PLATAFORMA (dinero va al dueño)
// ============================================================================

/**
 * Crea una preferencia de pago para suscripción
 * @param {Object} params
 * @param {string} params.tenantId - ID del tenant que se suscribe
 * @param {string} params.tenantName - Nombre del tenant
 * @param {string} params.planTier - 'premium' o 'premium_pro'
 * @param {string} params.billingPeriod - 'monthly' o 'yearly'
 * @param {number} params.amount - Monto a cobrar
 * @param {string} params.payerEmail - Email del que paga
 * @param {string} params.subscriptionId - ID de la suscripción pendiente (para correlación webhook)
 * @returns {Promise<Object>} - Datos de la preferencia creada
 */
export const createSubscriptionPreference = async ({
  tenantId,
  tenantName,
  planTier,
  billingPeriod,
  amount,
  payerEmail,
  subscriptionId,
}) => {
  const { accessToken, isSandbox } = getPlatformCredentials()
  
  if (!accessToken) {
    throw new Error('MercadoPago no está configurado para la plataforma')
  }

  const periodLabel = billingPeriod === 'yearly' ? 'Anual' : 'Mensual'
  const tierLabel = planTier === 'premium_pro' ? 'Premium Pro' : 'Premium'
  
  // Detectar si estamos en localhost (desarrollo)
  const isLocalhost = MP_CONFIG.appUrl.includes('localhost') || MP_CONFIG.appUrl.includes('127.0.0.1')
  
  const preference = {
    items: [
      {
        id: `subscription_${tenantId}_${planTier}_${billingPeriod}`,
        title: `Suscripción ${tierLabel} ${periodLabel} - Restos`,
        description: `Plan ${tierLabel} para ${tenantName}`,
        quantity: 1,
        currency_id: 'ARS',
        unit_price: amount,
      },
    ],
    payer: {
      email: payerEmail,
    },
    external_reference: JSON.stringify({
      type: 'subscription',
      tenantId,
      planTier,
      billingPeriod,
      amount,
      subscriptionId, // ID para correlación con webhook
    }),
    statement_descriptor: 'RESTOS',
    // SIEMPRE enviar back_urls - MercadoPago las usa para el botón "Volver al sitio"
    back_urls: {
      success: `${MP_CONFIG.appUrl}/payment/success?type=subscription&tenant=${tenantId}`,
      failure: `${MP_CONFIG.appUrl}/payment/failure?type=subscription&tenant=${tenantId}`,
      pending: `${MP_CONFIG.appUrl}/payment/pending?type=subscription&tenant=${tenantId}`,
    },
    // auto_return 'all' redirige automáticamente en todos los casos (approved, pending, rejected)
    auto_return: 'all',
  }

  // notification_url solo funciona con URLs públicas (no localhost)
  if (!isLocalhost) {
    preference.notification_url = `${MP_CONFIG.appUrl}/api/webhooks/mercadopago`
  }

  const apiUrl = 'https://api.mercadopago.com/checkout/preferences'

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(preference),
  })

  if (!response.ok) {
    const error = await response.json()
    console.error('Error creando preferencia MP:', error)
    throw new Error(error.message || 'Error al crear preferencia de pago')
  }

  const data = await response.json()
  
  return {
    preferenceId: data.id,
    initPoint: isSandbox ? data.sandbox_init_point : data.init_point,
    sandboxInitPoint: data.sandbox_init_point,
  }
}

// ============================================================================
// PAGOS DE TIENDAS (dinero va al tenant)
// ============================================================================

/**
 * Crea una preferencia de pago para una orden de tienda
 * @param {Object} params
 * @param {Object} params.credentials - Credenciales MP del tenant
 * @param {Object} params.order - Datos de la orden
 * @param {Array} params.items - Items del carrito
 * @param {Object} params.tenant - Datos del tenant
 * @returns {Promise<Object>} - Datos de la preferencia creada
 */
export const createStoreOrderPreference = async ({
  credentials,
  order,
  items,
  tenant,
}) => {
  const { accessToken, isSandbox } = credentials

  if (!accessToken) {
    throw new Error('El local no tiene configurado MercadoPago')
  }

  // Detectar si estamos en localhost
  const isLocalhost = MP_CONFIG.appUrl.includes('localhost') || MP_CONFIG.appUrl.includes('127.0.0.1')

  const mpItems = items.map((item) => ({
    id: item.productId || item.id,
    title: item.name,
    description: item.description || item.name,
    quantity: item.qty || item.quantity || 1,
    currency_id: 'ARS',
    unit_price: Number(item.unitPrice || item.price),
  }))

  const preference = {
    items: mpItems,
    payer: order.customerName ? {
      name: order.customerName,
      phone: order.customerPhone ? { number: order.customerPhone } : undefined,
    } : undefined,
    back_urls: {
      success: `${MP_CONFIG.appUrl}/tienda/${tenant.slug}/payment/success?order=${order.id}`,
      failure: `${MP_CONFIG.appUrl}/tienda/${tenant.slug}/payment/failure?order=${order.id}`,
      pending: `${MP_CONFIG.appUrl}/tienda/${tenant.slug}/payment/pending?order=${order.id}`,
    },
    // auto_return 'all' redirige automáticamente en todos los casos
    auto_return: 'all',
    external_reference: JSON.stringify({
      type: 'store_order',
      orderId: order.id,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
    }),
    statement_descriptor: tenant.name?.substring(0, 22) || 'TIENDA',
    expires: true,
    expiration_date_from: new Date().toISOString(),
    expiration_date_to: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 horas
  }

  const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(preference),
  })

  if (!response.ok) {
    const error = await response.json()
    console.error('Error creando preferencia MP tienda:', error)
    throw new Error(error.message || 'Error al crear preferencia de pago')
  }

  const data = await response.json()

  return {
    preferenceId: data.id,
    initPoint: isSandbox ? data.sandbox_init_point : data.init_point,
    sandboxInitPoint: data.sandbox_init_point,
  }
}

/**
 * Obtiene información de un pago
 * @param {string} paymentId - ID del pago de MP
 * @param {string} accessToken - Token de acceso
 * @returns {Promise<Object>}
 */
export const getPaymentInfo = async (paymentId, accessToken) => {
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    throw new Error('Error obteniendo información del pago')
  }

  return response.json()
}

/**
 * Valida la firma de un webhook de MP
 * @param {string} signature - Firma del header x-signature
 * @param {string} payload - Body del webhook
 * @param {string} secret - Secret del webhook
 * @returns {boolean}
 */
export const validateWebhookSignature = (signature, payload, secret) => {
  // Por ahora retornamos true, en producción deberías validar con crypto
  // La validación completa requiere usar crypto.createHmac en el backend
  console.warn('Webhook signature validation not implemented - use a backend for production')
  return true
}

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Formatea un monto para mostrar
 */
export const formatAmount = (amount, currency = 'ARS') => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
  }).format(amount)
}

/**
 * Estados de pago de MercadoPago
 */
export const MP_PAYMENT_STATUS = {
  APPROVED: 'approved',
  PENDING: 'pending',
  IN_PROCESS: 'in_process',
  REJECTED: 'rejected',
  REFUNDED: 'refunded',
  CANCELLED: 'cancelled',
  CHARGED_BACK: 'charged_back',
}

/**
 * Traduce el estado de pago de MP
 */
export const translatePaymentStatus = (status) => {
  const translations = {
    [MP_PAYMENT_STATUS.APPROVED]: 'Aprobado',
    [MP_PAYMENT_STATUS.PENDING]: 'Pendiente',
    [MP_PAYMENT_STATUS.IN_PROCESS]: 'En proceso',
    [MP_PAYMENT_STATUS.REJECTED]: 'Rechazado',
    [MP_PAYMENT_STATUS.REFUNDED]: 'Reembolsado',
    [MP_PAYMENT_STATUS.CANCELLED]: 'Cancelado',
    [MP_PAYMENT_STATUS.CHARGED_BACK]: 'Contracargo',
  }
  return translations[status] || status
}

/**
 * Iconos para estados de pago
 */
export const getPaymentStatusIcon = (status) => {
  const icons = {
    [MP_PAYMENT_STATUS.APPROVED]: '✅',
    [MP_PAYMENT_STATUS.PENDING]: '⏳',
    [MP_PAYMENT_STATUS.IN_PROCESS]: '🔄',
    [MP_PAYMENT_STATUS.REJECTED]: '❌',
    [MP_PAYMENT_STATUS.REFUNDED]: '↩️',
    [MP_PAYMENT_STATUS.CANCELLED]: '🚫',
    [MP_PAYMENT_STATUS.CHARGED_BACK]: '⚠️',
  }
  return icons[status] || '❓'
}
