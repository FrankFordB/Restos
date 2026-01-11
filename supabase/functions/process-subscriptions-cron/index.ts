/**
 * Edge Function: Procesador de Suscripciones Vencidas
 * 
 * Esta función debe ejecutarse periódicamente (cron job) para:
 * - Detectar suscripciones vencidas
 * - Ejecutar downgrades automáticos
 * - Limpiar estados inconsistentes
 * 
 * Configurar cron en Supabase Dashboard:
 * - Path: /functions/v1/process-subscriptions-cron
 * - Schedule: 0 * * * * (cada hora) o 0 0 * * * (diario a medianoche)
 * 
 * Deploy: supabase functions deploy process-subscriptions-cron
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()
  console.log('🕐 Iniciando procesamiento de suscripciones:', new Date().toISOString())

  try {
    // Verificar autorización (cron o service role)
    const authHeader = req.headers.get('authorization')
    const cronSecret = Deno.env.get('CRON_SECRET')
    
    // Si hay un secret de cron configurado, verificarlo
    if (cronSecret) {
      const providedSecret = req.headers.get('x-cron-secret')
      if (providedSecret !== cronSecret) {
        console.error('❌ Cron secret inválido')
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        )
      }
    }

    // Crear cliente Supabase con service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Estadísticas
    const stats = {
      expired_processed: 0,
      downgrades_executed: 0,
      errors: 0,
      past_due_checked: 0,
      inconsistencies_fixed: 0
    }

    // 1. PROCESAR SUSCRIPCIONES VENCIDAS
    console.log('📋 Buscando suscripciones vencidas...')
    
    const { data: expiredTenants, error: expiredError } = await supabase
      .from('tenants')
      .select('id, name, subscription_tier, premium_until, subscription_status, auto_renew')
      .neq('subscription_tier', 'free')
      .lt('premium_until', new Date().toISOString())
      .eq('subscription_status', 'active')

    if (expiredError) {
      console.error('❌ Error buscando tenants vencidos:', expiredError)
    } else if (expiredTenants && expiredTenants.length > 0) {
      console.log(`📍 Encontrados ${expiredTenants.length} tenants con suscripción vencida`)

      for (const tenant of expiredTenants) {
        try {
          stats.expired_processed++
          
          // Si tiene auto_renew, solo marcar como past_due (esperando pago)
          if (tenant.auto_renew) {
            await supabase
              .from('tenants')
              .update({ subscription_status: 'past_due' })
              .eq('id', tenant.id)
            
            console.log(`⏳ Tenant ${tenant.name} marcado como past_due (esperando renovación)`)
          } else {
            // Sin auto_renew, ejecutar downgrade
            const { data: result, error: downgradeError } = await supabase
              .rpc('execute_subscription_downgrade', { p_tenant_id: tenant.id })

            if (downgradeError) {
              console.error(`❌ Error downgrade ${tenant.name}:`, downgradeError)
              stats.errors++
            } else {
              console.log(`✅ Downgrade ejecutado para ${tenant.name}:`, result)
              stats.downgrades_executed++
            }
          }
        } catch (err) {
          console.error(`❌ Error procesando tenant ${tenant.id}:`, err)
          stats.errors++
        }
      }
    } else {
      console.log('✅ No hay suscripciones vencidas pendientes')
    }

    // 2. VERIFICAR TENANTS EN PAST_DUE (más de 3 días)
    console.log('📋 Verificando tenants en past_due...')
    
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

    const { data: pastDueTenants, error: pastDueError } = await supabase
      .from('tenants')
      .select('id, name, subscription_tier, premium_until')
      .eq('subscription_status', 'past_due')
      .lt('premium_until', threeDaysAgo.toISOString())

    if (!pastDueError && pastDueTenants && pastDueTenants.length > 0) {
      console.log(`📍 Encontrados ${pastDueTenants.length} tenants en past_due por más de 3 días`)

      for (const tenant of pastDueTenants) {
        stats.past_due_checked++
        
        // Forzar downgrade
        const { error: downgradeError } = await supabase
          .rpc('execute_subscription_downgrade', { p_tenant_id: tenant.id })

        if (!downgradeError) {
          console.log(`✅ Downgrade forzado para ${tenant.name} (past_due > 3 días)`)
          stats.downgrades_executed++
        } else {
          stats.errors++
        }
      }
    }

    // 3. CORREGIR INCONSISTENCIAS
    console.log('📋 Verificando inconsistencias...')

    // Tenants FREE con premium_until o subscription_status incorrecto
    const { data: inconsistentFree } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('subscription_tier', 'free')
      .or('premium_until.not.is.null,subscription_status.neq.active')

    if (inconsistentFree && inconsistentFree.length > 0) {
      console.log(`📍 Corrigiendo ${inconsistentFree.length} tenants FREE inconsistentes`)

      await supabase
        .from('tenants')
        .update({
          premium_until: null,
          subscription_status: 'active',
          auto_renew: false,
          orders_limit: 15,
          orders_remaining: 15
        })
        .eq('subscription_tier', 'free')
        .or('premium_until.not.is.null,subscription_status.neq.active')

      stats.inconsistencies_fixed += inconsistentFree.length
    }

    // Tenants premium sin premium_until
    const { data: premiumNoExpiry } = await supabase
      .from('tenants')
      .select('id, name, subscription_tier')
      .neq('subscription_tier', 'free')
      .is('premium_until', null)

    if (premiumNoExpiry && premiumNoExpiry.length > 0) {
      console.log(`⚠️ Encontrados ${premiumNoExpiry.length} tenants premium sin fecha de expiración`)
      
      for (const tenant of premiumNoExpiry) {
        // Forzar downgrade por seguridad
        await supabase
          .rpc('execute_subscription_downgrade', { p_tenant_id: tenant.id })
        
        stats.inconsistencies_fixed++
        console.log(`✅ Corregido ${tenant.name}: downgrade por falta de premium_until`)
      }
    }

    // Log de ejecución
    const duration = Date.now() - startTime
    console.log('📊 Resumen de procesamiento:', stats)
    console.log(`⏱️ Duración: ${duration}ms`)

    // Guardar log en la base de datos
    await supabase
      .from('subscription_logs')
      .insert({
        tenant_id: null,
        event_type: 'cron_execution',
        description: 'Ejecución de cron job de suscripciones',
        metadata: {
          ...stats,
          duration_ms: duration,
          executed_at: new Date().toISOString()
        }
      })

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        duration_ms: duration,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('❌ Error en cron job:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
