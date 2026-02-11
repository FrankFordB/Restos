import { useState } from 'react'
import './SubscriptionCheckout.css'
import SubscriptionPlans from '../SubscriptionPlans/SubscriptionPlans'
import PaymentSuccessModal from '../../ui/PaymentSuccessModal/PaymentSuccessModal'
import DowngradeWarningModal from '../../ui/DowngradeWarningModal/DowngradeWarningModal'
import ScheduledChangeModal from '../../ui/ScheduledChangeModal/ScheduledChangeModal'
import { Star, Crown, FlaskConical } from 'lucide-react'
import { Lock } from 'lucide-react'
import {
  SUBSCRIPTION_TIERS,
  TIER_LABELS,
  TIER_PRICES,
  SUBSCRIPTION_DURATION_DAYS,
} from '../../../shared/subscriptions'
import {
  createSubscriptionPreference,
  isPlatformMPConfigured,
  formatAmount,
} from '../../../lib/mercadopago'
import {
  createPlatformSubscription,
  updatePlatformSubscriptionById,
  updateTenantSubscriptionTier,
  scheduleTierChange,
} from '../../../lib/supabaseMercadopagoApi'

/**
 * Componente de checkout de suscripciones con MercadoPago
 * Integra los planes con el proceso de pago
 */
export default function SubscriptionCheckout({
  tenantId,
  tenantName,
  currentTier = SUBSCRIPTION_TIERS.FREE,
  premiumUntil = null,
  userEmail,
  onSubscriptionComplete,
}) {
  const [showCheckout, setShowCheckout] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [billingPeriod, setBillingPeriod] = useState('monthly')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [paymentData, setPaymentData] = useState(null)

  // Downgrade state
  const [showDowngradeModal, setShowDowngradeModal] = useState(false)
  const [downgradeTier, setDowngradeTier] = useState(null)
  const [downgradeLoading, setDowngradeLoading] = useState(false)
  
  // Scheduled change modal state
  const [showScheduledModal, setShowScheduledModal] = useState(false)
  const [scheduledChangeData, setScheduledChangeData] = useState(null)

  const mpConfigured = isPlatformMPConfigured()

  const handleUpgrade = (tier, period) => {
    setSelectedPlan(tier)
    setBillingPeriod(period)
    setShowCheckout(true)
    setError(null)
    setTermsAccepted(false)
  }

  const handleDowngradeRequest = (tier) => {
    setDowngradeTier(tier)
    setShowDowngradeModal(true)
  }

  const handleDowngradeCancel = () => {
    setShowDowngradeModal(false)
    setDowngradeTier(null)
  }

  const handleDowngradeConfirm = async () => {
    if (!downgradeTier) return
    
    setDowngradeLoading(true)
    try {
      console.log('Scheduling tier change:', { tenantId, downgradeTier, premiumUntil })
      
      // Programar el cambio de tier para cuando expire la suscripción actual
      // El usuario mantiene su plan actual hasta que expire
      const result = await scheduleTierChange(tenantId, downgradeTier, premiumUntil)
      
      console.log('Tier change scheduled:', result)
      
      setShowDowngradeModal(false)
      setDowngradeTier(null)
      
      // Guardar datos para el modal de confirmación
      setScheduledChangeData({
        currentTier: currentTier,
        newTier: downgradeTier,
        effectiveDate: premiumUntil,
      })
      setShowScheduledModal(true)
    } catch (err) {
      console.error('Error scheduling tier change:', err)
      console.error('Error details:', err.message, err.code, err.details)
      alert(`Error al programar el cambio de plan: ${err.message || 'Error desconocido'}. Por favor intenta nuevamente.`)
    } finally {
      setDowngradeLoading(false)
    }
  }

  const handleScheduledModalClose = () => {
    setShowScheduledModal(false)
    setScheduledChangeData(null)
    
    // Notify parent and reload to reflect changes
    if (onSubscriptionComplete) {
      onSubscriptionComplete(scheduledChangeData?.newTier)
    }
    
    // Reload page to update UI
    window.location.reload()
  }

  const handleCloseCheckout = () => {
    setShowCheckout(false)
    setSelectedPlan(null)
    setError(null)
  }

  const getPrice = () => {
    if (!selectedPlan) return 0
    const prices = TIER_PRICES[selectedPlan]
    return billingPeriod === 'yearly' ? prices.yearly : prices.monthly
  }

  const handlePayment = async () => {
    if (!termsAccepted) {
      setError('Debes aceptar los términos y condiciones')
      return
    }

    if (!mpConfigured) {
      // Modo demo: simular pago exitoso
      simulateDemoPayment()
      return
    }

    try {
      setLoading(true)
      setError(null)

      const amount = getPrice()

      // 1. Crear suscripción pendiente PRIMERO (para tener el ID)
      const subscription = await createPlatformSubscription({
        tenantId,
        preferenceId: null, // Se actualiza después
        planTier: selectedPlan,
        billingPeriod,
        amount,
      })

      // 2. Crear preferencia de pago en MP CON el subscriptionId
      const preference = await createSubscriptionPreference({
        tenantId,
        tenantName,
        planTier: selectedPlan,
        billingPeriod,
        amount,
        payerEmail: userEmail,
        subscriptionId: subscription.id,
      })

      // 3. Actualizar la suscripción con el preferenceId
      await updatePlatformSubscriptionById(subscription.id, {
        mp_preference_id: preference.preferenceId,
      })

      // Redirigir a MercadoPago
      window.location.href = preference.initPoint

    } catch (err) {
      console.error('Error creando pago:', err)
      setError(err.message || 'Error al procesar el pago. Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  // Modo demo sin MercadoPago - para desarrollo local
  const simulateDemoPayment = async () => {
    setLoading(true)
    
    // Simular delay de procesamiento
    await new Promise(resolve => setTimeout(resolve, 1500))

    // Calcular fecha de expiración (30 días para mensual, 365 para anual)
    const expiresAt = new Date()
    if (billingPeriod === 'yearly') {
      expiresAt.setDate(expiresAt.getDate() + 365)
    } else {
      expiresAt.setDate(expiresAt.getDate() + 30) // 30 días exactos
    }

    // Actualizar tier del tenant
    await updateTenantSubscriptionTier(tenantId, selectedPlan, expiresAt)

    setPaymentData({
      amount: getPrice(),
      planName: `${TIER_LABELS[selectedPlan]} ${billingPeriod === 'yearly' ? 'Anual' : 'Mensual'}`,
      paymentId: `DEMO-${Date.now()}`,
    })

    setLoading(false)
    setShowCheckout(false)
    setShowSuccessModal(true)

    if (onSubscriptionComplete) {
      onSubscriptionComplete(selectedPlan)
    }
  }

  const handleSuccessClose = () => {
    setShowSuccessModal(false)
    setPaymentData(null)
  }

  return (
    <div className="subscriptionCheckout">
      {/* Planes de suscripción */}
      <SubscriptionPlans
        currentTier={currentTier}
        onUpgrade={handleUpgrade}
        onDowngrade={handleDowngradeRequest}
      />

      {/* Modal de advertencia de downgrade */}
      <DowngradeWarningModal
        open={showDowngradeModal}
        currentTier={currentTier}
        targetTier={downgradeTier}
        premiumUntil={premiumUntil}
        onConfirm={handleDowngradeConfirm}
        onCancel={handleDowngradeCancel}
        loading={downgradeLoading}
      />

      {/* Aviso si MP no está configurado */}
      {!mpConfigured && (
        <div style={{
          marginTop: '1rem',
          padding: '1rem',
          background: '#fef3c7',
          borderRadius: '12px',
          textAlign: 'center',
          color: '#92400e',
          fontSize: '0.9rem',
        }}>
          <FlaskConical size={16} /> <strong>Modo Demo:</strong> MercadoPago no está configurado. 
          Los pagos se simularán para pruebas.
        </div>
      )}

      {/* Modal de checkout */}
      {showCheckout && selectedPlan && (
        <div className="checkoutModal">
          <div className="checkoutModal__backdrop" onClick={handleCloseCheckout} />
          
          <div className="checkoutModal__content">
            {/* Header */}
            <div className="checkoutModal__header">
              <div className="checkoutModal__logo"><img className="checkoutModal__logo" src="src\Img\MP_manos-removebg-preview.png" alt="" /></div>
              <div className="checkoutModal__headerText">
                <h3>Confirmar Suscripción</h3>
                <p>Pago seguro con MercadoPago</p>
              </div>
            </div>

            {loading ? (
              <div className="checkoutModal__loading">
                <div className="checkoutModal__spinner"></div>
                <p className="checkoutModal__loadingText">
                  {mpConfigured 
                    ? 'Conectando con MercadoPago...'
                    : 'Procesando suscripción...'
                  }
                </p>
              </div>
            ) : (
              <div className="checkoutModal__body">
                {/* Columna izquierda - Resumen */}
                <div className="checkoutModal__summary">
                  <h4 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: '700', color: '#111827' }}>
                    Resumen del pedido
                  </h4>
                  <div className="checkoutModal__summaryRow">
                    <span className="checkoutModal__summaryLabel">Plan</span>
                    <span className="checkoutModal__summaryValue checkoutModal__summaryValue--plan">
                      <span className={`checkoutModal__planBadge checkoutModal__planBadge--${selectedPlan}`}>
                        {selectedPlan === SUBSCRIPTION_TIERS.PREMIUM ? <Star size={14} /> : <Crown size={14} />}
                        {TIER_LABELS[selectedPlan]}
                      </span>
                    </span>
                  </div>
                  <div className="checkoutModal__summaryRow">
                    <span className="checkoutModal__summaryLabel">Período</span>
                    <span className="checkoutModal__summaryValue">
                      {billingPeriod === 'yearly' ? 'Anual (12 meses)' : 'Mensual'}
                    </span>
                  </div>
                  <div className="checkoutModal__summaryRow">
                    <span className="checkoutModal__summaryLabel">Tienda</span>
                    <span className="checkoutModal__summaryValue">{tenantName}</span>
                  </div>
                  <div className="checkoutModal__summaryRow">
                    <span className="checkoutModal__summaryLabel">Total a pagar</span>
                    <span className="checkoutModal__summaryValue checkoutModal__total">
                      {formatAmount(getPrice())}
                    </span>
                  </div>
                </div>

                {/* Columna derecha - Método de pago y acciones */}
                <div className="checkoutModal__paymentColumn">
                  {/* Método de pago */}
                  <div className="checkoutModal__paymentMethod">
                    <div className="checkoutModal__mpLogo"><img className="checkoutModal__logo" src="src\Img\MP_manos-removebg-preview.png" alt="" /></div>
                    <div className="checkoutModal__mpInfo">
                      <h4>MercadoPago</h4>
                      <p>Tarjeta, transferencia, efectivo y más</p>
                    </div>
                  </div>

                  {/* Error */}
                  {error && (
                    <div style={{
                      padding: '0.875rem 1rem',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '10px',
                      color: '#dc2626',
                      fontSize: '0.875rem',
                    }}>
                      {error}
                    </div>
                  )}

                  {/* Términos */}
                  <label className="checkoutModal__terms">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                    />
                    <span>
                      Acepto los{' '}
                      <a href="/terminos" target="_blank" className="checkoutModal__termsLink">
                        términos y condiciones
                      </a>{' '}
                      y la{' '}
                      <a href="/privacidad" target="_blank" className="checkoutModal__termsLink">
                        política de privacidad
                      </a>
                    </span>
                  </label>

                  {/* Seguridad */}
                  <div className="checkoutModal__security" style={{ marginTop: 'auto', borderTop: 'none', paddingTop: 0 }}>
                    <span><Lock size={16} /></span>
                    <span>Pago 100% seguro • Datos encriptados</span>
                  </div>
                </div>

                {/* Acciones - Full width */}
                <div className="checkoutModal__actions">
                  <div className="checkoutModal__actionsRow">
                    <button
                      className="checkoutModal__cancelBtn"
                      onClick={handleCloseCheckout}
                    >
                      Cancelar
                    </button>
                    <button
                      className="checkoutModal__payBtn"
                      onClick={handlePayment}
                      disabled={!termsAccepted}
                    >
                      <Lock size={16} /> Pagar {formatAmount(getPrice())}
                    </button>
                  </div>
                  
                  {/* Botón de demo para desarrollo local */}
                  
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de éxito */}
      <PaymentSuccessModal
        isOpen={showSuccessModal}
        onClose={handleSuccessClose}
        type="subscription"
        paymentData={paymentData}
        onPrimaryAction={() => {
          handleSuccessClose()
          // Navegar al dashboard o recargar
          window.location.reload()
        }}
        primaryActionLabel="Ir a Mi Dashboard"
        onSecondaryAction={handleSuccessClose}
        secondaryActionLabel="Cerrar"
      />

      {/* Modal de cambio programado */}
      <ScheduledChangeModal
        isOpen={showScheduledModal}
        onClose={handleScheduledModalClose}
        currentTier={scheduledChangeData?.currentTier}
        newTier={scheduledChangeData?.newTier}
        effectiveDate={scheduledChangeData?.effectiveDate}
      />
    </div>
  )
}
