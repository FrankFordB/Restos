import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { loadJson, saveJson } from '../../shared/storage'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import {
  createTenant as sbCreateTenant,
  fetchTenantBySlug as sbFetchTenantBySlug,
  listPublicTenants as sbListPublicTenants,
  listTenants as sbListTenants,
} from '../../lib/supabaseApi'

const PERSIST_KEY = 'state.tenants'

const defaultState = {
  tenants: isSupabaseConfigured
    ? []
    : [
        {
          id: 'tenant_demo',
          slug: 'demo-burgers',
          name: 'Demo Burgers',
          isPublic: true,
        },
      ],
  statusBySlug: {},
  errorBySlug: {},
}

const loadedState = loadJson(PERSIST_KEY, defaultState)

const initialState = {
  ...loadedState,
  tenants: (loadedState?.tenants || []).map((t) => ({
    ...t,
    isPublic: t?.isPublic !== false,
  })),
}

function persist(state) {
  saveJson(PERSIST_KEY, state)
}

export const fetchTenants = createAsyncThunk('tenants/fetchTenants', async () => {
  if (!isSupabaseConfigured) return null
  // Para la landing/Home queremos solo los públicos.
  // Para paneles admin se usa el estado local + endpoints específicos de admin.
  const tenants = await sbListPublicTenants()
  return (tenants || []).map((t) => ({
    ...t,
    isPublic: t?.is_public !== false,
  }))
})

export const fetchTenantBySlug = createAsyncThunk(
  'tenants/fetchTenantBySlug',
  async (slug, { rejectWithValue }) => {
    if (!isSupabaseConfigured) {
      return rejectWithValue('Supabase no está configurado en este deploy')
    }
    try {
      const tenant = await sbFetchTenantBySlug(slug)
      return tenant
    } catch (e) {
      const msg = e?.message ? String(e.message) : 'Error cargando tenant'
      return rejectWithValue(msg)
    }
  },
)

export const createTenant = createAsyncThunk('tenants/createTenant', async ({ name, slug, ownerUserId }) => {
  if (!isSupabaseConfigured) return null
  const tenant = await sbCreateTenant({ name, slug, ownerUserId })
  return tenant
})

const tenantsSlice = createSlice({
  name: 'tenants',
  initialState,
  reducers: {
    addTenant(state, action) {
      state.tenants.push(action.payload)
      persist(state)
    },
    setTenants(state, action) {
      state.tenants = action.payload
      persist(state)
    },
    upsertTenant(state, action) {
      const tenant = action.payload
      const idx = state.tenants.findIndex((t) => t.id === tenant.id)
      if (idx >= 0) state.tenants[idx] = tenant
      else state.tenants.push(tenant)
      persist(state)
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTenants.fulfilled, (state, action) => {
        if (!action.payload) return
        state.tenants = action.payload
        persist(state)
      })
      .addCase(fetchTenantBySlug.fulfilled, (state, action) => {
        const slug = action.meta.arg
        state.statusBySlug[slug] = action.payload ? 'success' : 'not_found'
        state.errorBySlug[slug] = null

        const tenant = action.payload
        if (!tenant) return
        if (tenant && 'is_public' in tenant && !('isPublic' in tenant)) {
          tenant.isPublic = tenant.is_public !== false
        }
        const idx = state.tenants.findIndex((t) => t.id === tenant.id)
        if (idx >= 0) state.tenants[idx] = tenant
        else state.tenants.push(tenant)
        persist(state)
      })
      .addCase(fetchTenantBySlug.pending, (state, action) => {
        const slug = action.meta.arg
        state.statusBySlug[slug] = 'loading'
        state.errorBySlug[slug] = null
      })
      .addCase(fetchTenantBySlug.rejected, (state, action) => {
        const slug = action.meta.arg
        state.statusBySlug[slug] = 'error'
        state.errorBySlug[slug] = action.payload || action.error?.message || 'Error cargando tenant'
      })
      .addCase(createTenant.fulfilled, (state, action) => {
        const tenant = action.payload
        if (!tenant) return
        state.tenants.push(tenant)
        persist(state)
      })
  },
})

export const { addTenant, setTenants, upsertTenant } = tenantsSlice.actions

export const selectTenants = (state) => state.tenants.tenants
export const selectTenantBySlug = (slug) => (state) =>
  state.tenants.tenants.find((t) => t.slug === slug)

export const selectTenantFetchStatus = (slug) => (state) => state.tenants.statusBySlug?.[slug] || 'idle'
export const selectTenantFetchError = (slug) => (state) => state.tenants.errorBySlug?.[slug] || null

export default tenantsSlice.reducer
