/**
 * API para Suscripciones de Mercado Pago (Preapproval)
 * Maneja suscripciones automáticas recurrentes
 */

import { supabase, isSupabaseConfigured } from './supabaseClient'

// URL de la Edge Function (se configura en .env)
const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL 
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
  : null

/**
 * Crear una nueva suscripción en Mercado Pago
 * El usuario será redirigido para autorizar el débito automático
 */
export async function createMPSubscription({
  tenantId,
  planTier,
  payerEmail,
  backUrl,
}: {
  tenantId: string
  planTier: 'premium' | 'premium_pro'
  payerEmail: string
  backUrl?: string
}) {
  if (!isSupabaseConfigured || !FUNCTIONS_URL) {
    console.warn('Supabase no configurado, modo demo')
    // Simular respuesta para desarrollo
    return {
      success: true,
      initPoint: '/dashboard?tab=plans&demo=true',
      subscriptionId: 'demo_sub_' + Date.now(),
    }
  }

  // Obtener session para el header de autorización
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('Debes iniciar sesión para suscribirte')
  }

  const response = await fetch(`${FUNCTIONS_URL}/create-subscription`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      plan: planTier,
      tenant_id: tenantId,
      payer_email: payerEmail,
      back_url: backUrl || `${window.location.origin}/dashboard?tab=plans`,
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    console.error('Error creating subscription:', data)
    throw new Error(data.error || 'Error al crear suscripción')
  }

  return {
    success: true,
    initPoint: data.init_point,
    sandboxInitPoint: data.sandbox_init_point,
    subscriptionId: data.preapproval_id,
    localSubscriptionId: data.subscription_id,
  }
}

/**
 * Obtener la suscripción activa del tenant
 */
export async function getActiveSubscription(tenantId: string) {
  if (!isSupabaseConfigured) {
    return null
  }

  const { data, error } = await supabase
    .from('mp_subscriptions')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('status', ['active', 'authorized', 'pending', 'paused'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No subscription found
      return null
    }
    console.error('Error fetching subscription:', error)
    throw error
  }

  return data
}

/**
 * Obtener historial de pagos de la suscripción
 */
export async function getSubscriptionPayments(subscriptionId: string) {
  if (!isSupabaseConfigured) {
    return []
  }

  const { data, error } = await supabase
    .from('mp_subscription_payments')
    .select('*')
    .eq('subscription_id', subscriptionId)
    .order('created_at', { ascending: false })
    .limit(12)

  if (error) {
    console.error('Error fetching payments:', error)
    throw error
  }

  return data || []
}

/**
 * Cancelar suscripción
 * Nota: El usuario mantiene acceso hasta el final del período pagado
 */
export async function cancelSubscription(tenantId: string) {
  if (!isSupabaseConfigured || !FUNCTIONS_URL) {
    console.warn('Supabase no configurado')
    return { success: true, message: 'Demo mode' }
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('Debes iniciar sesión')
  }

  const response = await fetch(`${FUNCTIONS_URL}/cancel-subscription`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ tenant_id: tenantId }),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'Error al cancelar suscripción')
  }

  return data
}

/**
 * Obtener estado completo de suscripción del tenant
 */
export async function getSubscriptionStatus(tenantId: string) {
  if (!isSupabaseConfigured) {
    return {
      hasSubscription: false,
      status: 'none',
      tier: 'free',
      nextBilling: null,
      canUpgrade: true,
      canDowngrade: false,
    }
  }

  // Obtener datos del tenant
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('subscription_tier, subscription_status, premium_until, next_billing_date, grace_period_until, mp_subscription_id')
    .eq('id', tenantId)
    .single()

  if (tenantError) {
    console.error('Error fetching tenant:', tenantError)
    throw tenantError
  }

  // Obtener suscripción activa si existe
  let subscription = null
  if (tenant.mp_subscription_id) {
    const { data } = await supabase
      .from('mp_subscriptions')
      .select('*')
      .eq('id', tenant.mp_subscription_id)
      .single()
    subscription = data
  }

  const hasActiveSubscription = tenant.subscription_status === 'active' || 
                                 tenant.subscription_status === 'grace_period'
  
  const isInGracePeriod = tenant.subscription_status === 'grace_period' && 
                          tenant.grace_period_until && 
                          new Date(tenant.grace_period_until) > new Date()

  return {
    hasSubscription: !!subscription,
    status: tenant.subscription_status || 'none',
    tier: tenant.subscription_tier || 'free',
    premiumUntil: tenant.premium_until,
    nextBilling: tenant.next_billing_date || subscription?.next_payment_date,
    gracePeriodUntil: tenant.grace_period_until,
    isInGracePeriod,
    subscription,
    canUpgrade: !hasActiveSubscription || tenant.subscription_tier === 'premium',
    canDowngrade: hasActiveSubscription && tenant.subscription_tier !== 'free',
    canCancel: hasActiveSubscription,
  }
}

/**
 * Formatear estado de suscripción para UI
 */
export function formatSubscriptionStatus(status: string) {
  const statusMap: Record<string, { label: string; color: string; icon: string }> = {
    'none': { label: 'Sin suscripción', color: 'gray', icon: '○' },
    'pending': { label: 'Pendiente de autorización', color: 'yellow', icon: '⏳' },
    'active': { label: 'Activa', color: 'green', icon: '✓' },
    'authorized': { label: 'Autorizada', color: 'blue', icon: '✓' },
    'paused': { label: 'Pausada', color: 'orange', icon: '⏸' },
    'cancelled': { label: 'Cancelada', color: 'red', icon: '✕' },
    'payment_failed': { label: 'Pago fallido', color: 'red', icon: '!' },
    'grace_period': { label: 'Período de gracia', color: 'orange', icon: '⚠' },
    'expired': { label: 'Expirada', color: 'gray', icon: '✕' },
  }
  return statusMap[status] || statusMap['none']
}

/**
 * Formatear fecha de próximo cobro
 */
export function formatNextBilling(date: string | null) {
  if (!date) return null
  
  const d = new Date(date)
  const now = new Date()
  const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diffDays < 0) return 'Vencido'
  if (diffDays === 0) return 'Hoy'
  if (diffDays === 1) return 'Mañana'
  if (diffDays < 7) return `En ${diffDays} días`
  
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}
