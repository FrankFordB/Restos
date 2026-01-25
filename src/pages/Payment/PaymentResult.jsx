import { useEffect, useState } from 'react'
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
import { updateOrderPaymentStatus } from '../../lib/supabaseOrdersApi'
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
        await handleStoreOrderPayment(orderId, status, paymentId)
        refData.orderId = orderId // Asegurar que esté en refData para el resultado
      }

      // También verificar si hay una orden pendiente en localStorage
      const pendingOrderStr = localStorage.getItem('mp_pending_order')
      if (pendingOrderStr && !refData.orderId) {
        try {
          const pendingOrder = JSON.parse(pendingOrderStr)
          // Verificar que sea reciente (menos de 2 horas)
          if (pendingOrder.orderId && Date.now() - pendingOrder.timestamp < 2 * 60 * 60 * 1000) {
            await handleStoreOrderPayment(pendingOrder.orderId, status, paymentId)
            refData.orderId = pendingOrder.orderId
            refData.tenantSlug = pendingOrder.tenantSlug
          }
          // Limpiar orden pendiente
          localStorage.removeItem('mp_pending_order')
        } catch {
          // Ignorar errores de parsing
        }
      }

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
        tenantId: refData.tenantId || tenantSlug,
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

  // Manejar pago de orden de tienda
  const handleStoreOrderPayment = async (orderId, status, paymentId) => {
    try {
      console.log('📝 handleStoreOrderPayment:', { orderId, status, paymentId })
      
      const isApproved = status === 'approved'
      const isPending = status === 'pending' || status === 'in_process'
      const isRejected = status === 'rejected' || status === 'cancelled'
      
      if (isApproved) {
        // PAGO APROBADO - Actualizar orden para que aparezca en el dashboard
        console.log('✅ Pago aprobado, actualizando orden...')
        
        // Intentar actualizar con la función helper
        try {
          await updateOrderPaymentStatus(orderId, {
            status: 'confirmed',
            payment_status: 'paid',
            mp_payment_id: paymentId,
            mp_status: status,
            is_paid: true,
          })
          console.log('✅ Orden actualizada via updateOrderPaymentStatus')
        } catch (helperError) {
          console.warn('⚠️ Error en updateOrderPaymentStatus, usando Supabase directo:', helperError)
          
          // Fallback: actualizar directamente con Supabase
          const { error: updateError } = await supabase
            .from('orders')
            .update({
              status: 'confirmed',
              is_paid: true,
              paid_at: new Date().toISOString(),
            })
            .eq('id', orderId)
          
          if (updateError) {
            console.error('❌ Error actualizando orden:', updateError)
          } else {
            console.log('✅ Orden actualizada via Supabase directo')
          }
        }
        
      } else if (isPending) {
        console.log('⏳ Pago pendiente, esperando confirmación...')
        // No hacemos nada, el webhook confirmará después
        
      } else if (isRejected) {
        console.log('❌ Pago rechazado/cancelado')
        // Eliminar la orden para no dejar basura
        const { error: deleteError } = await supabase
          .from('orders')
          .delete()
          .eq('id', orderId)
        
        if (deleteError) {
          console.warn('No se pudo eliminar la orden:', deleteError)
        } else {
          console.log('🗑️ Orden eliminada')
        }
      }
      
    } catch (error) {
      console.error('Error en handleStoreOrderPayment:', error)
    }
  }

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

  const currentContent = result.isSuccess ? content.success
    : result.isPending ? content.pending
    : content.failure

  const headerClass = result.isSuccess ? 'success'
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
                <button
                  className="paymentResult__btn paymentResult__btn--primary"
                  onClick={result.type === 'subscription' ? handleGoToDashboard : handleGoToStore}
                >
                  <PartyPopper size={16} style={{ marginRight: 4 }} /> {result.type === 'subscription' ? 'Ir a Mi Dashboard' : 'Ver Mi Pedido'}
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
