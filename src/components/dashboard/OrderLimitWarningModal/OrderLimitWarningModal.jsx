import { useState } from 'react'
import './OrderLimitWarningModal.css'
import { 
  X, 
  ShoppingBag, 
  AlertTriangle, 
  Crown, 
  Zap,
  ArrowRight,
  Sparkles,
  Star,
  Check,
  Lock,
} from 'lucide-react'
import { TIER_LABELS, TIER_ICONS, ORDER_LIMITS, TIER_PRICES } from '../../../shared/subscriptions'

export default function OrderLimitWarningModal({ 
  isOpen, 
  onClose, 
  currentTier = 'free',
  ordersUsed = 0,
  ordersLimit = 15,
  onUpgrade,
  resetDate = null,
}) {
  const [selectedPlan, setSelectedPlan] = useState('premium')
  const [billing, setBilling] = useState('monthly')

  if (!isOpen) return null

  // Format reset date for display (now daily)
  const formatResetDate = (dateStr) => {
    if (!dateStr) return 'mañana a las 00:00'
    const date = new Date(dateStr)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    const isTomorrow = date.toDateString() === new Date(now.getTime() + 86400000).toDateString()
    
    if (isToday) return 'hoy a las 00:00'
    if (isTomorrow) return 'mañana a las 00:00'
    
    return date.toLocaleDateString('es-ES', { 
      weekday: 'long',
      day: 'numeric', 
      month: 'long'
    }) + ' a las 00:00'
  }

  // Plans to show for upgrade
  const upgradePlans = [
    {
      tier: 'premium',
      name: 'Premium',
      icon: <Star size={20} />,
      ordersLimit: ORDER_LIMITS.premium,
      monthlyPrice: TIER_PRICES?.premium?.monthly || 9.99,
      yearlyPrice: TIER_PRICES?.premium?.yearly || 99,
      features: [
        '80 pedidos/día',
        'Carrusel de productos',
        'Galería de imágenes',
        'Categorías visuales',
        'Sin marca de agua',
      ],
      recommended: currentTier === 'free',
    },
    {
      tier: 'premium_pro',
      name: 'Premium Pro',
      icon: <Crown size={20} />,
      ordersLimit: null, // Unlimited
      monthlyPrice: TIER_PRICES?.premium_pro?.monthly || 19.99,
      yearlyPrice: TIER_PRICES?.premium_pro?.yearly || 199,
      features: [
        'Pedidos ILIMITADOS cada día',
        'Todas las funciones Premium',
        'Testimonios y FAQ',
        'Videos embebidos',
        'Prioridad en soporte',
      ],
      recommended: currentTier === 'premium',
    },
  ]

  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade(selectedPlan, billing)
    }
  }

  const getPrice = (plan) => {
    return billing === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice
  }

  return (
    <div className="orderLimitModal__overlay">
      <div className="orderLimitModal">
        {/* Header */}
        <div className="orderLimitModal__header">
          <button className="orderLimitModal__close" onClick={onClose}>
            <X size={20} />
          </button>
          
          <div className="orderLimitModal__alertIcon">
            <AlertTriangle size={32} />
          </div>
          
          <h2 className="orderLimitModal__title">
            ¡Límite de pedidos alcanzado!
          </h2>
          
          <p className="orderLimitModal__subtitle">
            Has usado todos los <strong>{ordersLimit} pedidos</strong> de tu plan{' '}
            <span className="orderLimitModal__tierBadge">
              {TIER_ICONS[currentTier]} {TIER_LABELS[currentTier]}
            </span>
          </p>
        </div>

        {/* Body */}
        <div className="orderLimitModal__body">
          {/* Current status */}
          <div className="orderLimitModal__status">
            <div className="orderLimitModal__statusBar">
              <div className="orderLimitModal__statusFill" style={{ width: '100%' }} />
            </div>
            <div className="orderLimitModal__statusInfo">
              <span>{ordersUsed} / {ordersLimit} pedidos usados</span>
              <span className="orderLimitModal__statusReset">
                Se renuevan {formatResetDate(resetDate)}
              </span>
            </div>
          </div>

          {/* Upgrade message */}
          <div className="orderLimitModal__upgradeMessage">
            <Sparkles size={20} />
            <p>
              <strong>¡No pierdas ventas!</strong> Actualiza tu plan para seguir recibiendo pedidos.
            </p>
          </div>

          {/* Billing toggle */}
          <div className="orderLimitModal__billingToggle">
            <button
              className={`orderLimitModal__billingBtn ${billing === 'monthly' ? 'orderLimitModal__billingBtn--active' : ''}`}
              onClick={() => setBilling('monthly')}
            >
              Mensual
            </button>
            <button
              className={`orderLimitModal__billingBtn ${billing === 'yearly' ? 'orderLimitModal__billingBtn--active' : ''}`}
              onClick={() => setBilling('yearly')}
            >
              Anual <span className="orderLimitModal__billingSave">-20%</span>
            </button>
          </div>

          {/* Plans */}
          <div className="orderLimitModal__plans">
            {upgradePlans
              .filter(plan => {
                // Don't show current plan
                if (plan.tier === currentTier) return false
                // For premium users, only show premium_pro
                if (currentTier === 'premium' && plan.tier !== 'premium_pro') return false
                return true
              })
              .map((plan) => (
                <button
                  key={plan.tier}
                  className={`orderLimitModal__plan ${selectedPlan === plan.tier ? 'orderLimitModal__plan--selected' : ''} ${plan.recommended ? 'orderLimitModal__plan--recommended' : ''}`}
                  onClick={() => setSelectedPlan(plan.tier)}
                >
                  {plan.recommended && (
                    <span className="orderLimitModal__planBadge">Recomendado</span>
                  )}
                  
                  <div className="orderLimitModal__planHeader">
                    <span className="orderLimitModal__planIcon">{plan.icon}</span>
                    <span className="orderLimitModal__planName">{plan.name}</span>
                  </div>
                  
                  <div className="orderLimitModal__planPrice">
                    <span className="orderLimitModal__planCurrency">$</span>
                    <span className="orderLimitModal__planAmount">{getPrice(plan)}</span>
                    <span className="orderLimitModal__planPeriod">/{billing === 'yearly' ? 'año' : 'mes'}</span>
                  </div>
                  
                  <div className="orderLimitModal__planOrders">
                    <ShoppingBag size={14} />
                    <span>{plan.ordersLimit ? `${plan.ordersLimit} pedidos/mes` : '∞ Ilimitados'}</span>
                  </div>
                  
                  <ul className="orderLimitModal__planFeatures">
                    {plan.features.slice(0, 3).map((feature, idx) => (
                      <li key={idx}><Check size={14} style={{display: 'inline', verticalAlign: 'middle', marginRight: '4px'}} /> {feature}</li>
                    ))}
                  </ul>
                </button>
              ))}
          </div>
        </div>

        {/* Footer */}
        <div className="orderLimitModal__footer">
          <button className="orderLimitModal__skipBtn" onClick={onClose}>
            Lo haré después
          </button>
          
          <button className="orderLimitModal__upgradeBtn" onClick={handleUpgrade}>
            <Zap size={18} />
            Actualizar ahora
            <ArrowRight size={18} />
          </button>
        </div>

        {/* Note */}
        <p className="orderLimitModal__note">
          <Lock size={14} style={{display: 'inline', verticalAlign: 'middle', marginRight: '4px'}} /> Pago seguro con MercadoPago • Cancela cuando quieras
        </p>
      </div>
    </div>
  )
}
