import { supabase, isSupabaseConfigured } from './supabaseClient'

function ensureSupabase() {
  if (!isSupabaseConfigured) {
    const error = new Error('Supabase no está configurado')
    error.code = 'SUPABASE_NOT_CONFIGURED'
    throw error
  }
}

export async function supabaseSignIn({ email, password }) {
  ensureSupabase()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function supabaseSignUp({ email, password }) {
  ensureSupabase()
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data
}

export async function supabaseResetPasswordForEmail({ email, redirectTo }) {
  ensureSupabase()
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  })
  if (error) throw error
  return data
}

export async function fetchProfile(userId) {
  ensureSupabase()
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, email, full_name, role, tenant_id, account_status, premium_until, premium_source')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function upsertProfile({ userId, role, tenantId }) {
  ensureSupabase()
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ user_id: userId, role, tenant_id: tenantId })
    .select('user_id, email, full_name, role, tenant_id, account_status, premium_until, premium_source')
    .single()

  if (error) throw error
  return data
}

// Update user profile personal info
export async function updateProfileInfo({ userId, fullName, phoneCountryCode, phoneNumber, documentType, documentNumber, billingAddress }) {
  ensureSupabase()
  
  // Try to update with all fields first
  const { data, error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
      phone_country_code: phoneCountryCode,
      phone_number: phoneNumber,
      document_type: documentType,
      document_number: documentNumber,
      billing_address: billingAddress,
    })
    .eq('user_id', userId)
    .select('user_id, email, full_name, role, tenant_id, account_status, premium_until, premium_source')
    .single()

  // If error (columns don't exist), try with only basic fields
  if (error && error.message?.includes('does not exist')) {
    console.warn('updateProfileInfo: Some columns may not exist, updating only full_name', error.message)
    const { data: basicData, error: basicError } = await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('user_id', userId)
      .select('user_id, email, full_name, role, tenant_id, account_status, premium_until, premium_source')
      .single()
    
    if (basicError) throw basicError
    return basicData
  }
  
  if (error) throw error
  return data
}

// Fetch profile with all fields (including optional new columns)
export async function fetchFullProfile(userId) {
  ensureSupabase()
  
  // First try with all fields
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  // If error (columns don't exist), fallback to basic fields
  if (error) {
    console.warn('fetchFullProfile: Some columns may not exist, using basic fields', error.message)
    const { data: basicData, error: basicError } = await supabase
      .from('profiles')
      .select('user_id, email, full_name, role, tenant_id, account_status, premium_until, premium_source')
      .eq('user_id', userId)
      .maybeSingle()
    
    if (basicError) throw basicError
    return basicData
  }
  
  return data
}

// -------------------------
// Admin (super_admin)
// -------------------------

export async function adminListProfiles() {
  ensureSupabase()
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, email, full_name, role, tenant_id, account_status, premium_until, premium_source, created_at')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function adminSetPremiumGiftDays({ userId, days }) {
  ensureSupabase()
  const safeDays = Number(days)
  if (!Number.isFinite(safeDays) || safeDays <= 0) throw new Error('Días inválidos')

  // Nota: lo computamos en el cliente. Alternativa más robusta: RPC en DB.
  const now = new Date()
  const until = new Date(now.getTime() + safeDays * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('profiles')
    .update({ premium_until: until, premium_source: 'gift' })
    .eq('user_id', userId)
    .select('user_id, email, full_name, role, tenant_id, account_status, premium_until, premium_source')
    .single()

  if (error) throw error
  return data
}

export async function adminRemovePremium({ userId }) {
  ensureSupabase()
  const { data, error } = await supabase
    .from('profiles')
    .update({ premium_until: null, premium_source: null })
    .eq('user_id', userId)
    .select('user_id, email, full_name, role, tenant_id, account_status, premium_until, premium_source')
    .single()

  if (error) throw error
  return data
}

export async function adminSetAccountStatus({ userId, status }) {
  ensureSupabase()
  if (!['active', 'cancelled'].includes(status)) throw new Error('Estado inválido')
  const patch = status === 'cancelled'
    ? { account_status: 'cancelled', premium_until: null, premium_source: null }
    : { account_status: 'active' }

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('user_id', userId)
    .select('user_id, email, full_name, role, tenant_id, account_status, premium_until, premium_source')
    .single()

  if (error) throw error
  return data
}

export async function adminUpdateProfile({ userId, role, tenantId }) {
  ensureSupabase()
  const patch = {
    ...(role ? { role } : null),
    ...(tenantId !== undefined ? { tenant_id: tenantId } : null),
  }
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('user_id', userId)
    .select('user_id, email, full_name, role, tenant_id, account_status, premium_until, premium_source')
    .single()

  if (error) throw error
  return data
}

// -------------------------
// Admin: premium por tenant
// -------------------------

export async function adminSetTenantPremiumDays({ tenantId, days }) {
  ensureSupabase()
  const safeDays = Number(days)
  if (!tenantId) throw new Error('tenantId requerido')
  if (!Number.isFinite(safeDays) || safeDays <= 0) throw new Error('Días inválidos')

  const now = new Date()
  const until = new Date(now.getTime() + safeDays * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('tenants')
    .update({ premium_until: until })
    .eq('id', tenantId)
    .select('id, name, slug, is_public, premium_until')
    .single()

  if (error) throw error
  return data
}

export async function adminRemoveTenantPremium({ tenantId }) {
  ensureSupabase()
  if (!tenantId) throw new Error('tenantId requerido')

  const { data, error } = await supabase
    .from('tenants')
    .update({ premium_until: null, subscription_tier: 'free' })
    .eq('id', tenantId)
    .select('id, name, slug, is_public, premium_until, subscription_tier')
    .single()

  if (error) throw error
  return data
}

// Set subscription tier directly (free, premium, premium_pro)
export async function adminSetTenantTier({ tenantId, tier, days = null }) {
  ensureSupabase()
  if (!tenantId) throw new Error('tenantId requerido')
  if (!['free', 'premium', 'premium_pro'].includes(tier)) throw new Error('Tier inválido')

  let premiumUntil = null
  if (tier !== 'free' && days) {
    const now = new Date()
    premiumUntil = new Date(now.getTime() + Number(days) * 24 * 60 * 60 * 1000).toISOString()
  } else if (tier !== 'free') {
    // Si no se especifican días, dar 30 días por defecto
    const now = new Date()
    premiumUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
  }

  const { data, error } = await supabase
    .from('tenants')
    .update({ 
      subscription_tier: tier,
      premium_until: premiumUntil 
    })
    .eq('id', tenantId)
    .select('id, name, slug, is_public, premium_until, subscription_tier')
    .single()

  if (error) throw error
  return data
}

export async function adminListTenants() {
  ensureSupabase()
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, slug, is_public, premium_until, subscription_tier, owner_user_id, created_at, logo, description, slogan')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function adminSetTenantVisibility({ tenantId, isPublic }) {
  ensureSupabase()
  if (!tenantId) throw new Error('tenantId requerido')

  const { data, error } = await supabase
    .from('tenants')
    .update({ is_public: isPublic })
    .eq('id', tenantId)
    .select('id, name, slug, is_public, premium_until, owner_user_id')
    .single()

  if (error) throw error
  return data
}

export async function adminSetTenantOwnerAccountStatus({ tenantId, status }) {
  ensureSupabase()
  if (!tenantId) throw new Error('tenantId requerido')
  if (!['active', 'cancelled'].includes(status)) throw new Error('Estado inválido')

  // 1) Buscamos el tenant para conocer owner_user_id
  const { data: tenantRow, error: tenantErr } = await supabase
    .from('tenants')
    .select('id, owner_user_id')
    .eq('id', tenantId)
    .maybeSingle()
  if (tenantErr) throw tenantErr
  if (!tenantRow?.owner_user_id) throw new Error('No se encontró owner para este tenant')

  // 2) Cancelamos/reactivamos la cuenta del owner (profiles)
  const patch =
    status === 'cancelled'
      ? { account_status: 'cancelled', premium_until: null, premium_source: null }
      : { account_status: 'active' }

  const { data: profileRow, error: profileErr } = await supabase
    .from('profiles')
    .update(patch)
    .eq('user_id', tenantRow.owner_user_id)
    .select('user_id, email, full_name, role, tenant_id, account_status, premium_until, premium_source')
    .maybeSingle()

  if (profileErr) throw profileErr
  if (profileRow) return profileRow

  const fallbackInsert = {
    user_id: tenantRow.owner_user_id,
    role: 'user',
    ...patch,
  }

  const { data: upsertRow, error: upsertErr } = await supabase
    .from('profiles')
    .upsert(fallbackInsert, { onConflict: 'user_id', ignoreDuplicates: false })
    .select('user_id, email, full_name, role, tenant_id, account_status, premium_until, premium_source')
    .single()

  if (upsertErr) throw upsertErr
  return upsertRow
}

export async function createTenant({ name, slug, ownerUserId }) {
  ensureSupabase()
  const { data, error } = await supabase
    .from('tenants')
    .insert({ name, slug, owner_user_id: ownerUserId })
    .select('id, name, slug, is_public, premium_until')
    .single()

  if (error) throw error
  return data
}

export async function listTenants() {
  ensureSupabase()
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, slug, is_public, premium_until, subscription_tier, logo, description, slogan')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// Listado para la landing (Home): solo restaurantes marcados como visibles.
// Nota: además hay RLS que restringe lo que anon puede ver.
export async function listPublicTenants() {
  ensureSupabase()
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, slug, is_public, premium_until, subscription_tier, logo, description, slogan')
    .eq('is_public', true)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function fetchTenantBySlug(slug) {
  ensureSupabase()
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, slug, is_public, premium_until, subscription_tier, logo, description, slogan')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  return data
}

// Verifica si un slug ya existe en la base de datos
export async function checkSlugExists(slug) {
  ensureSupabase()
  const { data, error } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  return !!data
}

// Genera un slug único agregando un sufijo numérico si es necesario
export async function generateUniqueSlug(baseSlug) {
  let slug = baseSlug
  let counter = 1
  
  while (await checkSlugExists(slug)) {
    slug = `${baseSlug}-${counter}`
    counter++
    // Seguridad: evitar loop infinito
    if (counter > 100) {
      slug = `${baseSlug}-${Date.now()}`
      break
    }
  }
  
  return slug
}

export async function fetchTenantByOwnerUserId(ownerUserId) {
  ensureSupabase()
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, slug, is_public, premium_until, subscription_tier, owner_user_id')
    .eq('owner_user_id', ownerUserId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function fetchTenantById(tenantId) {
  ensureSupabase()
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, slug, is_public, premium_until, subscription_tier, logo, description, slogan')
    .eq('id', tenantId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function updateTenantVisibility({ tenantId, isPublic }) {
  ensureSupabase()
  const { data, error } = await supabase
    .from('tenants')
    .update({ is_public: isPublic })
    .eq('id', tenantId)
    .select('id, name, slug, is_public, premium_until, subscription_tier, logo, description, slogan, welcome_modal_enabled, welcome_modal_title, welcome_modal_message, welcome_modal_image')
    .single()

  if (error) throw error
  return data
}

// Update tenant branding and info
// Note: columns logo, description, slogan may not exist - handle gracefully
export async function updateTenantInfo({ tenantId, name, logo, description, slogan }) {
  ensureSupabase()
  
  // First, try with all fields
  const patch = {}
  if (name !== undefined) patch.name = name
  if (logo !== undefined) patch.logo = logo
  if (description !== undefined) patch.description = description
  if (slogan !== undefined) patch.slogan = slogan

  try {
    const { data, error } = await supabase
      .from('tenants')
      .update(patch)
      .eq('id', tenantId)
      .select('id, name, slug, is_public, premium_until, subscription_tier')
      .single()

    if (error) throw error
    return data
  } catch (err) {
    // If error mentions missing columns, try with only basic fields
    if (err.message?.includes('column') && err.message?.includes('schema cache')) {
      console.warn('updateTenantInfo: Some columns may not exist, trying with basic fields only')
      const basicPatch = {}
      if (name !== undefined) basicPatch.name = name
      
      if (Object.keys(basicPatch).length === 0) {
        // Nothing to update with basic fields
        const { data } = await supabase
          .from('tenants')
          .select('id, name, slug, is_public, premium_until, subscription_tier')
          .eq('id', tenantId)
          .single()
        return data
      }
      
      const { data, error: err2 } = await supabase
        .from('tenants')
        .update(basicPatch)
        .eq('id', tenantId)
        .select('id, name, slug, is_public, premium_until, subscription_tier')
        .single()

      if (err2) throw err2
      return data
    }
    throw err
  }
}

// Update tenant welcome modal settings
// Note: welcome_modal_* columns may not exist - handle gracefully
export async function updateTenantWelcomeModal({ tenantId, enabled, title, message, image, features, featuresDesign }) {
  ensureSupabase()
  const patch = {}
  if (enabled !== undefined) patch.welcome_modal_enabled = enabled
  if (title !== undefined) patch.welcome_modal_title = title
  if (message !== undefined) patch.welcome_modal_message = message
  if (image !== undefined) patch.welcome_modal_image = image
  if (features !== undefined) patch.welcome_modal_features = features
  if (featuresDesign !== undefined) patch.welcome_modal_features_design = featuresDesign

  if (Object.keys(patch).length === 0) {
    // Nothing to update
    return fetchTenantFull(tenantId)
  }

  try {
    const { data, error } = await supabase
      .from('tenants')
      .update(patch)
      .eq('id', tenantId)
      .select('id, name, slug, is_public, premium_until, subscription_tier')
      .single()

    if (error) throw error
    return data
  } catch (err) {
    if (err.message?.includes('column') && err.message?.includes('schema cache')) {
      console.warn('updateTenantWelcomeModal: Welcome modal columns may not exist yet. Run migration.')
      // Just return current tenant data
      const { data } = await supabase
        .from('tenants')
        .select('id, name, slug, is_public, premium_until, subscription_tier')
        .eq('id', tenantId)
        .single()
      return data
    }
    throw err
  }
}

// Update tenant opening hours
// Format: array of { day: string, open: string, close: string, enabled: boolean }
export async function updateTenantOpeningHours({ tenantId, openingHours }) {
  ensureSupabase()
  
  try {
    const { data, error } = await supabase
      .from('tenants')
      .update({ opening_hours: openingHours })
      .eq('id', tenantId)
      .select('id, name, slug, opening_hours')
      .single()

    if (error) throw error
    return data
  } catch (err) {
    if (err.message?.includes('column') && err.message?.includes('schema cache')) {
      console.warn('updateTenantOpeningHours: opening_hours column may not exist yet. Run migration.')
      return null
    }
    throw err
  }
}

// Fetch tenant with all customization fields
// Falls back gracefully if customization columns don't exist
export async function fetchTenantFull(tenantId) {
  ensureSupabase()
  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('id, name, slug, is_public, premium_until, subscription_tier, logo, description, slogan, welcome_modal_enabled, welcome_modal_title, welcome_modal_message, welcome_modal_image, welcome_modal_features, welcome_modal_features_design, opening_hours, owner_user_id, is_paused, pause_message, mobile_header_design, mobile_card_design, mobile_spacing_option, mobile_typography_option, sound_enabled, sound_repeat_count, sound_delay_ms')
      .eq('id', tenantId)
      .single()
    if (error) throw error
    return data
  } catch (err) {
    // Fall back to basic columns if there's any column/schema error
    const errMsg = err.message?.toLowerCase() || ''
    if (errMsg.includes('column') || errMsg.includes('schema') || errMsg.includes('does not exist') || err.code === '42703') {
      console.warn('Some columns not found, falling back to basic query:', err.message)
      const { data, error: err2 } = await supabase
        .from('tenants')
        .select('id, name, slug, is_public, premium_until, subscription_tier, logo, description, slogan, welcome_modal_enabled, welcome_modal_title, welcome_modal_message, welcome_modal_image, welcome_modal_features, welcome_modal_features_design, opening_hours, owner_user_id, is_paused, pause_message, mobile_header_design, mobile_card_design, mobile_spacing_option, mobile_typography_option')
        .eq('id', tenantId)
        .single()
      if (err2) {
        // If still failing, try minimal columns
        const { data: minData, error: err3 } = await supabase
          .from('tenants')
          .select('id, name, slug, is_public, premium_until, subscription_tier, owner_user_id')
          .eq('id', tenantId)
          .single()
        if (err3) throw err3
        return minData
      }
      return data
    }
    throw err
  }
}

// Fetch tenant by slug with all customization fields
// Falls back gracefully if customization columns don't exist
export async function fetchTenantBySlugFull(slug) {
  ensureSupabase()
  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('id, name, slug, is_public, premium_until, subscription_tier, logo, description, slogan, welcome_modal_enabled, welcome_modal_title, welcome_modal_message, welcome_modal_image, welcome_modal_features, welcome_modal_features_design, opening_hours, is_paused, pause_message, mobile_header_design, mobile_card_design, mobile_spacing_option, mobile_typography_option, mobile_carousel_options, sound_enabled, sound_repeat_count, sound_delay_ms')
      .eq('slug', slug)
      .maybeSingle()
    if (error) throw error
    return data
  } catch (err) {
    // Fall back to basic columns if there's any column/schema error
    const errMsg = err.message?.toLowerCase() || ''
    if (errMsg.includes('column') || errMsg.includes('schema') || errMsg.includes('does not exist') || err.code === '42703') {
      console.warn('Some columns not found, falling back to basic query:', err.message)
      const { data, error: err2 } = await supabase
        .from('tenants')
        .select('id, name, slug, is_public, premium_until, subscription_tier, logo, description, slogan, welcome_modal_enabled, welcome_modal_title, welcome_modal_message, welcome_modal_image, welcome_modal_features, welcome_modal_features_design, opening_hours, is_paused, pause_message, mobile_header_design, mobile_card_design, mobile_spacing_option, mobile_typography_option, mobile_carousel_options')
        .eq('slug', slug)
        .maybeSingle()
      if (err2) {
        // If still failing, try minimal columns
        const { data: minData, error: err3 } = await supabase
          .from('tenants')
          .select('id, name, slug, is_public, premium_until, subscription_tier')
          .eq('slug', slug)
          .maybeSingle()
        if (err3) throw err3
        return minData
      }
      return data
    }
    throw err
  }
}

// Update tenant pause status
// isPaused: boolean - whether the store is paused
// pauseMessage: string - message to show when paused
export async function updateTenantPauseStatus({ tenantId, isPaused, pauseMessage }) {
  ensureSupabase()
  
  try {
    const { data, error } = await supabase
      .from('tenants')
      .update({ 
        is_paused: isPaused, 
        pause_message: pauseMessage || null 
      })
      .eq('id', tenantId)
      .select('id, name, slug, is_paused, pause_message')
      .single()

    if (error) throw error
    return data
  } catch (err) {
    if (err.message?.includes('column') && err.message?.includes('schema cache')) {
      console.warn('updateTenantPauseStatus: is_paused/pause_message columns may not exist yet. Run migration add_store_pause.sql')
      return null
    }
    throw err
  }
}

// Fetch tenant pause status only (lightweight query for storefront)
export async function fetchTenantPauseStatus(tenantId) {
  ensureSupabase()
  
  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('id, is_paused, pause_message')
      .eq('id', tenantId)
      .single()

    if (error) throw error
    return { isPaused: data?.is_paused || false, pauseMessage: data?.pause_message || '' }
  } catch (err) {
    // If columns don't exist, return not paused
    return { isPaused: false, pauseMessage: '' }
  }
}

// Fetch tenant pause status by slug (for storefront polling)
export async function fetchTenantPauseStatusBySlug(slug) {
  ensureSupabase()
  
  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('id, is_paused, pause_message')
      .eq('slug', slug)
      .single()

    if (error) throw error
    return { isPaused: data?.is_paused || false, pauseMessage: data?.pause_message || '' }
  } catch (err) {
    // If columns don't exist, return not paused
    return { isPaused: false, pauseMessage: '' }
  }
}

// Update tenant sound notification configuration
export async function updateTenantSoundConfig({ tenantId, soundEnabled, soundRepeatCount, soundDelayMs }) {
  ensureSupabase()
  
  try {
    const { data, error } = await supabase
      .from('tenants')
      .update({ 
        sound_enabled: soundEnabled,
        sound_repeat_count: soundRepeatCount,
        sound_delay_ms: soundDelayMs
      })
      .eq('id', tenantId)
      .select('id, sound_enabled, sound_repeat_count, sound_delay_ms')
      .single()

    if (error) throw error
    return data
  } catch (err) {
    console.error('Error updating sound config:', err)
    throw err
  }
}

// Fetch tenant sound configuration
export async function fetchTenantSoundConfig(tenantId) {
  ensureSupabase()
  
  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('sound_enabled, sound_repeat_count, sound_delay_ms')
      .eq('id', tenantId)
      .single()

    if (error) throw error
    return {
      enabled: data?.sound_enabled ?? true,
      repeatCount: data?.sound_repeat_count ?? 3,
      delayMs: data?.sound_delay_ms ?? 1500
    }
  } catch (err) {
    // If columns don't exist, return defaults
    return { enabled: true, repeatCount: 3, delayMs: 1500 }
  }
}

// Fetch mobile preview settings for a tenant
export async function fetchMobilePreviewSettings(tenantId) {
  ensureSupabase()
  
  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('id, mobile_header_design, mobile_card_design, mobile_spacing_option, mobile_typography_option, mobile_carousel_options')
      .eq('id', tenantId)
      .single()

    if (error) throw error
    const carouselOptions = data?.mobile_carousel_options || { showTitle: true, showSubtitle: true, showCta: true }
    return {
      headerDesign: data?.mobile_header_design || 'centered',
      cardDesign: data?.mobile_card_design || 'stackedFull',
      spacingOption: data?.mobile_spacing_option || 'balanced',
      typographyOption: data?.mobile_typography_option || 'standard',
      carouselOptions,
    }
  } catch (err) {
    // If columns don't exist, return defaults
    console.warn('fetchMobilePreviewSettings: columns may not exist yet. Run migration add_mobile_preview_settings.sql')
    return {
      headerDesign: 'centered',
      cardDesign: 'stackedFull',
      spacingOption: 'balanced',
      typographyOption: 'standard',
      carouselOptions: { showTitle: true, showSubtitle: true, showCta: true },
    }
  }
}

// Update mobile preview settings for a tenant
export async function updateMobilePreviewSettings({ tenantId, headerDesign, cardDesign, spacingOption, typographyOption, carouselOptions }) {
  ensureSupabase()
  
  const patch = {}
  if (headerDesign !== undefined) patch.mobile_header_design = headerDesign
  if (cardDesign !== undefined) patch.mobile_card_design = cardDesign
  if (spacingOption !== undefined) patch.mobile_spacing_option = spacingOption
  if (typographyOption !== undefined) patch.mobile_typography_option = typographyOption
  if (carouselOptions !== undefined) patch.mobile_carousel_options = carouselOptions

  if (Object.keys(patch).length === 0) {
    return fetchMobilePreviewSettings(tenantId)
  }

  try {
    const { data, error } = await supabase
      .from('tenants')
      .update(patch)
      .eq('id', tenantId)
      .select('id, mobile_header_design, mobile_card_design, mobile_spacing_option, mobile_typography_option, mobile_carousel_options')
      .single()

    if (error) throw error
    const carouselOpts = data?.mobile_carousel_options || { showTitle: true, showSubtitle: true, showCta: true }
    return {
      headerDesign: data?.mobile_header_design || 'centered',
      cardDesign: data?.mobile_card_design || 'stackedFull',
      spacingOption: data?.mobile_spacing_option || 'balanced',
      typographyOption: data?.mobile_typography_option || 'standard',
      carouselOptions: carouselOpts,
    }
  } catch (err) {
    if (err.message?.includes('column') && err.message?.includes('schema cache')) {
      console.warn('updateMobilePreviewSettings: columns may not exist yet. Run migration add_mobile_preview_settings.sql')
      return null
    }
    throw err
  }
}

export async function fetchProductsByTenantId(tenantId) {
  ensureSupabase()
  const { data, error } = await supabase
    .from('products')
    .select('id, tenant_id, name, price, description, image_url, focal_point, category, stock, active, product_extras')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function insertProduct({ tenantId, product }) {
  ensureSupabase()
  const { data, error } = await supabase
    .from('products')
    .insert({
      tenant_id: tenantId,
      name: product.name || 'Producto sin nombre',
      price: product.price ?? 0,
      description: product.description || null,
      image_url: product.imageUrl || null,
      focal_point: product.focalPoint || null,
      category: product.category || null,
      stock: product.stock ?? null,
      active: product.active ?? true,
      product_extras: product.productExtras || [],
    })
    .select('id, tenant_id, name, price, description, image_url, focal_point, category, stock, active, product_extras')
    .single()

  if (error) throw error
  return data
}

export async function updateProductRow({ tenantId, productId, patch }) {
  ensureSupabase()
  const { data, error } = await supabase
    .from('products')
    .update({
      ...('name' in patch ? { name: patch.name } : null),
      ...('price' in patch ? { price: patch.price } : null),
      ...('description' in patch ? { description: patch.description } : null),
      ...('imageUrl' in patch ? { image_url: patch.imageUrl || null } : null),
      ...('focalPoint' in patch ? { focal_point: patch.focalPoint || null } : null),
      ...('category' in patch ? { category: patch.category || null } : null),
      ...('stock' in patch ? { stock: patch.stock ?? null } : null),
      ...('active' in patch ? { active: patch.active } : null),
      ...('productExtras' in patch ? { product_extras: patch.productExtras || [] } : null),
    })
    .eq('tenant_id', tenantId)
    .eq('id', productId)
    .select('id, tenant_id, name, price, description, image_url, focal_point, category, stock, active, product_extras')
    .single()

  if (error) throw error
  return data
}

export async function deleteProductRow({ tenantId, productId }) {
  ensureSupabase()
  const { error } = await supabase.from('products').delete().eq('tenant_id', tenantId).eq('id', productId)
  if (error) throw error
}

export async function fetchThemeByTenantId(tenantId) {
  ensureSupabase()
  const { data, error } = await supabase
    .from('tenant_themes')
    .select('tenant_id, primary_color, accent_color, background_color, text_color, radius, product_card_layout, card_bg, card_text, card_desc, card_price, card_button, hero_style, hero_slides, hero_title_position, hero_overlay_opacity, hero_show_title, hero_show_subtitle, hero_show_cta, hero_carousel_button_style')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function upsertTheme({ tenantId, theme }) {
  ensureSupabase()
  const { data, error } = await supabase
    .from('tenant_themes')
    .upsert({
      tenant_id: tenantId,
      primary_color: theme.primary,
      accent_color: theme.accent,
      background_color: theme.background,
      text_color: theme.text,
      radius: theme.radius,
      product_card_layout: theme.productCardLayout,
      card_bg: theme.cardBg,
      card_text: theme.cardText,
      card_desc: theme.cardDesc,
      card_price: theme.cardPrice,
      card_button: theme.cardButton,
      hero_style: theme.heroStyle,
      hero_slides: theme.heroSlides,
      hero_title_position: theme.heroTitlePosition,
      hero_overlay_opacity: theme.heroOverlayOpacity,
      hero_show_title: theme.heroShowTitle,
      hero_show_subtitle: theme.heroShowSubtitle,
      hero_show_cta: theme.heroShowCta,
      hero_carousel_button_style: theme.heroCarouselButtonStyle,
    })
    .select('tenant_id, primary_color, accent_color, background_color, text_color, radius, product_card_layout, card_bg, card_text, card_desc, card_price, card_button, hero_style, hero_slides, hero_title_position, hero_overlay_opacity, hero_show_title, hero_show_subtitle, hero_show_cta, hero_carousel_button_style')
    .single()

  if (error) throw error
  return data
}

// -------------------------
// Delivery Config
// -------------------------

export async function fetchDeliveryConfig(tenantId) {
  ensureSupabase()
  const { data, error } = await supabase
    .from('tenants')
    .select('delivery_config')
    .eq('id', tenantId)
    .single()

  if (error) throw error
  return data?.delivery_config || { mostrador: true, domicilio: true, mesa: true }
}

export async function updateDeliveryConfig(tenantId, deliveryConfig) {
  ensureSupabase()
  const { data, error } = await supabase
    .from('tenants')
    .update({ delivery_config: deliveryConfig })
    .eq('id', tenantId)
    .select('delivery_config')
    .single()

  if (error) throw error
  return data?.delivery_config
}

// -------------------------
// Categories
// -------------------------

export async function fetchCategoriesByTenantId(tenantId) {
  ensureSupabase()
  const { data, error } = await supabase
    .from('product_categories')
    .select('id, tenant_id, name, description, sort_order, active, max_stock, current_stock')
    .eq('tenant_id', tenantId)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return data
}

export async function insertCategory({ tenantId, category }) {
  ensureSupabase()
  const { data, error } = await supabase
    .from('product_categories')
    .insert({
      tenant_id: tenantId,
      name: category.name,
      description: category.description || null,
      sort_order: category.sortOrder ?? 0,
      active: category.active ?? true,
      max_stock: category.maxStock ?? null,
      current_stock: category.maxStock ?? null, // inicializa igual al máximo
    })
    .select('id, tenant_id, name, description, sort_order, active, max_stock, current_stock')
    .single()

  if (error) throw error
  return data
}

export async function updateCategoryRow({ tenantId, categoryId, patch }) {
  ensureSupabase()
  const { data, error } = await supabase
    .from('product_categories')
    .update({
      ...('name' in patch ? { name: patch.name } : null),
      ...('description' in patch ? { description: patch.description } : null),
      ...('sortOrder' in patch ? { sort_order: patch.sortOrder } : null),
      ...('active' in patch ? { active: patch.active } : null),
      ...('max_stock' in patch ? { max_stock: patch.max_stock } : null),
      ...('current_stock' in patch ? { current_stock: patch.current_stock } : null),
    })
    .eq('tenant_id', tenantId)
    .eq('id', categoryId)
    .select('id, tenant_id, name, description, sort_order, active, max_stock, current_stock')
    .single()

  if (error) throw error
  return data
}

export async function deleteCategoryRow({ tenantId, categoryId }) {
  ensureSupabase()
  const { error } = await supabase.from('product_categories').delete().eq('tenant_id', tenantId).eq('id', categoryId)
  if (error) throw error
}

// -------------------------
// Extra Groups (for product extras/toppings)
// -------------------------

export async function fetchExtraGroupsByTenantId(tenantId) {
  ensureSupabase()
  const { data, error } = await supabase
    .from('extra_groups')
    .select('id, tenant_id, name, description, min_selections, max_selections, is_required, sort_order, active')
    .eq('tenant_id', tenantId)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return data
}

export async function insertExtraGroup({ tenantId, group }) {
  ensureSupabase()
  const { data, error } = await supabase
    .from('extra_groups')
    .insert({
      tenant_id: tenantId,
      name: group.name,
      description: group.description || null,
      min_selections: group.minSelections ?? 0,
      max_selections: group.maxSelections ?? 10,
      is_required: group.isRequired ?? false,
      sort_order: group.sortOrder ?? 0,
      active: group.active ?? true,
    })
    .select('id, tenant_id, name, description, min_selections, max_selections, is_required, sort_order, active')
    .single()

  if (error) throw error
  return data
}

export async function updateExtraGroupRow({ tenantId, groupId, patch }) {
  ensureSupabase()
  const updateData = {}
  if ('name' in patch) updateData.name = patch.name
  if ('description' in patch) updateData.description = patch.description
  if ('minSelections' in patch) updateData.min_selections = patch.minSelections
  if ('maxSelections' in patch) updateData.max_selections = patch.maxSelections
  if ('isRequired' in patch) updateData.is_required = patch.isRequired
  if ('sortOrder' in patch) updateData.sort_order = patch.sortOrder
  if ('active' in patch) updateData.active = patch.active

  const { data, error } = await supabase
    .from('extra_groups')
    .update(updateData)
    .eq('tenant_id', tenantId)
    .eq('id', groupId)
    .select('id, tenant_id, name, description, min_selections, max_selections, is_required, sort_order, active')
    .single()

  if (error) throw error
  return data
}

export async function deleteExtraGroupRow({ tenantId, groupId }) {
  ensureSupabase()
  const { error } = await supabase.from('extra_groups').delete().eq('tenant_id', tenantId).eq('id', groupId)
  if (error) throw error
}

// -------------------------
// Extras (individual extra items)
// -------------------------

export async function fetchExtrasByTenantId(tenantId) {
  ensureSupabase()
  const { data, error } = await supabase
    .from('extras')
    .select('id, tenant_id, group_id, name, description, price, sort_order, active, has_options, options')
    .eq('tenant_id', tenantId)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return data
}

export async function insertExtra({ tenantId, extra }) {
  ensureSupabase()
  const { data, error } = await supabase
    .from('extras')
    .insert({
      tenant_id: tenantId,
      group_id: extra.groupId,
      name: extra.name,
      description: extra.description || null,
      price: extra.price ?? 0,
      sort_order: extra.sortOrder ?? 0,
      active: extra.active ?? true,
      has_options: extra.hasOptions ?? false,
      options: extra.options || [],
    })
    .select('id, tenant_id, group_id, name, description, price, sort_order, active, has_options, options')
    .single()

  if (error) throw error
  return data
}

export async function updateExtraRow({ tenantId, extraId, patch }) {
  ensureSupabase()
  const updateData = {}
  if ('groupId' in patch) updateData.group_id = patch.groupId
  if ('name' in patch) updateData.name = patch.name
  if ('description' in patch) updateData.description = patch.description
  if ('price' in patch) updateData.price = patch.price
  if ('sortOrder' in patch) updateData.sort_order = patch.sortOrder
  if ('active' in patch) updateData.active = patch.active
  if ('hasOptions' in patch) updateData.has_options = patch.hasOptions
  if ('options' in patch) updateData.options = patch.options

  const { data, error } = await supabase
    .from('extras')
    .update(updateData)
    .eq('tenant_id', tenantId)
    .eq('id', extraId)
    .select('id, tenant_id, group_id, name, description, price, sort_order, active, has_options, options')
    .single()

  if (error) throw error
  return data
}

export async function deleteExtraRow({ tenantId, extraId }) {
  ensureSupabase()
  const { error } = await supabase.from('extras').delete().eq('tenant_id', tenantId).eq('id', extraId)
  if (error) throw error
}

// =========================================
// DOWNGRADE: Reset configurations to FREE
// =========================================

import {
  FREE_DEFAULT_THEME,
  FREE_DEFAULT_TENANT_SETTINGS,
} from '../shared/subscriptions'

// Reset theme to FREE defaults
export async function resetThemeToFree(tenantId) {
  ensureSupabase()
  
  const { data, error } = await supabase
    .from('tenant_themes')
    .upsert({
      tenant_id: tenantId,
      primary_color: FREE_DEFAULT_THEME.primary,
      accent_color: FREE_DEFAULT_THEME.accent,
      background_color: FREE_DEFAULT_THEME.background,
      text_color: FREE_DEFAULT_THEME.text,
      radius: FREE_DEFAULT_THEME.radius,
      product_card_layout: FREE_DEFAULT_THEME.productCardLayout,
      card_bg: null,
      card_text: null,
      card_desc: null,
      card_price: null,
      card_button: null,
      hero_style: FREE_DEFAULT_THEME.heroStyle,
      hero_slides: [],
      hero_title_position: FREE_DEFAULT_THEME.heroTitlePosition,
      hero_overlay_opacity: FREE_DEFAULT_THEME.heroOverlayOpacity,
      hero_show_title: FREE_DEFAULT_THEME.heroShowTitle,
      hero_show_subtitle: FREE_DEFAULT_THEME.heroShowSubtitle,
      hero_show_cta: FREE_DEFAULT_THEME.heroShowCta,
      hero_carousel_button_style: null,
    })
    .select('*')
    .single()

  if (error) throw error
  return data
}

// Reset tenant mobile/customization settings to FREE defaults
export async function resetTenantSettingsToFree(tenantId) {
  ensureSupabase()
  
  try {
    const { data, error } = await supabase
      .from('tenants')
      .update({
        mobile_header_design: FREE_DEFAULT_TENANT_SETTINGS.mobile_header_design,
        mobile_card_design: FREE_DEFAULT_TENANT_SETTINGS.mobile_card_design,
        mobile_spacing_option: FREE_DEFAULT_TENANT_SETTINGS.mobile_spacing_option,
        mobile_typography_option: FREE_DEFAULT_TENANT_SETTINGS.mobile_typography_option,
        welcome_modal_features_design: FREE_DEFAULT_TENANT_SETTINGS.welcome_modal_features_design,
      })
      .eq('id', tenantId)
      .select('id')
      .single()

    if (error) throw error
    return data
  } catch (err) {
    // If columns don't exist, just log and continue
    console.warn('resetTenantSettingsToFree: Some columns may not exist', err.message)
    return { id: tenantId }
  }
}

// Complete reset to FREE tier (tier + theme + settings)
export async function performDowngradeToFree(tenantId) {
  ensureSupabase()
  
  // 1. Update subscription tier to FREE
  const { error: tierError } = await supabase
    .from('tenants')
    .update({
      subscription_tier: 'free',
      premium_until: null,
    })
    .eq('id', tenantId)

  if (tierError) throw tierError

  // 2. Reset theme to FREE defaults
  try {
    await resetThemeToFree(tenantId)
  } catch (err) {
    console.warn('performDowngradeToFree: Error resetting theme', err)
  }

  // 3. Reset tenant settings to FREE defaults
  try {
    await resetTenantSettingsToFree(tenantId)
  } catch (err) {
    console.warn('performDowngradeToFree: Error resetting settings', err)
  }

  return { success: true, tenantId }
}

// Downgrade to PREMIUM (from PREMIUM_PRO)
export async function performDowngradeToPremium(tenantId, premiumUntil = null) {
  ensureSupabase()
  
  // 1. Update subscription tier to PREMIUM
  const updateData = {
    subscription_tier: 'premium',
  }
  
  if (premiumUntil) {
    updateData.premium_until = premiumUntil
  }

  const { error: tierError } = await supabase
    .from('tenants')
    .update(updateData)
    .eq('id', tenantId)

  if (tierError) throw tierError

  // 2. Reset only PREMIUM_PRO specific theme settings
  try {
    const { data: currentTheme } = await supabase
      .from('tenant_themes')
      .select('*')
      .eq('tenant_id', tenantId)
      .single()

    if (currentTheme) {
      // Reset only PRO-exclusive features
      const proExclusiveLayouts = ['magazine', 'minimal', 'polaroid', 'banner']
      const proExclusiveHeroStyles = ['parallax_depth', 'cube_rotate', 'reveal_wipe', 'zoom_blur']
      
      const updates = {}
      
      if (proExclusiveLayouts.includes(currentTheme.product_card_layout)) {
        updates.product_card_layout = 'horizontal' // Default PREMIUM layout
      }
      
      if (proExclusiveHeroStyles.includes(currentTheme.hero_style)) {
        updates.hero_style = 'slide_fade' // Default PREMIUM hero
      }

      if (Object.keys(updates).length > 0) {
        await supabase
          .from('tenant_themes')
          .update(updates)
          .eq('tenant_id', tenantId)
      }
    }
  } catch (err) {
    console.warn('performDowngradeToPremium: Error resetting theme', err)
  }

  return { success: true, tenantId }
}

// ============================================================================
// Order Limits System
// ============================================================================

// Fetch order limits status for a tenant
export async function fetchOrderLimitsStatus(tenantId) {
  ensureSupabase()
  
  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('id, subscription_tier, orders_limit, orders_remaining, orders_reset_date')
      .eq('id', tenantId)
      .single()

    if (error) throw error
    
    return {
      tenantId: data?.id,
      tier: data?.subscription_tier || 'free',
      limit: data?.orders_limit,
      remaining: data?.orders_remaining,
      resetDate: data?.orders_reset_date,
      isUnlimited: data?.orders_limit === null,
      canAcceptOrders: data?.orders_limit === null || (data?.orders_remaining ?? 0) > 0,
    }
  } catch (err) {
    // If columns don't exist, return default (can accept orders)
    console.warn('fetchOrderLimitsStatus: columns may not exist yet. Run migration add_order_limits.sql')
    return {
      tenantId,
      tier: 'free',
      limit: 15,
      remaining: 15,
      resetDate: null,
      isUnlimited: false,
      canAcceptOrders: true,
    }
  }
}

// Fetch order limits by slug (for storefront)
export async function fetchOrderLimitsStatusBySlug(slug) {
  ensureSupabase()
  
  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('id, subscription_tier, orders_limit, orders_remaining, orders_reset_date')
      .eq('slug', slug)
      .single()

    if (error) throw error
    
    return {
      tenantId: data?.id,
      tier: data?.subscription_tier || 'free',
      limit: data?.orders_limit,
      remaining: data?.orders_remaining,
      resetDate: data?.orders_reset_date,
      isUnlimited: data?.orders_limit === null,
      canAcceptOrders: data?.orders_limit === null || (data?.orders_remaining ?? 0) > 0,
    }
  } catch (err) {
    // If columns don't exist, return default (can accept orders)
    return {
      tenantId: null,
      tier: 'free',
      limit: 15,
      remaining: 15,
      resetDate: null,
      isUnlimited: false,
      canAcceptOrders: true,
    }
  }
}

// Subscribe to order limits changes in real-time
export function subscribeToOrderLimits(tenantId, callback) {
  if (!isSupabaseConfigured) return () => {}
  
  console.log('🔔 Subscribing to order limits for tenant:', tenantId)
  
  const channel = supabase
    .channel(`tenant-orders-${tenantId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'tenants',
        filter: `id=eq.${tenantId}`,
      },
      (payload) => {
        console.log('🔔 Order limits REALTIME update received:', payload.new)
        const newData = payload.new
        callback({
          tenantId: newData.id,
          tier: newData.subscription_tier || 'free',
          limit: newData.orders_limit,
          remaining: newData.orders_remaining,
          resetDate: newData.orders_reset_date,
          isUnlimited: newData.orders_limit === null,
          canAcceptOrders: newData.orders_limit === null || (newData.orders_remaining ?? 0) > 0,
        })
      }
    )
    .subscribe((status) => {
      console.log('🔔 Order limits subscription status:', status)
    })

  // Return unsubscribe function
  return () => {
    console.log('🔔 Unsubscribing from order limits')
    supabase.removeChannel(channel)
  }
}

// ============================================================================
// Subscription Expiration System
// ============================================================================

// Check if subscription is expired and downgrade to free if needed
export async function checkAndFixSubscriptionExpiration(tenantId) {
  ensureSupabase()
  
  try {
    // First, get current tenant data
    const { data: tenant, error: fetchError } = await supabase
      .from('tenants')
      .select('id, name, subscription_tier, premium_until, orders_limit, orders_remaining')
      .eq('id', tenantId)
      .single()

    if (fetchError) throw fetchError
    if (!tenant) return null

    // Check if subscription is expired
    const isExpired = tenant.subscription_tier !== 'free' && 
                      tenant.premium_until && 
                      new Date(tenant.premium_until) < new Date()

    if (isExpired) {
      console.log('⚠️ Subscription expired for tenant:', tenant.name)
      console.log('⚠️ premium_until:', tenant.premium_until, '< now')
      
      // Downgrade to free
      const { data: updated, error: updateError } = await supabase
        .from('tenants')
        .update({
          subscription_tier: 'free',
          orders_limit: 15,
          orders_remaining: Math.min(tenant.orders_remaining || 15, 15)
        })
        .eq('id', tenantId)
        .select('id, name, subscription_tier, premium_until, orders_limit, orders_remaining')
        .single()

      if (updateError) {
        console.error('Error downgrading subscription:', updateError)
        // If update fails (e.g., RLS), just return the original with a flag
        return {
          ...tenant,
          wasExpired: true,
          needsAdminFix: true
        }
      }

      console.log('✅ Tenant downgraded to free:', updated)
      return {
        ...updated,
        wasExpired: true
      }
    }

    return {
      ...tenant,
      wasExpired: false
    }
  } catch (err) {
    console.error('Error checking subscription expiration:', err)
    return null
  }
}

// Check subscription status with expiration check (call this on dashboard load)
export async function fetchTenantWithSubscriptionCheck(tenantId) {
  ensureSupabase()
  
  try {
    // Try to use the database function first
    const { data, error } = await supabase
      .rpc('get_tenant_with_subscription_check', { p_tenant_id: tenantId })

    if (!error && data && data.length > 0) {
      const tenant = data[0]
      if (tenant.is_expired) {
        console.log('⚠️ Subscription was expired and auto-corrected by database')
      }
      return tenant
    }

    // Fallback to manual check if RPC doesn't exist
    return await checkAndFixSubscriptionExpiration(tenantId)
  } catch (err) {
    console.warn('RPC not available, using fallback:', err.message)
    return await checkAndFixSubscriptionExpiration(tenantId)
  }
}
