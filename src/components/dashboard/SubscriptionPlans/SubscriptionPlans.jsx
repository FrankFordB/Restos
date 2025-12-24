import { useState } from 'react'
import './SubscriptionPlans.css'
import {
  SUBSCRIPTION_TIERS,
  TIER_LABELS,
  TIER_FEATURES,
  TIER_PRICES,
} from '../../../shared/subscriptions'

export default function SubscriptionPlans({ currentTier = SUBSCRIPTION_TIERS.FREE, onUpgrade }) {
  const [billing, setBilling] = useState('monthly') // 'monthly' | 'yearly'

  const plans = [
    {
      tier: SUBSCRIPTION_TIERS.FREE,
      icon: '🆓',
      name: 'Gratis',
      description: 'Para comenzar',
    },
    {
      tier: SUBSCRIPTION_TIERS.PREMIUM,
      icon: '⭐',
      name: 'Premium',
      description: 'Para crecer',
      featured: true,
    },
    {
      tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
      icon: '👑',
      name: 'Premium Pro',
      description: 'Sin límites',
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

  const handleUpgrade = (tier) => {
    if (onUpgrade) {
      onUpgrade(tier, billing)
    }
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
          const isCurrent = currentTier === plan.tier
          const price = getPrice(plan.tier)
          const savings = getSavings(plan.tier)
          const features = TIER_FEATURES[plan.tier]

          return (
            <div
              key={plan.tier}
              className={`planCard ${plan.featured ? 'planCard--featured' : ''}`}
            >
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
                {isCurrent ? (
                  <div className="planCard__current">
                    ✓ Tu plan actual
                  </div>
                ) : plan.tier === SUBSCRIPTION_TIERS.FREE ? (
                  <button className="planCard__cta planCard__cta--secondary" disabled>
                    Plan gratuito
                  </button>
                ) : (
                  <button
                    className={`planCard__cta ${plan.featured ? 'planCard__cta--primary' : 'planCard__cta--secondary'}`}
                    onClick={() => handleUpgrade(plan.tier)}
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
