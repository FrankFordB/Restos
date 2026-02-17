// Niveles de suscripción
export const SUBSCRIPTION_TIERS = {
  FREE: 'free',
  PREMIUM: 'premium',
  PREMIUM_PRO: 'premium_pro',
}

// Límites de pedidos por plan POR DÍA (null = ilimitado)
// Los pedidos se reinician cada día a las 00:00
export const ORDER_LIMITS = {
  [SUBSCRIPTION_TIERS.FREE]: 15,        // 15 pedidos/día
  [SUBSCRIPTION_TIERS.PREMIUM]: 80,     // 80 pedidos/día
  [SUBSCRIPTION_TIERS.PREMIUM_PRO]: null, // ilimitado
}

// Helper para obtener el límite de pedidos según el plan
export function getOrderLimit(tier) {
  return ORDER_LIMITS[tier] ?? 15
}

// Helper para verificar si el plan tiene pedidos ilimitados
export function hasUnlimitedOrders(tier) {
  return ORDER_LIMITS[tier] === null
}

export const TIER_LABELS = {
  [SUBSCRIPTION_TIERS.FREE]: 'Gratis',
  [SUBSCRIPTION_TIERS.PREMIUM]: 'Premium',
  [SUBSCRIPTION_TIERS.PREMIUM_PRO]: 'Premium Pro',
}

export const TIER_COLORS = {
  [SUBSCRIPTION_TIERS.FREE]: '#64748b',
  [SUBSCRIPTION_TIERS.PREMIUM]: '#f59e0b',
  [SUBSCRIPTION_TIERS.PREMIUM_PRO]: '#8b5cf6',
}

export const TIER_ICONS = {
  [SUBSCRIPTION_TIERS.FREE]: '📦',
  [SUBSCRIPTION_TIERS.PREMIUM]: '⭐',
  [SUBSCRIPTION_TIERS.PREMIUM_PRO]: '👑',
}

// Helper para obtener nivel numérico del tier (para comparaciones)
export function getTierLevel(tier) {
  switch (tier) {
    case SUBSCRIPTION_TIERS.PREMIUM_PRO:
      return 3
    case SUBSCRIPTION_TIERS.PREMIUM:
      return 2
    case SUBSCRIPTION_TIERS.FREE:
    default:
      return 1
  }
}

// Widgets disponibles por nivel
export const WIDGET_TYPES = {
  HERO: 'hero',
  PRODUCTS_GRID: 'products_grid',
  PRODUCTS_CAROUSEL: 'products_carousel',
  TEXT_BLOCK: 'text_block',
  IMAGE_GALLERY: 'image_gallery',
  TESTIMONIALS: 'testimonials',
  CONTACT_FORM: 'contact_form',
  MAP: 'map',
  FEATURED_PRODUCTS: 'featured_products',
  CATEGORIES: 'categories',
  BANNER: 'banner',
  VIDEO: 'video',
  SOCIAL_LINKS: 'social_links',
  NEWSLETTER: 'newsletter',
  FAQ: 'faq',
  TEAM: 'team',
  STATS: 'stats',
}

export const WIDGET_CONFIG = {
  [WIDGET_TYPES.HERO]: {
    label: 'Hero / Cabecera',
    icon: '🎯',
    tier: SUBSCRIPTION_TIERS.FREE,
    description: 'Sección principal con título, descripción y CTA',
  },
  [WIDGET_TYPES.PRODUCTS_GRID]: {
    label: 'Productos (Grilla)',
    icon: '📦',
    tier: SUBSCRIPTION_TIERS.FREE,
    description: 'Muestra productos en cuadrícula',
  },
  [WIDGET_TYPES.FEATURED_PRODUCTS]: {
    label: 'Productos Destacados',
    icon: '⭐',
    tier: SUBSCRIPTION_TIERS.FREE,
    description: 'Productos marcados como destacados',
  },
  [WIDGET_TYPES.TEXT_BLOCK]: {
    label: 'Bloque de Texto',
    icon: '📝',
    tier: SUBSCRIPTION_TIERS.FREE,
    description: 'Texto personalizable con formato',
  },
  [WIDGET_TYPES.CONTACT_FORM]: {
    label: 'Formulario de Contacto',
    icon: '📧',
    tier: SUBSCRIPTION_TIERS.FREE,
    description: 'Formulario para recibir consultas',
  },
  [WIDGET_TYPES.SOCIAL_LINKS]: {
    label: 'Redes Sociales',
    icon: '🔗',
    tier: SUBSCRIPTION_TIERS.FREE,
    description: 'Enlaces a tus redes sociales',
  },
  // PREMIUM
  [WIDGET_TYPES.PRODUCTS_CAROUSEL]: {
    label: 'Carrusel de Productos',
    icon: '🎠',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Productos con animación de carrusel',
  },
  [WIDGET_TYPES.IMAGE_GALLERY]: {
    label: 'Galería de Imágenes',
    icon: '🖼️',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Galería interactiva con lightbox',
  },
  [WIDGET_TYPES.CATEGORIES]: {
    label: 'Categorías',
    icon: '📂',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Muestra categorías de productos',
  },
  [WIDGET_TYPES.BANNER]: {
    label: 'Banner Promocional',
    icon: '🎨',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Banner con imagen y texto',
  },
  [WIDGET_TYPES.MAP]: {
    label: 'Mapa de Ubicación',
    icon: '📍',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Google Maps integrado',
  },
  // PREMIUM PRO
  [WIDGET_TYPES.TESTIMONIALS]: {
    label: 'Testimonios',
    icon: '💬',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Opiniones de clientes con fotos',
  },
  [WIDGET_TYPES.VIDEO]: {
    label: 'Video',
    icon: '🎬',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Embed de YouTube o video propio',
  },
  [WIDGET_TYPES.NEWSLETTER]: {
    label: 'Newsletter',
    icon: '📰',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Formulario de suscripción',
  },
  [WIDGET_TYPES.FAQ]: {
    label: 'Preguntas Frecuentes',
    icon: '❓',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Acordeón con FAQs',
  },
  [WIDGET_TYPES.TEAM]: {
    label: 'Equipo',
    icon: '👥',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Presenta a tu equipo',
  },
  [WIDGET_TYPES.STATS]: {
    label: 'Estadísticas',
    icon: '📊',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Números y métricas destacadas',
  },
}

// Estilos de cards disponibles por nivel
export const CARD_STYLES = {
  glass: { label: 'Glass', tier: SUBSCRIPTION_TIERS.FREE },
  solid: { label: 'Sólido', tier: SUBSCRIPTION_TIERS.FREE },
  outlined: { label: 'Contorno', tier: SUBSCRIPTION_TIERS.PREMIUM },
  elevated: { label: 'Elevado', tier: SUBSCRIPTION_TIERS.PREMIUM },
  minimal: { label: 'Minimalista', tier: SUBSCRIPTION_TIERS.PREMIUM_PRO },
}

// Layouts de cards de producto - posiciones de elementos
// FREE: 1 layout básico
// PREMIUM: 3 layouts adicionales
// PREMIUM_PRO: 4 layouts adicionales
export const PRODUCT_CARD_LAYOUTS = {
  // FREE
  classic: {
    label: 'Clásico',
    tier: SUBSCRIPTION_TIERS.FREE,
    description: 'Imagen arriba, título y precio abajo',
    imagePosition: 'top',
    titlePosition: 'middle',
    pricePosition: 'bottom-left',
    buttonPosition: 'bottom-right',
    gridTemplate: '"image image" "title title" "price btn"',
    imageRatio: '4/3',
  },
  // PREMIUM (3 layouts)
  horizontal: {
    label: 'Horizontal',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Imagen a la izquierda, contenido a la derecha',
    imagePosition: 'left',
    titlePosition: 'top-right',
    pricePosition: 'middle-right',
    buttonPosition: 'bottom-right',
    gridTemplate: '"image title" "image price" "image btn"',
    imageRatio: '1/1',
  },
  overlay: {
    label: 'Overlay',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Contenido sobre la imagen',
    imagePosition: 'full',
    titlePosition: 'overlay-bottom',
    pricePosition: 'overlay-bottom',
    buttonPosition: 'overlay-corner',
    gridTemplate: '"image"',
    imageRatio: '16/9',
  },
  compact: {
    label: 'Compacto',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Imagen pequeña a la izquierda',
    imagePosition: 'left-small',
    titlePosition: 'right-top',
    pricePosition: 'right-bottom',
    buttonPosition: 'right-bottom',
    gridTemplate: '"image content"',
    imageRatio: '1/1',
  },
  // PREMIUM PRO (4 layouts)
  magazine: {
    label: 'Revista',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Estilo editorial con imagen grande',
    imagePosition: 'top-large',
    titlePosition: 'bottom-left',
    pricePosition: 'top-corner',
    buttonPosition: 'bottom-right',
    gridTemplate: '"price image" "title btn"',
    imageRatio: '3/2',
  },
  minimal: {
    label: 'Minimal',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Solo lo esencial, muy limpio',
    imagePosition: 'center',
    titlePosition: 'below-center',
    pricePosition: 'below-title',
    buttonPosition: 'hover-only',
    gridTemplate: '"image" "title" "price"',
    imageRatio: '1/1',
  },
  polaroid: {
    label: 'Polaroid',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Estilo foto instantánea',
    imagePosition: 'top-padded',
    titlePosition: 'caption',
    pricePosition: 'caption-right',
    buttonPosition: 'hidden',
    gridTemplate: '"image" "caption"',
    imageRatio: '1/1',
  },
  banner: {
    label: 'Banner',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Card ancho tipo banner',
    imagePosition: 'left-half',
    titlePosition: 'right-center',
    pricePosition: 'right-below',
    buttonPosition: 'right-bottom',
    gridTemplate: '"image content"',
    imageRatio: '4/3',
    fullWidth: true,
  },
}

// Layouts de cards de categoría
// FREE: 1 layout básico
// PREMIUM: 4 layouts adicionales
// PREMIUM_PRO: 4 layouts adicionales
export const CATEGORY_CARD_LAYOUTS = {
  // FREE
  grid: {
    label: 'Cuadrícula',
    tier: SUBSCRIPTION_TIERS.FREE,
    description: 'Cards cuadradas con imagen y nombre',
  },
  // PREMIUM (4 layouts)
  horizontal: {
    label: 'Horizontal',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Cards anchas con imagen a la izquierda',
  },
  circle: {
    label: 'Circular',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Imagen circular con nombre debajo',
  },
  chips: {
    label: 'Chips',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Estilo píldoras compactas',
  },
  overlay: {
    label: 'Overlay',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Nombre sobre la imagen',
  },
  // PREMIUM PRO (4 layouts)
  magazine: {
    label: 'Revista',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Estilo editorial con imagen grande',
  },
  minimal: {
    label: 'Minimal',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Solo texto, muy limpio',
  },
  polaroid: {
    label: 'Polaroid',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Estilo foto instantánea',
  },
  banner: {
    label: 'Banner',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Cards tipo banner ancho',
  },
}

// Estilos de botones
// FREE: 1 básico, PREMIUM: 4 adicionales, PREMIUM_PRO: 4 adicionales
export const BUTTON_STYLES = {
  // FREE (1)
  rounded: { 
    label: 'Redondeado', 
    tier: SUBSCRIPTION_TIERS.FREE,
    css: { borderRadius: '8px' }
  },
  // PREMIUM (4)
  pill: { 
    label: 'Píldora', 
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    css: { borderRadius: '50px' }
  },
  square: { 
    label: 'Cuadrado', 
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    css: { borderRadius: '4px' }
  },
  sharp: { 
    label: 'Angular', 
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    css: { borderRadius: '0' }
  },
  soft: { 
    label: 'Suave', 
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    css: { borderRadius: '12px' }
  },
  // PREMIUM_PRO (4)
  gradient: { 
    label: 'Gradiente', 
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    css: { borderRadius: '8px', background: 'linear-gradient(135deg, var(--accent), var(--primary))' }
  },
  outline: { 
    label: 'Contorno', 
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    css: { borderRadius: '8px', background: 'transparent', border: '2px solid var(--accent)', color: 'var(--accent)' }
  },
  glow: { 
    label: 'Resplandor', 
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    css: { borderRadius: '8px', boxShadow: '0 0 20px var(--accent)' }
  },
  glass: { 
    label: 'Cristal', 
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    css: { borderRadius: '12px', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.3)' }
  },
}

// Estilos de layout
// FREE: 1 básico, PREMIUM: 4 adicionales, PREMIUM_PRO: 4 adicionales
export const LAYOUT_STYLES = {
  // FREE (1)
  modern: { 
    label: 'Moderno', 
    tier: SUBSCRIPTION_TIERS.FREE,
    description: 'Layout limpio y espacioso',
    css: { gap: '24px', padding: '20px' }
  },
  // PREMIUM (4)
  classic: { 
    label: 'Clásico', 
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Diseño tradicional elegante',
    css: { gap: '16px', padding: '16px' }
  },
  compact: { 
    label: 'Compacto', 
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Más contenido en menos espacio',
    css: { gap: '12px', padding: '12px' }
  },
  spacious: { 
    label: 'Espacioso', 
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Mucho espacio entre elementos',
    css: { gap: '32px', padding: '28px' }
  },
  minimal: { 
    label: 'Minimalista', 
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Solo lo esencial',
    css: { gap: '20px', padding: '16px' }
  },
  // PREMIUM_PRO (4)
  bold: { 
    label: 'Audaz', 
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Colores y formas llamativas',
    css: { gap: '24px', padding: '24px' }
  },
  elegant: { 
    label: 'Elegante', 
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Sofisticado y refinado',
    css: { gap: '28px', padding: '32px' }
  },
  brutalist: { 
    label: 'Brutalista', 
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Bordes duros, sin redondeo',
    css: { gap: '16px', padding: '20px' }
  },
  magazine: { 
    label: 'Revista', 
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Estilo editorial profesional',
    css: { gap: '32px', padding: '40px' }
  },
}

// Fuentes disponibles con familia CSS real y URL de Google Fonts
export const FONTS = {
  // FREE (3)
  'Inter': { 
    label: 'Inter', 
    tier: SUBSCRIPTION_TIERS.FREE, 
    family: "'Inter', sans-serif",
    url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
  },
  'system-ui': { 
    label: 'Sistema', 
    tier: SUBSCRIPTION_TIERS.FREE, 
    family: "system-ui, -apple-system, sans-serif",
    url: null // Sistema, no necesita carga
  },
  'Roboto': { 
    label: 'Roboto', 
    tier: SUBSCRIPTION_TIERS.FREE, 
    family: "'Roboto', sans-serif",
    url: 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap'
  },
  // PREMIUM (4)
  'Poppins': { 
    label: 'Poppins', 
    tier: SUBSCRIPTION_TIERS.PREMIUM, 
    family: "'Poppins', sans-serif",
    url: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap'
  },
  'Montserrat': { 
    label: 'Montserrat', 
    tier: SUBSCRIPTION_TIERS.PREMIUM, 
    family: "'Montserrat', sans-serif",
    url: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap'
  },
  'Open Sans': { 
    label: 'Open Sans', 
    tier: SUBSCRIPTION_TIERS.PREMIUM, 
    family: "'Open Sans', sans-serif",
    url: 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&display=swap'
  },
  'Lora': { 
    label: 'Lora', 
    tier: SUBSCRIPTION_TIERS.PREMIUM, 
    family: "'Lora', serif",
    url: 'https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&display=swap'
  },
  // PREMIUM_PRO (4)
  'Playfair Display': { 
    label: 'Playfair Display', 
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO, 
    family: "'Playfair Display', serif",
    url: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap'
  },
  'Raleway': { 
    label: 'Raleway', 
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO, 
    family: "'Raleway', sans-serif",
    url: 'https://fonts.googleapis.com/css2?family=Raleway:wght@400;500;600;700&display=swap'
  },
  'Oswald': { 
    label: 'Oswald', 
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO, 
    family: "'Oswald', sans-serif",
    url: 'https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&display=swap'
  },
  'Bebas Neue': { 
    label: 'Bebas Neue', 
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO, 
    family: "'Bebas Neue', sans-serif",
    url: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap'
  },
}

// Helper para cargar una fuente de Google Fonts dinámicamente
export function loadGoogleFont(fontKey) {
  const font = FONTS[fontKey]
  if (!font?.url) return
  
  const existingLink = document.querySelector(`link[href="${font.url}"]`)
  if (!existingLink) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = font.url
    document.head.appendChild(link)
  }
}

// Helper: todas las features disponibles para todos los vendedores
export function isFeatureAvailable(featureTier, userTier) {
  return true
}

// Helper: obtener widgets disponibles para un tier
export function getAvailableWidgets(userTier) {
  return Object.entries(WIDGET_CONFIG)
    .filter(([, config]) => isFeatureAvailable(config.tier, userTier))
    .map(([type, config]) => ({ type, ...config }))
}

// Helper: obtener todas las features bloqueadas para upgrade
export function getLockedFeatures(userTier) {
  const widgets = Object.entries(WIDGET_CONFIG)
    .filter(([, config]) => !isFeatureAvailable(config.tier, userTier))
    .map(([type, config]) => ({ type, ...config, category: 'widget' }))

  const cards = Object.entries(CARD_STYLES)
    .filter(([, config]) => !isFeatureAvailable(config.tier, userTier))
    .map(([type, config]) => ({ type, ...config, category: 'card_style' }))

  const fonts = Object.entries(FONTS)
    .filter(([, config]) => !isFeatureAvailable(config.tier, userTier))
    .map(([type, config]) => ({ type, ...config, category: 'font' }))

  return [...widgets, ...cards, ...fonts]
}

// Límites por tier
export const TIER_LIMITS = {
  [SUBSCRIPTION_TIERS.FREE]: {
    maxProducts: 15,
    maxImages: 5,
    maxWidgets: 4,
    maxCategories: 3,
    customDomain: false,
    analytics: false,
    prioritySupport: false,
    removeWatermark: false,
  },
  [SUBSCRIPTION_TIERS.PREMIUM]: {
    maxProducts: 50,
    maxImages: 20,
    maxWidgets: 10,
    maxCategories: 10,
    customDomain: false,
    analytics: true,
    prioritySupport: false,
    removeWatermark: true,
  },
  [SUBSCRIPTION_TIERS.PREMIUM_PRO]: {
    maxProducts: -1, // ilimitado
    maxImages: -1,
    maxWidgets: -1,
    maxCategories: -1,
    customDomain: true,
    analytics: true,
    prioritySupport: true,
    removeWatermark: true,
  },
}

// Features de cada tier para mostrar en pricing
export const TIER_FEATURES = {
  [SUBSCRIPTION_TIERS.FREE]: [
    'Hasta 15 productos',
    'Tienda pública',
    'Personalización básica de colores',
    '4 widgets disponibles',
    '2 fuentes',
    'Soporte por email',
  ],
  [SUBSCRIPTION_TIERS.PREMIUM]: [
    'Hasta 50 productos',
    'Carrusel de productos',
    'Galería de imágenes',
    '10 widgets disponibles',
    '8 fuentes premium',
    'Sin marca de agua',
    'Analytics básico',
    'Más estilos de cards',
  ],
  [SUBSCRIPTION_TIERS.PREMIUM_PRO]: [
    'Productos ilimitados',
    'Todos los widgets',
    'Todas las fuentes',
    'Dominio personalizado',
    'Analytics avanzado',
    'Soporte prioritario',
    'Testimonios y videos',
    'Newsletter integrado',
  ],
}

export const TIER_PRICES = {
  [SUBSCRIPTION_TIERS.FREE]: { monthly: 0, yearly: 0 },
  [SUBSCRIPTION_TIERS.PREMIUM]: { monthly: 9.99, yearly: 99 },
  [SUBSCRIPTION_TIERS.PREMIUM_PRO]: { monthly: 24.99, yearly: 249 },
}

// Estilos de Hero/Carrusel para la tienda
// FREE: 1 estilo básico
// PREMIUM: 4 estilos
// PREMIUM_PRO: 4 estilos adicionales
export const STORE_HERO_STYLES = {
  // FREE
  simple: {
    label: 'Clásico',
    tier: SUBSCRIPTION_TIERS.FREE,
    description: 'Banner elegante con título centrado',
    layout: 'center',
    hasCarousel: false,
    icon: '🎯',
  },
  // PREMIUM (4 estilos)
  slide_fade: {
    label: 'Fade Suave',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Transición con desvanecimiento elegante',
    layout: 'full',
    hasCarousel: true,
    animation: 'fade',
    icon: '✨',
  },
  slide_horizontal: {
    label: 'Deslizar',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Deslizamiento horizontal fluido',
    layout: 'full',
    hasCarousel: true,
    animation: 'slide-x',
    icon: '➡️',
  },
  ken_burns: {
    label: 'Ken Burns',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Zoom lento cinematográfico en imágenes',
    layout: 'full',
    hasCarousel: true,
    animation: 'ken-burns',
    icon: '🎬',
  },
  split_screen: {
    label: 'Pantalla Dividida',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Imagen a un lado, contenido al otro',
    layout: 'split',
    hasCarousel: true,
    animation: 'split',
    icon: '⚡',
  },
  // PREMIUM PRO (4 estilos adicionales)
  parallax_depth: {
    label: 'Parallax 3D',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Efecto de profundidad con capas',
    layout: 'full',
    hasCarousel: true,
    animation: 'parallax',
    icon: '🌊',
  },
  cube_rotate: {
    label: 'Cubo 3D',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Rotación 3D tipo cubo entre slides',
    layout: 'full',
    hasCarousel: true,
    animation: 'cube',
    icon: '🎲',
  },
  reveal_wipe: {
    label: 'Revelar',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Efecto de cortina que revela la imagen',
    layout: 'full',
    hasCarousel: true,
    animation: 'reveal',
    icon: '🎭',
  },
  zoom_blur: {
    label: 'Zoom Blur',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Zoom con desenfoque dinámico',
    layout: 'fullscreen',
    hasCarousel: true,
    animation: 'zoom-blur',
    icon: '🔮',
  },
}

// Estilos de botones del carrusel
// PREMIUM: 4 estilos
// PREMIUM_PRO: 4 estilos adicionales
export const CAROUSEL_BUTTON_STYLES = {
  // PREMIUM (4 estilos)
  arrows_classic: {
    id: 'arrows_classic',
    label: 'Flechas Clásicas',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Flechas simples y elegantes',
    icon: '◀ ▶',
    preview: '‹ ›',
  },
  arrows_circle: {
    id: 'arrows_circle',
    label: 'Círculos',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Botones circulares con flechas',
    icon: '⬤',
    preview: '◀ ▶',
  },
  arrows_square: {
    id: 'arrows_square',
    label: 'Cuadrados',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Botones cuadrados modernos',
    icon: '◼',
    preview: '◂ ▸',
  },
  arrows_minimal: {
    id: 'arrows_minimal',
    label: 'Minimalista',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Solo flechas sin fondo',
    icon: '→',
    preview: '← →',
  },
  // PREMIUM PRO (4 estilos adicionales)
  arrows_pill: {
    id: 'arrows_pill',
    label: 'Píldora',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Forma alargada tipo píldora',
    icon: '💊',
    preview: '⟨ ⟩',
  },
  arrows_floating: {
    id: 'arrows_floating',
    label: 'Flotantes',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Botones flotantes con sombra',
    icon: '🌟',
    preview: '❮ ❯',
  },
  arrows_gradient: {
    id: 'arrows_gradient',
    label: 'Gradiente',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Fondo con gradiente de color',
    icon: '🌈',
    preview: '◀ ▶',
  },
  arrows_neon: {
    id: 'arrows_neon',
    label: 'Neón',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Efecto neón brillante',
    icon: '💡',
    preview: '〈 〉',
  },
}

// Paletas de colores prediseñadas (solo afectan la página, no las cards)
// Cada paleta tiene: primary, accent, background, text
export const COLOR_PALETTES = {
  // PREMIUM - 8 paletas con combinaciones armónicas
  sunset_warm: {
    label: 'Atardecer Cálido',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    preview: ['#ff6b6b', '#feca57', '#fff9e6', '#2d3436'],
    colors: { primary: '#2d3436', accent: '#ff6b6b', background: '#fff9e6', text: '#2d3436' },
  },
  ocean_breeze: {
    label: 'Brisa Marina',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    preview: ['#0984e3', '#74b9ff', '#f0f8ff', '#2d3436'],
    colors: { primary: '#0984e3', accent: '#00b894', background: '#f0f8ff', text: '#2d3436' },
  },
  forest_green: {
    label: 'Bosque Verde',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    preview: ['#27ae60', '#a3d9a5', '#f0fff4', '#1a1a2e'],
    colors: { primary: '#1a1a2e', accent: '#27ae60', background: '#f0fff4', text: '#1a1a2e' },
  },
  berry_purple: {
    label: 'Frutos Rojos',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    preview: ['#9b59b6', '#e056fd', '#faf0ff', '#2d3436'],
    colors: { primary: '#2d3436', accent: '#9b59b6', background: '#faf0ff', text: '#2d3436' },
  },
  coral_pink: {
    label: 'Coral Rosa',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    preview: ['#fd79a8', '#fab1a0', '#fff5f5', '#2d3436'],
    colors: { primary: '#2d3436', accent: '#fd79a8', background: '#fff5f5', text: '#2d3436' },
  },
  midnight_blue: {
    label: 'Azul Medianoche',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    preview: ['#2c3e50', '#3498db', '#ecf0f1', '#2c3e50'],
    colors: { primary: '#2c3e50', accent: '#3498db', background: '#ecf0f1', text: '#2c3e50' },
  },
  autumn_gold: {
    label: 'Otoño Dorado',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    preview: ['#d35400', '#f39c12', '#fffaf0', '#2c3e50'],
    colors: { primary: '#2c3e50', accent: '#d35400', background: '#fffaf0', text: '#2c3e50' },
  },
  mint_fresh: {
    label: 'Menta Fresca',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    preview: ['#00b894', '#55efc4', '#f0fffc', '#2d3436'],
    colors: { primary: '#2d3436', accent: '#00b894', background: '#f0fffc', text: '#2d3436' },
  },

  // PREMIUM PRO - 8 paletas premium con estilos sofisticados
  luxury_noir: {
    label: 'Lujo Noir',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    preview: ['#1a1a2e', '#c9a227', '#0f0f0f', '#f5f5f5'],
    colors: { primary: '#c9a227', accent: '#c9a227', background: '#0f0f0f', text: '#f5f5f5' },
  },
  rose_gold: {
    label: 'Oro Rosa',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    preview: ['#b76e79', '#e8c4c4', '#fdf6f6', '#4a3728'],
    colors: { primary: '#4a3728', accent: '#b76e79', background: '#fdf6f6', text: '#4a3728' },
  },
  nordic_snow: {
    label: 'Nieve Nórdica',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    preview: ['#5c6bc0', '#7986cb', '#fafbff', '#263238'],
    colors: { primary: '#263238', accent: '#5c6bc0', background: '#fafbff', text: '#263238' },
  },
  tropical_paradise: {
    label: 'Paraíso Tropical',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    preview: ['#00cec9', '#ff7675', '#fffffe', '#2d3436'],
    colors: { primary: '#2d3436', accent: '#00cec9', background: '#fffffe', text: '#2d3436' },
  },
  espresso_mocha: {
    label: 'Espresso Mocha',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    preview: ['#6d4c41', '#d7ccc8', '#efebe9', '#3e2723'],
    colors: { primary: '#3e2723', accent: '#6d4c41', background: '#efebe9', text: '#3e2723' },
  },
  aurora_borealis: {
    label: 'Aurora Boreal',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    preview: ['#667eea', '#764ba2', '#f5f7ff', '#1a1a2e'],
    colors: { primary: '#1a1a2e', accent: '#667eea', background: '#f5f7ff', text: '#1a1a2e' },
  },
  cherry_blossom: {
    label: 'Flor de Cerezo',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    preview: ['#d63384', '#ffb6c1', '#fff0f5', '#2d3436'],
    colors: { primary: '#2d3436', accent: '#d63384', background: '#fff0f5', text: '#2d3436' },
  },
  emerald_night: {
    label: 'Noche Esmeralda',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    preview: ['#10b981', '#34d399', '#0d1b2a', '#f0fdf4'],
    colors: { primary: '#10b981', accent: '#34d399', background: '#0d1b2a', text: '#f0fdf4' },
  },
}

// =========================================
// DOWNGRADE / RESET A FREE
// =========================================

// Orden de tiers para comparaciones
export const TIER_ORDER = [
  SUBSCRIPTION_TIERS.FREE,
  SUBSCRIPTION_TIERS.PREMIUM,
  SUBSCRIPTION_TIERS.PREMIUM_PRO,
]

// Helper: Verificar si es un downgrade
export function isDowngrade(currentTier, targetTier) {
  const currentIndex = TIER_ORDER.indexOf(currentTier)
  const targetIndex = TIER_ORDER.indexOf(targetTier)
  return targetIndex < currentIndex
}

// Helper: Obtener tier activo considerando fecha de expiración
export function getActiveSubscriptionTier(tenant) {
  if (!tenant) return SUBSCRIPTION_TIERS.FREE
  
  const tier = tenant.subscription_tier || SUBSCRIPTION_TIERS.FREE
  const premiumUntil = tenant.premium_until
  
  // Si no hay fecha de expiración, usar el tier tal cual
  if (!premiumUntil) return tier
  
  // Si la fecha expiró, es FREE
  const now = new Date()
  const expiry = new Date(premiumUntil)
  if (expiry < now) return SUBSCRIPTION_TIERS.FREE
  
  return tier
}

// Helper: Obtener features que se perderán al hacer downgrade
export function getDowngradeLostFeatures(currentTier, targetTier) {
  const lostFeatures = []
  
  // Features que se pierden según el downgrade
  if (currentTier === SUBSCRIPTION_TIERS.PREMIUM_PRO) {
    if (targetTier === SUBSCRIPTION_TIERS.FREE || targetTier === SUBSCRIPTION_TIERS.PREMIUM) {
      lostFeatures.push('Widgets premium (Testimonios, Video, Newsletter, FAQ, etc.)')
      lostFeatures.push('Layouts de cards premium (Magazine, Minimal, Polaroid, Banner)')
      lostFeatures.push('Estilos de hero premium (Parallax 3D, Cubo 3D, Revelar)')
      lostFeatures.push('Fuentes premium (Raleway, Oswald)')
      lostFeatures.push('Paletas de colores exclusivas')
      lostFeatures.push('Dominio personalizado')
      lostFeatures.push('Analytics avanzado')
      lostFeatures.push('Soporte prioritario')
      lostFeatures.push('Productos ilimitados')
    }
    if (targetTier === SUBSCRIPTION_TIERS.FREE) {
      lostFeatures.push('Carrusel de productos')
      lostFeatures.push('Galería de imágenes')
      lostFeatures.push('Más estilos de cards (Horizontal, Overlay, Compacto)')
      lostFeatures.push('Fuentes adicionales (Poppins, Montserrat, etc.)')
      lostFeatures.push('Todas las paletas de colores')
      lostFeatures.push('Sin marca de agua')
    }
  } else if (currentTier === SUBSCRIPTION_TIERS.PREMIUM && targetTier === SUBSCRIPTION_TIERS.FREE) {
    lostFeatures.push('Carrusel de productos')
    lostFeatures.push('Galería de imágenes')
    lostFeatures.push('Estilos de cards premium (Horizontal, Overlay, Compacto)')
    lostFeatures.push('Fuentes premium (Poppins, Montserrat, Lora)')
    lostFeatures.push('Paletas de colores prediseñadas')
    lostFeatures.push('Banner promocional')
    lostFeatures.push('Mapa de ubicación')
    lostFeatures.push('Sin marca de agua')
    lostFeatures.push('Límite reducido a 15 productos')
  }
  
  return lostFeatures
}

// Configuraciones default para FREE (theme)
export const FREE_DEFAULT_THEME = {
  primary: '#111827',
  accent: '#f59e0b',
  background: '#ffffff',
  text: '#111827',
  radius: '12px',
  fontFamily: 'Inter',
  cardStyle: 'glass',
  buttonStyle: 'rounded',
  layoutStyle: 'modern',
  productCardLayout: 'classic',
  categoryCardLayout: 'grid',
  heroStyle: 'simple',
  heroSlides: [],
  heroTitlePosition: 'center',
  heroOverlayOpacity: 0.3,
  heroShowTitle: true,
  heroShowSubtitle: true,
  heroShowCta: true,
  heroCarouselButtonStyle: null,
}

// Configuraciones default para FREE (mobile preview)
export const FREE_DEFAULT_MOBILE_SETTINGS = {
  headerDesign: 'centered',
  cardDesign: 'stackedFull',
  spacingOption: 'balanced',
  typographyOption: 'standard',
  carouselOptions: {
    showTitle: true,
    showSubtitle: true,
    showCta: true,
  },
}

// Configuraciones default para FREE (tenant customization)
export const FREE_DEFAULT_TENANT_SETTINGS = {
  welcome_modal_features_design: 'simple',
  mobile_header_design: 'centered',
  mobile_card_design: 'stackedFull',
  mobile_spacing_option: 'balanced',
  mobile_typography_option: 'standard',
}

// =========================================
// SUBSCRIPTION EXPIRATION / RENEWAL
// =========================================

// Duración de suscripción en días
export const SUBSCRIPTION_DURATION_DAYS = 30

// Días antes de expiración para mostrar advertencia
export const RENEWAL_WARNING_DAYS = 1

/**
 * Calcula los días restantes de suscripción
 * @param {Date|string} premiumUntil - Fecha de expiración
 * @returns {number} Días restantes (puede ser negativo si expiró)
 */
export function getSubscriptionDaysRemaining(premiumUntil) {
  if (!premiumUntil) return -1
  
  const now = new Date()
  const expiry = new Date(premiumUntil)
  
  if (isNaN(expiry.getTime())) return -1
  
  const diffMs = expiry - now
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  
  return diffDays
}

/**
 * Verifica si la suscripción está por expirar (dentro del período de advertencia)
 * @param {Object} tenant - Objeto tenant con premium_until
 * @returns {boolean}
 */
export function isSubscriptionExpiringSoon(tenant) {
  if (!tenant) return false
  
  const tier = tenant.subscription_tier || SUBSCRIPTION_TIERS.FREE
  if (tier === SUBSCRIPTION_TIERS.FREE) return false
  
  const daysRemaining = getSubscriptionDaysRemaining(tenant.premium_until)
  
  // Mostrar advertencia si quedan RENEWAL_WARNING_DAYS días o menos (incluyendo 0)
  return daysRemaining >= 0 && daysRemaining <= RENEWAL_WARNING_DAYS
}

/**
 * Verifica si la suscripción ha expirado
 * @param {Object} tenant - Objeto tenant con premium_until
 * @returns {boolean}
 */
export function hasSubscriptionExpired(tenant) {
  if (!tenant) return true
  
  const tier = tenant.subscription_tier || SUBSCRIPTION_TIERS.FREE
  if (tier === SUBSCRIPTION_TIERS.FREE) return false // FREE no expira
  
  const daysRemaining = getSubscriptionDaysRemaining(tenant.premium_until)
  
  return daysRemaining < 0
}

/**
 * Calcula la nueva fecha de expiración al renovar
 * Si la suscripción aún no expiró, extiende desde la fecha actual de expiración
 * Si ya expiró, empieza desde hoy
 * @param {Date|string} currentExpiry - Fecha de expiración actual
 * @param {string} billingPeriod - 'monthly' o 'yearly'
 * @returns {Date}
 */
export function calculateRenewalExpiry(currentExpiry, billingPeriod = 'monthly') {
  const now = new Date()
  const expiry = currentExpiry ? new Date(currentExpiry) : now
  
  // Si la expiración es en el futuro, extender desde ahí
  // Si ya pasó, empezar desde hoy
  const baseDate = expiry > now ? expiry : now
  
  const newExpiry = new Date(baseDate)
  
  if (billingPeriod === 'yearly') {
    newExpiry.setFullYear(newExpiry.getFullYear() + 1)
  } else {
    newExpiry.setDate(newExpiry.getDate() + SUBSCRIPTION_DURATION_DAYS)
  }
  
  return newExpiry
}

/**
 * Información completa del estado de suscripción
 * @param {Object} tenant 
 * @returns {Object}
 */
export function getSubscriptionStatus(tenant) {
  if (!tenant) {
    return {
      tier: SUBSCRIPTION_TIERS.FREE,
      isActive: false,
      isPremium: false,
      daysRemaining: -1,
      isExpiringSoon: false,
      hasExpired: false,
      expiresAt: null,
    }
  }
  
  const tier = tenant.subscription_tier || SUBSCRIPTION_TIERS.FREE
  const isPremium = tier !== SUBSCRIPTION_TIERS.FREE
  const daysRemaining = getSubscriptionDaysRemaining(tenant.premium_until)
  const hasExpired = isPremium && daysRemaining < 0
  const isExpiringSoon = isSubscriptionExpiringSoon(tenant)
  const isActive = isPremium && !hasExpired
  
  return {
    tier,
    isActive,
    isPremium,
    daysRemaining,
    isExpiringSoon,
    hasExpired,
    expiresAt: tenant.premium_until,
    scheduledTier: tenant.scheduled_tier || null,
    scheduledAt: tenant.scheduled_at || null,
  }
}

