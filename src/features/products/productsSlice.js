import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { loadJson, saveJson } from '../../shared/storage'
import { createId } from '../../shared/ids'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import {
  deleteProductRow,
  fetchProductsByTenantId,
  insertProduct,
  updateProductRow,
} from '../../lib/supabaseApi'

const PERSIST_KEY = 'state.products'

const seed = isSupabaseConfigured
  ? {}
  : {
      tenant_demo: [
        {
          id: 'prod_demo_1',
          name: 'Hamburguesa clásica',
          price: 8.99,
          description: 'Carne, queso, lechuga, tomate',
          active: true,
        },
        {
          id: 'prod_demo_2',
          name: 'Papas fritas',
          price: 3.5,
          description: 'Crocantes y doradas',
          active: true,
        },
        {
          id: 'prod_demo_3',
          name: 'Hamburguesa BBQ',
          price: 10.49,
          description: 'Salsa BBQ, cebolla crispy, queso cheddar',
          active: true,
        },
        {
          id: 'prod_demo_4',
          name: 'Hamburguesa Doble',
          price: 12.99,
          description: 'Doble carne, doble queso, pepinillos',
          active: true,
        },
        {
          id: 'prod_demo_5',
          name: 'Hamburguesa Pollo Crunch',
          price: 9.99,
          description: 'Pollo crispy, mayo, lechuga',
          active: true,
        },
        {
          id: 'prod_demo_6',
          name: 'Aros de cebolla',
          price: 4.25,
          description: 'Porción mediana',
          active: true,
        },
        {
          id: 'prod_demo_7',
          name: 'Nuggets (8u)',
          price: 5.75,
          description: 'Incluye salsa',
          active: true,
        },
        {
          id: 'prod_demo_8',
          name: 'Refresco',
          price: 2.25,
          description: '350ml',
          active: true,
        },
        {
          id: 'prod_demo_9',
          name: 'Agua',
          price: 1.5,
          description: '500ml',
          active: true,
        },
        {
          id: 'prod_demo_10',
          name: 'Combo Clásico',
          price: 12.49,
          description: 'Hamburguesa clásica + papas + bebida',
          active: true,
        },
      ],
    }

const initialState = loadJson(PERSIST_KEY, {
  productsByTenantId: seed,
})

function persist(state) {
  saveJson(PERSIST_KEY, state)
}

export const fetchProductsForTenant = createAsyncThunk(
  'products/fetchProductsForTenant',
  async (tenantId) => {
    if (!isSupabaseConfigured) return null
    const rows = await fetchProductsByTenantId(tenantId)
    return { tenantId, rows }
  },
)

export const createProduct = createAsyncThunk(
  'products/createProduct',
  async ({ tenantId, product }) => {
    if (!isSupabaseConfigured) {
      const row = {
        id: createId('prod'),
        tenant_id: tenantId,
        name: product.name,
        price: product.price,
        description: product.description || null,
        image_url: product.imageUrl || null,
        active: product.active ?? true,
        category_id: product.categoryId || null,
        stock: product.stock ?? null,
        track_stock: product.trackStock ?? false,
        sort_order: product.sortOrder ?? 0,
      }
      return { tenantId, row }
    }
    const row = await insertProduct({
      tenantId,
      product: {
        name: product.name,
        price: product.price,
        description: product.description,
        imageUrl: product.imageUrl,
        active: product.active,
        categoryId: product.categoryId,
        stock: product.stock,
        trackStock: product.trackStock,
        sortOrder: product.sortOrder,
      },
    })
    return { tenantId, row }
  },
)

export const patchProduct = createAsyncThunk(
  'products/patchProduct',
  async ({ tenantId, productId, patch }) => {
    if (!isSupabaseConfigured) return { tenantId, productId, row: null, patch }
    const row = await updateProductRow({ tenantId, productId, patch })
    return { tenantId, productId, row }
  },
)

export const deleteProduct = createAsyncThunk(
  'products/deleteProduct',
  async ({ tenantId, productId }) => {
    if (!isSupabaseConfigured) return { tenantId, productId }
    await deleteProductRow({ tenantId, productId })
    return { tenantId, productId }
  },
)

const productsSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {
    addProduct(state, action) {
      const { tenantId, product } = action.payload
      if (!state.productsByTenantId[tenantId]) state.productsByTenantId[tenantId] = []
      state.productsByTenantId[tenantId].push({
        id: createId('prod'),
        active: true,
        ...product,
      })
      persist(state)
    },
    updateProduct(state, action) {
      const { tenantId, productId, patch } = action.payload
      const list = state.productsByTenantId[tenantId] || []
      const idx = list.findIndex((p) => p.id === productId)
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...patch }
        persist(state)
      }
    },
    removeProduct(state, action) {
      const { tenantId, productId } = action.payload
      const list = state.productsByTenantId[tenantId] || []
      state.productsByTenantId[tenantId] = list.filter((p) => p.id !== productId)
      persist(state)
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProductsForTenant.fulfilled, (state, action) => {
        if (!action.payload) return
        const { tenantId, rows } = action.payload
        if (!tenantId || !rows) return
        state.productsByTenantId[tenantId] = rows.map((r) => ({
          id: r.id,
          name: r.name,
          price: Number(r.price),
          description: r.description,
          imageUrl: r.image_url || null,
          active: r.active,
          categoryId: r.category_id || null,
          stock: r.stock,
          trackStock: r.track_stock ?? false,
          sortOrder: r.sort_order ?? 0,
        }))
        persist(state)
      })
      .addCase(createProduct.fulfilled, (state, action) => {
        const { tenantId, row } = action.payload
        if (!tenantId) return
        if (!state.productsByTenantId[tenantId]) state.productsByTenantId[tenantId] = []

        if (row) {
          state.productsByTenantId[tenantId].unshift({
            id: row.id,
            name: row.name,
            price: Number(row.price),
            description: row.description,
            imageUrl: row.image_url || null,
            active: row.active,
            categoryId: row.category_id || null,
            stock: row.stock,
            trackStock: row.track_stock ?? false,
            sortOrder: row.sort_order ?? 0,
          })
          persist(state)
        }
      })
      .addCase(patchProduct.fulfilled, (state, action) => {
        const { tenantId, productId, row, patch } = action.payload
        const list = state.productsByTenantId[tenantId] || []
        const idx = list.findIndex((p) => p.id === productId)
        if (idx < 0) return
        if (row) {
          list[idx] = {
            id: row.id,
            name: row.name,
            price: Number(row.price),
            description: row.description,
            imageUrl: row.image_url || null,
            active: row.active,
            categoryId: row.category_id || null,
            stock: row.stock,
            trackStock: row.track_stock ?? false,
            sortOrder: row.sort_order ?? 0,
          }
        } else {
          list[idx] = { ...list[idx], ...patch }
        }
        persist(state)
      })
      .addCase(deleteProduct.fulfilled, (state, action) => {
        const { tenantId, productId } = action.payload
        const list = state.productsByTenantId[tenantId] || []
        state.productsByTenantId[tenantId] = list.filter((p) => p.id !== productId)
        persist(state)
      })
  },
})

export const { addProduct, updateProduct, removeProduct } = productsSlice.actions

export const selectProductsForTenant = (tenantId) => (state) =>
  state.products.productsByTenantId[tenantId] || []

export default productsSlice.reducer
