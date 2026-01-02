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
        line_total,
        extras
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
      product_name: item.name,
      unit_price: Number(item.unit_price),
      price: Number(item.unit_price),
      qty: item.qty,
      quantity: item.qty,
      line_total: Number(item.line_total),
      extras: item.extras || [],
    })),
  }))
}

export async function createOrderWithItems({ tenantId, items, total, customer, deliveryType, deliveryAddress, deliveryNotes, paymentMethod }) {
  ensureSupabase()

  // Preparar items para validación
  const stockItems = items
    .filter((it) => it.productId)
    .map((it) => ({
      productId: it.productId,
      quantity: it.qty || it.quantity || 1,
    }))

  // Validar stock de categorías ANTES de crear la orden
  if (stockItems.length > 0) {
    const { valid, errors } = await validateCategoryStock(tenantId, stockItems)
    if (!valid) {
      throw new Error(`Stock insuficiente: ${errors.join(', ')}`)
    }
  }

  // Insertar la orden y obtener los datos con .select()
  // Requiere política SELECT para anon (orders_select_recent_anon)
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
    name: it.name || it.product_name,
    unit_price: it.unitPrice || it.price,
    qty: it.qty || it.quantity,
    line_total: it.lineTotal,
    extras: it.extras || [],
  }))

  const { error: itemsError } = await supabase.from('order_items').insert(rows)
  if (itemsError) throw itemsError

  // Restar stock de los productos vendidos
  if (stockItems.length > 0) {
    await decrementProductStock(stockItems)
    
    // También decrementar stock global de categorías
    // Agrupar por categoría y sumar cantidades
    await decrementCategoryStockByProducts(tenantId, stockItems)
  }

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
        line_total,
        extras
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
  console.log('🔄 supabaseOrdersApi.deleteOrder() - orderId:', orderId)

  // Primero eliminamos los items del pedido (por si no tiene ON DELETE CASCADE)
  const { data: deletedItems, error: itemsError } = await supabase
    .from('order_items')
    .delete()
    .eq('order_id', orderId)
    .select()

  console.log('📦 Items eliminados:', deletedItems, 'Error:', itemsError)
  if (itemsError) throw itemsError

  // Luego eliminamos el pedido
  const { data: deletedOrder, error } = await supabase
    .from('orders')
    .delete()
    .eq('id', orderId)
    .select()

  console.log('📋 Pedido eliminado:', deletedOrder, 'Error:', error)
  if (error) throw error

  // Si no se eliminó ningún registro, puede ser un problema de RLS
  if (!deletedOrder || deletedOrder.length === 0) {
    console.warn('⚠️ No se eliminó ningún registro. Posible problema de RLS policies.')
  }

  return { success: true, orderId }
}

/**
 * Actualiza el stock de múltiples productos restando las cantidades vendidas
 * @param {Array<{productId: string, quantity: number}>} items - Items a restar del stock
 */
export async function decrementProductStock(items) {
  ensureSupabase()
  
  // Para cada item, decrementar el stock del producto
  const updates = items.map(async (item) => {
    if (!item.productId) return null
    
    // Primero obtenemos el stock actual
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('id, stock')
      .eq('id', item.productId)
      .single()
    
    if (fetchError || !product) {
      console.warn(`No se encontró producto ${item.productId} para actualizar stock`)
      return null
    }
    
    // Si no tiene stock definido, no hacemos nada
    if (product.stock === null || product.stock === undefined) return null
    
    const newStock = Math.max(0, (product.stock || 0) - (item.quantity || 1))
    
    const { error: updateError } = await supabase
      .from('products')
      .update({ stock: newStock })
      .eq('id', item.productId)
    
    if (updateError) {
      console.error(`Error actualizando stock de ${item.productId}:`, updateError)
      return null
    }
    
    return { productId: item.productId, newStock }
  })
  
  return Promise.all(updates)
}

/**
 * Decrementa el stock global de una categoría
 * @param {string} categoryId - ID de la categoría
 * @param {number} quantity - Cantidad a restar
 * @returns {Promise<{categoryId: string, newStock: number} | null>}
 */
export async function decrementCategoryStock(categoryId, quantity) {
  ensureSupabase()
  
  // Obtener stock actual de la categoría
  const { data: category, error: fetchError } = await supabase
    .from('product_categories')
    .select('id, current_stock, max_stock')
    .eq('id', categoryId)
    .single()
  
  if (fetchError || !category) {
    console.warn(`No se encontró categoría ${categoryId} para actualizar stock`)
    return null
  }
  
  // Si no tiene stock definido, no hacemos nada
  if (category.current_stock === null || category.current_stock === undefined) {
    return null
  }
  
  const newStock = Math.max(0, (category.current_stock || 0) - quantity)
  
  const { error: updateError } = await supabase
    .from('product_categories')
    .update({ current_stock: newStock })
    .eq('id', categoryId)
  
  if (updateError) {
    console.error(`Error actualizando stock de categoría ${categoryId}:`, updateError)
    return null
  }
  
  return { categoryId, newStock }
}

/**
 * Valida que haya stock disponible en las categorías para los productos del pedido
 * @param {string} tenantId - ID del tenant
 * @param {Array<{productId: string, quantity: number}>} items - Items del carrito
 * @returns {Promise<{valid: boolean, errors: string[]}>}
 */
export async function validateCategoryStock(tenantId, items) {
  ensureSupabase()
  
  const productIds = items.map(it => it.productId).filter(Boolean)
  if (productIds.length === 0) return { valid: true, errors: [] }
  
  // Obtener productos con su categoría (nombre)
  const { data: products, error: prodError } = await supabase
    .from('products')
    .select('id, name, category')
    .in('id', productIds)
  
  if (prodError || !products) {
    console.warn('Error obteniendo productos:', prodError)
    return { valid: true, errors: [] } // En caso de error, permitir (fail-open)
  }
  
  // Obtener categorías del tenant con stock configurado
  const { data: categories, error: catError } = await supabase
    .from('product_categories')
    .select('id, name, current_stock, max_stock')
    .eq('tenant_id', tenantId)
    .not('max_stock', 'is', null)
  
  if (catError || !categories) {
    console.warn('Error obteniendo categorías:', catError)
    return { valid: true, errors: [] }
  }
  
  // Crear mapa de categoría por nombre
  const categoryByName = {}
  categories.forEach(cat => {
    categoryByName[cat.name.toLowerCase()] = cat
  })
  
  // Agrupar cantidades por categoría
  const categoryQuantities = {}
  products.forEach(product => {
    if (!product.category) return
    const catName = product.category.toLowerCase()
    const item = items.find(it => it.productId === product.id)
    if (item) {
      if (!categoryQuantities[catName]) {
        categoryQuantities[catName] = { name: product.category, requested: 0 }
      }
      categoryQuantities[catName].requested += item.quantity || 1
    }
  })
  
  // Validar stock
  const errors = []
  for (const [catName, info] of Object.entries(categoryQuantities)) {
    const cat = categoryByName[catName]
    if (cat && cat.current_stock !== null && info.requested > cat.current_stock) {
      errors.push(`Stock insuficiente de ${info.name}: quedan ${cat.current_stock}, se pidieron ${info.requested}`)
    }
  }
  
  return { valid: errors.length === 0, errors }
}

/**
 * Decrementa el stock de categorías basándose en los productos vendidos
 * Busca por nombre de categoría ya que products usa "category" (texto) no "category_id"
 * @param {string} tenantId - ID del tenant
 * @param {Array<{productId: string, quantity: number}>} items 
 */
export async function decrementCategoryStockByProducts(tenantId, items) {
  ensureSupabase()
  
  // Obtener la info de categoría de cada producto
  const productIds = items.map(it => it.productId).filter(Boolean)
  if (productIds.length === 0) return []
  
  const { data: products, error } = await supabase
    .from('products')
    .select('id, category')
    .in('id', productIds)
  
  if (error || !products) {
    console.warn('Error obteniendo categorías de productos:', error)
    return []
  }
  
  // Obtener todas las categorías del tenant
  const { data: categories, error: catError } = await supabase
    .from('product_categories')
    .select('id, name')
    .eq('tenant_id', tenantId)
  
  if (catError || !categories) {
    console.warn('Error obteniendo categorías del tenant:', catError)
    return []
  }
  
  // Crear mapa nombre -> categoryId
  const categoryIdByName = {}
  categories.forEach(cat => {
    categoryIdByName[cat.name.toLowerCase()] = cat.id
  })
  
  // Agrupar cantidades por categoría
  const categoryQuantities = {}
  items.forEach(item => {
    const product = products.find(p => p.id === item.productId)
    if (product?.category) {
      const categoryId = categoryIdByName[product.category.toLowerCase()]
      if (categoryId) {
        if (!categoryQuantities[categoryId]) {
          categoryQuantities[categoryId] = 0
        }
        categoryQuantities[categoryId] += item.quantity || 1
      }
    }
  })
  
  // Decrementar stock de cada categoría
  const updates = Object.entries(categoryQuantities).map(async ([categoryId, quantity]) => {
    return decrementCategoryStock(categoryId, quantity)
  })
  
  return Promise.all(updates)
}
