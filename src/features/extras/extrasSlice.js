import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { loadJson, saveJson } from '../../shared/storage'
import { createId } from '../../shared/ids'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import {
  fetchExtrasByTenantId,
  insertExtra,
  updateExtraRow,
  deleteExtraRow,
  fetchExtraGroupsByTenantId,
  insertExtraGroup,
  updateExtraGroupRow,
  deleteExtraGroupRow,
} from '../../lib/supabaseApi'

const PERSIST_KEY = 'state.extras'
const PERSIST_KEY_GROUPS = 'state.extraGroups'

// Seed data for MOCK mode
const seedGroups = isSupabaseConfigured
  ? {}
  : {
      tenant_demo: [
        {
          id: 'group_demo_1',
          name: 'Elige tus salsas',
          description: 'Seleccione hasta 6 opciones',
          minSelections: 0,
          maxSelections: 6,
          isRequired: false,
          sortOrder: 0,
          active: true,
        },
        {
          id: 'group_demo_2',
          name: 'Elige los toppings',
          description: 'Seleccione hasta 10 opciones',
          minSelections: 0,
          maxSelections: 10,
          isRequired: false,
          sortOrder: 1,
          active: true,
        },
        {
          id: 'group_demo_3',
          name: 'Tipo de carne',
          description: 'Seleccione mínimo 1 opción',
          minSelections: 1,
          maxSelections: 1,
          isRequired: true,
          sortOrder: 2,
          active: true,
        },
      ],
    }

const seedExtras = isSupabaseConfigured
  ? {}
  : {
      tenant_demo: [
        // Salsas (simple extras - click to add)
        { id: 'extra_1', groupId: 'group_demo_1', name: 'Salsa BBQ', description: 'Salsa base de tomate ahumada', price: 500, sortOrder: 0, active: true, options: [] },
        { id: 'extra_2', groupId: 'group_demo_1', name: 'Salsa Thousand Island', description: 'Base de mayonesa, ketchup y mostaza', price: 500, sortOrder: 1, active: true, options: [] },
        { id: 'extra_3', groupId: 'group_demo_1', name: 'Salsa Picante Suave', description: 'Base de ketchup, picante leve', price: 500, sortOrder: 2, active: true, options: [] },
        { id: 'extra_4', groupId: 'group_demo_1', name: 'Lágrima del Diablo', description: 'Jalapeño y cayena - MUY PICANTE', price: 600, sortOrder: 3, active: true, options: [] },
        // Toppings (simple extras - click to add)
        { id: 'extra_5', groupId: 'group_demo_2', name: 'Extra Carne', description: 'Medallón adicional de 110g', price: 3500, sortOrder: 0, active: true, options: [] },
        { id: 'extra_6', groupId: 'group_demo_2', name: 'Extra Bacon', description: 'Tiras de bacon crocante', price: 2400, sortOrder: 1, active: true, options: [] },
        { id: 'extra_7', groupId: 'group_demo_2', name: 'Extra Cheddar', description: 'Queso cheddar derretido', price: 2200, sortOrder: 2, active: true, options: [] },
        { id: 'extra_8', groupId: 'group_demo_2', name: 'Extra Huevo', description: 'Huevo frito', price: 1000, sortOrder: 3, active: true, options: [] },
        { id: 'extra_9', groupId: 'group_demo_2', name: 'Cebolla Caramelizada', description: 'Cebolla caramelizada dulce', price: 2000, sortOrder: 4, active: true, options: [] },
        // Tipo de carne (select type - choose one option)
        { id: 'extra_10', groupId: 'group_demo_3', name: 'Carne de Res', description: 'Medallón clásico 110g', price: 0, sortOrder: 0, active: true, options: [] },
        { id: 'extra_11', groupId: 'group_demo_3', name: 'Pollo Crispy', description: 'Pechuga empanizada crocante', price: 0, sortOrder: 1, active: true, options: [] },
        { id: 'extra_12', groupId: 'group_demo_3', name: 'Veggie', description: 'Medallón vegetal de garbanzos', price: 0, sortOrder: 2, active: true, options: [] },
        // Extra con opciones - Gaseosa (select one variant)
        { 
          id: 'extra_13', 
          groupId: 'group_demo_2', 
          name: 'Gaseosa', 
          description: 'Elige tu bebida favorita', 
          price: 0, 
          sortOrder: 5, 
          active: true, 
          hasOptions: true,
          options: [
            { id: 'opt_1', label: 'Coca-Cola', price: 2500 },
            { id: 'opt_2', label: 'Sprite', price: 2500 },
            { id: 'opt_3', label: 'Fanta Naranja', price: 2500 },
            { id: 'opt_4', label: 'Coca-Cola Zero', price: 2800 },
          ]
        },
      ],
    }

const initialState = {
  extrasByTenantId: loadJson(PERSIST_KEY, seedExtras),
  groupsByTenantId: loadJson(PERSIST_KEY_GROUPS, seedGroups),
}

function persist(state) {
  saveJson(PERSIST_KEY, state.extrasByTenantId)
  saveJson(PERSIST_KEY_GROUPS, state.groupsByTenantId)
}

// =====================
// ASYNC THUNKS - GROUPS
// =====================

export const fetchExtraGroupsForTenant = createAsyncThunk(
  'extras/fetchExtraGroupsForTenant',
  async (tenantId) => {
    if (!isSupabaseConfigured) return null
    try {
      const rows = await fetchExtraGroupsByTenantId(tenantId)
      return { tenantId, rows }
    } catch (err) {
      console.warn('Error fetching extra groups (table may not exist):', err.message)
      return null
    }
  },
)

export const createExtraGroup = createAsyncThunk(
  'extras/createExtraGroup',
  async ({ tenantId, group }) => {
    const row = {
      id: createId('grp'),
      tenant_id: tenantId,
      name: group.name,
      description: group.description || null,
      min_selections: group.minSelections ?? 0,
      max_selections: group.maxSelections ?? 10,
      is_required: group.isRequired ?? false,
      sort_order: group.sortOrder ?? 0,
      active: group.active ?? true,
    }
    if (!isSupabaseConfigured) {
      return { tenantId, row }
    }
    try {
      const insertedRow = await insertExtraGroup({ tenantId, group })
      return { tenantId, row: insertedRow }
    } catch (err) {
      console.warn('Error creating extra group (table may not exist):', err.message)
      // Return local row as fallback
      return { tenantId, row }
    }
  },
)

export const patchExtraGroup = createAsyncThunk(
  'extras/patchExtraGroup',
  async ({ tenantId, groupId, patch }) => {
    if (!isSupabaseConfigured) return { tenantId, groupId, row: null, patch }
    const row = await updateExtraGroupRow({ tenantId, groupId, patch })
    return { tenantId, groupId, row }
  },
)

export const deleteExtraGroup = createAsyncThunk(
  'extras/deleteExtraGroup',
  async ({ tenantId, groupId }) => {
    if (!isSupabaseConfigured) return { tenantId, groupId }
    await deleteExtraGroupRow({ tenantId, groupId })
    return { tenantId, groupId }
  },
)

// =====================
// ASYNC THUNKS - EXTRAS
// =====================

export const fetchExtrasForTenant = createAsyncThunk(
  'extras/fetchExtrasForTenant',
  async (tenantId) => {
    if (!isSupabaseConfigured) return null
    try {
      const rows = await fetchExtrasByTenantId(tenantId)
      return { tenantId, rows }
    } catch (err) {
      console.warn('Error fetching extras (table may not exist):', err.message)
      return null
    }
  },
)

export const createExtra = createAsyncThunk(
  'extras/createExtra',
  async ({ tenantId, extra }) => {
    const row = {
      id: createId('ext'),
      tenant_id: tenantId,
      group_id: extra.groupId,
      name: extra.name,
      description: extra.description || null,
      price: extra.price ?? 0,
      sort_order: extra.sortOrder ?? 0,
      active: extra.active ?? true,
      has_options: extra.hasOptions ?? false,
      options: extra.options || [],
    }
    if (!isSupabaseConfigured) {
      return { tenantId, row }
    }
    try {
      const insertedRow = await insertExtra({ tenantId, extra })
      return { tenantId, row: insertedRow }
    } catch (err) {
      console.warn('Error creating extra (table may not exist):', err.message)
      // Return local row as fallback
      return { tenantId, row }
    }
  },
)

export const patchExtra = createAsyncThunk(
  'extras/patchExtra',
  async ({ tenantId, extraId, patch }) => {
    if (!isSupabaseConfigured) return { tenantId, extraId, row: null, patch }
    const row = await updateExtraRow({ tenantId, extraId, patch })
    return { tenantId, extraId, row }
  },
)

export const deleteExtra = createAsyncThunk(
  'extras/deleteExtra',
  async ({ tenantId, extraId }) => {
    if (!isSupabaseConfigured) return { tenantId, extraId }
    await deleteExtraRow({ tenantId, extraId })
    return { tenantId, extraId }
  },
)

// =====================
// SLICE
// =====================

const extrasSlice = createSlice({
  name: 'extras',
  initialState,
  reducers: {
    // Sync reducers for mock mode
    addExtraGroup(state, action) {
      const { tenantId, group } = action.payload
      if (!state.groupsByTenantId[tenantId]) state.groupsByTenantId[tenantId] = []
      state.groupsByTenantId[tenantId].push({
        id: createId('grp'),
        active: true,
        sortOrder: state.groupsByTenantId[tenantId].length,
        ...group,
      })
      persist(state)
    },
    updateExtraGroup(state, action) {
      const { tenantId, groupId, patch } = action.payload
      const list = state.groupsByTenantId[tenantId] || []
      const idx = list.findIndex((g) => g.id === groupId)
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...patch }
        persist(state)
      }
    },
    removeExtraGroup(state, action) {
      const { tenantId, groupId } = action.payload
      const list = state.groupsByTenantId[tenantId] || []
      state.groupsByTenantId[tenantId] = list.filter((g) => g.id !== groupId)
      // Also remove extras in that group
      const extras = state.extrasByTenantId[tenantId] || []
      state.extrasByTenantId[tenantId] = extras.filter((e) => e.groupId !== groupId)
      persist(state)
    },
    addExtra(state, action) {
      const { tenantId, extra } = action.payload
      if (!state.extrasByTenantId[tenantId]) state.extrasByTenantId[tenantId] = []
      state.extrasByTenantId[tenantId].push({
        id: createId('ext'),
        active: true,
        sortOrder: state.extrasByTenantId[tenantId].length,
        ...extra,
      })
      persist(state)
    },
    updateExtra(state, action) {
      const { tenantId, extraId, patch } = action.payload
      const list = state.extrasByTenantId[tenantId] || []
      const idx = list.findIndex((e) => e.id === extraId)
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...patch }
        persist(state)
      }
    },
    removeExtra(state, action) {
      const { tenantId, extraId } = action.payload
      const list = state.extrasByTenantId[tenantId] || []
      state.extrasByTenantId[tenantId] = list.filter((e) => e.id !== extraId)
      persist(state)
    },
  },
  extraReducers: (builder) => {
    builder
      // Groups
      .addCase(fetchExtraGroupsForTenant.fulfilled, (state, action) => {
        if (!action.payload) return
        const { tenantId, rows } = action.payload
        if (!tenantId || !rows) return
        state.groupsByTenantId[tenantId] = rows.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          minSelections: r.min_selections ?? 0,
          maxSelections: r.max_selections ?? 10,
          isRequired: r.is_required ?? false,
          sortOrder: r.sort_order ?? 0,
          active: r.active,
        }))
        persist(state)
      })
      .addCase(createExtraGroup.fulfilled, (state, action) => {
        const { tenantId, row } = action.payload
        if (!tenantId) return
        if (!state.groupsByTenantId[tenantId]) state.groupsByTenantId[tenantId] = []
        const newGroup = {
          id: row.id,
          name: row.name,
          description: row.description,
          minSelections: row.min_selections ?? 0,
          maxSelections: row.max_selections ?? 10,
          isRequired: row.is_required ?? false,
          sortOrder: row.sort_order ?? 0,
          active: row.active ?? true,
        }
        state.groupsByTenantId[tenantId].push(newGroup)
        persist(state)
      })
      .addCase(patchExtraGroup.fulfilled, (state, action) => {
        const { tenantId, groupId, row, patch } = action.payload
        const list = state.groupsByTenantId[tenantId] || []
        const idx = list.findIndex((g) => g.id === groupId)
        if (idx >= 0) {
          if (row) {
            list[idx] = {
              id: row.id,
              name: row.name,
              description: row.description,
              minSelections: row.min_selections ?? 0,
              maxSelections: row.max_selections ?? 10,
              isRequired: row.is_required ?? false,
              sortOrder: row.sort_order ?? 0,
              active: row.active,
            }
          } else if (patch) {
            list[idx] = { ...list[idx], ...patch }
          }
          persist(state)
        }
      })
      .addCase(deleteExtraGroup.fulfilled, (state, action) => {
        const { tenantId, groupId } = action.payload
        const list = state.groupsByTenantId[tenantId] || []
        state.groupsByTenantId[tenantId] = list.filter((g) => g.id !== groupId)
        // Also remove extras in that group
        const extras = state.extrasByTenantId[tenantId] || []
        state.extrasByTenantId[tenantId] = extras.filter((e) => e.groupId !== groupId)
        persist(state)
      })
      // Extras
      .addCase(fetchExtrasForTenant.fulfilled, (state, action) => {
        if (!action.payload) return
        const { tenantId, rows } = action.payload
        if (!tenantId || !rows) return
        state.extrasByTenantId[tenantId] = rows.map((r) => ({
          id: r.id,
          groupId: r.group_id,
          name: r.name,
          description: r.description,
          price: r.price ?? 0,
          sortOrder: r.sort_order ?? 0,
          active: r.active,
          hasOptions: r.has_options ?? false,
          options: r.options || [],
        }))
        persist(state)
      })
      .addCase(createExtra.fulfilled, (state, action) => {
        const { tenantId, row } = action.payload
        if (!tenantId) return
        if (!state.extrasByTenantId[tenantId]) state.extrasByTenantId[tenantId] = []
        const newExtra = {
          id: row.id,
          groupId: row.group_id,
          name: row.name,
          description: row.description,
          price: row.price ?? 0,
          sortOrder: row.sort_order ?? 0,
          active: row.active ?? true,
          hasOptions: row.has_options ?? false,
          options: row.options || [],
        }
        state.extrasByTenantId[tenantId].push(newExtra)
        persist(state)
      })
      .addCase(patchExtra.fulfilled, (state, action) => {
        const { tenantId, extraId, row, patch } = action.payload
        const list = state.extrasByTenantId[tenantId] || []
        const idx = list.findIndex((e) => e.id === extraId)
        if (idx >= 0) {
          if (row) {
            list[idx] = {
              id: row.id,
              groupId: row.group_id,
              name: row.name,
              description: row.description,
              price: row.price ?? 0,
              sortOrder: row.sort_order ?? 0,
              active: row.active,
              hasOptions: row.has_options ?? false,
              options: row.options || [],
            }
          } else if (patch) {
            list[idx] = { ...list[idx], ...patch }
          }
          persist(state)
        }
      })
      .addCase(deleteExtra.fulfilled, (state, action) => {
        const { tenantId, extraId } = action.payload
        const list = state.extrasByTenantId[tenantId] || []
        state.extrasByTenantId[tenantId] = list.filter((e) => e.id !== extraId)
        persist(state)
      })
  },
})

export const {
  addExtraGroup,
  updateExtraGroup,
  removeExtraGroup,
  addExtra,
  updateExtra,
  removeExtra,
} = extrasSlice.actions

// Selectors
export const selectExtrasForTenant = (tenantId) => (state) =>
  state.extras.extrasByTenantId[tenantId] || []

export const selectExtraGroupsForTenant = (tenantId) => (state) =>
  state.extras.groupsByTenantId[tenantId] || []

export default extrasSlice.reducer
