import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { loadJson, saveJson } from '../../shared/storage'
import { createId } from '../../shared/ids'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import { createOrderWithItems, listOrdersByTenantId } from '../../lib/supabaseOrdersApi'

const PERSIST_KEY = 'state.orders'

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
  async ({ tenantId, items, total, customer }) => {
    if (!isSupabaseConfigured) {
      return {
        tenantId,
        order: {
          id: createId('order'),
          tenantId,
          status: 'paid',
          total,
          currency: 'USD',
          createdAt: new Date().toISOString(),
          customerName: customer?.name || null,
          customerPhone: customer?.phone || null,
          items,
        },
      }
    }

    const created = await createOrderWithItems({ tenantId, items, total, customer })
    return { tenantId, order: created }
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
  },
})

export const selectOrdersForTenant = (tenantId) => (state) => state.orders.ordersByTenantId[tenantId] || []

export default ordersSlice.reducer
