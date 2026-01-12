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
          shortDescription: 'Burgers artesanales',
          imageUrl: null,
          sortOrder: 0,
          active: true,
          maxStock: null,
          currentStock: null,
          parentId: null,
          level: 0,
          hasProducts: true,
          hasChildren: false,
        },
        {
          id: 'cat_demo_2',
          name: 'Acompañamientos',
          description: 'Papas, aros y más',
          shortDescription: 'Sides deliciosos',
          imageUrl: null,
          sortOrder: 1,
          active: true,
          maxStock: null,
          currentStock: null,
          parentId: null,
          level: 0,
          hasProducts: true,
          hasChildren: false,
        },
        {
          id: 'cat_demo_3',
          name: 'Bebidas',
          description: 'Refrescos y agua',
          shortDescription: 'Para refrescarte',
          imageUrl: null,
          sortOrder: 2,
          active: true,
          maxStock: null,
          currentStock: null,
          parentId: null,
          level: 0,
          hasProducts: true,
          hasChildren: false,
        },
        {
          id: 'cat_demo_4',
          name: 'Combos',
          description: 'Ofertas especiales',
          shortDescription: 'Los mejores precios',
          imageUrl: null,
          sortOrder: 3,
          active: true,
          maxStock: null,
          currentStock: null,
          parentId: null,
          level: 0,
          hasProducts: true,
          hasChildren: false,
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
  async ({ tenantId, category }, { getState }) => {
    // Validar reglas de carpetas
    const state = getState()
    const categories = state.categories?.categoriesByTenantId?.[tenantId] || []
    const products = state.products?.productsByTenantId?.[tenantId] || []
    
    // Si se intenta crear subcategoría, verificar que el padre no tenga productos
    if (category.parentId) {
      const parent = categories.find(c => c.id === category.parentId)
      
      // Verificar por flag hasProducts
      if (parent?.hasProducts) {
        throw new Error('Esta categoría ya tiene productos. No puedes crear subcategorías aquí.')
      }
      
      // Verificar también en los productos directamente (por si el flag no está sincronizado)
      const parentHasProducts = products.some(
        p => p.categoryId === category.parentId || 
             p.subcategoryId === category.parentId ||
             (p.category === parent?.name && !p.subcategoryId)
      )
      if (parentHasProducts) {
        throw new Error('Esta categoría ya tiene productos. No puedes crear subcategorías aquí.')
      }
    }
    
    if (!isSupabaseConfigured) {
      const parentCategory = category.parentId 
        ? categories.find(c => c.id === category.parentId) 
        : null
      
      const row = {
        id: createId('cat'),
        tenant_id: tenantId,
        name: category.name,
        description: category.description || null,
        short_description: category.shortDescription || null,
        sort_order: category.sortOrder ?? categories.filter(c => c.parentId === category.parentId).length,
        active: category.active ?? true,
        max_stock: category.maxStock ?? null,
        current_stock: category.maxStock ?? null,
        parent_id: category.parentId || null,
        level: category.parentId ? (parentCategory?.level ?? 0) + 1 : 0,
        path: null,
        image_url: category.imageUrl || null,
        icon: category.icon || null,
        has_products: false,
        has_children: false,
      }
      
      // Actualizar hasChildren del padre
      const shouldUpdateParent = category.parentId != null
      
      return { tenantId, row, updateParentId: shouldUpdateParent ? category.parentId : null }
    }
    const row = await insertCategory({ tenantId, category })
    return { tenantId, row, updateParentId: category.parentId || null }
  },
)

export const patchCategory = createAsyncThunk(
  'categories/patchCategory',
  async ({ tenantId, categoryId, patch }) => {
    if (!isSupabaseConfigured) {
      // Convertir snake_case a camelCase para modo local
      const localPatch = {}
      if ('name' in patch) localPatch.name = patch.name
      if ('description' in patch) localPatch.description = patch.description
      if ('sortOrder' in patch) localPatch.sortOrder = patch.sortOrder
      if ('sort_order' in patch) localPatch.sortOrder = patch.sort_order
      if ('active' in patch) localPatch.active = patch.active
      if ('max_stock' in patch) localPatch.maxStock = patch.max_stock
      if ('maxStock' in patch) localPatch.maxStock = patch.maxStock
      if ('current_stock' in patch) localPatch.currentStock = patch.current_stock
      if ('currentStock' in patch) localPatch.currentStock = patch.currentStock
      return { tenantId, categoryId, row: null, patch: localPatch }
    }
    const row = await updateCategoryRow({ tenantId, categoryId, patch })
    return { tenantId, categoryId, row }
  },
)

export const decrementCategoryStock = createAsyncThunk(
  'categories/decrementCategoryStock',
  async ({ tenantId, categoryName, quantity }, { getState }) => {
    // Buscar la categoría por nombre
    const state = getState()
    const categories = state.categories?.categoriesByTenantId?.[tenantId] || []
    const category = categories.find(c => c.name === categoryName)
    
    if (!category || category.currentStock === null) {
      return { tenantId, categoryId: null, newStock: null }
    }
    
    const newStock = Math.max(0, (category.currentStock || 0) - quantity)
    
    if (!isSupabaseConfigured) {
      return { tenantId, categoryId: category.id, newStock }
    }
    
    await updateCategoryRow({ tenantId, categoryId: category.id, patch: { current_stock: newStock } })
    return { tenantId, categoryId: category.id, newStock }
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

// Helper para mapear row de BD a objeto del estado
function mapCategoryRow(r) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    shortDescription: r.short_description ?? null,
    sortOrder: r.sort_order ?? 0,
    active: r.active,
    maxStock: r.max_stock ?? null,
    currentStock: r.current_stock ?? null,
    // Campos de subcategorías
    parentId: r.parent_id ?? null,
    level: r.level ?? 0,
    path: r.path ?? r.id,
    imageUrl: r.image_url ?? null,
    icon: r.icon ?? null,
    // Reglas tipo carpetas
    hasProducts: r.has_products ?? false,
    hasChildren: r.has_children ?? false,
  }
}

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
        parentId: null,
        level: 0,
        path: null,
        imageUrl: null,
        icon: null,
        shortDescription: null,
        hasProducts: false,
        hasChildren: false,
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
    // Actualizar hasProducts de una categoría
    setCategoryHasProducts(state, action) {
      const { tenantId, categoryId, hasProducts } = action.payload
      const list = state.categoriesByTenantId[tenantId] || []
      const idx = list.findIndex((c) => c.id === categoryId)
      if (idx >= 0) {
        list[idx] = { ...list[idx], hasProducts }
        persist(state)
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCategoriesForTenant.fulfilled, (state, action) => {
        if (!action.payload) return
        const { tenantId, rows } = action.payload
        if (!tenantId || !rows) return
        state.categoriesByTenantId[tenantId] = rows.map(mapCategoryRow)
        persist(state)
      })
      .addCase(createCategory.fulfilled, (state, action) => {
        const { tenantId, row, updateParentId } = action.payload
        if (!tenantId) return
        if (!state.categoriesByTenantId[tenantId]) state.categoriesByTenantId[tenantId] = []

        if (row) {
          state.categoriesByTenantId[tenantId].push(mapCategoryRow(row))
          
          // Actualizar hasChildren del padre si existe
          if (updateParentId) {
            const list = state.categoriesByTenantId[tenantId]
            const parentIdx = list.findIndex(c => c.id === updateParentId)
            if (parentIdx >= 0) {
              list[parentIdx] = { ...list[parentIdx], hasChildren: true }
            }
          }
          
          persist(state)
        }
      })
      .addCase(patchCategory.fulfilled, (state, action) => {
        const { tenantId, categoryId, row, patch } = action.payload
        const list = state.categoriesByTenantId[tenantId] || []
        const idx = list.findIndex((c) => c.id === categoryId)
        if (idx < 0) return
        if (row) {
          list[idx] = mapCategoryRow(row)
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
      .addCase(decrementCategoryStock.fulfilled, (state, action) => {
        const { tenantId, categoryId, newStock } = action.payload
        if (!categoryId) return
        const list = state.categoriesByTenantId[tenantId] || []
        const idx = list.findIndex((c) => c.id === categoryId)
        if (idx >= 0) {
          list[idx] = { ...list[idx], currentStock: newStock }
          persist(state)
        }
      })
  },
})

export const { addCategory, updateCategory, removeCategory, setCategoryHasProducts } = categoriesSlice.actions

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

// Selector: Categorías raíz (sin parent)
const rootCategoriesCache = new Map()
export const selectRootCategories = (tenantId) => {
  if (!rootCategoriesCache.has(tenantId)) {
    rootCategoriesCache.set(
      tenantId,
      createSelector(
        [selectCategoriesForTenant(tenantId)],
        (categories) => categories.filter(c => c.parentId === null || c.parentId === undefined)
      )
    )
  }
  return rootCategoriesCache.get(tenantId)
}

// Selector: Subcategorías de una categoría específica
export const selectChildCategories = (tenantId, parentId) => {
  return createSelector(
    [selectCategoriesForTenant(tenantId)],
    (categories) => categories.filter(c => c.parentId === parentId)
  )
}

// Selector: Obtener categoría por ID
export const selectCategoryById = (tenantId, categoryId) => {
  return createSelector(
    [selectCategoriesForTenant(tenantId)],
    (categories) => categories.find(c => c.id === categoryId) || null
  )
}

// Selector: Breadcrumb de una categoría (ruta hasta raíz)
export const selectCategoryBreadcrumb = (tenantId, categoryId) => {
  return createSelector(
    [selectCategoriesForTenant(tenantId)],
    (categories) => {
      const breadcrumb = []
      let current = categories.find(c => c.id === categoryId)
      
      while (current) {
        breadcrumb.unshift(current)
        current = current.parentId 
          ? categories.find(c => c.id === current.parentId) 
          : null
      }
      
      return breadcrumb
    }
  )
}

// Selector: Árbol de categorías completo (estructura anidada)
export const selectCategoryTree = (tenantId) => {
  return createSelector(
    [selectCategoriesForTenant(tenantId)],
    (categories) => {
      // Construir árbol recursivamente
      const buildTree = (parentId = null) => {
        return categories
          .filter(c => c.parentId === parentId)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(category => ({
            ...category,
            children: buildTree(category.id)
          }))
      }
      
      return buildTree()
    }
  )
}

// Selector: Verificar si una categoría tiene hijos
export const selectCategoryHasChildren = (tenantId, categoryId) => {
  return createSelector(
    [selectCategoriesForTenant(tenantId)],
    (categories) => categories.some(c => c.parentId === categoryId)
  )
}

// Selector: Obtener todos los descendientes de una categoría
export const selectCategoryDescendants = (tenantId, categoryId) => {
  return createSelector(
    [selectCategoriesForTenant(tenantId)],
    (categories) => {
      const descendants = []
      const findDescendants = (parentId) => {
        categories
          .filter(c => c.parentId === parentId)
          .forEach(child => {
            descendants.push(child)
            findDescendants(child.id)
          })
      }
      findDescendants(categoryId)
      return descendants
    }
  )
}

// =============================================
// SELECTORES PARA REGLAS DE CARPETAS
// =============================================

// Selector: Verificar si una categoría puede recibir productos
// (solo si NO tiene subcategorías)
export const selectCanCategoryHaveProducts = (tenantId, categoryId) => {
  return createSelector(
    [selectCategoriesForTenant(tenantId)],
    (categories) => {
      const category = categories.find(c => c.id === categoryId)
      if (!category) return false
      
      // Si ya tiene flag hasChildren, usarlo
      if (category.hasChildren) return false
      
      // Verificar manualmente si tiene hijos
      const hasChildren = categories.some(c => c.parentId === categoryId)
      return !hasChildren
    }
  )
}

// Selector: Verificar si una categoría puede tener subcategorías
// (solo si NO tiene productos)
export const selectCanCategoryHaveChildren = (tenantId, categoryId) => {
  return createSelector(
    [selectCategoriesForTenant(tenantId)],
    (categories) => {
      const category = categories.find(c => c.id === categoryId)
      if (!category) return false
      
      // Si ya tiene flag hasProducts, no puede tener hijos
      return !category.hasProducts
    }
  )
}

// Selector: Obtener categorías donde se pueden agregar productos (hojas)
// Solo categorías activas que no tienen subcategorías
export const selectLeafCategories = (tenantId) => {
  return createSelector(
    [selectCategoriesForTenant(tenantId)],
    (categories) => {
      return categories.filter(c => {
        // Solo activas
        if (!c.active) return false
        // No debe tener hijos
        if (c.hasChildren) return false
        // Verificar manualmente
        const hasChildren = categories.some(child => child.parentId === c.id)
        return !hasChildren
      })
    }
  )
}

// Selector: Obtener categorías con su estado de reglas
export const selectCategoriesWithRules = (tenantId) => {
  return createSelector(
    [selectCategoriesForTenant(tenantId)],
    (categories) => {
      return categories.map(c => {
        const hasChildren = c.hasChildren || categories.some(child => child.parentId === c.id)
        const hasProducts = c.hasProducts
        
        return {
          ...c,
          hasChildren,
          hasProducts,
          canHaveProducts: !hasChildren,
          canHaveChildren: !hasProducts,
        }
      })
    }
  )
}

export default categoriesSlice.reducer
