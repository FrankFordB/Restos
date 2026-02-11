import { createAsyncThunk, createSlice, createSelector } from '@reduxjs/toolkit'
import { loadJson, saveJson } from '../../shared/storage'
import { createId } from '../../shared/ids'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import { createOrderWithItems, listOrdersByTenantId, updateOrderStatus, deleteOrder as deleteOrderApi, markOrderAsPaid, updateOrderNotes, updateOrderItems as updateOrderItemsApi } from '../../lib/supabaseOrdersApi'
import { fetchCategoriesForTenant } from '../categories/categoriesSlice'
import { fetchProductsForTenant } from '../products/productsSlice'

const PERSIST_KEY = 'state.orders'

// Array vacío constante para evitar crear nuevas referencias en selectores
const EMPTY_ORDERS = []

const initialState = loadJson(PERSIST_KEY, {
  ordersByTenantId: {},
})

function persist(state) {
  saveJson(PERSIST_KEY, state)
}

export const fetchOrdersForTenant = createAsyncThunk('orders/fetchOrdersForTenant', async (tenantId) => {
  if (!isSupabaseConfigured) return null
  const orders = await listOrdersByTenantId(tenantId)
  return { tenantId, orders }
})

export const createPaidOrder = createAsyncThunk(
  'orders/createPaidOrder',
  async ({ tenantId, items, total, customer, deliveryType, deliveryAddress, deliveryNotes, deliveryLat, deliveryLng, paymentMethod }, { dispatch, getState }) => {
    if (!isSupabaseConfigured) {
      // En modo MOCK, disparamos acción para restar stock localmente
      const stockUpdates = items
        .filter((it) => it.productId)
        .map((it) => ({
          productId: it.productId,
          quantity: it.qty || it.quantity || 1,
        }))
      
      // También calcular actualizaciones de stock de categoría
      const state = getState()
      const products = state.products?.productsByTenantId?.[tenantId] || []
      const categories = state.categories?.categoriesByTenantId?.[tenantId] || []
      
      // Agrupar por categoría
      const categoryQuantities = {}
      items.forEach(item => {
        if (item.productId) {
          const product = products.find(p => p.id === item.productId)
          if (product?.category) {
            const category = categories.find(c => c.name === product.category)
            if (category?.currentStock !== null && category?.currentStock !== undefined) {
              if (!categoryQuantities[category.id]) {
                categoryQuantities[category.id] = 0
              }
              categoryQuantities[category.id] += item.qty || item.quantity || 1
            }
          }
        }
      })
      
      const categoryStockUpdates = Object.entries(categoryQuantities).map(([categoryId, qty]) => ({
        categoryId,
        quantity: qty,
      }))
      
      return {
        tenantId,
        order: {
          id: createId('order'),
          tenantId,
          status: 'pending',
          total,
          currency: 'USD',
          created_at: new Date().toISOString(),
          customer_name: customer?.name || null,
          customer_phone: customer?.phone || null,
          delivery_type: deliveryType || 'mostrador',
          delivery_address: deliveryAddress || null,
          delivery_notes: deliveryNotes || null,
          delivery_lat: deliveryLat || null,
          delivery_lng: deliveryLng || null,
          payment_method: paymentMethod || 'efectivo',
          items,
        },
        stockUpdates, // Para que el reducer pueda actualizar stock en MOCK
        categoryStockUpdates, // Para actualizar stock de categorías
      }
    }

    const created = await createOrderWithItems({ tenantId, items, total, customer, deliveryType, deliveryAddress, deliveryNotes, deliveryLat, deliveryLng, paymentMethod })
    
    // Recargar categorías y productos para reflejar el nuevo stock
    dispatch(fetchCategoriesForTenant(tenantId))
    dispatch(fetchProductsForTenant(tenantId))
    
    return { tenantId, order: created }
  },
)

export const updateOrder = createAsyncThunk(
  'orders/updateOrder',
  async ({ tenantId, orderId, newStatus }) => {
    if (!isSupabaseConfigured) {
      return { tenantId, orderId, newStatus, isLocal: true }
    }

    const updated = await updateOrderStatus(orderId, newStatus)
    return { tenantId, order: updated }
  },
)

export const deleteOrder = createAsyncThunk(
  'orders/deleteOrder',
  async ({ tenantId, orderId }) => {
    if (!isSupabaseConfigured) {
      return { tenantId, orderId, isLocal: true }
    }

    await deleteOrderApi(orderId)
    return { tenantId, orderId }
  },
)

export const markOrderPaid = createAsyncThunk(
  'orders/markOrderPaid',
  async ({ tenantId, orderId, isPaid = true }) => {
    if (!isSupabaseConfigured) {
      // Modo local: solo devolver para actualizar el state
      return { tenantId, orderId, isPaid, isLocal: true }
    }

    const updated = await markOrderAsPaid(orderId, isPaid)
    return { tenantId, order: updated }
  },
)

export const updateInternalNotes = createAsyncThunk(
  'orders/updateInternalNotes',
  async ({ tenantId, orderId, notes }) => {
    if (!isSupabaseConfigured) {
      // Modo local: solo devolver para actualizar el state
      return { tenantId, orderId, notes, isLocal: true }
    }

    const updated = await updateOrderNotes(orderId, notes)
    return { tenantId, order: updated }
  },
)

export const updateOrderItemsList = createAsyncThunk(
  'orders/updateOrderItemsList',
  async ({ tenantId, orderId, items, newTotal, originalItems }, { dispatch }) => {
    if (!isSupabaseConfigured) {
      // Modo local: actualizar items en memoria
      return { tenantId, orderId, items, newTotal, isLocal: true }
    }

    const updated = await updateOrderItemsApi(orderId, items, newTotal, originalItems)
    
    // Recargar categorías y productos para reflejar el nuevo stock
    dispatch(fetchCategoriesForTenant(tenantId))
    dispatch(fetchProductsForTenant(tenantId))
    
    return { tenantId, order: updated }
  },
)

const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchOrdersForTenant.fulfilled, (state, action) => {
        const payload = action.payload
        if (!payload) return
        const { tenantId, orders } = payload
        if (!tenantId || !orders) return
        state.ordersByTenantId[tenantId] = orders
        persist(state)
      })
      .addCase(createPaidOrder.fulfilled, (state, action) => {
        const { tenantId, order } = action.payload
        if (!tenantId || !order) return
        if (!state.ordersByTenantId[tenantId]) state.ordersByTenantId[tenantId] = []
        state.ordersByTenantId[tenantId].unshift(order)
        persist(state)
      })
      .addCase(updateOrder.fulfilled, (state, action) => {
        const { tenantId, order, orderId, newStatus, isLocal } = action.payload
        if (!tenantId) return
        if (!state.ordersByTenantId[tenantId]) return
        
        if (isLocal) {
          // Modo local: solo actualizar el status manteniendo los demás datos
          const index = state.ordersByTenantId[tenantId].findIndex((o) => o.id === orderId)
          if (index !== -1) {
            state.ordersByTenantId[tenantId][index] = {
              ...state.ordersByTenantId[tenantId][index],
              status: newStatus,
            }
          }
        } else if (order) {
          // Modo Supabase: reemplazar con el pedido actualizado de la BD
          const index = state.ordersByTenantId[tenantId].findIndex((o) => o.id === order.id)
          if (index !== -1) {
            state.ordersByTenantId[tenantId][index] = order
          }
        }
        persist(state)
      })
      .addCase(deleteOrder.fulfilled, (state, action) => {
        const { tenantId, orderId } = action.payload
        if (!tenantId || !orderId) return
        if (!state.ordersByTenantId[tenantId]) return
        
        state.ordersByTenantId[tenantId] = state.ordersByTenantId[tenantId].filter((o) => o.id !== orderId)
        persist(state)
      })
      .addCase(markOrderPaid.fulfilled, (state, action) => {
        const { tenantId, order, orderId, isPaid, isLocal } = action.payload
        if (!tenantId) return
        if (!state.ordersByTenantId[tenantId]) return
        
        if (isLocal) {
          // Modo local: actualizar is_paid y paid_at
          const index = state.ordersByTenantId[tenantId].findIndex((o) => o.id === orderId)
          if (index !== -1) {
            state.ordersByTenantId[tenantId][index] = {
              ...state.ordersByTenantId[tenantId][index],
              is_paid: isPaid,
              paid_at: isPaid ? new Date().toISOString() : null,
            }
          }
        } else if (order) {
          // Modo Supabase: reemplazar con el pedido actualizado
          const index = state.ordersByTenantId[tenantId].findIndex((o) => o.id === order.id)
          if (index !== -1) {
            state.ordersByTenantId[tenantId][index] = {
              ...state.ordersByTenantId[tenantId][index],
              ...order,
            }
          }
        }
        persist(state)
      })
      .addCase(updateInternalNotes.fulfilled, (state, action) => {
        const { tenantId, order, orderId, notes, isLocal } = action.payload
        if (!tenantId) return
        if (!state.ordersByTenantId[tenantId]) return
        
        if (isLocal) {
          // Modo local: actualizar internal_notes
          const index = state.ordersByTenantId[tenantId].findIndex((o) => o.id === orderId)
          if (index !== -1) {
            state.ordersByTenantId[tenantId][index] = {
              ...state.ordersByTenantId[tenantId][index],
              internal_notes: notes,
            }
          }
        } else if (order) {
          // Modo Supabase: reemplazar con el pedido actualizado
          const index = state.ordersByTenantId[tenantId].findIndex((o) => o.id === order.id)
          if (index !== -1) {
            state.ordersByTenantId[tenantId][index] = {
              ...state.ordersByTenantId[tenantId][index],
              internal_notes: order.internal_notes || '',
            }
          }
        }
        persist(state)
      })
      .addCase(updateOrderItemsList.fulfilled, (state, action) => {
        const { tenantId, order, orderId, items, newTotal, isLocal } = action.payload
        if (!tenantId) return
        if (!state.ordersByTenantId[tenantId]) return
        
        if (isLocal) {
          // Modo local: actualizar items y total
          const index = state.ordersByTenantId[tenantId].findIndex((o) => o.id === orderId)
          if (index !== -1) {
            state.ordersByTenantId[tenantId][index] = {
              ...state.ordersByTenantId[tenantId][index],
              items: items,
              total: newTotal,
            }
          }
        } else if (order) {
          // Modo Supabase: reemplazar con el pedido actualizado
          const index = state.ordersByTenantId[tenantId].findIndex((o) => o.id === order.id)
          if (index !== -1) {
            state.ordersByTenantId[tenantId][index] = order
          }
        }
        persist(state)
      })
  },
})

// Selector memoizado para evitar re-renders innecesarios
const selectOrdersByTenantId = (state) => state.orders.ordersByTenantId

const ordersSelectorCache = new Map()
export const selectOrdersForTenant = (tenantId) => {
  if (!ordersSelectorCache.has(tenantId)) {
    ordersSelectorCache.set(
      tenantId,
      createSelector(
        [selectOrdersByTenantId],
        (ordersByTenantId) => ordersByTenantId[tenantId] || EMPTY_ORDERS
      )
    )
  }
  return ordersSelectorCache.get(tenantId)
}

export default ordersSlice.reducer
