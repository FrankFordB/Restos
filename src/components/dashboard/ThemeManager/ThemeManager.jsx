import { useEffect, useState, useMemo } from 'react'
import './ThemeManager.css'
import Card from '../../ui/Card/Card'
import Button from '../../ui/Button/Button'
import { useAppDispatch, useAppSelector } from '../../../app/hooks'
import { fetchTenantTheme, saveTenantTheme, selectThemeForTenant } from '../../../features/theme/themeSlice'
import {
  SUBSCRIPTION_TIERS,
  TIER_LABELS,
  FONTS,
  CARD_STYLES,
  BUTTON_STYLES,
  LAYOUT_STYLES,
  PRODUCT_CARD_LAYOUTS,
  COLOR_PALETTES,
  isFeatureAvailable,
} from '../../../shared/subscriptions'
import { ChevronDown, ChevronUp, Star, Crown, Palette, AlertTriangle, Sparkles, Pencil, ImageIcon, Upload, Eye, Type } from 'lucide-react'

export default function ThemeManager({ tenantId, subscriptionTier = SUBSCRIPTION_TIERS.FREE, isSuperAdmin = false }) {
  const dispatch = useAppDispatch()
  const savedTheme = useAppSelector(selectThemeForTenant(tenantId))
  
  // Super admin can access all features
  const effectiveTier = isSuperAdmin ? SUBSCRIPTION_TIERS.PREMIUM_PRO : subscriptionTier
  
  // Estado local para preview en tiempo real
  const [localTheme, setLocalTheme] = useState(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Accordion state - only one section open at a time
  const [openSection, setOpenSection] = useState('colors') // 'colors' | 'typography' | 'styles' | null
  
  const toggleSection = (section) => {
    setOpenSection(prev => prev === section ? null : section)
  }

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
    const newTheme = { ...theme, ...patch }
    setLocalTheme(newTheme)
    setHasChanges(true)
  }

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

  const renderTierBadge = (tier) => {
    if (tier === SUBSCRIPTION_TIERS.FREE) return null
    return (
      <span className={`tierBadge tierBadge--${tier}`} style={{ marginLeft: '8px', fontSize: '0.7rem' }}>
        {tier === SUBSCRIPTION_TIERS.PREMIUM ? <Star size={12} /> : <Crown size={12} />}
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
                  const available = isFeatureAvailable(palette.tier, effectiveTier)
                  const isSelected = theme.primary === palette.colors.primary && 
                                    theme.accent === palette.colors.accent &&
                                    theme.background === palette.colors.background
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`theme__paletteItem ${isSelected ? 'theme__paletteItem--selected' : ''} ${!available ? 'theme__paletteItem--locked' : ''}`}
                      onClick={() => available && updateLocal(palette.colors)}
                      disabled={!available}
                      title={available ? palette.label : `Requiere ${TIER_LABELS[palette.tier]}`}
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
                        {!available && (
                          <span className="theme__paletteTier">
                            {palette.tier === SUBSCRIPTION_TIERS.PREMIUM ? <Star size={12} /> : <Crown size={12} />}
                          </span>
                        )}
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
                  {Object.entries(FONTS).map(([font, config]) => {
                    const available = isFeatureAvailable(config.tier, effectiveTier)
                    return (
                      <option key={font} value={font} disabled={!available}>
                        {config.label} {!available ? `(${TIER_LABELS[config.tier]})` : ''}
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
                <span className="theme__label">Estilo de cards</span>
                <select
                  className="theme__select"
                  value={theme.cardStyle || 'glass'}
                  onChange={(e) => updateLocal({ cardStyle: e.target.value })}
                >
                  {Object.entries(CARD_STYLES).map(([style, config]) => {
                    const available = isFeatureAvailable(config.tier, effectiveTier)
                    return (
                      <option key={style} value={style} disabled={!available}>
                        {config.label} {!available ? `(${TIER_LABELS[config.tier]})` : ''}
                      </option>
                    )
                  })}
                </select>
              </label>

              <label className="theme__row">
                <span className="theme__label">Estilo de botones</span>
                <select
                  className="theme__select"
                  value={theme.buttonStyle || 'rounded'}
                  onChange={(e) => updateLocal({ buttonStyle: e.target.value })}
                >
                  {Object.entries(BUTTON_STYLES).map(([style, config]) => {
                    const available = isFeatureAvailable(config.tier, effectiveTier)
                    return (
                      <option key={style} value={style} disabled={!available}>
                        {config.label} {!available ? `(${TIER_LABELS[config.tier]})` : ''}
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
                  {Object.entries(LAYOUT_STYLES).map(([style, config]) => {
                    const available = isFeatureAvailable(config.tier, effectiveTier)
                    return (
                      <option key={style} value={style} disabled={!available}>
                        {config.label} {!available ? `(${TIER_LABELS[config.tier]})` : ''}
                      </option>
                    )
                  })}
                </select>
              </label>
            </div>
          )}
        </div>

        {/* ENLACE A EDICIÓN DE CARDS */}
        <div className="theme__section">
          <div className="theme__sectionTitle"> Cards de Productos</div>
          <p className="theme__sectionDesc">Personaliza el diseño de las cards directamente en tu tienda</p>
          <a 
            href={`/store/${tenantId}`}
            className="theme__cardEditLink"
          >
            <Pencil size={14} style={{marginRight: '6px'}} /> Editar Cards de Productos aquí
          </a>
        </div>

        {/* LOGO E IMÁGENES */}
        <div className="theme__section">
          <div className="theme__sectionTitle"><ImageIcon size={16} style={{marginRight: '6px'}} /> Logo e Imágenes</div>
          
          <div className="theme__row">
            <span className="theme__label">Logo</span>
            {theme.logoUrl ? (
              <div className="theme__logoPreview">
                <img src={theme.logoUrl} alt="Logo" className="theme__logoImg" />
                <Button variant="secondary" size="sm" onClick={() => set({ logoUrl: null })}>
                  Cambiar
                </Button>
              </div>
            ) : (
              <div className="theme__uploadBox">
                <div className="theme__uploadIcon"><Upload size={20} /></div>
                <div className="theme__uploadText">Subir logo (PNG, JPG)</div>
              </div>
            )}
          </div>
        </div>

        {/* PREVIEW */}
        <div className="theme__section">
          <div className="theme__sectionTitle"><Eye size={16} style={{marginRight: '6px'}} /> Vista Previa</div>
          
          <div className="theme__previewBox">
            <div className="theme__previewTitle">Así se verá tu tienda</div>
            <div
              className="theme__previewCard"
              style={{
                background: theme.background,
                border: `1px solid ${theme.primary}20`,
              }}
            >
              <span style={{ color: theme.text, fontWeight: 700 }}>
                Nombre del Producto
              </span>
              <span style={{ color: `${theme.text}99`, fontSize: '0.85rem' }}>
                Descripción breve del producto
              </span>
              <button
                className="theme__previewBtn"
                style={{
                  background: theme.accent,
                  color: '#fff',
                  borderRadius: theme.radius,
                }}
              >
                Agregar al carrito
              </button>
            </div>
          </div>
        </div>

        <p className="muted">
          Los cambios se aplican automáticamente a tu tienda pública.
          {effectiveTier === SUBSCRIPTION_TIERS.FREE && (
            <span style={{ display: 'block', marginTop: '8px', color: '#8b5cf6' }}>
              <Star size={14} style={{display: 'inline', verticalAlign: 'middle', marginRight: '4px'}} /> Actualiza a Premium para acceder a más fuentes, estilos y opciones.
            </span>
          )}
        </p>
      </div>
    </Card>
  )
}
