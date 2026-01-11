// Edge Function: Auto-Renovación de Suscripciones
// Se ejecuta diariamente via cron para renovar suscripciones que vencen mañana
// 
// Para configurar el cron en Supabase:
// 1. Ve a Database > Extensions y habilita pg_cron
// 2. Ejecuta: SELECT cron.schedule('auto-renewal', '0 8 * * *', $$SELECT net.http_post(...)$$)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Precios de los planes
const TIER_PRICES = {
  premium: { monthly: 14999, yearly: 149990 },
  premium_pro: { monthly: 29999, yearly: 299990 },
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Crear cliente de Supabase con service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const mpAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Obtener suscripciones que vencen mañana con auto_renew activo
    const { data: subscriptions, error: fetchError } = await supabase
      .rpc('get_subscriptions_to_renew')

    if (fetchError) {
      throw new Error(`Error fetching subscriptions: ${fetchError.message}`)
    }

    console.log(`Found ${subscriptions?.length || 0} subscriptions to renew`)

    const results = {
      processed: 0,
      success: 0,
      failed: 0,
      details: [] as any[],
    }

    for (const sub of subscriptions || []) {
      results.processed++
      
      try {
        // Si no tiene método de pago guardado, no podemos cobrar automáticamente
        if (!sub.mp_card_id || !sub.mp_customer_id) {
          // Crear preferencia de pago y enviar email
          await sendRenewalReminder(supabase, sub)
          results.details.push({
            tenant_id: sub.tenant_id,
            status: 'reminder_sent',
            message: 'No payment method saved, reminder sent',
          })
          continue
        }

        // Procesar pago con MercadoPago
        const amount = TIER_PRICES[sub.subscription_tier as keyof typeof TIER_PRICES]?.monthly || 14999
        
        const paymentResult = await processAutoRenewalPayment({
          accessToken: mpAccessToken!,
          customerId: sub.mp_customer_id,
          cardId: sub.mp_card_id,
          amount,
          description: `Renovación ${sub.subscription_tier} - ${sub.tenant_name}`,
          tenantId: sub.tenant_id,
        })

        if (paymentResult.status === 'approved') {
          // Actualizar suscripción
          const newExpiry = new Date(sub.premium_until)
          newExpiry.setDate(newExpiry.getDate() + 30) // +30 días

          await supabase
            .from('tenants')
            .update({
              premium_until: newExpiry.toISOString(),
              subscription_status: 'active',
            })
            .eq('id', sub.tenant_id)

          // Registrar renovación exitosa
          await supabase.rpc('log_renewal_attempt', {
            p_tenant_id: sub.tenant_id,
            p_tier: sub.subscription_tier,
            p_amount: amount,
            p_status: 'success',
            p_payment_id: paymentResult.id,
          })

          results.success++
          results.details.push({
            tenant_id: sub.tenant_id,
            status: 'success',
            payment_id: paymentResult.id,
          })
        } else {
          // Pago rechazado
          await supabase.rpc('log_renewal_attempt', {
            p_tenant_id: sub.tenant_id,
            p_tier: sub.subscription_tier,
            p_amount: amount,
            p_status: 'failed',
            p_error: paymentResult.status_detail || 'Payment rejected',
          })

          results.failed++
          results.details.push({
            tenant_id: sub.tenant_id,
            status: 'failed',
            reason: paymentResult.status_detail,
          })
        }
      } catch (error) {
        console.error(`Error processing renewal for ${sub.tenant_id}:`, error)
        results.failed++
        results.details.push({
          tenant_id: sub.tenant_id,
          status: 'error',
          error: error.message,
        })
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Processed ${results.processed} renewals: ${results.success} success, ${results.failed} failed`,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Auto-renewal error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// Procesar pago automático con tarjeta guardada
async function processAutoRenewalPayment(params: {
  accessToken: string
  customerId: string
  cardId: string
  amount: number
  description: string
  tenantId: string
}) {
  const response = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${params.accessToken}`,
      'X-Idempotency-Key': `renewal_${params.tenantId}_${Date.now()}`,
    },
    body: JSON.stringify({
      transaction_amount: params.amount / 100, // Convertir de centavos
      token: params.cardId,
      description: params.description,
      installments: 1,
      payment_method_id: 'card',
      payer: {
        id: params.customerId,
      },
      statement_descriptor: 'RESTOS',
      external_reference: JSON.stringify({
        type: 'auto_renewal',
        tenantId: params.tenantId,
      }),
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Payment failed')
  }

  return await response.json()
}

// Enviar recordatorio de renovación por email
async function sendRenewalReminder(supabase: any, subscription: any) {
  // Aquí podrías integrar con un servicio de email como Resend, SendGrid, etc.
  console.log(`Would send renewal reminder to ${subscription.owner_email} for ${subscription.tenant_name}`)
  
  // Por ahora solo registramos el intento
  await supabase.rpc('log_renewal_attempt', {
    p_tenant_id: subscription.tenant_id,
    p_tier: subscription.subscription_tier,
    p_amount: TIER_PRICES[subscription.subscription_tier as keyof typeof TIER_PRICES]?.monthly || 0,
    p_status: 'pending',
    p_error: 'No payment method - reminder sent',
  })
}
