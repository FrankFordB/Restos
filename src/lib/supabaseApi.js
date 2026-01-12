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

  // Usar RPC seguro en lugar de UPDATE directo
  const { data, error } = await supabase.rpc('update_tenant_subscription', {
    p_tenant_id: tenantId,
    p_tier: 'premium',
    p_expires_at: until
  })

  if (error) throw error
  return data
}

export async function adminRemoveTenantPremium({ tenantId }) {
  ensureSupabase()
  if (!tenantId) throw new Error('tenantId requerido')

  // Usar RPC seguro en lugar de UPDATE directo
  const { data, error } = await supabase.rpc('update_tenant_subscription', {
    p_tenant_id: tenantId,
    p_tier: 'free',
    p_expires_at: null
  })

  if (error) throw error
  return data
}

// Set subscription tier directly (free, premium, premium_pro)
// Cuando el super admin asigna un tier, se usa gift_subscription
// que maneja tanto regalos (premium/pro) como quitar regalos (free)
export async function adminSetTenantTier({ tenantId, tier, days = null }) {
  ensureSupabase()
  if (!tenantId) throw new Error('tenantId requerido')
  if (!['free', 'premium', 'premium_pro'].includes(tier)) throw new Error('Tier inválido')

  // Usar gift_subscription para todo - maneja free, premium y premium_pro
  const daysToGift = tier === 'free' ? 0 : (days || 30)
  const { data, error } = await supabase.rpc('gift_subscription', {
    p_tenant_id: tenantId,
    p_tier: tier,
    p_days: daysToGift
  })

  if (error) throw error
  return data
}

export async function adminListTenants() {
  ensureSupabase()
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, slug, is_public, premium_until, subscription_tier, owner_user_id, created_at, logo, description, slogan, is_gifted, purchased_premium_tier, purchased_premium_starts_at, purchased_premium_until')
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

// -------------------------
// Admin: CRUD completo de usuarios
// -------------------------

// Actualizar información de un usuario (admin)
export async function adminUpdateUser({ userId, updates }) {
  ensureSupabase()
  if (!userId) throw new Error('userId requerido')
  
  const allowedFields = ['full_name', 'role', 'account_status', 'tenant_id']
  const patch = {}
  
  for (const key of allowedFields) {
    if (updates[key] !== undefined) {
      patch[key] = updates[key]
    }
  }
  
  if (Object.keys(patch).length === 0) {
    throw new Error('No hay campos válidos para actualizar')
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('user_id', userId)
    .select('user_id, email, full_name, role, tenant_id, account_status, premium_until, premium_source, created_at')
    .single()

  if (error) throw error
  return data
}

// Eliminar usuario (elimina profile y opcionalmente tenant)
// NOTA: Para eliminar el auth.user, necesitas ejecutar admin_delete_auth_user RPC
export async function adminDeleteUser({ userId, deleteWithTenant = false }) {
  ensureSupabase()
  if (!userId) throw new Error('userId requerido')

  // Primero verificamos si tiene tenant asociado
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (profileError) throw profileError

  // Si tiene tenant y se quiere eliminar junto con él
  if (profile?.tenant_id && deleteWithTenant) {
    // Eliminar productos de la tienda
    await supabase
      .from('products')
      .delete()
      .eq('tenant_id', profile.tenant_id)

    // Eliminar categorías de la tienda
    await supabase
      .from('categories')
      .delete()
      .eq('tenant_id', profile.tenant_id)

    // Eliminar la tienda
    await supabase
      .from('tenants')
      .delete()
      .eq('id', profile.tenant_id)
  } else if (profile?.tenant_id) {
    // Solo desvincular
    await supabase
      .from('tenants')
      .update({ owner_user_id: null })
      .eq('owner_user_id', userId)
  }

  // Intentar eliminar de auth.users usando RPC (si existe la función)
  try {
    await supabase.rpc('admin_delete_auth_user', { p_user_id: userId })
    return { success: true, authDeleted: true }
  } catch (rpcError) {
    // Si falla el RPC, solo eliminar el profile (fallback)
    console.warn('RPC admin_delete_auth_user no disponible, eliminando solo profile:', rpcError)
    
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('user_id', userId)

    if (error) throw error
    return { success: true, authDeleted: false }
  }
}

// Bloquear usuario (account_status = 'blocked')
export async function adminBlockUser({ userId }) {
  ensureSupabase()
  if (!userId) throw new Error('userId requerido')

  const { data, error } = await supabase
    .from('profiles')
    .update({ account_status: 'blocked' })
    .eq('user_id', userId)
    .select('user_id, email, full_name, role, tenant_id, account_status')
    .single()

  if (error) throw error
  return data
}

// Obtener usuario por ID con su tenant
export async function adminGetUserWithTenant(userId) {
  ensureSupabase()
  if (!userId) throw new Error('userId requerido')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('user_id, email, full_name, role, tenant_id, account_status, premium_until, premium_source, created_at')
    .eq('user_id', userId)
    .single()

  if (profileError) throw profileError

  let tenant = null
  if (profile?.tenant_id) {
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('id, name, slug, is_public, premium_until, subscription_tier, logo, created_at')
      .eq('id', profile.tenant_id)
      .single()
    tenant = tenantData
  }

  return { ...profile, tenant }
}

// -------------------------
// Admin: CRUD completo de tiendas
// -------------------------

// Crear tienda y vincular a usuario
export async function adminCreateTenant({ name, slug, ownerUserId, isPublic = true }) {
  ensureSupabase()
  if (!name || !slug) throw new Error('name y slug son requeridos')

  // Verificar que el slug no exista
  const { data: existing } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (existing) throw new Error('El slug ya está en uso')

  // Si hay ownerUserId, verificar que no tenga ya una tienda
  if (ownerUserId) {
    const { data: existingOwner } = await supabase
      .from('tenants')
      .select('id')
      .eq('owner_user_id', ownerUserId)
      .maybeSingle()

    if (existingOwner) throw new Error('Este usuario ya tiene una tienda asignada')
  }

  // Crear la tienda
  const { data: tenant, error } = await supabase
    .from('tenants')
    .insert({ 
      name, 
      slug, 
      owner_user_id: ownerUserId || null,
      is_public: isPublic,
      subscription_tier: 'free'
    })
    .select('id, name, slug, is_public, premium_until, subscription_tier, owner_user_id, created_at')
    .single()

  if (error) throw error

  // Si hay owner, actualizar su profile con el tenant_id
  if (ownerUserId) {
    await supabase
      .from('profiles')
      .update({ tenant_id: tenant.id, role: 'tenant_admin' })
      .eq('user_id', ownerUserId)
  }

  return tenant
}

// Actualizar tienda
export async function adminUpdateTenant({ tenantId, updates }) {
  ensureSupabase()
  if (!tenantId) throw new Error('tenantId requerido')
  
  const allowedFields = ['name', 'slug', 'is_public', 'description', 'slogan', 'logo']
  const patch = {}
  
  for (const key of allowedFields) {
    if (updates[key] !== undefined) {
      patch[key] = updates[key]
    }
  }
  
  // Verificar slug único si se está actualizando
  if (patch.slug) {
    const { data: existing } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', patch.slug)
      .neq('id', tenantId)
      .maybeSingle()

    if (existing) throw new Error('El slug ya está en uso')
  }

  const { data, error } = await supabase
    .from('tenants')
    .update(patch)
    .eq('id', tenantId)
    .select('id, name, slug, is_public, premium_until, subscription_tier, owner_user_id, created_at, logo, description, slogan')
    .single()

  if (error) throw error
  return data
}

// Eliminar tienda (con opciones para el dueño)
export async function adminDeleteTenant({ tenantId, deleteOwner = false, blockOwner = false }) {
  ensureSupabase()
  if (!tenantId) throw new Error('tenantId requerido')

  // Obtener info del tenant
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('owner_user_id')
    .eq('id', tenantId)
    .maybeSingle()

  if (tenantError) throw tenantError
  if (!tenant) throw new Error('Tienda no encontrada')

  const ownerId = tenant?.owner_user_id

  // Eliminar productos de la tienda
  await supabase
    .from('products')
    .delete()
    .eq('tenant_id', tenantId)

  // Eliminar categorías de la tienda
  await supabase
    .from('categories')
    .delete()
    .eq('tenant_id', tenantId)

  // Eliminar órdenes de la tienda
  await supabase
    .from('orders')
    .delete()
    .eq('tenant_id', tenantId)

  // Eliminar la tienda
  const { error } = await supabase
    .from('tenants')
    .delete()
    .eq('id', tenantId)

  if (error) throw error

  // Manejar el owner según la opción elegida
  if (ownerId) {
    if (deleteOwner) {
      // Eliminar el profile del dueño
      await supabase
        .from('profiles')
        .delete()
        .eq('user_id', ownerId)
    } else if (blockOwner) {
      // Bloquear al dueño
      await supabase
        .from('profiles')
        .update({ tenant_id: null, account_status: 'blocked' })
        .eq('user_id', ownerId)
    } else {
      // Solo desvincular
      await supabase
        .from('profiles')
        .update({ tenant_id: null })
        .eq('user_id', ownerId)
    }
  }

  return { success: true }
}

// Vincular tienda a usuario
export async function adminLinkTenantToUser({ tenantId, userId }) {
  ensureSupabase()
  if (!tenantId || !userId) throw new Error('tenantId y userId son requeridos')

  // Verificar que el usuario no tenga ya otra tienda
  const { data: existingTenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('owner_user_id', userId)
    .neq('id', tenantId)
    .maybeSingle()

  if (existingTenant) throw new Error('Este usuario ya tiene una tienda asignada')

  // Verificar que la tienda no tenga ya otro owner
  const { data: currentTenant } = await supabase
    .from('tenants')
    .select('owner_user_id')
    .eq('id', tenantId)
    .single()

  // Si tiene otro owner, desvincular primero
  if (currentTenant?.owner_user_id && currentTenant.owner_user_id !== userId) {
    await supabase
      .from('profiles')
      .update({ tenant_id: null })
      .eq('user_id', currentTenant.owner_user_id)
  }

  // Actualizar tenant con nuevo owner
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .update({ owner_user_id: userId })
    .eq('id', tenantId)
    .select('id, name, slug, owner_user_id')
    .single()

  if (tenantError) throw tenantError

  // Actualizar profile del usuario
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ tenant_id: tenantId, role: 'tenant_admin' })
    .eq('user_id', userId)

  if (profileError) throw profileError

  return tenant
}

// Desvincular tienda de usuario
export async function adminUnlinkTenantFromUser({ tenantId }) {
  ensureSupabase()
  if (!tenantId) throw new Error('tenantId requerido')

  // Obtener el owner actual
  const { data: tenant } = await supabase
    .from('tenants')
    .select('owner_user_id')
    .eq('id', tenantId)
    .single()

  if (tenant?.owner_user_id) {
    // Desvincular del profile
    await supabase
      .from('profiles')
      .update({ tenant_id: null })
      .eq('user_id', tenant.owner_user_id)
  }

  // Quitar owner del tenant
  const { data, error } = await supabase
    .from('tenants')
    .update({ owner_user_id: null })
    .eq('id', tenantId)
    .select('id, name, slug, owner_user_id')
    .single()

  if (error) throw error
  return data
}

// Obtener tienda con owner detallado
export async function adminGetTenantWithOwner(tenantId) {
  ensureSupabase()
  if (!tenantId) throw new Error('tenantId requerido')

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, name, slug, is_public, premium_until, subscription_tier, owner_user_id, created_at, logo, description, slogan')
    .eq('id', tenantId)
    .single()

  if (tenantError) throw tenantError

  let owner = null
  if (tenant?.owner_user_id) {
    const { data: ownerData } = await supabase
      .from('profiles')
      .select('user_id, email, full_name, role, account_status, created_at')
      .eq('user_id', tenant.owner_user_id)
      .single()
    owner = ownerData
  }

  return { ...tenant, owner }
}

// Buscar usuarios sin tienda (para asignar)
export async function adminGetUsersWithoutTenant() {
  ensureSupabase()
  
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, email, full_name, role, account_status, created_at')
    .is('tenant_id', null)
    .neq('role', 'super_admin')
    .eq('account_status', 'active')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

// Buscar tiendas sin owner (para asignar)
export async function adminGetTenantsWithoutOwner() {
  ensureSupabase()
  
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, slug, is_public, subscription_tier, created_at')
    .is('owner_user_id', null)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
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
    .select('id, name, slug, is_public, premium_until, subscription_tier, logo, description, slogan, is_gifted, purchased_premium_tier, purchased_premium_starts_at, purchased_premium_until')
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
  console.log('🔍 fetchTenantById llamado para:', tenantId)
  
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, slug, is_public, premium_until, subscription_tier, scheduled_tier, scheduled_at, logo, description, slogan, orders_limit, orders_remaining, is_gifted, purchased_premium_tier, purchased_premium_starts_at, purchased_premium_until')
    .eq('id', tenantId)
    .maybeSingle()

  if (error) {
    console.error('❌ Error en fetchTenantById:', error)
    throw error
  }
  
  console.log('📦 fetchTenantById resultado:', {
    id: data?.id,
    subscription_tier: data?.subscription_tier,
    premium_until: data?.premium_until,
    is_gifted: data?.is_gifted
  })
  
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
    .select('id, tenant_id, name, price, description, image_url, focal_point, category, category_id, subcategory_id, cost_price, stock, active, product_extras, discount, has_sizes, size_required, sizes')
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
      category_id: product.categoryId || null,
      subcategory_id: product.subcategoryId || null,
      cost_price: product.costPrice ?? null,
      stock: product.stock ?? null,
      active: product.active ?? true,
      product_extras: product.productExtras || [],
      discount: product.discount ?? null,
      has_sizes: product.hasSizes ?? false,
      size_required: product.sizeRequired ?? true,
      sizes: product.sizes || [],
    })
    .select('id, tenant_id, name, price, description, image_url, focal_point, category, category_id, subcategory_id, cost_price, stock, active, product_extras, discount, has_sizes, size_required, sizes')
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
      ...('categoryId' in patch ? { category_id: patch.categoryId || null } : null),
      ...('subcategoryId' in patch ? { subcategory_id: patch.subcategoryId || null } : null),
      ...('costPrice' in patch ? { cost_price: patch.costPrice ?? null } : null),
      ...('stock' in patch ? { stock: patch.stock ?? null } : null),
      ...('active' in patch ? { active: patch.active } : null),
      ...('productExtras' in patch ? { product_extras: patch.productExtras || [] } : null),
      ...('discount' in patch ? { discount: patch.discount ?? null } : null),
      ...('hasSizes' in patch ? { has_sizes: patch.hasSizes ?? false } : null),
      ...('sizeRequired' in patch ? { size_required: patch.sizeRequired ?? true } : null),
      ...('sizes' in patch ? { sizes: patch.sizes || [] } : null),
    })
    .eq('tenant_id', tenantId)
    .eq('id', productId)
    .select('id, tenant_id, name, price, description, image_url, focal_point, category, category_id, subcategory_id, cost_price, stock, active, product_extras, discount, has_sizes, size_required, sizes')
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
    .select('tenant_id, primary_color, accent_color, background_color, text_color, radius, font_family, card_style, button_style, layout_style, product_card_layout, card_bg, card_text, card_desc, card_price, card_button, hero_style, hero_slides, hero_title_position, hero_overlay_opacity, hero_show_title, hero_show_subtitle, hero_show_cta, hero_carousel_button_style')
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
      font_family: theme.fontFamily,
      card_style: theme.cardStyle,
      button_style: theme.buttonStyle,
      layout_style: theme.layoutStyle,
      product_card_layout: theme.productCardLayout,
      category_card_layout: theme.categoryCardLayout,
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
      hero_carousel_button_style: theme.heroCarouselButtonStyle,
    })
    .select('tenant_id, primary_color, accent_color, background_color, text_color, radius, font_family, card_style, button_style, layout_style, product_card_layout, category_card_layout, card_bg, card_text, card_desc, card_price, card_button, hero_style, hero_slides, hero_title_position, hero_overlay_opacity, hero_show_title, hero_show_subtitle, hero_show_cta, hero_carousel_button_style')
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
// Categories (with subcategories support)
// -------------------------

export async function fetchCategoriesByTenantId(tenantId) {
  ensureSupabase()
  
  // Intentar con campos de subcategorías y reglas de carpetas
  let { data, error } = await supabase
    .from('product_categories')
    .select('id, tenant_id, name, description, short_description, sort_order, active, max_stock, current_stock, parent_id, level, path, image_url, icon, has_products, has_children')
    .eq('tenant_id', tenantId)
    .order('level', { ascending: true })
    .order('sort_order', { ascending: true })

  // Si falla por columnas inexistentes, usar query sin subcategorías
  if (error && (error.message?.includes('parent_id') || error.message?.includes('level') || error.message?.includes('has_products'))) {
    console.warn('⚠️ Columnas de subcategorías no existen. Ejecuta las migraciones add_subcategories_system.sql y add_folder_rules_system.sql')
    const result = await supabase
      .from('product_categories')
      .select('id, tenant_id, name, description, sort_order, active, max_stock, current_stock')
      .eq('tenant_id', tenantId)
      .order('sort_order', { ascending: true })
    
    if (result.error) throw result.error
    // Agregar campos de subcategoría con valores por defecto
    return (result.data || []).map(row => ({ 
      ...row, 
      parent_id: null, 
      level: 0, 
      path: row.id,
      image_url: null,
      icon: null,
      short_description: null,
      has_products: false,
      has_children: false
    }))
  }

  if (error) throw error
  return data
}

export async function insertCategory({ tenantId, category }) {
  ensureSupabase()
  
  // Preparar datos base
  const insertData = {
    tenant_id: tenantId,
    name: category.name,
    description: category.description || null,
    sort_order: category.sortOrder ?? 0,
    active: category.active ?? true,
    max_stock: category.maxStock ?? null,
    current_stock: category.maxStock ?? null,
  }
  
  // Agregar campos de subcategoría si están presentes
  if ('parentId' in category) {
    insertData.parent_id = category.parentId || null
  }
  if ('imageUrl' in category) {
    insertData.image_url = category.imageUrl || null
  }
  if ('icon' in category) {
    insertData.icon = category.icon || null
  }
  if ('shortDescription' in category) {
    insertData.short_description = category.shortDescription || null
  }
  
  // Intentar con campos de subcategorías y reglas
  let { data, error } = await supabase
    .from('product_categories')
    .insert(insertData)
    .select('id, tenant_id, name, description, short_description, sort_order, active, max_stock, current_stock, parent_id, level, path, image_url, icon, has_products, has_children')
    .single()

  // Si falla por regla de carpetas (tiene productos y se intenta crear subcategoría)
  if (error && error.message?.includes('No se pueden crear subcategorías')) {
    throw new Error('Esta categoría ya tiene productos. No puedes crear subcategorías aquí. Mueve los productos primero.')
  }

  // Si falla por columnas inexistentes, usar query sin subcategorías
  if (error && (error.message?.includes('parent_id') || error.message?.includes('level'))) {
    console.warn('⚠️ Columnas de subcategorías no existen. Ejecuta las migraciones')
    const result = await supabase
      .from('product_categories')
      .insert({
        tenant_id: tenantId,
        name: category.name,
        description: category.description || null,
        sort_order: category.sortOrder ?? 0,
        active: category.active ?? true,
        max_stock: category.maxStock ?? null,
        current_stock: category.maxStock ?? null,
      })
      .select('id, tenant_id, name, description, sort_order, active, max_stock, current_stock')
      .single()
    
    if (result.error) throw result.error
    return { 
      ...result.data, 
      parent_id: null, 
      level: 0, 
      path: result.data.id,
      image_url: null,
      icon: null,
      short_description: null,
      has_products: false,
      has_children: false
    }
  }

  if (error) throw error
  return data
}

export async function updateCategoryRow({ tenantId, categoryId, patch }) {
  ensureSupabase()
  
  const updateData = {}
  
  // Campos existentes
  if ('name' in patch) updateData.name = patch.name
  if ('description' in patch) updateData.description = patch.description
  if ('sortOrder' in patch) updateData.sort_order = patch.sortOrder
  if ('sort_order' in patch) updateData.sort_order = patch.sort_order
  if ('active' in patch) updateData.active = patch.active
  if ('max_stock' in patch) updateData.max_stock = patch.max_stock
  if ('current_stock' in patch) updateData.current_stock = patch.current_stock
  
  // Nuevos campos de subcategorías (soportar ambas convenciones)
  if ('parentId' in patch) updateData.parent_id = patch.parentId
  if ('parent_id' in patch) updateData.parent_id = patch.parent_id
  if ('imageUrl' in patch) updateData.image_url = patch.imageUrl
  if ('image_url' in patch) updateData.image_url = patch.image_url
  if ('icon' in patch) updateData.icon = patch.icon
  if ('shortDescription' in patch) updateData.short_description = patch.shortDescription
  if ('short_description' in patch) updateData.short_description = patch.short_description
  
  let { data, error } = await supabase
    .from('product_categories')
    .update(updateData)
    .eq('tenant_id', tenantId)
    .eq('id', categoryId)
    .select('id, tenant_id, name, description, short_description, sort_order, active, max_stock, current_stock, parent_id, level, path, image_url, icon, has_products, has_children')
    .single()

  // Si falla por columnas inexistentes, usar query sin subcategorías
  if (error && (error.message?.includes('parent_id') || error.message?.includes('level'))) {
    // Remover campos de subcategoría del update
    delete updateData.parent_id
    delete updateData.image_url
    delete updateData.icon
    delete updateData.short_description
    
    const result = await supabase
      .from('product_categories')
      .update(updateData)
      .eq('tenant_id', tenantId)
      .eq('id', categoryId)
      .select('id, tenant_id, name, description, sort_order, active, max_stock, current_stock')
      .single()
    
    if (result.error) throw result.error
    return { 
      ...result.data, 
      parent_id: null, 
      level: 0, 
      path: result.data.id,
      image_url: null,
      icon: null,
      short_description: null,
      has_products: false,
      has_children: false
    }
  }

  if (error) throw error
  return data
}

export async function deleteCategoryRow({ tenantId, categoryId }) {
  ensureSupabase()
  
  // Verificar si tiene subcategorías
  const { data: children } = await supabase
    .from('product_categories')
    .select('id')
    .eq('parent_id', categoryId)
    .limit(1)
  
  if (children && children.length > 0) {
    throw new Error('No puedes eliminar una categoría que tiene subcategorías. Elimina primero las subcategorías.')
  }
  
  // Verificar si tiene productos
  const { data: products } = await supabase
    .from('products')
    .select('id')
    .eq('category_id', categoryId)
    .limit(1)
  
  if (products && products.length > 0) {
    throw new Error('No puedes eliminar una categoría que tiene productos. Mueve o elimina los productos primero.')
  }
  
  const { error } = await supabase
    .from('product_categories')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', categoryId)
    
  if (error) throw error
}

// Función para obtener subcategorías de una categoría
export async function fetchSubcategoriesByParentId(tenantId, parentId) {
  ensureSupabase()
  const { data, error } = await supabase
    .from('product_categories')
    .select('id, tenant_id, name, description, sort_order, active, max_stock, current_stock, parent_id, level, path, image_url, icon')
    .eq('tenant_id', tenantId)
    .eq('parent_id', parentId)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return data
}

// Función para obtener categorías raíz (sin parent)
export async function fetchRootCategories(tenantId) {
  ensureSupabase()
  const { data, error } = await supabase
    .from('product_categories')
    .select('id, tenant_id, name, description, sort_order, active, max_stock, current_stock, parent_id, level, path, image_url, icon')
    .eq('tenant_id', tenantId)
    .is('parent_id', null)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return data
}

// -------------------------
// Extra Groups (for product extras/toppings)
// -------------------------

export async function fetchExtraGroupsByTenantId(tenantId) {
  ensureSupabase()
  
  // Intentar con category_ids primero
  let { data, error } = await supabase
    .from('extra_groups')
    .select('id, tenant_id, name, description, min_selections, max_selections, is_required, sort_order, active, category_ids')
    .eq('tenant_id', tenantId)
    .order('sort_order', { ascending: true })

  // Si falla por columna inexistente, intentar sin category_ids
  if (error && error.message?.includes('category_ids')) {
    console.warn('⚠️ Columna category_ids no existe. Ejecuta la migración add_category_ids_to_extra_groups.sql')
    const result = await supabase
      .from('extra_groups')
      .select('id, tenant_id, name, description, min_selections, max_selections, is_required, sort_order, active')
      .eq('tenant_id', tenantId)
      .order('sort_order', { ascending: true })
    
    if (result.error) throw result.error
    // Agregar category_ids vacío a cada resultado
    return (result.data || []).map(row => ({ ...row, category_ids: null }))
  }

  if (error) throw error
  return data
}

export async function insertExtraGroup({ tenantId, group }) {
  ensureSupabase()
  
  // Preparar category_ids: array vacío se guarda como null (= todas las categorías)
  const categoryIds = Array.isArray(group.categoryIds) && group.categoryIds.length > 0 
    ? group.categoryIds 
    : null
  
  // Intentar con category_ids primero
  let { data, error } = await supabase
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
      category_ids: categoryIds,
    })
    .select('id, tenant_id, name, description, min_selections, max_selections, is_required, sort_order, active, category_ids')
    .single()

  // Si falla por columna inexistente, intentar sin category_ids
  if (error && error.message?.includes('category_ids')) {
    console.warn('⚠️ Columna category_ids no existe. Ejecuta la migración add_category_ids_to_extra_groups.sql')
    const result = await supabase
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
    
    if (result.error) throw result.error
    return { ...result.data, category_ids: null }
  }

  if (error) throw error
  return data
}

export async function updateExtraGroupRow({ tenantId, groupId, patch }) {
  ensureSupabase()
  const updateData = {}
  const updateDataWithoutCategoryIds = {}
  
  if ('name' in patch) {
    updateData.name = patch.name
    updateDataWithoutCategoryIds.name = patch.name
  }
  if ('description' in patch) {
    updateData.description = patch.description
    updateDataWithoutCategoryIds.description = patch.description
  }
  if ('minSelections' in patch) {
    updateData.min_selections = patch.minSelections
    updateDataWithoutCategoryIds.min_selections = patch.minSelections
  }
  if ('maxSelections' in patch) {
    updateData.max_selections = patch.maxSelections
    updateDataWithoutCategoryIds.max_selections = patch.maxSelections
  }
  if ('isRequired' in patch) {
    updateData.is_required = patch.isRequired
    updateDataWithoutCategoryIds.is_required = patch.isRequired
  }
  if ('sortOrder' in patch) {
    updateData.sort_order = patch.sortOrder
    updateDataWithoutCategoryIds.sort_order = patch.sortOrder
  }
  if ('active' in patch) {
    updateData.active = patch.active
    updateDataWithoutCategoryIds.active = patch.active
  }
  if ('categoryIds' in patch) {
    // Array vacío se guarda como null (= todas las categorías)
    updateData.category_ids = Array.isArray(patch.categoryIds) && patch.categoryIds.length > 0 
      ? patch.categoryIds 
      : null
  }

  let { data, error } = await supabase
    .from('extra_groups')
    .update(updateData)
    .eq('tenant_id', tenantId)
    .eq('id', groupId)
    .select('id, tenant_id, name, description, min_selections, max_selections, is_required, sort_order, active, category_ids')
    .single()

  // Si falla por columna inexistente, intentar sin category_ids
  if (error && error.message?.includes('category_ids')) {
    console.warn('⚠️ Columna category_ids no existe. Ejecuta la migración add_category_ids_to_extra_groups.sql')
    const result = await supabase
      .from('extra_groups')
      .update(updateDataWithoutCategoryIds)
      .eq('tenant_id', tenantId)
      .eq('id', groupId)
      .select('id, tenant_id, name, description, min_selections, max_selections, is_required, sort_order, active')
      .single()
    
    if (result.error) throw result.error
    return { ...result.data, category_ids: null }
  }

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
  
  // 1. Update subscription tier to FREE usando RPC (bypass RLS)
  const { data, error: tierError } = await supabase
    .rpc('update_tenant_subscription', {
      p_tenant_id: tenantId,
      p_tier: 'free',
      p_expires_at: null
    })

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
  
  // 1. Update subscription tier to PREMIUM usando RPC (bypass RLS)
  const { data, error: tierError } = await supabase
    .rpc('update_tenant_subscription', {
      p_tenant_id: tenantId,
      p_tier: 'premium',
      p_expires_at: premiumUntil || null
    })

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
    .subscribe()

  // Return unsubscribe function
  return () => {
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
        // If update fails (e.g., RLS), just return the original with a flag
        return {
          ...tenant,
          wasExpired: true,
          needsAdminFix: true
        }
      }

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
      return tenant
    }

    // Fallback to manual check if RPC doesn't exist
    return await checkAndFixSubscriptionExpiration(tenantId)
  } catch (err) {
    console.warn('RPC not available, using fallback:', err.message)
    return await checkAndFixSubscriptionExpiration(tenantId)
  }
}

// -------------------------
// Store Footer Settings
// -------------------------

// Fetch store footer settings for a tenant
export async function fetchStoreFooterSettings(tenantId) {
  ensureSupabase()
  
  const { data, error } = await supabase
    .from('store_footer_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  // If table doesn't exist or no data, return null (use defaults)
  if (error) {
    console.warn('fetchStoreFooterSettings: Error or table not exists', error.message)
    return null
  }
  
  return data
}

// Create or update store footer settings
export async function upsertStoreFooterSettings({ tenantId, settings }) {
  ensureSupabase()
  
  const { data, error } = await supabase
    .from('store_footer_settings')
    .upsert({
      tenant_id: tenantId,
      ...settings,
      updated_at: new Date().toISOString()
    }, { onConflict: 'tenant_id' })
    .select('*')
    .single()

  if (error) throw error
  return data
}

// Update specific fields of store footer settings
export async function updateStoreFooterSettings({ tenantId, updates }) {
  ensureSupabase()
  
  const { data, error } = await supabase
    .from('store_footer_settings')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('tenant_id', tenantId)
    .select('*')
    .single()

  if (error) throw error
  return data
}

// Fetch public store footer for storefront (no auth required)
export async function fetchPublicStoreFooter(tenantId) {
  // This function is for anonymous access
  if (!isSupabaseConfigured) {
    return null
  }
  
  const { data, error } = await supabase
    .from('store_footer_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) {
    console.warn('fetchPublicStoreFooter error:', error.message)
    return null
  }
  
  return data
}


// ============================================
// TUTORIAL VIDEOS API
// Uses localStorage as fallback when DB table doesn't exist
// ============================================

const TUTORIAL_STORAGE_KEY = 'dashboard.tutorialVideos'

// Get tutorial videos from localStorage
function getLocalTutorials() {
  try {
    const stored = localStorage.getItem(TUTORIAL_STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

// Save tutorial videos to localStorage
function saveLocalTutorials(tutorials) {
  try {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(tutorials))
  } catch (e) {
    console.warn('Error saving tutorials to localStorage:', e)
  }
}

// Fetch all tutorial videos
export async function fetchTutorialVideos() {
  if (!isSupabaseConfigured) {
    // Use localStorage for local development
    const local = getLocalTutorials()
    return Object.entries(local).map(([section_id, data]) => ({ section_id, ...data }))
  }
  
  try {
    const { data, error } = await supabase
      .from('tutorial_videos')
      .select('*')

    if (error) {
      // Table doesn't exist, use localStorage
      console.warn('fetchTutorialVideos: Using localStorage fallback')
      const local = getLocalTutorials()
      return Object.entries(local).map(([section_id, data]) => ({ section_id, ...data }))
    }
    
    return data || []
  } catch {
    return []
  }
}

// Fetch tutorial video for a specific section
export async function fetchTutorialVideo(sectionId) {
  if (!isSupabaseConfigured) {
    // Use localStorage for local development
    const local = getLocalTutorials()
    return local[sectionId] ? { section_id: sectionId, ...local[sectionId] } : null
  }
  
  try {
    const { data, error } = await supabase
      .from('tutorial_videos')
      .select('*')
      .eq('section_id', sectionId)
      .maybeSingle()

    if (error) {
      // Table doesn't exist, use localStorage
      console.warn('fetchTutorialVideo: Using localStorage fallback')
      const local = getLocalTutorials()
      return local[sectionId] ? { section_id: sectionId, ...local[sectionId] } : null
    }
    
    return data
  } catch {
    return null
  }
}

// Update or create tutorial video (super_admin only)
// Accepts both formats: upsertTutorialVideo(sectionId, url, type) or upsertTutorialVideo({ sectionId, videoUrl, videoType })
export async function upsertTutorialVideo(sectionIdOrObj, videoUrl, videoType = 'youtube') {
  // Handle both call formats
  let sectionId, url, type
  if (typeof sectionIdOrObj === 'object') {
    sectionId = sectionIdOrObj.sectionId
    url = sectionIdOrObj.videoUrl
    type = sectionIdOrObj.videoType || 'youtube'
  } else {
    sectionId = sectionIdOrObj
    url = videoUrl
    type = videoType
  }
  
  // Always save to localStorage as backup
  const local = getLocalTutorials()
  local[sectionId] = {
    video_url: url,
    video_type: type,
    updated_at: new Date().toISOString()
  }
  saveLocalTutorials(local)
  
  if (!isSupabaseConfigured) {
    return { section_id: sectionId, ...local[sectionId] }
  }
  
  try {
    const { data, error } = await supabase
      .from('tutorial_videos')
      .upsert({
        section_id: sectionId,
        video_url: url,
        video_type: type || 'youtube',
        updated_at: new Date().toISOString()
      }, { onConflict: 'section_id' })
      .select('*')
      .single()

    if (error) {
      // Table doesn't exist, localStorage already saved
      console.warn('upsertTutorialVideo: Using localStorage fallback')
      return { section_id: sectionId, ...local[sectionId] }
    }
    
    return data
  } catch (e) {
    console.warn('upsertTutorialVideo error:', e)
    return { section_id: sectionId, ...local[sectionId] }
  }
}

// Delete tutorial video (super_admin only)
export async function deleteTutorialVideo(sectionId) {
  // Remove from localStorage
  const local = getLocalTutorials()
  delete local[sectionId]
  saveLocalTutorials(local)
  
  if (!isSupabaseConfigured) {
    return true
  }
  
  try {
    const { error } = await supabase
      .from('tutorial_videos')
      .delete()
      .eq('section_id', sectionId)

    if (error) {
      console.warn('deleteTutorialVideo: Using localStorage fallback')
    }
    
    return true
  } catch {
    return true
  }
}

// ============================================
// FIRST LOGIN / WELCOME TUTORIAL
// ============================================

// Check if user has seen the welcome tutorial
// Uses localStorage as primary storage to avoid DB column dependency
export async function checkFirstLogin(userId) {
  // Always use localStorage to track welcome tutorial
  const localKey = `dashboard.welcomeTutorial.seen.${userId}`
  return localStorage.getItem(localKey) !== 'true'
}

// Mark welcome tutorial as seen
export async function markWelcomeTutorialSeen(userId) {
  // Always use localStorage to track welcome tutorial
  const localKey = `dashboard.welcomeTutorial.seen.${userId}`
  localStorage.setItem(localKey, 'true')
  return true
}

// ============================================
// SIZE PRESETS
// ============================================

// Default presets for when DB is not configured
const DEFAULT_SIZE_PRESETS = [
  {
    id: 'preset_footwear_latam',
    name: 'Zapatillas Adulto (AR/LATAM)',
    category: 'footwear',
    region: 'latam',
    audience: 'adult',
    sizes: [
      { name: '35', priceModifier: 0 },
      { name: '36', priceModifier: 0 },
      { name: '37', priceModifier: 0 },
      { name: '38', priceModifier: 0 },
      { name: '39', priceModifier: 0 },
      { name: '40', priceModifier: 0 },
      { name: '41', priceModifier: 0 },
      { name: '42', priceModifier: 0 },
      { name: '43', priceModifier: 0 },
      { name: '44', priceModifier: 0 },
      { name: '45', priceModifier: 0 },
    ],
    isDefault: true,
    isGlobal: true,
  },
  {
    id: 'preset_kids_footwear_latam',
    name: 'Zapatillas Niños (AR/LATAM)',
    category: 'kids_footwear',
    region: 'latam',
    audience: 'kids',
    sizes: [
      { name: '17', priceModifier: 0 },
      { name: '18', priceModifier: 0 },
      { name: '19', priceModifier: 0 },
      { name: '20', priceModifier: 0 },
      { name: '21', priceModifier: 0 },
      { name: '22', priceModifier: 0 },
      { name: '23', priceModifier: 0 },
      { name: '24', priceModifier: 0 },
      { name: '25', priceModifier: 0 },
      { name: '26', priceModifier: 0 },
      { name: '27', priceModifier: 0 },
      { name: '28', priceModifier: 0 },
      { name: '29', priceModifier: 0 },
      { name: '30', priceModifier: 0 },
      { name: '31', priceModifier: 0 },
      { name: '32', priceModifier: 0 },
      { name: '33', priceModifier: 0 },
      { name: '34', priceModifier: 0 },
    ],
    isDefault: true,
    isGlobal: true,
  },
  {
    id: 'preset_clothing_adult',
    name: 'Ropa Adulto (S-XXL)',
    category: 'clothing',
    region: 'global',
    audience: 'adult',
    sizes: [
      { name: 'XS', priceModifier: 0 },
      { name: 'S', priceModifier: 0 },
      { name: 'M', priceModifier: 0 },
      { name: 'L', priceModifier: 0 },
      { name: 'XL', priceModifier: 0 },
      { name: 'XXL', priceModifier: 0 },
      { name: 'XXXL', priceModifier: 0 },
    ],
    isDefault: true,
    isGlobal: true,
  },
  {
    id: 'preset_kids_clothing',
    name: 'Ropa Niños (2-16 años)',
    category: 'kids_clothing',
    region: 'global',
    audience: 'kids',
    sizes: [
      { name: '2', priceModifier: 0 },
      { name: '4', priceModifier: 0 },
      { name: '6', priceModifier: 0 },
      { name: '8', priceModifier: 0 },
      { name: '10', priceModifier: 0 },
      { name: '12', priceModifier: 0 },
      { name: '14', priceModifier: 0 },
      { name: '16', priceModifier: 0 },
    ],
    isDefault: true,
    isGlobal: true,
  },
  {
    id: 'preset_baby_clothing',
    name: 'Ropa Bebés (0-24 meses)',
    category: 'kids_clothing',
    region: 'global',
    audience: 'kids',
    sizes: [
      { name: '0-3m', priceModifier: 0 },
      { name: '3-6m', priceModifier: 0 },
      { name: '6-9m', priceModifier: 0 },
      { name: '9-12m', priceModifier: 0 },
      { name: '12-18m', priceModifier: 0 },
      { name: '18-24m', priceModifier: 0 },
    ],
    isDefault: true,
    isGlobal: true,
  },
  {
    id: 'preset_pants',
    name: 'Pantalones/Jeans (Talle numérico)',
    category: 'clothing',
    region: 'global',
    audience: 'adult',
    sizes: [
      { name: '28', priceModifier: 0 },
      { name: '30', priceModifier: 0 },
      { name: '32', priceModifier: 0 },
      { name: '34', priceModifier: 0 },
      { name: '36', priceModifier: 0 },
      { name: '38', priceModifier: 0 },
      { name: '40', priceModifier: 0 },
      { name: '42', priceModifier: 0 },
      { name: '44', priceModifier: 0 },
    ],
    isDefault: false,
    isGlobal: true,
  },
]

// Fetch size presets for a tenant (includes global presets)
export async function fetchSizePresets(tenantId) {
  if (!isSupabaseConfigured) {
    return DEFAULT_SIZE_PRESETS
  }

  try {
    const { data, error } = await supabase
      .from('size_presets')
      .select('*')
      .or(`is_global.eq.true,tenant_id.eq.${tenantId}`)
      .order('is_global', { ascending: false })
      .order('sort_order', { ascending: true })

    if (error) {
      console.warn('fetchSizePresets error, using defaults:', error)
      return DEFAULT_SIZE_PRESETS
    }

    return data.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      region: p.region,
      audience: p.audience,
      sizes: p.sizes || [],
      isDefault: p.is_default,
      isGlobal: p.is_global,
      tenantId: p.tenant_id,
    }))
  } catch (err) {
    console.warn('fetchSizePresets exception, using defaults:', err)
    return DEFAULT_SIZE_PRESETS
  }
}

// Create a custom size preset for a tenant
export async function createSizePreset(tenantId, preset) {
  if (!isSupabaseConfigured) {
    return {
      id: `preset_custom_${Date.now()}`,
      ...preset,
      isGlobal: false,
      tenantId,
    }
  }

  const { data, error } = await supabase
    .from('size_presets')
    .insert({
      name: preset.name,
      category: preset.category || 'custom',
      region: preset.region || 'global',
      audience: preset.audience || 'all',
      sizes: preset.sizes || [],
      is_default: false,
      is_global: false,
      tenant_id: tenantId,
    })
    .select()
    .single()

  if (error) throw error
  return {
    id: data.id,
    name: data.name,
    category: data.category,
    region: data.region,
    audience: data.audience,
    sizes: data.sizes || [],
    isDefault: data.is_default,
    isGlobal: data.is_global,
    tenantId: data.tenant_id,
  }
}

// Update a custom size preset
export async function updateSizePreset(presetId, updates) {
  if (!isSupabaseConfigured) {
    return { id: presetId, ...updates }
  }

  const updateData = {}
  if ('name' in updates) updateData.name = updates.name
  if ('sizes' in updates) updateData.sizes = updates.sizes
  if ('category' in updates) updateData.category = updates.category
  if ('audience' in updates) updateData.audience = updates.audience

  const { data, error } = await supabase
    .from('size_presets')
    .update(updateData)
    .eq('id', presetId)
    .select()
    .single()

  if (error) throw error
  return {
    id: data.id,
    name: data.name,
    category: data.category,
    region: data.region,
    audience: data.audience,
    sizes: data.sizes || [],
    isDefault: data.is_default,
    isGlobal: data.is_global,
    tenantId: data.tenant_id,
  }
}

// Delete a custom size preset
export async function deleteSizePreset(presetId) {
  if (!isSupabaseConfigured) {
    return true
  }

  const { error } = await supabase
    .from('size_presets')
    .delete()
    .eq('id', presetId)
    .eq('is_global', false) // Only allow deleting non-global presets

  if (error) throw error
  return true
}
