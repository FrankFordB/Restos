/**
 * Componente de Checkout para Suscripciones Mercado Pago
 * Permite al usuario suscribirse a un plan con débito automático
 */

import { useState, useEffect } from 'react'
import './MPSubscriptionCheckout.css'
import Button from '../../ui/Button/Button'
import Card from '../../ui/Card/Card'
import { 
  createMPSubscription, 
  getActiveSubscription, 
  getSubscriptionStatus,
  formatSubscriptionStatus,
  formatNextBilling,
} from '../../../lib/mpSubscriptionsApi'
import { Crown, Star, Check, AlertTriangle, CreditCard, Calendar, Shield, Zap, Loader } from 'lucide-react'

// Configuración de planes
const PLANS = {
  premium: {
    id: 'premium',
    name: 'Premium',
    icon: <Star className="plan-icon premium" />,
    price: 9990,
    features: [
      '80 pedidos/día',
      'Personalización de tienda',
      'Widgets premium',
      'Soporte prioritario',
    ],
  },
  premium_pro: {
    id: 'premium_pro',
    name: 'Premium Pro',
    icon: <Crown className="plan-icon pro" />,
    price: 19990,
    features: [
      'Pedidos ilimitados',
      'Todas las personalizaciones',
      'Widgets exclusivos',
      'Soporte VIP 24/7',
      'Multi-sucursal (próximamente)',
    ],
  },
}

export default function MPSubscriptionCheckout({ 
  tenantId, 
  userEmail,
  onSubscriptionCreated,
}) {
  const [selectedPlan, setSelectedPlan] = useState('premium')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [subscriptionStatus, setSubscriptionStatus] = useState(null)
  const [loadingStatus, setLoadingStatus] = useState(true)

  // Cargar estado actual de suscripción
  useEffect(() => {
    loadSubscriptionStatus()
  }, [tenantId])

  const loadSubscriptionStatus = async () => {
    try {
      setLoadingStatus(true)
      const status = await getSubscriptionStatus(tenantId)
      setSubscriptionStatus(status)
    } catch (err) {
      console.error('Error loading subscription status:', err)
    } finally {
      setLoadingStatus(false)
    }
  }

  const handleSubscribe = async () => {
    if (!termsAccepted) {
      setError('Debes aceptar los términos y condiciones')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await createMPSubscription({
        tenantId,
        planTier: selectedPlan,
        payerEmail: userEmail,
        backUrl: `${window.location.origin}/dashboard?tab=plans&subscription=pending`,
      })

      console.log('Subscription created:', result)

      // Redirigir a Mercado Pago para autorizar
      if (result.initPoint) {
        // En producción usar initPoint, en sandbox usar sandboxInitPoint
        const mpUrl = import.meta.env.VITE_MP_SANDBOX === 'true' 
          ? result.sandboxInitPoint 
          : result.initPoint
        
        window.location.href = mpUrl
      } else {
        // Modo demo
        onSubscriptionCreated?.(result)
      }

    } catch (err) {
      console.error('Error creating subscription:', err)
      setError(err.message || 'Error al crear la suscripción')
    } finally {
      setLoading(false)
    }
  }

  const formatPrice = (cents) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(cents / 100)
  }

  // Si ya tiene suscripción activa, mostrar estado
  if (loadingStatus) {
    return (
      <div className="mpCheckout__loading">
        <Loader className="spin" size={32} />
        <p>Cargando información de suscripción...</p>
      </div>
    )
  }

  if (subscriptionStatus?.status === 'active') {
    const { tier, nextBilling, subscription } = subscriptionStatus
    const plan = PLANS[tier] || PLANS.premium
    const statusInfo = formatSubscriptionStatus('active')

    return (
      <Card className="mpCheckout__active">
        <div className="mpCheckout__activeHeader">
          {plan.icon}
          <div>
            <h3>Plan {plan.name}</h3>
            <span className={`mpCheckout__status mpCheckout__status--${statusInfo.color}`}>
              {statusInfo.icon} {statusInfo.label}
            </span>
          </div>
        </div>

        <div className="mpCheckout__activeInfo">
          <div className="mpCheckout__infoRow">
            <Calendar size={18} />
            <span>Próximo cobro: <strong>{formatNextBilling(nextBilling)}</strong></span>
          </div>
          <div className="mpCheckout__infoRow">
            <CreditCard size={18} />
            <span>Monto: <strong>{formatPrice(plan.price)}/mes</strong></span>
          </div>
        </div>

        <p className="mpCheckout__note">
          Tu suscripción se renueva automáticamente. Puedes cancelar en cualquier momento.
        </p>

        {tier === 'premium' && (
          <Button 
            variant="secondary" 
            onClick={() => setSelectedPlan('premium_pro')}
            className="mpCheckout__upgradeBtn"
          >
            <Zap size={16} /> Mejorar a Pro
          </Button>
        )}
      </Card>
    )
  }

  if (subscriptionStatus?.status === 'pending') {
    return (
      <Card className="mpCheckout__pending">
        <AlertTriangle size={48} className="text-warning" />
        <h3>Autorización pendiente</h3>
        <p>
          Tienes una suscripción pendiente de autorización. 
          Revisa tu email o tu cuenta de Mercado Pago para completar el proceso.
        </p>
        <Button variant="primary" onClick={loadSubscriptionStatus}>
          Verificar estado
        </Button>
      </Card>
    )
  }

  return (
    <div className="mpCheckout">
      <div className="mpCheckout__header">
        <h2>Elige tu plan</h2>
        <p>Suscripción mensual con débito automático</p>
      </div>

      {/* Selector de planes */}
      <div className="mpCheckout__plans">
        {Object.values(PLANS).map((plan) => (
          <div
            key={plan.id}
            className={`mpCheckout__plan ${selectedPlan === plan.id ? 'mpCheckout__plan--selected' : ''}`}
            onClick={() => setSelectedPlan(plan.id)}
          >
            <div className="mpCheckout__planHeader">
              {plan.icon}
              <h3>{plan.name}</h3>
              {plan.id === 'premium_pro' && <span className="mpCheckout__badge">Popular</span>}
            </div>

            <div className="mpCheckout__planPrice">
              <span className="mpCheckout__price">{formatPrice(plan.price)}</span>
              <span className="mpCheckout__period">/mes</span>
            </div>

            <ul className="mpCheckout__features">
              {plan.features.map((feature, idx) => (
                <li key={idx}>
                  <Check size={16} className="text-success" />
                  {feature}
                </li>
              ))}
            </ul>

            <div className="mpCheckout__planSelect">
              {selectedPlan === plan.id ? (
                <span className="mpCheckout__selected">✓ Seleccionado</span>
              ) : (
                <span>Seleccionar</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Info de pago */}
      <div className="mpCheckout__paymentInfo">
        <Shield size={20} />
        <div>
          <strong>Pago seguro con Mercado Pago</strong>
          <p>
            Tu tarjeta se guardará para cobros automáticos mensuales. 
            Puedes cancelar en cualquier momento sin penalidades.
          </p>
        </div>
      </div>

      {/* Términos */}
      <label className="mpCheckout__terms">
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={(e) => setTermsAccepted(e.target.checked)}
        />
        <span>
          Acepto los <a href="/legal/terms" target="_blank">términos y condiciones</a> y 
          autorizo el débito automático mensual de {formatPrice(PLANS[selectedPlan].price)}
        </span>
      </label>

      {/* Error */}
      {error && (
        <div className="mpCheckout__error">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      {/* Botón de suscripción */}
      <Button
        variant="primary"
        size="large"
        onClick={handleSubscribe}
        disabled={loading || !termsAccepted}
        className="mpCheckout__submitBtn"
      >
        {loading ? (
          <>
            <Loader className="spin" size={18} />
            Procesando...
          </>
        ) : (
          <>
            <CreditCard size={18} />
            Suscribirme por {formatPrice(PLANS[selectedPlan].price)}/mes
          </>
        )}
      </Button>

      <p className="mpCheckout__footer">
        Al hacer clic serás redirigido a Mercado Pago para autorizar el débito automático.
      </p>
    </div>
  )
}
