import { useState, useEffect } from 'react'
import './WelcomeModal.css'
import { X, ArrowRight, MapPin, Clock, Star, Sparkles, Zap, Heart, Coffee, Truck, Shield, Award, Gift, CheckCircle } from 'lucide-react'
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
}

// Features por defecto
const DEFAULT_FEATURES = [
  { id: '1', icon: 'clock', text: 'Pedidos rápidos' },
  { id: '2', icon: 'star', text: 'Calidad premium' },
  { id: '3', icon: 'mapPin', text: 'Delivery disponible' },
]

export default function WelcomeModal({ 
  isOpen, 
  onClose, 
  tenant,
  isPreviewMode = false,
  storeStatus = { isOpen: true, noSchedule: true },
  isPaused = false,
  pauseMessage = ''
}) {
  const [visible, setVisible] = useState(false)

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
  const logo = tenant?.logo || null
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
            Vista previa
          </div>
        )}
        
        <button className="welcomeModal__close" onClick={handleClose} aria-label="Cerrar">
          <X size={20} />
        </button>

        {/* Hero Section with Image, Logo and Store Name */}
        <div className="welcomeModal__hero">
          {/* Background Image */}
          <div className="welcomeModal__heroBg">
            {heroImage ? (
              <img src={heroImage} alt="" className="welcomeModal__heroImage" />
            ) : (
              <div className="welcomeModal__heroGradient" />
            )}
            <div className="welcomeModal__heroOverlay" />
          </div>

          {/* Logo and Store Info - Centered on the image */}
          <div className="welcomeModal__heroContent">
            {logo && (
              <div className="welcomeModal__logoWrapper">
                <img src={logo} alt={storeName} className="welcomeModal__logo" />
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

        {/* Content Section */}
        <div className="welcomeModal__body">
          <div className="welcomeModal__welcome">
            <h2 className="welcomeModal__title">{title}</h2>
            <p className="welcomeModal__message">{message}</p>
          </div>

          {/* Features/Highlights - Dynamic */}
          {renderFeatures()}

          {/* CTA Button */}
          <div className="welcomeModal__actions">
            <Button onClick={handleClose} className="welcomeModal__cta">
              Ver menú
              <ArrowRight size={18} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
