/**
 * Supabase Authentication Module
 * Handles OAuth, email verification, and 2FA
 */
import { supabase, isSupabaseConfigured } from './supabaseClient'

// ============================================
// GOOGLE OAUTH
// ============================================

/**
 * Sign in with Google OAuth
 * Redirects to Google for authentication
 */
export async function signInWithGoogle() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase no está configurado')
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })

  if (error) throw error
  return data
}

/**
 * Handle OAuth callback after redirect
 */
export async function handleOAuthCallback() {
  if (!isSupabaseConfigured) return null

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

// ============================================
// EMAIL VERIFICATION (OTP)
// ============================================

/**
 * Sign up with email - sends OTP verification code
 * @param {Object} params - { email, password }
 * @returns {Object} - User data (unverified)
 */
export async function signUpWithEmailOTP({ email, password }) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase no está configurado')
  }

  // Create user with email confirmation required
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/verify`,
      data: {
        email_verified: false,
        registration_step: 1,
      },
    },
  })

  if (error) throw error
  
  return {
    user: data.user,
    session: data.session,
    needsVerification: !data.user?.email_confirmed_at,
  }
}

/**
 * Verify email with OTP code
 * @param {Object} params - { email, token }
 */
export async function verifyEmailOTP({ email, token }) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase no está configurado')
  }

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  })

  if (error) throw error
  return data
}

/**
 * Resend OTP verification code
 * @param {string} email
 */
export async function resendVerificationOTP(email) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase no está configurado')
  }

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/verify`,
    },
  })

  if (error) throw error
  return { success: true }
}

// ============================================
// TWO-FACTOR AUTHENTICATION (TOTP)
// ============================================

/**
 * Enroll user in TOTP 2FA
 * Returns QR code and secret for authenticator app
 */
export async function enrollTOTP() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase no está configurado')
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'Authenticator App',
  })

  if (error) throw error

  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
    uri: data.totp.uri,
  }
}

/**
 * Verify TOTP code and complete enrollment
 * @param {Object} params - { factorId, code }
 */
export async function verifyTOTPEnrollment({ factorId, code }) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase no está configurado')
  }

  const { data, error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code,
  })

  if (error) throw error
  return data
}

/**
 * Create a TOTP challenge for login
 * @param {string} factorId
 */
export async function createTOTPChallenge(factorId) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase no está configurado')
  }

  const { data, error } = await supabase.auth.mfa.challenge({
    factorId,
  })

  if (error) throw error
  return data
}

/**
 * Verify TOTP code during login
 * @param {Object} params - { factorId, challengeId, code }
 */
export async function verifyTOTPChallenge({ factorId, challengeId, code }) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase no está configurado')
  }

  const { data, error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId,
    code,
  })

  if (error) throw error
  return data
}

/**
 * Get user's enrolled MFA factors
 */
export async function getMFAFactors() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase no está configurado')
  }

  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) throw error

  return {
    totp: data.totp || [],
    phone: data.phone || [],
    all: [...(data.totp || []), ...(data.phone || [])],
  }
}

/**
 * Unenroll (disable) a MFA factor
 * @param {string} factorId
 */
export async function unenrollMFA(factorId) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase no está configurado')
  }

  const { error } = await supabase.auth.mfa.unenroll({
    factorId,
  })

  if (error) throw error
  return { success: true }
}

/**
 * Check current MFA/AAL level
 */
export async function getAuthenticatorAssuranceLevel() {
  if (!isSupabaseConfigured) {
    return { currentLevel: null, nextLevel: null }
  }

  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error) throw error

  return {
    currentLevel: data.currentLevel,  // 'aal1' or 'aal2'
    nextLevel: data.nextLevel,
    currentAuthenticationMethods: data.currentAuthenticationMethods,
  }
}

// ============================================
// PHONE VERIFICATION (SMS OTP)
// ============================================

/**
 * Send SMS OTP to phone number
 * Requires Twilio or other SMS provider configured in Supabase
 * @param {string} phone - Phone number with country code (e.g., +5491123456789)
 */
export async function sendPhoneOTP(phone) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase no está configurado')
  }

  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: {
      channel: 'sms', // or 'whatsapp' if configured
    },
  })

  if (error) throw error
  return { success: true }
}

/**
 * Verify phone OTP
 * @param {Object} params - { phone, token }
 */
export async function verifyPhoneOTP({ phone, token }) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase no está configurado')
  }

  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  })

  if (error) throw error
  return data
}

// ============================================
// SESSION MANAGEMENT
// ============================================

/**
 * Get current session
 */
export async function getCurrentSession() {
  if (!isSupabaseConfigured) return null

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

/**
 * Get current user
 */
export async function getCurrentUser() {
  if (!isSupabaseConfigured) return null

  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  return data.user
}

/**
 * Refresh session token
 */
export async function refreshSession() {
  if (!isSupabaseConfigured) return null

  const { data, error } = await supabase.auth.refreshSession()
  if (error) throw error
  return data.session
}

/**
 * Sign out current user
 */
export async function signOut() {
  if (!isSupabaseConfigured) return

  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/**
 * Listen to auth state changes
 * @param {Function} callback
 * @returns {Function} unsubscribe function
 */
export function onAuthStateChange(callback) {
  if (!isSupabaseConfigured) {
    return () => {}
  }

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session)
  })

  return () => subscription.unsubscribe()
}

// ============================================
// PASSWORD MANAGEMENT
// ============================================

/**
 * Update user password
 * @param {string} newPassword
 */
export async function updatePassword(newPassword) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase no está configurado')
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (error) throw error
  return { success: true }
}

/**
 * Request password reset email
 * @param {string} email
 */
export async function requestPasswordReset(email) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase no está configurado')
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  })

  if (error) throw error
  return { success: true }
}

// ============================================
// USER METADATA UPDATES
// ============================================

/**
 * Update user metadata (for registration step 2)
 * @param {Object} metadata
 */
export async function updateUserMetadata(metadata) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase no está configurado')
  }

  const { data, error } = await supabase.auth.updateUser({
    data: metadata,
  })

  if (error) throw error
  return data.user
}

/**
 * Mark registration step as completed
 * @param {number} step - 1 or 2
 */
export async function completeRegistrationStep(step) {
  return updateUserMetadata({
    registration_step: step,
    [`step${step}_completed_at`]: new Date().toISOString(),
  })
}
