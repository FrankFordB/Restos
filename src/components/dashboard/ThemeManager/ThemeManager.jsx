import { useEffect, useState, useMemo } from 'react'
import './ThemeManager.css'
import Card from '../../ui/Card/Card'
import Button from '../../ui/Button/Button'
import { useAppDispatch, useAppSelector } from '../../../app/hooks'
import { fetchTenantTheme, saveTenantTheme, selectThemeForTenant } from '../../../features/theme/themeSlice'
import {
  FONTS,
  BUTTON_STYLES,
  LAYOUT_STYLES,
  COLOR_PALETTES,
  SUBSCRIPTION_TIERS,
  getTierLevel,
  loadGoogleFont,
} from '../../../shared/subscriptions'
import { ChevronDown, ChevronUp, Palette, AlertTriangle, Sparkles, Eye, Type, Star, Crown, Lock } from 'lucide-react'

export default function ThemeManager({ tenantId, subscriptionTier = SUBSCRIPTION_TIERS.FREE }) {
  const dispatch = useAppDispatch()
  const savedTheme = useAppSelector(selectThemeForTenant(tenantId))
  
  // Estado local para preview en tiempo real
  const [localTheme, setLocalTheme] = useState(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Accordion state - only one section open at a time
  const [openSection, setOpenSection] = useState('colors') // 'colors' | 'typography' | 'styles' | null
  
  const toggleSection = (section) => {
    setOpenSection(prev => prev === section ? null : section)
  }

  // Filtrar opciones según el tier del usuario
  const userTierLevel = getTierLevel(subscriptionTier)
  
  const filterByTier = (items) => {
    return Object.entries(items).reduce((acc, [key, config]) => {
      const itemTierLevel = getTierLevel(config.tier)
      acc[key] = {
        ...config,
        locked: itemTierLevel > userTierLevel,
      }
      return acc
    }, {})
  }
  
  const availableFonts = useMemo(() => filterByTier(FONTS), [subscriptionTier])
  const availableButtonStyles = useMemo(() => filterByTier(BUTTON_STYLES), [subscriptionTier])
  const availableLayoutStyles = useMemo(() => filterByTier(LAYOUT_STYLES), [subscriptionTier])

  // Sincronizar con el tema guardado cuando cambia
  useEffect(() => {
    if (savedTheme && !localTheme) {
      setLocalTheme(savedTheme)
    }
  }, [savedTheme, localTheme])

  useEffect(() => {
    dispatch(fetchTenantTheme(tenantId))
  }, [dispatch, tenantId])

  // Tema a mostrar (local para preview, o guardado como fallback)
  const theme = useMemo(() => localTheme || savedTheme || {
    primary: '#0f172a',
    accent: '#f97316',
    background: '#fafbfc',
    text: '#0f172a',
    radius: '16px',
    fontFamily: 'Inter',
    cardStyle: 'glass',
    buttonStyle: 'rounded',
    layoutStyle: 'modern',
    productCardLayout: 'classic',
  }, [localTheme, savedTheme])

  // Actualizar estado local (preview inmediato)
  const updateLocal = (patch) => {
    // Si se cambia la fuente, cargarla dinámicamente
    if (patch.fontFamily) {
      loadGoogleFont(patch.fontFamily)
    }
    const newTheme = { ...theme, ...patch }
    setLocalTheme(newTheme)
    setHasChanges(true)
  }
  
  // Cargar la fuente actual al montar
  useEffect(() => {
    if (theme.fontFamily) {
      loadGoogleFont(theme.fontFamily)
    }
  }, [theme.fontFamily])

  // Guardar en la base de datos
  const saveChanges = async () => {
    setSaving(true)
    try {
      await dispatch(saveTenantTheme({ tenantId, theme: localTheme }))
      setHasChanges(false)
    } finally {
      setSaving(false)
    }
  }

  // Descartar cambios
  const discardChanges = () => {
    setLocalTheme(savedTheme)
    setHasChanges(false)
  }

  // Reset a valores por defecto
  const resetToDefaults = () => {
    const defaults = {
      primary: '#0f172a',
      accent: '#f97316',
      background: '#fafbfc',
      text: '#0f172a',
      radius: '16px',
      fontFamily: 'Inter',
      cardStyle: 'glass',
      buttonStyle: 'rounded',
      layoutStyle: 'modern',
      productCardLayout: 'classic',
    }
    setLocalTheme(defaults)
    setHasChanges(true)
  }

  const renderTierBadge = (tier, locked = false) => {
    if (tier === SUBSCRIPTION_TIERS.FREE) return null
    return (
      <span className={`tierBadge tierBadge--${tier} ${locked ? 'tierBadge--locked' : ''}`}>
        {locked ? <Lock size={10} /> : tier === SUBSCRIPTION_TIERS.PREMIUM ? <Star size={10} /> : <Crown size={10} />}
        <span className="tierBadge__text">{tier}</span>
      </span>
    )
  }

  return (
    
    <Card
      title={<><Palette size={18} style={{display: 'inline', verticalAlign: 'middle', marginRight: '6px'}} /> Diseño y Personalización</>}
      actions={
        <div className="theme__actions">
          {hasChanges && (
            <>
              <Button variant="secondary" size="sm" onClick={discardChanges} disabled={saving}>
                Descartar
              </Button>
              <Button variant="primary" size="sm" onClick={saveChanges} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </Button>
            </>
          )}
          <Button variant="secondary" size="sm" onClick={resetToDefaults}>
            Reset
          </Button>
        </div>
      }
    >
      {hasChanges && (
        
        <div className="theme__unsavedBanner">
          <AlertTriangle size={16} /> Tienes cambios sin guardar
        </div>
      )}
      <div className='Me'>
      <div className="theme">
        {/* PALETAS DE COLORES PREDISEÑADAS */}
        <div className="theme__accordion">
          <button 
            className={`theme__accordionHeader ${openSection === 'colors' ? 'expanded' : ''}`}
            onClick={() => toggleSection('colors')}
            type="button"
          >
            <span><Palette size={16} style={{marginRight: '6px'}} /> Paleta de Colores</span>
            {openSection === 'colors' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {openSection === 'colors' && (
            <div className="theme__accordionContent">
              <p className="theme__sectionDesc">Selecciona una paleta prediseñada o personaliza los colores manualmente</p>
              
              <div className="theme__palettesGrid">
                {Object.entries(COLOR_PALETTES).map(([key, palette]) => {
                  const isSelected = theme.primary === palette.colors.primary && 
                                    theme.accent === palette.colors.accent &&
                                    theme.background === palette.colors.background
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`theme__paletteItem ${isSelected ? 'theme__paletteItem--selected' : ''}`}
                      onClick={() => updateLocal(palette.colors)}
                      title={palette.label}
                    >
                      <div className="theme__paletteColors">
                        {palette.preview.map((color, i) => (
                          <div 
                            key={i} 
                            className="theme__paletteColor" 
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <span className="theme__paletteName">
                        {palette.label}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* COLORES MANUALES */}
              <div className="theme__sectionTitle" style={{ marginTop: '16px' }}>Colores Personalizados</div>
              
              <div className="theme__colorGroup">
                <div className="theme__colorItem">
                  <input
                    type="color"
                    className="theme__colorInput"
                    value={theme.primary}
                    onChange={(e) => updateLocal({ primary: e.target.value })}
                  />
                  <span className="theme__colorLabel">Primario</span>
                </div>
                <div className="theme__colorItem">
                  <input
                    type="color"
                    className="theme__colorInput"
                    value={theme.accent}
                    onChange={(e) => updateLocal({ accent: e.target.value })}
                  />
                  <span className="theme__colorLabel">Acento</span>
                </div>
                <div className="theme__colorItem">
                  <input
                    type="color"
                    className="theme__colorInput"
                    value={theme.background}
                    onChange={(e) => updateLocal({ background: e.target.value })}
                  />
                  <span className="theme__colorLabel">Fondo</span>
                </div>
                <div className="theme__colorItem">
                  <input
                    type="color"
                    className="theme__colorInput"
                    value={theme.text}
                    onChange={(e) => updateLocal({ text: e.target.value })}
                  />
                  <span className="theme__colorLabel">Texto</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* TIPOGRAFÍA */}
        <div className="theme__accordion">
          <button 
            className={`theme__accordionHeader ${openSection === 'typography' ? 'expanded' : ''}`}
            onClick={() => toggleSection('typography')}
            type="button"
          >
            <span><Type size={16} style={{marginRight: '6px'}} /> Tipografía</span>
            {openSection === 'typography' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {openSection === 'typography' && (
            <div className="theme__accordionContent">
              <label className="theme__row">
                <span className="theme__label">Fuente principal</span>
                <select
                  className="theme__select"
                  value={theme.fontFamily || 'Inter'}
                  onChange={(e) => updateLocal({ fontFamily: e.target.value })}
                >
                  {Object.entries(availableFonts).map(([font, config]) => {
                    return (
                      <option 
                        key={font} 
                        value={font}
                        disabled={config.locked}
                        style={{ fontFamily: config.family }}
                      >
                        {config.label} {config.locked ? '🔒' : config.tier !== SUBSCRIPTION_TIERS.FREE ? `(${config.tier})` : ''}
                      </option>
                    )
                  })}
                </select>
              </label>

              <label className="theme__row">
                <span className="theme__label">Border radius</span>
                <input
                  className="theme__radius"
                  value={theme.radius}
                  onChange={(e) => updateLocal({ radius: e.target.value })}
                  placeholder="16px"
                />
              </label>
            </div>
          )}
        </div>

        {/* ESTILOS */}
        <div className="theme__accordion">
          <button 
            className={`theme__accordionHeader ${openSection === 'styles' ? 'expanded' : ''}`}
            onClick={() => toggleSection('styles')}
            type="button"
          >
            <span><Sparkles size={16} style={{marginRight: '6px'}} /> Estilos</span>
            {openSection === 'styles' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {openSection === 'styles' && (
            <div className="theme__accordionContent">
              <label className="theme__row">
                <span className="theme__label">Estilo de botones</span>
                <select
                  className="theme__select"
                  value={theme.buttonStyle || 'rounded'}
                  onChange={(e) => updateLocal({ buttonStyle: e.target.value })}
                >
                  {Object.entries(availableButtonStyles).map(([style, config]) => {
                    return (
                      <option 
                        key={style} 
                        value={style}
                        disabled={config.locked}
                      >
                        {config.label} {config.locked ? '🔒' : config.tier !== SUBSCRIPTION_TIERS.FREE ? `(${config.tier})` : ''}
                      </option>
                    )
                  })}
                </select>
              </label>

              <label className="theme__row">
                <span className="theme__label">Estilo de layout</span>
                <select
                  className="theme__select"
                  value={theme.layoutStyle || 'modern'}
                  onChange={(e) => updateLocal({ layoutStyle: e.target.value })}
                >
                  {Object.entries(availableLayoutStyles).map(([style, config]) => {
                    return (
                      <option 
                        key={style} 
                        value={style}
                        disabled={config.locked}
                        title={config.description}
                      >
                        {config.label} {config.locked ? '🔒' : config.tier !== SUBSCRIPTION_TIERS.FREE ? `(${config.tier})` : ''}
                      </option>
                    )
                  })}
                </select>
              </label>
              
              {/* Descripción del layout seleccionado */}
              {LAYOUT_STYLES[theme.layoutStyle]?.description && (
                <p className="theme__layoutDesc">
                  {LAYOUT_STYLES[theme.layoutStyle].description}
                </p>
              )}
            </div>
          )}
        </div>
</div>
    
<div className="theme__accordion2">
        {/* PREVIEW */}
        <div className="theme__section">
          <div className="theme__sectionTitle"><Eye size={16} style={{marginRight: '6px', marginLeft:'12px'}} /> Vista Previa</div>
          
          <div className="theme__previewBox">
            <div className="theme__previewTitle">Así se verá tu tienda</div>
            
            {/* Mini Header */}
            <div 
              className="theme__previewHeader"
              style={{
                background: theme.primary,
                fontFamily: FONTS[theme.fontFamily]?.family || 'Inter',
              }}
            >
              <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>Mi Tienda</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{ color: '#fff99', fontSize: '0.75rem' }}>Productos</span>
                <span style={{ color: '#fff99', fontSize: '0.75rem' }}>Contacto</span>
              </div>
            </div>
            
            {/* Mini Store Content - Aplica layout CSS */}
            <div
              className="theme__previewContent"
              style={{
                background: theme.background,
                fontFamily: FONTS[theme.fontFamily]?.family || 'Inter',
                padding: LAYOUT_STYLES[theme.layoutStyle]?.css?.padding || '20px',
              }}
            >
              {/* Product Cards Row - Aplica layout gap */}
              <div 
                className="theme__previewProducts"
                style={{
                  gap: LAYOUT_STYLES[theme.layoutStyle]?.css?.gap || '24px',
                }}
              >
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="theme__previewCard"
                    style={{
                      background: '#fff',
                      border: `1px solid ${theme.primary}15`,
                      borderRadius: theme.radius,
                    }}
                  >
                    <div 
                      className="theme__previewCardImg" 
                      style={{ background: `linear-gradient(135deg, ${theme.accent}40, ${theme.primary}20)` }}
                    />
                    <div className="theme__previewCardBody">
                      <span style={{ color: theme.text, fontWeight: 600, fontSize: '0.8rem' }}>
                        Producto {i}
                      </span>
                      <span style={{ color: `${theme.text}80`, fontSize: '0.7rem' }}>
                        Descripción breve
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                        <span style={{ color: theme.accent, fontWeight: 700, fontSize: '0.85rem' }}>$99.00</span>
                        <button
                          className="theme__previewBtn"
                          style={{
                            ...BUTTON_STYLES[theme.buttonStyle]?.css,
                            background: BUTTON_STYLES[theme.buttonStyle]?.css?.background || theme.accent,
                            color: BUTTON_STYLES[theme.buttonStyle]?.css?.color || '#fff',
                            '--accent': theme.accent,
                            '--primary': theme.primary,
                          }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Footer bar - Aplica button style */}
              <div 
                className="theme__previewFooter"
                style={{ 
                  background: theme.primary,
                  borderRadius: BUTTON_STYLES[theme.buttonStyle]?.css?.borderRadius || '10px',
                  ...BUTTON_STYLES[theme.buttonStyle]?.css?.boxShadow && {
                    boxShadow: BUTTON_STYLES[theme.buttonStyle].css.boxShadow.replace('var(--accent)', theme.accent)
                  },
                }}
              >
                <span style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 600 }}>Ver carrito (2)</span>
                <span style={{ color: '#fff', fontSize: '0.75rem' }}>$198.00</span>
              </div>
            </div>
          </div> 
        </div>

        <p className="theme__previewNote">
          Los cambios se aplican a tu tienda pública una vez guardado.
        </p>
      </div></div>
    </Card>
  )
}
