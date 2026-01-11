import { useState } from 'react'
import './RenewalWarningModal.css'
import Button from '../Button/Button'
import {
  SUBSCRIPTION_TIERS,
  TIER_LABELS,
  TIER_PRICES,
  getDowngradeLostFeatures,
} from '../../../shared/subscriptions'
import { Clock, AlertTriangle, Ban, RefreshCw, CreditCard, Lightbulb, X } from 'lucide-react'

/**
 * Modal de advertencia de renovación de suscripción
 * Aparece 1 día antes de que expire la suscripción
 * Redirige a MercadoPago para procesar el pago
 */
export default function RenewalWarningModal({
  open,
  currentTier,
  expiresAt,
  onRenew,
  onDismiss,
  loading = false,
}) {
  const [billingPeriod, setBillingPeriod] = useState('monthly')
  
  if (!open) return null

  const tierLabel = TIER_LABELS[currentTier] || 'Premium'
  const lostFeatures = getDowngradeLostFeatures(currentTier, SUBSCRIPTION_TIERS.FREE)
  
  // Calcular días restantes
  const now = new Date()
  const expiry = new Date(expiresAt)
  const daysRemaining = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24))
  
  // Precio de renovación
  const prices = TIER_PRICES[currentTier] || { monthly: 0, yearly: 0 }
  const price = billingPeriod === 'yearly' ? prices.yearly : prices.monthly

  const handleRenew = () => {
    if (onRenew) {
      onRenew(currentTier, billingPeriod)
    }
  }

  return (
    <div className="renewalModal__overlay" role="dialog" aria-modal="true">
      <div className="renewalModal__card">
        {/* Header compacto */}
        <div className="renewalModal__header">
          <div className="renewalModal__icon"><Clock size={24} /></div>
          <div className="renewalModal__headerContent">
            <h2 className="renewalModal__title">Tu suscripción está por vencer</h2>
            <div className="renewalModal__countdown">
              {daysRemaining <= 0 ? (
                <span className="renewalModal__expired">¡Expirada!</span>
              ) : daysRemaining === 1 ? (
                <span className="renewalModal__urgent">¡Último día!</span>
              ) : (
                <span>Quedan <strong>{daysRemaining} días</strong></span>
              )}
            </div>
          </div>
        </div>

        {/* Body en 2 columnas */}
        <div className="renewalModal__body">
          {/* Columna izquierda */}
          <div className="renewalModal__leftColumn">
            {/* Alerta principal */}
            <div className="renewalModal__alert">
              <span className="renewalModal__alertIcon"><AlertTriangle size={20} /></span>
              <div className="renewalModal__alertContent">
                <strong>¡Atención!</strong>
                <p>
                  Tu plan <strong>{tierLabel}</strong> vence el{' '}
                  <strong>{expiry.toLocaleDateString('es-ES', { 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric' 
                  })}</strong>.
                </p>
                <p>
                  Si no renuevas, perderás las configuraciones premium.
                </p>
              </div>
            </div>

            {/* Lo que perderás */}
            <div className="renewalModal__lostFeatures">
              <h4 className="renewalModal__lostFeaturesTitle">
                <Ban size={16} /> Perderás acceso a:
              </h4>
              <ul className="renewalModal__featuresList">
                {lostFeatures.slice(0, 5).map((feature, idx) => (
                  <li key={idx} className="renewalModal__featureItem">
                    <span className="renewalModal__featureX"><X size={14} /></span>
                    <span>{feature}</span>
                  </li>
                ))}
                {lostFeatures.length > 5 && (
                  <li className="renewalModal__featureItem renewalModal__featureItem--more">
                    <span className="renewalModal__featureX">+</span>
                    <span>Y {lostFeatures.length - 5} features más...</span>
                  </li>
                )}
              </ul>
            </div>
          </div>

          {/* Columna derecha */}
          <div className="renewalModal__rightColumn">
            {/* Selector de período */}
            <div className="renewalModal__billing">
              <h4 className="renewalModal__billingTitle">Selecciona período:</h4>
              <div className="renewalModal__billingOptions">
                <button
                  className={`renewalModal__billingBtn ${billingPeriod === 'monthly' ? 'renewalModal__billingBtn--active' : ''}`}
                  onClick={() => setBillingPeriod('monthly')}
                >
                  <span className="renewalModal__billingLabel">Mensual</span>
                  <span className="renewalModal__billingPrice">${prices.monthly}/mes</span>
                </button>
                <button
                  className={`renewalModal__billingBtn ${billingPeriod === 'yearly' ? 'renewalModal__billingBtn--active' : ''}`}
                  onClick={() => setBillingPeriod('yearly')}
                >
                  <span className="renewalModal__billingLabel">Anual</span>
                  <span className="renewalModal__billingPrice">${prices.yearly}/año</span>
                  <span className="renewalModal__billingSavings">Ahorra 17%</span>
                </button>
              </div>
            </div>

            {/* Método de pago */}
            <div className="renewalModal__paymentMethod">
              <div className="renewalModal__mpLogo">MP</div>
              <div className="renewalModal__mpInfo">
                <h4>Pago con MercadoPago</h4>
                <p>Tarjeta, débito, efectivo o transferencia</p>
              </div>
            </div>

            {/* Aviso de reset */}
            <div className="renewalModal__resetWarning">
              <span className="renewalModal__resetIcon"><RefreshCw size={16} /></span>
              <p>
                <strong>Sin renovar:</strong> Tu tienda pasará a plan Gratis automáticamente.
              </p>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="renewalModal__actions">
          <Button
            variant="primary"
            onClick={handleRenew}
            disabled={loading}
          >
            {loading ? 'Procesando...' : <><CreditCard size={16} style={{ marginRight: 6 }} /> Renovar por ${price}</>}
          </Button>
          <Button
            variant="secondary"
            onClick={onDismiss}
            disabled={loading}
          >
            Más tarde
          </Button>
        </div>

        {/* Nota */}
        <div className="renewalModal__note">
          <Lightbulb size={14} /> Tu nueva suscripción comenzará desde la fecha de expiración actual
        </div>
      </div>
    </div>
  )
}
