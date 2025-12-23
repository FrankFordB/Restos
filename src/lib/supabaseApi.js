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

export async function fetchProfile(userId) {
  ensureSupabase()
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, role, tenant_id')
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
    .select('user_id, role, tenant_id')
    .single()

  if (error) throw error
  return data
}

export async function createTenant({ name, slug, ownerUserId }) {
  ensureSupabase()
  const { data, error } = await supabase
    .from('tenants')
    .insert({ name, slug, owner_user_id: ownerUserId })
    .select('id, name, slug')
    .single()

  if (error) throw error
  return data
}

export async function listTenants() {
  ensureSupabase()
  const { data, error } = await supabase.from('tenants').select('id, name, slug').order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchTenantBySlug(slug) {
  ensureSupabase()
  const { data, error } = await supabase.from('tenants').select('id, name, slug').eq('slug', slug).maybeSingle()
  if (error) throw error
  return data
}

export async function fetchTenantByOwnerUserId(ownerUserId) {
  ensureSupabase()
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, slug, owner_user_id')
    .eq('owner_user_id', ownerUserId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

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
    .select('tenant_id, primary_color, accent_color, background_color, text_color, radius')
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
    })
    .select('tenant_id, primary_color, accent_color, background_color, text_color, radius')
    .single()

  if (error) throw error
  return data
}
