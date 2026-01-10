/**
 * API de Referidos - Supabase
 * 
 * Maneja el sistema completo de referidos:
 * - Códigos de referido
 * - Registro y conversión de referidos
 * - Recompensas y créditos
 * - Estadísticas
 * - Funciones de administración
 */

import { supabase, isSupabaseConfigured } from './supabaseClient'

// ============================================================================
// CONSTANTES
// ============================================================================

const STORAGE_KEYS = {
  REFERRAL_CODES: 'referral_codes_mock',
  REFERRAL_USES: 'referral_uses_mock',
  REFERRAL_REWARDS: 'referral_rewards_mock',
  REFERRAL_CONFIG: 'referral_config_mock',
  REFERRAL_AUDIT: 'referral_audit_mock',
}

// Estados de referidos
export const REFERRAL_STATUS = {
  PENDING: 'pending',
  CONVERTED: 'converted',
  REJECTED: 'rejected',
  MANUAL_REVIEW: 'manual_review',
}

// Tipos de recompensa
export const REWARD_TYPES = {
  TIER_1: 'tier_1',   // 5 referidos = 1 mes
  TIER_2: 'tier_2',   // 10 referidos = 1 mes adicional
  TIER_3: 'tier_3',   // 30 referidos = 4 meses premium pro
  BONUS: 'bonus',
  MANUAL: 'manual',
}

// Estados de recompensa
export const REWARD_STATUS = {
  PENDING: 'pending',
  APPLIED: 'applied',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
}

// Configuración por defecto
const DEFAULT_CONFIG = {
  tier_1_referrals: 5,
  tier_1_reward_months: 1,
  tier_1_reward_plan: 'premium',
  tier_2_referrals: 10,
  tier_2_reward_months: 1,
  tier_2_reward_plan: 'premium',
  tier_3_referrals: 30,
  tier_3_reward_months: 4,
  tier_3_reward_plan: 'premium_pro',
  max_referrals_per_user_per_month: 100,
  max_conversions_per_ip_per_day: 5,
  max_accounts_per_device: 3,
  credit_expiration_days: 365,
  is_active: true,
}

// ============================================================================
// HELPERS MOCK
// ============================================================================

const loadMockData = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}')
  } catch {
    return {}
  }
}

const saveMockData = (key, data) => {
  localStorage.setItem(key, JSON.stringify(data))
}

const loadMockArray = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]')
  } catch {
    return []
  }
}

const saveMockArray = (key, data) => {
  localStorage.setItem(key, JSON.stringify(data))
}

const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

const generateCode = (prefix = 'REST') => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `${prefix}-${code}`
}

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

/**
 * Obtiene la configuración del sistema de referidos
 */
export const getReferralConfig = async () => {
  if (!isSupabaseConfigured) {
    const stored = loadMockData(STORAGE_KEYS.REFERRAL_CONFIG)
    return stored.config || { ...DEFAULT_CONFIG, id: 'mock_config' }
  }

  const { data, error } = await supabase
    .from('referral_config')
    .select('*')
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error obteniendo config de referidos:', error)
    throw error
  }

  return data || DEFAULT_CONFIG
}

/**
 * Actualiza la configuración (solo super_admin)
 */
export const updateReferralConfig = async (configUpdates) => {
  if (!isSupabaseConfigured) {
    const stored = loadMockData(STORAGE_KEYS.REFERRAL_CONFIG)
    const updated = {
      config: {
        ...DEFAULT_CONFIG,
        ...stored.config,
        ...configUpdates,
        updated_at: new Date().toISOString(),
      }
    }
    saveMockData(STORAGE_KEYS.REFERRAL_CONFIG, updated)
    return updated.config
  }

  const { data: existing } = await supabase
    .from('referral_config')
    .select('id')
    .limit(1)
    .single()

  if (!existing) {
    const { data, error } = await supabase
      .from('referral_config')
      .insert({ ...DEFAULT_CONFIG, ...configUpdates })
      .select()
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from('referral_config')
    .update(configUpdates)
    .eq('id', existing.id)
    .select()
    .single()

  if (error) throw error
  return data
}

// ============================================================================
// CÓDIGOS DE REFERIDO
// ============================================================================

/**
 * Obtiene o crea el código de referido de un tenant
 */
export const getOrCreateReferralCode = async (tenantId, userId) => {
  if (!isSupabaseConfigured) {
    const codes = loadMockArray(STORAGE_KEYS.REFERRAL_CODES)
    
    // Buscar existente
    let existing = codes.find(c => c.tenant_id === tenantId && c.owner_user_id === userId)
    
    if (existing) {
      return { ...existing, is_new: false }
    }
    
    // Crear nuevo
    const newCode = {
      id: generateId(),
      tenant_id: tenantId,
      owner_user_id: userId,
      code: generateCode('REST'),
      total_uses: 0,
      total_conversions: 0,
      total_pending: 0,
      total_rejected: 0,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    
    codes.push(newCode)
    saveMockArray(STORAGE_KEYS.REFERRAL_CODES, codes)
    
    return { ...newCode, is_new: true }
  }

  const { data, error } = await supabase.rpc('get_or_create_referral_code', {
    p_tenant_id: tenantId,
    p_user_id: userId,
  })

  if (error) throw error
  
  // La función devuelve un array, tomamos el primer elemento
  const result = data?.[0] || data
  
  // Normalizar respuesta para que tenga la misma estructura que el mock
  // La RPC devuelve: { code_id, code, is_new }
  // Necesitamos: { id, code, is_new, ... }
  return {
    id: result.code_id || result.id,
    code: result.code,
    is_new: result.is_new,
    tenant_id: tenantId,
    owner_user_id: userId,
    total_uses: 0,
    total_conversions: 0,
    total_pending: 0,
    total_rejected: 0,
    is_active: true,
  }
}

/**
 * Obtiene el código de referido de un tenant (sin crear)
 */
export const getReferralCode = async (tenantId) => {
  if (!isSupabaseConfigured) {
    const codes = loadMockArray(STORAGE_KEYS.REFERRAL_CODES)
    return codes.find(c => c.tenant_id === tenantId) || null
  }

  const { data, error } = await supabase
    .from('referral_codes')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) throw error
  return data
}

/**
 * Valida si un código de referido existe y está activo
 */
export const validateReferralCode = async (code) => {
  if (!isSupabaseConfigured) {
    const codes = loadMockArray(STORAGE_KEYS.REFERRAL_CODES)
    const found = codes.find(c => c.code.toUpperCase() === code.toUpperCase() && c.is_active)
    return found ? { valid: true, code: found } : { valid: false, code: null }
  }

  const { data, error } = await supabase
    .from('referral_codes')
    .select('*, tenants(name, slug)')
    .eq('code', code.toUpperCase())
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw error
  return data ? { valid: true, code: data } : { valid: false, code: null }
}

// ============================================================================
// REGISTRO DE REFERIDOS
// ============================================================================

/**
 * Registra un uso de código de referido (cuando un usuario se registra)
 */
export const registerReferralUse = async ({
  code,
  referredUserId,
  referredEmail,
  ip = null,
  userAgent = null,
  deviceFingerprint = null,
}) => {
  if (!isSupabaseConfigured) {
    const codes = loadMockArray(STORAGE_KEYS.REFERRAL_CODES)
    const uses = loadMockArray(STORAGE_KEYS.REFERRAL_USES)
    const config = (await getReferralConfig())
    
    // Buscar código
    const codeRecord = codes.find(c => c.code.toUpperCase() === code.toUpperCase() && c.is_active)
    if (!codeRecord) {
      return { success: false, message: 'Código de referido inválido', referral_use_id: null }
    }
    
    // Verificar auto-referido
    if (codeRecord.owner_user_id === referredUserId) {
      return { success: false, message: 'No puedes usar tu propio código de referido', referral_use_id: null }
    }
    
    // Verificar si ya fue referido
    if (uses.some(u => u.referred_user_id === referredUserId)) {
      return { success: false, message: 'Este usuario ya fue referido anteriormente', referral_use_id: null }
    }
    
    // Crear uso
    const newUse = {
      id: generateId(),
      referral_code_id: codeRecord.id,
      referrer_tenant_id: codeRecord.tenant_id,
      referrer_user_id: codeRecord.owner_user_id,
      referred_user_id: referredUserId,
      referred_email: referredEmail,
      status: REFERRAL_STATUS.PENDING,
      registration_ip: ip,
      registration_user_agent: userAgent,
      registration_device_fingerprint: deviceFingerprint,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    
    uses.push(newUse)
    saveMockArray(STORAGE_KEYS.REFERRAL_USES, uses)
    
    // Actualizar contadores
    const codeIdx = codes.findIndex(c => c.id === codeRecord.id)
    codes[codeIdx].total_uses += 1
    codes[codeIdx].total_pending += 1
    codes[codeIdx].updated_at = new Date().toISOString()
    saveMockArray(STORAGE_KEYS.REFERRAL_CODES, codes)
    
    return { success: true, message: 'Referido registrado exitosamente', referral_use_id: newUse.id }
  }

  const { data, error } = await supabase.rpc('register_referral_use', {
    p_code: code,
    p_referred_user_id: referredUserId,
    p_referred_email: referredEmail,
    p_ip: ip,
    p_user_agent: userAgent,
    p_device_fingerprint: deviceFingerprint,
  })

  if (error) throw error
  return data?.[0] || data
}

/**
 * Convierte un referido después de un pago exitoso
 */
export const convertReferral = async ({
  referredUserId,
  paymentId,
  amount,
  currency = 'ARS',
  plan = 'premium',
  ip = null,
  userAgent = null,
}) => {
  if (!isSupabaseConfigured) {
    const codes = loadMockArray(STORAGE_KEYS.REFERRAL_CODES)
    const uses = loadMockArray(STORAGE_KEYS.REFERRAL_USES)
    const rewards = loadMockArray(STORAGE_KEYS.REFERRAL_REWARDS)
    const config = await getReferralConfig()
    
    // Buscar uso pendiente
    const useIdx = uses.findIndex(u => u.referred_user_id === referredUserId && u.status === REFERRAL_STATUS.PENDING)
    
    if (useIdx < 0) {
      const existingUse = uses.find(u => u.referred_user_id === referredUserId)
      if (existingUse?.status === REFERRAL_STATUS.CONVERTED) {
        return { success: false, message: 'Este referido ya fue convertido', reward_created: false }
      }
      return { success: false, message: 'No hay referido pendiente para este usuario', reward_created: false }
    }
    
    const useRecord = uses[useIdx]
    
    // Actualizar uso
    uses[useIdx] = {
      ...useRecord,
      status: REFERRAL_STATUS.CONVERTED,
      conversion_payment_id: paymentId,
      conversion_amount: amount,
      conversion_currency: currency,
      conversion_plan: plan,
      converted_at: new Date().toISOString(),
      conversion_ip: ip,
      conversion_user_agent: userAgent,
      updated_at: new Date().toISOString(),
    }
    saveMockArray(STORAGE_KEYS.REFERRAL_USES, uses)
    
    // Actualizar contadores del código
    const codeIdx = codes.findIndex(c => c.id === useRecord.referral_code_id)
    codes[codeIdx].total_conversions += 1
    codes[codeIdx].total_pending -= 1
    codes[codeIdx].updated_at = new Date().toISOString()
    saveMockArray(STORAGE_KEYS.REFERRAL_CODES, codes)
    
    const totalConversions = codes[codeIdx].total_conversions
    let rewardCreated = false
    let rewardType = null
    
    // Verificar umbrales de recompensa
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + config.credit_expiration_days)
    
    // Tier 3: 30 referidos
    if (totalConversions === config.tier_3_referrals) {
      rewardType = REWARD_TYPES.TIER_3
      rewards.push({
        id: generateId(),
        tenant_id: useRecord.referrer_tenant_id,
        user_id: useRecord.referrer_user_id,
        reward_type: rewardType,
        reward_plan: config.tier_3_reward_plan,
        reward_months: config.tier_3_reward_months,
        reward_days: 0,
        description: `¡Felicidades! Alcanzaste ${config.tier_3_referrals} referidos. ${config.tier_3_reward_months} meses de ${config.tier_3_reward_plan} gratis.`,
        status: REWARD_STATUS.PENDING,
        expires_at: expiresAt.toISOString(),
        triggered_by_referral_use_id: useRecord.id,
        referral_count_at_trigger: totalConversions,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      rewardCreated = true
    }
    // Tier 2: 10 referidos
    else if (totalConversions === config.tier_2_referrals) {
      rewardType = REWARD_TYPES.TIER_2
      rewards.push({
        id: generateId(),
        tenant_id: useRecord.referrer_tenant_id,
        user_id: useRecord.referrer_user_id,
        reward_type: rewardType,
        reward_plan: config.tier_2_reward_plan,
        reward_months: config.tier_2_reward_months,
        reward_days: 0,
        description: `¡Increíble! Alcanzaste ${config.tier_2_referrals} referidos. ${config.tier_2_reward_months} mes adicional de ${config.tier_2_reward_plan} gratis.`,
        status: REWARD_STATUS.PENDING,
        expires_at: expiresAt.toISOString(),
        triggered_by_referral_use_id: useRecord.id,
        referral_count_at_trigger: totalConversions,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      rewardCreated = true
    }
    // Tier 1: Cada 5 referidos
    else if (totalConversions % config.tier_1_referrals === 0) {
      rewardType = REWARD_TYPES.TIER_1
      rewards.push({
        id: generateId(),
        tenant_id: useRecord.referrer_tenant_id,
        user_id: useRecord.referrer_user_id,
        reward_type: rewardType,
        reward_plan: config.tier_1_reward_plan,
        reward_months: config.tier_1_reward_months,
        reward_days: 0,
        description: `Alcanzaste ${totalConversions} referidos. ${config.tier_1_reward_months} mes de ${config.tier_1_reward_plan} gratis.`,
        status: REWARD_STATUS.PENDING,
        expires_at: expiresAt.toISOString(),
        triggered_by_referral_use_id: useRecord.id,
        referral_count_at_trigger: totalConversions,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      rewardCreated = true
    }
    
    if (rewardCreated) {
      saveMockArray(STORAGE_KEYS.REFERRAL_REWARDS, rewards)
    }
    
    return {
      success: true,
      message: 'Referido convertido exitosamente',
      reward_created: rewardCreated,
      reward_type: rewardType,
      new_total_conversions: totalConversions,
    }
  }

  const { data, error } = await supabase.rpc('convert_referral', {
    p_referred_user_id: referredUserId,
    p_payment_id: paymentId,
    p_amount: amount,
    p_currency: currency,
    p_plan: plan,
    p_ip: ip,
    p_user_agent: userAgent,
  })

  if (error) throw error
  return data?.[0] || data
}

// ============================================================================
// ESTADÍSTICAS
// ============================================================================

/**
 * Obtiene las estadísticas de referidos de un tenant
 */
export const getReferralStats = async (tenantId) => {
  if (!isSupabaseConfigured) {
    const codes = loadMockArray(STORAGE_KEYS.REFERRAL_CODES)
    const rewards = loadMockArray(STORAGE_KEYS.REFERRAL_REWARDS)
    const config = await getReferralConfig()
    
    const code = codes.find(c => c.tenant_id === tenantId)
    
    if (!code) {
      return {
        total_referrals: 0,
        pending_referrals: 0,
        converted_referrals: 0,
        rejected_referrals: 0,
        pending_rewards: 0,
        applied_rewards: 0,
        total_reward_months: 0,
        next_reward_at: config.tier_1_referrals,
        referral_code: null,
      }
    }
    
    const tenantRewards = rewards.filter(r => r.tenant_id === tenantId)
    const pendingRewards = tenantRewards.filter(r => r.status === REWARD_STATUS.PENDING)
    const appliedRewards = tenantRewards.filter(r => r.status === REWARD_STATUS.APPLIED)
    const totalMonths = tenantRewards
      .filter(r => r.status === REWARD_STATUS.PENDING || r.status === REWARD_STATUS.APPLIED)
      .reduce((sum, r) => sum + (r.reward_months || 0), 0)
    
    let nextRewardAt = config.tier_1_referrals - (code.total_conversions % config.tier_1_referrals)
    if (nextRewardAt === config.tier_1_referrals && code.total_conversions > 0) {
      nextRewardAt = config.tier_1_referrals
    }
    
    return {
      total_referrals: code.total_uses,
      pending_referrals: code.total_pending,
      converted_referrals: code.total_conversions,
      rejected_referrals: code.total_rejected,
      pending_rewards: pendingRewards.length,
      applied_rewards: appliedRewards.length,
      total_reward_months: totalMonths,
      next_reward_at: nextRewardAt,
      referral_code: code.code,
    }
  }

  const { data, error } = await supabase.rpc('get_referral_stats', {
    p_tenant_id: tenantId,
  })

  if (error) throw error
  return data?.[0] || data
}

/**
 * Obtiene la lista de referidos de un tenant
 */
export const getReferralUses = async (tenantId, options = {}) => {
  const { status, limit = 50, offset = 0 } = options

  if (!isSupabaseConfigured) {
    const uses = loadMockArray(STORAGE_KEYS.REFERRAL_USES)
    let filtered = uses.filter(u => u.referrer_tenant_id === tenantId)
    
    if (status) {
      filtered = filtered.filter(u => u.status === status)
    }
    
    return filtered
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(offset, offset + limit)
  }

  let query = supabase
    .from('referral_uses')
    .select('*')
    .eq('referrer_tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

// ============================================================================
// RECOMPENSAS
// ============================================================================

/**
 * Obtiene las recompensas de un tenant
 */
export const getReferralRewards = async (tenantId, options = {}) => {
  const { status, limit = 50, offset = 0 } = options

  if (!isSupabaseConfigured) {
    const rewards = loadMockArray(STORAGE_KEYS.REFERRAL_REWARDS)
    let filtered = rewards.filter(r => r.tenant_id === tenantId)
    
    if (status) {
      filtered = filtered.filter(r => r.status === status)
    }
    
    return filtered
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(offset, offset + limit)
  }

  let query = supabase
    .from('referral_rewards')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

/**
 * Aplica una recompensa a la suscripción del tenant
 */
export const applyReferralReward = async (rewardId, appliedBy = null) => {
  if (!isSupabaseConfigured) {
    const rewards = loadMockArray(STORAGE_KEYS.REFERRAL_REWARDS)
    const rewardIdx = rewards.findIndex(r => r.id === rewardId)
    
    if (rewardIdx < 0) {
      return { success: false, message: 'Recompensa no encontrada', new_premium_until: null }
    }
    
    const reward = rewards[rewardIdx]
    
    if (reward.status !== REWARD_STATUS.PENDING) {
      return { success: false, message: `Esta recompensa ya fue ${reward.status}`, new_premium_until: null }
    }
    
    if (new Date(reward.expires_at) < new Date()) {
      rewards[rewardIdx].status = REWARD_STATUS.EXPIRED
      rewards[rewardIdx].updated_at = new Date().toISOString()
      saveMockArray(STORAGE_KEYS.REFERRAL_REWARDS, rewards)
      return { success: false, message: 'Esta recompensa ha expirado', new_premium_until: null }
    }
    
    // Calcular nueva fecha de premium
    const tenantsData = JSON.parse(localStorage.getItem('state.tenants') || '{}')
    const tenant = (tenantsData.tenants || []).find(t => t.id === reward.tenant_id)
    
    let baseDate = new Date()
    if (tenant?.premium_until && new Date(tenant.premium_until) > new Date()) {
      baseDate = new Date(tenant.premium_until)
    }
    
    const newPremiumUntil = new Date(baseDate)
    newPremiumUntil.setMonth(newPremiumUntil.getMonth() + reward.reward_months)
    newPremiumUntil.setDate(newPremiumUntil.getDate() + (reward.reward_days || 0))
    
    // Actualizar tenant
    if (tenant) {
      const tenantIdx = tenantsData.tenants.findIndex(t => t.id === reward.tenant_id)
      tenantsData.tenants[tenantIdx].premium_until = newPremiumUntil.toISOString()
      if (reward.reward_plan === 'premium_pro' || tenantsData.tenants[tenantIdx].subscription_tier === 'free') {
        tenantsData.tenants[tenantIdx].subscription_tier = reward.reward_plan
      }
      localStorage.setItem('state.tenants', JSON.stringify(tenantsData))
    }
    
    // Actualizar recompensa
    rewards[rewardIdx] = {
      ...reward,
      status: REWARD_STATUS.APPLIED,
      applied_at: new Date().toISOString(),
      subscription_extended_until: newPremiumUntil.toISOString(),
      updated_at: new Date().toISOString(),
    }
    saveMockArray(STORAGE_KEYS.REFERRAL_REWARDS, rewards)
    
    return { success: true, message: 'Recompensa aplicada exitosamente', new_premium_until: newPremiumUntil.toISOString() }
  }

  const { data, error } = await supabase.rpc('apply_referral_reward', {
    p_reward_id: rewardId,
    p_applied_by: appliedBy,
  })

  if (error) throw error
  return data?.[0] || data
}

/**
 * Revoca una recompensa (admin)
 */
export const revokeReferralReward = async (rewardId, revokedBy, reason) => {
  if (!isSupabaseConfigured) {
    const rewards = loadMockArray(STORAGE_KEYS.REFERRAL_REWARDS)
    const rewardIdx = rewards.findIndex(r => r.id === rewardId)
    
    if (rewardIdx < 0) {
      return { success: false, message: 'Recompensa no encontrada' }
    }
    
    if (rewards[rewardIdx].status === REWARD_STATUS.REVOKED) {
      return { success: false, message: 'Esta recompensa ya fue revocada' }
    }
    
    rewards[rewardIdx] = {
      ...rewards[rewardIdx],
      status: REWARD_STATUS.REVOKED,
      revoked_at: new Date().toISOString(),
      revoked_by: revokedBy,
      revocation_reason: reason,
      updated_at: new Date().toISOString(),
    }
    saveMockArray(STORAGE_KEYS.REFERRAL_REWARDS, rewards)
    
    return { success: true, message: 'Recompensa revocada exitosamente' }
  }

  const { data, error } = await supabase.rpc('revoke_referral_reward', {
    p_reward_id: rewardId,
    p_revoked_by: revokedBy,
    p_reason: reason,
  })

  if (error) throw error
  return data?.[0] || data
}

// ============================================================================
// ADMINISTRACIÓN
// ============================================================================

/**
 * Rechaza un referido (admin)
 */
export const rejectReferral = async (referralUseId, rejectedBy, reason) => {
  if (!isSupabaseConfigured) {
    const uses = loadMockArray(STORAGE_KEYS.REFERRAL_USES)
    const codes = loadMockArray(STORAGE_KEYS.REFERRAL_CODES)
    
    const useIdx = uses.findIndex(u => u.id === referralUseId)
    if (useIdx < 0) {
      return { success: false, message: 'Referido no encontrado' }
    }
    
    const useRecord = uses[useIdx]
    if (useRecord.status === REFERRAL_STATUS.REJECTED) {
      return { success: false, message: 'Este referido ya fue rechazado' }
    }
    
    const prevStatus = useRecord.status
    
    uses[useIdx] = {
      ...useRecord,
      status: REFERRAL_STATUS.REJECTED,
      rejection_reason: reason,
      reviewed_by: rejectedBy,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    saveMockArray(STORAGE_KEYS.REFERRAL_USES, uses)
    
    // Actualizar contadores
    const codeIdx = codes.findIndex(c => c.id === useRecord.referral_code_id)
    if (codeIdx >= 0) {
      codes[codeIdx].total_rejected += 1
      if (prevStatus === REFERRAL_STATUS.PENDING) {
        codes[codeIdx].total_pending -= 1
      }
      codes[codeIdx].updated_at = new Date().toISOString()
      saveMockArray(STORAGE_KEYS.REFERRAL_CODES, codes)
    }
    
    return { success: true, message: 'Referido rechazado exitosamente' }
  }

  const { data, error } = await supabase
    .from('referral_uses')
    .update({
      status: REFERRAL_STATUS.REJECTED,
      rejection_reason: reason,
      reviewed_by: rejectedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', referralUseId)
    .select()
    .single()

  if (error) throw error
  
  // TODO: Actualizar contadores via trigger o RPC
  
  return { success: true, message: 'Referido rechazado exitosamente' }
}

/**
 * Obtiene todos los referidos para admin (todas las tenants)
 */
export const getAllReferrals = async (options = {}) => {
  const { status, limit = 100, offset = 0 } = options

  if (!isSupabaseConfigured) {
    const uses = loadMockArray(STORAGE_KEYS.REFERRAL_USES)
    let filtered = uses
    
    if (status) {
      filtered = filtered.filter(u => u.status === status)
    }
    
    return filtered
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(offset, offset + limit)
  }

  let query = supabase
    .from('referral_uses')
    .select(`
      *,
      referral_codes(code, tenants(name, slug))
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

/**
 * Obtiene todas las recompensas para admin
 */
export const getAllRewards = async (options = {}) => {
  const { status, limit = 100, offset = 0 } = options

  if (!isSupabaseConfigured) {
    const rewards = loadMockArray(STORAGE_KEYS.REFERRAL_REWARDS)
    let filtered = rewards
    
    if (status) {
      filtered = filtered.filter(r => r.status === status)
    }
    
    return filtered
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(offset, offset + limit)
  }

  let query = supabase
    .from('referral_rewards')
    .select(`
      *,
      tenants(name, slug)
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

/**
 * Obtiene los flags de fraude (admin)
 */
export const getFraudFlags = async (options = {}) => {
  const { resolved = null, limit = 100, offset = 0 } = options

  if (!isSupabaseConfigured) {
    return [] // No hay mock de fraud flags
  }

  let query = supabase
    .from('referral_fraud_flags')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (resolved !== null) {
    query = query.eq('is_resolved', resolved)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

/**
 * Resuelve un flag de fraude (admin)
 */
export const resolveFraudFlag = async (flagId, resolvedBy, action, notes) => {
  if (!isSupabaseConfigured) {
    return { success: true, message: 'Flag resuelto (mock)' }
  }

  const { data, error } = await supabase
    .from('referral_fraud_flags')
    .update({
      is_resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: resolvedBy,
      resolution_action: action,
      resolution_notes: notes,
    })
    .eq('id', flagId)
    .select()
    .single()

  if (error) throw error
  return { success: true, message: 'Flag resuelto exitosamente' }
}

/**
 * Obtiene los logs de auditoría (admin)
 */
export const getReferralAuditLogs = async (options = {}) => {
  const { entityType, entityId, limit = 100, offset = 0 } = options

  if (!isSupabaseConfigured) {
    return [] // No hay mock detallado
  }

  let query = supabase
    .from('referral_audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (entityType) {
    query = query.eq('entity_type', entityType)
  }
  if (entityId) {
    query = query.eq('entity_id', entityId)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

/**
 * Crear recompensa manual (admin)
 */
export const createManualReward = async ({
  tenantId,
  userId,
  rewardPlan,
  rewardMonths,
  rewardDays = 0,
  description,
  createdBy,
}) => {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 365)

  if (!isSupabaseConfigured) {
    const rewards = loadMockArray(STORAGE_KEYS.REFERRAL_REWARDS)
    
    const newReward = {
      id: generateId(),
      tenant_id: tenantId,
      user_id: userId,
      reward_type: REWARD_TYPES.MANUAL,
      reward_plan: rewardPlan,
      reward_months: rewardMonths,
      reward_days: rewardDays,
      description: description || `Recompensa manual: ${rewardMonths} meses de ${rewardPlan}`,
      status: REWARD_STATUS.PENDING,
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    
    rewards.push(newReward)
    saveMockArray(STORAGE_KEYS.REFERRAL_REWARDS, rewards)
    
    return { success: true, reward: newReward }
  }

  const { data, error } = await supabase
    .from('referral_rewards')
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      reward_type: REWARD_TYPES.MANUAL,
      reward_plan: rewardPlan,
      reward_months: rewardMonths,
      reward_days: rewardDays,
      description: description || `Recompensa manual: ${rewardMonths} meses de ${rewardPlan}`,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single()

  if (error) throw error
  
  // Log audit
  await supabase.from('referral_audit_logs').insert({
    entity_type: 'referral_reward',
    entity_id: data.id,
    user_id: userId,
    tenant_id: tenantId,
    action: 'reward_created',
    description: `Recompensa manual creada por admin`,
    performed_by: createdBy,
  })

  return { success: true, reward: data }
}

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Genera URL de invitación con código de referido
 */
export const generateReferralUrl = (code, baseUrl = window.location.origin) => {
  return `${baseUrl}/registro?ref=${code}`
}

/**
 * Extrae código de referido de la URL actual
 */
export const extractReferralCodeFromUrl = () => {
  const params = new URLSearchParams(window.location.search)
  return params.get('ref') || null
}

/**
 * Guarda código de referido en sessionStorage para usarlo después del registro
 */
export const saveReferralCodeToSession = (code) => {
  if (code) {
    sessionStorage.setItem('pending_referral_code', code.toUpperCase())
  }
}

/**
 * Obtiene y limpia código de referido guardado en sesión
 */
export const consumeReferralCodeFromSession = () => {
  const code = sessionStorage.getItem('pending_referral_code')
  sessionStorage.removeItem('pending_referral_code')
  return code
}
