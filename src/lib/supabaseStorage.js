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

/**
 * Borra todos los archivos existentes en una carpeta del bucket.
 * Útil para limpiar imágenes viejas antes de subir una nueva.
 * @param {string} folderPath - Ruta de la carpeta
 * @param {string} [prefix] - Prefijo opcional para filtrar archivos (ej: 'logo_', 'welcome_')
 */
async function deleteExistingFiles(folderPath, prefix = null) {
  try {
    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET)
      .list(folderPath)

    if (listError) {
      console.warn('Error listando archivos para borrar:', listError.message)
      return
    }

    if (!files || files.length === 0) return

    // Filtrar por prefijo si se especifica
    const filesToDelete = prefix
      ? files.filter((f) => f.name.startsWith(prefix))
      : files

    if (filesToDelete.length === 0) return

    const filePaths = filesToDelete.map((f) => `${folderPath}/${f.name}`)
    const { error: deleteError } = await supabase.storage
      .from(BUCKET)
      .remove(filePaths)

    if (deleteError) {
      console.warn('Error borrando archivos anteriores:', deleteError.message)
    }
  } catch (err) {
    console.warn('Error en deleteExistingFiles:', err.message)
  }
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

  // Borrar imágenes anteriores de este producto para no ocupar espacio
  const productFolder = `${profileTenantId}/${productId}`
  await deleteExistingFiles(productFolder)

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

/**
 * Sube una imagen para una categoría.
 * Almacena en: {tenantId}/categories/{categoryId}/{timestamp}.ext
 */
export async function uploadCategoryImage({ tenantId, categoryId, file }) {
  ensureSupabase()
  if (!file) throw new Error('Archivo requerido')

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
    throw new Error('Tu usuario no tiene tenant asignado.')
  }

  // Usar un ID temporal si no hay categoryId (categoría nueva)
  const folderName = categoryId || `cat_${Date.now()}`
  const categoryFolder = `${profileTenantId}/categories/${folderName}`
  await deleteExistingFiles(categoryFolder)

  const ext = safeExtFromFile(file)
  const filename = `${Date.now()}${ext || ''}`
  const path = `${profileTenantId}/categories/${folderName}/${filename}`

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || 'application/octet-stream',
    cacheControl: '3600',
  })

  if (uploadError) {
    const base = uploadError?.message ? String(uploadError.message) : 'Error subiendo imagen de categoría'
    throw new Error(base)
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  if (!data?.publicUrl) throw new Error('No se pudo obtener publicUrl de la imagen')

  return data.publicUrl
}

export async function uploadHeroImage({ tenantId, file }) {
  ensureSupabase()
  if (!file) throw new Error('Archivo requerido')

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
    throw new Error('Tu usuario no tiene tenant asignado.')
  }

  // Borrar imágenes hero anteriores para no ocupar espacio
  const heroFolder = `${profileTenantId}/hero`
  await deleteExistingFiles(heroFolder)

  const ext = safeExtFromFile(file)
  const filename = `hero_${Date.now()}${ext || ''}`
  const path = `${profileTenantId}/hero/${filename}`

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || 'application/octet-stream',
    cacheControl: '3600',
  })

  if (uploadError) {
    const base = uploadError?.message ? String(uploadError.message) : 'Error subiendo imagen'
    throw new Error(base)
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  if (!data?.publicUrl) throw new Error('No se pudo obtener publicUrl de la imagen')

  return data.publicUrl
}

export async function uploadTenantLogo({ tenantId, file }) {
  ensureSupabase()
  if (!file) throw new Error('Archivo requerido')

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
    throw new Error('Tu usuario no tiene tenant asignado.')
  }

  // Borrar logos anteriores (solo archivos que empiecen con 'logo_')
  const brandingFolder = `${profileTenantId}/branding`
  await deleteExistingFiles(brandingFolder, 'logo_')

  const ext = safeExtFromFile(file)
  const filename = `logo_${Date.now()}${ext || ''}`
  const path = `${profileTenantId}/branding/${filename}`

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || 'application/octet-stream',
    cacheControl: '3600',
  })

  if (uploadError) {
    const base = uploadError?.message ? String(uploadError.message) : 'Error subiendo logo'
    throw new Error(base)
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  if (!data?.publicUrl) throw new Error('No se pudo obtener publicUrl del logo')

  return data.publicUrl
}

export async function uploadWelcomeImage({ tenantId, file }) {
  ensureSupabase()
  if (!file) throw new Error('Archivo requerido')

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
    throw new Error('Tu usuario no tiene tenant asignado.')
  }

  // Borrar imágenes de bienvenida anteriores (solo archivos que empiecen con 'welcome_')
  const brandingFolder = `${profileTenantId}/branding`
  await deleteExistingFiles(brandingFolder, 'welcome_')

  const ext = safeExtFromFile(file)
  const filename = `welcome_${Date.now()}${ext || ''}`
  const path = `${profileTenantId}/branding/${filename}`

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || 'application/octet-stream',
    cacheControl: '3600',
  })

  if (uploadError) {
    const base = uploadError?.message ? String(uploadError.message) : 'Error subiendo imagen de bienvenida'
    throw new Error(base)
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  if (!data?.publicUrl) throw new Error('No se pudo obtener publicUrl de la imagen')

  return data.publicUrl
}
