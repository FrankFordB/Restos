// Niveles de suscripción
export const SUBSCRIPTION_TIERS = {
  FREE: 'free',
  PREMIUM: 'premium',
  PREMIUM_PRO: 'premium_pro',
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

// Estilos de botones
export const BUTTON_STYLES = {
  rounded: { label: 'Redondeado', tier: SUBSCRIPTION_TIERS.FREE },
  pill: { label: 'Píldora', tier: SUBSCRIPTION_TIERS.PREMIUM },
  square: { label: 'Cuadrado', tier: SUBSCRIPTION_TIERS.PREMIUM },
  soft: { label: 'Suave', tier: SUBSCRIPTION_TIERS.PREMIUM_PRO },
}

// Estilos de layout
export const LAYOUT_STYLES = {
  modern: { label: 'Moderno', tier: SUBSCRIPTION_TIERS.FREE },
  classic: { label: 'Clásico', tier: SUBSCRIPTION_TIERS.PREMIUM },
  minimal: { label: 'Minimalista', tier: SUBSCRIPTION_TIERS.PREMIUM },
  bold: { label: 'Audaz', tier: SUBSCRIPTION_TIERS.PREMIUM_PRO },
}

// Fuentes disponibles
export const FONTS = {
  'Inter': { label: 'Inter', tier: SUBSCRIPTION_TIERS.FREE },
  'system-ui': { label: 'Sistema', tier: SUBSCRIPTION_TIERS.FREE },
  'Poppins': { label: 'Poppins', tier: SUBSCRIPTION_TIERS.PREMIUM },
  'Montserrat': { label: 'Montserrat', tier: SUBSCRIPTION_TIERS.PREMIUM },
  'Playfair Display': { label: 'Playfair Display', tier: SUBSCRIPTION_TIERS.PREMIUM },
  'Roboto': { label: 'Roboto', tier: SUBSCRIPTION_TIERS.FREE },
  'Open Sans': { label: 'Open Sans', tier: SUBSCRIPTION_TIERS.FREE },
  'Lora': { label: 'Lora', tier: SUBSCRIPTION_TIERS.PREMIUM },
  'Raleway': { label: 'Raleway', tier: SUBSCRIPTION_TIERS.PREMIUM_PRO },
  'Oswald': { label: 'Oswald', tier: SUBSCRIPTION_TIERS.PREMIUM_PRO },
}

// Helper: verificar si una feature está disponible para un tier
export function isFeatureAvailable(featureTier, userTier) {
  const tierOrder = [SUBSCRIPTION_TIERS.FREE, SUBSCRIPTION_TIERS.PREMIUM, SUBSCRIPTION_TIERS.PREMIUM_PRO]
  const featureIndex = tierOrder.indexOf(featureTier)
  const userIndex = tierOrder.indexOf(userTier)
  return userIndex >= featureIndex
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
