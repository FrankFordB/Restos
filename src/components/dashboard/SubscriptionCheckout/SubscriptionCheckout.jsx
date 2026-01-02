import { useState } from 'react'
import './SubscriptionCheckout.css'
import SubscriptionPlans from '../SubscriptionPlans/SubscriptionPlans'
import PaymentSuccessModal from '../../ui/PaymentSuccessModal/PaymentSuccessModal'
import DowngradeWarningModal from '../../ui/DowngradeWarningModal/DowngradeWarningModal'
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
  updateTenantSubscriptionTier,
  performTenantDowngrade,
} from '../../../lib/supabaseMercadopagoApi'

/**
 * Componente de checkout de suscripciones con MercadoPago
 * Integra los planes con el proceso de pago
 */
export default function SubscriptionCheckout({
  tenantId,
  tenantName,
  currentTier = SUBSCRIPTION_TIERS.FREE,
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

  const mpConfigured = isPlatformMPConfigured()
  
  // Debug: mostrar estado de MP
  console.log('🔶 SubscriptionCheckout - mpConfigured:', mpConfigured)

  const handleUpgrade = (tier, period) => {
    console.log('🔵 handleUpgrade llamado:', { tier, period })
    setSelectedPlan(tier)
    setBillingPeriod(period)
    setShowCheckout(true)
    setError(null)
    setTermsAccepted(false)
    console.log('🔵 showCheckout seteado a TRUE')
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
      // Perform the downgrade (resets configurations)
      await performTenantDowngrade(tenantId, downgradeTier)
      
      setShowDowngradeModal(false)
      setDowngradeTier(null)
      
      // Notify parent and reload to reflect changes
      if (onSubscriptionComplete) {
        onSubscriptionComplete(downgradeTier)
      }
      
      // Reload page to reset all state
      window.location.reload()
    } catch (err) {
      console.error('Error performing downgrade:', err)
      alert('Error al cambiar el plan. Por favor intenta nuevamente.')
    } finally {
      setDowngradeLoading(false)
    }
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
    console.log('🟢 handlePayment INICIADO - Verificando términos...')
    
    if (!termsAccepted) {
      setError('Debes aceptar los términos y condiciones')
      return
    }

    console.log('🟢 Términos aceptados. mpConfigured =', mpConfigured)

    if (!mpConfigured) {
      // Modo demo: simular pago exitoso
      console.log('🟡 MP NO configurado, ejecutando simulateDemoPayment()')
      simulateDemoPayment()
      return
    }

    console.log('🟢 MP Configurado, intentando crear preferencia...')

    try {
      setLoading(true)
      setError(null)

      const amount = getPrice()
      console.log('🟢 Amount:', amount, 'Plan:', selectedPlan, 'Period:', billingPeriod)

      // Crear preferencia de pago en MP
      const preference = await createSubscriptionPreference({
        tenantId,
        tenantName,
        planTier: selectedPlan,
        billingPeriod,
        amount,
        payerEmail: userEmail,
      })

      console.log('🟢 Preferencia creada:', preference)

      // Guardar suscripción pendiente
      await createPlatformSubscription({
        tenantId,
        preferenceId: preference.preferenceId,
        planTier: selectedPlan,
        billingPeriod,
        amount,
      })

      console.log('🟢 Redirigiendo a MercadoPago:', preference.initPoint)
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
    console.log('🔵 DEMO PAGO - INICIO')
    
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
    console.log('🔵 DEMO PAGO - Tier actualizado:', selectedPlan, 'hasta:', expiresAt)

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
          🧪 <strong>Modo Demo:</strong> MercadoPago no está configurado. 
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
              <div className="checkoutModal__logo">💳</div>
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
                {/* Resumen */}
                <div className="checkoutModal__summary">
                  <div className="checkoutModal__summaryRow">
                    <span className="checkoutModal__summaryLabel">Plan</span>
                    <span className="checkoutModal__summaryValue checkoutModal__summaryValue--plan">
                      <span className={`checkoutModal__planBadge checkoutModal__planBadge--${selectedPlan}`}>
                        {selectedPlan === SUBSCRIPTION_TIERS.PREMIUM ? '⭐' : '👑'}
                        {TIER_LABELS[selectedPlan]}
                      </span>
                    </span>
                  </div>
                  <div className="checkoutModal__summaryRow">
                    <span className="checkoutModal__summaryLabel">Período</span>
                    <span className="checkoutModal__summaryValue">
                      {billingPeriod === 'yearly' ? 'Anual' : 'Mensual'}
                    </span>
                  </div>
                  <div className="checkoutModal__summaryRow">
                    <span className="checkoutModal__summaryLabel">Tienda</span>
                    <span className="checkoutModal__summaryValue">{tenantName}</span>
                  </div>
                  <div className="checkoutModal__summaryRow">
                    <span className="checkoutModal__summaryLabel">Total</span>
                    <span className="checkoutModal__summaryValue checkoutModal__total">
                      {formatAmount(getPrice())}
                    </span>
                  </div>
                </div>

                {/* Método de pago */}
                <div className="checkoutModal__paymentMethod">
                  <div className="checkoutModal__mpLogo">MP</div>
                  <div className="checkoutModal__mpInfo">
                    <h4>MercadoPago</h4>
                    <p>Tarjeta, transferencia, efectivo y más</p>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div style={{
                    padding: '0.75rem 1rem',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    color: '#dc2626',
                    fontSize: '0.9rem',
                    marginBottom: '1rem',
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

                {/* Acciones */}
                <div className="checkoutModal__actions">
                  <button
                    className="checkoutModal__payBtn"
                    onClick={handlePayment}
                    disabled={!termsAccepted}
                  >
                    🔒 Pagar {formatAmount(getPrice())}
                  </button>
                  
                  {/* Botón de demo para desarrollo local */}
                  {window.location.hostname === 'localhost' && (
                    <button
                      className="checkoutModal__demoBtn"
                      onClick={simulateDemoPayment}
                      disabled={!termsAccepted}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        fontWeight: '600',
                        cursor: termsAccepted ? 'pointer' : 'not-allowed',
                        opacity: termsAccepted ? 1 : 0.5,
                      }}
                    >
                      🧪 Demo (sin MP)
                    </button>
                  )}
                  
                  <button
                    className="checkoutModal__cancelBtn"
                    onClick={handleCloseCheckout}
                  >
                    Cancelar
                  </button>
                </div>

                {/* Seguridad */}
                <div className="checkoutModal__security">
                  <span>🔐</span>
                  <span>Pago 100% seguro • Datos encriptados</span>
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
    </div>
  )
}
