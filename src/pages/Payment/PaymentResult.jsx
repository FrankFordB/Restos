import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import './PaymentResult.css'
import { formatAmount, translatePaymentStatus, getPaymentStatusIcon } from '../../lib/mercadopago'
import {
  updatePlatformSubscription,
  updateTenantSubscriptionTier,
  getPendingSubscriptionByPreference,
  getLatestPendingSubscriptionByTenant,
} from '../../lib/supabaseMercadopagoApi'
import { fetchTenantById } from '../../lib/supabaseApi'
import { getOrderWithPaymentStatus, verifyPaymentStatus, updateOrderFromPayment } from '../../lib/customerPaymentsApi'
import { supabase } from '../../lib/supabaseClient'
import { Crown, Star, Mail, Clock, Lightbulb, PartyPopper, Check, Loader, X, RefreshCw, HelpCircle } from 'lucide-react'

/**
 * Página de resultado de pago
 * MercadoPago redirige aquí después del proceso de pago
 */
export default function PaymentResult() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState(null)
  const [dbVerified, setDbVerified] = useState(null) // Para verificar estado en BD
  const [orderDetails, setOrderDetails] = useState(null)
  const [waitingConfirmation, setWaitingConfirmation] = useState(false)
  const [paymentConfirmed, setPaymentConfirmed] = useState(false)
  const pollingRef = useRef(false)

  // Parámetros de MercadoPago
  const collectionStatus = searchParams.get('collection_status') || searchParams.get('status')
  const paymentId = searchParams.get('payment_id') || searchParams.get('collection_id')
  const preferenceId = searchParams.get('preference_id')
  const externalReference = searchParams.get('external_reference')
  const paymentType = searchParams.get('type') // 'subscription' o 'order'
  const tenantSlug = searchParams.get('tenant')
  // Parámetro order que agregamos en back_urls
  const orderIdFromUrl = searchParams.get('order')

  useEffect(() => {
    // Log todos los parámetros que llegan de MercadoPago
    console.log('🔍 PaymentResult - Todos los parámetros de URL:', Object.fromEntries(searchParams.entries()))
    console.log('🔍 PaymentResult - Parámetros parseados:', {
      collectionStatus,
      paymentId,
      preferenceId,
      externalReference,
      paymentType,
      tenantSlug,
      orderIdFromUrl
    })
    processPaymentResult()
  }, [])

  // Polling: esperar confirmación del webhook, con fallback directo a MP API
  useEffect(() => {
    if (!result || pollingRef.current) return
    const isStoreOrder = result.type !== 'subscription' && result.orderId

    if (isStoreOrder && result.isSuccess) {
      pollingRef.current = true
      setWaitingConfirmation(true)

      let cancelled = false
      let attempts = 0
      const maxAttempts = 5 // 5 × 2s = 10 segundos esperando al webhook
      let fallbackDone = false

      const confirmOrderDirectly = async () => {
        if (fallbackDone) return
        fallbackDone = true
        console.log('🔄 Fallback: confirmando pago directamente...')
        try {
          // Verificar pago con API de MercadoPago
          if (result.paymentId && result.tenantId) {
            const mpPayment = await verifyPaymentStatus(result.tenantId, result.paymentId)
            console.log('💳 Verificación MP directa:', mpPayment)
            if (mpPayment.status === 'approved') {
              // Marcar orden como pagada directamente
              await updateOrderFromPayment(result.orderId, 'approved', mpPayment)
              console.log('✅ Orden marcada como pagada (fallback)')
            }
          } else {
            // Sin paymentId, intentar marcar con datos básicos
            console.log('⚠️ Sin paymentId, marcando con RPC...')
            await supabase.rpc('mark_order_paid', {
              p_order_id: result.orderId,
              p_is_paid: true
            })
            // También actualizar status
            await supabase.from('orders').update({
              status: 'confirmed',
              is_paid: true,
              paid_at: new Date().toISOString(),
            }).eq('id', result.orderId)
          }
        } catch (err) {
          console.error('Error en fallback de confirmación:', err)
          // Último recurso: update directo
          try {
            await supabase.from('orders').update({
              status: 'confirmed',
              is_paid: true,
              paid_at: new Date().toISOString(),
            }).eq('id', result.orderId)
            console.log('✅ Orden marcada como pagada (último recurso)')
          } catch (e2) {
            console.error('❌ No se pudo confirmar la orden:', e2)
          }
        }
      }

      const poll = async () => {
        if (cancelled) return
        try {
          const order = await getOrderWithPaymentStatus(result.orderId)
          if (order) {
            setOrderDetails(order)
            if (order.is_paid) {
              console.log('✅ Pago confirmado por webhook')
              setPaymentConfirmed(true)
              setWaitingConfirmation(false)
              return
            }
          }
        } catch (err) {
          console.error('Error verificando estado del pedido:', err)
        }

        attempts++

        // Después de 10s sin confirmación del webhook, hacer fallback
        if (attempts >= maxAttempts && !fallbackDone) {
          console.warn('⏳ Webhook no respondió, usando fallback directo...')
          await confirmOrderDirectly()
          // Hacer un último intento de leer la orden
          try {
            const order = await getOrderWithPaymentStatus(result.orderId)
            if (order) {
              setOrderDetails(order)
              if (order.is_paid) {
                setPaymentConfirmed(true)
                setWaitingConfirmation(false)
                return
              }
            }
          } catch (e) { /* ignore */ }
          // Incluso si no pudimos leer, marcar como confirmado
          // porque el pago SÍ fue aprobado por MP
          setPaymentConfirmed(true)
          setWaitingConfirmation(false)
          return
        }

        if (!cancelled) {
          setTimeout(poll, 2000)
        }
      }

      poll()
      return () => { cancelled = true }
    }

    // Para pendiente, cargar detalles de la orden una vez
    if (isStoreOrder && result.isPending) {
      getOrderWithPaymentStatus(result.orderId)
        .then(order => { if (order) setOrderDetails(order) })
        .catch(() => {})
    }
  }, [result])

  const processPaymentResult = async () => {
    try {
      // Parsear external_reference si existe
      let refData = {}
      if (externalReference) {
        try {
          refData = JSON.parse(externalReference)
        } catch {
          // Si no es JSON, usar como string
          refData = { raw: externalReference }
        }
      }

      const status = collectionStatus || 'unknown'
      const isSuccess = status === 'approved'
      const isPending = status === 'pending' || status === 'in_process'
      const isFailure = status === 'rejected' || status === 'cancelled'

      console.log('🔄 PaymentResult - Processing:', {
        status,
        isSuccess,
        isPending,
        paymentType,
        refData,
        paymentId,
        preferenceId
      })

      // Si es una suscripción exitosa, actualizar el tenant
      if (isSuccess && (paymentType === 'subscription' || refData.type === 'subscription')) {
        console.log('✅ Procesando upgrade de suscripción...')
        await handleSubscriptionSuccess(refData, paymentId, preferenceId)
        console.log('✅ Upgrade completado!')
      }

      // Si está en proceso o pendiente, guardar para seguimiento
      // El webhook de MercadoPago confirmará el estado final
      if (isPending && (paymentType === 'subscription' || refData.type === 'subscription')) {
        console.log('⏳ Pago en proceso/pendiente - guardando para seguimiento...')
        // Guardar en localStorage para que el usuario pueda volver a verificar
        localStorage.setItem('mp_pending_subscription', JSON.stringify({
          paymentId,
          preferenceId,
          tenantId: refData.tenantId,
          planTier: refData.planTier,
          billingPeriod: refData.billingPeriod,
          status,
          timestamp: Date.now(),
        }))
      }

      // Si es un pago de tienda (customer_purchase o store_order), actualizar la orden
      const isStoreOrder = paymentType === 'order' || 
                          refData.type === 'store_order' || 
                          refData.type === 'customer_purchase' ||
                          orderIdFromUrl // Si hay orderId en URL, es pago de tienda
      
      // Obtener orderId de múltiples fuentes
      const orderId = refData.orderId || orderIdFromUrl
      
      if (isStoreOrder && orderId) {
        console.log('🛒 Procesando pago de tienda, orderId:', orderId)
        // Solo eliminar la orden si fue rechazado/cancelado.
        // Para aprobado: el webhook de MercadoPago confirmará el pago.
        // El polling verificará cuando el webhook marque is_paid=true.
        if (isFailure) {
          console.log('❌ Pago rechazado, eliminando orden...')
          const { error: delErr } = await supabase
            .from('orders')
            .delete()
            .eq('id', orderId)
          if (delErr) console.warn('No se pudo eliminar la orden:', delErr)
        }
        refData.orderId = orderId
      }

      // También verificar si hay una orden pendiente en localStorage
      const pendingOrderStr = localStorage.getItem('mp_pending_order')
      let pendingOrderData = null
      if (pendingOrderStr) {
        try {
          pendingOrderData = JSON.parse(pendingOrderStr)
          if (pendingOrderData.orderId && Date.now() - pendingOrderData.timestamp < 2 * 60 * 60 * 1000) {
            if (!refData.orderId) {
              refData.orderId = pendingOrderData.orderId
            }
            if (!refData.tenantSlug) {
              refData.tenantSlug = pendingOrderData.tenantSlug
            }
            if (!refData.tenantId) {
              refData.tenantId = pendingOrderData.tenantId
            }
            if (isFailure && refData.orderId === pendingOrderData.orderId) {
              await supabase.from('orders').delete().eq('id', pendingOrderData.orderId)
            }
          }
          localStorage.removeItem('mp_pending_order')
        } catch {
          // Ignorar errores de parsing
        }
      }

      // Recuperar tenantId desde todas las fuentes disponibles
      const resolvedTenantId = refData.tenantId || tenantSlug || pendingOrderData?.tenantId || null

      setResult({
        status,
        isSuccess,
        isPending,
        isFailure,
        paymentId,
        preferenceId,
        type: paymentType || refData.type || 'order',
        amount: refData.amount,
        planTier: refData.planTier,
        billingPeriod: refData.billingPeriod,
        tenantId: resolvedTenantId,
        orderId: refData.orderId,
        tenantSlug: refData.tenantSlug || tenantSlug,
      })

    } catch (error) {
      console.error('Error procesando resultado de pago:', error)
      setResult({
        status: 'error',
        isFailure: true,
        error: error.message,
      })
    } finally {
      setLoading(false)
    }
  }

  // El pago de tienda se confirma exclusivamente via webhook de MercadoPago.
  // Este componente solo hace polling para verificar cuando el webhook marca is_paid=true.

  const handleSubscriptionSuccess = async (refData, paymentId, preferenceId) => {
    try {
      let subscriptionData = refData

      console.log('📦 handleSubscriptionSuccess - Input:', { refData, paymentId, preferenceId })

      // Si no tenemos los datos del tenant en external_reference, buscar la suscripción pendiente
      if ((!subscriptionData.tenantId || !subscriptionData.planTier) && preferenceId) {
        console.log('🔍 Buscando suscripción pendiente por preferenceId:', preferenceId)
        const pendingSubscription = await getPendingSubscriptionByPreference(preferenceId)
        console.log('📋 Suscripción pendiente encontrada:', pendingSubscription)
        if (pendingSubscription) {
          subscriptionData = {
            tenantId: pendingSubscription.tenant_id,
            planTier: pendingSubscription.plan_tier,
            billingPeriod: pendingSubscription.billing_period,
            amount: pendingSubscription.amount,
          }
        } else {
          console.warn('⚠️ No se encontró suscripción pendiente para preferenceId:', preferenceId)
        }
      }

      // Fallback: si tenemos tenantId pero no preferenceId, buscar suscripción pendiente más reciente
      if (subscriptionData.tenantId && (!subscriptionData.planTier || !preferenceId)) {
        console.log('🔍 Fallback: buscando suscripción pendiente más reciente para tenant:', subscriptionData.tenantId)
        const latestPending = await getLatestPendingSubscriptionByTenant(subscriptionData.tenantId)
        console.log('📋 Suscripción pendiente más reciente:', latestPending)
        if (latestPending) {
          subscriptionData = {
            tenantId: latestPending.tenant_id,
            planTier: latestPending.plan_tier,
            billingPeriod: latestPending.billing_period,
            amount: latestPending.amount,
            preferenceId: latestPending.mp_preference_id,
          }
          // Actualizar preferenceId para usar después
          if (!preferenceId && latestPending.mp_preference_id) {
            preferenceId = latestPending.mp_preference_id
          }
        }
      }

      console.log('📊 subscriptionData final:', subscriptionData)

      // Calcular fecha de expiración
      const expiresAt = new Date()
      if (subscriptionData.billingPeriod === 'yearly') {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1)
      } else {
        expiresAt.setMonth(expiresAt.getMonth() + 1)
      }

      console.log('📅 expiresAt:', expiresAt)

      // Actualizar suscripción en BD
      if (preferenceId) {
        console.log('💾 Actualizando platform_subscriptions...')
        try {
          await updatePlatformSubscription(preferenceId, {
            paymentId,
            status: 'approved',
            paidAt: new Date(),
            expiresAt,
          })
          console.log('✅ platform_subscriptions actualizado')
        } catch (err) {
          console.error('❌ Error actualizando platform_subscriptions:', err)
        }
      }

      // Actualizar tier del tenant
      if (subscriptionData.tenantId && subscriptionData.planTier) {
        console.log('🚀 Actualizando tenant subscription tier...', {
          tenantId: subscriptionData.tenantId,
          planTier: subscriptionData.planTier,
          expiresAt
        })
        try {
          const rpcResult = await updateTenantSubscriptionTier(subscriptionData.tenantId, subscriptionData.planTier, expiresAt)
          console.log('✅ Tenant tier actualizado! Resultado RPC:', rpcResult)
          
          // Verificar que realmente se actualizó en la BD
          console.log('🔍 Verificando estado en BD...')
          const tenantVerify = await fetchTenantById(subscriptionData.tenantId)
          console.log('📊 Estado actual en BD:', {
            subscription_tier: tenantVerify?.subscription_tier,
            premium_until: tenantVerify?.premium_until
          })
          
          if (tenantVerify?.subscription_tier === subscriptionData.planTier) {
            console.log('✅✅ VERIFICADO: El tier se actualizó correctamente en la BD')
            setDbVerified(true)
          } else {
            console.error('❌ PROBLEMA: La BD aún muestra tier:', tenantVerify?.subscription_tier, 'pero debería ser:', subscriptionData.planTier)
            setDbVerified(false)
          }
        } catch (err) {
          console.error('❌ Error CRÍTICO actualizando tier del tenant:', err)
          console.error('💡 Es posible que necesites ejecutar la migración fix_subscription_system_final.sql en Supabase')
          setDbVerified(false)
        }
      } else {
        console.warn('⚠️ No se pudo actualizar tier: faltan tenantId o planTier', subscriptionData)
      }

    } catch (error) {
      console.error('Error general en handleSubscriptionSuccess:', error)
    }
  }

  const handleGoToDashboard = () => {
    // Marcar que hubo un pago para que el Dashboard refresque el tenant
    if (result?.isSuccess) {
      localStorage.setItem('payment_just_completed', 'true')
    }
    navigate('/dashboard?tab=plans&payment_success=true')
  }

  const handleGoToStore = () => {
    if (result?.tenantSlug) {
      navigate(`/tienda/${result.tenantSlug}`)
    } else {
      navigate('/')
    }
  }

  const handleRetry = () => {
    // Volver a la página de suscripciones o tienda
    if (result?.type === 'subscription') {
      navigate('/dashboard/subscription')
    } else if (result?.tenantSlug) {
      navigate(`/tienda/${result.tenantSlug}`)
    } else {
      navigate(-1)
    }
  }

  if (loading) {
    return (
      <div className="paymentResult__loading">
        <div className="paymentResult__spinner" />
        <p>Verificando tu pago...</p>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="paymentResult">
        <div className="paymentResult__card">
          <div className="paymentResult__header paymentResult__header--failure">
            <div className="paymentResult__iconWrapper">
              <span className="paymentResult__icon"><HelpCircle size={48} /></span>
            </div>
            <h1 className="paymentResult__title">Estado Desconocido</h1>
            <p className="paymentResult__subtitle">No pudimos determinar el estado del pago</p>
          </div>
          <div className="paymentResult__body">
            <div className="paymentResult__actions">
              <button className="paymentResult__btn paymentResult__btn--secondary" onClick={() => navigate('/')}>
                Volver al Inicio
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Contenido según el estado
  const content = {
    success: {
      icon: <Check size={32} />,
      title: result.type === 'subscription' ? '¡Bienvenido a Premium!' : '¡Pago Exitoso!',
      subtitle: 'Tu pago fue procesado correctamente',
      message: result.type === 'subscription'
        ? 'Gracias por suscribirte. Ahora tienes acceso a todas las funcionalidades premium para hacer crecer tu negocio.'
        : 'Tu pedido ha sido confirmado. Te contactaremos pronto para coordinar la entrega.',
      info: result.type === 'subscription'
        ? 'Recibirás un correo de confirmación con los detalles de tu suscripción.'
        : 'Recibirás una notificación cuando tu pedido esté listo.',
    },
    pending: {
      icon: <Loader size={32} />,
      title: 'Pago en Proceso',
      subtitle: 'Estamos verificando tu pago',
      message: result.type === 'subscription'
        ? 'Tu pago está siendo procesado por MercadoPago. Recibirás una confirmación cuando se acredite. Si usaste una tarjeta de prueba, recuerda usar "APRO" como nombre del titular para que el pago sea aprobado inmediatamente.'
        : 'Tu pago está siendo procesado. Esto puede tomar unos minutos. Te notificaremos cuando se confirme.',
      info: 'En ambiente de pruebas (sandbox), usa el nombre "APRO" en el titular de la tarjeta para aprobar pagos instantáneamente. El webhook confirmará tu suscripción automáticamente.',
    },
    failure: {
      icon: <X size={32} />,
      title: 'Pago No Procesado',
      subtitle: 'No pudimos completar la transacción',
      message: 'Hubo un problema al procesar tu pago. No te preocupes, no se realizó ningún cargo a tu cuenta.',
      info: 'Verifica los datos de tu medio de pago e intenta nuevamente. Si el problema persiste, prueba con otro método de pago.',
    },
  }

  // Personalizar contenido para pedidos de tienda según estado de confirmación
  const isStoreOrder = result && result.type !== 'subscription' && result.orderId

  if (isStoreOrder && result.isSuccess) {
    if (waitingConfirmation) {
      content.success = {
        icon: <Loader size={32} className="paymentResult__spinIcon" />,
        title: 'Confirmando Pago...',
        subtitle: 'Verificando con MercadoPago',
        message: 'Estamos confirmando tu pago con MercadoPago. Esto solo toma unos segundos.',
        info: 'No cierres esta página. Te mostraremos los detalles de tu pedido en breve.',
      }
    } else if (paymentConfirmed) {
      content.success = {
        icon: <Check size={32} />,
        title: '¡Pedido Confirmado!',
        subtitle: 'Tu pago fue procesado correctamente',
        message: 'Tu pedido ya fue enviado al local y comenzarán a prepararlo.',
        info: 'El local recibirá tu pedido y te contactará según el tipo de entrega seleccionado.',
      }
    } else {
      // Timeout - pago recibido pero webhook aún no confirmó
      content.success = {
        icon: <Clock size={32} />,
        title: 'Pago Recibido',
        subtitle: 'Procesando tu pedido',
        message: 'Tu pago fue recibido por MercadoPago. El local recibirá tu pedido en los próximos minutos.',
        info: 'Si no recibes confirmación pronto, contacta directamente al local.',
      }
    }
  }

  const currentContent = result.isSuccess ? content.success
    : result.isPending ? content.pending
    : content.failure

  const headerClass = result.isSuccess
    ? (isStoreOrder && waitingConfirmation ? 'pending' : 'success')
    : result.isPending ? 'pending'
    : 'failure'

  return (
    <div className="paymentResult">
      <div className="paymentResult__card">
        {/* Header */}
        <div className={`paymentResult__header paymentResult__header--${headerClass}`}>
          <div className="paymentResult__iconWrapper">
            <span className="paymentResult__icon">{currentContent.icon}</span>
          </div>
          <h1 className="paymentResult__title">{currentContent.title}</h1>
          <p className="paymentResult__subtitle">{currentContent.subtitle}</p>
        </div>

        {/* Body */}
        <div className="paymentResult__body">
          {/* Mensaje */}
          <p className="paymentResult__message">
            {currentContent.message}
          </p>

          {/* Detalles del pago */}
          {(result.paymentId || result.amount || result.planTier) && (
            <div className="paymentResult__details">
              {result.paymentId && (
                <div className="paymentResult__detailRow">
                  <span className="paymentResult__detailLabel">ID de Transacción</span>
                  <span className="paymentResult__detailValue">#{result.paymentId}</span>
                </div>
              )}
              {result.planTier && (
                <div className="paymentResult__detailRow">
                  <span className="paymentResult__detailLabel">Plan</span>
                  <span className="paymentResult__detailValue">
                    {result.planTier === 'premium_pro' ? <><Crown size={16} /> Premium Pro</> : <><Star size={16} /> Premium</>}
                    {result.billingPeriod === 'yearly' ? ' Anual' : ' Mensual'}
                  </span>
                </div>
              )}
              {result.amount && (
                <div className="paymentResult__detailRow">
                  <span className="paymentResult__detailLabel">Monto</span>
                  <span className="paymentResult__detailValue">{formatAmount(result.amount)}</span>
                </div>
              )}
              {result.status && (
                <div className="paymentResult__detailRow">
                  <span className="paymentResult__detailLabel">Estado</span>
                  <span className="paymentResult__detailValue">
                    {getPaymentStatusIcon(result.status)} {translatePaymentStatus(result.status)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Detalle del pedido */}
          {isStoreOrder && orderDetails && !waitingConfirmation && (
            <div className="paymentResult__orderDetails">
              <h3 className="paymentResult__orderTitle">📋 Detalle de tu Pedido</h3>
              
              {(orderDetails.order_items || []).map((item, idx) => (
                <div key={item.id || idx} className="paymentResult__orderItem">
                  <div className="paymentResult__orderItemInfo">
                    <span className="paymentResult__orderItemName">{item.name}</span>
                    <span className="paymentResult__orderItemQty">x{item.qty}</span>
                  </div>
                  <span className="paymentResult__orderItemPrice">
                    ${Number(item.line_total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
              
              <div className="paymentResult__orderTotal">
                <span>Total</span>
                <span>${Number(orderDetails.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>

              {orderDetails.delivery_type && (
                <div className="paymentResult__orderMeta">
                  <span>{
                    orderDetails.delivery_type === 'mostrador' ? '📦 Retiro en Local' :
                    orderDetails.delivery_type === 'domicilio' ? '🚗 Delivery' :
                    orderDetails.delivery_type === 'mesa' ? '🍽️ Comer Aquí' :
                    orderDetails.delivery_type
                  }</span>
                  {orderDetails.delivery_address && (
                    <span className="paymentResult__orderAddress">📍 {orderDetails.delivery_address}</span>
                  )}
                </div>
              )}

              {orderDetails.customer_name && (
                <div className="paymentResult__orderCustomer">
                  <span>👤 {orderDetails.customer_name}</span>
                  {orderDetails.customer_phone && <span>📞 {orderDetails.customer_phone}</span>}
                </div>
              )}
            </div>
          )}

          {/* Info box */}
          <div className={`paymentResult__info paymentResult__info--${headerClass}`}>
            <span className="paymentResult__infoIcon">
              {result.isSuccess ? <Mail size={20} /> : result.isPending ? <Clock size={20} /> : <Lightbulb size={20} />}
            </span>
            <p className="paymentResult__infoText">
              {currentContent.info}
            </p>
          </div>
          
          {/* Verificación de BD - solo para suscripciones */}
          {result.type === 'subscription' && result.isSuccess && (
            <div className={`paymentResult__dbVerify ${dbVerified === true ? 'paymentResult__dbVerify--ok' : dbVerified === false ? 'paymentResult__dbVerify--error' : ''}`}>
              {dbVerified === null && <span>⏳ Verificando actualización...</span>}
              {dbVerified === true && <span>✅ Suscripción activada correctamente</span>}
              {dbVerified === false && <span>⚠️ Hubo un problema activando la suscripción. Contacta soporte.</span>}
            </div>
          )}

          {/* Acciones */}
          <div className="paymentResult__actions">
            {result.isSuccess && (
              <>
                {isStoreOrder && waitingConfirmation ? (
                  <div className="paymentResult__waitingIndicator">
                    <Loader size={20} className="paymentResult__spinIcon" />
                    <span>Verificando pago...</span>
                  </div>
                ) : (
                  <>
                    <button
                      className="paymentResult__btn paymentResult__btn--primary"
                      onClick={result.type === 'subscription' ? handleGoToDashboard : handleGoToStore}
                    >
                      <PartyPopper size={16} style={{ marginRight: 4 }} />
                      {result.type === 'subscription' ? 'Ir a Mi Dashboard' : 'Volver a la Tienda'}
                    </button>
                    {result.type !== 'subscription' && (
                      <button
                        className="paymentResult__btn paymentResult__btn--secondary"
                        onClick={handleGoToStore}
                      >
                        Seguir Comprando
                      </button>
                    )}
                  </>
                )}
              </>
            )}

            {result.isPending && (
              <>
                {result.type === 'subscription' && (
                  <div className="paymentResult__pendingNote">
                    <Clock size={16} />
                    <span>El webhook de MercadoPago confirmará tu suscripción automáticamente cuando el pago sea aprobado.</span>
                  </div>
                )}
                <button
                  className="paymentResult__btn paymentResult__btn--primary"
                  onClick={result.type === 'subscription' ? handleGoToDashboard : handleGoToStore}
                >
                  {result.type === 'subscription' ? 'Ir a Mi Dashboard' : 'Ver Mi Pedido'}
                </button>
                <button
                  className="paymentResult__btn paymentResult__btn--secondary"
                  onClick={() => window.location.reload()}
                >
                  <RefreshCw size={16} /> Verificar Estado
                </button>
              </>
            )}

            {result.isFailure && (
              <>
                <button
                  className="paymentResult__btn paymentResult__btn--retry"
                  onClick={handleRetry}
                >
                  <RefreshCw size={16} /> Intentar Nuevamente
                </button>
                <button
                  className="paymentResult__btn paymentResult__btn--secondary"
                  onClick={() => navigate('/')}
                >
                  Volver al Inicio
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
