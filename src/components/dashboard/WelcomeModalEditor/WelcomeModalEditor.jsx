import { useState, useEffect, useRef } from 'react'
import './WelcomeModalEditor.css'
import Button from '../../ui/Button/Button'
import Input from '../../ui/Input/Input'
import ImageUploaderWithEditor from '../../ui/ImageUploaderWithEditor/ImageUploaderWithEditor'
import { 
  Eye, EyeOff, Upload, X, Image, Clock, Star, MapPin, 
  Sparkles, Zap, Heart, Coffee, Truck, Shield, Award, Gift,
  Crown, Lock, CheckCircle, ArrowRight, Link2, Crop
} from 'lucide-react'
import { SUBSCRIPTION_TIERS, TIER_LABELS, TIER_COLORS } from '../../../shared/subscriptions'

// Definir los diseños de features disponibles
const FEATURE_DESIGNS = {
  // Diseños Premium
  pills: {
    id: 'pills',
    name: 'Pastillas',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Badges compactos con iconos',
  },
  cards: {
    id: 'cards',
    name: 'Tarjetas',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Tarjetas con fondo destacado',
  },
  minimal: {
    id: 'minimal',
    name: 'Minimalista',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Solo iconos con texto debajo',
  },
  gradient: {
    id: 'gradient',
    name: 'Gradiente',
    tier: SUBSCRIPTION_TIERS.PREMIUM,
    description: 'Badges con gradiente de color',
  },
  // Diseños Premium Pro
  glassmorphism: {
    id: 'glassmorphism',
    name: 'Cristal',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Efecto de vidrio esmerilado',
  },
  neon: {
    id: 'neon',
    name: 'Neón',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Efecto de luz neón brillante',
  },
  outlined: {
    id: 'outlined',
    name: 'Contorno',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Solo bordes sin fondo',
  },
  floating: {
    id: 'floating',
    name: 'Flotante',
    tier: SUBSCRIPTION_TIERS.PREMIUM_PRO,
    description: 'Efecto 3D con sombra flotante',
  },
}

// Iconos disponibles para features
const AVAILABLE_ICONS = {
  clock: { icon: Clock, label: 'Reloj' },
  star: { icon: Star, label: 'Estrella' },
  mapPin: { icon: MapPin, label: 'Ubicación' },
  sparkles: { icon: Sparkles, label: 'Brillos' },
  zap: { icon: Zap, label: 'Rayo' },
  heart: { icon: Heart, label: 'Corazón' },
  coffee: { icon: Coffee, label: 'Café' },
  truck: { icon: Truck, label: 'Delivery' },
  shield: { icon: Shield, label: 'Escudo' },
  award: { icon: Award, label: 'Premio' },
  gift: { icon: Gift, label: 'Regalo' },
  checkCircle: { icon: CheckCircle, label: 'Check' },
}

// Features por defecto
const DEFAULT_FEATURES = [
  { id: '1', icon: 'clock', text: 'Pedidos rápidos' },
  { id: '2', icon: 'star', text: 'Calidad premium' },
  { id: '3', icon: 'mapPin', text: 'Delivery disponible' },
]

export default function WelcomeModalEditor({
  tenantName = '',
  tenantLogo = '',
  tenantSlogan = '',
  heroImage = '',
  welcomeModalEnabled = true,
  welcomeModalTitle = '',
  welcomeModalMessage = '',
  welcomeModalImage = '',
  welcomeModalImageFocalPoint = null,
  welcomeModalFeatures = null,
  welcomeModalFeaturesDesign = 'pills',
  currentTier = SUBSCRIPTION_TIERS.FREE,
  onEnabledChange,
  onTitleChange,
  onMessageChange,
  onImageChange,
  onFocalPointChange,
  onImageUpload,
  onFeaturesChange,
  onFeaturesDesignChange,
  uploadingImage = false,
}) {
  // Estado local para features
  const [features, setFeatures] = useState(welcomeModalFeatures || DEFAULT_FEATURES)
  const [selectedDesign, setSelectedDesign] = useState(welcomeModalFeaturesDesign || 'pills')
  const [editingFeature, setEditingFeature] = useState(null)
  const welcomeUploaderRef = useRef(null)

  // Sincronizar features cuando cambian externamente
  useEffect(() => {
    if (welcomeModalFeatures) {
      setFeatures(welcomeModalFeatures)
    }
  }, [welcomeModalFeatures])

  useEffect(() => {
    if (welcomeModalFeaturesDesign) {
      setSelectedDesign(welcomeModalFeaturesDesign)
    }
  }, [welcomeModalFeaturesDesign])

  // Handlers
  const handleAddFeature = () => {
    const newFeature = {
      id: Date.now().toString(),
      icon: 'star',
      text: 'Nuevo beneficio',
    }
    const newFeatures = [...features, newFeature]
    setFeatures(newFeatures)
    onFeaturesChange?.(newFeatures)
    setEditingFeature(newFeature.id)
  }

  const handleUpdateFeature = (id, updates) => {
    const newFeatures = features.map(f => 
      f.id === id ? { ...f, ...updates } : f
    )
    setFeatures(newFeatures)
    onFeaturesChange?.(newFeatures)
  }

  const handleRemoveFeature = (id) => {
    const newFeatures = features.filter(f => f.id !== id)
    setFeatures(newFeatures)
    onFeaturesChange?.(newFeatures)
  }

  const handleDesignChange = (designId) => {
    setSelectedDesign(designId)
    onFeaturesDesignChange?.(designId)
  }

  // Image handler – convierte el File a data URL para mantener el flujo existente
  const handleImageReady = (file, focalPoint) => {
    // Siempre actualizar el focal point si se proporciona
    if (focalPoint) {
      onFocalPointChange?.(focalPoint)
    }
    
    if (!file) return // Solo ajuste de encuadre, sin archivo nuevo
    const reader = new FileReader()
    reader.onload = () => {
      onImageChange?.(reader.result)
    }
    reader.readAsDataURL(file)
  }

  // Todos los diseños disponibles para todos los vendedores
  const isDesignAvailable = () => {
    return true
  }

  // Datos para el preview
  const previewData = {
    name: tenantName || 'Mi Tienda',
    logo: tenantLogo,
    slogan: tenantSlogan,
    heroImage: welcomeModalImage || heroImage,
    heroImageFocalPoint: welcomeModalImageFocalPoint,
    title: welcomeModalTitle || '¡Bienvenido!',
    message: welcomeModalMessage || 'Explora nuestro menú y realiza tu pedido.',
    features,
    featuresDesign: selectedDesign,
  }

  return (
    <div className="welcomeEditor">
      {/* Panel de Edición */}
      <div className="welcomeEditor__panel">
        <div className="welcomeEditor__panelHeader">
          <h3>Configuración</h3>
        </div>

        {/* Toggle Habilitado */}
        <div className="welcomeEditor__field">
          <label className="welcomeEditor__switchLabel">
            <input
              type="checkbox"
              checked={welcomeModalEnabled}
              onChange={(e) => onEnabledChange?.(e.target.checked)}
            />
            <span className="welcomeEditor__switchSlider"></span>
            <span>Mostrar saludo de bienvenida</span>
          </label>
        </div>

        {welcomeModalEnabled && (
          <>
            {/* Título */}
            <div className="welcomeEditor__field">
              <label className="welcomeEditor__label">Título</label>
              <Input
                value={welcomeModalTitle}
                onChange={onTitleChange}
                placeholder="¡Bienvenido!"
              />
            </div>

            {/* Mensaje */}
            <div className="welcomeEditor__field">
              <label className="welcomeEditor__label">Mensaje</label>
              <textarea
                className="welcomeEditor__textarea"
                value={welcomeModalMessage ?? ''}
                onChange={(e) => onMessageChange?.(e.target.value)}
                placeholder="Explora nuestro menú y realiza tu pedido."
                rows={3}
              />
            </div>

            {/* Imagen */}
            <div className="welcomeEditor__field">
              <label className="welcomeEditor__label">
                <Image size={16} />
                Imagen de fondo
              </label>
              <div className="welcomeEditor__imageUpload">
                {welcomeModalImage ? (
                  <div className="welcomeEditor__imagePreview">
                    <img 
                      src={welcomeModalImage} 
                      alt="Preview"
                      style={welcomeModalImageFocalPoint ? {
                        objectFit: 'cover',
                        objectPosition: `${welcomeModalImageFocalPoint.x}% ${welcomeModalImageFocalPoint.y}%`
                      } : undefined}
                    />
                    <button 
                      className="welcomeEditor__imageRemove"
                      onClick={() => onImageChange?.('')}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="welcomeEditor__imagePlaceholder">
                    <Image size={24} />
                  </div>
                )}
                <div className="welcomeEditor__imageActions">
                  {welcomeModalImage && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => welcomeUploaderRef.current?.openEditor(welcomeModalImage)}
                      disabled={uploadingImage}
                    >
                      <Crop size={14} />
                      Editar
                    </Button>
                  )}
                  <ImageUploaderWithEditor
                    ref={welcomeUploaderRef}
                    aspect={16 / 9}
                    modalTitle="Ajustar imagen de fondo"
                    disabled={uploadingImage}
                    onImageReady={(file, focalPoint) => handleImageReady(file, focalPoint)}
                  >
                    <Button 
                      variant="secondary" 
                      size="sm"
                      disabled={uploadingImage}
                    >
                      <Upload size={14} />
                      {uploadingImage ? 'Subiendo...' : 'Subir'}
                    </Button>
                  </ImageUploaderWithEditor>
                </div>
              </div>
            </div>

            {/* Separador */}
            <div className="welcomeEditor__divider" />

            {/* Features - Solo para Premium+ */}
            <div className="welcomeEditor__featuresSection">
              <div className="welcomeEditor__sectionHeader">
                <h4>
                  <Sparkles size={16} />
                  Beneficios destacados
                </h4>
                {currentTier === SUBSCRIPTION_TIERS.FREE && (
                  <span className="welcomeEditor__premiumBadge">
                    <Crown size={12} />
                    Premium
                  </span>
                )}
              </div>

              {(
                <>
                  {/* Lista de features editables */}
                  <div className="welcomeEditor__featuresList">
                    {features.map((feature, index) => (
                      <div key={feature.id} className="welcomeEditor__featureItem">
                        <div className="welcomeEditor__featureNumber">{index + 1}</div>
                        
                        {/* Selector de icono */}
                        <div className="welcomeEditor__featureIconSelect">
                          <select
                            value={feature.icon}
                            onChange={(e) => handleUpdateFeature(feature.id, { icon: e.target.value })}
                          >
                            {Object.entries(AVAILABLE_ICONS).map(([key, { label }]) => (
                              <option key={key} value={key}>{label}</option>
                            ))}
                          </select>
                          {(() => {
                            const IconComponent = AVAILABLE_ICONS[feature.icon]?.icon || Star
                            return <IconComponent size={16} className="welcomeEditor__featureIconPreview" />
                          })()}
                        </div>

                        {/* Texto */}
                        <input
                          type="text"
                          className="welcomeEditor__featureText"
                          value={feature.text ?? ''}
                          onChange={(e) => handleUpdateFeature(feature.id, { text: e.target.value })}
                          placeholder="Texto del beneficio"
                        />

                        {/* Eliminar */}
                        <button
                          className="welcomeEditor__featureRemove"
                          onClick={() => handleRemoveFeature(feature.id)}
                          disabled={features.length <= 1}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Agregar feature */}
                  {features.length < 5 && (
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      onClick={handleAddFeature}
                      className="welcomeEditor__addFeature"
                    >
                      + Agregar beneficio
                    </Button>
                  )}

                  {/* Separador */}
                  <div className="welcomeEditor__divider" />

                  {/* Selector de diseño */}
                  <div className="welcomeEditor__designSection">
                    <h4>Estilo de los beneficios</h4>
                    
                    {/* Diseños Premium */}
                    <div className="welcomeEditor__designGroup">
                      <span className="welcomeEditor__designGroupLabel">
                        <Crown size={12} style={{ color: TIER_COLORS[SUBSCRIPTION_TIERS.PREMIUM] }} />
                        Premium
                      </span>
                      <div className="welcomeEditor__designGrid">
                        {Object.values(FEATURE_DESIGNS)
                          .filter(d => d.tier === SUBSCRIPTION_TIERS.PREMIUM)
                          .map(design => (
                            <button
                              key={design.id}
                              className={`welcomeEditor__designOption ${selectedDesign === design.id ? 'welcomeEditor__designOption--active' : ''} ${!isDesignAvailable(design) ? 'welcomeEditor__designOption--locked' : ''}`}
                              onClick={() => isDesignAvailable(design) && handleDesignChange(design.id)}
                              disabled={!isDesignAvailable(design)}
                            >
                              <span className="welcomeEditor__designName">{design.name}</span>
                              {!isDesignAvailable(design) && <Lock size={12} />}
                            </button>
                          ))
                        }
                      </div>
                    </div>

                    {/* Diseños Premium Pro */}
                    <div className="welcomeEditor__designGroup">
                      <span className="welcomeEditor__designGroupLabel">
                        <Crown size={12} style={{ color: TIER_COLORS[SUBSCRIPTION_TIERS.PREMIUM_PRO] }} />
                        Premium Pro
                      </span>
                      <div className="welcomeEditor__designGrid">
                        {Object.values(FEATURE_DESIGNS)
                          .filter(d => d.tier === SUBSCRIPTION_TIERS.PREMIUM_PRO)
                          .map(design => (
                            <button
                              key={design.id}
                              className={`welcomeEditor__designOption ${selectedDesign === design.id ? 'welcomeEditor__designOption--active' : ''} ${!isDesignAvailable(design) ? 'welcomeEditor__designOption--locked' : ''}`}
                              onClick={() => isDesignAvailable(design) && handleDesignChange(design.id)}
                              disabled={!isDesignAvailable(design)}
                            >
                              <span className="welcomeEditor__designName">{design.name}</span>
                              {!isDesignAvailable(design) && <Lock size={12} />}
                            </button>
                          ))
                        }
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Panel de Preview */}
      <div className="welcomeEditor__preview">
        <div className="welcomeEditor__previewHeader">
          <Eye size={16} />
          <span>Vista previa</span>
        </div>
        
        <div className="welcomeEditor__previewContainer">
          {welcomeModalEnabled ? (
            <WelcomeModalPreview data={previewData} />
          ) : (
            <div className="welcomeEditor__previewDisabled">
              <EyeOff size={32} />
              <p>El modal de bienvenida está desactivado</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Componente de Preview del Modal
function WelcomeModalPreview({ data }) {
  const { name, logo, slogan, heroImage, title, message, features, featuresDesign } = data

  // Renderizar los features según el diseño
  const renderFeatures = () => {
    if (!features || features.length === 0) return null

    return (
      <div className={`welcomePreview__features welcomePreview__features--${featuresDesign}`}>
        {features.map((feature) => {
          const IconComponent = AVAILABLE_ICONS[feature.icon]?.icon || Star
          return (
            <div key={feature.id} className="welcomePreview__feature">
              <div className="welcomePreview__featureIcon">
                <IconComponent size={16} />
              </div>
              <span>{feature.text}</span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="welcomePreview">
      {/* Hero */}
      <div className="welcomePreview__hero">
        <div className="welcomePreview__heroBg">
          {heroImage ? (
            <img src={heroImage} alt="" />
          ) : (
            <div className="welcomePreview__heroGradient" />
          )}
          <div className="welcomePreview__heroOverlay" />
        </div>
        <div className="welcomePreview__heroContent">
          {logo && (
            <div className="welcomePreview__logo">
              <img src={logo} alt={name} />
            </div>
          )}
          <h3 className="welcomePreview__storeName">{name}</h3>
          {slogan && <p className="welcomePreview__slogan">{slogan}</p>}
        </div>
      </div>

      {/* Body */}
      <div className="welcomePreview__body">
        <h4 className="welcomePreview__title">{title}</h4>
        <p className="welcomePreview__message">{message}</p>
        
        {renderFeatures()}

        <button className="welcomePreview__cta">
          Ver menú
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}

export { FEATURE_DESIGNS, AVAILABLE_ICONS, DEFAULT_FEATURES }
