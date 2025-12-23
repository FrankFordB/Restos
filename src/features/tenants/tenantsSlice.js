import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { loadJson, saveJson } from '../../shared/storage'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import { createTenant as sbCreateTenant, fetchTenantBySlug as sbFetchTenantBySlug, listTenants as sbListTenants } from '../../lib/supabaseApi'

const PERSIST_KEY = 'state.tenants'

const initialState = loadJson(PERSIST_KEY, {
  tenants: [
    {
      id: 'tenant_demo',
      slug: 'demo-burgers',
      name: 'Demo Burgers',
    },
  ],
})

function persist(state) {
  saveJson(PERSIST_KEY, state)
}

export const fetchTenants = createAsyncThunk('tenants/fetchTenants', async () => {
  if (!isSupabaseConfigured) return null
  const tenants = await sbListTenants()
  return tenants
})

export const fetchTenantBySlug = createAsyncThunk('tenants/fetchTenantBySlug', async (slug) => {
  if (!isSupabaseConfigured) return null
  const tenant = await sbFetchTenantBySlug(slug)
  return tenant
})

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
        const tenant = action.payload
        if (!tenant) return
        const idx = state.tenants.findIndex((t) => t.id === tenant.id)
        if (idx >= 0) state.tenants[idx] = tenant
        else state.tenants.push(tenant)
        persist(state)
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

export default tenantsSlice.reducer
