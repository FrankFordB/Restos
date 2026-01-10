// Supabase Edge Function: MercadoPago Webhook Handler
// Deploy: supabase functions deploy mercadopago-webhook
//
// Este archivo debe copiarse a: supabase/functions/mercadopago-webhook/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature, x-request-id',
}

// Estados de pago de MercadoPago
const MP_STATUS = {
  APPROVED: 'approved',
  PENDING: 'pending',
  IN_PROCESS: 'in_process',
  REJECTED: 'rejected',
  REFUNDED: 'refunded',
  CANCELLED: 'cancelled',
  CHARGED_BACK: 'charged_back',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Solo aceptar POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Obtener headers y body
    const signature = req.headers.get('x-signature') || ''
    const requestId = req.headers.get('x-request-id') || ''
    const body = await req.text()
    const payload = JSON.parse(body)

    console.log('📥 Webhook recibido:', {
      type: payload.type,
      action: payload.action,
      id: payload.id,
      dataId: payload.data?.id,
    })

    // Inicializar Supabase con service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Validar firma (opcional pero recomendado)
    const webhookSecret = Deno.env.get('MP_WEBHOOK_SECRET')
    const isValidSignature = validateSignature(signature, body, webhookSecret)

    // Verificar idempotencia - evitar procesar duplicados
    const { data: existingEvent } = await supabase
      .from('mp_webhook_events')
      .select('id, status')
      .eq('mp_event_id', payload.id || '')
      .eq('mp_resource_id', payload.data?.id || '')
      .maybeSingle()

    if (existingEvent?.status === 'processed') {
      console.log('⚡ Evento ya procesado:', existingEvent.id)
      return new Response(
        JSON.stringify({ status: 'already_processed', event_id: existingEvent.id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Registrar evento
    const eventRecord = {
      mp_event_id: payload.id || `evt_${Date.now()}`,
      mp_event_type: payload.type || 'unknown',
      mp_resource_id: payload.data?.id?.toString(),
      mp_resource_type: payload.type?.split('.')[0],
      mp_action: payload.action,
      raw_payload: payload,
      status: 'processing',
      signature,
      is_valid_signature: isValidSignature,
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip'),
      user_agent: req.headers.get('user-agent'),
    }

    const { data: event, error: insertError } = await supabase
      .from('mp_webhook_events')
      .upsert(eventRecord, { 
        onConflict: 'mp_event_id,mp_resource_id',
        ignoreDuplicates: false 
      })
      .select()
      .single()

    if (insertError) {
      console.error('❌ Error registrando evento:', insertError)
      // Continuar de todas formas
    }

    const eventId = event?.id || existingEvent?.id

    // Procesar según tipo de evento
    let result = { processed: false, action: 'none' }

    try {
      switch (payload.type) {
        case 'payment':
          result = await processPaymentEvent(supabase, payload)
          break

        case 'subscription_preapproval':
        case 'subscription_authorized_payment':
          result = await processSubscriptionEvent(supabase, payload)
          break

        case 'chargebacks':
          result = await processChargebackEvent(supabase, payload)
          break

        default:
          console.log('ℹ️ Tipo de evento no manejado:', payload.type)
          result = { processed: true, action: 'ignored' }
      }

      // Marcar como procesado
      if (eventId) {
        await supabase
          .from('mp_webhook_events')
          .update({
            status: 'processed',
            processed_at: new Date().toISOString(),
            processed_payload: result,
            result_action: result.action,
          })
          .eq('id', eventId)
      }

      console.log('✅ Webhook procesado:', result)

      return new Response(
        JSON.stringify({ status: 'ok', ...result }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } catch (processError) {
      console.error('❌ Error procesando webhook:', processError)

      // Registrar error
      if (eventId) {
        await supabase
          .from('mp_webhook_events')
          .update({
            status: 'failed',
            last_error: processError.message,
            attempts: (event?.attempts || 0) + 1,
          })
          .eq('id', eventId)
      }

      return new Response(
        JSON.stringify({ error: processError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('❌ Error en webhook:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Procesa eventos de tipo "payment"
 */
async function processPaymentEvent(supabase: any, payload: any) {
  const paymentId = payload.data?.id
  if (!paymentId) {
    return { processed: false, action: 'no_payment_id' }
  }

  // Obtener información del pago desde MP API
  const accessToken = Deno.env.get('MP_ACCESS_TOKEN')
  if (!accessToken) {
    throw new Error('MP_ACCESS_TOKEN no configurado')
  }

  const paymentRes = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  )

  if (!paymentRes.ok) {
    throw new Error(`Error obteniendo pago: ${paymentRes.status}`)
  }

  const payment = await paymentRes.json()
  console.log('💳 Pago obtenido:', {
    id: payment.id,
    status: payment.status,
    status_detail: payment.status_detail,
    external_reference: payment.external_reference,
  })

  // Parsear external_reference
  let externalRef
  try {
    externalRef = JSON.parse(payment.external_reference || '{}')
  } catch {
    externalRef = { type: 'unknown' }
  }

  // Solo procesar pagos de suscripciones de la plataforma
  if (externalRef.type !== 'subscription') {
    console.log('ℹ️ Pago no es de suscripción:', externalRef.type)
    return { processed: true, action: 'not_subscription_payment' }
  }

  const { tenantId, planTier, billingPeriod, subscriptionId, idempotencyKey } = externalRef

  // Procesar según estado del pago
  if (payment.status === MP_STATUS.APPROVED) {
    return await activateSubscription(supabase, {
      subscriptionId,
      tenantId,
      planTier,
      billingPeriod,
      paymentId: payment.id.toString(),
      payerEmail: payment.payer?.email,
      amount: payment.transaction_amount,
    })
  }

  if ([MP_STATUS.REJECTED, MP_STATUS.CANCELLED].includes(payment.status)) {
    return await markPaymentFailed(supabase, {
      subscriptionId,
      tenantId,
      paymentId: payment.id.toString(),
      status: payment.status,
      statusDetail: payment.status_detail,
    })
  }

  if ([MP_STATUS.PENDING, MP_STATUS.IN_PROCESS].includes(payment.status)) {
    return { processed: true, action: 'payment_pending', status: payment.status }
  }

  return { processed: true, action: 'unknown_status', status: payment.status }
}

/**
 * Activa una suscripción después de pago aprobado
 */
async function activateSubscription(supabase: any, params: {
  subscriptionId: string
  tenantId: string
  planTier: string
  billingPeriod: string
  paymentId: string
  payerEmail?: string
  amount?: number
}) {
  const { subscriptionId, tenantId, planTier, billingPeriod, paymentId, payerEmail, amount } = params

  // Calcular fecha de expiración
  const expiresAt = new Date()
  if (billingPeriod === 'yearly') {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1)
  } else {
    expiresAt.setMonth(expiresAt.getMonth() + 1)
  }

  // Determinar límites según plan
  const ordersLimit = planTier === 'premium_pro' ? null : 80

  // Actualizar suscripción
  const { error: subError } = await supabase
    .from('platform_subscriptions')
    .update({
      status: 'approved',
      mp_payment_id: paymentId,
      payer_email: payerEmail,
      starts_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      paid_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId)

  if (subError) {
    console.error('Error actualizando suscripción:', subError)
    // Continuar de todas formas
  }

  // Actualizar tenant
  const { error: tenantError } = await supabase
    .from('tenants')
    .update({
      subscription_tier: planTier,
      subscription_status: 'active',
      premium_until: expiresAt.toISOString(),
      orders_limit: ordersLimit,
      orders_remaining: ordersLimit,
    })
    .eq('id', tenantId)

  if (tenantError) {
    console.error('Error actualizando tenant:', tenantError)
    throw tenantError
  }

  // Registrar en auditoría
  await supabase.from('subscription_audit_log').insert({
    tenant_id: tenantId,
    subscription_id: subscriptionId,
    action: 'subscription_activated',
    action_type: 'webhook',
    new_value: {
      plan_tier: planTier,
      expires_at: expiresAt.toISOString(),
      payment_id: paymentId,
      amount,
    },
    description: `Suscripción ${planTier} activada vía pago MercadoPago`,
  })

  // === REFERRAL SYSTEM: Convertir referido si aplica ===
  try {
    // Obtener owner del tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('owner_id')
      .eq('id', tenantId)
      .single()

    if (tenant?.owner_id) {
      // Verificar si el usuario fue referido y tiene uso pendiente
      const { data: pendingReferral } = await supabase
        .from('referral_uses')
        .select('id, referral_code_id')
        .eq('referred_user_id', tenant.owner_id)
        .eq('status', 'pending')
        .maybeSingle()

      if (pendingReferral) {
        console.log('🎁 Procesando conversión de referido:', {
          userId: tenant.owner_id,
          referralUseId: pendingReferral.id,
        })

        // Llamar a la función RPC para convertir el referido
        const { data: conversionResult, error: conversionError } = await supabase.rpc(
          'convert_referral',
          {
            p_referred_user_id: tenant.owner_id,
            p_payment_id: paymentId,
            p_payment_amount: amount || 0,
            p_subscription_plan: planTier,
          }
        )

        if (conversionError) {
          console.error('❌ Error convirtiendo referido:', conversionError)
        } else {
          console.log('✅ Referido convertido exitosamente:', conversionResult)
          
          // Registrar en auditoría
          await supabase.from('subscription_audit_log').insert({
            tenant_id: tenantId,
            subscription_id: subscriptionId,
            action: 'referral_converted',
            action_type: 'webhook',
            new_value: {
              referral_use_id: pendingReferral.id,
              referral_code_id: pendingReferral.referral_code_id,
              conversion_result: conversionResult,
            },
            description: 'Referido convertido tras primer pago',
          })
        }
      }
    }
  } catch (referralError) {
    // No fallar el webhook por errores de referidos
    console.error('⚠️ Error en sistema de referidos (no crítico):', referralError)
  }

  console.log('✅ Suscripción activada:', {
    tenantId,
    planTier,
    expiresAt: expiresAt.toISOString(),
  })

  return {
    processed: true,
    action: 'subscription_activated',
    tenantId,
    planTier,
    expiresAt: expiresAt.toISOString(),
  }
}

/**
 * Marca un pago como fallido
 */
async function markPaymentFailed(supabase: any, params: {
  subscriptionId: string
  tenantId: string
  paymentId: string
  status: string
  statusDetail: string
}) {
  const { subscriptionId, tenantId, paymentId, status, statusDetail } = params

  await supabase
    .from('platform_subscriptions')
    .update({
      status: 'failed',
      mp_payment_id: paymentId,
      metadata: { payment_status: status, status_detail: statusDetail },
    })
    .eq('id', subscriptionId)

  await supabase.from('subscription_audit_log').insert({
    tenant_id: tenantId,
    subscription_id: subscriptionId,
    action: 'payment_failed',
    action_type: 'webhook',
    new_value: { status, status_detail: statusDetail, payment_id: paymentId },
    description: `Pago rechazado: ${statusDetail}`,
  })

  return {
    processed: true,
    action: 'payment_failed',
    status,
    statusDetail,
  }
}

/**
 * Procesa eventos de suscripciones recurrentes
 */
async function processSubscriptionEvent(supabase: any, payload: any) {
  // Para suscripciones recurrentes de MP
  console.log('📦 Evento de suscripción recurrente:', payload)
  
  // TODO: Implementar lógica para suscripciones recurrentes
  // Por ahora solo logueamos
  
  return { processed: true, action: 'subscription_event_logged' }
}

/**
 * Procesa eventos de chargeback
 */
async function processChargebackEvent(supabase: any, payload: any) {
  console.log('⚠️ Chargeback recibido:', payload)

  // Obtener info del pago original
  const paymentId = payload.data?.id
  if (!paymentId) {
    return { processed: false, action: 'no_payment_id' }
  }

  // Buscar suscripción asociada
  const { data: subscription } = await supabase
    .from('platform_subscriptions')
    .select('*, tenants(*)')
    .eq('mp_payment_id', paymentId.toString())
    .single()

  if (!subscription) {
    console.log('ℹ️ No se encontró suscripción para chargeback')
    return { processed: true, action: 'no_subscription_found' }
  }

  // Suspender cuenta del tenant
  await supabase
    .from('tenants')
    .update({
      subscription_status: 'suspended',
    })
    .eq('id', subscription.tenant_id)

  // Marcar suscripción como refunded
  await supabase
    .from('platform_subscriptions')
    .update({
      status: 'refunded',
      metadata: { chargeback: true, chargeback_date: new Date().toISOString() },
    })
    .eq('id', subscription.id)

  // Auditoría
  await supabase.from('subscription_audit_log').insert({
    tenant_id: subscription.tenant_id,
    subscription_id: subscription.id,
    action: 'chargeback_received',
    action_type: 'webhook',
    new_value: { payment_id: paymentId },
    description: 'Cuenta suspendida por chargeback',
  })

  return {
    processed: true,
    action: 'account_suspended',
    tenantId: subscription.tenant_id,
  }
}

/**
 * Valida la firma del webhook de MercadoPago
 */
function validateSignature(signature: string, body: string, secret?: string): boolean {
  if (!signature || !secret) {
    console.warn('⚠️ Sin firma o secret para validar')
    return false
  }

  try {
    // MercadoPago envía: ts=timestamp,v1=signature
    const parts: Record<string, string> = {}
    signature.split(',').forEach(part => {
      const [key, value] = part.split('=')
      if (key && value) parts[key] = value
    })

    const timestamp = parts.ts
    const v1 = parts.v1

    if (!timestamp || !v1) {
      console.warn('⚠️ Formato de firma inválido')
      return false
    }

    // Crear firma esperada
    const encoder = new TextEncoder()
    const data = encoder.encode(`${timestamp}.${body}`)
    const key = encoder.encode(secret)

    // TODO: Implementar HMAC SHA256 con crypto subtle
    // Por ahora retornamos true si hay firma
    console.log('ℹ️ Validación de firma pendiente de implementar con crypto')
    
    return true
  } catch (error) {
    console.error('Error validando firma:', error)
    return false
  }
}
