import './OrdersRemainingBadge.css'
import { ShoppingBag, Crown, Infinity } from 'lucide-react'
import { TIER_LABELS, TIER_COLORS } from '../../../shared/subscriptions'

export default function OrdersRemainingBadge({ 
  remaining, 
  limit, 
  tier = 'free', 
  isUnlimited = false,
  showLabel = true,
  size = 'default' // 'small', 'default', 'large'
}) {
  // Calculate percentage remaining
  const percentage = isUnlimited ? 100 : limit > 0 ? (remaining / limit) * 100 : 0
  
  // Determine urgency level
  const getUrgencyLevel = () => {
    if (isUnlimited) return 'unlimited'
    if (remaining <= 0) return 'empty'
    if (percentage <= 20) return 'critical'
    if (percentage <= 40) return 'warning'
    return 'normal'
  }
  
  const urgency = getUrgencyLevel()
  const tierColor = TIER_COLORS[tier] || '#64748b'
  
  if (isUnlimited) {
    return (
      <div 
        className={`ordersRemainingBadge ordersRemainingBadge--${size} ordersRemainingBadge--unlimited`}
        style={{ '--tier-color': tierColor }}
        title="Plan con pedidos ilimitados"
      >
        <div className="ordersRemainingBadge__icon">
          <Infinity size={size === 'small' ? 14 : 16} />
        </div>
        {showLabel && (
          <span className="ordersRemainingBadge__text">
            Ilimitado
          </span>
        )}
      </div>
    )
  }
  
  return (
    <div 
      className={`ordersRemainingBadge ordersRemainingBadge--${size} ordersRemainingBadge--${urgency}`}
      style={{ '--tier-color': tierColor }}
      title={`${remaining} de ${limit} pedidos restantes este mes`}
    >
      <div className="ordersRemainingBadge__icon">
        <ShoppingBag size={size === 'small' ? 14 : 16} />
      </div>
      <div className="ordersRemainingBadge__content">
        <span className="ordersRemainingBadge__count">
          {remaining}
        </span>
        {showLabel && (
          <span className="ordersRemainingBadge__label">
            pedidos restantes
          </span>
        )}
      </div>
      
      {/* Progress bar */}
      <div className="ordersRemainingBadge__progressContainer">
        <div 
          className="ordersRemainingBadge__progress" 
          style={{ width: `${Math.max(percentage, 0)}%` }}
        />
      </div>
    </div>
  )
}
