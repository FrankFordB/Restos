import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import './StoreHeader.css'
import { STORE_HERO_STYLES } from '../../../shared/subscriptions'

export default function StoreHeader({
  tenant,
  theme,
  heroStyle = 'simple',
  slides = [],
  titlePosition = 'center',
  overlayOpacity = 50,
  cart = {},
  onOpenCart,
}) {
  const [currentSlide, setCurrentSlide] = useState(0)

  const heroConfig = STORE_HERO_STYLES[heroStyle] || STORE_HERO_STYLES.simple
  const hasCarousel = heroConfig.hasCarousel && slides.length > 1

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
        <Link to="/" className="storeHeader__logo">
          {tenant?.name || 'Tienda'}
        </Link>
        
        <div className="storeHeader__navLinks">
          <a href="#productos" className="storeHeader__navLink">Productos</a>
          <a href="#nosotros" className="storeHeader__navLink">Nosotros</a>
          <a href="#contacto" className="storeHeader__navLink">Contacto</a>
        </div>

        <div className="storeHeader__actions">
          {cartCount > 0 && (
            <button className="storeHeader__cartBtn" onClick={onOpenCart}>
              🛒 <span className="storeHeader__cartCount">{cartCount}</span>
            </button>
          )}
        </div>
      </nav>

      {/* Hero Content */}
      <div className="storeHeader__hero">
        {/* Background/Image - key forces re-mount for animation on slide change */}
        <div 
          key={`slide-bg-${currentSlide}`}
          className="storeHeader__heroBg"
          style={{
            backgroundImage: currentSlideData.imageUrl 
              ? `url(${currentSlideData.imageUrl})` 
              : `linear-gradient(135deg, ${theme?.primary || '#1a1a2e'} 0%, ${theme?.accent || '#f97316'} 100%)`,
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
          <h1 className="storeHeader__heroTitle">{currentSlideData.title}</h1>
          <p className="storeHeader__heroSubtitle">{currentSlideData.subtitle}</p>
          {currentSlideData.ctaText && (
            <a href={currentSlideData.ctaLink || '#productos'} className="storeHeader__heroCta">
              {currentSlideData.ctaText}
            </a>
          )}
        </div>

        {/* Carousel Controls */}
        {hasCarousel && displaySlides.length > 1 && (
          <>
            <button className="storeHeader__carouselBtn storeHeader__carouselBtn--prev" onClick={prevSlide}>
              ‹
            </button>
            <button className="storeHeader__carouselBtn storeHeader__carouselBtn--next" onClick={nextSlide}>
              ›
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
