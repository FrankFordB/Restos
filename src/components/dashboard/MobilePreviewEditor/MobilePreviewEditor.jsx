import { useState, useEffect } from 'react'
import './MobilePreviewEditor.css'
import Card from '../../ui/Card/Card'
import Button from '../../ui/Button/Button'
import { 
  Smartphone, Monitor, Tablet, Eye, EyeOff, Save, RotateCcw,
  Crown, Lock, Star, ChevronDown, ChevronUp,
  Grid3X3, Rows3, Layers, Package, Newspaper, Camera, Tag, Sparkles,
  AlignLeft, AlignCenter, AlignRight, Image, Type, Maximize2, Minimize2,
  Square, RectangleHorizontal, CircleDot, Move, ZoomIn, ZoomOut, Check,
  LayoutList
} from 'lucide-react'
import { SUBSCRIPTION_TIERS, TIER_LABELS, isFeatureAvailable } from '../../../shared/subscriptions'
import { isSupabaseConfigured } from '../../../lib/supabaseClient'
import { fetchMobilePreviewSettings, updateMobilePreviewSettings } from '../../../lib/supabaseApi'
import { loadJson, saveJson } from '../../../shared/storage'

// ============================================
// CONFIGURACIONES DE DISEÑO MÓVIL
// ============================================

// Configuraciones de Header/Hero para móvil
const MOBILE_HEADER_DESIGNS = {
  // Premium
  compact: {
    id: 'compact',
    name: 'Compacto',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Header reducido para más espacio',
    preview: { height: '120px', logoSize: '40px' },
  },
  centered: {
    id: 'centered',
    name: 'Centrado',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Logo y texto al centro',
    preview: { height: '160px', logoSize: '60px', align: 'center' },
  },
  minimal: {
    id: 'minimal',
    name: 'Minimalista',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Solo logo sin fondo',
    preview: { height: '100px', logoSize: '50px', minimal: true },
  },
  fullImage: {
    id: 'fullImage',
    name: 'Imagen completa',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Imagen de fondo grande',
    preview: { height: '200px', logoSize: '70px', fullBg: true },
  },
  // Premium Pro
  parallax: {
    id: 'parallax',
    name: 'Parallax',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Efecto parallax al scroll',
    preview: { height: '180px', logoSize: '65px', effect: 'parallax' },
  },
  glassmorphism: {
    id: 'glassmorphism',
    name: 'Cristal',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Efecto vidrio esmerilado',
    preview: { height: '160px', logoSize: '55px', effect: 'glass' },
  },
  gradient: {
    id: 'gradient',
    name: 'Gradiente',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Fondo con gradiente animado',
    preview: { height: '180px', logoSize: '60px', effect: 'gradient' },
  },
  split: {
    id: 'split',
    name: 'Dividido',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Logo a un lado, info al otro',
    preview: { height: '140px', logoSize: '80px', split: true },
  },
}

// Configuraciones de Cards para móvil
const MOBILE_CARD_DESIGNS = {
  // Premium
  stackedFull: {
    id: 'stackedFull',
    name: 'Apilado completo',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Una card por fila, imagen grande',
    preview: { cols: 1, imageRatio: '60%' },
  },
  gridCompact: {
    id: 'gridCompact',
    name: 'Grid compacto',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Dos cards pequeñas por fila',
    preview: { cols: 2, imageRatio: '50%' },
  },
  listView: {
    id: 'listView',
    name: 'Lista horizontal',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Imagen a la izquierda, info a la derecha',
    preview: { cols: 1, horizontal: true },
  },
  imageFirst: {
    id: 'imageFirst',
    name: 'Imagen prominente',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Imagen grande, texto pequeño',
    preview: { cols: 1, imageRatio: '70%' },
  },
  // Premium Pro
  masonry: {
    id: 'masonry',
    name: 'Masonry',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Altura variable tipo Pinterest',
    preview: { cols: 2, masonry: true },
  },
  carousel: {
    id: 'carousel',
    name: 'Carrusel',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Deslizar horizontalmente',
    preview: { carousel: true },
  },
  magazine: {
    id: 'magazine',
    name: 'Revista',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Alternando grandes y pequeñas',
    preview: { magazine: true },
  },
  polaroid: {
    id: 'polaroid',
    name: 'Polaroid',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Estilo foto instantánea',
    preview: { cols: 2, polaroid: true },
  },
}

// Configuraciones de espaciado/tamaño
const MOBILE_SPACING_OPTIONS = {
  // Premium
  comfortable: {
    id: 'comfortable',
    name: 'Cómodo',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Espaciado generoso',
    values: { gap: '16px', padding: '20px', cardRadius: '16px' },
  },
  compact: {
    id: 'compact',
    name: 'Compacto',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Más contenido visible',
    values: { gap: '8px', padding: '12px', cardRadius: '8px' },
  },
  balanced: {
    id: 'balanced',
    name: 'Equilibrado',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Balance entre espacio y contenido',
    values: { gap: '12px', padding: '16px', cardRadius: '12px' },
  },
  airy: {
    id: 'airy',
    name: 'Aireado',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Mucho espacio en blanco',
    values: { gap: '24px', padding: '24px', cardRadius: '20px' },
  },
  // Premium Pro
  custom: {
    id: 'custom',
    name: 'Personalizado',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Ajusta cada valor manualmente',
    values: null, // Custom
  },
  minimal: {
    id: 'minimal',
    name: 'Ultra mínimo',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Sin bordes ni separaciones',
    values: { gap: '4px', padding: '8px', cardRadius: '4px' },
  },
  luxe: {
    id: 'luxe',
    name: 'Lujoso',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Espaciado premium con sombras',
    values: { gap: '20px', padding: '24px', cardRadius: '24px', shadow: true },
  },
  dynamic: {
    id: 'dynamic',
    name: 'Dinámico',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Cambia según scroll',
    values: { gap: '12px', padding: '16px', cardRadius: '16px', dynamic: true },
  },
}

// Configuraciones de tipografía móvil
const MOBILE_TYPOGRAPHY_OPTIONS = {
  // Premium
  standard: {
    id: 'standard',
    name: 'Estándar',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Tamaños por defecto',
    values: { titleSize: '16px', priceSize: '18px', descSize: '14px' },
  },
  large: {
    id: 'large',
    name: 'Grande',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Texto más legible',
    values: { titleSize: '18px', priceSize: '22px', descSize: '15px' },
  },
  bold: {
    id: 'bold',
    name: 'Negrita',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Títulos más gruesos',
    values: { titleSize: '16px', priceSize: '18px', descSize: '14px', titleWeight: '700' },
  },
  elegant: {
    id: 'elegant',
    name: 'Elegante',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Estilo serif refinado',
    values: { titleSize: '17px', priceSize: '20px', descSize: '14px', fontFamily: 'serif' },
  },
  // Premium Pro
  dynamic: {
    id: 'dynamic',
    name: 'Dinámico',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Se adapta al contenido',
    values: { adaptive: true },
  },
  minimal: {
    id: 'minimal',
    name: 'Minimalista',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Peso ligero, mucho espacio',
    values: { titleSize: '15px', priceSize: '16px', descSize: '13px', titleWeight: '400' },
  },
  impact: {
    id: 'impact',
    name: 'Impacto',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Títulos muy grandes',
    values: { titleSize: '22px', priceSize: '26px', descSize: '14px', titleWeight: '800' },
  },
  custom: {
    id: 'custom',
    name: 'Personalizado',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Ajusta cada tamaño',
    values: null, // Custom
  },
}

const MOCK_STORAGE_KEY = 'mock.mobilePreviewSettings'

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function MobilePreviewEditor({ 
  tenantId, 
  tenantName = 'Mi Tienda',
  tenantLogo = '',
  tenantSlug = '',
  currentTier = SUBSCRIPTION_TIERS.FREE,
}) {
  // Estado de configuración
  const [headerDesign, setHeaderDesign] = useState('centered')
  const [cardDesign, setCardDesign] = useState('stackedFull')
  const [spacingOption, setSpacingOption] = useState('balanced')
  const [typographyOption, setTypographyOption] = useState('standard')
  const [carouselOptions, setCarouselOptions] = useState({ showTitle: true, showSubtitle: true, showCta: true })
  
  // Estado de secciones expandidas
  const [expandedSection, setExpandedSection] = useState('header')
  
  // Estado de cambios
  const [hasChanges, setHasChanges] = useState(false)
  const [saving, setSaving] = useState(false)
  const [originalSettings, setOriginalSettings] = useState(null)

  // Cargar configuración guardada
  useEffect(() => {
    if (!tenantId) return
    
    const loadSettings = async () => {
      try {
        if (isSupabaseConfigured) {
          // Cargar desde Supabase
          const saved = await fetchMobilePreviewSettings(tenantId)
          if (saved) {
            setHeaderDesign(saved.headerDesign || 'centered')
            setCardDesign(saved.cardDesign || 'stackedFull')
            setSpacingOption(saved.spacingOption || 'balanced')
            setTypographyOption(saved.typographyOption || 'standard')
            setCarouselOptions(saved.carouselOptions || { showTitle: true, showSubtitle: true, showCta: true })
            setOriginalSettings(saved)
          }
        } else {
          // Fallback a localStorage en modo mock
          const saved = loadJson(`${MOCK_STORAGE_KEY}.${tenantId}`, null)
          if (saved) {
            setHeaderDesign(saved.headerDesign || 'centered')
            setCardDesign(saved.cardDesign || 'stackedFull')
            setSpacingOption(saved.spacingOption || 'balanced')
            setTypographyOption(saved.typographyOption || 'standard')
            setCarouselOptions(saved.carouselOptions || { showTitle: true, showSubtitle: true, showCta: true })
            setOriginalSettings(saved)
          }
        }
      } catch (err) {
        console.error('Error loading mobile preview settings:', err)
      }
    }
    
    loadSettings()
  }, [tenantId])

  // Detectar cambios
  useEffect(() => {
    if (!originalSettings) {
      setHasChanges(false)
      return
    }
    
    const origCarousel = originalSettings.carouselOptions || { showTitle: true, showSubtitle: true, showCta: true }
    const carouselChanged = 
      carouselOptions.showTitle !== origCarousel.showTitle ||
      carouselOptions.showSubtitle !== origCarousel.showSubtitle ||
      carouselOptions.showCta !== origCarousel.showCta
    
    const changed = 
      headerDesign !== (originalSettings.headerDesign || 'centered') ||
      cardDesign !== (originalSettings.cardDesign || 'stackedFull') ||
      spacingOption !== (originalSettings.spacingOption || 'balanced') ||
      typographyOption !== (originalSettings.typographyOption || 'standard') ||
      carouselChanged
    
    setHasChanges(changed)
  }, [headerDesign, cardDesign, spacingOption, typographyOption, carouselOptions, originalSettings])

  // Guardar cambios
  const handleSave = async () => {
    setSaving(true)
    try {
      const settings = {
        headerDesign,
        cardDesign,
        spacingOption,
        typographyOption,
        carouselOptions,
      }
      
      if (isSupabaseConfigured) {
        // Guardar en Supabase
        await updateMobilePreviewSettings({
          tenantId,
          headerDesign,
          cardDesign,
          spacingOption,
          typographyOption,
          carouselOptions,
        })
      } else {
        // Guardar en localStorage en modo mock
        saveJson(`${MOCK_STORAGE_KEY}.${tenantId}`, settings)
      }
      
      setOriginalSettings(settings)
      setHasChanges(false)
    } catch (err) {
      console.error('Error saving mobile preview settings:', err)
    } finally {
      setSaving(false)
    }
  }

  // Descartar cambios
  const handleDiscard = () => {
    if (originalSettings) {
      setHeaderDesign(originalSettings.headerDesign || 'centered')
      setCardDesign(originalSettings.cardDesign || 'stackedFull')
      setSpacingOption(originalSettings.spacingOption || 'balanced')
      setTypographyOption(originalSettings.typographyOption || 'standard')
      setCarouselOptions(originalSettings.carouselOptions || { showTitle: true, showSubtitle: true, showCta: true })
    }
    setHasChanges(false)
  }

  // Verificar disponibilidad de feature
  const checkAvailable = (tier) => {
    return isFeatureAvailable(tier, currentTier)
  }

  // Toggle de sección expandida
  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  // Renderizar selector de diseño
  const renderDesignSelector = (designs, selectedId, onSelect, title) => {
    const premiumDesigns = Object.values(designs).filter(d => d.tier === SUBSCRIPTION_TIERS.PREMIUM)
    const proDesigns = Object.values(designs).filter(d => d.tier === SUBSCRIPTION_TIERS.PREMIUM_PRO)
    
    return (
      <div className="mobileEditor__designSection">
        {/* Premium designs */}
        <div className="mobileEditor__tierGroup">
          <div className="mobileEditor__tierLabel">
            <Star size={14} />
            Premium
          </div>
          <div className="mobileEditor__designGrid">
            {premiumDesigns.map(design => {
              const available = checkAvailable(design.tier)
              const selected = selectedId === design.id
              
              return (
                <button
                  key={design.id}
                  type="button"
                  className={`mobileEditor__designBtn ${selected ? 'selected' : ''} ${!available ? 'locked' : ''}`}
                  onClick={() => available && onSelect(design.id)}
                  disabled={!available}
                  title={design.description}
                >
                  {selected && <span className="mobileEditor__checkIcon"><Check size={14} /></span>}
                  <span className="mobileEditor__designName">{design.name}</span>
                  {!available && <Lock size={12} className="mobileEditor__lockIcon" />}
                </button>
              )
            })}
          </div>
        </div>
        
        {/* Premium Pro designs */}
        <div className="mobileEditor__tierGroup">
          <div className="mobileEditor__tierLabel mobileEditor__tierLabel--pro">
            <Crown size={14} />
            Premium Pro
          </div>
          <div className="mobileEditor__designGrid">
            {proDesigns.map(design => {
              const available = checkAvailable(design.tier)
              const selected = selectedId === design.id
              
              return (
                <button
                  key={design.id}
                  type="button"
                  className={`mobileEditor__designBtn ${selected ? 'selected' : ''} ${!available ? 'locked' : ''}`}
                  onClick={() => available && onSelect(design.id)}
                  disabled={!available}
                  title={design.description}
                >
                  {selected && <span className="mobileEditor__checkIcon"><Check size={14} /></span>}
                  <span className="mobileEditor__designName">{design.name}</span>
                  {!available && <Lock size={12} className="mobileEditor__lockIcon" />}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mobileEditor">
      <div className="mobileEditor__header">
        <h2>
          <Smartphone size={24} />
          Vista Móvil
        </h2>
        <p className="mobileEditor__subtitle">
          Personaliza cómo se ve tu tienda en dispositivos móviles
        </p>
      </div>

      <div className="mobileEditor__content">
        {/* Panel de Edición */}
        <div className="mobileEditor__panel">
          {/* Header Section */}
          <div className={`mobileEditor__section ${expandedSection === 'header' ? 'expanded' : ''}`}>
            <button 
              type="button" 
              className="mobileEditor__sectionHeader"
              onClick={() => toggleSection('header')}
            >
              <div className="mobileEditor__sectionTitle">
                <Image size={18} />
                <span>Diseño del Header</span>
              </div>
              {expandedSection === 'header' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {expandedSection === 'header' && (
              <div className="mobileEditor__sectionBody">
                {renderDesignSelector(MOBILE_HEADER_DESIGNS, headerDesign, setHeaderDesign, 'Header')}
                <p className="mobileEditor__currentDesc">
                  {MOBILE_HEADER_DESIGNS[headerDesign]?.description}
                </p>
              </div>
            )}
          </div>

          {/* Cards Section */}
          <div className={`mobileEditor__section ${expandedSection === 'cards' ? 'expanded' : ''}`}>
            <button 
              type="button" 
              className="mobileEditor__sectionHeader"
              onClick={() => toggleSection('cards')}
            >
              <div className="mobileEditor__sectionTitle">
                <Grid3X3 size={18} />
                <span>Diseño de Productos</span>
              </div>
              {expandedSection === 'cards' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {expandedSection === 'cards' && (
              <div className="mobileEditor__sectionBody">
                {renderDesignSelector(MOBILE_CARD_DESIGNS, cardDesign, setCardDesign, 'Cards')}
                <p className="mobileEditor__currentDesc">
                  {MOBILE_CARD_DESIGNS[cardDesign]?.description}
                </p>
              </div>
            )}
          </div>

          {/* Spacing Section */}
          <div className={`mobileEditor__section ${expandedSection === 'spacing' ? 'expanded' : ''}`}>
            <button 
              type="button" 
              className="mobileEditor__sectionHeader"
              onClick={() => toggleSection('spacing')}
            >
              <div className="mobileEditor__sectionTitle">
                <Maximize2 size={18} />
                <span>Espaciado</span>
              </div>
              {expandedSection === 'spacing' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {expandedSection === 'spacing' && (
              <div className="mobileEditor__sectionBody">
                {renderDesignSelector(MOBILE_SPACING_OPTIONS, spacingOption, setSpacingOption, 'Spacing')}
                <p className="mobileEditor__currentDesc">
                  {MOBILE_SPACING_OPTIONS[spacingOption]?.description}
                </p>
              </div>
            )}
          </div>

          {/* Typography Section */}
          <div className={`mobileEditor__section ${expandedSection === 'typography' ? 'expanded' : ''}`}>
            <button 
              type="button" 
              className="mobileEditor__sectionHeader"
              onClick={() => toggleSection('typography')}
            >
              <div className="mobileEditor__sectionTitle">
                <Type size={18} />
                <span>Tipografía</span>
              </div>
              {expandedSection === 'typography' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {expandedSection === 'typography' && (
              <div className="mobileEditor__sectionBody">
                {renderDesignSelector(MOBILE_TYPOGRAPHY_OPTIONS, typographyOption, setTypographyOption, 'Typography')}
                <p className="mobileEditor__currentDesc">
                  {MOBILE_TYPOGRAPHY_OPTIONS[typographyOption]?.description}
                </p>
              </div>
            )}
          </div>

          {/* Carousel Elements Section */}
          <div className={`mobileEditor__section ${expandedSection === 'carousel' ? 'expanded' : ''}`}>
            <button 
              type="button" 
              className="mobileEditor__sectionHeader"
              onClick={() => toggleSection('carousel')}
            >
              <div className="mobileEditor__sectionTitle">
                <LayoutList size={18} />
                <span>Elementos del Carrusel</span>
              </div>
              {expandedSection === 'carousel' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {expandedSection === 'carousel' && (
              <div className="mobileEditor__sectionBody">
                <p className="mobileEditor__sectionDesc">
                  Elige qué elementos mostrar en el carrusel del header en móvil
                </p>
                <div className="mobileEditor__toggleGroup">
                  <label className="mobileEditor__toggle">
                    <input 
                      type="checkbox" 
                      checked={carouselOptions.showTitle} 
                      onChange={(e) => setCarouselOptions(prev => ({ ...prev, showTitle: e.target.checked }))}
                    />
                    <span className="mobileEditor__toggleSlider"></span>
                    <span className="mobileEditor__toggleLabel">
                      <Eye size={14} />
                      Mostrar título
                    </span>
                  </label>
                  <label className="mobileEditor__toggle">
                    <input 
                      type="checkbox" 
                      checked={carouselOptions.showSubtitle} 
                      onChange={(e) => setCarouselOptions(prev => ({ ...prev, showSubtitle: e.target.checked }))}
                    />
                    <span className="mobileEditor__toggleSlider"></span>
                    <span className="mobileEditor__toggleLabel">
                      <Eye size={14} />
                      Mostrar subtítulo
                    </span>
                  </label>
                  <label className="mobileEditor__toggle">
                    <input 
                      type="checkbox" 
                      checked={carouselOptions.showCta} 
                      onChange={(e) => setCarouselOptions(prev => ({ ...prev, showCta: e.target.checked }))}
                    />
                    <span className="mobileEditor__toggleSlider"></span>
                    <span className="mobileEditor__toggleLabel">
                      <Eye size={14} />
                      Mostrar botón de acción
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          {hasChanges && (
            <div className="mobileEditor__actions">
              <Button variant="secondary" onClick={handleDiscard} disabled={saving}>
                <RotateCcw size={16} />
                Descartar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                <Save size={16} />
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </div>
          )}
        </div>

        {/* Preview del móvil */}
        <div className="mobileEditor__preview">
          <div className="mobileEditor__previewHeader">
            <Smartphone size={16} />
            <span>Vista previa</span>
          </div>
          <div className="mobileEditor__phoneFrame">
            <div className="mobileEditor__phoneNotch"></div>
            <div className="mobileEditor__phoneScreen">
              {/* Header preview */}
              <MobileHeaderPreview 
                design={headerDesign}
                tenantName={tenantName}
                tenantLogo={tenantLogo}
              />
              
              {/* Products preview */}
              <MobileCardsPreview 
                design={cardDesign}
                spacing={MOBILE_SPACING_OPTIONS[spacingOption]?.values}
                typography={MOBILE_TYPOGRAPHY_OPTIONS[typographyOption]?.values}
              />
            </div>
            <div className="mobileEditor__phoneHomeBar"></div>
          </div>
          
          {/* Link to store */}
          {tenantSlug && (
            <a 
              href={`/store/${tenantSlug}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="mobileEditor__openStore"
            >
              <Eye size={14} />
              Ver tienda en nueva pestaña
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// SUBCOMPONENTES DE PREVIEW
// ============================================

function MobileHeaderPreview({ design, tenantName, tenantLogo }) {
  const config = MOBILE_HEADER_DESIGNS[design] || MOBILE_HEADER_DESIGNS.centered
  
  return (
    <div 
      className={`mobilePreview__header mobilePreview__header--${design}`}
      style={{ height: config.preview?.height || '150px' }}
    >
      <div className="mobilePreview__headerOverlay"></div>
      <div className="mobilePreview__headerContent">
        {tenantLogo ? (
          <img 
            src={tenantLogo} 
            alt={tenantName} 
            className="mobilePreview__logo"
            style={{ 
              width: config.preview?.logoSize || '50px',
              height: config.preview?.logoSize || '50px',
            }}
          />
        ) : (
          <div 
            className="mobilePreview__logoPlaceholder"
            style={{ 
              width: config.preview?.logoSize || '50px',
              height: config.preview?.logoSize || '50px',
            }}
          >
            🍔
          </div>
        )}
        <span className="mobilePreview__storeName">{tenantName}</span>
      </div>
    </div>
  )
}

function MobileCardsPreview({ design, spacing, typography }) {
  const config = MOBILE_CARD_DESIGNS[design] || MOBILE_CARD_DESIGNS.stackedFull
  
  // Mock products for preview
  const mockProducts = [
    { id: 1, name: 'Hamburguesa Clásica', price: 1200, image: null },
    { id: 2, name: 'Pizza Margherita', price: 1800, image: null },
    { id: 3, name: 'Papas Fritas', price: 600, image: null },
    { id: 4, name: 'Ensalada César', price: 950, image: null },
  ]
  
  const gridStyle = {
    gap: spacing?.gap || '12px',
    padding: spacing?.padding || '16px',
  }
  
  const cardStyle = {
    borderRadius: spacing?.cardRadius || '12px',
  }
  
  return (
    <div 
      className={`mobilePreview__cards mobilePreview__cards--${design}`}
      style={gridStyle}
    >
      {mockProducts.slice(0, config.preview?.carousel ? 2 : 4).map(product => (
        <div 
          key={product.id} 
          className="mobilePreview__card"
          style={cardStyle}
        >
          <div 
            className="mobilePreview__cardImage"
            style={{ 
              paddingTop: config.preview?.imageRatio || '50%',
            }}
          >
            <div className="mobilePreview__cardImagePlaceholder">📷</div>
          </div>
          <div className="mobilePreview__cardBody">
            <span 
              className="mobilePreview__cardTitle"
              style={{ 
                fontSize: typography?.titleSize || '14px',
                fontWeight: typography?.titleWeight || '600',
              }}
            >
              {product.name}
            </span>
            <span 
              className="mobilePreview__cardPrice"
              style={{ fontSize: typography?.priceSize || '16px' }}
            >
              ${product.price}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

export { 
  MOBILE_HEADER_DESIGNS, 
  MOBILE_CARD_DESIGNS, 
  MOBILE_SPACING_OPTIONS, 
  MOBILE_TYPOGRAPHY_OPTIONS 
}
