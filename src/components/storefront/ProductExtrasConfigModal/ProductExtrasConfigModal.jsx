import { useState } from 'react'
import './ProductExtrasConfigModal.css'
import Button from '../../ui/Button/Button'
import Input from '../../ui/Input/Input'
import { X, Plus, Trash2, GripVertical, Star, Lock } from 'lucide-react'
import { SUBSCRIPTION_TIERS } from '../../../shared/subscriptions'

/**
 * Modal para que el admin configure extras específicos de un producto.
 * - Nombre del extra
 * - Precio adicional
 * - Stock máximo por pedido
 * - Tipo de selector: 'select' (dropdown) o 'buttons' (solo premium)
 */
export default function ProductExtrasConfigModal({
  product,
  onClose,
  onSave,
  isPremium = false, // Si el tenant es premium
}) {
  // Inicializar con los extras existentes del producto o array vacío
  const [extras, setExtras] = useState(product?.productExtras || [])
  const [saving, setSaving] = useState(false)

  // Agregar un nuevo extra vacío
  const addExtra = () => {
    setExtras([
      ...extras,
      {
        id: `extra_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: '',
        price: 0,
        maxPerOrder: 5,
        selectorType: 'select', // 'select' o 'buttons'
        options: [], // Para select: opciones disponibles
      },
    ])
  }

  // Actualizar un extra
  const updateExtra = (index, field, value) => {
    const updated = [...extras]
    updated[index] = { ...updated[index], [field]: value }
    setExtras(updated)
  }

  // Eliminar un extra
  const deleteExtra = (index) => {
    setExtras(extras.filter((_, i) => i !== index))
  }

  // Agregar opción a un extra tipo select
  const addOption = (extraIndex) => {
    const updated = [...extras]
    const currentOptions = updated[extraIndex].options || []
    updated[extraIndex].options = [
      ...currentOptions,
      { id: `opt_${Date.now()}`, label: '', price: 0 },
    ]
    setExtras(updated)
  }

  // Actualizar opción de un extra
  const updateOption = (extraIndex, optionIndex, field, value) => {
    const updated = [...extras]
    updated[extraIndex].options[optionIndex] = {
      ...updated[extraIndex].options[optionIndex],
      [field]: value,
    }
    setExtras(updated)
  }

  // Eliminar opción de un extra
  const deleteOption = (extraIndex, optionIndex) => {
    const updated = [...extras]
    updated[extraIndex].options = updated[extraIndex].options.filter((_, i) => i !== optionIndex)
    setExtras(updated)
  }

  // Guardar los extras
  const handleSave = async () => {
    // Filtrar extras vacíos
    const validExtras = extras.filter((e) => e.name.trim())
    setSaving(true)
    try {
      await onSave(product.id, validExtras)
      onClose()
    } catch (err) {
      console.error('Error saving product extras:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="productExtrasConfigModal__overlay">
      <div className="productExtrasConfigModal">
        <div className="productExtrasConfigModal__header">
          <div className="productExtrasConfigModal__headerInfo">
            <h2>Configurar Extras</h2>
            <span className="productExtrasConfigModal__productName">{product?.name}</span>
          </div>
          <button type="button" className="productExtrasConfigModal__close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="productExtrasConfigModal__body">
          {extras.length === 0 ? (
            <div className="productExtrasConfigModal__empty">
              <p>Este producto no tiene extras configurados.</p>
              <p className="muted">Agrega extras como ingredientes adicionales, tamaños, etc.</p>
            </div>
          ) : (
            <div className="productExtrasConfigModal__list">
              {extras.map((extra, index) => (
                <div key={extra.id} className="productExtrasConfigModal__extraItem">
                  <div className="productExtrasConfigModal__extraHeader">
                    <GripVertical size={16} className="productExtrasConfigModal__dragHandle" />
                    <span className="productExtrasConfigModal__extraNumber">Extra {index + 1}</span>
                    <button
                      type="button"
                      className="productExtrasConfigModal__deleteBtn"
                      onClick={() => deleteExtra(index)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="productExtrasConfigModal__extraFields">
                    <div className="productExtrasConfigModal__row">
                      <Input
                        label="Nombre del extra"
                        placeholder="Ej: Queso extra"
                        value={extra.name}
                        onChange={(val) => updateExtra(index, 'name', val)}
                      />
                      <Input
                        label="Precio"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={extra.price || ''}
                        onChange={(val) => updateExtra(index, 'price', Number(val) || 0)}
                      />
                    </div>

                    <div className="productExtrasConfigModal__row">
                      <Input
                        label="Máx. por pedido"
                        type="number"
                        min="1"
                        max="99"
                        value={extra.maxPerOrder || 5}
                        onChange={(val) => updateExtra(index, 'maxPerOrder', Number(val) || 1)}
                      />
                      <div className="productExtrasConfigModal__selectorType">
                        <label className="productExtrasConfigModal__label">Tipo de selector</label>
                        <div className="productExtrasConfigModal__selectorOptions">
                          <button
                            type="button"
                            className={`productExtrasConfigModal__selectorBtn ${extra.selectorType === 'select' ? 'active' : ''}`}
                            onClick={() => updateExtra(index, 'selectorType', 'select')}
                          >
                            Select (Dropdown)
                          </button>
                          <button
                            type="button"
                            className={`productExtrasConfigModal__selectorBtn ${extra.selectorType === 'buttons' ? 'active' : ''} ${!isPremium ? 'locked' : ''}`}
                            onClick={() => isPremium && updateExtra(index, 'selectorType', 'buttons')}
                            disabled={!isPremium}
                            title={!isPremium ? 'Solo disponible para Premium' : 'Botones visuales'}
                          >
                            Botones
                            {!isPremium && <Lock size={12} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Opciones para el select */}
                    {extra.selectorType === 'select' && (
                      <div className="productExtrasConfigModal__options">
                        <label className="productExtrasConfigModal__label">Opciones del selector</label>
                        <div className="productExtrasConfigModal__optionsList">
                          {(extra.options || []).map((opt, optIndex) => (
                            <div key={opt.id} className="productExtrasConfigModal__optionItem">
                              <input
                                type="text"
                                placeholder="Opción (ej: Pequeño)"
                                value={opt.label || ''}
                                onChange={(e) => updateOption(index, optIndex, 'label', e.target.value)}
                                className="productExtrasConfigModal__optionInput"
                              />
                              <input
                                type="number"
                                placeholder="Precio"
                                min="0"
                                step="0.01"
                                value={opt.price || ''}
                                onChange={(e) => updateOption(index, optIndex, 'price', Number(e.target.value) || 0)}
                                className="productExtrasConfigModal__optionPrice"
                              />
                              <button
                                type="button"
                                className="productExtrasConfigModal__optionDelete"
                                onClick={() => deleteOption(index, optIndex)}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            className="productExtrasConfigModal__addOption"
                            onClick={() => addOption(index)}
                          >
                            <Plus size={14} /> Agregar opción
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button type="button" className="productExtrasConfigModal__addBtn" onClick={addExtra}>
            <Plus size={16} /> Agregar Extra
          </button>
        </div>

        <div className="productExtrasConfigModal__footer">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>
    </div>
  )
}
