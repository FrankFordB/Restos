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
      is_paid,
      paid_at,
      internal_notes,
      order_items (
        id,
        product_id,
        name,
        unit_price,
        qty,
        line_total,
        extras,
        comment
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
    is_paid: o.is_paid || false,
    paid_at: o.paid_at || null,
    internal_notes: o.internal_notes || '',
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
      comment: item.comment || null,
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
    comment: it.comment || null,
  }))

  const { error: itemsError } = await supabase.from('order_items').insert(rows)
  if (itemsError) throw itemsError

  // Restar stock de los productos vendidos
  console.log('[CreateOrder] Items para stock:', stockItems)
  if (stockItems.length > 0) {
    await decrementProductStock(stockItems)
    
    // También decrementar stock global de categorías
    // Agrupar por categoría y sumar cantidades
    await decrementCategoryStockByProducts(tenantId, stockItems)
  } else {
    console.log('[CreateOrder] No hay items con productId para decrementar stock')
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
        extras,
        comment
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
      extras: item.extras || [],
      comment: item.comment || null,
    })),
  }
}

export async function deleteOrder(orderId) {
  ensureSupabase()

  // Primero eliminamos los items del pedido (por si no tiene ON DELETE CASCADE)
  const { data: deletedItems, error: itemsError } = await supabase
    .from('order_items')
    .delete()
    .eq('order_id', orderId)
    .select()

  if (itemsError) throw itemsError

  // Luego eliminamos el pedido
  const { data: deletedOrder, error } = await supabase
    .from('orders')
    .delete()
    .eq('id', orderId)
    .select()

  if (error) throw error

  return { success: true, orderId }
}

/**
 * Actualiza el stock de múltiples productos restando las cantidades vendidas
 * @param {Array<{productId: string, quantity: number}>} items - Items a restar del stock
 */
export async function decrementProductStock(items) {
  ensureSupabase()
  
  console.log('[Stock] Decrementando stock de productos:', items)
  
  // Para cada item, decrementar el stock del producto
  const updates = items.map(async (item) => {
    if (!item.productId) {
      console.log('[Stock] Item sin productId:', item)
      return null
    }
    
    // Primero obtenemos el stock actual
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('id, stock, name')
      .eq('id', item.productId)
      .single()
    
    if (fetchError || !product) {
      console.log('[Stock] Producto no encontrado:', item.productId, fetchError)
      return null
    }
    
    // Si no tiene stock definido, no hacemos nada
    if (product.stock === null || product.stock === undefined) {
      console.log('[Stock] Producto sin stock configurado:', product.name)
      return null
    }
    
    const newStock = Math.max(0, (product.stock || 0) - (item.quantity || 1))
    console.log(`[Stock] ${product.name}: ${product.stock} -> ${newStock} (restando ${item.quantity})`)
    
    const { error: updateError } = await supabase
      .from('products')
      .update({ stock: newStock })
      .eq('id', item.productId)
    
    if (updateError) {
      console.log('[Stock] Error actualizando:', updateError)
      return null
    }
    
    return { productId: item.productId, newStock }
  })
  
  return Promise.all(updates)
}

/**
 * Decrementa el stock global de una categoría Y de todos sus ancestros con stock configurado
 * @param {string} categoryId - ID de la categoría
 * @param {number} quantity - Cantidad a restar
 * @param {Array} allCategories - Todas las categorías del tenant (para buscar ancestros)
 * @returns {Promise<Array<{categoryId: string, newStock: number}>>}
 */
export async function decrementCategoryStock(categoryId, quantity, allCategories = null) {
  ensureSupabase()
  
  console.log('[CategoryStock] Decrementando categoría jerárquica:', categoryId, 'cantidad:', quantity)
  
  // Obtener la categoría inicial
  const { data: category, error: fetchError } = await supabase
    .from('product_categories')
    .select('id, current_stock, max_stock, name, parent_id')
    .eq('id', categoryId)
    .single()
  
  if (fetchError || !category) {
    console.log('[CategoryStock] Categoría no encontrada:', categoryId, fetchError)
    return []
  }
  
  // Construir lista de categorías a actualizar (esta + ancestros con stock)
  const categoriesToUpdate = []
  
  // Si esta categoría tiene stock, agregarla
  if (category.current_stock !== null && category.current_stock !== undefined) {
    categoriesToUpdate.push(category)
  }
  
  // Buscar ancestros con stock
  let currentParentId = category.parent_id
  while (currentParentId) {
    const { data: parent, error: parentError } = await supabase
      .from('product_categories')
      .select('id, current_stock, max_stock, name, parent_id')
      .eq('id', currentParentId)
      .single()
    
    if (parentError || !parent) break
    
    // Si el ancestro tiene stock configurado, agregarlo
    if (parent.max_stock !== null && parent.max_stock !== undefined) {
      categoriesToUpdate.push(parent)
    }
    
    currentParentId = parent.parent_id
  }
  
  if (categoriesToUpdate.length === 0) {
    console.log('[CategoryStock] Ninguna categoría en la jerarquía tiene stock configurado')
    return []
  }
  
  // Decrementar stock de todas las categorías
  const results = []
  for (const cat of categoriesToUpdate) {
    const newStock = Math.max(0, (cat.current_stock || 0) - quantity)
    console.log(`[CategoryStock] ${cat.name}: ${cat.current_stock} -> ${newStock}`)
    
    const { error: updateError } = await supabase
      .from('product_categories')
      .update({ current_stock: newStock })
      .eq('id', cat.id)
    
    if (!updateError) {
      results.push({ categoryId: cat.id, categoryName: cat.name, oldStock: cat.current_stock, newStock })
    } else {
      console.log('[CategoryStock] Error actualizando:', cat.name, updateError)
    }
  }
  
  return results
}

/**
 * Obtiene el stock efectivo de una categoría considerando la jerarquía
 * Retorna el mínimo stock entre la categoría y todos sus ancestros
 * @param {string} categoryId - ID de la categoría
 * @returns {Promise<{effectiveStock: number, limitingCategoryId: string, limitingCategoryName: string} | null>}
 */
export async function getEffectiveCategoryStock(categoryId) {
  ensureSupabase()
  
  // Obtener la categoría inicial
  const { data: category, error: fetchError } = await supabase
    .from('product_categories')
    .select('id, current_stock, max_stock, name, parent_id')
    .eq('id', categoryId)
    .single()
  
  if (fetchError || !category) {
    return null
  }
  
  // Recopilar todas las categorías con stock en la jerarquía
  const categoriesWithStock = []
  
  if (category.max_stock !== null && category.max_stock !== undefined) {
    categoriesWithStock.push({
      id: category.id,
      name: category.name,
      currentStock: category.current_stock || 0
    })
  }
  
  // Buscar ancestros
  let currentParentId = category.parent_id
  while (currentParentId) {
    const { data: parent, error: parentError } = await supabase
      .from('product_categories')
      .select('id, current_stock, max_stock, name, parent_id')
      .eq('id', currentParentId)
      .single()
    
    if (parentError || !parent) break
    
    if (parent.max_stock !== null && parent.max_stock !== undefined) {
      categoriesWithStock.push({
        id: parent.id,
        name: parent.name,
        currentStock: parent.current_stock || 0
      })
    }
    
    currentParentId = parent.parent_id
  }
  
  if (categoriesWithStock.length === 0) {
    return null // Ninguna categoría en la jerarquía tiene stock configurado
  }
  
  // Encontrar la categoría con menor stock (la que limita)
  const limiting = categoriesWithStock.reduce((min, cat) => 
    cat.currentStock < min.currentStock ? cat : min
  )
  
  return {
    effectiveStock: limiting.currentStock,
    limitingCategoryId: limiting.id,
    limitingCategoryName: limiting.name
  }
}

/**
 * Valida que haya stock disponible en las categorías para los productos del pedido
 * Considera la jerarquía completa - si un ancestro no tiene stock, bloquea
 * @param {string} tenantId - ID del tenant
 * @param {Array<{productId: string, quantity: number}>} items - Items del carrito
 * @returns {Promise<{valid: boolean, errors: string[]}>}
 */
export async function validateCategoryStock(tenantId, items) {
  ensureSupabase()
  
  const productIds = items.map(it => it.productId).filter(Boolean)
  if (productIds.length === 0) return { valid: true, errors: [] }
  
  // Obtener productos con su categoría y subcategoría
  const { data: products, error: prodError } = await supabase
    .from('products')
    .select('id, name, category, category_id, subcategory_id')
    .in('id', productIds)
  
  if (prodError || !products) {
    console.warn('Error obteniendo productos:', prodError)
    return { valid: true, errors: [] } // En caso de error, permitir (fail-open)
  }
  
  // Obtener TODAS las categorías del tenant (para navegación jerárquica)
  const { data: allCategories, error: catError } = await supabase
    .from('product_categories')
    .select('id, name, current_stock, max_stock, parent_id')
    .eq('tenant_id', tenantId)
  
  if (catError || !allCategories) {
    console.warn('Error obteniendo categorías:', catError)
    return { valid: true, errors: [] }
  }
  
  // Crear mapa de categoría por id y por nombre
  const categoryById = {}
  const categoryByName = {}
  allCategories.forEach(cat => {
    categoryById[cat.id] = cat
    categoryByName[cat.name.toLowerCase()] = cat
  })
  
  // Función para obtener todas las categorías ancestro con stock de un producto
  const getCategoriesWithStockForProduct = (product) => {
    const result = []
    // Determinar categoría directa del producto
    let startCategoryId = product.subcategory_id || product.category_id
    
    // Si no tiene ID, buscar por nombre
    if (!startCategoryId && product.category) {
      const catByName = categoryByName[product.category.toLowerCase()]
      if (catByName) startCategoryId = catByName.id
    }
    
    if (!startCategoryId) return result
    
    // Recorrer hacia arriba la jerarquía
    let currentId = startCategoryId
    while (currentId) {
      const cat = categoryById[currentId]
      if (!cat) break
      
      if (cat.max_stock !== null && cat.max_stock !== undefined) {
        result.push({
          id: cat.id,
          name: cat.name,
          currentStock: cat.current_stock || 0
        })
      }
      
      currentId = cat.parent_id
    }
    
    return result
  }
  
  // Acumular cantidades por categoría (considerando jerarquía)
  const categoryQuantities = {} // { categoryId: { name, requested, currentStock } }
  
  items.forEach(item => {
    const product = products.find(p => p.id === item.productId)
    if (!product) return
    
    const categoriesWithStock = getCategoriesWithStockForProduct(product)
    const qty = item.quantity || 1
    
    categoriesWithStock.forEach(cat => {
      if (!categoryQuantities[cat.id]) {
        categoryQuantities[cat.id] = {
          name: cat.name,
          currentStock: cat.currentStock,
          requested: 0
        }
      }
      categoryQuantities[cat.id].requested += qty
    })
  })
  
  // Validar stock de cada categoría
  const errors = []
  for (const [catId, info] of Object.entries(categoryQuantities)) {
    if (info.requested > info.currentStock) {
      errors.push(`Stock insuficiente de ${info.name}: quedan ${info.currentStock}, se pidieron ${info.requested}`)
    }
  }
  
  return { valid: errors.length === 0, errors }
}

/**
 * Decrementa el stock de categorías basándose en los productos vendidos
 * Ahora considera la jerarquía completa - decrementa stock de subcategoría Y ancestros
 * @param {string} tenantId - ID del tenant
 * @param {Array<{productId: string, quantity: number}>} items 
 */
export async function decrementCategoryStockByProducts(tenantId, items) {
  ensureSupabase()
  
  // Obtener la info de categoría de cada producto
  const productIds = items.map(it => it.productId).filter(Boolean)
  if (productIds.length === 0) {
    return []
  }
  
  const { data: products, error } = await supabase
    .from('products')
    .select('id, category, category_id, subcategory_id')
    .in('id', productIds)
  
  if (error || !products) {
    return []
  }
  
  // Obtener todas las categorías del tenant (para navegación jerárquica)
  const { data: categories, error: catError } = await supabase
    .from('product_categories')
    .select('id, name, parent_id')
    .eq('tenant_id', tenantId)
  
  if (catError || !categories) {
    return []
  }
  
  // Crear mapa id -> categoría y nombre -> id
  const categoryById = {}
  const categoryIdByName = {}
  categories.forEach(cat => {
    categoryById[cat.id] = cat
    categoryIdByName[cat.name.toLowerCase()] = cat.id
  })
  
  // Para cada producto, obtener la categoría de inicio (subcategory o category)
  // y agrupar cantidades
  const categoryQuantities = {} // { categoryId: quantity }
  
  items.forEach(item => {
    const product = products.find(p => p.id === item.productId)
    if (!product) return
    
    // Determinar la categoría más específica del producto
    let startCategoryId = product.subcategory_id || product.category_id
    
    // Si no tiene ID, buscar por nombre (legacy)
    if (!startCategoryId && product.category) {
      startCategoryId = categoryIdByName[product.category.toLowerCase()]
    }
    
    if (startCategoryId) {
      if (!categoryQuantities[startCategoryId]) {
        categoryQuantities[startCategoryId] = 0
      }
      categoryQuantities[startCategoryId] += item.quantity || 1
    }
  })
  
  // Decrementar stock jerárquicamente de cada categoría
  const allResults = []
  
  for (const [categoryId, quantity] of Object.entries(categoryQuantities)) {
    // decrementCategoryStock ahora decrementa jerárquicamente
    const results = await decrementCategoryStock(categoryId, quantity)
    allResults.push(...results)
  }
  
  return allResults
}
/**
 * Actualiza el estado de pago de una orden (usado por MercadoPago callback)
 * @param {string} orderId - ID de la orden
 * @param {Object} paymentData - Datos del pago
 * @param {string} paymentData.status - Nuevo estado de la orden
 * @param {string} paymentData.payment_status - Estado del pago MP (approved, pending, rejected)
 * @param {string} paymentData.mp_payment_id - ID del pago en MercadoPago
 * @returns {Promise<Object>}
 */
export async function updateOrderPaymentStatus(orderId, { status, payment_status, mp_payment_id }) {
  if (!isSupabaseConfigured) {
    // Mock mode - update localStorage
    const key = `mock_orders`
    try {
      const orders = JSON.parse(localStorage.getItem(key) || '[]')
      const idx = orders.findIndex(o => o.id === orderId)
      if (idx !== -1) {
        orders[idx].status = status
        orders[idx].payment_status = payment_status
        orders[idx].mp_payment_id = mp_payment_id
        orders[idx].updated_at = new Date().toISOString()
        localStorage.setItem(key, JSON.stringify(orders))
      }
      return orders[idx] || null
    } catch {
      return null
    }
  }

  const updateData = {
    status,
    updated_at: new Date().toISOString(),
  }

  // Solo agregar campos MP si no son undefined
  if (payment_status) {
    updateData.payment_status = payment_status
  }
  if (mp_payment_id) {
    updateData.mp_payment_id = mp_payment_id
  }

  const { data, error } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', orderId)
    .select()
    .single()

  if (error) {
    console.error('Error updating order payment status:', error)
    throw error
  }

  return data
}

/**
 * Marcar un pedido como pagado o no pagado
 * @param {string} orderId - ID del pedido
 * @param {boolean} isPaid - Estado de pago
 * @returns {Object} Pedido actualizado
 */
export async function markOrderAsPaid(orderId, isPaid = true) {
  ensureSupabase()

  const updateData = {
    is_paid: isPaid,
    paid_at: isPaid ? new Date().toISOString() : null
  }

  const { data, error } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', orderId)
    .select()
    .single()

  if (error) {
    console.error('Error marking order as paid:', error)
    throw error
  }

  return {
    ...data,
    is_paid: data.is_paid || false,
    paid_at: data.paid_at || null
  }
}

/**
 * Actualizar notas internas de un pedido
 * @param {string} orderId - ID del pedido
 * @param {string} notes - Notas internas
 * @returns {Object} Pedido actualizado
 */
export async function updateOrderNotes(orderId, notes) {
  ensureSupabase()

  const { data, error } = await supabase
    .from('orders')
    .update({ internal_notes: notes })
    .eq('id', orderId)
    .select()
    .single()

  if (error) {
    console.error('Error updating order notes:', error)
    throw error
  }

  return {
    ...data,
    internal_notes: data.internal_notes || ''
  }
}

/**
 * Actualiza los items de un pedido (elimina los existentes y crea nuevos)
 * @param {string} orderId - ID del pedido
 * @param {Array} items - Nuevos items del pedido
 * @param {number} newTotal - Nuevo total del pedido
 * @param {Array} originalItems - Items originales para calcular diferencia de stock
 * @returns {Object} Pedido actualizado con items
 */
export async function updateOrderItems(orderId, items, newTotal, originalItems = []) {
  ensureSupabase()

  // Calcular diferencia de stock (productos agregados)
  // Comparar items nuevos vs originales para saber qué productos se agregaron
  const stockToDecrement = []
  
  items.forEach(newItem => {
    const productId = newItem.product_id || newItem.productId
    if (!productId) return
    
    const newQty = newItem.quantity || newItem.qty || 1
    
    // Buscar si este producto existía en los items originales
    const originalItem = originalItems.find(oi => 
      (oi.product_id || oi.productId) === productId
    )
    const originalQty = originalItem ? (originalItem.quantity || originalItem.qty || 0) : 0
    
    // Si la cantidad aumentó, decrementar la diferencia
    const diff = newQty - originalQty
    if (diff > 0) {
      stockToDecrement.push({ productId, quantity: diff })
    }
  })

  // 1. Eliminar todos los items existentes del pedido
  const { error: deleteError } = await supabase
    .from('order_items')
    .delete()
    .eq('order_id', orderId)

  if (deleteError) {
    console.error('Error deleting order items:', deleteError)
    throw deleteError
  }

  // 2. Insertar los nuevos items
  const rows = items.map((it) => ({
    order_id: orderId,
    product_id: it.product_id || it.productId || null,
    name: it.product_name || it.name,
    unit_price: it.unit_price || it.price,
    qty: it.quantity || it.qty,
    line_total: (it.unit_price || it.price || 0) * (it.quantity || it.qty || 1),
    extras: it.extras || [],
    comment: it.comment || null,
  }))

  const { error: insertError } = await supabase
    .from('order_items')
    .insert(rows)

  if (insertError) {
    console.error('Error inserting order items:', insertError)
    throw insertError
  }

  // 3. Decrementar stock de productos agregados
  if (stockToDecrement.length > 0) {
    await decrementProductStock(stockToDecrement)
    
    // También decrementar stock global de categorías
    // Primero obtenemos el tenant_id del pedido
    const { data: orderInfo } = await supabase
      .from('orders')
      .select('tenant_id')
      .eq('id', orderId)
      .single()
    
    if (orderInfo?.tenant_id) {
      await decrementCategoryStockByProducts(orderInfo.tenant_id, stockToDecrement)
    }
  }

  // 4. Actualizar el total del pedido
  const { data, error: updateError } = await supabase
    .from('orders')
    .update({ total: newTotal })
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
      is_paid,
      paid_at,
      internal_notes,
      order_items (
        id,
        product_id,
        name,
        unit_price,
        qty,
        line_total,
        extras,
        comment
      )
    `)
    .single()

  if (updateError) {
    console.error('Error updating order total:', updateError)
    throw updateError
  }

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
    is_paid: data.is_paid || false,
    paid_at: data.paid_at || null,
    internal_notes: data.internal_notes || '',
    items: (data.order_items || []).map((item) => ({
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
      comment: item.comment || null,
    })),
  }
}