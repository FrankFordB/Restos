// Edge Function: Webhook de Suscripciones MercadoPago
// POST /mercadopago-subscription-webhook
// Recibe notificaciones de MP sobre cambios en suscripciones

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'https://deno.land/std@0.177.0/node/crypto.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature, x-request-id',
}

// IPs oficiales de MercadoPago (Argentina)
const MP_IPS = [
  '216.33.196.',
  '209.225.49.',
  '216.33.197.',
  '63.128.82.',
  '63.128.83.',
  '63.128.84.',
  '63.128.85.',
  '63.128.86.',
  '63.128.87.',
]

interface WebhookPayload {
  id: string
  type: string
  action: string
  api_version: string
  data: {
    id: string
  }
  date_created: string
  live_mode: boolean
  user_id: string
}

Deno.serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')!
  const webhookSecret = Deno.env.get('MP_WEBHOOK_SECRET')

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // Obtener IP del request
    const sourceIp = req.headers.get('x-forwarded-for') || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown'

    // Validar IP de MercadoPago (opcional pero recomendado)
    // const isValidIp = MP_IPS.some(prefix => sourceIp.startsWith(prefix))
    // if (!isValidIp) {
    //   console.warn('Request from non-MP IP:', sourceIp)
    // }

    // Obtener headers de MP
    const xRequestId = req.headers.get('x-request-id')
    const xSignature = req.headers.get('x-signature')

    // Parsear body
    const body: WebhookPayload = await req.json()
    
    console.log('Webhook received:', {
      type: body.type,
      action: body.action,
      resource_id: body.data?.id,
      request_id: xRequestId,
    })

    // Anti-duplicados: verificar si ya procesamos este evento
    if (xRequestId) {
      const { data: existing } = await supabase
        .from('mp_webhook_events')
        .select('id')
        .eq('event_id', xRequestId)
        .single()

      if (existing) {
        console.log('Event already processed:', xRequestId)
        return new Response(
          JSON.stringify({ status: 'already_processed' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Validar firma si tenemos webhook secret
    if (webhookSecret && xSignature) {
      const signatureParts = Object.fromEntries(
        xSignature.split(',').map(part => {
          const [key, value] = part.split('=')
          return [key.trim(), value]
        })
      )

      const ts = signatureParts.ts
      const v1 = signatureParts.v1

      if (ts && v1) {
        const manifest = `id:${body.data?.id};request-id:${xRequestId};ts:${ts};`
        const hmac = createHmac('sha256', webhookSecret)
          .update(manifest)
          .digest('hex')

        if (hmac !== v1) {
          console.error('Invalid webhook signature')
          // En producción podrías rechazar aquí
          // return new Response('Invalid signature', { status: 401 })
        }
      }
    }

    // Guardar evento para auditoría
    const eventId = xRequestId || `manual_${Date.now()}`
    await supabase.from('mp_webhook_events').insert({
      event_id: eventId,
      event_type: body.type,
      action: body.action,
      mp_resource_id: body.data?.id,
      mp_resource_type: body.type,
      payload: body,
      source_ip: sourceIp,
      processing_result: 'processing',
    })

    // Procesar según el tipo de evento
    let result: any = { processed: false }

    if (body.type === 'subscription_preapproval') {
      result = await handlePreapprovalEvent(body, mpAccessToken, supabase)
    } else if (body.type === 'payment') {
      result = await handlePaymentEvent(body, mpAccessToken, supabase)
    } else {
      console.log('Unhandled event type:', body.type)
      result = { processed: false, reason: 'unhandled_type' }
    }

    // Actualizar resultado del evento
    await supabase
      .from('mp_webhook_events')
      .update({ 
        processing_result: result.success ? 'success' : 'error',
        error_message: result.error || null,
      })
      .eq('event_id', eventId)

    console.log('Webhook processed:', result)

    return new Response(
      JSON.stringify({ status: 'ok', result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// ============================================================================
// Handlers por tipo de evento
// ============================================================================

async function handlePreapprovalEvent(
  body: WebhookPayload,
  mpAccessToken: string,
  supabase: any
): Promise<any> {
  const preapprovalId = body.data.id

  // Consultar estado actual en MercadoPago (fuente de verdad)
  const mpResponse = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
    headers: { 'Authorization': `Bearer ${mpAccessToken}` }
  })

  if (!mpResponse.ok) {
    return { success: false, error: 'Failed to fetch preapproval from MP' }
  }

  const preapproval = await mpResponse.json()
  console.log('Preapproval status from MP:', preapproval.status)

  // Procesar según el estado
  switch (preapproval.status) {
    case 'authorized':
      // Usuario autorizó el débito automático
      const activateResult = await supabase.rpc('activate_mp_subscription', {
        p_preapproval_id: preapprovalId,
        p_payer_id: preapproval.payer_id?.toString(),
        p_payer_email: preapproval.payer_email,
        p_next_billing_date: preapproval.next_payment_date,
      })
      return { success: !activateResult.error, action: 'activated', ...activateResult.data }

    case 'paused':
      // Suscripción pausada
      const pauseResult = await supabase.rpc('pause_mp_subscription', {
        p_preapproval_id: preapprovalId,
      })
      return { success: !pauseResult.error, action: 'paused', ...pauseResult.data }

    case 'cancelled':
      // Suscripción cancelada
      const cancelResult = await supabase.rpc('cancel_mp_subscription', {
        p_preapproval_id: preapprovalId,
        p_immediate: false, // Mantener beneficios hasta el final del período
      })
      return { success: !cancelResult.error, action: 'cancelled', ...cancelResult.data }

    default:
      console.log('Unhandled preapproval status:', preapproval.status)
      return { success: true, action: 'ignored', status: preapproval.status }
  }
}

async function handlePaymentEvent(
  body: WebhookPayload,
  mpAccessToken: string,
  supabase: any
): Promise<any> {
  const paymentId = body.data.id

  // Consultar pago en MercadoPago
  const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { 'Authorization': `Bearer ${mpAccessToken}` }
  })

  if (!mpResponse.ok) {
    return { success: false, error: 'Failed to fetch payment from MP' }
  }

  const payment = await mpResponse.json()
  
  // Solo procesar pagos de suscripciones
  if (payment.operation_type !== 'recurring_payment') {
    return { success: true, action: 'ignored', reason: 'not_recurring' }
  }

  const preapprovalId = payment.metadata?.preapproval_id

  if (!preapprovalId) {
    console.warn('Payment without preapproval_id:', paymentId)
    return { success: true, action: 'ignored', reason: 'no_preapproval_id' }
  }

  console.log('Payment status:', payment.status, 'for preapproval:', preapprovalId)

  switch (payment.status) {
    case 'approved':
      // Pago exitoso
      const paymentResult = await supabase.rpc('register_mp_payment', {
        p_preapproval_id: preapprovalId,
        p_payment_id: paymentId,
        p_amount: payment.transaction_amount,
        p_payment_date: payment.date_approved || new Date().toISOString(),
      })
      return { success: !paymentResult.error, action: 'payment_registered', ...paymentResult.data }

    case 'rejected':
    case 'cancelled':
      // Pago fallido
      const failedResult = await supabase.rpc('mark_mp_payment_failed', {
        p_preapproval_id: preapprovalId,
        p_reason: payment.status_detail,
      })
      return { success: !failedResult.error, action: 'payment_failed', ...failedResult.data }

    case 'pending':
    case 'in_process':
      // Pago pendiente - no hacer nada, esperar siguiente webhook
      return { success: true, action: 'pending', status: payment.status }

    default:
      return { success: true, action: 'ignored', status: payment.status }
  }
}
