import { useState, useEffect } from 'react'
import './WelcomeModal.css'
import { X, ArrowRight, MapPin, Clock, Star, Sparkles, Zap, Heart, Coffee, Truck, Shield, Award, Gift, CheckCircle, Store, Utensils, ShoppingBag, ChefHat, AlertCircle, Pizza, UtensilsCrossed, Salad } from 'lucide-react'
import Button from '../../ui/Button/Button'

// Iconos disponibles para features
const AVAILABLE_ICONS = {
  clock: Clock,
  star: Star,
  mapPin: MapPin,
  sparkles: Sparkles,
  zap: Zap,
  heart: Heart,
  coffee: Coffee,
  truck: Truck,
  shield: Shield,
  award: Award,
  gift: Gift,
  checkCircle: CheckCircle,
  store: Store,
  utensils: Utensils,
  shoppingBag: ShoppingBag,
  chefHat: ChefHat,
}

// Features por defecto
const DEFAULT_FEATURES = [
  { id: '1', icon: 'clock', text: 'Pedidos rápidos' },
  { id: '2', icon: 'star', text: 'Calidad premium' },
  { id: '3', icon: 'mapPin', text: 'Delivery disponible' },
]

// Decoraciones flotantes con iconos de comida
const FLOATING_ITEMS = [
  { icon: Pizza, key: 'pizza' },
  { icon: UtensilsCrossed, key: 'burger' },
  { icon: ChefHat, key: 'chef' },
  { icon: Salad, key: 'salad' },
  { icon: Utensils, key: 'taco' },
  { icon: Coffee, key: 'coffee' }
]

export default function WelcomeModal({ 
  isOpen, 
  onClose, 
  tenant,
  isPreviewMode = false,
  storeStatus = { isOpen: true, noSchedule: true },
  isPaused = false,
  pauseMessage = '',
  // Order limits props
  orderLimitsStatus = null
}) {
  const [visible, setVisible] = useState(false)

  // Check if order limit is reached (0 remaining)
  const isOrderLimitReached = orderLimitsStatus && 
    !orderLimitsStatus.isUnlimited && 
    orderLimitsStatus.remaining === 0

  // Calcular el estado de la tienda
  const getStoreStatusInfo = () => {
    if (isPaused) {
      return {
        status: 'paused',
        label: 'Pausado',
        className: 'welcomeModal__statusBadge--paused'
      }
    }
    if (!storeStatus.noSchedule && !storeStatus.isOpen) {
      return {
        status: 'closed',
        label: 'Cerrado',
        className: 'welcomeModal__statusBadge--closed'
      }
    }
    return {
      status: 'open',
      label: 'Abierto',
      className: 'welcomeModal__statusBadge--open'
    }
  }

  const statusInfo = getStoreStatusInfo()

  useEffect(() => {
    if (isOpen) {
      // Small delay for animation
      const timer = setTimeout(() => setVisible(true), 50)
      return () => clearTimeout(timer)
    } else {
      setVisible(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  // Get content - use custom or generate defaults
  const storeName = tenant?.name || 'Nuestra Tienda'
  const title = tenant?.welcome_modal_title || `¡Bienvenido!`
  const message = tenant?.welcome_modal_message || 
    tenant?.description || 
    'Explora nuestro menú y realiza tu pedido de forma rápida y sencilla.'
  const heroImage = tenant?.welcome_modal_image || tenant?.hero_image || null
  const heroImageFocalPoint = tenant?.welcome_modal_image_focal_point || null
  const logo = tenant?.logo || null
  const logoFocalPoint = tenant?.logo_focal_point || null
  const slogan = tenant?.slogan || null
  
  // Features dinámicos
  const features = tenant?.welcome_modal_features || DEFAULT_FEATURES
  const featuresDesign = tenant?.welcome_modal_features_design || 'pills'

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 200)
  }

  // Renderizar features dinámicamente
  const renderFeatures = () => {
    if (!features || features.length === 0) return null

    return (
      <div className={`welcomeModal__features welcomeModal__features--${featuresDesign}`}>
        {features.map((feature) => {
          const IconComponent = AVAILABLE_ICONS[feature.icon] || Star
          return (
            <div key={feature.id} className="welcomeModal__feature">
              <div className="welcomeModal__featureIcon">
                <IconComponent size={18} />
              </div>
              <span>{feature.text}</span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className={`welcomeModal__overlay ${visible ? 'welcomeModal__overlay--visible' : ''}`}>
      <div className={`welcomeModal ${visible ? 'welcomeModal--visible' : ''}`}>
        {isPreviewMode && (
          <div className="welcomeModal__previewBadge">
            <Sparkles size={12} />
            Vista previa
          </div>
        )}
        
        <button className="welcomeModal__close" onClick={handleClose} aria-label="Cerrar">
          <X size={20} />
        </button>

        {/* Hero Section - Modern Split Design */}
        <div className="welcomeModal__hero">
          {/* Background with Gradient or Image */}
          <div className="welcomeModal__heroBg">
            {heroImage ? (
              <img 
                src={heroImage} 
                alt="" 
                className="welcomeModal__heroImage"
                style={heroImageFocalPoint ? {
                  objectPosition: `${heroImageFocalPoint.x}% ${heroImageFocalPoint.y}%`
                } : undefined}
              />
            ) : (
              <div className="welcomeModal__heroGradient" />
            )}
            <div className="welcomeModal__heroOverlay" />
            
            {/* Grid Pattern Overlay */}
            <div className="welcomeModal__heroPattern" />
          </div>

          {/* Floating Food Decorations */}
          <div className="welcomeModal__floatingElements">
            {FLOATING_ITEMS.map((item, i) => {
              const IconComponent = item.icon
              return (
                <div 
                  key={item.key} 
                  className={`welcomeModal__floatingItem welcomeModal__floatingItem--${i + 1}`}
                >
                  <IconComponent size={24} />
                </div>
              )
            })}
          </div>

          {/* Logo and Store Info */}
          <div className="welcomeModal__heroContent">
            {logo ? (
              <div className="welcomeModal__logoWrapper">
                <img 
                  src={logo} 
                  alt={storeName} 
                  className="welcomeModal__logo"
                  style={logoFocalPoint ? {
                    objectFit: 'cover',
                    objectPosition: `${logoFocalPoint.x}% ${logoFocalPoint.y}%`
                  } : undefined}
                />
              </div>
            ) : (
              <div className="welcomeModal__logoPlaceholder">
                <Store size={40} />
              </div>
            )}
            
            <h1 className="welcomeModal__storeName">{storeName}</h1>
            
            {slogan && (
              <p className="welcomeModal__slogan">{slogan}</p>
            )}
            
            {/* Badge de estado de la tienda */}
            <div className={`welcomeModal__statusBadge ${statusInfo.className}`}>
              <span className="welcomeModal__statusDot"></span>
              {statusInfo.label}
            </div>
          </div>
        </div>

        {/* Content Section - Modern Card Style */}
        <div className="welcomeModal__body">
          {/* Order Limit Warning - Only when remaining = 0 */}
          {isOrderLimitReached && (
            <div className="welcomeModal__orderLimitWarning">
              <div className="welcomeModal__orderLimitIcon">
                <AlertCircle size={24} />
              </div>
              <div className="welcomeModal__orderLimitContent">
                <h3 className="welcomeModal__orderLimitTitle">
                  Límite de pedidos alcanzado
                </h3>
                <p className="welcomeModal__orderLimitText">
                  Lo sentimos, esta tienda ha alcanzado el límite de pedidos de hoy.
                </p>
                <p className="welcomeModal__orderLimitApology">
                  ¡Disculpa las molestias! Te invitamos a volver mañana para realizar tu pedido.
                </p>
              </div>
            </div>
          )}

          {/* Welcome section - Only when orders are available */}
          {!isOrderLimitReached && (
            <div className="welcomeModal__welcome">
              <div className="welcomeModal__titleWrapper">
                <Sparkles className="welcomeModal__titleIcon" size={20} />
                <h2 className="welcomeModal__title">{title}</h2>
              </div>
              <p className="welcomeModal__message">{message}</p>
            </div>
          )}

          {/* Features/Highlights - Dynamic */}
          {renderFeatures()}

          {/* CTA Button - Modern Gradient */}
          <div className="welcomeModal__actions">
            <button onClick={handleClose} className={isOrderLimitReached ? "welcomeModal__understoodBtn" : "welcomeModal__ctaBtn"}>
              <span>{isOrderLimitReached ? 'Entendido' : 'Explorar menú'}</span>
              {!isOrderLimitReached && <ArrowRight size={18} />}
            </button>
          </div>

          {/* Footer Note */}
          <p className="welcomeModal__footerNote">
            <ShoppingBag size={14} />
            {isOrderLimitReached ? '¡Vuelve mañana para hacer tu pedido!' : 'Haz tu pedido en minutos'}
          </p>
        </div>
      </div>
    </div>
  )
}
