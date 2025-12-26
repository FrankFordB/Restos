import { useEffect, useState, useCallback } from 'react'
import './PageBuilder.css'
import Card from '../../ui/Card/Card'
import Button from '../../ui/Button/Button'
import { useAppDispatch, useAppSelector } from '../../../app/hooks'
import {
  fetchWidgets,
  fetchTemplates,
  saveWidget,
  deleteWidget,
  reorderWidgets,
  selectWidgets,
  selectTemplates,
} from '../../../features/pageBuilder/pageBuilderSlice'
import {
  WIDGET_CONFIG,
  SUBSCRIPTION_TIERS,
  TIER_LABELS,
  isFeatureAvailable,
  getAvailableWidgets,
} from '../../../shared/subscriptions'

export default function PageBuilder({ tenantId, subscriptionTier = SUBSCRIPTION_TIERS.FREE }) {
  const dispatch = useAppDispatch()
  const widgets = useAppSelector(selectWidgets(tenantId))
  const templates = useAppSelector(selectTemplates)
  
  const [activeTab, setActiveTab] = useState('widgets')
  const [editingWidget, setEditingWidget] = useState(null)
  const [dragIndex, setDragIndex] = useState(null)

  useEffect(() => {
    dispatch(fetchWidgets(tenantId))
    dispatch(fetchTemplates())
  }, [dispatch, tenantId])

  const availableWidgets = getAvailableWidgets(subscriptionTier)
  const allWidgets = Object.entries(WIDGET_CONFIG)

  const handleAddWidget = useCallback((widgetType) => {
    const config = WIDGET_CONFIG[widgetType]
    if (!isFeatureAvailable(config.tier, subscriptionTier)) {
      return // No disponible para este tier
    }

    const newWidget = {
      widget_type: widgetType,
      title: config.label,
      content: {},
      sort_order: widgets.length,
      is_visible: true,
    }

    dispatch(saveWidget({ tenantId, widget: newWidget }))
  }, [dispatch, tenantId, widgets.length, subscriptionTier])

  const handleDeleteWidget = useCallback((widgetId) => {
    if (confirm('¿Eliminar este widget?')) {
      dispatch(deleteWidget({ tenantId, widgetId }))
    }
  }, [dispatch, tenantId])

  const handleDragStart = (index) => {
    setDragIndex(index)
  }

  const handleDragOver = (e, index) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === index) return
    
    // Reordenar visualmente
    const newWidgets = [...widgets]
    const [dragged] = newWidgets.splice(dragIndex, 1)
    newWidgets.splice(index, 0, dragged)
    
    // Actualizar orden
    dispatch(reorderWidgets({ 
      tenantId, 
      widgetIds: newWidgets.map(w => w.id) 
    }))
    setDragIndex(index)
  }

  const handleDragEnd = () => {
    setDragIndex(null)
  }

  const handleUpdateWidget = useCallback((widget) => {
    dispatch(saveWidget({ tenantId, widget }))
    setEditingWidget(null)
  }, [dispatch, tenantId])

  const renderTierBadge = (tier) => {
    if (tier === SUBSCRIPTION_TIERS.FREE) return null
    return (
      <span className={`tierBadge tierBadge--${tier}`}>
        {tier === SUBSCRIPTION_TIERS.PREMIUM ? '⭐' : '👑'} {TIER_LABELS[tier]}
      </span>
    )
  }

  return (
    <div className="pageBuilder">
      <div className="pageBuilder__header">
        <h3 className="pageBuilder__title">
           Constructor de Página
          {renderTierBadge(subscriptionTier)}
        </h3>
        <div className="pageBuilder__actions">
          <Button variant="secondary" size="sm">
             Vista previa
          </Button>
          <Button size="sm">
             Publicar
          </Button>
        </div>
      </div>

      <div className="pageBuilder__tabs">
        <button
          className={`pageBuilder__tab ${activeTab === 'widgets' ? 'pageBuilder__tab--active' : ''}`}
          onClick={() => setActiveTab('widgets')}
        >
          Widgets
        </button>
        <button
          className={`pageBuilder__tab ${activeTab === 'templates' ? 'pageBuilder__tab--active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          Plantillas
        </button>
        <button
          className={`pageBuilder__tab ${activeTab === 'settings' ? 'pageBuilder__tab--active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Ajustes
        </button>
      </div>

      <div className="pageBuilder__content">
        <aside className="pageBuilder__sidebar">
          {activeTab === 'widgets' && (
            <>
              <div className="pageBuilder__section">
                <div className="pageBuilder__sectionHeader">
                   Widgets Disponibles
                </div>
                <div className="pageBuilder__sectionBody">
                  {allWidgets.map(([type, config]) => {
                    const isAvailable = isFeatureAvailable(config.tier, subscriptionTier)
                    return (
                      <button
                        key={type}
                        className={`pageBuilder__widgetBtn ${!isAvailable ? 'pageBuilder__widgetBtn--locked' : ''}`}
                        onClick={() => handleAddWidget(type)}
                        disabled={!isAvailable}
                        title={!isAvailable ? `Requiere ${TIER_LABELS[config.tier]}` : config.description}
                      >
                        <span className="pageBuilder__widgetIcon">{config.icon}</span>
                        <div className="pageBuilder__widgetInfo">
                          <div className="pageBuilder__widgetLabel">
                            {config.label}
                            {config.tier !== SUBSCRIPTION_TIERS.FREE && (
                              <span className="pageBuilder__widgetTier">
                                {config.tier === SUBSCRIPTION_TIERS.PREMIUM ? 'PRO' : 'PRO+'}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {subscriptionTier === SUBSCRIPTION_TIERS.FREE && (
                <div className="upgradePrompt">
                  <div className="upgradePrompt__icon"></div>
                  <h4 className="upgradePrompt__title">Desbloquea más widgets</h4>
                  <p className="upgradePrompt__text">
                    Accede a carruseles, galerías, testimonios y más.
                  </p>
                  <Button size="sm">Ver planes</Button>
                </div>
              )}
            </>
          )}

          {activeTab === 'templates' && (
            <div className="pageBuilder__section">
              <div className="pageBuilder__sectionHeader">
                🎭 Plantillas
              </div>
              <div className="pageBuilder__sectionBody">
                {templates.map((tpl) => {
                  const isAvailable = isFeatureAvailable(tpl.tier_required, subscriptionTier)
                  return (
                    <button
                      key={tpl.id}
                      className={`pageBuilder__widgetBtn ${!isAvailable ? 'pageBuilder__widgetBtn--locked' : ''}`}
                      disabled={!isAvailable}
                    >
                      <span className="pageBuilder__widgetIcon">🎨</span>
                      <div className="pageBuilder__widgetInfo">
                        <div className="pageBuilder__widgetLabel">
                          {tpl.name}
                          {tpl.tier_required !== SUBSCRIPTION_TIERS.FREE && (
                            <span className="pageBuilder__widgetTier">
                              {tpl.tier_required === SUBSCRIPTION_TIERS.PREMIUM ? 'PRO' : 'PRO+'}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </aside>

        <div className="pageBuilder__canvas">
          <div className="pageBuilder__canvasHeader">
            <span className="pageBuilder__canvasTitle">
              Tu página ({widgets.length} widgets)
            </span>
            <div className="pageBuilder__previewMode">
              <button className="pageBuilder__previewBtn pageBuilder__previewBtn--active">💻 Desktop</button>
              <button className="pageBuilder__previewBtn">📱 Móvil</button>
            </div>
          </div>
          
          <div className="pageBuilder__canvasBody">
            {widgets.length === 0 ? (
              <div className="pageBuilder__emptyCanvas">
                <div className="pageBuilder__emptyIcon">📄</div>
                <p>Tu página está vacía</p>
                <p className="muted">Arrastra widgets desde la izquierda para comenzar</p>
              </div>
            ) : (
              <div className="pageBuilder__widgetList">
                {widgets.map((widget, index) => (
                  <div
                    key={widget.id}
                    className={`pageBuilder__widgetItem ${dragIndex === index ? 'pageBuilder__widgetItem--dragging' : ''}`}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="pageBuilder__widgetItemHeader">
                      <div className="pageBuilder__widgetItemTitle">
                        <span>{WIDGET_CONFIG[widget.widget_type]?.icon || '📦'}</span>
                        <span>{widget.title || WIDGET_CONFIG[widget.widget_type]?.label}</span>
                      </div>
                      <div className="pageBuilder__widgetItemActions">
                        <button
                          className="pageBuilder__widgetItemBtn"
                          onClick={() => setEditingWidget(widget)}
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button
                          className="pageBuilder__widgetItemBtn"
                          title="Visibilidad"
                        >
                          {widget.is_visible ? '👁️' : '🙈'}
                        </button>
                        <button
                          className="pageBuilder__widgetItemBtn pageBuilder__widgetItemBtn--danger"
                          onClick={() => handleDeleteWidget(widget.id)}
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <div className="pageBuilder__widgetItemBody">
                      <WidgetPreview widget={widget} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {editingWidget && (
        <WidgetEditor
          widget={editingWidget}
          onSave={handleUpdateWidget}
          onClose={() => setEditingWidget(null)}
        />
      )}
    </div>
  )
}

// Preview simplificado de cada widget
function WidgetPreview({ widget }) {
  const type = widget.widget_type

  const previews = {
    hero: (
      <div style={{ padding: '20px', background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', borderRadius: '8px', color: '#fff', textAlign: 'center' }}>
        <h3 style={{ margin: 0 }}>Hero Section</h3>
        <p style={{ margin: '8px 0 0', opacity: 0.8 }}>Título y descripción principal</p>
      </div>
    ),
    products_grid: (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: '60px', background: '#f1f5f9', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
            📦
          </div>
        ))}
      </div>
    ),
    products_carousel: (
      <div style={{ display: 'flex', gap: '8px', overflow: 'hidden' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ minWidth: '80px', height: '60px', background: '#fef3c7', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            🎠
          </div>
        ))}
      </div>
    ),
    text_block: (
      <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '6px' }}>
        <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', marginBottom: '6px', width: '80%' }} />
        <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', marginBottom: '6px', width: '60%' }} />
        <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', width: '70%' }} />
      </div>
    ),
    image_gallery: (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ height: '40px', background: '#ddd6fe', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            🖼️
          </div>
        ))}
      </div>
    ),
    testimonials: (
      <div style={{ padding: '12px', background: '#f0fdf4', borderRadius: '6px', textAlign: 'center' }}>
        <div style={{ fontSize: '1.5rem' }}>💬</div>
        <div style={{ fontSize: '0.8rem', color: '#15803d', marginTop: '4px' }}>Testimonios de clientes</div>
      </div>
    ),
    contact_form: (
      <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '6px' }}>
        <div style={{ height: '24px', background: '#e2e8f0', borderRadius: '4px', marginBottom: '6px' }} />
        <div style={{ height: '24px', background: '#e2e8f0', borderRadius: '4px', marginBottom: '6px' }} />
        <div style={{ height: '32px', background: '#f97316', borderRadius: '4px', width: '50%' }} />
      </div>
    ),
    banner: (
      <div style={{ padding: '16px', background: 'linear-gradient(90deg, #1e293b 0%, #334155 100%)', borderRadius: '6px', color: '#fff', textAlign: 'center' }}>
        🎨 Banner Promocional
      </div>
    ),
    video: (
      <div style={{ height: '80px', background: '#1e1b4b', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
        ▶️ Video
      </div>
    ),
  }

  return previews[type] || (
    <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '6px', textAlign: 'center', color: '#64748b' }}>
      {WIDGET_CONFIG[type]?.icon} {WIDGET_CONFIG[type]?.label}
    </div>
  )
}

// Editor modal de widget
function WidgetEditor({ widget, onSave, onClose }) {
  const [title, setTitle] = useState(widget.title || '')
  const [content, setContent] = useState(widget.content || {})

  const handleSave = () => {
    onSave({ ...widget, title, content })
  }

  return (
    <div className="products__modalOverlay" onClick={onClose}>
      <Card
        className="products__modal"
        title={`Editar: ${WIDGET_CONFIG[widget.widget_type]?.label}`}
        actions={<Button variant="secondary" size="sm" onClick={onClose}>✕</Button>}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'grid', gap: '16px' }}>
          <div className="input">
            <label className="input__label">Título</label>
            <input
              type="text"
              className="input__control"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título del widget"
            />
          </div>

          <p className="muted">
            Más opciones de configuración próximamente para cada tipo de widget.
          </p>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave}>Guardar</Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
