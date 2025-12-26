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
  
  // Obtener pedidos con sus items usando una relación
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id, 
      tenant_id, 
      status, 
      total, 
      currency, 
      created_at, 
      customer_name, 
      customer_phone, 
      delivery_type, 
      delivery_address, 
      delivery_notes, 
      payment_method,
      order_items (
        id,
        product_id,
        name,
        unit_price,
        qty,
        line_total
      )
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data || []).map((o) => ({
    id: o.id,
    tenantId: o.tenant_id,
    status: o.status,
    total: Number(o.total),
    currency: o.currency,
    created_at: o.created_at,
    customer_name: o.customer_name,
    customer_phone: o.customer_phone,
    delivery_type: o.delivery_type,
    delivery_address: o.delivery_address,
    delivery_notes: o.delivery_notes,
    payment_method: o.payment_method,
    items: (o.order_items || []).map((item) => ({
      id: item.id,
      productId: item.product_id,
      name: item.name,
      unit_price: Number(item.unit_price),
      qty: item.qty,
      line_total: Number(item.line_total),
    })),
  }))
}

export async function createOrderWithItems({ tenantId, items, total, customer, deliveryType, deliveryAddress, deliveryNotes, paymentMethod }) {
  ensureSupabase()

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      tenant_id: tenantId,
      status: 'pending',
      total,
      currency: 'USD',
      customer_name: customer?.name || null,
      customer_phone: customer?.phone || null,
      delivery_type: deliveryType || 'mostrador',
      delivery_address: deliveryAddress || null,
      delivery_notes: deliveryNotes || null,
      payment_method: paymentMethod || 'efectivo',
    })
    .select('id, tenant_id, status, total, currency, created_at, customer_name, customer_phone, delivery_type, delivery_address, delivery_notes, payment_method')
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
    created_at: order.created_at,
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    delivery_type: order.delivery_type,
    delivery_address: order.delivery_address,
    delivery_notes: order.delivery_notes,
    payment_method: order.payment_method,
    items,
  }
}

export async function updateOrderStatus(orderId, newStatus) {
  ensureSupabase()

  const { data, error } = await supabase
    .from('orders')
    .update({ status: newStatus })
    .eq('id', orderId)
    .select(`
      id, 
      tenant_id, 
      status, 
      total, 
      currency, 
      created_at, 
      customer_name, 
      customer_phone,
      delivery_type,
      delivery_address,
      delivery_notes,
      payment_method,
      order_items (
        id,
        product_id,
        name,
        unit_price,
        qty,
        line_total
      )
    `)
    .single()

  if (error) throw error

  return {
    id: data.id,
    tenantId: data.tenant_id,
    status: data.status,
    total: Number(data.total),
    currency: data.currency,
    created_at: data.created_at,
    customer_name: data.customer_name,
    customer_phone: data.customer_phone,
    delivery_type: data.delivery_type,
    delivery_address: data.delivery_address,
    delivery_notes: data.delivery_notes,
    payment_method: data.payment_method,
    items: (data.order_items || []).map((item) => ({
      id: item.id,
      productId: item.product_id,
      name: item.name,
      unit_price: Number(item.unit_price),
      qty: item.qty,
      line_total: Number(item.line_total),
    })),
  }
}

export async function deleteOrder(orderId) {
  ensureSupabase()

  // Primero eliminamos los items del pedido (por si no tiene ON DELETE CASCADE)
  const { error: itemsError } = await supabase
    .from('order_items')
    .delete()
    .eq('order_id', orderId)

  if (itemsError) throw itemsError

  // Luego eliminamos el pedido
  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('id', orderId)

  if (error) throw error

  return { success: true, orderId }
}
