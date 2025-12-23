import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { loadJson, saveJson } from '../../shared/storage'
import { mockRegister, mockSignIn } from './mockAuth'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import {
  fetchProfile,
  supabaseSignIn,
  supabaseSignUp,
  createTenant as sbCreateTenant,
  upsertProfile,
} from '../../lib/supabaseApi'
import { ROLES } from '../../shared/constants'

const PERSIST_KEY = 'state.auth'

const initialState = loadJson(PERSIST_KEY, {
  status: 'anonymous',
  user: null,
  error: null,
  mode: 'mock',
  lastCreatedTenant: null,
})

function persist(state) {
  saveJson(PERSIST_KEY, state)
}

export const signInWithEmail = createAsyncThunk(
  'auth/signInWithEmail',
  async (payload) => {
    if (!isSupabaseConfigured) {
      const user = mockSignIn(payload)
      return user
    }

    const { data } = await supabaseSignIn(payload)
    const authed = data.user
    if (!authed) throw new Error('No se pudo iniciar sesión')

    const profile = await fetchProfile(authed.id)
    if (!profile) {
      // perfil no creado aún (fallback)
      try {
        await upsertProfile({ userId: authed.id, role: ROLES.TENANT_ADMIN, tenantId: null })
      } catch {
        // ignore (policies/triggers not installed)
      }
      return {
        id: authed.id,
        email: authed.email,
        role: ROLES.TENANT_ADMIN,
        tenantId: null,
      }
    }

    return {
      id: profile.user_id,
      email: authed.email,
      role: profile.role,
      tenantId: profile.tenant_id,
    }
  },
)

export const registerWithEmail = createAsyncThunk(
  'auth/registerWithEmail',
  async (payload) => {
    if (!isSupabaseConfigured) {
      const { user, createdTenant } = mockRegister(payload)
      return { user, createdTenant }
    }

    const { email, password, tenantName } = payload
    if (!email || !password) throw new Error('Email y password son requeridos')
    if (!tenantName || !tenantName.trim()) throw new Error('Nombre del restaurante es requerido')
    const { data } = await supabaseSignUp({ email, password })

    // Si Auth requiere confirmación de email, Supabase crea el usuario pero NO entrega sesión.
    // Sin sesión, no podrás insertar tenant/profile/product por RLS.
    if (data?.user && !data?.session) {
      throw new Error(
        'Se creó el usuario, pero Supabase no devolvió sesión (probable email confirmation activado). Confirma el email y luego inicia sesión, o desactiva Email Confirmation en Supabase Auth para desarrollo.',
      )
    }

    // Si Supabase tiene email confirmation activo, puede no devolver sesión inmediata.
    // Para desarrollo, se recomienda desactivar confirmación; si no, el usuario debe confirmar email.
    const authed = data.user
    if (!authed) {
      throw new Error('No se pudo crear el usuario en Supabase')
    }

    const createdTenant = await sbCreateTenant({
      name: tenantName.trim(),
      slug: tenantName
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, ''),
      ownerUserId: authed.id,
    })

    // Asegura que el perfil tenga tenant_id para que RLS permita operar productos/tema
    try {
      await upsertProfile({
        userId: authed.id,
        role: ROLES.TENANT_ADMIN,
        tenantId: createdTenant?.id || null,
      })
    } catch {
      // ignore (policies/triggers not installed)
    }

    return {
      user: {
        id: authed.id,
        email,
        role: ROLES.TENANT_ADMIN,
        tenantId: createdTenant?.id || null,
      },
      createdTenant,
    }
  },
)

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearAuthError(state) {
      state.error = null
    },
    signOut(state) {
      state.status = 'anonymous'
      state.user = null
      state.error = null
      state.lastCreatedTenant = null
      persist(state)
    },
    setMode(state, action) {
      state.mode = action.payload
      persist(state)
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(signInWithEmail.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(signInWithEmail.fulfilled, (state, action) => {
        state.status = 'authenticated'
        state.user = action.payload
        state.error = null
        persist(state)
      })
      .addCase(signInWithEmail.rejected, (state, action) => {
        state.status = 'anonymous'
        state.user = null
        state.error = action.error?.message || 'Error al iniciar sesión'
        persist(state)
      })
      .addCase(registerWithEmail.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(registerWithEmail.fulfilled, (state, action) => {
        state.status = 'authenticated'
        state.user = action.payload.user
        state.lastCreatedTenant = action.payload.createdTenant
        state.error = null
        persist(state)
      })
      .addCase(registerWithEmail.rejected, (state, action) => {
        state.status = 'anonymous'
        state.user = null
        state.lastCreatedTenant = null
        state.error = action.error?.message || 'Error al registrarse'
        persist(state)
      })
  },
})

export const {
  clearAuthError,
  signOut,
  setMode,
} = authSlice.actions

export const selectAuth = (state) => state.auth
export const selectUser = (state) => state.auth.user
export const selectIsAuthed = (state) => state.auth.status === 'authenticated'

export default authSlice.reducer
