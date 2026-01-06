import { useState, useEffect } from 'react'
import { 
  Crown, 
  Star, 
  Calendar, 
  Clock, 
  RefreshCw, 
  AlertTriangle, 
  Check, 
  X as XIcon,
  History,
  CreditCard,
  Gift,
  Zap,
  Shield
} from 'lucide-react'
import Button from '../Button/Button'
import './SubscriptionPanel.css'
import {
  getActiveSubscription,
  getSubscriptionHistory,
  cancelSubscription,
  setAutoRenew,
  calculateDaysRemaining,
  formatSubscriptionDate,
  getSubscriptionStatusColor,
} from '../../../lib/supabaseSubscriptionApi'
import { SUBSCRIPTION_TIERS, TIER_LABELS, TIER_COLORS } from '../../../shared/subscriptions'

export default function SubscriptionPanel({ 
  tenantId, 
  onUpgrade,
  showHistory = true,
}) {
  const [subscription, setSubscription] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelImmediate, setCancelImmediate] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [togglingAutoRenew, setTogglingAutoRenew] = useState(false)

  useEffect(() => {
    loadSubscription()
  }, [tenantId])

  const loadSubscription = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const [subData, historyData] = await Promise.all([
        getActiveSubscription(tenantId),
        showHistory ? getSubscriptionHistory(tenantId) : Promise.resolve([]),
      ])
      
      setSubscription(subData)
      setHistory(historyData)
    } catch (err) {
      console.error('Error cargando suscripción:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleAutoRenew = async () => {
    if (!subscription) return
    
    try {
      setTogglingAutoRenew(true)
      await setAutoRenew(tenantId, !subscription.auto_renew)
      setSubscription(prev => ({ ...prev, auto_renew: !prev.auto_renew }))
    } catch (err) {
      console.error('Error toggling auto-renew:', err)
      setError(err.message)
    } finally {
      setTogglingAutoRenew(false)
    }
  }

  const handleCancel = async () => {
    try {
      setCancelling(true)
      await cancelSubscription(tenantId, { immediate: cancelImmediate })
      setShowCancelModal(false)
      await loadSubscription()
    } catch (err) {
      console.error('Error cancelando:', err)
      setError(err.message)
    } finally {
      setCancelling(false)
    }
  }

  if (loading) {
    return (
      <div className="subscriptionPanel subscriptionPanel--loading">
        <div className="subscriptionPanel__spinner" />
        <p>Cargando información de suscripción...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="subscriptionPanel subscriptionPanel--error">
        <AlertTriangle size={24} />
        <p>{error}</p>
        <Button variant="secondary" onClick={loadSubscription}>Reintentar</Button>
      </div>
    )
  }

  if (!subscription) {
    return (
      <div className="subscriptionPanel subscriptionPanel--empty">
        <p>No se encontró información de suscripción</p>
      </div>
    )
  }

  const isFree = subscription.subscription_tier === 'free'
  const isPremium = subscription.subscription_tier === 'premium'
  const isPremiumPro = subscription.subscription_tier === 'premium_pro'
  const isExpired = !isFree && subscription.days_remaining <= 0
  const isExpiringSoon = !isFree && subscription.days_remaining > 0 && subscription.days_remaining <= 7
  const isCancelled = subscription.subscription_status === 'cancelled'
  
  const tierColor = TIER_COLORS[subscription.subscription_tier] || TIER_COLORS[SUBSCRIPTION_TIERS.FREE]
  const statusColor = getSubscriptionStatusColor(subscription.days_remaining)

  return (
    <div className="subscriptionPanel">
      {/* Header con plan actual */}
      <div 
        className={`subscriptionPanel__header ${isExpired ? 'expired' : ''} ${isExpiringSoon ? 'expiring' : ''}`}
        style={{ '--tier-color': tierColor }}
      >
        <div className="subscriptionPanel__planIcon">
          {isPremiumPro ? <Crown size={32} /> : isPremium ? <Star size={32} /> : <Zap size={32} />}
        </div>
        
        <div className="subscriptionPanel__planInfo">
          <h2 className="subscriptionPanel__planName">
            Plan {TIER_LABELS[subscription.subscription_tier]}
            {isCancelled && <span className="subscriptionPanel__cancelledBadge">Cancelado</span>}
          </h2>
          
          {!isFree && (
            <div className="subscriptionPanel__expiry">
              <Calendar size={16} />
              {isExpired ? (
                <span className="expired">Expirado el {formatSubscriptionDate(subscription.premium_until)}</span>
              ) : (
                <span>
                  Válido hasta el <strong>{formatSubscriptionDate(subscription.premium_until)}</strong>
                </span>
              )}
            </div>
          )}
        </div>

        {!isFree && !isExpired && (
          <div 
            className="subscriptionPanel__daysRemaining"
            style={{ '--status-color': statusColor }}
          >
            <Clock size={20} />
            <span className="days">{subscription.days_remaining}</span>
            <span className="label">días restantes</span>
          </div>
        )}
      </div>

      {/* Alertas */}
      {isExpired && (
        <div className="subscriptionPanel__alert subscriptionPanel__alert--error">
          <AlertTriangle size={20} />
          <div>
            <strong>Tu suscripción ha expirado</strong>
            <p>Has vuelto al plan gratuito con funciones limitadas.</p>
          </div>
          <Button size="sm" onClick={onUpgrade}>Renovar ahora</Button>
        </div>
      )}

      {isExpiringSoon && !isExpired && (
        <div className="subscriptionPanel__alert subscriptionPanel__alert--warning">
          <AlertTriangle size={20} />
          <div>
            <strong>Tu suscripción expira pronto</strong>
            <p>Renueva antes del {formatSubscriptionDate(subscription.premium_until)} para no perder beneficios.</p>
          </div>
          {subscription.auto_renew ? (
            <span className="autoRenewActive"><RefreshCw size={14} /> Renovación automática activa</span>
          ) : (
            <Button size="sm" onClick={onUpgrade}>Renovar</Button>
          )}
        </div>
      )}

      {isCancelled && !isExpired && (
        <div className="subscriptionPanel__alert subscriptionPanel__alert--info">
          <AlertTriangle size={20} />
          <div>
            <strong>Suscripción cancelada</strong>
            <p>Conservarás los beneficios hasta el {formatSubscriptionDate(subscription.premium_until)}.</p>
          </div>
        </div>
      )}

      {/* Configuración */}
      {!isFree && !isExpired && !isCancelled && (
        <div className="subscriptionPanel__settings">
          <div className="subscriptionPanel__settingItem">
            <div className="subscriptionPanel__settingInfo">
              <RefreshCw size={18} />
              <div>
                <strong>Renovación automática</strong>
                <p>Se renovará automáticamente antes de expirar</p>
              </div>
            </div>
            <label className="subscriptionPanel__toggle">
              <input
                type="checkbox"
                checked={subscription.auto_renew}
                onChange={handleToggleAutoRenew}
                disabled={togglingAutoRenew}
              />
              <span className="subscriptionPanel__toggleSlider" />
            </label>
          </div>
        </div>
      )}

      {/* Límites de pedidos */}
      <div className="subscriptionPanel__limits">
        <h3><CreditCard size={18} /> Uso del plan</h3>
        <div className="subscriptionPanel__limitItem">
          <span className="label">Pedidos restantes hoy</span>
          <span className="value">
            {subscription.orders_remaining === null ? (
              <span className="unlimited">∞ Ilimitados</span>
            ) : (
              <>
                <strong>{subscription.orders_remaining}</strong>
                <span className="separator">/</span>
                {subscription.orders_limit}
              </>
            )}
          </span>
        </div>
      </div>

      {/* Acciones */}
      <div className="subscriptionPanel__actions">
        {isFree ? (
          <Button variant="primary" onClick={onUpgrade} className="upgradeBtn">
            <Crown size={18} /> Mejorar a Premium
          </Button>
        ) : (
          <>
            {!isPremiumPro && (
              <Button variant="primary" onClick={onUpgrade}>
                <Crown size={18} /> Mejorar a Premium Pro
              </Button>
            )}
            {!isCancelled && (
              <Button 
                variant="ghost" 
                className="cancelBtn"
                onClick={() => setShowCancelModal(true)}
              >
                Cancelar suscripción
              </Button>
            )}
          </>
        )}
      </div>

      {/* Historial */}
      {showHistory && history.length > 0 && (
        <div className="subscriptionPanel__history">
          <h3><History size={18} /> Historial de pagos</h3>
          <div className="subscriptionPanel__historyList">
            {history.slice(0, 5).map(item => (
              <div key={item.id} className="subscriptionPanel__historyItem">
                <div className="subscriptionPanel__historyIcon">
                  {item.source === 'gift' ? <Gift size={16} /> : <CreditCard size={16} />}
                </div>
                <div className="subscriptionPanel__historyInfo">
                  <span className="plan">{TIER_LABELS[item.plan_id] || item.plan_id}</span>
                  <span className="date">{formatSubscriptionDate(item.created_at)}</span>
                </div>
                <div className="subscriptionPanel__historyAmount">
                  {item.source === 'gift' ? (
                    <span className="gift">Regalo</span>
                  ) : (
                    <span className="amount">${item.amount}</span>
                  )}
                </div>
                <div className={`subscriptionPanel__historyStatus status--${item.status}`}>
                  {item.status === 'approved' && <Check size={14} />}
                  {item.status === 'pending' && <Clock size={14} />}
                  {item.status === 'failed' && <XIcon size={14} />}
                  {item.status === 'cancelled' && <XIcon size={14} />}
                  <span>{translateStatus(item.status)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Garantía */}
      <div className="subscriptionPanel__guarantee">
        <Shield size={16} />
        <span>Garantía de devolución de 30 días</span>
      </div>

      {/* Modal de cancelación */}
      {showCancelModal && (
        <div className="subscriptionPanel__modal">
          <div className="subscriptionPanel__modalContent">
            <h3>¿Cancelar suscripción?</h3>
            <p>
              {cancelImmediate 
                ? 'Perderás acceso a las funciones premium inmediatamente.'
                : `Conservarás los beneficios hasta el ${formatSubscriptionDate(subscription.premium_until)}.`
              }
            </p>
            
            <label className="subscriptionPanel__checkboxLabel">
              <input
                type="checkbox"
                checked={cancelImmediate}
                onChange={(e) => setCancelImmediate(e.target.checked)}
              />
              <span>Cancelar inmediatamente (sin período de gracia)</span>
            </label>
            
            <div className="subscriptionPanel__modalActions">
              <Button 
                variant="secondary" 
                onClick={() => setShowCancelModal(false)}
                disabled={cancelling}
              >
                Volver
              </Button>
              <Button 
                variant="danger" 
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? 'Cancelando...' : 'Confirmar cancelación'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function translateStatus(status) {
  const translations = {
    approved: 'Aprobado',
    pending: 'Pendiente',
    failed: 'Fallido',
    cancelled: 'Cancelado',
    refunded: 'Reembolsado',
    expired: 'Expirado',
  }
  return translations[status] || status
}
