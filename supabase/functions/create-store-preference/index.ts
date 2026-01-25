// Supabase Edge Function: Create Store Preference
// Crea una preferencia de pago de Checkout Pro para compras de clientes
// El dinero va DIRECTO al admin/tenant usando SU access_token
//
// Deploy: supabase functions deploy create-store-preference

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'https://deno.land/std@0.168.0/crypto/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface CartItem {
  productId: string
  name: string
  unitPrice: number
  qty: number
  lineTotal: number
  extras?: Array<{ id: string; name: string; price: number }>
  comment?: string
}

interface CreatePreferenceRequest {
  tenantId: string
  orderId?: string // Si ya existe la orden
  items: CartItem[]
  customer?: {
    name?: string
    phone?: string
    email?: string
  }
  deliveryType?: string
  deliveryAddress?: string
  deliveryNotes?: string
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

  try {
    const body: CreatePreferenceRequest = await req.json()
    const { tenantId, items, customer, deliveryType, deliveryAddress, deliveryNotes } = body

    // Validaciones básicas
    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'tenantId es requerido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'items es requerido y no puede estar vacío' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Inicializar Supabase con service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Obtener datos del tenant y sus credenciales MP
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, slug, name')
      .eq('id', tenantId)
      .single()

    if (tenantError || !tenant) {
      console.error('Tenant no encontrado:', tenantError)
      return new Response(
        JSON.stringify({ error: 'Tenant no encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Obtener credenciales de MercadoPago del ADMIN/TENANT
    const { data: mpCreds, error: mpError } = await supabase
      .from('tenant_mercadopago')
      .select('access_token, sandbox_access_token, is_sandbox, is_configured')
      .eq('tenant_id', tenantId)
      .single()

    if (mpError || !mpCreds || !mpCreds.is_configured) {
      console.error('MP no configurado para tenant:', mpError)
      return new Response(
        JSON.stringify({ 
          error: 'MercadoPago no está configurado para este local',
          code: 'MP_NOT_CONFIGURED'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Usar token según modo (sandbox o producción)
    const accessToken = mpCreds.is_sandbox 
      ? mpCreds.sandbox_access_token 
      : mpCreds.access_token

    if (!accessToken) {
      return new Response(
        JSON.stringify({ 
          error: 'Access token de MercadoPago no disponible',
          code: 'MP_NO_TOKEN'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. RECALCULAR TOTAL DESDE DB (anti-fraude)
    // Obtener precios reales de productos desde la base de datos
    const productIds = items.map(i => i.productId).filter(Boolean)
    
    let calculatedTotal = 0
    const verifiedItems: CartItem[] = []

    if (productIds.length > 0) {
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name, price')
        .in('id', productIds)

      if (productsError) {
        console.error('Error obteniendo productos:', productsError)
      }

      const productMap = new Map(products?.map(p => [p.id, p]) || [])

      for (const item of items) {
        const dbProduct = productMap.get(item.productId)
        
        // Usar precio de DB si existe, sino el enviado (para items sin productId)
        const realUnitPrice = dbProduct?.price ?? item.unitPrice
        
        // Calcular extras
        const extrasTotal = (item.extras || []).reduce((sum, e) => sum + (e.price || 0), 0)
        
        const realLineTotal = (realUnitPrice + extrasTotal) * item.qty
        calculatedTotal += realLineTotal

        verifiedItems.push({
          ...item,
          unitPrice: realUnitPrice,
          lineTotal: realLineTotal,
          name: dbProduct?.name || item.name,
        })
      }
    } else {
      // Si no hay productIds, usar los items tal cual (productos custom)
      calculatedTotal = items.reduce((sum, i) => sum + i.lineTotal, 0)
      verifiedItems.push(...items)
    }

    // 4. Crear la orden en DB con idempotency_key
    const idempotencyKey = `ord_${crypto.randomUUID()}`

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        tenant_id: tenantId,
        status: 'pending',
        payment_status: 'pending',
        total: calculatedTotal,
        currency: 'ARS',
        customer_name: customer?.name || null,
        customer_phone: customer?.phone || null,
        delivery_type: deliveryType || 'mostrador',
        delivery_address: deliveryAddress || null,
        delivery_notes: deliveryNotes || null,
        payment_method: 'mercadopago',
        idempotency_key: idempotencyKey,
      })
      .select('id')
      .single()

    if (orderError) {
      console.error('Error creando orden:', orderError)
      return new Response(
        JSON.stringify({ error: 'Error al crear la orden', details: orderError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const orderId = order.id

    // 5. Insertar items de la orden
    const orderItems = verifiedItems.map(item => ({
      order_id: orderId,
      product_id: item.productId || null,
      name: item.name,
      unit_price: item.unitPrice,
      qty: item.qty,
      line_total: item.lineTotal,
      extras: item.extras || [],
      comment: item.comment || null,
    }))

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems)

    if (itemsError) {
      console.error('Error insertando items:', itemsError)
      // Eliminar la orden si fallan los items
      await supabase.from('orders').delete().eq('id', orderId)
      return new Response(
        JSON.stringify({ error: 'Error al crear items de la orden' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 6. Crear preferencia de pago en MercadoPago
    const appUrl = Deno.env.get('APP_URL') || 'https://tudominio.com'
    const webhookUrl = Deno.env.get('WEBHOOK_URL') || `${supabaseUrl}/functions/v1/store-payment-webhook`

    const mpItems = verifiedItems.map(item => ({
      id: item.productId || `item_${Date.now()}`,
      title: item.name,
      description: item.extras?.length 
        ? `${item.name} + ${item.extras.map(e => e.name).join(', ')}`
        : item.name,
      quantity: item.qty,
      currency_id: 'ARS',
      unit_price: item.unitPrice + (item.extras?.reduce((s, e) => s + e.price, 0) || 0),
    }))

    const externalReference = JSON.stringify({
      type: 'customer_purchase',
      orderId,
      tenantId,
      tenantSlug: tenant.slug,
      idempotencyKey,
    })

    const preference = {
      items: mpItems,
      payer: customer?.email ? {
        email: customer.email,
        name: customer.name || undefined,
      } : undefined,
      external_reference: externalReference,
      back_urls: {
        success: `${appUrl}/tienda/${tenant.slug}/checkout/success?order=${orderId}`,
        failure: `${appUrl}/tienda/${tenant.slug}/checkout/failure?order=${orderId}`,
        pending: `${appUrl}/tienda/${tenant.slug}/checkout/pending?order=${orderId}`,
      },
      auto_return: 'all',
      notification_url: webhookUrl,
      statement_descriptor: (tenant.name || 'TIENDA').substring(0, 22),
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 horas
      metadata: {
        order_id: orderId,
        tenant_id: tenantId,
        tenant_slug: tenant.slug,
        flow_type: 'customer_purchase',
        idempotency_key: idempotencyKey,
      },
    }

    console.log('🛒 Creando preferencia MP para orden:', orderId)

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(preference),
    })

    if (!mpResponse.ok) {
      const mpError = await mpResponse.json()
      console.error('Error de MercadoPago:', mpError)
      
      // Marcar orden como fallida
      await supabase
        .from('orders')
        .update({ payment_status: 'rejected', status: 'cancelled' })
        .eq('id', orderId)

      return new Response(
        JSON.stringify({ 
          error: 'Error al crear preferencia de pago',
          mpError: mpError.message || mpError 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const mpData = await mpResponse.json()

    // 7. Guardar preference_id en la orden
    await supabase
      .from('orders')
      .update({ mp_preference_id: mpData.id })
      .eq('id', orderId)

    console.log('✅ Preferencia creada:', mpData.id)

    // 8. Retornar datos para redirección
    return new Response(
      JSON.stringify({
        success: true,
        orderId,
        preferenceId: mpData.id,
        initPoint: mpCreds.is_sandbox ? mpData.sandbox_init_point : mpData.init_point,
        sandboxInitPoint: mpData.sandbox_init_point,
        total: calculatedTotal,
        idempotencyKey,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error en create-store-preference:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
