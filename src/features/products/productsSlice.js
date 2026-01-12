import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { createSelector } from 'reselect'
import { loadJson, saveJson } from '../../shared/storage'
import { createId } from '../../shared/ids'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import {
  deleteProductRow,
  fetchProductsByTenantId,
  insertProduct,
  updateProductRow,
} from '../../lib/supabaseApi'
import { setCategoryHasProducts } from '../categories/categoriesSlice'

const PERSIST_KEY = 'state.products'

const seed = isSupabaseConfigured
  ? {}
  : {
      tenant_demo: [
        {
          id: 'prod_demo_1',
          name: 'Hamburguesa clásica',
          price: 8.99,
          cost: 4.50,
          description: 'Carne, queso, lechuga, tomate',
          category: 'Hamburguesas',
          stock: 50,
          active: true,
        },
        {
          id: 'prod_demo_2',
          name: 'Papas fritas',
          price: 3.5,
          cost: 1.20,
          description: 'Crocantes y doradas',
          category: 'Acompañamientos',
          stock: 100,
          active: true,
        },
        {
          id: 'prod_demo_3',
          name: 'Hamburguesa BBQ',
          price: 10.49,
          cost: 5.00,
          description: 'Salsa BBQ, cebolla crispy, queso cheddar',
          category: 'Hamburguesas',
          stock: 30,
          active: true,
        },
        {
          id: 'prod_demo_4',
          name: 'Hamburguesa Doble',
          price: 12.99,
          cost: 6.50,
          description: 'Doble carne, doble queso, pepinillos',
          category: 'Hamburguesas',
          stock: 25,
          active: true,
        },
        {
          id: 'prod_demo_5',
          name: 'Hamburguesa Pollo Crunch',
          price: 9.99,
          cost: 4.80,
          description: 'Pollo crispy, mayo, lechuga',
          category: 'Hamburguesas',
          stock: 40,
          active: true,
        },
        {
          id: 'prod_demo_6',
          name: 'Aros de cebolla',
          price: 4.25,
          cost: 1.50,
          description: 'Porción mediana',
          category: 'Acompañamientos',
          stock: 80,
          active: true,
        },
        {
          id: 'prod_demo_7',
          name: 'Nuggets (8u)',
          price: 5.75,
          cost: 2.20,
          description: 'Incluye salsa',
          category: 'Acompañamientos',
          stock: 60,
          active: true,
        },
        {
          id: 'prod_demo_8',
          name: 'Refresco',
          price: 2.25,
          cost: 0.80,
          description: '350ml',
          category: 'Bebidas',
          stock: 200,
          active: true,
        },
        {
          id: 'prod_demo_9',
          name: 'Agua',
          price: 1.5,
          cost: 0.40,
          description: '500ml',
          category: 'Bebidas',
          stock: 150,
          active: true,
        },
        {
          id: 'prod_demo_10',
          name: 'Combo Clásico',
          price: 12.49,
          cost: 6.00,
          description: 'Hamburguesa clásica + papas + bebida',
          category: 'Combos',
          stock: 20,
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
  async ({ tenantId, product }, { getState, dispatch }) => {
    // Validar reglas de carpetas
    const state = getState()
    const categories = state.categories?.categoriesByTenantId?.[tenantId] || []
    
    // Determinar la categoría destino
    const targetCategoryId = product.subcategoryId || product.categoryId
    
    if (targetCategoryId) {
      const targetCategory = categories.find(c => c.id === targetCategoryId)
      
      // Verificar si la categoría tiene subcategorías (no puede recibir productos)
      if (targetCategory?.hasChildren) {
        throw new Error('No puedes agregar productos a una categoría que tiene subcategorías. Los productos solo pueden estar en el último nivel.')
      }
      
      // Verificar manualmente si tiene hijos
      const hasChildren = categories.some(c => c.parentId === targetCategoryId)
      if (hasChildren) {
        throw new Error('No puedes agregar productos a una categoría que tiene subcategorías. Los productos solo pueden estar en el último nivel.')
      }
    }
    
    if (!isSupabaseConfigured) {
      const row = {
        id: createId('prod'),
        tenant_id: tenantId,
        name: product.name || 'Producto sin nombre',
        price: product.price ?? 0,
        description: product.description || null,
        image_url: product.imageUrl || null,
        focal_point: product.focalPoint || null,
        category: product.category || null,
        category_id: product.categoryId || null,
        subcategory_id: product.subcategoryId || null,
        cost_price: product.costPrice ?? null,
        stock: product.stock ?? null,
        active: product.active ?? true,
        product_extras: product.productExtras || [],
      }
      
      // Actualizar hasProducts de la categoría
      if (targetCategoryId) {
        dispatch(setCategoryHasProducts({ tenantId, categoryId: targetCategoryId, hasProducts: true }))
      }
      
      return { tenantId, row }
    }
    const row = await insertProduct({ tenantId, product })
    
    // Actualizar hasProducts de la categoría (BD lo hace con trigger, pero actualizamos Redux también)
    if (targetCategoryId) {
      dispatch(setCategoryHasProducts({ tenantId, categoryId: targetCategoryId, hasProducts: true }))
    }
    
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
          focalPoint: r.focal_point || null,
          category: r.category || null,
          categoryId: r.category_id || null,
          subcategoryId: r.subcategory_id || null,
          costPrice: r.cost_price != null ? Number(r.cost_price) : null,
          stock: r.stock ?? null,
          active: r.active,
          productExtras: r.product_extras || [],
          discount: r.discount ?? null,
          hasSizes: r.has_sizes ?? false,
          sizeRequired: r.size_required ?? true,
          sizes: r.sizes || [],
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
            focalPoint: row.focal_point || null,
            category: row.category || null,
            categoryId: row.category_id || null,
            subcategoryId: row.subcategory_id || null,
            costPrice: row.cost_price != null ? Number(row.cost_price) : null,
            stock: row.stock ?? null,
            active: row.active,
            productExtras: row.product_extras || [],
            discount: row.discount ?? null,
            hasSizes: row.has_sizes ?? false,
            sizeRequired: row.size_required ?? true,
            sizes: row.sizes || [],
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
          // Keep productExtras from existing product if not in response
          const existingProductExtras = list[idx].productExtras
          list[idx] = {
            id: row.id,
            name: row.name,
            price: Number(row.price),
            description: row.description,
            imageUrl: row.image_url || null,
            focalPoint: row.focal_point || null,
            category: row.category || null,
            categoryId: row.category_id || null,
            subcategoryId: row.subcategory_id || null,
            costPrice: row.cost_price != null ? Number(row.cost_price) : null,
            stock: row.stock ?? null,
            active: row.active,
            productExtras: row.product_extras || existingProductExtras || [],
            discount: row.discount ?? null,
            hasSizes: row.has_sizes ?? false,
            sizeRequired: row.size_required ?? true,
            sizes: row.sizes || [],
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

const EMPTY_ARRAY = []
const selectProductsByTenantId = (state) => state.products.productsByTenantId

const selectorCache = new Map()
export const selectProductsForTenant = (tenantId) => {
  if (!selectorCache.has(tenantId)) {
    selectorCache.set(
      tenantId,
      createSelector(
        [selectProductsByTenantId],
        (productsByTenantId) => productsByTenantId[tenantId] || EMPTY_ARRAY
      )
    )
  }
  return selectorCache.get(tenantId)
}

export default productsSlice.reducer
