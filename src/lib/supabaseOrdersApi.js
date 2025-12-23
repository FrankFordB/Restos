import { supabase, isSupabaseConfigured } from './supabaseClient'

function ensureSupabase() {
  if (!isSupabaseConfigured) {
    const error = new Error('Supabase no está configurado')
    error.code = 'SUPABASE_NOT_CONFIGURED'
    throw error
  }
}

export async function listOrdersByTenantId(tenantId) {
  ensureSupabase()
  const { data, error } = await supabase
    .from('orders')
    .select('id, tenant_id, status, total, currency, created_at, customer_name, customer_phone')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data || []).map((o) => ({
    id: o.id,
    tenantId: o.tenant_id,
    status: o.status,
    total: Number(o.total),
    currency: o.currency,
    createdAt: o.created_at,
    customerName: o.customer_name,
    customerPhone: o.customer_phone,
  }))
}

export async function createOrderWithItems({ tenantId, items, total, customer }) {
  ensureSupabase()

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      tenant_id: tenantId,
      status: 'paid',
      total,
      currency: 'USD',
      customer_name: customer?.name || null,
      customer_phone: customer?.phone || null,
    })
    .select('id, tenant_id, status, total, currency, created_at, customer_name, customer_phone')
    .single()

  if (orderError) throw orderError

  const rows = items.map((it) => ({
    order_id: order.id,
    product_id: it.productId || null,
    name: it.name,
    unit_price: it.unitPrice,
    qty: it.qty,
    line_total: it.lineTotal,
  }))

  const { error: itemsError } = await supabase.from('order_items').insert(rows)
  if (itemsError) throw itemsError

  return {
    id: order.id,
    tenantId: order.tenant_id,
    status: order.status,
    total: Number(order.total),
    currency: order.currency,
    createdAt: order.created_at,
    customerName: order.customer_name,
    customerPhone: order.customer_phone,
    items,
  }
}
