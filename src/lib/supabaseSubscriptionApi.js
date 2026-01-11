/**
 * API de Suscripciones - Supabase
 * 
 * Maneja todo el ciclo de vida de suscripciones:
 * - Creación y activación
 * - Consulta de estado
 * - Cancelación y renovación
 * - Historial y auditoría
 * - Funciones de admin (regalos, extensiones)
 */

import { supabase, isSupabaseConfigured } from './supabaseClient'
import { SUBSCRIPTION_TIERS } from '../shared/subscriptions'

// ============================================================================
// CONSTANTES
// ============================================================================

const STORAGE_KEYS = {
  SUBSCRIPTIONS: 'platform_subscriptions_mock',
  AUDIT_LOG: 'subscription_audit_mock',
  GIFT_LOG: 'admin_gift_log_mock',
}

// Acciones de auditoría
export const AUDIT_ACTIONS = {
  // Sistema
  SUBSCRIPTION_CREATED: 'subscription_created',
  SUBSCRIPTION_ACTIVATED: 'subscription_activated',
  SUBSCRIPTION_EXPIRED: 'subscription_expired',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
  SUBSCRIPTION_RENEWED: 'subscription_renewed',
  
  // Usuario
  USER_UPGRADED: 'user_upgraded',
  USER_DOWNGRADED: 'user_downgraded',
  AUTO_RENEW_ENABLED: 'auto_renew_enabled',
  AUTO_RENEW_DISABLED: 'auto_renew_disabled',
  
  // Admin
  ADMIN_GIFT: 'admin_gift',
  ADMIN_EXTEND: 'admin_extend',
  ADMIN_EXPIRE: 'admin_expire',
  ADMIN_REFUND: 'admin_refund',
  
  // Pagos
  PAYMENT_RECEIVED: 'payment_received',
  PAYMENT_FAILED: 'payment_failed',
  PAYMENT_REFUNDED: 'payment_refunded',
  CHARGEBACK_RECEIVED: 'chargeback_received',
  
  // Cron
  CRON_EXPIRATION_CHECK: 'cron_expiration_check',
  CRON_REMINDER_SENT: 'cron_reminder_sent',
}

// ============================================================================
// HELPERS MOCK
// ============================================================================

const loadMockData = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]')
  } catch {
    return []
  }
}

const saveMockData = (key, data) => {
  localStorage.setItem(key, JSON.stringify(data))
}

const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

// ============================================================================
// PLANES DE SUSCRIPCIÓN
// ============================================================================

/**
 * Obtiene todos los planes de suscripción disponibles
 * @returns {Promise<Array>}
 */
export const getSubscriptionPlans = async () => {
  if (!isSupabaseConfigured) {
    return [
      {
        id: 'free',
        name: 'Gratis',
        description: 'Plan básico para comenzar',
        price_monthly: 0,
        price_yearly: 0,
        orders_per_day: 15,
        is_active: true,
      },
      {
        id: 'premium',
        name: 'Premium',
        description: 'Para negocios en crecimiento',
        price_monthly: 9.99,
        price_yearly: 99,
        orders_per_day: 80,
        is_active: true,
      },
      {
        id: 'premium_pro',
        name: 'Premium Pro',
        description: 'Todo incluido para profesionales',
        price_monthly: 19.99,
        price_yearly: 199,
        orders_per_day: null,
        is_active: true,
      },
    ]
  }

  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('display_order')

  if (error) throw error
  return data || []
}

// ============================================================================
// SUSCRIPCIONES DEL TENANT
// ============================================================================

/**
 * Obtiene la suscripción activa de un tenant
 * @param {string} tenantId 
 * @returns {Promise<Object|null>}
 */
export const getActiveSubscription = async (tenantId) => {
  if (!isSupabaseConfigured) {
    const tenantsData = JSON.parse(localStorage.getItem('state.tenants') || '{}')
    const tenant = (tenantsData.tenants || []).find(t => t.id === tenantId)
    
    if (!tenant) return null
    
    return {
      tenant_id: tenantId,
      plan_id: tenant.subscription_tier || 'free',
      subscription_tier: tenant.subscription_tier || 'free',
      premium_until: tenant.premium_until,
      auto_renew: tenant.auto_renew || false,
      subscription_status: tenant.subscription_status || 'active',
      days_remaining: calculateDaysRemaining(tenant.premium_until),
      is_active: isSubscriptionActive(tenant.subscription_tier, tenant.premium_until),
      scheduled_tier: tenant.scheduled_tier || null,
      scheduled_at: tenant.scheduled_at || null,
    }
  }

  const { data, error } = await supabase
    .from('tenants')
    .select(`
      id,
      name,
      subscription_tier,
      subscription_status,
      premium_until,
      auto_renew,
      orders_limit,
      orders_remaining,
      scheduled_tier,
      scheduled_at
    `)
    .eq('id', tenantId)
    .single()

  if (error) throw error
  if (!data) return null

  return {
    tenant_id: data.id,
    tenant_name: data.name,
    plan_id: data.subscription_tier,
    subscription_tier: data.subscription_tier,
    premium_until: data.premium_until,
    auto_renew: data.auto_renew,
    subscription_status: data.subscription_status,
    orders_limit: data.orders_limit,
    orders_remaining: data.orders_remaining,
    days_remaining: calculateDaysRemaining(data.premium_until),
    is_active: isSubscriptionActive(data.subscription_tier, data.premium_until),
    scheduled_tier: data.scheduled_tier || null,
    scheduled_at: data.scheduled_at || null,
  }
}

/**
 * Obtiene el historial de suscripciones de un tenant
 * @param {string} tenantId 
 * @returns {Promise<Array>}
 */
export const getSubscriptionHistory = async (tenantId) => {
  if (!isSupabaseConfigured) {
    const data = loadMockData(STORAGE_KEYS.SUBSCRIPTIONS)
    return data.filter(s => s.tenant_id === tenantId).sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    )
  }

  const { data, error } = await supabase
    .from('platform_subscriptions')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Crea una suscripción pendiente (antes de pagar)
 * @param {Object} params 
 * @returns {Promise<Object>}
 */
export const createPendingSubscription = async ({
  tenantId,
  planId,
  billingPeriod,
  amount,
  currency = 'ARS',
  preferenceId,
  payerEmail,
}) => {
  const idempotencyKey = `sub_${tenantId}_${planId}_${Date.now()}`
  
  const record = {
    tenant_id: tenantId,
    plan_id: planId,
    billing_period: billingPeriod,
    amount,
    currency,
    status: 'pending',
    source: 'payment',
    mp_preference_id: preferenceId,
    payer_email: payerEmail,
    idempotency_key: idempotencyKey,
  }

  if (!isSupabaseConfigured) {
    const data = loadMockData(STORAGE_KEYS.SUBSCRIPTIONS)
    const newRecord = {
      ...record,
      id: generateId(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    data.push(newRecord)
    saveMockData(STORAGE_KEYS.SUBSCRIPTIONS, data)
    
    // Log de auditoría
    await logAuditEvent({
      tenantId,
      action: AUDIT_ACTIONS.SUBSCRIPTION_CREATED,
      actionType: 'system',
      newValue: { plan_id: planId, billing_period: billingPeriod, amount },
      description: `Suscripción ${planId} creada (pendiente de pago)`,
    })
    
    return newRecord
  }

  const { data, error } = await supabase
    .from('platform_subscriptions')
    .insert(record)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Activa una suscripción después del pago exitoso
 * @param {string} subscriptionId 
 * @param {Object} paymentInfo 
 * @returns {Promise<Object>}
 */
export const activateSubscription = async (subscriptionId, paymentInfo) => {
  if (!isSupabaseConfigured) {
    const data = loadMockData(STORAGE_KEYS.SUBSCRIPTIONS)
    const idx = data.findIndex(s => s.id === subscriptionId)
    
    if (idx < 0) throw new Error('Suscripción no encontrada')
    
    const sub = data[idx]
    
    // Calcular expiración
    const expiresAt = new Date()
    if (sub.billing_period === 'yearly') {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1)
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + 1)
    }
    
    // Actualizar suscripción
    data[idx] = {
      ...sub,
      status: 'approved',
      mp_payment_id: paymentInfo.paymentId,
      paid_at: new Date().toISOString(),
      starts_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    }
    saveMockData(STORAGE_KEYS.SUBSCRIPTIONS, data)
    
    // Actualizar tenant
    const tenantsData = JSON.parse(localStorage.getItem('state.tenants') || '{}')
    const tenants = tenantsData.tenants || []
    const tenantIdx = tenants.findIndex(t => t.id === sub.tenant_id)
    
    if (tenantIdx >= 0) {
      tenants[tenantIdx] = {
        ...tenants[tenantIdx],
        subscription_tier: sub.plan_id,
        premium_until: expiresAt.toISOString(),
        subscription_status: 'active',
        orders_limit: sub.plan_id === 'premium_pro' ? null : 80,
        orders_remaining: sub.plan_id === 'premium_pro' ? null : 80,
      }
      tenantsData.tenants = tenants
      localStorage.setItem('state.tenants', JSON.stringify(tenantsData))
    }
    
    // Log de auditoría
    await logAuditEvent({
      tenantId: sub.tenant_id,
      subscriptionId,
      action: AUDIT_ACTIONS.SUBSCRIPTION_ACTIVATED,
      actionType: 'webhook',
      newValue: { plan_id: sub.plan_id, expires_at: expiresAt.toISOString() },
      description: `Suscripción ${sub.plan_id} activada`,
    })
    
    return data[idx]
  }

  // Usar función de Supabase
  const { data, error } = await supabase
    .rpc('activate_subscription', {
      p_subscription_id: subscriptionId,
      p_payment_id: paymentInfo.paymentId,
      p_payer_email: paymentInfo.payerEmail,
    })

  if (error) throw error
  return data
}

/**
 * Cancela una suscripción
 * @param {string} tenantId 
 * @param {Object} options 
 * @returns {Promise<Object>}
 */
export const cancelSubscription = async (tenantId, { immediate = false, reason = '' } = {}) => {
  if (!isSupabaseConfigured) {
    const tenantsData = JSON.parse(localStorage.getItem('state.tenants') || '{}')
    const tenants = tenantsData.tenants || []
    const idx = tenants.findIndex(t => t.id === tenantId)
    
    if (idx < 0) throw new Error('Tenant no encontrado')
    
    const previousTier = tenants[idx].subscription_tier
    const previousExpires = tenants[idx].premium_until
    
    if (immediate) {
      tenants[idx] = {
        ...tenants[idx],
        subscription_tier: 'free',
        subscription_status: 'cancelled',
        premium_until: new Date().toISOString(),
        auto_renew: false,
        orders_limit: 15,
        orders_remaining: Math.min(tenants[idx].orders_remaining || 15, 15),
      }
    } else {
      tenants[idx] = {
        ...tenants[idx],
        subscription_status: 'cancelled',
        auto_renew: false,
      }
    }
    
    tenantsData.tenants = tenants
    localStorage.setItem('state.tenants', JSON.stringify(tenantsData))
    
    // Actualizar suscripciones activas
    const subs = loadMockData(STORAGE_KEYS.SUBSCRIPTIONS)
    subs.forEach((sub, i) => {
      if (sub.tenant_id === tenantId && sub.status === 'approved') {
        subs[i] = { ...sub, status: 'cancelled', cancelled_at: new Date().toISOString() }
      }
    })
    saveMockData(STORAGE_KEYS.SUBSCRIPTIONS, subs)
    
    // Log de auditoría
    await logAuditEvent({
      tenantId,
      action: AUDIT_ACTIONS.SUBSCRIPTION_CANCELLED,
      actionType: 'user',
      oldValue: { tier: previousTier, expires_at: previousExpires },
      newValue: { immediate, reason },
      description: immediate 
        ? 'Suscripción cancelada inmediatamente'
        : `Suscripción cancelada, activa hasta ${previousExpires}`,
    })
    
    return {
      success: true,
      immediate,
      active_until: immediate ? new Date().toISOString() : previousExpires,
    }
  }

  const { data, error } = await supabase
    .rpc('cancel_subscription', {
      p_tenant_id: tenantId,
      p_immediate: immediate,
      p_reason: reason,
    })

  if (error) throw error
  return data
}

/**
 * Actualiza la configuración de auto-renovación
 * @param {string} tenantId 
 * @param {boolean} enabled 
 * @returns {Promise<void>}
 */
export const setAutoRenew = async (tenantId, enabled) => {
  if (!isSupabaseConfigured) {
    const tenantsData = JSON.parse(localStorage.getItem('state.tenants') || '{}')
    const tenants = tenantsData.tenants || []
    const idx = tenants.findIndex(t => t.id === tenantId)
    
    if (idx >= 0) {
      tenants[idx].auto_renew = enabled
      tenantsData.tenants = tenants
      localStorage.setItem('state.tenants', JSON.stringify(tenantsData))
    }
    
    await logAuditEvent({
      tenantId,
      action: enabled ? AUDIT_ACTIONS.AUTO_RENEW_ENABLED : AUDIT_ACTIONS.AUTO_RENEW_DISABLED,
      actionType: 'user',
      newValue: { auto_renew: enabled },
      description: enabled ? 'Auto-renovación activada' : 'Auto-renovación desactivada',
    })
    
    return
  }

  const { error } = await supabase
    .from('tenants')
    .update({ auto_renew: enabled })
    .eq('id', tenantId)

  if (error) throw error
  
  // Log
  await supabase.from('subscription_audit_log').insert({
    tenant_id: tenantId,
    user_id: (await supabase.auth.getUser()).data.user?.id,
    action: enabled ? AUDIT_ACTIONS.AUTO_RENEW_ENABLED : AUDIT_ACTIONS.AUTO_RENEW_DISABLED,
    action_type: 'user',
    new_value: { auto_renew: enabled },
  })
}

// ============================================================================
// FUNCIONES DE ADMIN (SUPER_ADMIN)
// ============================================================================

/**
 * Obtiene todas las suscripciones activas (para super_admin)
 * @returns {Promise<Array>}
 */
export const getAllActiveSubscriptions = async () => {
  if (!isSupabaseConfigured) {
    const tenantsData = JSON.parse(localStorage.getItem('state.tenants') || '{}')
    const tenants = tenantsData.tenants || []
    
    return tenants
      .filter(t => t.subscription_tier !== 'free')
      .map(t => ({
        tenant_id: t.id,
        tenant_name: t.name,
        tenant_slug: t.slug,
        subscription_tier: t.subscription_tier,
        subscription_status: t.subscription_status || 'active',
        premium_until: t.premium_until,
        auto_renew: t.auto_renew || false,
        days_remaining: calculateDaysRemaining(t.premium_until),
      }))
      .sort((a, b) => a.days_remaining - b.days_remaining)
  }

  const { data, error } = await supabase
    .from('v_active_subscriptions')
    .select('*')

  if (error) {
    // Si la vista no existe, hacer query manual
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select(`
        id,
        name,
        slug,
        subscription_tier,
        subscription_status,
        premium_until,
        auto_renew,
        profiles!tenants_owner_user_id_fkey(email)
      `)
      .neq('subscription_tier', 'free')
      .order('premium_until', { ascending: true })

    if (tenantsError) throw tenantsError
    
    return (tenants || []).map(t => ({
      tenant_id: t.id,
      tenant_name: t.name,
      tenant_slug: t.slug,
      subscription_tier: t.subscription_tier,
      subscription_status: t.subscription_status,
      premium_until: t.premium_until,
      auto_renew: t.auto_renew,
      owner_email: t.profiles?.email,
      days_remaining: calculateDaysRemaining(t.premium_until),
    }))
  }

  return data || []
}

/**
 * Obtiene resumen de suscripciones para dashboard
 * @returns {Promise<Object>}
 */
export const getSubscriptionsSummary = async () => {
  const subscriptions = await getAllActiveSubscriptions()
  
  return {
    total: subscriptions.length,
    premium: subscriptions.filter(s => s.subscription_tier === 'premium').length,
    premiumPro: subscriptions.filter(s => s.subscription_tier === 'premium_pro').length,
    expiringSoon: subscriptions.filter(s => s.days_remaining > 0 && s.days_remaining <= 7).length,
    expired: subscriptions.filter(s => s.days_remaining <= 0).length,
    autoRenewEnabled: subscriptions.filter(s => s.auto_renew).length,
    subscriptions,
  }
}

/**
 * Regala días de suscripción a un tenant (solo super_admin)
 * @param {Object} params 
 * @returns {Promise<Object>}
 */
export const giftSubscription = async ({
  tenantId,
  planTier,
  days,
  reason,
  adminUserId,
  adminEmail,
}) => {
  if (!['premium', 'premium_pro'].includes(planTier)) {
    throw new Error('Plan inválido')
  }
  
  if (days <= 0 || days > 365) {
    throw new Error('Días inválidos (debe ser 1-365)')
  }
  
  if (!reason || reason.trim().length < 5) {
    throw new Error('Debe proporcionar una razón')
  }

  if (!isSupabaseConfigured) {
    const tenantsData = JSON.parse(localStorage.getItem('state.tenants') || '{}')
    const tenants = tenantsData.tenants || []
    const idx = tenants.findIndex(t => t.id === tenantId)
    
    if (idx < 0) throw new Error('Tenant no encontrado')
    
    const tenant = tenants[idx]
    const previousTier = tenant.subscription_tier
    const previousExpires = tenant.premium_until
    
    // Calcular nueva expiración
    let newExpires
    if (tenant.premium_until && new Date(tenant.premium_until) > new Date()) {
      newExpires = new Date(tenant.premium_until)
    } else {
      newExpires = new Date()
    }
    newExpires.setDate(newExpires.getDate() + days)
    
    // Actualizar tenant
    tenants[idx] = {
      ...tenant,
      subscription_tier: planTier,
      premium_until: newExpires.toISOString(),
      subscription_status: 'active',
      orders_limit: planTier === 'premium_pro' ? null : 80,
      orders_remaining: planTier === 'premium_pro' ? null : 80,
    }
    tenantsData.tenants = tenants
    localStorage.setItem('state.tenants', JSON.stringify(tenantsData))
    
    // Crear registro de suscripción
    const subs = loadMockData(STORAGE_KEYS.SUBSCRIPTIONS)
    const subId = generateId()
    subs.push({
      id: subId,
      tenant_id: tenantId,
      plan_id: planTier,
      billing_period: 'custom',
      amount: 0,
      currency: 'USD',
      status: 'approved',
      source: 'gift',
      gifted_by: adminUserId,
      gift_reason: reason,
      starts_at: new Date().toISOString(),
      expires_at: newExpires.toISOString(),
      paid_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    })
    saveMockData(STORAGE_KEYS.SUBSCRIPTIONS, subs)
    
    // Log de regalo
    const giftLogs = loadMockData(STORAGE_KEYS.GIFT_LOG)
    giftLogs.push({
      id: generateId(),
      tenant_id: tenantId,
      tenant_name: tenant.name,
      admin_user_id: adminUserId,
      admin_email: adminEmail,
      plan_tier: planTier,
      days_granted: days,
      reason,
      subscription_id: subId,
      new_expires_at: newExpires.toISOString(),
      previous_tier: previousTier,
      previous_expires_at: previousExpires,
      created_at: new Date().toISOString(),
    })
    saveMockData(STORAGE_KEYS.GIFT_LOG, giftLogs)
    
    // Log de auditoría
    await logAuditEvent({
      tenantId,
      userId: adminUserId,
      subscriptionId: subId,
      action: AUDIT_ACTIONS.ADMIN_GIFT,
      actionType: 'admin',
      oldValue: { tier: previousTier, expires_at: previousExpires },
      newValue: { tier: planTier, expires_at: newExpires.toISOString(), days },
      description: `Superadmin otorgó ${days} días de ${planTier}: ${reason}`,
    })
    
    return {
      success: true,
      subscription_id: subId,
      tenant_id: tenantId,
      plan_tier: planTier,
      days_granted: days,
      new_expires_at: newExpires.toISOString(),
      previous_tier: previousTier,
      previous_expires_at: previousExpires,
    }
  }

  // Usar función de Supabase
  const { data, error } = await supabase
    .rpc('gift_subscription', {
      p_tenant_id: tenantId,
      p_plan_tier: planTier,
      p_days: days,
      p_reason: reason,
      p_admin_user_id: adminUserId,
    })

  if (error) throw error
  return data
}

/**
 * Obtiene el log de regalos de admin
 * @param {Object} options 
 * @returns {Promise<Array>}
 */
export const getAdminGiftLog = async ({ limit = 50, tenantId = null } = {}) => {
  if (!isSupabaseConfigured) {
    let data = loadMockData(STORAGE_KEYS.GIFT_LOG)
    if (tenantId) {
      data = data.filter(g => g.tenant_id === tenantId)
    }
    return data.slice(0, limit).sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    )
  }

  let query = supabase
    .from('admin_gift_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (tenantId) {
    query = query.eq('tenant_id', tenantId)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

/**
 * Fuerza la expiración de suscripciones vencidas
 * @returns {Promise<Array>} Tenants expirados
 */
export const expireSubscriptions = async () => {
  if (!isSupabaseConfigured) {
    const tenantsData = JSON.parse(localStorage.getItem('state.tenants') || '{}')
    const tenants = tenantsData.tenants || []
    const now = new Date()
    const expired = []
    
    tenants.forEach((tenant, idx) => {
      if (
        tenant.subscription_tier !== 'free' &&
        tenant.premium_until &&
        new Date(tenant.premium_until) < now
      ) {
        expired.push({
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          old_tier: tenant.subscription_tier,
          expired_at: tenant.premium_until,
        })
        
        tenants[idx] = {
          ...tenant,
          subscription_tier: 'free',
          subscription_status: 'active',
          orders_limit: 15,
          orders_remaining: Math.min(tenant.orders_remaining || 15, 15),
        }
      }
    })
    
    if (expired.length > 0) {
      tenantsData.tenants = tenants
      localStorage.setItem('state.tenants', JSON.stringify(tenantsData))
      
      // Log cada expiración
      for (const exp of expired) {
        await logAuditEvent({
          tenantId: exp.tenant_id,
          action: AUDIT_ACTIONS.SUBSCRIPTION_EXPIRED,
          actionType: 'cron',
          oldValue: { tier: exp.old_tier },
          newValue: { tier: 'free' },
          description: `Suscripción ${exp.old_tier} expirada automáticamente`,
        })
      }
    }
    
    return expired
  }

  const { data, error } = await supabase.rpc('expire_subscriptions')
  if (error) throw error
  return data || []
}

// ============================================================================
// AUDITORÍA
// ============================================================================

/**
 * Registra un evento de auditoría
 * @param {Object} event 
 * @returns {Promise<void>}
 */
export const logAuditEvent = async ({
  tenantId,
  userId,
  subscriptionId,
  action,
  actionType,
  oldValue,
  newValue,
  description,
  metadata = {},
}) => {
  if (!isSupabaseConfigured) {
    const logs = loadMockData(STORAGE_KEYS.AUDIT_LOG)
    logs.push({
      id: generateId(),
      tenant_id: tenantId,
      user_id: userId,
      subscription_id: subscriptionId,
      action,
      action_type: actionType,
      old_value: oldValue,
      new_value: newValue,
      description,
      metadata,
      created_at: new Date().toISOString(),
    })
    saveMockData(STORAGE_KEYS.AUDIT_LOG, logs)
    return
  }

  await supabase.from('subscription_audit_log').insert({
    tenant_id: tenantId,
    user_id: userId,
    subscription_id: subscriptionId,
    action,
    action_type: actionType,
    old_value: oldValue,
    new_value: newValue,
    description,
    metadata,
  })
}

/**
 * Obtiene el log de auditoría
 * @param {Object} options 
 * @returns {Promise<Array>}
 */
export const getAuditLog = async ({
  limit = 100,
  tenantId = null,
  action = null,
  actionType = null,
} = {}) => {
  if (!isSupabaseConfigured) {
    let data = loadMockData(STORAGE_KEYS.AUDIT_LOG)
    
    if (tenantId) data = data.filter(l => l.tenant_id === tenantId)
    if (action) data = data.filter(l => l.action === action)
    if (actionType) data = data.filter(l => l.action_type === actionType)
    
    return data.slice(0, limit).sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    )
  }

  let query = supabase
    .from('subscription_audit_log')
    .select('*, tenants(name), profiles(email)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (tenantId) query = query.eq('tenant_id', tenantId)
  if (action) query = query.eq('action', action)
  if (actionType) query = query.eq('action_type', actionType)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Calcula días restantes hasta una fecha
 * @param {string|Date} expiresAt 
 * @returns {number}
 */
export const calculateDaysRemaining = (expiresAt) => {
  if (!expiresAt) return 0
  const now = new Date()
  const expires = new Date(expiresAt)
  const diffMs = expires - now
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Verifica si una suscripción está activa
 * @param {string} tier 
 * @param {string} premiumUntil 
 * @returns {boolean}
 */
export const isSubscriptionActive = (tier, premiumUntil) => {
  if (tier === 'free') return true
  if (!premiumUntil) return false
  return new Date(premiumUntil) > new Date()
}

/**
 * Formatea una fecha para mostrar
 * @param {string|Date} date 
 * @returns {string}
 */
export const formatSubscriptionDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Obtiene el color del estado de suscripción
 * @param {number} daysRemaining 
 * @returns {string}
 */
export const getSubscriptionStatusColor = (daysRemaining) => {
  if (daysRemaining <= 0) return '#ef4444' // red
  if (daysRemaining <= 3) return '#f97316' // orange
  if (daysRemaining <= 7) return '#eab308' // yellow
  return '#22c55e' // green
}

// ============================================================================
// MERCADOPAGO SUBSCRIPTIONS API
// Funciones para manejar suscripciones con débito automático
// ============================================================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

/**
 * Crea una nueva suscripción y retorna la URL para autorizar el pago
 * El usuario será redirigido a MercadoPago para aceptar el débito automático
 * @param {string} tenantId 
 * @param {'premium'|'premium_pro'} plan 
 * @returns {Promise<{success: boolean, init_point?: string, error?: string}>}
 */
export async function createMPSubscription(tenantId, plan) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      return { success: false, error: 'No authenticated session' }
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/create-subscription`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tenant_id: tenantId, plan }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || 'Error creating subscription' }
    }

    return {
      success: true,
      init_point: data.init_point,
      preapproval_id: data.preapproval_id,
    }
  } catch (error) {
    console.error('Error creating MP subscription:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Cancela la suscripción activa del tenant
 * @param {string} tenantId 
 * @param {boolean} immediate - Si es true, cancela inmediatamente
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
export async function cancelMPSubscription(tenantId, immediate = false) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      return { success: false, error: 'No authenticated session' }
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/cancel-subscription`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tenant_id: tenantId, immediate }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || 'Error cancelling subscription' }
    }

    return {
      success: true,
      message: data.message,
    }
  } catch (error) {
    console.error('Error cancelling MP subscription:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Obtiene la información de la suscripción MP activa del tenant
 * @param {string} tenantId 
 * @returns {Promise<Object|null>}
 */
export async function getActiveMPSubscription(tenantId) {
  try {
    const { data, error } = await supabase
      .from('mp_subscriptions')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('status', ['active', 'authorized', 'pending', 'paused', 'payment_failed'])
      .single()

    if (error || !data) {
      return null
    }

    return data
  } catch (error) {
    console.error('Error fetching MP subscription:', error)
    return null
  }
}

/**
 * Obtiene el historial de pagos del tenant
 * @param {string} tenantId 
 * @param {number} limit 
 * @returns {Promise<Array>}
 */
export async function getMPPaymentHistory(tenantId, limit = 10) {
  try {
    const { data, error } = await supabase
      .from('mp_payments')
      .select('id, amount, status, payment_date, mp_payment_id')
      .eq('tenant_id', tenantId)
      .order('payment_date', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching payment history:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error fetching payment history:', error)
    return []
  }
}

/**
 * Obtiene el mensaje de estado para mostrar al usuario
 * @param {Object} subscription 
 * @returns {{status: string, title: string, message: string}}
 */
export function getMPSubscriptionStatusMessage(subscription) {
  if (!subscription) {
    return {
      status: 'info',
      title: 'Sin Suscripción',
      message: 'No tienes una suscripción activa con débito automático',
    }
  }

  switch (subscription.status) {
    case 'active':
      return {
        status: 'success',
        title: 'Suscripción Activa',
        message: subscription.next_billing_date
          ? `Próximo cobro: ${formatSubscriptionDate(subscription.next_billing_date)}`
          : 'Tu suscripción está activa',
      }

    case 'authorized':
      return {
        status: 'info',
        title: 'Suscripción Autorizada',
        message: 'Tu suscripción ha sido autorizada y el primer cobro será procesado pronto',
      }

    case 'pending':
      return {
        status: 'warning',
        title: 'Pendiente de Autorización',
        message: 'Completa el proceso en MercadoPago para activar tu suscripción',
      }

    case 'payment_failed':
      return {
        status: 'error',
        title: 'Pago Fallido',
        message: subscription.grace_period_ends
          ? `Tienes hasta el ${formatSubscriptionDate(subscription.grace_period_ends)} para actualizar tu método de pago`
          : 'Por favor actualiza tu método de pago',
      }

    case 'paused':
      return {
        status: 'warning',
        title: 'Suscripción Pausada',
        message: 'Tu suscripción está pausada',
      }

    case 'cancelled':
      return {
        status: 'warning',
        title: 'Suscripción Cancelada',
        message: subscription.end_date
          ? `Tus beneficios continúan hasta el ${formatSubscriptionDate(subscription.end_date)}`
          : 'Tu suscripción ha sido cancelada',
      }

    default:
      return {
        status: 'info',
        title: 'Estado Desconocido',
        message: 'Estado de suscripción no reconocido',
      }
  }
}

/**
 * Configuración de planes para MP
 */
export const MP_PLANS = {
  premium: {
    id: 'premium',
    name: 'Premium',
    price: 4990,
    features: [
      '80 pedidos mensuales',
      'Personalización de colores',
      'Logo personalizado',
      'Sin marca de agua',
    ],
  },
  premium_pro: {
    id: 'premium_pro',
    name: 'PRO',
    price: 7990,
    features: [
      'Pedidos ilimitados',
      'Todas las personalizaciones',
      'Soporte prioritario',
      'Análisis avanzados',
    ],
  },
}
