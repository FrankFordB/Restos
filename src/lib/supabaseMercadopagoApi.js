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
    .maybeSingle()

  if (error) {
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
 * Schedule a tier change for when the current subscription expires
 * The user keeps their current tier until expiration
 * @param {string} tenantId 
 * @param {string} targetTier - 'free' or 'premium'
 * @param {string} premiumUntil - Current subscription expiration date
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const scheduleTierChange = async (tenantId, targetTier, premiumUntil = null) => {
  if (!isSupabaseConfigured) {
    // En modo mock, guardar el tier programado en localStorage
    const tenantsData = JSON.parse(localStorage.getItem('state.tenants') || '{}')
    const tenants = tenantsData.tenants || []
    const idx = tenants.findIndex(t => t.id === tenantId)
    
    if (idx >= 0) {
      tenants[idx].scheduled_tier = targetTier
      tenants[idx].scheduled_at = new Date().toISOString()
      tenantsData.tenants = tenants
      localStorage.setItem('state.tenants', JSON.stringify(tenantsData))
    }

    const expiryDate = premiumUntil ? new Date(premiumUntil).toLocaleDateString() : 'que expire'
    return { 
      success: true, 
      scheduled: true,
      message: `Cambio programado. Tu plan actual seguirá activo hasta ${expiryDate}.`
    }
  }

  // En modo Supabase, usar la función RPC
  const { data, error } = await supabase.rpc('schedule_tier_change', {
    p_tenant_id: tenantId,
    p_scheduled_tier: targetTier
  })

  if (error) throw error

  return {
    success: true,
    scheduled: true,
    ...data
  }
}

/**
 * Cancel a scheduled tier change
 * @param {string} tenantId 
 * @returns {Promise<{success: boolean}>}
 */
export const cancelScheduledTierChange = async (tenantId) => {
  if (!isSupabaseConfigured) {
    // En modo mock
    const tenantsData = JSON.parse(localStorage.getItem('state.tenants') || '{}')
    const tenants = tenantsData.tenants || []
    const idx = tenants.findIndex(t => t.id === tenantId)
    
    if (idx >= 0) {
      tenants[idx].scheduled_tier = null
      tenants[idx].scheduled_at = null
      tenantsData.tenants = tenants
      localStorage.setItem('state.tenants', JSON.stringify(tenantsData))
    }

    return { success: true, message: 'Cambio cancelado. Mantendrás tu plan actual.' }
  }

  // En modo Supabase
  const { data, error } = await supabase.rpc('cancel_scheduled_tier_change', {
    p_tenant_id: tenantId
  })

  if (error) throw error
  return data
}

/**
 * Downgrade tenant to a lower tier IMMEDIATELY
 * Only use this when subscription has expired or for testing
 * @param {string} tenantId 
 * @param {string} targetTier - 'free' or 'premium'
 * @param {string} premiumUntil - Expiration date to preserve (for premium downgrade)
 * @returns {Promise<{success: boolean}>}
 */
export const performTenantDowngrade = async (tenantId, targetTier, premiumUntil = null) => {
  if (!isSupabaseConfigured) {
    // En modo mock, actualizar localStorage
    const tenantsData = JSON.parse(localStorage.getItem('state.tenants') || '{}')
    const tenants = tenantsData.tenants || []
    const idx = tenants.findIndex(t => t.id === tenantId)
    
    if (idx >= 0) {
      tenants[idx].subscription_tier = targetTier
      // Solo borrar premium_until si es downgrade a FREE
      if (targetTier === 'free') {
        tenants[idx].premium_until = null
      }
      // Si es downgrade a premium, mantener la fecha de expiración
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
    // Pasar la fecha de expiración para preservar los días restantes
    return await performDowngradeToPremium(tenantId, premiumUntil)
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

// ============================================================================
// AUTO-RENOVACIÓN CON MERCADOPAGO
// ============================================================================

/**
 * Obtiene suscripciones que necesitan renovarse (vencen en 1-2 días)
 * @returns {Promise<Array>}
 */
export const getSubscriptionsToRenew = async () => {
  if (!isSupabaseConfigured) {
    // En modo mock, simular la búsqueda
    const tenantsData = JSON.parse(localStorage.getItem('state.tenants') || '{}')
    const tenants = tenantsData.tenants || []
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    return tenants.filter(t => {
      if (!t.auto_renew || t.subscription_tier === 'free' || t.scheduled_tier) return false
      if (!t.premium_until) return false
      const expiry = new Date(t.premium_until)
      const now = new Date()
      const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24))
      return diffDays >= 0 && diffDays <= 2
    }).map(t => ({
      tenant_id: t.id,
      tenant_name: t.name,
      subscription_tier: t.subscription_tier,
      premium_until: t.premium_until,
    }))
  }

  const { data, error } = await supabase.rpc('get_subscriptions_to_renew')
  
  if (error) {
    console.error('Error getting subscriptions to renew:', error)
    throw error
  }
  
  return data || []
}

/**
 * Guarda un método de pago para renovación automática
 * @param {string} tenantId 
 * @param {Object} paymentMethod 
 * @returns {Promise<Object>}
 */
export const savePaymentMethod = async (tenantId, paymentMethod) => {
  if (!isSupabaseConfigured) {
    // En modo mock
    const key = 'tenant_payment_methods_mock'
    const data = JSON.parse(localStorage.getItem(key) || '{}')
    data[tenantId] = {
      ...paymentMethod,
      tenant_id: tenantId,
      is_default: true,
      created_at: new Date().toISOString(),
    }
    localStorage.setItem(key, JSON.stringify(data))
    return data[tenantId]
  }

  const { data, error } = await supabase
    .from('tenant_payment_methods')
    .upsert({
      tenant_id: tenantId,
      mp_customer_id: paymentMethod.customerId,
      mp_card_id: paymentMethod.cardId,
      last_four_digits: paymentMethod.lastFourDigits,
      card_brand: paymentMethod.cardBrand,
      expiration_month: paymentMethod.expirationMonth,
      expiration_year: paymentMethod.expirationYear,
      is_default: true,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'tenant_id,mp_card_id',
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Obtiene el método de pago guardado de un tenant
 * @param {string} tenantId 
 * @returns {Promise<Object|null>}
 */
export const getSavedPaymentMethod = async (tenantId) => {
  if (!isSupabaseConfigured) {
    const key = 'tenant_payment_methods_mock'
    const data = JSON.parse(localStorage.getItem(key) || '{}')
    return data[tenantId] || null
  }

  const { data, error } = await supabase
    .from('tenant_payment_methods')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_default', true)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}

/**
 * Elimina el método de pago guardado
 * @param {string} tenantId 
 * @returns {Promise<void>}
 */
export const deletePaymentMethod = async (tenantId) => {
  if (!isSupabaseConfigured) {
    const key = 'tenant_payment_methods_mock'
    const data = JSON.parse(localStorage.getItem(key) || '{}')
    delete data[tenantId]
    localStorage.setItem(key, JSON.stringify(data))
    return
  }

  const { error } = await supabase
    .from('tenant_payment_methods')
    .delete()
    .eq('tenant_id', tenantId)

  if (error) throw error
}

/**
 * Registra un intento de renovación automática
 * @param {string} tenantId 
 * @param {Object} details 
 * @returns {Promise<Object>}
 */
export const logRenewalAttempt = async (tenantId, details) => {
  if (!isSupabaseConfigured) {
    const key = 'auto_renewal_log_mock'
    const logs = JSON.parse(localStorage.getItem(key) || '[]')
    const log = {
      id: `log_${Date.now()}`,
      tenant_id: tenantId,
      ...details,
      attempted_at: new Date().toISOString(),
    }
    logs.push(log)
    localStorage.setItem(key, JSON.stringify(logs))
    return log
  }

  const { data, error } = await supabase.rpc('log_renewal_attempt', {
    p_tenant_id: tenantId,
    p_tier: details.tier,
    p_amount: details.amount,
    p_status: details.status,
    p_payment_id: details.paymentId || null,
    p_error: details.error || null,
  })

  if (error) throw error
  return { id: data }
}

/**
 * Obtiene el historial de renovaciones de un tenant
 * @param {string} tenantId 
 * @returns {Promise<Array>}
 */
export const getRenewalHistory = async (tenantId) => {
  if (!isSupabaseConfigured) {
    const key = 'auto_renewal_log_mock'
    const logs = JSON.parse(localStorage.getItem(key) || '[]')
    return logs.filter(l => l.tenant_id === tenantId)
  }

  const { data, error } = await supabase
    .from('auto_renewal_log')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('attempted_at', { ascending: false })
    .limit(10)

  if (error) throw error
  return data || []
}
