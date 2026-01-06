import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { loadJson, saveJson } from '../../shared/storage'
import { mockRegister, mockSignIn } from './mockAuth'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import {
  fetchProfile,
  supabaseSignIn,
  supabaseSignUp,
  createTenant as sbCreateTenant,
  fetchTenantByOwnerUserId,
  upsertProfile,
  supabaseResetPasswordForEmail,
  generateUniqueSlug,
} from '../../lib/supabaseApi'
import { getMFAFactors, getCurrentUser } from '../../lib/supabaseAuth'
import { ROLES } from '../../shared/constants'

const PERSIST_KEY = 'state.auth'

const initialState = loadJson(PERSIST_KEY, {
  status: 'anonymous',
  user: null,
  error: null,
  mode: 'mock',
  lastCreatedTenant: null,
  adminManagedTenantId: null,
  bannedInfo: null,
  welcomeInfo: null,
  mfaRequired: false,
  mfaFactors: [],
  pendingAuthData: null,
})

function persist(state) {
  saveJson(PERSIST_KEY, state)
}

export const signInWithEmail = createAsyncThunk(
  'auth/signInWithEmail',
  async (payload, thunkAPI) => {
    if (!isSupabaseConfigured) {
      const user = mockSignIn(payload)
      return { user, mfaRequired: false }
    }

    const data = await supabaseSignIn(payload)
    const authed = data.user
    if (!authed) throw new Error('No se pudo iniciar sesión')

    // Check if MFA is required
    try {
      const { totp } = await getMFAFactors()
      if (totp && totp.length > 0) {
        // MFA is enabled, return pending state
        return thunkAPI.fulfillWithValue({
          mfaRequired: true,
          mfaFactors: totp,
          pendingUser: {
            id: authed.id,
            email: authed.email,
          },
        })
      }
    } catch {
      // No MFA configured, continue normal login
    }

    const profile = await fetchProfile(authed.id)
    if (!profile) {
      // perfil no creado aún (fallback)
      try {
        await upsertProfile({ userId: authed.id, role: ROLES.TENANT_ADMIN, tenantId: null })
      } catch {
        // ignore (policies/triggers not installed)
      }
      return {
        user: {
          id: authed.id,
          email: authed.email,
          role: ROLES.TENANT_ADMIN,
          tenantId: null,
        },
        mfaRequired: false,
      }
    }

    // Si el perfil existe pero no tiene tenant asignado, intentamos auto-recuperar
    // el tenant del que el usuario es owner (evita quedarse bloqueado en dashboard).
    if (!profile.tenant_id) {
      try {
        const owned = await fetchTenantByOwnerUserId(authed.id)
        if (owned?.id) {
          const updated = await upsertProfile({ userId: authed.id, role: profile.role, tenantId: owned.id })
          return {
            user: {
              id: updated.user_id,
              email: authed.email,
              role: updated.role,
              tenantId: updated.tenant_id,
            },
            mfaRequired: false,
          }
        }
      } catch {
        // ignore: si falla, mantenemos tenantId null
      }
    }

    if (profile.account_status === 'cancelled') {
      return thunkAPI.rejectWithValue({
        code: 'ACCOUNT_CANCELLED',
        email: authed.email,
        message: 'Tu cuenta está baneada por no respetar nuestros términos y condiciones.',
      })
    }

    return {
      user: {
        id: profile.user_id,
        email: authed.email,
        role: profile.role,
        tenantId: profile.tenant_id,
        accountStatus: profile.account_status,
        premiumUntil: profile.premium_until,
        premiumSource: profile.premium_source,
      },
      mfaRequired: false,
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

    const { email, password, tenantName, fromOAuth, userId } = payload
    
    let authed
    
    // Handle OAuth users (already authenticated, just need to create tenant)
    if (fromOAuth && userId) {
      authed = { id: userId, email }
    } else {
      // Regular email/password registration
      if (!email || !password) throw new Error('Email y password son requeridos')
      if (!tenantName || !tenantName.trim()) throw new Error('Nombre del restaurante es requerido')
      const data = await supabaseSignUp({ email, password })

      // Si Auth requiere confirmación de email, Supabase crea el usuario pero NO entrega sesión.
      // Sin sesión, no podrás insertar tenant/profile/product por RLS.
      if (data?.user && !data?.session) {
        throw new Error(
          'Se creó el usuario, pero Supabase no devolvió sesión (probable email confirmation activado). Confirma el email y luego inicia sesión, o desactiva Email Confirmation en Supabase Auth para desarrollo.',
        )
      }

      // Si Supabase tiene email confirmation activo, puede no devolver sesión inmediata.
      // Para desarrollo, se recomienda desactivar confirmación; si no, el usuario debe confirmar email.
      authed = data.user
      if (!authed) {
        throw new Error('No se pudo crear el usuario en Supabase')
      }
    }
    
    if (!tenantName || !tenantName.trim()) throw new Error('Nombre del restaurante es requerido')

    // Nuevo comportamiento: al registrarse, SIEMPRE queda como rol "user".
    // Puede crear su restaurante, pero no tiene permisos admin hasta que el super_admin lo promueva.
    let createdTenant = null
    try {
      // Generar slug base y asegurar que sea único
      const baseSlug = tenantName
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
      
      const uniqueSlug = await generateUniqueSlug(baseSlug)
      
      createdTenant = await sbCreateTenant({
        name: tenantName.trim(),
        slug: uniqueSlug,
        ownerUserId: authed.id,
      })
    } catch (err) {
      // Si RLS bloquea creación para rol user, igual dejamos creado el user.
      console.error('Error creando tenant:', err)
      createdTenant = null
    }

    // Update profile with tenant_id if tenant was created
    // For OAuth users, they already exist, so we update; for new users, we upsert
    const finalRole = createdTenant ? ROLES.TENANT_ADMIN : ROLES.USER
    const finalTenantId = createdTenant?.id || null
    
    try {
      await upsertProfile({ userId: authed.id, role: finalRole, tenantId: finalTenantId })
    } catch {
      // ignore (policies/triggers not installed)
    }

    return {
      user: {
        id: authed.id,
        email,
        role: finalRole,
        tenantId: finalTenantId,
      },
      createdTenant,
    }
  },
)

export const requestPasswordReset = createAsyncThunk(
  'auth/requestPasswordReset',
  async ({ email, redirectTo }, thunk) => {
    try {
      await supabaseResetPasswordForEmail({ email, redirectTo })
      return true
    } catch (e) {
      return thunk.rejectWithValue(e?.message ? String(e.message) : 'No se pudo enviar el email de recuperación')
    }
  },
)

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearAuthError(state) {
      state.error = null
      state.welcomeInfo = null
    },
    signOut(state) {
      state.status = 'anonymous'
      state.user = null
      state.error = null
      state.lastCreatedTenant = null
      state.adminManagedTenantId = null
      state.bannedInfo = null
      state.welcomeInfo = null
      state.mfaRequired = false
      state.mfaFactors = []
      state.pendingAuthData = null
      persist(state)
    },
    setMode(state, action) {
      state.mode = action.payload
      persist(state)
    },
    setTenantId(state, action) {
      const tenantId = action.payload || null
      if (state.user) {
        state.user = { ...state.user, tenantId }
        persist(state)
      }
    },
    setUserRole(state, action) {
      const role = action.payload || null
      if (state.user) {
        state.user = { ...state.user, role }
        persist(state)
      }
    },
    setAdminManagedTenantId(state, action) {
      state.adminManagedTenantId = action.payload || null
      persist(state)
    },
    clearBannedInfo(state) {
      state.bannedInfo = null
      persist(state)
    },
    clearWelcomeInfo(state) {
      state.welcomeInfo = null
      persist(state)
    },
    // MFA actions
    setMFARequired(state, action) {
      state.mfaRequired = action.payload.required
      state.mfaFactors = action.payload.factors || []
      state.pendingAuthData = action.payload.pendingData || null
      persist(state)
    },
    completeMFAVerification(state, action) {
      state.status = 'authenticated'
      state.user = action.payload
      state.mfaRequired = false
      state.mfaFactors = []
      state.pendingAuthData = null
      state.welcomeInfo = {
        message: '¡Bienvenido! Verificación de dos factores completada.',
      }
      persist(state)
    },
    cancelMFA(state) {
      state.status = 'anonymous'
      state.mfaRequired = false
      state.mfaFactors = []
      state.pendingAuthData = null
      persist(state)
    },
    // OAuth action
    setUserFromOAuth(state, action) {
      const session = action.payload
      if (session?.user) {
        state.status = 'authenticated'
        state.user = {
          id: session.user.id,
          email: session.user.email,
          role: session.user.user_metadata?.role || ROLES.USER,
          tenantId: session.user.user_metadata?.tenant_id || null,
          provider: session.user.app_metadata?.provider || 'email',
        }
        state.error = null
        state.welcomeInfo = {
          message: '¡Bienvenido! Has iniciado sesión con Google.',
        }
        persist(state)
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(signInWithEmail.pending, (state) => {
        state.status = 'loading'
        state.error = null
        state.bannedInfo = null
        state.welcomeInfo = null
        state.mfaRequired = false
        state.mfaFactors = []
      })
      .addCase(signInWithEmail.fulfilled, (state, action) => {
        // Check if MFA is required
        if (action.payload.mfaRequired) {
          state.status = 'mfa_required'
          state.mfaRequired = true
          state.mfaFactors = action.payload.mfaFactors
          state.pendingAuthData = action.payload.pendingUser
          state.error = null
          persist(state)
          return
        }
        
        state.status = 'authenticated'
        state.user = action.payload.user
        state.error = null
        state.bannedInfo = null
        state.mfaRequired = false
        state.mfaFactors = []
        state.pendingAuthData = null
        state.welcomeInfo = {
          message:
            '¡Bienvenido! Ahora puedes crear y administrar tu restaurante, personalizar su estilo, cargar productos y gestionar tus pedidos desde el panel.',
        }
        persist(state)
      })
      .addCase(signInWithEmail.rejected, (state, action) => {
        state.status = 'anonymous'
        state.user = null
        if (action.payload?.code === 'ACCOUNT_CANCELLED') {
          state.error = null
          state.bannedInfo = {
            message:
              action.payload.message ||
              'Tu cuenta está baneada por no respetar nuestros términos y condiciones.',
            email: action.payload.email || null,
          }
          state.welcomeInfo = null
        } else {
          state.error = action.payload?.message || action.error?.message || 'Error al iniciar sesión'
          state.bannedInfo = null
          state.welcomeInfo = null
        }
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

      .addCase(requestPasswordReset.pending, (state) => {
        state.error = null
      })
      .addCase(requestPasswordReset.fulfilled, (state) => {
        state.error = null
      })
      .addCase(requestPasswordReset.rejected, (state, action) => {
        state.error = action.payload || action.error?.message || 'No se pudo enviar el email de recuperación'
      })
  },
})

export const {
  clearAuthError,
  signOut,
  setMode,
  setTenantId,
  setUserRole,
  setAdminManagedTenantId,
  clearBannedInfo,
  clearWelcomeInfo,
  setMFARequired,
  completeMFAVerification,
  cancelMFA,
  setUserFromOAuth,
} = authSlice.actions

export const selectAuth = (state) => state.auth
export const selectUser = (state) => state.auth.user
export const selectAdminManagedTenantId = (state) => state.auth.adminManagedTenantId
export const selectMFARequired = (state) => state.auth.mfaRequired
export const selectMFAFactors = (state) => state.auth.mfaFactors
export const selectIsAuthed = (state) => state.auth.status === 'authenticated'

export default authSlice.reducer
