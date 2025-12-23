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
  if (!tenantId) throw new Error('tenantId requerido para subir imagen')
  if (!productId) throw new Error('productId requerido para subir imagen')
  if (!file) throw new Error('Archivo requerido')

  const ext = safeExtFromFile(file)
  const filename = `${Date.now()}${ext || ''}`
  const path = `${tenantId}/${productId}/${filename}`

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || 'application/octet-stream',
    cacheControl: '3600',
  })

  if (uploadError) throw uploadError

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  if (!data?.publicUrl) throw new Error('No se pudo obtener publicUrl de la imagen')

  return data.publicUrl
}
