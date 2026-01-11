// Edge Function: Crear Suscripción en MercadoPago
// POST /create-subscription
// Body: { plan: 'premium' | 'premium_pro', tenant_id: UUID }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Configuración de planes
const PLANS = {
  premium: {
    id: 'RESTO_PREMIUM_MONTHLY',
    tier: 'premium',
    amount: 4990,
    reason: 'Suscripción Resto Premium - Mensual',
  },
  premium_pro: {
    id: 'RESTO_PRO_MONTHLY',
    tier: 'premium_pro',
    amount: 7990,
    reason: 'Suscripción Resto PRO - Mensual',
  },
}

Deno.serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')
    const appUrl = Deno.env.get('APP_URL') || 'https://tuapp.com'

    if (!mpAccessToken) {
      throw new Error('MP_ACCESS_TOKEN not configured')
    }

    // Obtener authorization header para identificar usuario
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Crear cliente Supabase con el token del usuario
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Verificar usuario autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parsear body
    const body = await req.json()
    const { plan, tenant_id } = body

    if (!plan || !tenant_id) {
      return new Response(
        JSON.stringify({ error: 'Missing plan or tenant_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const planConfig = PLANS[plan as keyof typeof PLANS]
    if (!planConfig) {
      return new Response(
        JSON.stringify({ error: 'Invalid plan. Must be premium or premium_pro' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verificar que el usuario sea dueño del tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, owner_user_id')
      .eq('id', tenant_id)
      .single()

    if (tenantError || !tenant) {
      return new Response(
        JSON.stringify({ error: 'Tenant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (tenant.owner_user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Not authorized for this tenant' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verificar si ya tiene una suscripción activa
    const { data: existingSub } = await supabase
      .from('mp_subscriptions')
      .select('*')
      .eq('tenant_id', tenant_id)
      .in('status', ['active', 'authorized', 'pending'])
      .single()

    if (existingSub) {
      return new Response(
        JSON.stringify({ 
          error: 'Ya tienes una suscripción activa',
          existing_subscription: {
            plan: existingSub.plan_tier,
            status: existingSub.status,
            next_billing: existingSub.next_billing_date
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // External reference para trackear
    const externalReference = `${tenant_id}|${planConfig.tier}|${Date.now()}`

    // Crear Preapproval en MercadoPago
    const preapprovalBody = {
      reason: planConfig.reason,
      external_reference: externalReference,
      payer_email: user.email,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: planConfig.amount,
        currency_id: 'ARS',
      },
      back_url: `${appUrl}/dashboard/subscription?result=success`,
      status: 'pending', // Empieza pendiente hasta que el usuario autorice
    }

    console.log('Creating preapproval:', JSON.stringify(preapprovalBody))

    const mpResponse = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preapprovalBody),
    })

    const mpData = await mpResponse.json()

    if (!mpResponse.ok) {
      console.error('MercadoPago error:', mpData)
      return new Response(
        JSON.stringify({ 
          error: 'Error creating subscription in MercadoPago',
          details: mpData.message || mpData.error
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Preapproval created:', mpData.id)

    // Guardar en nuestra DB usando service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    
    const { error: insertError } = await supabaseAdmin.rpc('create_mp_subscription_record', {
      p_tenant_id: tenant_id,
      p_preapproval_id: mpData.id,
      p_plan_id: planConfig.id,
      p_plan_tier: planConfig.tier,
      p_amount: planConfig.amount,
      p_external_reference: externalReference,
    })

    if (insertError) {
      console.error('Error saving subscription record:', insertError)
      // No fallamos aquí porque la suscripción ya se creó en MP
      // El webhook la activará de todos modos
    }

    // Retornar la URL para que el usuario autorice
    return new Response(
      JSON.stringify({
        success: true,
        preapproval_id: mpData.id,
        init_point: mpData.init_point,
        sandbox_init_point: mpData.sandbox_init_point,
        plan: planConfig,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
