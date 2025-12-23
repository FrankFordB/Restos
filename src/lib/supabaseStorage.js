import { supabase, isSupabaseConfigured } from './supabaseClient'

const BUCKET = 'product-images'

function ensureSupabase() {
  if (!isSupabaseConfigured) {
    const error = new Error('Supabase no está configurado')
    error.code = 'SUPABASE_NOT_CONFIGURED'
    throw error
  }
}

function safeExtFromFile(file) {
  const name = String(file?.name || '')
  const idx = name.lastIndexOf('.')
  if (idx <= 0) return ''
  return name.slice(idx).toLowerCase()
}

export async function uploadProductImage({ tenantId, productId, file }) {
  ensureSupabase()
  if (!productId) throw new Error('productId requerido para subir imagen')
  if (!file) throw new Error('Archivo requerido')

  // IMPORTANT: La policy de Storage valida el prefijo con public.current_tenant_id().
  // Para evitar 403 por tenantId desincronizado, usamos el tenant_id del perfil como fuente de verdad.
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr) throw userErr
  const userId = userData?.user?.id
  if (!userId) throw new Error('No hay usuario autenticado para subir imagen')

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (profileErr) throw profileErr
  const profileTenantId = profile?.tenant_id || null
  if (!profileTenantId) {
    throw new Error(
      'Tu usuario no tiene tenant asignado en profiles (tenant_id = null). Asigna/crea tu restaurante en el dashboard y vuelve a intentar.'
    )
  }

  // Si el caller pasó tenantId y no coincide, explicamos el problema.
  if (tenantId && String(tenantId) !== String(profileTenantId)) {
    throw new Error(
      `tenantId no coincide con tu perfil. UI tenantId=${tenantId} vs profiles.tenant_id=${profileTenantId}. Re-inicia sesión o reasigna tu tenant.`
    )
  }

  const ext = safeExtFromFile(file)
  const filename = `${Date.now()}${ext || ''}`
  const path = `${profileTenantId}/${productId}/${filename}`

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || 'application/octet-stream',
    cacheControl: '3600',
  })

  if (uploadError) {
    const status = uploadError?.statusCode || uploadError?.status || null
    const base = uploadError?.message ? String(uploadError.message) : 'Error subiendo imagen'
    const details = [
      `Bucket: ${BUCKET}`,
      `Path: ${path}`,
      status ? `Status: ${status}` : null,
    ]
      .filter(Boolean)
      .join(' | ')

    const err = new Error(`${base} (${details})`)
    err.cause = uploadError
    throw err
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  if (!data?.publicUrl) throw new Error('No se pudo obtener publicUrl de la imagen')

  return data.publicUrl
}
