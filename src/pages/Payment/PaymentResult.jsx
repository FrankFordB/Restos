import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import './PaymentResult.css'
import { formatAmount, translatePaymentStatus, getPaymentStatusIcon } from '../../lib/mercadopago'
import {
  updatePlatformSubscription,
  updateTenantSubscriptionTier,
} from '../../lib/supabaseMercadopagoApi'

/**
 * Página de resultado de pago
 * MercadoPago redirige aquí después del proceso de pago
 */
export default function PaymentResult() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState(null)

  // Parámetros de MercadoPago
  const collectionStatus = searchParams.get('collection_status') || searchParams.get('status')
  const paymentId = searchParams.get('payment_id') || searchParams.get('collection_id')
  const preferenceId = searchParams.get('preference_id')
  const externalReference = searchParams.get('external_reference')
  const paymentType = searchParams.get('type') // 'subscription' o 'order'
  const tenantSlug = searchParams.get('tenant')

  useEffect(() => {
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

      // Si es una suscripción exitosa, actualizar el tenant
      if (isSuccess && (paymentType === 'subscription' || refData.type === 'subscription')) {
        await handleSubscriptionSuccess(refData, paymentId, preferenceId)
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

  const handleSubscriptionSuccess = async (refData, paymentId, preferenceId) => {
    try {
      // Calcular fecha de expiración
      const expiresAt = new Date()
      if (refData.billingPeriod === 'yearly') {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1)
      } else {
        expiresAt.setMonth(expiresAt.getMonth() + 1)
      }

      // Actualizar suscripción en BD
      if (preferenceId) {
        await updatePlatformSubscription(preferenceId, {
          paymentId,
          status: 'approved',
          paidAt: new Date(),
          expiresAt,
        })
      }

      // Actualizar tier del tenant
      if (refData.tenantId && refData.planTier) {
        await updateTenantSubscriptionTier(refData.tenantId, refData.planTier, expiresAt)
      }

    } catch (error) {
      console.error('Error actualizando suscripción:', error)
    }
  }

  const handleGoToDashboard = () => {
    navigate('/dashboard')
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
              <span className="paymentResult__icon">❓</span>
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
      icon: '✓',
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
      icon: '⏳',
      title: 'Pago en Proceso',
      subtitle: 'Estamos verificando tu pago',
      message: 'Tu pago está siendo procesado. Esto puede tomar unos minutos. Te notificaremos cuando se confirme.',
      info: 'Si pagaste en efectivo en un punto de pago, recuerda que puede tardar hasta 2 horas hábiles en acreditarse.',
    },
    failure: {
      icon: '✕',
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
                    {result.planTier === 'premium_pro' ? '👑 Premium Pro' : '⭐ Premium'}
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
              {result.isSuccess ? '📧' : result.isPending ? '⏰' : '💡'}
            </span>
            <p className="paymentResult__infoText">
              {currentContent.info}
            </p>
          </div>

          {/* Acciones */}
          <div className="paymentResult__actions">
            {result.isSuccess && (
              <>
                <button
                  className="paymentResult__btn paymentResult__btn--primary"
                  onClick={result.type === 'subscription' ? handleGoToDashboard : handleGoToStore}
                >
                  🎉 {result.type === 'subscription' ? 'Ir a Mi Dashboard' : 'Ver Mi Pedido'}
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
                <button
                  className="paymentResult__btn paymentResult__btn--secondary"
                  onClick={result.type === 'subscription' ? handleGoToDashboard : handleGoToStore}
                >
                  Continuar
                </button>
              </>
            )}

            {result.isFailure && (
              <>
                <button
                  className="paymentResult__btn paymentResult__btn--retry"
                  onClick={handleRetry}
                >
                  🔄 Intentar Nuevamente
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
