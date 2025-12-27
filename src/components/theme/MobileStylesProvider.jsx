import { useEffect, useMemo } from 'react'

/**
 * MobileStylesProvider - VERSIÓN SIMPLIFICADA
 * 
 * Genera CSS dinámico para móvil basándose ÚNICAMENTE en los valores
 * del heroTheme guardados en la base de datos (tenant_themes).
 * 
 * Props:
 * - heroTheme: { heroShowTitle, heroShowSubtitle, heroShowCta, heroCarouselButtonStyle }
 * - tenantId: string
 */

export default function MobileStylesProvider({ heroTheme, tenantId }) {
  const styleId = `mobile-styles-${tenantId || 'default'}`

  const cssContent = useMemo(() => {
    // Los valores vienen directamente del theme guardado en base de datos
    // Estos son los MISMOS valores que se usan en el preview y en desktop
    const showTitle = heroTheme?.heroShowTitle !== false
    const showSubtitle = heroTheme?.heroShowSubtitle !== false
    const showCta = heroTheme?.heroShowCta !== false

    return `
/* ============================================
   ESTILOS MÓVILES - MobileStylesProvider
   Sincronizado con valores de tenant_themes
   TenantId: ${tenantId || 'default'}
   ============================================ */

@media (max-width: 768px) {
  /* ========== HERO/CAROUSEL VISIBILITY ========== */
  /* Estos valores vienen del heroTheme guardado en base de datos */
  
  .store .storeHeader__heroTitle {
    ${showTitle ? `
      display: block !important;
      font-size: 1.5rem !important;
      margin-bottom: 8px !important;
    ` : 'display: none !important;'}
  }
  
  .store .storeHeader__heroSubtitle {
    ${showSubtitle ? `
      display: block !important;
      font-size: 0.95rem !important;
      margin-bottom: 12px !important;
    ` : 'display: none !important;'}
  }
  
  .store .storeHeader__heroCta {
    ${showCta ? `
      display: inline-flex !important;
      padding: 10px 20px !important;
      font-size: 0.85rem !important;
    ` : 'display: none !important;'}
  }

  /* ========== HERO LAYOUT MÓVIL ========== */
  .store .storeHeader__hero {
    min-height: 180px !important;
  }
  
  .store .storeHeader__heroContent {
    padding: 40px 16px 24px !important;
  }
  
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

  /* ========== PRODUCT GRID ========== */
  .store .store__layout {
    padding: 16px !important;
    gap: 16px !important;
  }
  
  .store .store__grid {
    grid-template-columns: 1fr !important;
    gap: 16px !important;
  }

  /* ========== PRODUCT CARDS ========== */
  .store .productCard {
    grid-template-rows: 160px 1fr !important;
  }
  
  .store .productCard__title {
    font-size: 1rem !important;
  }
  
  .store .productCard__desc {
    font-size: 0.85rem !important;
    -webkit-line-clamp: 2 !important;
  }
  
  .store .productCard__price {
    font-size: 1.1rem !important;
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
  }, [heroTheme, tenantId])

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
