/**
 * API de MercadoPago para tenants - Supabase
 * Maneja el almacenamiento y recuperación de credenciales MP de cada tenant
 */

import { supabase, isSupabaseConfigured } from './supabaseClient'

const STORAGE_KEY = 'tenant_mercadopago_mock'

// ============================================================================
// MOCK para modo sin Supabase
// ============================================================================

const loadMockData = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

const saveMockData = (data) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

// ============================================================================
// CREDENCIALES DE TENANTS
// ============================================================================

/**
 * Obtiene las credenciales de MercadoPago de un tenant
 * @param {string} tenantId 
 * @returns {Promise<Object|null>}
 */
export const getTenantMPCredentials = async (tenantId) => {
  if (!isSupabaseConfigured) {
    const data = loadMockData()
    return data[tenantId] || null
  }

  const { data, error } = await supabase
    .from('tenant_mercadopago')
    .select('*')
    .eq('tenant_id', tenantId)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error obteniendo credenciales MP:', error)
    throw error
  }

  return data
}

/**
 * Guarda o actualiza las credenciales de MercadoPago de un tenant
 * @param {string} tenantId 
 * @param {Object} credentials 
 * @returns {Promise<Object>}
 */
export const saveTenantMPCredentials = async (tenantId, credentials) => {
  const record = {
    tenant_id: tenantId,
    access_token: credentials.accessToken || null,
    public_key: credentials.publicKey || null,
    sandbox_access_token: credentials.sandboxAccessToken || null,
    sandbox_public_key: credentials.sandboxPublicKey || null,
    is_sandbox: credentials.isSandbox !== false,
    is_configured: Boolean(
      (credentials.accessToken && credentials.publicKey) ||
      (credentials.sandboxAccessToken && credentials.sandboxPublicKey)
    ),
    webhook_secret: credentials.webhookSecret || null,
  }

  if (!isSupabaseConfigured) {
    const data = loadMockData()
    data[tenantId] = {
      ...record,
      updated_at: new Date().toISOString(),
      created_at: data[tenantId]?.created_at || new Date().toISOString(),
    }
    saveMockData(data)
    return data[tenantId]
  }

  const { data, error } = await supabase
    .from('tenant_mercadopago')
    .upsert(record, { onConflict: 'tenant_id' })
    .select()
    .single()

  if (error) {
    console.error('Error guardando credenciales MP:', error)
    throw error
  }

  return data
}

/**
 * Elimina las credenciales de MercadoPago de un tenant
 * @param {string} tenantId 
 * @returns {Promise<void>}
 */
export const deleteTenantMPCredentials = async (tenantId) => {
  if (!isSupabaseConfigured) {
    const data = loadMockData()
    delete data[tenantId]
    saveMockData(data)
    return
  }

  const { error } = await supabase
    .from('tenant_mercadopago')
    .delete()
    .eq('tenant_id', tenantId)

  if (error) {
    console.error('Error eliminando credenciales MP:', error)
    throw error
  }
}

/**
 * Verifica si un tenant tiene MP configurado
 * @param {string} tenantId 
 * @returns {Promise<boolean>}
 */
export const isTenantMPConfigured = async (tenantId) => {
  const credentials = await getTenantMPCredentials(tenantId)
  return credentials?.is_configured === true
}

/**
 * Obtiene las credenciales activas de un tenant según su modo (sandbox/production)
 * @param {string} tenantId 
 * @returns {Promise<Object|null>}
 */
export const getTenantActiveCredentials = async (tenantId) => {
  const credentials = await getTenantMPCredentials(tenantId)
  
  if (!credentials || !credentials.is_configured) {
    return null
  }

  if (credentials.is_sandbox) {
    return {
      accessToken: credentials.sandbox_access_token,
      publicKey: credentials.sandbox_public_key,
      isSandbox: true,
    }
  }

  return {
    accessToken: credentials.access_token,
    publicKey: credentials.public_key,
    isSandbox: false,
  }
}

// ============================================================================
// SUSCRIPCIONES DE PLATAFORMA
// ============================================================================

/**
 * Registra una suscripción pendiente
 * @param {Object} subscription 
 * @returns {Promise<Object>}
 */
export const createPlatformSubscription = async (subscription) => {
  const record = {
    tenant_id: subscription.tenantId,
    mp_preference_id: subscription.preferenceId,
    plan_tier: subscription.planTier,
    billing_period: subscription.billingPeriod,
    amount: subscription.amount,
    currency: subscription.currency || 'ARS',
    status: 'pending',
  }

  if (!isSupabaseConfigured) {
    const key = 'platform_subscriptions_mock'
    const data = JSON.parse(localStorage.getItem(key) || '[]')
    const newRecord = {
      ...record,
      id: `sub_${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    data.push(newRecord)
    localStorage.setItem(key, JSON.stringify(data))
    return newRecord
  }

  const { data, error } = await supabase
    .from('platform_subscriptions')
    .insert(record)
    .select()
    .single()

  if (error) {
    console.error('Error creando suscripción:', error)
    throw error
  }

  return data
}

/**
 * Actualiza una suscripción después del pago
 * @param {string} preferenceId 
 * @param {Object} updates 
 * @returns {Promise<Object>}
 */
export const updatePlatformSubscription = async (preferenceId, updates) => {
  if (!isSupabaseConfigured) {
    const key = 'platform_subscriptions_mock'
    const data = JSON.parse(localStorage.getItem(key) || '[]')
    const idx = data.findIndex(s => s.mp_preference_id === preferenceId)
    if (idx >= 0) {
      data[idx] = { ...data[idx], ...updates, updated_at: new Date().toISOString() }
      localStorage.setItem(key, JSON.stringify(data))
      return data[idx]
    }
    return null
  }

  const { data, error } = await supabase
    .from('platform_subscriptions')
    .update({
      mp_payment_id: updates.paymentId,
      status: updates.status,
      paid_at: updates.paidAt,
      expires_at: updates.expiresAt,
    })
    .eq('mp_preference_id', preferenceId)
    .select()
    .single()

  if (error) {
    console.error('Error actualizando suscripción:', error)
    throw error
  }

  return data
}

/**
 * Obtiene las suscripciones de un tenant
 * @param {string} tenantId 
 * @returns {Promise<Array>}
 */
export const getTenantSubscriptions = async (tenantId) => {
  if (!isSupabaseConfigured) {
    const key = 'platform_subscriptions_mock'
    const data = JSON.parse(localStorage.getItem(key) || '[]')
    return data.filter(s => s.tenant_id === tenantId)
  }

  const { data, error } = await supabase
    .from('platform_subscriptions')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error obteniendo suscripciones:', error)
    throw error
  }

  return data || []
}

/**
 * Actualiza el tier de suscripción de un tenant
 * @param {string} tenantId 
 * @param {string} tier 
 * @param {Date} expiresAt 
 * @returns {Promise<void>}
 */
export const updateTenantSubscriptionTier = async (tenantId, tier, expiresAt) => {
  if (!isSupabaseConfigured) {
    // En modo mock, actualizar el tenant en localStorage
    const tenantsData = JSON.parse(localStorage.getItem('state.tenants') || '{}')
    const tenants = tenantsData.tenants || []
    const idx = tenants.findIndex(t => t.id === tenantId)
    if (idx >= 0) {
      tenants[idx].subscription_tier = tier
      tenants[idx].premium_until = expiresAt?.toISOString() || null
      tenantsData.tenants = tenants
      localStorage.setItem('state.tenants', JSON.stringify(tenantsData))
    }
    return
  }

  const { error } = await supabase
    .from('tenants')
    .update({
      subscription_tier: tier,
      premium_until: expiresAt?.toISOString() || null,
    })
    .eq('id', tenantId)

  if (error) {
    console.error('Error actualizando tier de tenant:', error)
    throw error
  }
}
