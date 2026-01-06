import { useState, useEffect, useMemo } from 'react'
import './ExtrasManager.css'
import { useAppDispatch, useAppSelector } from '../../../app/hooks'
import { selectUser } from '../../../features/auth/authSlice'
import {
  fetchExtrasForTenant,
  fetchExtraGroupsForTenant,
  selectExtrasForTenant,
  selectExtraGroupsForTenant,
  createExtraGroup,
  patchExtraGroup,
  deleteExtraGroup,
  createExtra,
  patchExtra,
  deleteExtra,
} from '../../../features/extras/extrasSlice'
import { fetchTutorialVideo, upsertTutorialVideo } from '../../../lib/supabaseApi'
import { createId } from '../../../shared/ids'
import Button from '../../ui/Button/Button'
import InfoTooltip from '../../ui/InfoTooltip/InfoTooltip'
import PageTutorialButton from '../PageTutorialButton/PageTutorialButton'
import TutorialSection from '../TutorialSection/TutorialSection'
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  Layers,
  X,
  GripVertical,
  List,
} from 'lucide-react'

export default function ExtrasManager({ tenantId }) {
  const dispatch = useAppDispatch()
  const user = useAppSelector(selectUser)
  const extras = useAppSelector(selectExtrasForTenant(tenantId))
  const groups = useAppSelector(selectExtraGroupsForTenant(tenantId))

  // UI State
  const [expandedGroups, setExpandedGroups] = useState({})
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [showExtraModal, setShowExtraModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState(null)
  const [editingExtra, setEditingExtra] = useState(null)
  const [targetGroupId, setTargetGroupId] = useState(null)

  // Tutorial video state
  const [tutorialVideo, setTutorialVideo] = useState({ url: '', type: 'youtube' })

  // Form State - Group
  const [groupForm, setGroupForm] = useState({
    name: '',
    description: '',
    minSelections: 0,
    maxSelections: 10,
    isRequired: false,
  })

  // Form State - Extra
  const [extraForm, setExtraForm] = useState({
    name: '',
    description: '',
    price: 0,
    hasOptions: false,
    options: [],
  })

  // Load data on mount
  useEffect(() => {
    if (tenantId) {
      dispatch(fetchExtraGroupsForTenant(tenantId))
      dispatch(fetchExtrasForTenant(tenantId))
    }
  }, [dispatch, tenantId])

  // Load tutorial video
  useEffect(() => {
    async function loadTutorial() {
      try {
        const tutorial = await fetchTutorialVideo('extras')
        if (tutorial) {
          setTutorialVideo({ url: tutorial.video_url || '', type: tutorial.video_type || 'youtube' })
        }
      } catch (e) {
        console.warn('Error loading tutorial:', e)
      }
    }
    loadTutorial()
  }, [])

  // Save tutorial video
  const handleSaveTutorial = async (sectionId, videoUrl, videoType) => {
    try {
      await upsertTutorialVideo({ sectionId, videoUrl, videoType })
      setTutorialVideo({ url: videoUrl, type: videoType })
    } catch (e) {
      console.error('Error saving tutorial:', e)
      throw e
    }
  }

  // Sort groups by sortOrder
  const sortedGroups = useMemo(() => {
    return [...groups].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
  }, [groups])

  // Get extras for a group
  const getExtrasForGroup = (groupId) => {
    return extras
      .filter((e) => e.groupId === groupId && e.active !== false)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
  }

  // Toggle group expansion
  const toggleGroup = (groupId) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }))
  }

  // Open group modal for create
  const openCreateGroup = () => {
    setEditingGroup(null)
    setGroupForm({
      name: '',
      description: '',
      minSelections: 0,
      maxSelections: 10,
      isRequired: false,
    })
    setShowGroupModal(true)
  }

  // Open group modal for edit
  const openEditGroup = (group) => {
    setEditingGroup(group)
    setGroupForm({
      name: group.name || '',
      description: group.description || '',
      minSelections: group.minSelections ?? 0,
      maxSelections: group.maxSelections ?? 10,
      isRequired: group.isRequired ?? false,
    })
    setShowGroupModal(true)
  }

  // Save group
  const handleSaveGroup = async () => {
    if (!groupForm.name.trim()) return

    if (editingGroup) {
      await dispatch(patchExtraGroup({
        tenantId,
        groupId: editingGroup.id,
        patch: {
          name: groupForm.name.trim(),
          description: groupForm.description.trim() || null,
          minSelections: Number(groupForm.minSelections) || 0,
          maxSelections: Number(groupForm.maxSelections) || 10,
          isRequired: groupForm.isRequired,
        },
      }))
      setShowGroupModal(false)
    } else {
      // Creating new group - get the result to open extra modal
      const result = await dispatch(createExtraGroup({
        tenantId,
        group: {
          name: groupForm.name.trim(),
          description: groupForm.description.trim() || null,
          minSelections: Number(groupForm.minSelections) || 0,
          maxSelections: Number(groupForm.maxSelections) || 10,
          isRequired: groupForm.isRequired,
          sortOrder: groups.length,
        },
      }))
      
      setShowGroupModal(false)
      
      // Auto-open modal to add first extra to the new group
      if (result.payload?.row?.id) {
        const newGroupId = result.payload.row.id
        // Expand the new group
        setExpandedGroups((prev) => ({ ...prev, [newGroupId]: true }))
        // Open create extra modal for this group
        openCreateExtra(newGroupId)
      }
    }
  }

  // Delete group
  const handleDeleteGroup = async (groupId) => {
    if (!confirm('¿Eliminar este grupo y todos sus extras?')) return
    await dispatch(deleteExtraGroup({ tenantId, groupId }))
  }

  // Open extra modal for create
  const openCreateExtra = (groupId) => {
    setEditingExtra(null)
    setTargetGroupId(groupId)
    setExtraForm({
      name: '',
      description: '',
      price: 0,
      hasOptions: false,
      options: [],
    })
    setShowExtraModal(true)
  }

  // Open extra modal for edit
  const openEditExtra = (extra) => {
    setEditingExtra(extra)
    setTargetGroupId(extra.groupId)
    setExtraForm({
      name: extra.name || '',
      description: extra.description || '',
      price: extra.price ?? 0,
      hasOptions: extra.hasOptions ?? false,
      options: extra.options || [],
    })
    setShowExtraModal(true)
  }

  // Save extra
  const handleSaveExtra = async () => {
    if (!extraForm.name.trim()) return

    // Clean up options (remove empty ones)
    const cleanOptions = extraForm.hasOptions 
      ? extraForm.options.filter(opt => opt.label?.trim())
      : []

    if (editingExtra) {
      await dispatch(patchExtra({
        tenantId,
        extraId: editingExtra.id,
        patch: {
          name: extraForm.name.trim(),
          description: extraForm.description.trim() || null,
          price: Number(extraForm.price) || 0,
          hasOptions: extraForm.hasOptions,
          options: cleanOptions,
        },
      }))
    } else {
      await dispatch(createExtra({
        tenantId,
        extra: {
          groupId: targetGroupId,
          name: extraForm.name.trim(),
          description: extraForm.description.trim() || null,
          price: Number(extraForm.price) || 0,
          hasOptions: extraForm.hasOptions,
          options: cleanOptions,
          sortOrder: getExtrasForGroup(targetGroupId).length,
        },
      }))
    }

    setShowExtraModal(false)
  }

  // Delete extra
  const handleDeleteExtra = async (extraId) => {
    if (!confirm('¿Eliminar este extra?')) return
    await dispatch(deleteExtra({ tenantId, extraId }))
  }

  // Add option to extra form
  const addOption = () => {
    setExtraForm(prev => ({
      ...prev,
      options: [
        ...prev.options,
        { id: createId('opt'), label: '', price: 0 }
      ]
    }))
  }

  // Update option in extra form
  const updateOption = (index, field, value) => {
    setExtraForm(prev => ({
      ...prev,
      options: prev.options.map((opt, i) => 
        i === index ? { ...opt, [field]: value } : opt
      )
    }))
  }

  // Remove option from extra form
  const removeOption = (index) => {
    setExtraForm(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }))
  }

  // Format price
  const formatPrice = (price) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(price)
  }

  return (
    <div className="extrasManager">
      {/* Header */}
      <div className="extrasManager__header">
        <div className="extrasManager__headerTop">
          <h3 className="extrasManager__title">
            <Layers size={20} /> Gestión de Extras y Toppings
            <InfoTooltip 
              text="Crea grupos de extras como Salsas, Toppings o Bebidas. Luego asígnalos a productos específicos para que los clientes puedan personalizar su pedido."
              position="right"
              size={16}
            />
          </h3>
          <PageTutorialButton 
            sectionId="tutorial-extras" 
            label="Tutorial"
            hasVideo={Boolean(tutorialVideo.url)}
          />
        </div>
        <div className="extrasManager__headerActions">
          <Button size="sm" onClick={openCreateGroup}>
            <Plus size={16} /> Nuevo Grupo
          </Button>
        </div>
      </div>

      {/* Empty State */}
      {sortedGroups.length === 0 && (
        <div className="extrasManager__empty">
          <div className="extrasManager__emptyIcon">🍔</div>
          <p>No hay grupos de extras configurados</p>
          <p className="muted">Crea un grupo como "Salsas" o "Toppings" para agregar extras a tus productos</p>
          <Button onClick={openCreateGroup} style={{ marginTop: '1rem' }}>
            <Plus size={16} /> Crear Primer Grupo
          </Button>
        </div>
      )}

      {/* Groups List */}
      <div className="extrasManager__groups">
        {sortedGroups.map((group) => {
          const groupExtras = getExtrasForGroup(group.id)
          const isExpanded = expandedGroups[group.id] !== false // Default to expanded

          return (
            <div key={group.id} className="extrasManager__group">
              {/* Group Header */}
              <div className="extrasManager__groupHeader" onClick={() => toggleGroup(group.id)}>
                <div className="extrasManager__groupInfo">
                  <span className="extrasManager__groupName">
                    <GripVertical size={16} style={{ opacity: 0.4 }} />
                    {group.name}
                    {group.isRequired && (
                      <span className="extrasManager__groupBadge extrasManager__groupBadge--required">
                        Obligatorio
                      </span>
                    )}
                  </span>
                  <span className="extrasManager__groupMeta">
                    <span>{groupExtras.length} extras</span>
                    <span>•</span>
                    <span>
                      {group.minSelections > 0 ? `Mín: ${group.minSelections}` : 'Sin mínimo'} 
                      {' - '}
                      Máx: {group.maxSelections}
                    </span>
                  </span>
                </div>
                <div className="extrasManager__groupActions">
                  <button
                    type="button"
                    className="extrasManager__iconBtn"
                    onClick={(e) => {
                      e.stopPropagation()
                      openEditGroup(group)
                    }}
                    title="Editar grupo"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    className="extrasManager__iconBtn extrasManager__iconBtn--danger"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteGroup(group.id)
                    }}
                    title="Eliminar grupo"
                  >
                    <Trash2 size={16} />
                  </button>
                  <ChevronDown 
                    size={20} 
                    className={`extrasManager__groupExpandIcon ${isExpanded ? 'extrasManager__groupExpandIcon--open' : ''}`}
                  />
                </div>
              </div>

              {/* Group Content */}
              {isExpanded && (
                <div className="extrasManager__groupContent">
                  <div className="extrasManager__extras">
                    {groupExtras.map((extra) => (
                      <div 
                        key={extra.id} 
                        className={`extrasManager__extra ${extra.active === false ? 'extrasManager__extra--inactive' : ''}`}
                      >
                        <div className="extrasManager__extraInfo">
                          <span className="extrasManager__extraName">
                            {extra.name}
                            {extra.hasOptions && extra.options?.length > 0 && (
                              <span className="extrasManager__extraBadge">
                                <List size={12} /> {extra.options.length} opciones
                              </span>
                            )}
                          </span>
                          {extra.description && (
                            <span className="extrasManager__extraDesc">{extra.description}</span>
                          )}
                          {/* Show options preview */}
                          {extra.hasOptions && extra.options?.length > 0 && (
                            <div className="extrasManager__extraOptions">
                              {extra.options.slice(0, 3).map((opt, i) => (
                                <span key={opt.id || i} className="extrasManager__extraOptionTag">
                                  {opt.label} {opt.price > 0 && `(${formatPrice(opt.price)})`}
                                </span>
                              ))}
                              {extra.options.length > 3 && (
                                <span className="extrasManager__extraOptionTag extrasManager__extraOptionTag--more">
                                  +{extra.options.length - 3} más
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <span className={`extrasManager__extraPrice ${extra.price === 0 && !extra.hasOptions ? 'extrasManager__extraPrice--free' : ''}`}>
                          {extra.hasOptions ? 'Variable' : (extra.price > 0 ? `+ ${formatPrice(extra.price)}` : 'Gratis')}
                        </span>
                        <div className="extrasManager__extraActions">
                          <button
                            type="button"
                            className="extrasManager__iconBtn"
                            onClick={() => openEditExtra(extra)}
                            title="Editar extra"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            className="extrasManager__iconBtn extrasManager__iconBtn--danger"
                            onClick={() => handleDeleteExtra(extra.id)}
                            title="Eliminar extra"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Add Extra Button */}
                    <button
                      type="button"
                      className="extrasManager__addExtra"
                      onClick={() => openCreateExtra(group.id)}
                    >
                      <Plus size={18} />
                      <span>Agregar extra a "{group.name}"</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Group Modal */}
      {showGroupModal && (
        <div className="extrasManager__modal">
          <div className="extrasManager__modalContent">
            <div className="extrasManager__modalHeader">
              <h4 className="extrasManager__modalTitle">
                {editingGroup ? 'Editar Grupo' : 'Nuevo Grupo de Extras'}
              </h4>
              <button
                type="button"
                className="extrasManager__modalClose"
                onClick={() => setShowGroupModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="extrasManager__modalBody">
              <div className="extrasManager__field">
                <label className="extrasManager__fieldLabel">
                  Nombre del grupo *
                  <InfoTooltip 
                    text="El nombre que verán los clientes, como 'Salsas', 'Toppings', 'Tipo de pan', etc."
                    position="right"
                    size={14}
                  />
                </label>
                <input
                  type="text"
                  className="extrasManager__fieldInput"
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  placeholder="Ej: Salsas, Toppings, Tipo de carne"
                  autoFocus
                />
              </div>
              <div className="extrasManager__field">
                <label className="extrasManager__fieldLabel">
                  Descripción (visible al cliente)
                  <InfoTooltip 
                    text="Instrucciones para el cliente, como 'Seleccione hasta 3 opciones' o 'Obligatorio elegir 1'."
                    position="right"
                    size={14}
                  />
                </label>
                <input
                  type="text"
                  className="extrasManager__fieldInput"
                  value={groupForm.description}
                  onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                  placeholder="Ej: Seleccione hasta 3 opciones"
                />
              </div>
              <div className="extrasManager__fieldRow">
                <div className="extrasManager__field">
                  <label className="extrasManager__fieldLabel">
                    Mínimo selecciones
                    <InfoTooltip 
                      text="Cantidad mínima de extras que el cliente debe elegir. Pon 0 si es opcional."
                      position="top"
                      size={14}
                    />
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="extrasManager__fieldInput"
                    value={groupForm.minSelections}
                    onChange={(e) => setGroupForm({ ...groupForm, minSelections: e.target.value })}
                  />
                </div>
                <div className="extrasManager__field">
                  <label className="extrasManager__fieldLabel">
                    Máximo selecciones
                    <InfoTooltip 
                      text="Cantidad máxima de extras que el cliente puede elegir de este grupo."
                      position="top"
                      size={14}
                    />
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="extrasManager__fieldInput"
                    value={groupForm.maxSelections}
                    onChange={(e) => setGroupForm({ ...groupForm, maxSelections: e.target.value })}
                  />
                </div>
              </div>
              <div className="extrasManager__field">
                <label className="extrasManager__fieldCheckbox">
                  <input
                    type="checkbox"
                    checked={groupForm.isRequired}
                    onChange={(e) => setGroupForm({ ...groupForm, isRequired: e.target.checked })}
                  />
                  <span>Es obligatorio (el cliente debe elegir al menos {groupForm.minSelections || 1})</span>
                  <InfoTooltip 
                    text="Si está marcado, el cliente no podrá agregar el producto sin seleccionar extras de este grupo."
                    position="right"
                    size={14}
                  />
                </label>
              </div>
            </div>
            <div className="extrasManager__modalFooter">
              <Button variant="secondary" onClick={() => setShowGroupModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveGroup} disabled={!groupForm.name.trim()}>
                {editingGroup ? 'Guardar Cambios' : 'Crear Grupo'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Extra Modal with Options Support */}
      {showExtraModal && (
        <div className="extrasManager__modal">
          <div className="extrasManager__modalContent extrasManager__modalContent--large">
            <div className="extrasManager__modalHeader">
              <h4 className="extrasManager__modalTitle">
                {editingExtra ? 'Editar Extra' : 'Nuevo Extra'}
              </h4>
              <button
                type="button"
                className="extrasManager__modalClose"
                onClick={() => setShowExtraModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="extrasManager__modalBody">
              <div className="extrasManager__field">
                <label className="extrasManager__fieldLabel">Nombre del extra *</label>
                <input
                  type="text"
                  className="extrasManager__fieldInput"
                  value={extraForm.name}
                  onChange={(e) => setExtraForm({ ...extraForm, name: e.target.value })}
                  placeholder="Ej: Salsa BBQ, Gaseosa, Extra queso"
                  autoFocus
                />
              </div>
              <div className="extrasManager__field">
                <label className="extrasManager__fieldLabel">Descripción</label>
                <input
                  type="text"
                  className="extrasManager__fieldInput"
                  value={extraForm.description}
                  onChange={(e) => setExtraForm({ ...extraForm, description: e.target.value })}
                  placeholder="Ej: Elige tu bebida favorita"
                />
              </div>

              {/* Toggle: Simple extra vs Extra with options */}
              <div className="extrasManager__field">
                <label className="extrasManager__fieldCheckbox extrasManager__fieldCheckbox--highlight">
                  <input
                    type="checkbox"
                    checked={extraForm.hasOptions}
                    onChange={(e) => setExtraForm({ ...extraForm, hasOptions: e.target.checked })}
                  />
                  <div>
                    <span>Este extra tiene variantes/opciones</span>
                    <span className="extrasManager__fieldHint">
                      Ej: "Gaseosa" con opciones "Coca-Cola", "Sprite", "Fanta" cada una con su precio
                    </span>
                  </div>
                </label>
              </div>

              {/* Simple price (when no options) */}
              {!extraForm.hasOptions && (
                <div className="extrasManager__field">
                  <label className="extrasManager__fieldLabel">Precio adicional</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    className="extrasManager__fieldInput"
                    value={extraForm.price}
                    onChange={(e) => setExtraForm({ ...extraForm, price: e.target.value })}
                    placeholder="0 = gratis"
                  />
                  <span className="extrasManager__fieldHint">
                    Ingresa 0 si no tiene costo adicional
                  </span>
                </div>
              )}

              {/* Options list (when hasOptions is true) */}
              {extraForm.hasOptions && (
                <div className="extrasManager__optionsSection">
                  <div className="extrasManager__optionsHeader">
                    <label className="extrasManager__fieldLabel">Opciones disponibles</label>
                    <Button size="sm" variant="secondary" onClick={addOption}>
                      <Plus size={14} /> Agregar opción
                    </Button>
                  </div>

                  {extraForm.options.length === 0 && (
                    <div className="extrasManager__optionsEmpty">
                      <p>No hay opciones configuradas</p>
                      <p className="muted">Agrega opciones como "Coca-Cola", "Sprite", etc.</p>
                    </div>
                  )}

                  <div className="extrasManager__optionsList">
                    {extraForm.options.map((option, index) => (
                      <div key={option.id || index} className="extrasManager__optionRow">
                        <input
                          type="text"
                          className="extrasManager__fieldInput extrasManager__optionLabel"
                          value={option.label}
                          onChange={(e) => updateOption(index, 'label', e.target.value)}
                          placeholder="Nombre de la opción"
                        />
                        <div className="extrasManager__optionPrice">
                          <span>$</span>
                          <input
                            type="number"
                            min="0"
                            step="100"
                            className="extrasManager__fieldInput"
                            value={option.price}
                            onChange={(e) => updateOption(index, 'price', Number(e.target.value) || 0)}
                            placeholder="0"
                          />
                        </div>
                        <button
                          type="button"
                          className="extrasManager__iconBtn extrasManager__iconBtn--danger"
                          onClick={() => removeOption(index)}
                          title="Eliminar opción"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="extrasManager__modalFooter">
              <Button variant="secondary" onClick={() => setShowExtraModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveExtra} disabled={!extraForm.name.trim()}>
                {editingExtra ? 'Guardar Cambios' : 'Crear Extra'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Sección de Tutorial */}
      <div id="tutorial-extras">
        <TutorialSection
          sectionId="extras"
          title="Tutorial: Extras y Toppings"
          user={user}
          videoUrl={tutorialVideo.url}
          videoType={tutorialVideo.type}
          onSaveVideo={handleSaveTutorial}
        />
      </div>
    </div>
  )
}
