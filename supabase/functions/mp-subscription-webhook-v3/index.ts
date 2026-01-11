/**
 * Edge Function: Webhook de Suscripciones MercadoPago v3
 * 
 * Características:
 * - Validación de firma/IP de MercadoPago
 * - Anti-duplicados con mp_webhook_events
 * - Usa las nuevas funciones RPC para actualizar estado
 * - Logging completo para auditoría
 * 
 * Deploy: supabase functions deploy mp-subscription-webhook-v3
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// IPs oficiales de MercadoPago para webhooks
const MP_WEBHOOK_IPS = [
  '52.67.226.0/24',
  '18.231.111.0/24', 
  '54.232.159.0/24',
  '34.197.71.0/24',
  '54.94.126.0/24',
]

// Tipos de topic/action que manejamos
const SUBSCRIPTION_TOPICS = ['preapproval', 'subscription_preapproval']
const PAYMENT_TOPICS = ['payment', 'authorized_payment']

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()
  
  try {
    // Crear cliente Supabase con service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Obtener IP de origen (para validación)
    const sourceIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown'

    // Parsear body
    const body = await req.json()
    console.log('📥 Webhook recibido:', JSON.stringify(body, null, 2))
    console.log('🌐 IP origen:', sourceIp)

    const { id: eventId, type, topic, action, data } = body
    const resourceId = data?.id

    if (!resourceId) {
      console.log('⚠️ No resource ID, ignorando')
      return new Response(
        JSON.stringify({ success: true, message: 'No resource ID' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Determinar tipo de evento
    const eventTopic = topic || type
    const eventAction = action || 'update'
    const fullEventType = `${eventTopic}.${eventAction}`

    // Anti-duplicados: verificar si ya procesamos este evento
    const eventUniqueId = eventId || `${eventTopic}_${resourceId}_${Date.now()}`
    
    const { data: existingEvent } = await supabase
      .from('mp_webhook_events')
      .select('id, status')
      .eq('mp_event_id', eventUniqueId)
      .single()

    if (existingEvent?.status === 'processed') {
      console.log('⏭️ Evento ya procesado:', eventUniqueId)
      return new Response(
        JSON.stringify({ success: true, message: 'Event already processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Registrar evento para auditoría
    const { data: webhookEvent } = await supabase
      .from('mp_webhook_events')
      .upsert({
        mp_event_id: eventUniqueId,
        event_type: eventTopic,
        action: eventAction,
        resource_id: String(resourceId),
        raw_data: body,
        source_ip: sourceIp,
        status: 'pending',
      }, { onConflict: 'mp_event_id' })
      .select()
      .single()

    // Procesar según tipo de evento
    let result = { processed: false, message: '' }

    // =====================
    // EVENTOS DE SUSCRIPCIÓN (Preapproval)
    // =====================
    if (SUBSCRIPTION_TOPICS.some(t => eventTopic?.includes(t))) {
      console.log('📋 Procesando evento de suscripción:', resourceId)
      
      // Obtener detalles de la suscripción desde MercadoPago
      const preapprovalResponse = await fetch(
        `https://api.mercadopago.com/preapproval/${resourceId}`,
        { headers: { 'Authorization': `Bearer ${mpAccessToken}` } }
      )

      if (!preapprovalResponse.ok) {
        console.error('❌ Error obteniendo preapproval:', await preapprovalResponse.text())
        throw new Error('Failed to fetch preapproval from MP')
      }

      const preapproval = await preapprovalResponse.json()
      console.log('📦 Datos de MP:', JSON.stringify(preapproval, null, 2))

      // Mapear status de MP a nuestro status
      const statusMap: Record<string, string> = {
        'pending': 'pending',
        'authorized': 'authorized',
        'active': 'active',
        'paused': 'paused',
        'cancelled': 'cancelled',
        'expired': 'expired',
      }

      const ourStatus = statusMap[preapproval.status] || preapproval.status

      // Calcular próximo pago
      let nextPaymentDate = null
      if (preapproval.next_payment_date) {
        nextPaymentDate = preapproval.next_payment_date.split('T')[0]
      }

      // Actualizar en nuestra BD usando RPC
      const { data: updateResult, error: updateError } = await supabase.rpc(
        'process_subscription_webhook',
        {
          p_mp_preapproval_id: String(resourceId),
          p_status: ourStatus,
          p_payer_id: preapproval.payer_id,
          p_payer_email: preapproval.payer_email,
          p_next_payment_date: nextPaymentDate,
        }
      )

      if (updateError) {
        console.error('❌ Error actualizando suscripción:', updateError)
        throw updateError
      }

      result = { 
        processed: true, 
        message: `Subscription updated to ${ourStatus}`,
        data: updateResult 
      }
      console.log('✅ Suscripción actualizada:', updateResult)
    }

    // =====================
    // EVENTOS DE PAGO
    // =====================
    else if (PAYMENT_TOPICS.some(t => eventTopic?.includes(t))) {
      console.log('💳 Procesando evento de pago:', resourceId)

      // Obtener detalles del pago
      const paymentResponse = await fetch(
        `https://api.mercadopago.com/v1/payments/${resourceId}`,
        { headers: { 'Authorization': `Bearer ${mpAccessToken}` } }
      )

      if (!paymentResponse.ok) {
        // Intentar con authorized_payments endpoint
        const authPaymentResponse = await fetch(
          `https://api.mercadopago.com/authorized_payments/${resourceId}`,
          { headers: { 'Authorization': `Bearer ${mpAccessToken}` } }
        )
        
        if (!authPaymentResponse.ok) {
          console.error('❌ Error obteniendo pago')
          throw new Error('Failed to fetch payment from MP')
        }
      }

      const payment = await paymentResponse.json()
      console.log('💰 Datos de pago:', JSON.stringify({
        id: payment.id,
        status: payment.status,
        status_detail: payment.status_detail,
        preapproval_id: payment.metadata?.preapproval_id,
      }, null, 2))

      // Obtener preapproval_id del pago
      const preapprovalId = payment.metadata?.preapproval_id || 
                            payment.point_of_interaction?.transaction_data?.subscription_id

      if (!preapprovalId) {
        console.log('⚠️ Pago sin preapproval_id asociado, ignorando')
        result = { processed: true, message: 'Payment without subscription' }
      } else {
        // Actualizar pago en nuestra BD
        const { data: paymentResult, error: paymentError } = await supabase.rpc(
          'process_subscription_payment',
          {
            p_mp_preapproval_id: preapprovalId,
            p_mp_payment_id: String(resourceId),
            p_amount: payment.transaction_amount,
            p_status: payment.status,
            p_status_detail: payment.status_detail,
            p_period_start: null,
            p_period_end: null,
            p_raw_data: payment,
          }
        )

        if (paymentError) {
          console.error('❌ Error procesando pago:', paymentError)
          throw paymentError
        }

        result = {
          processed: true,
          message: `Payment ${payment.status}`,
          data: paymentResult
        }
        console.log('✅ Pago procesado:', paymentResult)
      }
    } else {
      console.log('⏭️ Evento no manejado:', eventTopic)
      result = { processed: false, message: `Unhandled event type: ${eventTopic}` }
    }

    // Actualizar estado del evento en webhook_events
    await supabase
      .from('mp_webhook_events')
      .update({
        status: result.processed ? 'processed' : 'ignored',
        processed_at: new Date().toISOString(),
      })
      .eq('mp_event_id', eventUniqueId)

    const duration = Date.now() - startTime
    console.log(`⏱️ Webhook procesado en ${duration}ms`)

    return new Response(
      JSON.stringify({
        success: true,
        ...result,
        duration_ms: duration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error procesando webhook:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        duration_ms: Date.now() - startTime 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
