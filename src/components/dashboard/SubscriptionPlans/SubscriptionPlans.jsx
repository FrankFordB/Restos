import { useState } from 'react'
import './SubscriptionPlans.css'
import {
  SUBSCRIPTION_TIERS,
  TIER_LABELS,
  TIER_FEATURES,
  TIER_PRICES,
  TIER_ORDER,
  isDowngrade,
} from '../../../shared/subscriptions'

export default function SubscriptionPlans({ 
  currentTier = SUBSCRIPTION_TIERS.FREE, 
  onUpgrade,
  onDowngrade,
}) {
  const [billing, setBilling] = useState('monthly') // 'monthly' | 'yearly'
  const [selectedPlan, setSelectedPlan] = useState(null) // Para hover/selección visual

  const plans = [
    {
      tier: SUBSCRIPTION_TIERS.FREE,
      icon: '🆓',
      name: 'Gratis',
      description: 'Para comenzar',
      accentColor: '#6b7280', // gray
    },
    {
      tier: SUBSCRIPTION_TIERS.PREMIUM,
      icon: '⭐',
      name: 'Premium',
      description: 'Para crecer',
      featured: true,
      accentColor: '#f59e0b', // amber
    },
    {
      tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
      icon: '👑',
      name: 'Premium Pro',
      description: 'Sin límites',
      accentColor: '#8b5cf6', // violet
    },
  ]

  const getPrice = (tier) => {
    const prices = TIER_PRICES[tier]
    return billing === 'yearly' ? prices.yearly : prices.monthly
  }

  const getSavings = (tier) => {
    const prices = TIER_PRICES[tier]
    if (billing === 'yearly' && prices.monthly > 0) {
      const yearlyMonthly = prices.yearly / 12
      const savings = Math.round(((prices.monthly - yearlyMonthly) / prices.monthly) * 100)
      return savings > 0 ? `Ahorra ${savings}%` : null
    }
    return null
  }

  const handlePlanClick = (plan, action) => {
    if (action.type === 'current') return
    
    if (action.type === 'downgrade') {
      onDowngrade?.(plan.tier)
    } else {
      onUpgrade?.(plan.tier, billing)
    }
  }

  // Determinar qué acción mostrar para cada plan
  const getActionForPlan = (planTier) => {
    if (currentTier === planTier) {
      return { type: 'current' }
    }
    
    if (isDowngrade(currentTier, planTier)) {
      return { type: 'downgrade' }
    }
    
    return { type: 'upgrade' }
  }

  return (
    <div className="subscriptionPlans">
      <div className="subscriptionPlans__header">
        <h2 className="subscriptionPlans__title">Elige tu plan</h2>
        <p className="subscriptionPlans__subtitle">
          Desbloquea todo el potencial de tu tienda
        </p>

        <div className="subscriptionPlans__toggle">
          <button
            className={`subscriptionPlans__toggleBtn ${billing === 'monthly' ? 'subscriptionPlans__toggleBtn--active' : ''}`}
            onClick={() => setBilling('monthly')}
          >
            Mensual
          </button>
          <button
            className={`subscriptionPlans__toggleBtn ${billing === 'yearly' ? 'subscriptionPlans__toggleBtn--active' : ''}`}
            onClick={() => setBilling('yearly')}
          >
            Anual
          </button>
        </div>
      </div>

      <div className="subscriptionPlans__grid">
        {plans.map((plan) => {
          const action = getActionForPlan(plan.tier)
          const price = getPrice(plan.tier)
          const savings = getSavings(plan.tier)
          const features = TIER_FEATURES[plan.tier]
          const isSelected = selectedPlan === plan.tier
          const isCurrent = action.type === 'current'
          const isClickable = !isCurrent

          return (
            <div
              key={plan.tier}
              className={`planCard ${plan.featured ? 'planCard--featured' : ''} ${isSelected ? 'planCard--selected' : ''} ${isCurrent ? 'planCard--current' : ''} ${isClickable ? 'planCard--clickable' : ''}`}
              style={{ '--plan-accent': plan.accentColor }}
              onClick={() => isClickable && handlePlanClick(plan, action)}
              onMouseEnter={() => isClickable && setSelectedPlan(plan.tier)}
              onMouseLeave={() => setSelectedPlan(null)}
            >
              {isCurrent && (
                <div className="planCard__currentBadge">Tu plan</div>
              )}
              
              <div className="planCard__header">
                <div className="planCard__icon">{plan.icon}</div>
                <h3 className="planCard__name">{plan.name}</h3>
                
                <div className="planCard__price">
                  <span className="planCard__currency">$</span>
                  <span className="planCard__amount">{price}</span>
                  <span className="planCard__period">
                    /{billing === 'yearly' ? 'año' : 'mes'}
                  </span>
                </div>
                
                {savings && (
                  <div className="planCard__savings">{savings}</div>
                )}
              </div>

              <div className="planCard__body">
                <ul className="planCard__features">
                  {features.map((feature, idx) => (
                    <li key={idx} className="planCard__feature">
                      <span className="planCard__featureIcon">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="planCard__footer">
                {action.type === 'current' ? (
                  <div className="planCard__currentLabel">
                    ✓ Plan activo
                  </div>
                ) : action.type === 'downgrade' ? (
                  <button
                    className="planCard__cta planCard__cta--downgrade"
                    onClick={(e) => {
                      e.stopPropagation()
                      handlePlanClick(plan, action)
                    }}
                  >
                    ⚠️ Cambiar a {plan.name}
                  </button>
                ) : (
                  <button
                    className={`planCard__cta ${plan.featured ? 'planCard__cta--primary' : 'planCard__cta--secondary'}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      handlePlanClick(plan, action)
                    }}
                  >
                    {currentTier === SUBSCRIPTION_TIERS.FREE ? 'Comenzar' : 'Actualizar'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
