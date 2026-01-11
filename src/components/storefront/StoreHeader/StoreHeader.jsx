import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import './StoreHeader.css'
import { STORE_HERO_STYLES } from '../../../shared/subscriptions'
import { checkIsStoreOpen } from '../../../shared/openingHours'
import { ChevronLeft, ChevronRight, ShoppingCart, CircleDot } from 'lucide-react'
import OrdersRemainingBadge from '../OrdersRemainingBadge/OrdersRemainingBadge'

export default function StoreHeader({
  tenant,
  theme,
  heroStyle = 'simple',
  slides = [],
  titlePosition = 'center',
  overlayOpacity = 50,
  showTitle = true,
  showSubtitle = true,
  showCta = true,
  carouselButtonStyle = 'arrows_classic',
  cart = {},
  onOpenCart,
  openingHours = [],
  // Order limits props
  orderLimitsStatus = null,
}) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [storeStatus, setStoreStatus] = useState({ isOpen: true, noSchedule: true })

  const heroConfig = STORE_HERO_STYLES[heroStyle] || STORE_HERO_STYLES.simple
  const hasCarousel = heroConfig.hasCarousel && slides.length > 1

  // Check store open status
  useEffect(() => {
    const checkStatus = () => {
      const status = checkIsStoreOpen(openingHours)
      setStoreStatus(status)
    }
    checkStatus()
    // Re-check every minute
    const interval = setInterval(checkStatus, 60000)
    return () => clearInterval(interval)
  }, [openingHours])

  // Auto-advance carousel
  useEffect(() => {
    if (!hasCarousel) return
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [hasCarousel, slides.length])

  const goToSlide = (index) => {
    setCurrentSlide(index)
  }

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % slides.length)
  }, [slides.length])

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)
  }, [slides.length])

  // Calculate cart count
  const cartCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0)

  // Default slide if none provided
  const displaySlides = slides.length > 0 ? slides : [{
    title: tenant?.name || 'Bienvenido',
    subtitle: 'Explora nuestros productos',
    imageUrl: null,
    ctaText: 'Ver menú',
    ctaLink: '#productos',
  }]

  const currentSlideData = displaySlides[currentSlide] || displaySlides[0]

  // Get alignment class based on title position
  const alignmentClass = `storeHeader__heroContent--${titlePosition}`

  return (
    <header className={`storeHeader storeHeader--${heroConfig.layout} storeHeader--${heroConfig.animation || 'none'}`}>
      {/* Navigation Bar */}
      <nav className="storeHeader__nav">
        <div className="storeHeader__brand">
          {tenant?.logo && (
            <img src={tenant.logo} alt={tenant.name} className="storeHeader__brandLogo" />
          )}
          <div className="storeHeader__brandText">
            <Link to="/" className="storeHeader__logo">
              {tenant?.name || 'Tienda'}
            </Link>
            {tenant?.slogan && (
              <span className="storeHeader__slogan">{tenant.slogan}</span>
            )}
          </div>
        </div>
        
        <div className="storeHeader__navLinks">
          <a href="#productos" className="storeHeader__navLink">Productos</a>
          <a href="#nosotros" className="storeHeader__navLink">Nosotros</a>
          <a href="#contacto" className="storeHeader__navLink">Contacto</a>
        </div>

        <div className="storeHeader__actions">
          {/* Orders Remaining Badge */}
          {orderLimitsStatus && !orderLimitsStatus.isUnlimited && (
            <OrdersRemainingBadge
              remaining={orderLimitsStatus.remaining}
              limit={orderLimitsStatus.limit}
              tier={orderLimitsStatus.tier}
              isUnlimited={orderLimitsStatus.isUnlimited}
              size="small"
            />
          )}
          
          {/* Open/Closed Badge */}
          {!storeStatus.noSchedule && (
            <span className={`storeHeader__statusBadge ${storeStatus.isOpen ? 'storeHeader__statusBadge--open' : 'storeHeader__statusBadge--closed'}`}>
              <CircleDot size={12} /> {storeStatus.isOpen ? 'Abierto' : 'Cerrado'}
            </span>
          )}
          {cartCount > 0 && (
            <button className="storeHeader__cartBtn" onClick={onOpenCart}>
              <ShoppingCart size={18} /> <span className="storeHeader__cartCount">{cartCount}</span>
            </button>
          )}
        </div>
      </nav>

      {/* Hero Content */}
      <div className="storeHeader__hero">
        {/* Background/Image - key forces re-mount for animation on slide change */}
        {currentSlideData.imageUrl && currentSlideData.focalPoint?.zoom && currentSlideData.focalPoint.zoom < 1 && (
          <div 
            className="storeHeader__heroLiquid"
            style={{
              backgroundImage: `url(${currentSlideData.imageUrl})`,
            }}
          />
        )}
        <div 
          key={`slide-bg-${currentSlide}`}
          className="storeHeader__heroBg"
          style={{
            backgroundImage: currentSlideData.imageUrl 
              ? `url(${currentSlideData.imageUrl})` 
              : `linear-gradient(135deg, ${theme?.primary || '#1a1a2e'} 0%, ${theme?.accent || '#f97316'} 100%)`,
            backgroundPosition: currentSlideData.focalPoint 
              ? `${currentSlideData.focalPoint.x}% ${currentSlideData.focalPoint.y}%` 
              : 'center',
            backgroundSize: currentSlideData.focalPoint?.zoom 
              ? `${currentSlideData.focalPoint.zoom * 100}%` 
              : 'cover',
            '--mobile-focus-x': `${currentSlideData.mobileFocalPoint?.x ?? 50}%`,
            '--mobile-focus-y': `${currentSlideData.mobileFocalPoint?.y ?? 50}%`,
            '--mobile-focus-zoom': (() => {
              const zoom = currentSlideData.mobileFocalPoint?.zoom ?? 100;
              if (zoom <= 100) return 'cover';
              return `${zoom}%`;
            })(),
          }}
        />
        
        {/* Overlay */}
        <div 
          className="storeHeader__heroOverlay" 
          style={{ opacity: overlayOpacity / 100 }}
        />

        {/* Content - key forces re-mount for animation on slide change */}
        <div 
          key={`slide-content-${currentSlide}`}
          className={`storeHeader__heroContent ${alignmentClass}`}
        >
          {showTitle && <h1 className="storeHeader__heroTitle">{currentSlideData.title}</h1>}
          {showSubtitle && <p className="storeHeader__heroSubtitle">{currentSlideData.subtitle}</p>}
          {showCta && currentSlideData.ctaText && (
            <a href={currentSlideData.ctaLink || '#productos'} className="storeHeader__heroCta">
              {currentSlideData.ctaText}
            </a>
          )}
        </div>

        {/* Carousel Controls */}
        {hasCarousel && displaySlides.length > 1 && (
          <>
            <button className={`storeHeader__carouselBtn storeHeader__carouselBtn--prev storeHeader__carouselBtn--${carouselButtonStyle}`} onClick={prevSlide}>
              <ChevronLeft size={28} strokeWidth={2.5} />
            </button>
            <button className={`storeHeader__carouselBtn storeHeader__carouselBtn--next storeHeader__carouselBtn--${carouselButtonStyle}`} onClick={nextSlide}>
              <ChevronRight size={28} strokeWidth={2.5} />
            </button>
            <div className="storeHeader__carouselDots">
              {displaySlides.map((_, index) => (
                <button
                  key={index}
                  className={`storeHeader__carouselDot ${index === currentSlide ? 'storeHeader__carouselDot--active' : ''}`}
                  onClick={() => goToSlide(index)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </header>
  )
}
