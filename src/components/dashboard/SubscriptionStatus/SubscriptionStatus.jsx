import { useState, useEffect } from 'react'
import './SubscriptionStatus.css'
import Card from '../../ui/Card/Card'
import Button from '../../ui/Button/Button'
import RenewalWarningModal from '../../ui/RenewalWarningModal/RenewalWarningModal'
import {
  SUBSCRIPTION_TIERS,
  TIER_LABELS,
  TIER_COLORS,
  TIER_ICONS,
  getSubscriptionStatus,
  calculateRenewalExpiry,
  ORDER_LIMITS,
} from '../../../shared/subscriptions'
import {
  isPlatformMPConfigured,
  formatAmount,
} from '../../../lib/mercadopago'
import {
  updateTenantSubscriptionTier,
  getTenantAutoRenew,
  setTenantAutoRenew,
} from '../../../lib/supabaseMercadopagoApi'
import { fetchOrderLimitsStatus, subscribeToOrderLimits } from '../../../lib/supabaseApi'
import { isSupabaseConfigured } from '../../../lib/supabaseClient'
import { Star, Crown, Package, AlertTriangle, Clock, Calendar, RefreshCw, AlertCircle } from 'lucide-react'

/**
 * Componente que muestra el estado actual de la suscripción
 * Incluye opción de renovación automática y alertas de expiración
 */
export default function SubscriptionStatus({
  tenant,
  onRenewalComplete,
}) {
  const [autoRenew, setAutoRenew] = useState(false)
  const [loadingAutoRenew, setLoadingAutoRenew] = useState(false)
  const [showRenewalModal, setShowRenewalModal] = useState(false)
  const [renewalLoading, setRenewalLoading] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  
  // Order limits state
  const [orderLimits, setOrderLimits] = useState({
    limit: null,
    remaining: null,
    isUnlimited: false,
    resetDate: null,
  })

  const status = getSubscriptionStatus(tenant)
  const mpConfigured = isPlatformMPConfigured()

  // Cargar configuración de auto-renovación
  useEffect(() => {
    const loadAutoRenew = async () => {
      if (tenant?.id) {
        const value = await getTenantAutoRenew(tenant.id)
        setAutoRenew(value)
      }
    }
    loadAutoRenew()
  }, [tenant?.id])

  // Cargar y suscribirse a los límites de pedidos
  useEffect(() => {
    if (!tenant?.id || !isSupabaseConfigured) return
    
    const loadOrderLimits = async () => {
      try {
        const status = await fetchOrderLimitsStatus(tenant.id)
        setOrderLimits(status)
      } catch (err) {
        console.error('Error loading order limits:', err)
      }
    }
    
    loadOrderLimits()
    
    // Suscribirse a cambios en tiempo real
    const unsubscribe = subscribeToOrderLimits(tenant.id, (newStatus) => {
      setOrderLimits(newStatus)
    })
    
    return () => unsubscribe()
  }, [tenant?.id])

  // Mostrar modal de renovación si está por expirar
  useEffect(() => {
    if (status.isExpiringSoon && !dismissed && !autoRenew) {
      setShowRenewalModal(true)
    }
  }, [status.isExpiringSoon, dismissed, autoRenew])

  const handleAutoRenewToggle = async () => {
    if (!tenant?.id) return
    
    setLoadingAutoRenew(true)
    try {
      const newValue = !autoRenew
      await setTenantAutoRenew(tenant.id, newValue)
      setAutoRenew(newValue)
    } catch (err) {
      console.error('Error updating auto-renew:', err)
    } finally {
      setLoadingAutoRenew(false)
    }
  }

  const handleRenew = async (tier, billingPeriod) => {
    if (!tenant?.id) return
    
    setRenewalLoading(true)
    try {
      // Calcular nueva fecha de expiración
      const newExpiry = calculateRenewalExpiry(status.expiresAt, billingPeriod)
      
      // Actualizar suscripción
      await updateTenantSubscriptionTier(tenant.id, tier, newExpiry)
      
      setShowRenewalModal(false)
      
      if (onRenewalComplete) {
        onRenewalComplete(tier)
      }
      
      // Recargar para reflejar cambios
      window.location.reload()
    } catch (err) {
      console.error('Error renewing subscription:', err)
      alert('Error al renovar. Por favor intenta nuevamente.')
    } finally {
      setRenewalLoading(false)
    }
  }

  const handleDismissRenewal = () => {
    setShowRenewalModal(false)
    setDismissed(true)
  }

  // Si es FREE, no mostrar estado de suscripción
  if (!status.isPremium) {
    return null
  }

  const tierColor = TIER_COLORS[status.tier] || '#64748b'
  const tierIcon = status.tier === 'premium_pro' ? <Crown size={20} /> : status.tier === 'premium' ? <Star size={20} /> : <Package size={20} />
  const tierLabel = TIER_LABELS[status.tier] || 'Free'

  return (
    <>
      <Card title="Estado de Suscripción">
        <div className="subscriptionStatus">
          {/* Badge del plan actual */}
          <div className="subscriptionStatus__plan">
            <div 
              className="subscriptionStatus__badge"
              style={{ '--tier-color': tierColor }}
            >
              <span className="subscriptionStatus__icon">{tierIcon}</span>
              <span className="subscriptionStatus__tier">{tierLabel}</span>
            </div>
          </div>

          {/* Información de expiración */}
          <div className="subscriptionStatus__info">
            <div className="subscriptionStatus__expiry">
              <span className="subscriptionStatus__label">Vence:</span>
              <span className={`subscriptionStatus__date ${status.isExpiringSoon ? 'subscriptionStatus__date--warning' : ''} ${status.hasExpired ? 'subscriptionStatus__date--expired' : ''}`}>
                {status.expiresAt ? (
                  new Date(status.expiresAt).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })
                ) : (
                  'Sin fecha'
                )}
              </span>
            </div>
            
            {/* Pedidos restantes */}
            <div className="subscriptionStatus__orders">
              <span className="subscriptionStatus__label">Pedidos este mes:</span>
              {orderLimits.isUnlimited ? (
                <span className="subscriptionStatus__ordersUnlimited">
                  ∞ Ilimitados
                </span>
              ) : (
                <span className={`subscriptionStatus__ordersCount ${
                  orderLimits.remaining <= 0 ? 'subscriptionStatus__ordersCount--empty' :
                  orderLimits.remaining <= 5 ? 'subscriptionStatus__ordersCount--critical' :
                  orderLimits.remaining <= 10 ? 'subscriptionStatus__ordersCount--warning' : ''
                }`}>
                  {orderLimits.remaining ?? '?'} / {orderLimits.limit ?? '?'} restantes
                </span>
              )}
            </div>
            
            <div className="subscriptionStatus__remaining">
              {status.hasExpired ? (
                <span className="subscriptionStatus__expired">
                  <AlertTriangle size={14} /> ¡Suscripción expirada!
                </span>
              ) : status.isExpiringSoon ? (
                <span className="subscriptionStatus__warning">
                  <Clock size={14} /> ¡Vence {status.daysRemaining === 0 ? 'hoy' : status.daysRemaining === 1 ? 'mañana' : `en ${status.daysRemaining} días`}!
                </span>
              ) : (
                <span className="subscriptionStatus__days">
                  <Calendar size={14} /> {status.daysRemaining} días restantes
                </span>
              )}
            </div>
          </div>

          {/* Toggle de auto-renovación */}
          <div className="subscriptionStatus__autoRenew">
            <label className="subscriptionStatus__toggleLabel">
              <div className="subscriptionStatus__toggleInfo">
                <span className="subscriptionStatus__toggleTitle"><RefreshCw size={14} /> Renovación automática</span>
                <span className="subscriptionStatus__toggleDesc">
                  {autoRenew 
                    ? 'Tu suscripción se renovará automáticamente' 
                    : 'Recibirás un aviso antes de que expire'}
                </span>
              </div>
              <div className={`subscriptionStatus__toggle ${autoRenew ? 'subscriptionStatus__toggle--active' : ''}`}>
                <input
                  type="checkbox"
                  checked={autoRenew}
                  onChange={handleAutoRenewToggle}
                  disabled={loadingAutoRenew}
                />
                <span className="subscriptionStatus__toggleSlider"></span>
              </div>
            </label>
          </div>

          {/* Alerta si está por vencer */}
          {(status.isExpiringSoon || status.hasExpired) && (
            <div className={`subscriptionStatus__alert ${status.hasExpired ? 'subscriptionStatus__alert--expired' : ''}`}>
              <span className="subscriptionStatus__alertIcon">
                {status.hasExpired ? <AlertCircle size={18} /> : <AlertTriangle size={18} />}
              </span>
              <div className="subscriptionStatus__alertContent">
                <strong>
                  {status.hasExpired 
                    ? '¡Tu suscripción ha expirado!' 
                    : '¡Tu suscripción está por vencer!'}
                </strong>
                <p>
                  {status.hasExpired 
                    ? 'Renueva ahora para evitar perder tus configuraciones premium.'
                    : 'Renueva para mantener todas tus configuraciones y beneficios.'}
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowRenewalModal(true)}
              >
                Renovar ahora
              </Button>
            </div>
          )}

          {/* Nota sobre modo demo */}
          {!mpConfigured && (
            <div className="subscriptionStatus__demo">
              🧪 Modo Demo: La renovación automática se simulará
            </div>
          )}
        </div>
      </Card>

      {/* Modal de renovación */}
      <RenewalWarningModal
        open={showRenewalModal}
        currentTier={status.tier}
        expiresAt={status.expiresAt}
        onRenew={handleRenew}
        onDismiss={handleDismissRenewal}
        loading={renewalLoading}
      />
    </>
  )
}
