import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './PremiumModal.css'
import Button from '../Button/Button'
import { SUBSCRIPTION_TIERS, TIER_LABELS, TIER_COLORS, TIER_PRICES } from '../../../shared/subscriptions'
import {
  Star,
  Crown,
  Image,
  MapPin,
  FolderOpen,
  LayoutGrid,
  Sparkles,
  MessageSquare,
  Youtube,
  Mail,
  HelpCircle,
  UsersRound,
  BarChart2,
  Layout,
  Target,
  Building2,
  FileText,
  Shield,
  Palette,
  X,
} from 'lucide-react'
import {
  createSubscriptionPreference,
  isPlatformMPConfigured,
  formatAmount,
} from '../../../lib/mercadopago'
import {
  createPlatformSubscription,
  updateTenantSubscriptionTier,
} from '../../../lib/supabaseMercadopagoApi'
import {
  createPendingSubscription,
  activateSubscription as activateSubscriptionApi,
  logAuditEvent,
  AUDIT_ACTIONS,
} from '../../../lib/supabaseSubscriptionApi'

const PLAN_FEATURES = {
  [SUBSCRIPTION_TIERS.PREMIUM]: {
    price: '$9.99/mes',
    yearlyPrice: '$99/año',
    savings: 'Ahorra 17%',
    icon: <Star size={28} />,
    color: TIER_COLORS[SUBSCRIPTION_TIERS.PREMIUM],
    features: [
      { text: 'Carrusel de productos', icon: <Image size={16} /> },
      { text: 'Galería de imágenes interactiva', icon: <Image size={16} /> },
      { text: 'Banner promocional', icon: <Palette size={16} /> },
      { text: 'Mapa de ubicación', icon: <MapPin size={16} /> },
      { text: 'Categorías de productos', icon: <FolderOpen size={16} /> },
      { text: '3 layouts de cards extra', icon: <LayoutGrid size={16} /> },
      { text: 'Estilos Contorno y Elevado', icon: <Sparkles size={16} /> },
      { text: 'Soporte prioritario', icon: <MessageSquare size={16} /> },
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
    icon: <Crown size={28} />,
    color: TIER_COLORS[SUBSCRIPTION_TIERS.PREMIUM_PRO],
    features: [
      { text: 'Todo lo de Premium', icon: <Star size={16} />, highlight: true },
      { text: 'Testimonios de clientes', icon: <MessageSquare size={16} /> },
      { text: 'Video embebido (YouTube)', icon: <Youtube size={16} /> },
      { text: 'Formulario de newsletter', icon: <Mail size={16} /> },
      { text: 'Preguntas frecuentes', icon: <HelpCircle size={16} /> },
      { text: 'Página de equipo', icon: <UsersRound size={16} /> },
      { text: 'Estadísticas animadas', icon: <BarChart2 size={16} /> },
      { text: '4 layouts exclusivos', icon: <Layout size={16} /> },
      { text: 'Estilo Minimalista', icon: <Target size={16} /> },
      { text: 'Page Builder completo', icon: <Building2 size={16} /> },
      { text: 'Plantillas premium', icon: <FileText size={16} /> },
      { text: 'Soporte VIP 24/7', icon: <Shield size={16} /> },
    ],
    notIncluded: [],
  },
}

export default function PremiumModal({ 
  open, 
  onClose, 
  currentTier = SUBSCRIPTION_TIERS.FREE,
  tenantId,
  tenantName,
  userEmail,
  premiumUntil,
}) {
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [billingCycle, setBillingCycle] = useState('monthly')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  // Formatear fecha de expiración
  const formatExpirationDate = (dateString) => {
    if (!dateString) return null
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return null
      return date.toLocaleDateString('es-AR', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      })
    } catch {
      return null
    }
  }

  const expirationDate = formatExpirationDate(premiumUntil)
  const daysUntilExpiration = premiumUntil ? Math.ceil((new Date(premiumUntil) - new Date()) / (1000 * 60 * 60 * 24)) : null

  if (!open) return null

  const handleSelectPlan = (tier) => {
    setSelectedPlan(tier)
    setError(null)
  }

  const handleProceedToPayment = async () => {
    if (!selectedPlan || !tenantId) return

    const mpConfigured = isPlatformMPConfigured()
    const prices = TIER_PRICES[selectedPlan]
    const amount = billingCycle === 'yearly' ? prices.yearly : prices.monthly

    // Generar clave de idempotencia única
    const idempotencyKey = `${tenantId}_${selectedPlan}_${billingCycle}_${Date.now()}`

    if (!mpConfigured) {
      // Modo demo: simular pago y actualizar tier
      setLoading(true)
      
      try {
        // Simular delay
        await new Promise(resolve => setTimeout(resolve, 1500))

        // Calcular fecha de expiración
        const expiresAt = new Date()
        if (billingCycle === 'yearly') {
          expiresAt.setFullYear(expiresAt.getFullYear() + 1)
        } else {
          expiresAt.setMonth(expiresAt.getMonth() + 1)
        }

        // Crear suscripción pendiente
        const pendingSubscription = await createPendingSubscription({
          tenantId,
          planTier: selectedPlan,
          billingPeriod: billingCycle,
          amount,
          idempotencyKey,
        })

        // En modo demo, activar inmediatamente
        if (pendingSubscription) {
          await activateSubscriptionApi(pendingSubscription.id, `demo_${Date.now()}`)
        }

        // También actualizar tier en tenants para compatibilidad
        await updateTenantSubscriptionTier(tenantId, selectedPlan, expiresAt)

        // Log del evento
        await logAuditEvent({
          tenantId,
          action: AUDIT_ACTIONS.PAYMENT_RECEIVED,
          actorType: 'system',
          details: {
            mode: 'demo',
            plan: selectedPlan,
            billing_period: billingCycle,
            amount,
          },
        })

        // Recargar página para reflejar cambios
        onClose()
        window.location.reload()
      } catch (err) {
        setError(err.message || 'Error al procesar la suscripción')
      } finally {
        setLoading(false)
      }
      return
    }

    // Con MercadoPago configurado: crear preferencia y redirigir
    try {
      setLoading(true)
      setError(null)

      // 1. Crear suscripción pendiente primero (para tener el ID)
      const pendingSubscription = await createPendingSubscription({
        tenantId,
        planTier: selectedPlan,
        billingPeriod: billingCycle,
        amount,
        idempotencyKey,
      })

      // 2. Crear preferencia de pago con referencia a la suscripción
      const preference = await createSubscriptionPreference({
        tenantId,
        tenantName: tenantName || 'Mi Tienda',
        planTier: selectedPlan,
        billingPeriod: billingCycle,
        amount,
        payerEmail: userEmail,
        subscriptionId: pendingSubscription?.id, // Para correlación con webhook
      })

      // Guardar también en platform_subscriptions para compatibilidad
      await createPlatformSubscription({
        tenantId,
        preferenceId: preference.preferenceId,
        planTier: selectedPlan,
        billingPeriod: billingCycle,
        amount,
      })

      // Redirigir a MercadoPago
      window.location.href = preference.initPoint

    } catch (err) {
      console.error('Error creando pago:', err)
      setError(err.message || 'Error al procesar el pago')
    } finally {
      setLoading(false)
    }
  }

  const isPremium = currentTier === SUBSCRIPTION_TIERS.PREMIUM
  const isPremiumPro = currentTier === SUBSCRIPTION_TIERS.PREMIUM_PRO
  const hasActivePlan = isPremium || isPremiumPro

  return (
    <div className="premiumModal__overlay">
      <div className="premiumModal">
        <button className="premiumModal__close" onClick={onClose}><XIcon size={20} /></button>
        
        {/* Current Plan Summary - Solo si tiene un plan activo */}
        {hasActivePlan && (
          <div className="premiumModal__currentPlan" style={{ '--plan-color': TIER_COLORS[currentTier] }}>
            <div className="premiumModal__currentPlanHeader">
              <span className="premiumModal__currentPlanIcon">
                {currentTier === SUBSCRIPTION_TIERS.PREMIUM_PRO ? <Crown size={24} /> : <Star size={24} />}
              </span>
              <div className="premiumModal__currentPlanInfo">
                <h3 className="premiumModal__currentPlanTitle">Tu Plan: {TIER_LABELS[currentTier]}</h3>
                {expirationDate && (
                  <p className="premiumModal__currentPlanExpiry">
                    {daysUntilExpiration > 0 ? (
                      <>
                        <span className="expiry-icon"><Star size={14} /></span>
                        Válido hasta el <strong>{expirationDate}</strong>
                        {daysUntilExpiration <= 7 && (
                          <span className="expiry-warning"> <AlertTriangle size={14} /> ({daysUntilExpiration} días restantes)</span>
                        )}
                      </>
                    ) : (
                      <span className="expiry-expired"><AlertTriangle size={14} /> Plan expirado</span>
                    )}
                  </p>
                )}
              </div>
            </div>
            {isPremium && (
              <p className="premiumModal__upgradeHint">
                <Lightbulb size={16} /> ¿Quieres más funciones? Actualiza a <strong>Premium Pro</strong> abajo.
              </p>
            )}
          </div>
        )}

        <div className="premiumModal__header">
          <h2 className="premiumModal__title">
            <span className="premiumModal__crown"><Crown size={28} /></span>
            {hasActivePlan ? 'Gestiona tu suscripción' : 'Desbloquea todo el potencial'}
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
                  <span key={i} className="notIncluded-item"><XIcon size={12} /> {f}</span>
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
            <div className="premiumModal__popularBadge"><Flame size={14} /> Más popular</div>
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
            {error && (
              <div style={{
                padding: '0.75rem 1rem',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#dc2626',
                fontSize: '0.9rem',
                marginBottom: '1rem',
                textAlign: 'center',
              }}>
                <AlertTriangle size={16} style={{ marginRight: 4 }} /> {error}
              </div>
            )}
            <Button 
              size="lg" 
              onClick={handleProceedToPayment}
              className="premiumModal__ctaBtn"
              disabled={loading}
            >
              {loading ? (
                'Procesando...'
              ) : (
                <>Continuar con {TIER_LABELS[selectedPlan]} - {billingCycle === 'monthly' 
                  ? PLAN_FEATURES[selectedPlan].price 
                  : PLAN_FEATURES[selectedPlan].yearlyPrice}</>
              )}
            </Button>
            <p className="premiumModal__ctaNote">
              {isPlatformMPConfigured() 
                ? 'Pago seguro con MercadoPago · Cancela cuando quieras'
                : 'Modo Demo: Suscripción simulada'
              }
            </p>
          </div>
        )}

        {/* Comparison Link */}
        <div className="premiumModal__footer">
          <span className="premiumModal__guarantee">
            <Shield size={16} style={{ marginRight: 4 }} /> Garantía de devolución de 30 días
          </span>
        </div>
      </div>
    </div>
  )
}
