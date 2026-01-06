/**
 * API de MercadoPago para tenants - Supabase
 * Maneja el almacenamiento y recuperación de credenciales MP de cada tenant
 */

import { supabase, isSupabaseConfigured } from './supabaseClient'
import { FREE_DEFAULT_THEME, SUBSCRIPTION_TIERS } from '../shared/subscriptions'
import { performDowngradeToFree, performDowngradeToPremium } from './supabaseApi'

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
 * Verifica si un tenant tiene MP configurado (versión pública para storefront)
 * Usa una consulta más simple que no requiere autenticación
 * @param {string} tenantId 
 * @returns {Promise<boolean>}
 */
export const checkTenantMPConfiguredPublic = async (tenantId) => {
  if (!isSupabaseConfigured) {
    const data = loadMockData()
    return data[tenantId]?.is_configured === true
  }

  try {
    const { data, error } = await supabase
      .from('tenant_mercadopago')
      .select('is_configured, is_sandbox')
      .eq('tenant_id', tenantId)
      .single()

    if (error) {
      console.warn('checkTenantMPConfiguredPublic error:', error.message)
      return false
    }

    return data?.is_configured === true
  } catch {
    return false
  }
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
 * Obtiene una suscripción pendiente por preferenceId
 * @param {string} preferenceId 
 * @returns {Promise<Object|null>}
 */
export const getPendingSubscriptionByPreference = async (preferenceId) => {
  if (!isSupabaseConfigured) {
    const key = 'platform_subscriptions_mock'
    const data = JSON.parse(localStorage.getItem(key) || '[]')
    return data.find(s => s.mp_preference_id === preferenceId) || null
  }

  const { data, error } = await supabase
    .from('platform_subscriptions')
    .select('*')
    .eq('mp_preference_id', preferenceId)
    .single()

  if (error) {
    console.error('Error obteniendo suscripción por preferenceId:', error)
    return null
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
      tenants[idx].orders_limit = tier === 'premium_pro' ? null : tier === 'premium' ? 80 : 15
      tenants[idx].orders_remaining = tier === 'premium_pro' ? null : tier === 'premium' ? 80 : 15
      tenantsData.tenants = tenants
      localStorage.setItem('state.tenants', JSON.stringify(tenantsData))
    }
    return
  }

  // SEGURIDAD: Solo usar función RPC con SECURITY DEFINER
  // El cliente NUNCA puede hacer UPDATE directo a subscription_tier o premium_until
  // La función RPC verifica internamente que el usuario sea owner o super_admin
  const { data, error } = await supabase.rpc('update_tenant_subscription', {
    p_tenant_id: tenantId,
    p_tier: tier,
    p_expires_at: expiresAt?.toISOString() || null
  })

  if (error) {
    console.error('Error actualizando suscripción:', error)
    throw new Error(error.message || 'Error al actualizar suscripción. Contacta soporte.')
  }

  return data
}

/**
 * Downgrade tenant to a lower tier (FREE or PREMIUM)
 * Resets configurations to match the new tier
 * Works in both Supabase and MOCK mode
 * @param {string} tenantId 
 * @param {string} targetTier - 'free' or 'premium'
 * @returns {Promise<{success: boolean}>}
 */
export const performTenantDowngrade = async (tenantId, targetTier) => {
  if (!isSupabaseConfigured) {
    // En modo mock, actualizar localStorage
    const tenantsData = JSON.parse(localStorage.getItem('state.tenants') || '{}')
    const tenants = tenantsData.tenants || []
    const idx = tenants.findIndex(t => t.id === tenantId)
    
    if (idx >= 0) {
      tenants[idx].subscription_tier = targetTier
      tenants[idx].premium_until = null
      tenantsData.tenants = tenants
      localStorage.setItem('state.tenants', JSON.stringify(tenantsData))
    }

    // Reset theme en localStorage
    const themeData = JSON.parse(localStorage.getItem('state.theme') || '{}')
    if (themeData.themeByTenantId && themeData.themeByTenantId[tenantId]) {
      if (targetTier === 'free') {
        // Reset completo a FREE defaults
        themeData.themeByTenantId[tenantId] = {
          primary: FREE_DEFAULT_THEME.primary,
          accent: FREE_DEFAULT_THEME.accent,
          background: FREE_DEFAULT_THEME.background,
          text: FREE_DEFAULT_THEME.text,
          radius: FREE_DEFAULT_THEME.radius,
          fontFamily: FREE_DEFAULT_THEME.fontFamily,
          cardStyle: FREE_DEFAULT_THEME.cardStyle,
          buttonStyle: FREE_DEFAULT_THEME.buttonStyle,
          layoutStyle: FREE_DEFAULT_THEME.layoutStyle,
          productCardLayout: FREE_DEFAULT_THEME.productCardLayout,
          heroStyle: FREE_DEFAULT_THEME.heroStyle,
          heroSlides: [],
          heroTitlePosition: FREE_DEFAULT_THEME.heroTitlePosition,
          heroOverlayOpacity: FREE_DEFAULT_THEME.heroOverlayOpacity,
          heroShowTitle: FREE_DEFAULT_THEME.heroShowTitle,
          heroShowSubtitle: FREE_DEFAULT_THEME.heroShowSubtitle,
          heroShowCta: FREE_DEFAULT_THEME.heroShowCta,
          heroCarouselButtonStyle: null,
        }
      } else if (targetTier === 'premium') {
        // Solo resetear features exclusivas de PRO
        const currentTheme = themeData.themeByTenantId[tenantId]
        const proExclusiveLayouts = ['magazine', 'minimal', 'polaroid', 'banner']
        const proExclusiveHeroStyles = ['parallax_depth', 'cube_rotate', 'reveal_wipe', 'zoom_blur']
        
        if (proExclusiveLayouts.includes(currentTheme.productCardLayout)) {
          currentTheme.productCardLayout = 'horizontal'
        }
        if (proExclusiveHeroStyles.includes(currentTheme.heroStyle)) {
          currentTheme.heroStyle = 'slide_fade'
        }
        themeData.themeByTenantId[tenantId] = currentTheme
      }
      localStorage.setItem('state.theme', JSON.stringify(themeData))
    }

    return { success: true }
  }

  // En modo Supabase, usar las funciones del API
  if (targetTier === 'free') {
    return await performDowngradeToFree(tenantId)
  } else if (targetTier === 'premium') {
    return await performDowngradeToPremium(tenantId)
  }
  
  throw new Error('Tier de destino inválido: ' + targetTier)
}

// ============================================================================
// AUTO-RENOVACIÓN DE SUSCRIPCIÓN
// ============================================================================

const AUTO_RENEW_STORAGE_KEY = 'tenant_auto_renew'

/**
 * Obtiene la configuración de auto-renovación de un tenant
 * @param {string} tenantId 
 * @returns {Promise<boolean>}
 */
export const getTenantAutoRenew = async (tenantId) => {
  if (!isSupabaseConfigured) {
    // En modo mock, usar localStorage
    try {
      const data = JSON.parse(localStorage.getItem(AUTO_RENEW_STORAGE_KEY) || '{}')
      return data[tenantId] === true
    } catch {
      return false
    }
  }

  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('auto_renew')
      .eq('id', tenantId)
      .single()

    if (error) throw error
    return data?.auto_renew === true
  } catch (err) {
    // Si la columna no existe, retornar false
    console.warn('getTenantAutoRenew: Column may not exist', err.message)
    return false
  }
}

/**
 * Establece la configuración de auto-renovación de un tenant
 * @param {string} tenantId 
 * @param {boolean} autoRenew 
 * @returns {Promise<void>}
 */
export const setTenantAutoRenew = async (tenantId, autoRenew) => {
  if (!isSupabaseConfigured) {
    // En modo mock, usar localStorage
    try {
      const data = JSON.parse(localStorage.getItem(AUTO_RENEW_STORAGE_KEY) || '{}')
      data[tenantId] = autoRenew
      localStorage.setItem(AUTO_RENEW_STORAGE_KEY, JSON.stringify(data))
    } catch {
      // Ignore error
    }
    return
  }

  try {
    const { error } = await supabase
      .from('tenants')
      .update({ auto_renew: autoRenew })
      .eq('id', tenantId)

    if (error) throw error
  } catch (err) {
    // Si la columna no existe, simplemente loguear
    console.warn('setTenantAutoRenew: Column may not exist', err.message)
    // Guardar en localStorage como fallback
    try {
      const data = JSON.parse(localStorage.getItem(AUTO_RENEW_STORAGE_KEY) || '{}')
      data[tenantId] = autoRenew
      localStorage.setItem(AUTO_RENEW_STORAGE_KEY, JSON.stringify(data))
    } catch {
      // Ignore
    }
  }
}

// ============================================================================
// FUNCIONES PARA SUPER ADMIN - VER TODAS LAS SUSCRIPCIONES
// ============================================================================

/**
 * Obtiene TODAS las suscripciones de la plataforma (solo para super_admin)
 * Incluye información del tenant y días restantes
 * @returns {Promise<Array>}
 */
export const getAllPlatformSubscriptions = async () => {
  if (!isSupabaseConfigured) {
    // En modo mock
    const subsKey = 'platform_subscriptions_mock'
    const tenantsData = JSON.parse(localStorage.getItem('state.tenants') || '{}')
    const tenants = tenantsData.tenants || []
    const subs = JSON.parse(localStorage.getItem(subsKey) || '[]')
    
    // Combinar datos
    return tenants.map(tenant => {
      const tenantSubs = subs.filter(s => s.tenant_id === tenant.id)
      const activeSub = tenantSubs.find(s => s.status === 'approved')
      
      return {
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        tenant_slug: tenant.slug,
        subscription_tier: tenant.subscription_tier || 'free',
        premium_until: tenant.premium_until,
        auto_renew: tenant.auto_renew || false,
        latest_subscription: activeSub || null,
        days_remaining: calculateDaysRemaining(tenant.premium_until),
      }
    }).filter(t => t.subscription_tier !== 'free') // Solo mostrar premium
  }

  // Con Supabase: obtener tenants con su info de suscripción
  const { data: tenants, error } = await supabase
    .from('tenants')
    .select(`
      id,
      name,
      slug,
      subscription_tier,
      premium_until,
      auto_renew,
      created_at
    `)
    .in('subscription_tier', ['premium', 'premium_pro'])
    .order('premium_until', { ascending: true })

  if (error) {
    console.error('Error obteniendo suscripciones:', error)
    throw error
  }

  // Agregar días restantes a cada tenant
  return (tenants || []).map(tenant => ({
    ...tenant,
    days_remaining: calculateDaysRemaining(tenant.premium_until),
  }))
}

/**
 * Calcula los días restantes hasta una fecha
 * @param {string|Date} expiresAt 
 * @returns {number} días restantes (negativo si expiró)
 */
const calculateDaysRemaining = (expiresAt) => {
  if (!expiresAt) return 0
  const now = new Date()
  const expires = new Date(expiresAt)
  const diffMs = expires - now
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Obtiene resumen de suscripciones para dashboard de super_admin
 * @returns {Promise<Object>}
 */
export const getSubscriptionsSummary = async () => {
  const subscriptions = await getAllPlatformSubscriptions()
  
  const now = new Date()
  const summary = {
    total: subscriptions.length,
    premium: subscriptions.filter(s => s.subscription_tier === 'premium').length,
    premiumPro: subscriptions.filter(s => s.subscription_tier === 'premium_pro').length,
    expiringSoon: subscriptions.filter(s => s.days_remaining > 0 && s.days_remaining <= 7).length,
    expired: subscriptions.filter(s => s.days_remaining <= 0).length,
    autoRenewEnabled: subscriptions.filter(s => s.auto_renew).length,
    subscriptions,
  }
  
  return summary
}


