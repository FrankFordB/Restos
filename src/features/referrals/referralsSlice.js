import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import {
  getReferralConfig,
  getOrCreateReferralCode,
  getReferralStats,
  getReferralUses,
  getReferralRewards,
  applyReferralReward,
  validateReferralCode,
  generateReferralUrl,
  REFERRAL_STATUS,
  REWARD_STATUS,
} from '../../lib/supabaseReferralApi'

// ============================================================================
// ESTADO INICIAL
// ============================================================================

const initialState = {
  // Configuración global
  config: null,
  configStatus: 'idle',
  configError: null,

  // Código del tenant actual
  code: null,
  codeStatus: 'idle',
  codeError: null,

  // Estadísticas
  stats: null,
  statsStatus: 'idle',
  statsError: null,

  // Lista de referidos
  referrals: [],
  referralsStatus: 'idle',
  referralsError: null,

  // Recompensas
  rewards: [],
  rewardsStatus: 'idle',
  rewardsError: null,

  // Aplicación de recompensa
  applyingRewardId: null,
  applyRewardStatus: 'idle',
  applyRewardError: null,

  // Validación de código (para registro)
  validatedCode: null,
  validateCodeStatus: 'idle',
  validateCodeError: null,
}

// ============================================================================
// THUNKS
// ============================================================================

/**
 * Obtiene la configuración del sistema de referidos
 */
export const fetchReferralConfig = createAsyncThunk(
  'referrals/fetchConfig',
  async (_, { rejectWithValue }) => {
    try {
      const config = await getReferralConfig()
      return config
    } catch (error) {
      return rejectWithValue(error.message || 'Error al obtener configuración')
    }
  }
)

/**
 * Obtiene o crea el código de referido del tenant
 */
export const fetchOrCreateReferralCode = createAsyncThunk(
  'referrals/fetchOrCreateCode',
  async ({ tenantId, userId }, { rejectWithValue }) => {
    try {
      const result = await getOrCreateReferralCode(tenantId, userId)
      return result
    } catch (error) {
      return rejectWithValue(error.message || 'Error al obtener código de referido')
    }
  }
)

/**
 * Obtiene las estadísticas de referidos del tenant
 */
export const fetchReferralStats = createAsyncThunk(
  'referrals/fetchStats',
  async (tenantId, { rejectWithValue }) => {
    try {
      const stats = await getReferralStats(tenantId)
      return stats
    } catch (error) {
      return rejectWithValue(error.message || 'Error al obtener estadísticas')
    }
  }
)

/**
 * Obtiene la lista de referidos del tenant
 */
export const fetchReferrals = createAsyncThunk(
  'referrals/fetchReferrals',
  async ({ tenantId, status = null }, { rejectWithValue }) => {
    try {
      const referrals = await getReferralUses(tenantId, { status })
      return referrals
    } catch (error) {
      return rejectWithValue(error.message || 'Error al obtener referidos')
    }
  }
)

/**
 * Obtiene las recompensas del tenant
 */
export const fetchRewards = createAsyncThunk(
  'referrals/fetchRewards',
  async ({ tenantId, status = null }, { rejectWithValue }) => {
    try {
      const rewards = await getReferralRewards(tenantId, { status })
      return rewards
    } catch (error) {
      return rejectWithValue(error.message || 'Error al obtener recompensas')
    }
  }
)

/**
 * Aplica una recompensa a la suscripción
 */
export const applyReward = createAsyncThunk(
  'referrals/applyReward',
  async ({ rewardId, appliedBy = null }, { rejectWithValue }) => {
    try {
      const result = await applyReferralReward(rewardId, appliedBy)
      if (!result.success) {
        return rejectWithValue(result.message)
      }
      return { rewardId, ...result }
    } catch (error) {
      return rejectWithValue(error.message || 'Error al aplicar recompensa')
    }
  }
)

/**
 * Valida un código de referido (para mostrar info durante registro)
 */
export const validateCode = createAsyncThunk(
  'referrals/validateCode',
  async (code, { rejectWithValue }) => {
    try {
      const result = await validateReferralCode(code)
      return result
    } catch (error) {
      return rejectWithValue(error.message || 'Error al validar código')
    }
  }
)

/**
 * Carga todos los datos de referidos del tenant
 */
export const loadReferralData = createAsyncThunk(
  'referrals/loadAll',
  async ({ tenantId, userId }, { dispatch }) => {
    // Ejecutar en paralelo
    await Promise.all([
      dispatch(fetchReferralConfig()),
      dispatch(fetchOrCreateReferralCode({ tenantId, userId })),
      dispatch(fetchReferralStats(tenantId)),
      dispatch(fetchReferrals({ tenantId })),
      dispatch(fetchRewards({ tenantId })),
    ])
    return true
  }
)

// ============================================================================
// SLICE
// ============================================================================

const referralsSlice = createSlice({
  name: 'referrals',
  initialState,
  reducers: {
    // Limpiar estado
    clearReferralState: () => initialState,
    
    // Limpiar validación de código
    clearValidatedCode: (state) => {
      state.validatedCode = null
      state.validateCodeStatus = 'idle'
      state.validateCodeError = null
    },
    
    // Limpiar errores
    clearReferralErrors: (state) => {
      state.configError = null
      state.codeError = null
      state.statsError = null
      state.referralsError = null
      state.rewardsError = null
      state.applyRewardError = null
      state.validateCodeError = null
    },
  },
  extraReducers: (builder) => {
    // Config
    builder
      .addCase(fetchReferralConfig.pending, (state) => {
        state.configStatus = 'loading'
        state.configError = null
      })
      .addCase(fetchReferralConfig.fulfilled, (state, action) => {
        state.configStatus = 'succeeded'
        state.config = action.payload
      })
      .addCase(fetchReferralConfig.rejected, (state, action) => {
        state.configStatus = 'failed'
        state.configError = action.payload
      })

    // Code
    builder
      .addCase(fetchOrCreateReferralCode.pending, (state) => {
        state.codeStatus = 'loading'
        state.codeError = null
      })
      .addCase(fetchOrCreateReferralCode.fulfilled, (state, action) => {
        state.codeStatus = 'succeeded'
        state.code = action.payload
      })
      .addCase(fetchOrCreateReferralCode.rejected, (state, action) => {
        state.codeStatus = 'failed'
        state.codeError = action.payload
      })

    // Stats
    builder
      .addCase(fetchReferralStats.pending, (state) => {
        state.statsStatus = 'loading'
        state.statsError = null
      })
      .addCase(fetchReferralStats.fulfilled, (state, action) => {
        state.statsStatus = 'succeeded'
        state.stats = action.payload
      })
      .addCase(fetchReferralStats.rejected, (state, action) => {
        state.statsStatus = 'failed'
        state.statsError = action.payload
      })

    // Referrals list
    builder
      .addCase(fetchReferrals.pending, (state) => {
        state.referralsStatus = 'loading'
        state.referralsError = null
      })
      .addCase(fetchReferrals.fulfilled, (state, action) => {
        state.referralsStatus = 'succeeded'
        state.referrals = action.payload
      })
      .addCase(fetchReferrals.rejected, (state, action) => {
        state.referralsStatus = 'failed'
        state.referralsError = action.payload
      })

    // Rewards
    builder
      .addCase(fetchRewards.pending, (state) => {
        state.rewardsStatus = 'loading'
        state.rewardsError = null
      })
      .addCase(fetchRewards.fulfilled, (state, action) => {
        state.rewardsStatus = 'succeeded'
        state.rewards = action.payload
      })
      .addCase(fetchRewards.rejected, (state, action) => {
        state.rewardsStatus = 'failed'
        state.rewardsError = action.payload
      })

    // Apply reward
    builder
      .addCase(applyReward.pending, (state, action) => {
        state.applyingRewardId = action.meta.arg.rewardId
        state.applyRewardStatus = 'loading'
        state.applyRewardError = null
      })
      .addCase(applyReward.fulfilled, (state, action) => {
        state.applyingRewardId = null
        state.applyRewardStatus = 'succeeded'
        // Actualizar recompensa en el array
        const idx = state.rewards.findIndex(r => r.id === action.payload.rewardId)
        if (idx >= 0) {
          state.rewards[idx] = {
            ...state.rewards[idx],
            status: REWARD_STATUS.APPLIED,
            applied_at: new Date().toISOString(),
            subscription_extended_until: action.payload.new_premium_until,
          }
        }
        // Actualizar stats
        if (state.stats) {
          state.stats.pending_rewards = Math.max(0, (state.stats.pending_rewards || 1) - 1)
          state.stats.applied_rewards = (state.stats.applied_rewards || 0) + 1
        }
      })
      .addCase(applyReward.rejected, (state, action) => {
        state.applyingRewardId = null
        state.applyRewardStatus = 'failed'
        state.applyRewardError = action.payload
      })

    // Validate code
    builder
      .addCase(validateCode.pending, (state) => {
        state.validateCodeStatus = 'loading'
        state.validateCodeError = null
      })
      .addCase(validateCode.fulfilled, (state, action) => {
        state.validateCodeStatus = 'succeeded'
        state.validatedCode = action.payload
      })
      .addCase(validateCode.rejected, (state, action) => {
        state.validateCodeStatus = 'failed'
        state.validateCodeError = action.payload
      })
  },
})

// ============================================================================
// ACCIONES
// ============================================================================

export const {
  clearReferralState,
  clearValidatedCode,
  clearReferralErrors,
} = referralsSlice.actions

// ============================================================================
// SELECTORES
// ============================================================================

export const selectReferralConfig = (state) => state.referrals.config
export const selectReferralCode = (state) => state.referrals.code
export const selectReferralStats = (state) => state.referrals.stats
export const selectReferrals = (state) => state.referrals.referrals
export const selectRewards = (state) => state.referrals.rewards

export const selectReferralUrl = (state) => {
  const code = state.referrals.code?.code
  return code ? generateReferralUrl(code) : null
}

export const selectPendingRewards = (state) => 
  state.referrals.rewards.filter(r => r.status === REWARD_STATUS.PENDING)

export const selectAppliedRewards = (state) => 
  state.referrals.rewards.filter(r => r.status === REWARD_STATUS.APPLIED)

export const selectPendingReferrals = (state) =>
  state.referrals.referrals.filter(r => r.status === REFERRAL_STATUS.PENDING)

export const selectConvertedReferrals = (state) =>
  state.referrals.referrals.filter(r => r.status === REFERRAL_STATUS.CONVERTED)

export const selectReferralLoadingStates = (state) => ({
  config: state.referrals.configStatus,
  code: state.referrals.codeStatus,
  stats: state.referrals.statsStatus,
  referrals: state.referrals.referralsStatus,
  rewards: state.referrals.rewardsStatus,
  applyReward: state.referrals.applyRewardStatus,
  validateCode: state.referrals.validateCodeStatus,
})

export const selectIsApplyingReward = (state) => 
  state.referrals.applyRewardStatus === 'loading'

export const selectApplyingRewardId = (state) => 
  state.referrals.applyingRewardId

export const selectValidatedCode = (state) => state.referrals.validatedCode

// Selector para progreso hacia próxima recompensa
export const selectReferralProgress = (state) => {
  const stats = state.referrals.stats
  const config = state.referrals.config
  
  if (!stats || !config) return null
  
  const converted = stats.converted_referrals || 0
  const nextTierReferrals = config.tier_1_referrals || 5
  
  // Calcular progreso hacia el próximo umbral
  const currentInTier = converted % nextTierReferrals
  const progress = (currentInTier / nextTierReferrals) * 100
  const remaining = nextTierReferrals - currentInTier
  
  // Determinar próximo tier especial
  let nextSpecialTier = null
  if (converted < config.tier_2_referrals) {
    nextSpecialTier = { 
      tier: 2, 
      referrals: config.tier_2_referrals, 
      remaining: config.tier_2_referrals - converted,
      reward: `${config.tier_2_reward_months} mes de ${config.tier_2_reward_plan}`
    }
  } else if (converted < config.tier_3_referrals) {
    nextSpecialTier = { 
      tier: 3, 
      referrals: config.tier_3_referrals, 
      remaining: config.tier_3_referrals - converted,
      reward: `${config.tier_3_reward_months} meses de ${config.tier_3_reward_plan}`
    }
  }
  
  return {
    converted,
    currentInTier,
    nextTierReferrals,
    progress,
    remaining,
    nextSpecialTier,
  }
}

export default referralsSlice.reducer
