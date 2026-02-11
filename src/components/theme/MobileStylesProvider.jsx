import { useEffect, useMemo } from 'react'

/**
 * MobileStylesProvider
 * 
 * Genera CSS dinámico para móvil basándose en:
 * 1. heroTheme: valores del tema guardados en tenant_themes
 * 2. mobileSettings: configuración de Vista Móvil guardada en tenants table
 * 
 * Props:
 * - heroTheme: { heroShowTitle, heroShowSubtitle, heroShowCta, heroCarouselButtonStyle }
 * - mobileSettings: { headerDesign, cardDesign, spacingOption, typographyOption, carouselOptions }
 * - tenantId: string
 */

export default function MobileStylesProvider({ heroTheme, mobileSettings, tenantId }) {
  const styleId = `mobile-styles-${tenantId || 'default'}`

  const cssContent = useMemo(() => {
    // Hero visibility from theme
    const showTitle = heroTheme?.heroShowTitle !== false
    const showSubtitle = heroTheme?.heroShowSubtitle !== false
    const showCta = heroTheme?.heroShowCta !== false

    // Mobile preview settings (from Vista Móvil editor)
    const headerDesign = mobileSettings?.headerDesign || 'centered'
    const cardDesign = mobileSettings?.cardDesign || 'stackedFull'
    const spacingOption = mobileSettings?.spacingOption || 'balanced'
    const typographyOption = mobileSettings?.typographyOption || 'standard'
    const carouselOpts = mobileSettings?.carouselOptions || {}

    // Override hero visibility with carousel options from mobile editor if set
    const mobileShowTitle = carouselOpts.showTitle !== undefined ? carouselOpts.showTitle : showTitle
    const mobileShowSubtitle = carouselOpts.showSubtitle !== undefined ? carouselOpts.showSubtitle : showSubtitle
    const mobileShowCta = carouselOpts.showCta !== undefined ? carouselOpts.showCta : showCta

    // Spacing values
    const spacingMap = {
      comfortable: { gap: '16px', padding: '20px', radius: '16px' },
      compact: { gap: '8px', padding: '12px', radius: '8px' },
      balanced: { gap: '12px', padding: '16px', radius: '12px' },
      airy: { gap: '24px', padding: '24px', radius: '20px' },
      minimal: { gap: '4px', padding: '8px', radius: '4px' },
      luxe: { gap: '20px', padding: '24px', radius: '24px' },
      dynamic: { gap: '12px', padding: '16px', radius: '16px' },
    }
    const spacing = spacingMap[spacingOption] || spacingMap.balanced

    // Typography values
    const typographyMap = {
      standard: { titleSize: '16px', priceSize: '18px', descSize: '14px', titleWeight: '600', fontFamily: 'inherit' },
      large: { titleSize: '18px', priceSize: '22px', descSize: '15px', titleWeight: '600', fontFamily: 'inherit' },
      bold: { titleSize: '16px', priceSize: '18px', descSize: '14px', titleWeight: '700', fontFamily: 'inherit' },
      elegant: { titleSize: '17px', priceSize: '20px', descSize: '14px', titleWeight: '600', fontFamily: 'Georgia, serif' },
      minimal: { titleSize: '15px', priceSize: '16px', descSize: '13px', titleWeight: '400', fontFamily: 'inherit' },
      impact: { titleSize: '22px', priceSize: '26px', descSize: '14px', titleWeight: '800', fontFamily: 'inherit' },
    }
    const typo = typographyMap[typographyOption] || typographyMap.standard

    // Card grid columns based on design
    const cardGridMap = {
      stackedFull: '1fr',
      gridCompact: 'repeat(2, 1fr)',
      listView: '1fr',
      imageFirst: '1fr',
      masonry: 'repeat(2, 1fr)',
      carousel: '1fr',
      magazine: '1fr',
      polaroid: 'repeat(2, 1fr)',
    }
    const gridCols = cardGridMap[cardDesign] || '1fr'

    // Card image ratio
    const cardImageMap = {
      stackedFull: '160px',
      gridCompact: '100px',
      listView: '1fr',
      imageFirst: '200px',
      masonry: 'auto',
      carousel: '160px',
      magazine: '180px',
      polaroid: '140px',
    }
    const imageRow = cardImageMap[cardDesign] || '160px'

    // Header height
    const headerHeightMap = {
      compact: '120px',
      centered: '160px',
      minimal: '100px',
      fullImage: '200px',
      parallax: '180px',
      glassmorphism: '160px',
      gradient: '180px',
      split: '140px',
    }
    const headerHeight = headerHeightMap[headerDesign] || '160px'

    return `
/* ============================================
   ESTILOS MÓVILES - MobileStylesProvider
   Sincronizado con Vista Móvil + tenant_themes
   TenantId: ${tenantId || 'default'}
   ============================================ */

@media (max-width: 768px) {
  /* ========== HERO/CAROUSEL VISIBILITY ========== */
  .store .storeHeader__heroTitle {
    ${mobileShowTitle ? `
      display: block !important;
      font-size: 1.5rem !important;
      margin-bottom: 8px !important;
    ` : 'display: none !important;'}
  }
  
  .store .storeHeader__heroSubtitle {
    ${mobileShowSubtitle ? `
      display: block !important;
      font-size: 0.95rem !important;
      margin-bottom: 12px !important;
    ` : 'display: none !important;'}
  }
  
  .store .storeHeader__heroCta {
    ${mobileShowCta ? `
      display: inline-flex !important;
      padding: 10px 20px !important;
      font-size: 0.85rem !important;
    ` : 'display: none !important;'}
  }

  /* ========== HERO LAYOUT MÓVIL ========== */
  .store .storeHeader__hero {
    min-height: ${headerHeight} !important;
  }
  
  .store .storeHeader__heroContent {
    padding: 40px 16px 24px !important;
    ${headerDesign === 'centered' || headerDesign === 'glassmorphism' ? 'text-align: center !important;' : ''}
    ${headerDesign === 'split' ? 'display: flex !important; align-items: center !important; gap: 16px !important;' : ''}
  }

  ${headerDesign === 'minimal' ? `
  .store .storeHeader__hero::after {
    display: none !important;
  }
  ` : ''}

  ${headerDesign === 'glassmorphism' ? `
  .store .storeHeader__heroContent {
    background: rgba(255, 255, 255, 0.15) !important;
    backdrop-filter: blur(12px) !important;
    border-radius: 16px !important;
    margin: 16px !important;
    padding: 24px !important;
  }
  ` : ''}
  
  /* ========== CAROUSEL BUTTONS ========== */
  .store .storeHeader__carouselBtn {
    width: 32px !important;
    height: 32px !important;
  }
  
  .store .storeHeader__carouselBtn svg {
    width: 16px !important;
    height: 16px !important;
  }
  
  .store .storeHeader__carouselBtn--prev {
    left: 8px !important;
  }
  
  .store .storeHeader__carouselBtn--next {
    right: 8px !important;
  }
  
  .store .storeHeader__carouselDots {
    bottom: 12px !important;
  }
  
  .store .storeHeader__carouselDot {
    width: 8px !important;
    height: 8px !important;
  }

  /* ========== NAVIGATION ========== */
  .store .storeHeader__nav {
    padding: 10px 12px !important;
  }
  
  .store .storeHeader__navLinks {
    display: none !important;
  }
  
  .store .storeHeader__brandLogo {
    width: 40px !important;
    height: 40px !important;
  }

  /* ========== SPACING (from Vista Móvil) ========== */
  .store .store__layout {
    padding: ${spacing.padding} !important;
    gap: ${spacing.gap} !important;
  }

  /* ========== PRODUCT GRID (from Vista Móvil) ========== */
  .store .store__grid {
    grid-template-columns: ${gridCols} !important;
    gap: ${spacing.gap} !important;
  }

  /* ========== PRODUCT CARDS (from Vista Móvil) ========== */
  .store .productCard {
    border-radius: ${spacing.radius} !important;
    ${cardDesign === 'listView' ? `
      grid-template-rows: 1fr !important;
      grid-template-columns: 100px 1fr !important;
    ` : `
      grid-template-rows: ${imageRow} 1fr !important;
    `}
  }

  ${cardDesign === 'polaroid' ? `
  .store .productCard {
    background: white !important;
    padding: 6px 6px 12px !important;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1) !important;
  }
  ` : ''}

  ${spacingOption === 'luxe' ? `
  .store .productCard {
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12) !important;
  }
  ` : ''}
  
  /* ========== TYPOGRAPHY (from Vista Móvil) ========== */
  .store .productCard__title {
    font-size: ${typo.titleSize} !important;
    font-weight: ${typo.titleWeight} !important;
    ${typo.fontFamily !== 'inherit' ? `font-family: ${typo.fontFamily} !important;` : ''}
  }
  
  .store .productCard__desc {
    font-size: ${typo.descSize} !important;
    -webkit-line-clamp: 2 !important;
  }
  
  .store .productCard__price {
    font-size: ${typo.priceSize} !important;
  }

  /* ========== CART PANEL ========== */
  .store .cartPanel {
    display: none !important;
  }
}

/* ========== TABLET (769px - 1024px) ========== */
@media (min-width: 769px) and (max-width: 1024px) {
  .store .store__grid {
    grid-template-columns: repeat(2, 1fr) !important;
  }
}
`
  }, [heroTheme, mobileSettings, tenantId])

  // Inyectar/actualizar estilos en el DOM
  useEffect(() => {
    let styleElement = document.getElementById(styleId)
    
    if (!styleElement) {
      styleElement = document.createElement('style')
      styleElement.id = styleId
      styleElement.setAttribute('data-tenant', tenantId || 'default')
      document.head.appendChild(styleElement)
    }

    styleElement.textContent = cssContent

    // Cleanup al desmontar
    return () => {
      const el = document.getElementById(styleId)
      if (el) {
        el.remove()
      }
    }
  }, [cssContent, styleId, tenantId])

  return null
}
