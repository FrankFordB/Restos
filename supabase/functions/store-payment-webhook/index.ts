// Supabase Edge Function: Store Payment Webhook
// Recibe notificaciones de MercadoPago para pagos de tiendas
// Valida firma, verifica el pago con MP API, y actualiza la orden
//
// Deploy: supabase functions deploy store-payment-webhook

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature, x-request-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

/**
 * Valida la firma del webhook de MercadoPago
 * https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks#verificar-origen
 */
function validateSignature(
  xSignature: string,
  xRequestId: string,
  dataId: string,
  secret: string
): boolean {
  if (!xSignature || !secret) {
    console.warn('⚠️ Firma o secret no disponible')
    return false
  }

  try {
    // Parsear x-signature: ts=xxx,v1=xxx
    const parts = xSignature.split(',')
    let ts = ''
    let hash = ''
    
    for (const part of parts) {
      const [key, value] = part.split('=')
      if (key === 'ts') ts = value
      if (key === 'v1') hash = value
    }

    if (!ts || !hash) {
      console.warn('⚠️ Formato de firma inválido')
      return false
    }

    // Construir manifest
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
    
    // Calcular HMAC
    const hmac = createHmac('sha256', secret)
    hmac.update(manifest)
    const calculatedHash = hmac.digest('hex')

    const isValid = calculatedHash === hash
    console.log(`🔐 Validación de firma: ${isValid ? '✅' : '❌'}`)
    
    return isValid
  } catch (error) {
    console.error('Error validando firma:', error)
    return false
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // Headers de MercadoPago
    const xSignature = req.headers.get('x-signature') || ''
    const xRequestId = req.headers.get('x-request-id') || ''
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || ''
    const userAgent = req.headers.get('user-agent') || ''

    // Parsear body
    const body = await req.text()
    const payload = JSON.parse(body)

    console.log('📥 Webhook recibido:', {
      type: payload.type,
      action: payload.action,
      dataId: payload.data?.id,
      xRequestId,
    })

    // Solo procesar eventos de tipo payment
    if (payload.type !== 'payment') {
      console.log('ℹ️ Evento ignorado (no es payment):', payload.type)
      return new Response(
        JSON.stringify({ status: 'ignored', reason: 'not_payment_event' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const paymentId = payload.data?.id?.toString()
    if (!paymentId) {
      return new Response(
        JSON.stringify({ error: 'No payment ID in webhook' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verificar idempotencia - evitar procesar el mismo evento dos veces
    const { data: existingEvent } = await supabase
      .from('payment_events')
      .select('id, status')
      .eq('mp_payment_id', paymentId)
      .eq('status', 'completed')
      .maybeSingle()

    if (existingEvent) {
      console.log('⚡ Pago ya procesado:', paymentId)
      return new Response(
        JSON.stringify({ status: 'already_processed', eventId: existingEvent.id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Para obtener el access_token correcto, necesitamos saber el tenant
    // Primero buscar la orden por el preference_id o consultar el pago con token global (si existe)
    
    // Intentar obtener info básica del pago para encontrar el tenant
    // Usamos la API pública que no requiere token específico para metadatos
    let tenantId: string | null = null
    let orderId: string | null = null
    let tenantAccessToken: string | null = null
    
    // Buscar orden por mp_payment_id (si ya fue actualizada)
    const { data: orderByPayment } = await supabase
      .from('orders')
      .select('id, tenant_id')
      .eq('mp_payment_id', paymentId)
      .maybeSingle()

    if (orderByPayment) {
      orderId = orderByPayment.id
      tenantId = orderByPayment.tenant_id
    }

    // Si no encontramos por payment_id, buscar por preference_id en metadata del webhook
    if (!tenantId && payload.data?.metadata?.tenant_id) {
      tenantId = payload.data.metadata.tenant_id
      orderId = payload.data.metadata.order_id
    }

    // Si aún no tenemos tenant, intentar buscar órdenes pendientes recientes
    if (!tenantId) {
      console.warn('⚠️ No se pudo determinar tenant_id directamente')
      // Buscaremos cuando tengamos el external_reference del pago
    }

    // Obtener credenciales del tenant para consultar el pago
    if (tenantId) {
      const { data: mpCreds } = await supabase
        .from('tenant_mercadopago')
        .select('access_token, sandbox_access_token, is_sandbox, webhook_secret')
        .eq('tenant_id', tenantId)
        .single()

      if (mpCreds) {
        tenantAccessToken = mpCreds.is_sandbox 
          ? mpCreds.sandbox_access_token 
          : mpCreds.access_token

        // Validar firma si hay webhook_secret configurado
        if (mpCreds.webhook_secret) {
          const isValidSignature = validateSignature(
            xSignature,
            xRequestId,
            paymentId,
            mpCreds.webhook_secret
          )

          if (!isValidSignature) {
            console.warn('⚠️ Firma de webhook inválida')
            // Registrar evento con firma inválida
            await supabase.from('payment_events').insert({
              mp_payment_id: paymentId,
              mp_event_id: xRequestId,
              mp_event_type: payload.type,
              tenant_id: tenantId,
              order_id: orderId,
              flow_type: 'customer_purchase',
              signature_valid: false,
              ip_address: ipAddress,
              user_agent: userAgent,
              raw_payload: payload,
              status: 'failed',
              error_message: 'Firma inválida',
            })

            return new Response(
              JSON.stringify({ error: 'Invalid signature' }),
              { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        }
      }
    }

    // Si no tenemos token, usar uno global de emergencia (si está configurado)
    if (!tenantAccessToken) {
      tenantAccessToken = Deno.env.get('MP_FALLBACK_ACCESS_TOKEN') || null
      console.warn('⚠️ Usando token de fallback')
    }

    if (!tenantAccessToken) {
      console.error('❌ No se pudo obtener access_token para verificar el pago')
      return new Response(
        JSON.stringify({ error: 'No access token available' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ========================================
    // CONSULTAR PAGO EN MERCADOPAGO (OBLIGATORIO)
    // ========================================
    console.log('🔍 Consultando pago en MercadoPago:', paymentId)

    const mpResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: { 'Authorization': `Bearer ${tenantAccessToken}` }
      }
    )

    if (!mpResponse.ok) {
      const errorText = await mpResponse.text()
      console.error('❌ Error consultando pago:', mpResponse.status, errorText)
      
      // Registrar evento fallido
      await supabase.from('payment_events').insert({
        mp_payment_id: paymentId,
        mp_event_id: xRequestId,
        mp_event_type: payload.type,
        tenant_id: tenantId,
        order_id: orderId,
        flow_type: 'customer_purchase',
        signature_valid: true,
        ip_address: ipAddress,
        user_agent: userAgent,
        raw_payload: payload,
        status: 'failed',
        error_message: `Error consultando MP: ${mpResponse.status}`,
      })

      return new Response(
        JSON.stringify({ error: 'Error verifying payment with MercadoPago' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const payment = await mpResponse.json()
    console.log('💳 Pago verificado:', {
      id: payment.id,
      status: payment.status,
      status_detail: payment.status_detail,
      amount: payment.transaction_amount,
      currency: payment.currency_id,
      external_reference: payment.external_reference,
    })

    // Parsear external_reference para obtener datos de la orden
    let externalRef: any = {}
    try {
      externalRef = JSON.parse(payment.external_reference || '{}')
    } catch {
      externalRef = { raw: payment.external_reference }
    }

    // Verificar que sea una compra de cliente (no suscripción)
    if (externalRef.type !== 'customer_purchase') {
      console.log('ℹ️ Pago no es customer_purchase:', externalRef.type)
      return new Response(
        JSON.stringify({ status: 'ignored', reason: 'not_customer_purchase' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Actualizar IDs si los obtuvimos del external_reference
    if (!orderId) orderId = externalRef.orderId
    if (!tenantId) tenantId = externalRef.tenantId

    if (!orderId || !tenantId) {
      console.error('❌ No se pudo obtener orderId o tenantId')
      return new Response(
        JSON.stringify({ error: 'Missing orderId or tenantId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ========================================
    // VALIDACIONES ANTI-FRAUDE
    // ========================================
    
    // 1. Obtener orden de la DB
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, tenant_id, total, payment_status, idempotency_key')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      console.error('❌ Orden no encontrada:', orderId)
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Validar que el tenant coincide
    if (order.tenant_id !== tenantId) {
      console.error('❌ Tenant no coincide:', order.tenant_id, '!=', tenantId)
      await supabase.from('payment_events').insert({
        mp_payment_id: paymentId,
        mp_event_id: xRequestId,
        tenant_id: tenantId,
        order_id: orderId,
        flow_type: 'customer_purchase',
        status: 'failed',
        error_message: 'Tenant mismatch',
        raw_payload: payload,
        verification_result: { order_tenant: order.tenant_id, payment_tenant: tenantId },
      })

      return new Response(
        JSON.stringify({ error: 'Tenant mismatch' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Validar currency
    if (payment.currency_id !== 'ARS') {
      console.warn('⚠️ Moneda diferente a ARS:', payment.currency_id)
      // No rechazamos, solo advertimos (podría ser USD en algunos casos)
    }

    // 4. Validar monto (con tolerancia del 1% por redondeos)
    const tolerance = order.total * 0.01
    if (Math.abs(payment.transaction_amount - order.total) > tolerance) {
      console.warn('⚠️ Discrepancia de monto:', {
        orderTotal: order.total,
        paymentAmount: payment.transaction_amount,
        difference: Math.abs(payment.transaction_amount - order.total)
      })
      // No rechazamos automáticamente, pero lo registramos
    }

    // ========================================
    // REGISTRAR EVENTO Y ACTUALIZAR ORDEN
    // ========================================

    // Registrar evento de webhook
    const { data: eventRecord } = await supabase
      .from('payment_events')
      .insert({
        mp_payment_id: paymentId,
        mp_event_id: xRequestId,
        mp_event_type: payload.type,
        mp_preference_id: payment.preference_id,
        tenant_id: tenantId,
        order_id: orderId,
        flow_type: 'customer_purchase',
        signature_valid: true,
        ip_address: ipAddress,
        user_agent: userAgent,
        raw_payload: payload,
        verification_result: {
          mp_status: payment.status,
          mp_status_detail: payment.status_detail,
          transaction_amount: payment.transaction_amount,
          currency_id: payment.currency_id,
          payer_email: payment.payer?.email,
        },
        status: 'processing',
      })
      .select('id')
      .single()

    // Usar función de DB para actualizar de forma idempotente
    // Solo actualizar la orden como pagada si MercadoPago confirma 'approved'
    let updateResult = null;
    let updateError = null;
    if (payment.status === MP_STATUS.APPROVED) {
      // Usar la función mark_order_paid para marcar el pedido como pagado
      const update = await supabase
        .rpc('mark_order_paid', {
          p_order_id: orderId,
          p_is_paid: true
        });
      updateResult = update.data;
      updateError = update.error;
    } else {
      console.log('ℹ️ Pago no aprobado, no se marca como pagado:', payment.status);
    }

    if (updateError) {
      console.error('❌ Error actualizando orden:', updateError)
      
      // Actualizar evento como fallido
      if (eventRecord?.id) {
        await supabase
          .from('payment_events')
          .update({ status: 'failed', error_message: updateError.message })
          .eq('id', eventRecord.id)
      }

      return new Response(
        JSON.stringify({ error: 'Error updating order' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Marcar evento como completado
    if (eventRecord?.id) {
      await supabase
        .from('payment_events')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString(),
          verified_at: new Date().toISOString(),
        })
        .eq('id', eventRecord.id)
    }

    console.log('✅ Pago procesado exitosamente:', updateResult)

    return new Response(
      JSON.stringify({
        status: 'ok',
        result: updateResult,
        orderId,
        paymentId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error en store-payment-webhook:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
