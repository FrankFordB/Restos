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
    .select('id, name, slug, is_public, premium_until, subscription_tier, owner_user_id, created_at')
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
    .select('id, name, slug, is_public, premium_until')
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
    .select('id, name, slug, is_public, premium_until, subscription_tier')
    .eq('is_public', true)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function fetchTenantBySlug(slug) {
  ensureSupabase()
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, slug, is_public, premium_until, subscription_tier')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  return data
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
    .select('id, name, slug, is_public, premium_until, subscription_tier')
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
    .select('id, name, slug, is_public, premium_until, subscription_tier')
    .single()

  if (error) throw error
  return data
}

export async function fetchProductsByTenantId(tenantId) {
  ensureSupabase()
  const { data, error } = await supabase
    .from('products')
    .select('id, tenant_id, name, price, description, image_url, active')
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
      name: product.name,
      price: product.price,
      description: product.description || null,
      image_url: product.imageUrl || null,
      active: product.active ?? true,
    })
    .select('id, tenant_id, name, price, description, image_url, active')
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
      ...('active' in patch ? { active: patch.active } : null),
    })
    .eq('tenant_id', tenantId)
    .eq('id', productId)
    .select('id, tenant_id, name, price, description, image_url, active')
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
    .select('tenant_id, primary_color, accent_color, background_color, text_color, radius, product_card_layout, card_bg, card_text, card_desc, card_price, card_button, hero_style, hero_slides, hero_title_position, hero_overlay_opacity')
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
    })
    .select('tenant_id, primary_color, accent_color, background_color, text_color, radius, product_card_layout, card_bg, card_text, card_desc, card_price, card_button, hero_style, hero_slides, hero_title_position, hero_overlay_opacity')
    .single()

  if (error) throw error
  return data
}
