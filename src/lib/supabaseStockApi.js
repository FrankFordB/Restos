import { supabase, isSupabaseConfigured } from './supabaseClient'

function ensureSupabase() {
  if (!isSupabaseConfigured) {
    const error = new Error('Supabase no está configurado')
    error.code = 'SUPABASE_NOT_CONFIGURED'
    throw error
  }
}

// Descuenta stock de productos al confirmar pedido
export async function discountStockForOrder({ tenantId, items }) {
  ensureSupabase()
  // Solo productos con track_stock
  const updates = []
  for (const item of items) {
    if (!item.productId) continue
    // Buscar el producto y su stock actual
    const { data: prod, error: prodErr } = await supabase
      .from('products')
      .select('id, stock, track_stock')
      .eq('id', item.productId)
      .maybeSingle()
    if (prodErr) throw prodErr
    if (!prod || !prod.track_stock) continue
    const newStock = Math.max(0, (prod.stock ?? 0) - (item.qty || 0))
    updates.push({ id: prod.id, stock: newStock })
  }
  if (updates.length > 0) {
    const { error } = await supabase.from('products').upsert(updates, { onConflict: ['id'] })
    if (error) throw error
  }
  return true
}
