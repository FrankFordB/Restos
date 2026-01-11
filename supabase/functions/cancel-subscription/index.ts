// Edge Function: Cancelar Suscripción en MercadoPago
// POST /cancel-subscription
// Body: { tenant_id: UUID }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')

    if (!mpAccessToken) {
      throw new Error('MP_ACCESS_TOKEN not configured')
    }

    // Verificar autenticación
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Verificar usuario
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parsear body
    const body = await req.json()
    const { tenant_id, immediate = false } = body

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ error: 'Missing tenant_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verificar que el usuario sea dueño del tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, owner_user_id')
      .eq('id', tenant_id)
      .single()

    if (tenantError || !tenant || tenant.owner_user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Not authorized for this tenant' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar suscripción activa
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('mp_subscriptions')
      .select('*')
      .eq('tenant_id', tenant_id)
      .in('status', ['active', 'authorized', 'pending'])
      .single()

    if (subError || !subscription) {
      return new Response(
        JSON.stringify({ error: 'No active subscription found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Cancelar en MercadoPago
    const mpResponse = await fetch(
      `https://api.mercadopago.com/preapproval/${subscription.mp_preapproval_id}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${mpAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'cancelled' }),
      }
    )

    if (!mpResponse.ok) {
      const mpError = await mpResponse.json()
      console.error('MercadoPago cancel error:', mpError)
      return new Response(
        JSON.stringify({ 
          error: 'Error cancelling subscription in MercadoPago',
          details: mpError.message || mpError.error
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Actualizar en nuestra DB
    const { data: result, error: rpcError } = await supabaseAdmin.rpc('cancel_mp_subscription', {
      p_preapproval_id: subscription.mp_preapproval_id,
      p_immediate: immediate,
    })

    if (rpcError) {
      console.error('Error updating DB:', rpcError)
    }

    // Calcular mensaje según si es inmediato o no
    const message = immediate 
      ? 'Suscripción cancelada inmediatamente'
      : `Suscripción cancelada. Tus beneficios continuarán hasta ${new Date(subscription.next_billing_date).toLocaleDateString('es-AR')}`

    return new Response(
      JSON.stringify({
        success: true,
        message,
        end_date: immediate ? new Date().toISOString() : subscription.next_billing_date,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
