import { useState } from 'react'
import './PremiumModal.css'
import Button from '../Button/Button'
import { SUBSCRIPTION_TIERS, TIER_LABELS, TIER_COLORS } from '../../../shared/subscriptions'

const PLAN_FEATURES = {
  [SUBSCRIPTION_TIERS.PREMIUM]: {
    price: '$9.99/mes',
    yearlyPrice: '$99/año',
    savings: 'Ahorra 17%',
    icon: '⭐',
    color: TIER_COLORS[SUBSCRIPTION_TIERS.PREMIUM],
    features: [
      { text: 'Carrusel de productos', icon: '🎠' },
      { text: 'Galería de imágenes interactiva', icon: '🖼️' },
      { text: 'Banner promocional', icon: '🎨' },
      { text: 'Mapa de ubicación', icon: '📍' },
      { text: 'Categorías de productos', icon: '📂' },
      { text: '3 layouts de cards extra', icon: '🃏' },
      { text: 'Estilos Contorno y Elevado', icon: '✨' },
      { text: 'Soporte prioritario', icon: '💬' },
    ],
    notIncluded: [
      'Testimonios de clientes',
      'Video embebido',
      'Newsletter',
      'FAQ acordeón',
      'Página de equipo',
      'Estadísticas animadas',
      'Layouts premium pro',
    ],
  },
  [SUBSCRIPTION_TIERS.PREMIUM_PRO]: {
    price: '$19.99/mes',
    yearlyPrice: '$199/año',
    savings: 'Ahorra 17%',
    icon: '👑',
    color: TIER_COLORS[SUBSCRIPTION_TIERS.PREMIUM_PRO],
    features: [
      { text: 'Todo lo de Premium', icon: '⭐', highlight: true },
      { text: 'Testimonios de clientes', icon: '💬' },
      { text: 'Video embebido (YouTube)', icon: '🎬' },
      { text: 'Formulario de newsletter', icon: '📰' },
      { text: 'Preguntas frecuentes', icon: '❓' },
      { text: 'Página de equipo', icon: '👥' },
      { text: 'Estadísticas animadas', icon: '📊' },
      { text: '4 layouts exclusivos', icon: '🎴' },
      { text: 'Estilo Minimalista', icon: '🎯' },
      { text: 'Page Builder completo', icon: '🏗️' },
      { text: 'Plantillas premium', icon: '📋' },
      { text: 'Soporte VIP 24/7', icon: '🛡️' },
    ],
    notIncluded: [],
  },
}

export default function PremiumModal({ open, onClose, currentTier = SUBSCRIPTION_TIERS.FREE }) {
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [billingCycle, setBillingCycle] = useState('monthly')

  if (!open) return null

  const handleSelectPlan = (tier) => {
    setSelectedPlan(tier)
  }

  const handleProceedToPayment = () => {
    // Aquí irá la lógica de pago (Stripe, MercadoPago, etc.)
    alert(`Redirigiendo al pago de ${TIER_LABELS[selectedPlan]}...`)
    // TODO: Integrar pasarela de pago
  }

  const isPremium = currentTier === SUBSCRIPTION_TIERS.PREMIUM
  const isPremiumPro = currentTier === SUBSCRIPTION_TIERS.PREMIUM_PRO

  return (
    <div className="premiumModal__overlay">
      <div className="premiumModal">
        <button className="premiumModal__close" onClick={onClose}>✕</button>
        
        <div className="premiumModal__header">
          <h2 className="premiumModal__title">
            <span className="premiumModal__crown">👑</span>
            Desbloquea todo el potencial
          </h2>
          <p className="premiumModal__subtitle">
            Elige el plan perfecto para hacer crecer tu restaurante
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="premiumModal__billingToggle">
          <button 
            className={`premiumModal__billingBtn ${billingCycle === 'monthly' ? 'active' : ''}`}
            onClick={() => setBillingCycle('monthly')}
          >
            Mensual
          </button>
          <button 
            className={`premiumModal__billingBtn ${billingCycle === 'yearly' ? 'active' : ''}`}
            onClick={() => setBillingCycle('yearly')}
          >
            Anual
            <span className="premiumModal__savingsBadge">-17%</span>
          </button>
        </div>

        <div className="premiumModal__plans">
          {/* Plan Premium */}
          <div 
            className={`premiumModal__plan ${selectedPlan === SUBSCRIPTION_TIERS.PREMIUM ? 'selected' : ''} ${isPremium ? 'current' : ''}`}
            onClick={() => !isPremium && handleSelectPlan(SUBSCRIPTION_TIERS.PREMIUM)}
            style={{ '--plan-color': PLAN_FEATURES[SUBSCRIPTION_TIERS.PREMIUM].color }}
          >
            {isPremium && <div className="premiumModal__currentBadge">Tu plan actual</div>}
            <div className="premiumModal__planIcon">{PLAN_FEATURES[SUBSCRIPTION_TIERS.PREMIUM].icon}</div>
            <h3 className="premiumModal__planName">{TIER_LABELS[SUBSCRIPTION_TIERS.PREMIUM]}</h3>
            <div className="premiumModal__planPrice">
              <span className="price">
                {billingCycle === 'monthly' 
                  ? PLAN_FEATURES[SUBSCRIPTION_TIERS.PREMIUM].price 
                  : PLAN_FEATURES[SUBSCRIPTION_TIERS.PREMIUM].yearlyPrice}
              </span>
              {billingCycle === 'yearly' && (
                <span className="savings">{PLAN_FEATURES[SUBSCRIPTION_TIERS.PREMIUM].savings}</span>
              )}
            </div>
            
            <ul className="premiumModal__features">
              {PLAN_FEATURES[SUBSCRIPTION_TIERS.PREMIUM].features.map((f, i) => (
                <li key={i} className="premiumModal__feature">
                  <span className="feature-icon">{f.icon}</span>
                  <span className="feature-text">{f.text}</span>
                </li>
              ))}
            </ul>

            {PLAN_FEATURES[SUBSCRIPTION_TIERS.PREMIUM].notIncluded.length > 0 && (
              <div className="premiumModal__notIncluded">
                <span className="notIncluded-label">No incluido:</span>
                {PLAN_FEATURES[SUBSCRIPTION_TIERS.PREMIUM].notIncluded.slice(0, 3).map((f, i) => (
                  <span key={i} className="notIncluded-item">❌ {f}</span>
                ))}
                {PLAN_FEATURES[SUBSCRIPTION_TIERS.PREMIUM].notIncluded.length > 3 && (
                  <span className="notIncluded-more">
                    +{PLAN_FEATURES[SUBSCRIPTION_TIERS.PREMIUM].notIncluded.length - 3} más
                  </span>
                )}
              </div>
            )}

            {!isPremium && (
              <Button 
                variant={selectedPlan === SUBSCRIPTION_TIERS.PREMIUM ? 'primary' : 'secondary'}
                className="premiumModal__selectBtn"
              >
                {selectedPlan === SUBSCRIPTION_TIERS.PREMIUM ? '✓ Seleccionado' : 'Seleccionar'}
              </Button>
            )}
          </div>

          {/* Plan Premium Pro */}
          <div 
            className={`premiumModal__plan premiumModal__plan--pro ${selectedPlan === SUBSCRIPTION_TIERS.PREMIUM_PRO ? 'selected' : ''} ${isPremiumPro ? 'current' : ''}`}
            onClick={() => !isPremiumPro && handleSelectPlan(SUBSCRIPTION_TIERS.PREMIUM_PRO)}
            style={{ '--plan-color': PLAN_FEATURES[SUBSCRIPTION_TIERS.PREMIUM_PRO].color }}
          >
            <div className="premiumModal__popularBadge">🔥 Más popular</div>
            {isPremiumPro && <div className="premiumModal__currentBadge">Tu plan actual</div>}
            <div className="premiumModal__planIcon">{PLAN_FEATURES[SUBSCRIPTION_TIERS.PREMIUM_PRO].icon}</div>
            <h3 className="premiumModal__planName">{TIER_LABELS[SUBSCRIPTION_TIERS.PREMIUM_PRO]}</h3>
            <div className="premiumModal__planPrice">
              <span className="price">
                {billingCycle === 'monthly' 
                  ? PLAN_FEATURES[SUBSCRIPTION_TIERS.PREMIUM_PRO].price 
                  : PLAN_FEATURES[SUBSCRIPTION_TIERS.PREMIUM_PRO].yearlyPrice}
              </span>
              {billingCycle === 'yearly' && (
                <span className="savings">{PLAN_FEATURES[SUBSCRIPTION_TIERS.PREMIUM_PRO].savings}</span>
              )}
            </div>
            
            <ul className="premiumModal__features">
              {PLAN_FEATURES[SUBSCRIPTION_TIERS.PREMIUM_PRO].features.map((f, i) => (
                <li key={i} className={`premiumModal__feature ${f.highlight ? 'highlight' : ''}`}>
                  <span className="feature-icon">{f.icon}</span>
                  <span className="feature-text">{f.text}</span>
                </li>
              ))}
            </ul>

            {!isPremiumPro && (
              <Button 
                variant={selectedPlan === SUBSCRIPTION_TIERS.PREMIUM_PRO ? 'primary' : 'secondary'}
                className="premiumModal__selectBtn"
              >
                {selectedPlan === SUBSCRIPTION_TIERS.PREMIUM_PRO ? '✓ Seleccionado' : 'Seleccionar'}
              </Button>
            )}
          </div>
        </div>

        {/* CTA Button */}
        {selectedPlan && (
          <div className="premiumModal__cta">
            <Button 
              size="lg" 
              onClick={handleProceedToPayment}
              className="premiumModal__ctaBtn"
            >
              🚀 Continuar con {TIER_LABELS[selectedPlan]} - {billingCycle === 'monthly' 
                ? PLAN_FEATURES[selectedPlan].price 
                : PLAN_FEATURES[selectedPlan].yearlyPrice}
            </Button>
            <p className="premiumModal__ctaNote">
              Cancela cuando quieras · Pago seguro · Garantía 30 días
            </p>
          </div>
        )}

        {/* Comparison Link */}
        <div className="premiumModal__footer">
          <span className="premiumModal__guarantee">
            🛡️ Garantía de devolución de 30 días
          </span>
        </div>
      </div>
    </div>
  )
}
