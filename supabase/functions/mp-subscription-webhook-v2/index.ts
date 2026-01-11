/**
 * Edge Function: Webhook de Suscripciones MercadoPago
 * 
 * Esta función recibe notificaciones de MercadoPago y actualiza
 * el estado de las suscripciones en la base de datos.
 * 
 * Deploy con: supabase functions deploy mp-subscription-webhook
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Tipos de eventos que procesamos
const HANDLED_EVENTS = [
  'subscription.authorized',
  'subscription.pending_cancel_end',
  'subscription.cancelled',
  'subscription.paused',
  'subscription.expired',
  'payment.created',
  'payment.approved',
  'payment.rejected',
  'payment.cancelled',
];

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Crear cliente Supabase con service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Obtener datos del webhook
    const body = await req.json()
    console.log('📥 Webhook recibido:', JSON.stringify(body, null, 2))

    const { type, data, action } = body
    const eventType = type || action

    // Verificar si es un evento que procesamos
    if (!eventType || !HANDLED_EVENTS.some(e => eventType.includes(e))) {
      console.log('⏭️ Evento no manejado:', eventType)
      return new Response(
        JSON.stringify({ success: true, message: 'Event not handled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Obtener ID de la suscripción o pago
    const resourceId = data?.id
    if (!resourceId) {
      console.error('❌ No resource ID in webhook')
      return new Response(
        JSON.stringify({ error: 'No resource ID' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Para pagos, necesitamos obtener info adicional de MercadoPago
    let subscriptionId = resourceId
    let paymentStatus = null

    if (eventType.includes('payment')) {
      // Obtener detalles del pago de MercadoPago
      const mpAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')
      
      if (mpAccessToken) {
        try {
          const paymentResponse = await fetch(
            `https://api.mercadopago.com/v1/payments/${resourceId}`,
            {
              headers: {
                'Authorization': `Bearer ${mpAccessToken}`,
              }
            }
          )
          
          if (paymentResponse.ok) {
            const paymentData = await paymentResponse.json()
            subscriptionId = paymentData.metadata?.preapproval_id || 
                            paymentData.metadata?.subscription_id ||
                            paymentData.external_reference
            paymentStatus = paymentData.status
          }
        } catch (err) {
          console.error('Error fetching payment details:', err)
        }
      }
    }

    // Buscar la suscripción en nuestra base de datos
    const { data: subscription, error: subError } = await supabase
      .from('platform_subscriptions')
      .select('*, tenants(*)')
      .eq('mp_subscription_id', subscriptionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (subError || !subscription) {
      console.log('⚠️ Suscripción no encontrada:', subscriptionId)
      // Intentar buscar por external_reference
      const { data: altSub } = await supabase
        .from('platform_subscriptions')
        .select('*, tenants(*)')
        .eq('external_reference', subscriptionId)
        .limit(1)
        .single()

      if (!altSub) {
        return new Response(
          JSON.stringify({ success: true, message: 'Subscription not found in database' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }
    }

    const tenantId = subscription?.tenant_id

    // Mapear evento a estado
    let newStatus = null
    let shouldDowngrade = false

    switch (true) {
      case eventType.includes('subscription.authorized'):
      case eventType.includes('payment.approved'):
        newStatus = 'active'
        break

      case eventType.includes('subscription.cancelled'):
      case eventType.includes('subscription.expired'):
        newStatus = 'cancelled'
        shouldDowngrade = true
        break

      case eventType.includes('subscription.paused'):
      case eventType.includes('payment.rejected'):
      case eventType.includes('payment.cancelled'):
        newStatus = 'past_due'
        break

      case eventType.includes('subscription.pending_cancel_end'):
        // El usuario canceló pero tiene tiempo restante
        await supabase
          .from('tenants')
          .update({ 
            auto_renew: false,
            scheduled_tier: 'free'
          })
          .eq('id', tenantId)
        break
    }

    // Actualizar estado si es necesario
    if (newStatus) {
      // Actualizar platform_subscriptions
      await supabase
        .from('platform_subscriptions')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString(),
          ...(newStatus === 'cancelled' ? { cancelled_at: new Date().toISOString() } : {})
        })
        .eq('id', subscription.id)

      // Actualizar tenant
      await supabase
        .from('tenants')
        .update({ subscription_status: newStatus })
        .eq('id', tenantId)

      console.log(`✅ Estado actualizado: ${newStatus} para tenant ${tenantId}`)
    }

    // Ejecutar downgrade si es necesario
    if (shouldDowngrade && tenantId) {
      console.log('🔄 Ejecutando downgrade para tenant:', tenantId)
      
      const { data: downgradeResult, error: downgradeError } = await supabase
        .rpc('execute_subscription_downgrade', { p_tenant_id: tenantId })

      if (downgradeError) {
        console.error('❌ Error en downgrade:', downgradeError)
      } else {
        console.log('✅ Downgrade ejecutado:', downgradeResult)
      }
    }

    // Log del evento
    await supabase
      .from('subscription_logs')
      .insert({
        tenant_id: tenantId,
        event_type: eventType,
        description: `Webhook MP: ${eventType}`,
        metadata: {
          resource_id: resourceId,
          subscription_id: subscriptionId,
          payment_status: paymentStatus,
          raw_data: body
        }
      })

    return new Response(
      JSON.stringify({ 
        success: true, 
        event: eventType,
        processed: true 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('❌ Error procesando webhook:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
