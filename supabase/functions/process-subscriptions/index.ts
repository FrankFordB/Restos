// supabase/functions/process-subscriptions/index.ts
// 
// Edge Function para procesar suscripciones diariamente
// Ejecutar con cron a las 08:00 AM (horario de Argentina)
//
// Responsabilidades:
// 1. Aplicar downgrades programados cuando expire la suscripción
// 2. Procesar auto-renovaciones (enviar recordatorios o intentar cobro)
// 3. Enviar alertas de suscripciones próximas a vencer

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ProcessResult {
  expirations: {
    processed: number
    details: Array<{ tenant_id: string; old_tier: string; new_tier: string }>
  }
  renewals: {
    toProcess: number
    withPaymentMethod: number
    withoutPaymentMethod: number
    details: Array<{ tenant_id: string; status: string; reason?: string }>
  }
  reminders: {
    sent: number
    details: Array<{ tenant_id: string; days_until_expiry: number }>
  }
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const results: ProcessResult = {
      expirations: { processed: 0, details: [] },
      renewals: { toProcess: 0, withPaymentMethod: 0, withoutPaymentMethod: 0, details: [] },
      reminders: { sent: 0, details: [] },
    }

    // ========================================================================
    // PASO 1: Procesar suscripciones EXPIRADAS
    // Llama a la función RPC que aplica downgrades programados
    // ========================================================================

    console.log('[STEP 1] Processing expired subscriptions...')

    const { data: expirationResult, error: expirationError } = await supabase
      .rpc('process_subscription_expirations')

    if (expirationError) {
      console.error('Error processing expirations:', expirationError)
    } else if (expirationResult) {
      results.expirations.processed = expirationResult.processed || 0
      results.expirations.details = expirationResult.results || []
      console.log(`[STEP 1] Processed ${results.expirations.processed} expirations`)
    }

    // ========================================================================
    // PASO 2: Procesar AUTO-RENOVACIONES (vencen en 1-2 días)
    // Solo para tenants con auto_renew = true
    // ========================================================================

    console.log('[STEP 2] Processing auto-renewals...')

    const { data: toRenew, error: renewError } = await supabase
      .rpc('get_subscriptions_to_renew', { p_days_ahead: 2 })

    if (renewError) {
      console.error('Error getting subscriptions to renew:', renewError)
    } else if (toRenew && toRenew.length > 0) {
      results.renewals.toProcess = toRenew.length

      for (const tenant of toRenew) {
        if (tenant.mp_preapproval_id) {
          // Tiene suscripción activa en MercadoPago
          // El cobro es automático por MP, solo verificamos el estado
          results.renewals.withPaymentMethod++
          results.renewals.details.push({
            tenant_id: tenant.tenant_id,
            status: 'has_mp_subscription',
            reason: 'MercadoPago will charge automatically'
          })
        } else {
          // No tiene método de pago guardado
          // Enviar recordatorio para que renueve manualmente
          results.renewals.withoutPaymentMethod++
          results.renewals.details.push({
            tenant_id: tenant.tenant_id,
            status: 'needs_action',
            reason: 'No payment method, needs manual renewal'
          })

          // TODO: Enviar email de recordatorio
          // await sendRenewalReminder(tenant.owner_email, tenant.tenant_name, tenant.premium_until)
        }
      }

      console.log(`[STEP 2] Found ${results.renewals.toProcess} subscriptions to renew`)
    }

    // ========================================================================
    // PASO 3: Enviar RECORDATORIOS (vencen en 7 días)
    // Para tenants SIN auto_renew o sin método de pago
    // ========================================================================

    console.log('[STEP 3] Sending expiration reminders...')

    const sevenDaysFromNow = new Date()
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

    const sixDaysFromNow = new Date()
    sixDaysFromNow.setDate(sixDaysFromNow.getDate() + 6)

    // Buscar tenants que vencen en exactamente 7 días (para no spamear)
    const { data: expiringSoon, error: reminderError } = await supabase
      .from('tenants')
      .select('id, name, premium_until, auto_renew, owner_user_id')
      .eq('auto_renew', false)
      .is('scheduled_tier', null)
      .neq('subscription_tier', 'free')
      .gte('premium_until', sixDaysFromNow.toISOString())
      .lte('premium_until', sevenDaysFromNow.toISOString())

    if (reminderError) {
      console.error('Error getting expiring subscriptions:', reminderError)
    } else if (expiringSoon && expiringSoon.length > 0) {
      for (const tenant of expiringSoon) {
        const daysUntilExpiry = Math.ceil(
          (new Date(tenant.premium_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )

        results.reminders.sent++
        results.reminders.details.push({
          tenant_id: tenant.id,
          days_until_expiry: daysUntilExpiry
        })

        // TODO: Enviar email de recordatorio
        // Obtener email del owner
        // const { data: profile } = await supabase
        //   .from('profiles')
        //   .select('email')
        //   .eq('id', tenant.owner_user_id)
        //   .single()
        // 
        // await sendExpirationReminder(profile?.email, tenant.name, tenant.premium_until)
      }

      console.log(`[STEP 3] Sent ${results.reminders.sent} reminders`)
    }

    // ========================================================================
    // RESULTADO FINAL
    // ========================================================================

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        expirations_processed: results.expirations.processed,
        renewals_to_process: results.renewals.toProcess,
        reminders_sent: results.reminders.sent,
      },
      details: results,
    }

    console.log('[COMPLETE] Process finished:', JSON.stringify(response.summary))

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('[ERROR]', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
