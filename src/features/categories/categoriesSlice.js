import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { createSelector } from 'reselect'
import { loadJson, saveJson } from '../../shared/storage'
import { createId } from '../../shared/ids'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import {
  fetchCategoriesByTenantId,
  insertCategory,
  updateCategoryRow,
  deleteCategoryRow,
} from '../../lib/supabaseApi'

const PERSIST_KEY = 'state.categories'

const seed = isSupabaseConfigured
  ? {}
  : {
      tenant_demo: [
        {
          id: 'cat_demo_1',
          name: 'Hamburguesas',
          description: 'Las mejores hamburguesas',
          sortOrder: 0,
          active: true,
        },
        {
          id: 'cat_demo_2',
          name: 'Acompañamientos',
          description: 'Papas, aros y más',
          sortOrder: 1,
          active: true,
        },
        {
          id: 'cat_demo_3',
          name: 'Bebidas',
          description: 'Refrescos y agua',
          sortOrder: 2,
          active: true,
        },
        {
          id: 'cat_demo_4',
          name: 'Combos',
          description: 'Ofertas especiales',
          sortOrder: 3,
          active: true,
        },
      ],
    }

const initialState = loadJson(PERSIST_KEY, {
  categoriesByTenantId: seed,
})

function persist(state) {
  saveJson(PERSIST_KEY, state)
}

export const fetchCategoriesForTenant = createAsyncThunk(
  'categories/fetchCategoriesForTenant',
  async (tenantId) => {
    if (!isSupabaseConfigured) return null
    const rows = await fetchCategoriesByTenantId(tenantId)
    return { tenantId, rows }
  },
)

export const createCategory = createAsyncThunk(
  'categories/createCategory',
  async ({ tenantId, category }) => {
    if (!isSupabaseConfigured) {
      const row = {
        id: createId('cat'),
        tenant_id: tenantId,
        name: category.name,
        description: category.description || null,
        sort_order: category.sortOrder ?? 0,
        active: category.active ?? true,
      }
      return { tenantId, row }
    }
    const row = await insertCategory({ tenantId, category })
    return { tenantId, row }
  },
)

export const patchCategory = createAsyncThunk(
  'categories/patchCategory',
  async ({ tenantId, categoryId, patch }) => {
    if (!isSupabaseConfigured) return { tenantId, categoryId, row: null, patch }
    const row = await updateCategoryRow({ tenantId, categoryId, patch })
    return { tenantId, categoryId, row }
  },
)

export const deleteCategory = createAsyncThunk(
  'categories/deleteCategory',
  async ({ tenantId, categoryId }) => {
    if (!isSupabaseConfigured) return { tenantId, categoryId }
    await deleteCategoryRow({ tenantId, categoryId })
    return { tenantId, categoryId }
  },
)

const categoriesSlice = createSlice({
  name: 'categories',
  initialState,
  reducers: {
    addCategory(state, action) {
      const { tenantId, category } = action.payload
      if (!state.categoriesByTenantId[tenantId]) state.categoriesByTenantId[tenantId] = []
      state.categoriesByTenantId[tenantId].push({
        id: createId('cat'),
        active: true,
        sortOrder: state.categoriesByTenantId[tenantId].length,
        ...category,
      })
      persist(state)
    },
    updateCategory(state, action) {
      const { tenantId, categoryId, patch } = action.payload
      const list = state.categoriesByTenantId[tenantId] || []
      const idx = list.findIndex((c) => c.id === categoryId)
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...patch }
        persist(state)
      }
    },
    removeCategory(state, action) {
      const { tenantId, categoryId } = action.payload
      const list = state.categoriesByTenantId[tenantId] || []
      state.categoriesByTenantId[tenantId] = list.filter((c) => c.id !== categoryId)
      persist(state)
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCategoriesForTenant.fulfilled, (state, action) => {
        if (!action.payload) return
        const { tenantId, rows } = action.payload
        if (!tenantId || !rows) return
        state.categoriesByTenantId[tenantId] = rows.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          sortOrder: r.sort_order ?? 0,
          active: r.active,
        }))
        persist(state)
      })
      .addCase(createCategory.fulfilled, (state, action) => {
        const { tenantId, row } = action.payload
        if (!tenantId) return
        if (!state.categoriesByTenantId[tenantId]) state.categoriesByTenantId[tenantId] = []

        if (row) {
          state.categoriesByTenantId[tenantId].push({
            id: row.id,
            name: row.name,
            description: row.description,
            sortOrder: row.sort_order ?? 0,
            active: row.active,
          })
          persist(state)
        }
      })
      .addCase(patchCategory.fulfilled, (state, action) => {
        const { tenantId, categoryId, row, patch } = action.payload
        const list = state.categoriesByTenantId[tenantId] || []
        const idx = list.findIndex((c) => c.id === categoryId)
        if (idx < 0) return
        if (row) {
          list[idx] = {
            id: row.id,
            name: row.name,
            description: row.description,
            sortOrder: row.sort_order ?? 0,
            active: row.active,
          }
        } else {
          list[idx] = { ...list[idx], ...patch }
        }
        persist(state)
      })
      .addCase(deleteCategory.fulfilled, (state, action) => {
        const { tenantId, categoryId } = action.payload
        const list = state.categoriesByTenantId[tenantId] || []
        state.categoriesByTenantId[tenantId] = list.filter((c) => c.id !== categoryId)
        persist(state)
      })
  },
})

export const { addCategory, updateCategory, removeCategory } = categoriesSlice.actions

const EMPTY_ARRAY = []
const selectCategoriesByTenantId = (state) => state.categories?.categoriesByTenantId

const selectorCache = new Map()
export const selectCategoriesForTenant = (tenantId) => {
  if (!selectorCache.has(tenantId)) {
    selectorCache.set(
      tenantId,
      createSelector(
        [selectCategoriesByTenantId],
        (categoriesByTenantId) => categoriesByTenantId?.[tenantId] || EMPTY_ARRAY
      )
    )
  }
  return selectorCache.get(tenantId)
}

export default categoriesSlice.reducer
