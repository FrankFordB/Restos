import { useState, useMemo } from 'react'
import './ProductDetailModal.css'
import Button from '../../ui/Button/Button'
import { X, Plus, Minus, Check, AlertCircle, ChevronDown } from 'lucide-react'

export default function ProductDetailModal({
  product,
  groups = [],
  extras = [],
  onClose,
  onAddToCart,
  initialQuantity = 1,
  initialExtras = [],
  initialComment = '',
  isEditing = false,
  currentCartQuantity = 0, // Cantidad actual en el carrito para este producto
  stockLimit = null, // Límite efectivo de stock (mínimo entre producto y categoría)
  categoryName = null, // Nombre de la categoría para el mensaje
  isLimitedByCategory = false, // Si el límite viene del stock global de categoría
}) {
  // Usar stockLimit si está disponible, sino usar product.stock
  const effectiveStock = stockLimit !== null ? stockLimit : (product.stock ?? null)
  
  // Detectar si el producto está sin stock
  const isOutOfStock = effectiveStock !== null && effectiveStock === 0
  
  // Calcular stock máximo disponible (restando lo que ya hay en carrito)
  // Si estamos editando, no restamos porque ya lo contamos
  const maxStock = effectiveStock !== null 
    ? Math.max(0, effectiveStock - (isEditing ? 0 : currentCartQuantity))
    : Infinity
  
  const [quantity, setQuantity] = useState(Math.min(initialQuantity, maxStock || 1))
  
  // Initialize selectedExtras from initialExtras (for editing)
  const [selectedExtras, setSelectedExtras] = useState(() => {
    const initial = {}
    if (initialExtras && initialExtras.length > 0) {
      initialExtras.forEach(ext => {
        if (!ext.selectedOption) {
          initial[ext.id] = true
        }
      })
    }
    return initial
  })
  
  // Initialize selectedOptions from initialExtras (for editing)
  const [selectedOptions, setSelectedOptions] = useState(() => {
    const initial = {}
    if (initialExtras && initialExtras.length > 0) {
      initialExtras.forEach(ext => {
        if (ext.selectedOption) {
          initial[ext.id] = {
            optionId: ext.selectedOption.id,
            option: ext.selectedOption,
          }
        }
      })
    }
    return initial
  })
  
  const [comment, setComment] = useState(initialComment || '')

  // Get sorted active groups
  const sortedGroups = useMemo(() => {
    return [...groups]
      .filter((g) => g.active !== false)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
  }, [groups])

  // Get extras for a group
  const getExtrasForGroup = (groupId) => {
    return extras
      .filter((e) => e.groupId === groupId && e.active !== false)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
  }

  // Count selected extras for a group (including those with options)
  const getSelectedCountForGroup = (groupId) => {
    const groupExtras = getExtrasForGroup(groupId)
    return groupExtras.filter((e) => {
      if (e.hasOptions && e.options?.length > 0) {
        return selectedOptions[e.id]?.optionId
      }
      return selectedExtras[e.id]
    }).length
  }

  // Check if a group meets its minimum requirement
  const isGroupValid = (group) => {
    const selectedCount = getSelectedCountForGroup(group.id)
    return selectedCount >= (group.minSelections || 0)
  }

  // Check if can select more in a group
  const canSelectMoreInGroup = (groupId) => {
    const group = groups.find((g) => g.id === groupId)
    if (!group) return true
    const selectedCount = getSelectedCountForGroup(groupId)
    return selectedCount < (group.maxSelections || 999)
  }

  // Toggle simple extra selection
  const toggleExtra = (extra) => {
    const isSelected = selectedExtras[extra.id]
    
    if (isSelected) {
      // Deselect
      setSelectedExtras((prev) => {
        const { [extra.id]: _, ...rest } = prev
        return rest
      })
    } else {
      // Check if can select
      if (!canSelectMoreInGroup(extra.groupId)) return
      
      setSelectedExtras((prev) => ({
        ...prev,
        [extra.id]: true,
      }))
    }
  }

  // Handle option selection for extras with options
  const handleOptionChange = (extra, optionId) => {
    const option = extra.options?.find((o) => o.id === optionId)
    
    if (!optionId) {
      // Deselect
      setSelectedOptions((prev) => {
        const { [extra.id]: _, ...rest } = prev
        return rest
      })
      return
    }

    // Check if this is a new selection (not already selected)
    const wasSelected = selectedOptions[extra.id]?.optionId
    if (!wasSelected && !canSelectMoreInGroup(extra.groupId)) return

    setSelectedOptions((prev) => ({
      ...prev,
      [extra.id]: {
        optionId,
        option,
      },
    }))
  }

  // Calculate total price
  const basePrice = Number(product.price) || 0
  
  // Simple extras total
  const simpleExtrasTotal = useMemo(() => {
    return Object.keys(selectedExtras)
      .filter((id) => selectedExtras[id])
      .reduce((sum, id) => {
        const extra = extras.find((e) => e.id === id)
        return sum + (Number(extra?.price) || 0)
      }, 0)
  }, [selectedExtras, extras])
  
  // Options extras total
  const optionsExtrasTotal = useMemo(() => {
    return Object.values(selectedOptions).reduce((sum, value) => {
      if (!value?.option) return sum
      return sum + (Number(value.option.price) || 0)
    }, 0)
  }, [selectedOptions])
  
  const extrasTotal = simpleExtrasTotal + optionsExtrasTotal
  const unitPrice = basePrice + extrasTotal
  const totalPrice = unitPrice * quantity

  // Get selected extras list (for cart)
  const selectedExtrasList = useMemo(() => {
    // Simple extras
    const simpleList = Object.keys(selectedExtras)
      .filter((id) => selectedExtras[id])
      .map((id) => {
        const extra = extras.find((e) => e.id === id)
        if (!extra) return null
        return {
          id: extra.id,
          name: extra.name,
          price: extra.price || 0,
        }
      })
      .filter(Boolean)
    
    // Extras with options
    const optionsList = Object.entries(selectedOptions)
      .filter(([_, value]) => value?.option)
      .map(([id, value]) => {
        const extra = extras.find((e) => e.id === id)
        if (!extra) return null
        return {
          id: extra.id,
          name: `${extra.name}: ${value.option.label}`,
          price: value.option.price || 0,
        }
      })
      .filter(Boolean)
    
    return [...simpleList, ...optionsList]
  }, [selectedExtras, selectedOptions, extras])

  // Validate all required groups
  const allGroupsValid = useMemo(() => {
    return sortedGroups.every((group) => {
      if (!group.isRequired) return true
      return isGroupValid(group)
    })
  }, [sortedGroups, selectedExtras, selectedOptions])

  // Handle add to cart
  const handleAddToCart = () => {
    if (!allGroupsValid) return

    onAddToCart({
      product,
      quantity,
      selectedExtras: selectedExtrasList,
      extrasTotal,
      unitPrice,
      totalPrice,
      comment: comment.trim() || null,
    })
    onClose()
  }

  // Format price
  const formatPrice = (price) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  }

  return (
    <div className="productModal__overlay">
      <div className={`productModal ${isOutOfStock ? 'productModal--outOfStock' : ''}`}>
        {/* Close Button */}
        <button className="productModal__close" onClick={onClose}>
          <X size={24} />
        </button>

        {/* Banner de Sin Stock */}
        {isOutOfStock && (
          <div className="productModal__outOfStockBanner">
            <AlertCircle size={20} />
            <span>Este producto está agotado</span>
          </div>
        )}

        {/* Product Image */}
        {product.imageUrl && (
          <div 
            className={`productModal__image ${isOutOfStock ? 'productModal__image--outOfStock' : ''}`}
          >
            {/* Liquid Glass background effect cuando hay zoom < 1 */}
            {product.focalPoint?.zoom && product.focalPoint.zoom < 1 && (
              <>
                <div 
                  className="productModal__liquidBg"
                  style={{
                    backgroundImage: `url(${product.imageUrl})`,
                  }}
                />
                <div 
                  className="productModal__liquidOverlay"
                  style={{
                    backgroundColor: product.focalPoint.bgColor || 'rgba(0,0,0,0.1)',
                  }}
                />
              </>
            )}
            {product.focalPoint?.zoom && product.focalPoint.zoom !== 1 ? (
              <div 
                className="productModal__imgBg"
                style={{
                  backgroundImage: `url(${product.imageUrl})`,
                  backgroundPosition: `${product.focalPoint.x}% ${product.focalPoint.y}%`,
                  backgroundSize: `${product.focalPoint.zoom * 100}%`,
                }}
                role="img"
                aria-label={product.name}
              />
            ) : (
              <img 
                src={product.imageUrl} 
                alt={product.name}
                style={product.focalPoint ? {
                  objectPosition: `${product.focalPoint.x}% ${product.focalPoint.y}%`
                } : undefined}
              />
            )}
            {isOutOfStock && <div className="productModal__imageOverlay">AGOTADO</div>}
          </div>
        )}

        {/* Product Info */}
        <div className="productModal__header">
          <h2 className="productModal__title">{product.name}</h2>
          {product.description && (
            <p className="productModal__description">{product.description}</p>
          )}
          <div className="productModal__price">{formatPrice(basePrice)}</div>
        </div>

        {/* Extras Groups */}
        <div className="productModal__body">
          {sortedGroups.length > 0 && (
            <div className="productModal__groups">
              {sortedGroups.map((group) => {
                const groupExtras = getExtrasForGroup(group.id)
                if (groupExtras.length === 0) return null

                const selectedCount = getSelectedCountForGroup(group.id)
                const isValid = isGroupValid(group)
                const canSelectMore = canSelectMoreInGroup(group.id)

                return (
                  <div key={group.id} className="productModal__group">
                    {/* Group Header */}
                    <div className="productModal__groupHeader">
                      <div className="productModal__groupInfo">
                        <h4 className="productModal__groupName">{group.name}</h4>
                        <span className="productModal__groupMeta">
                          {group.minSelections > 0 && (
                            <>Seleccione mínimo {group.minSelections} opción{group.minSelections > 1 ? 'es' : ''}</>
                          )}
                          {group.minSelections === 0 && group.maxSelections > 0 && (
                            <>Seleccione hasta {group.maxSelections} opciones</>
                          )}
                          {selectedCount > 0 && (
                            <span className="productModal__groupCount"> • {selectedCount} seleccionado{selectedCount > 1 ? 's' : ''}</span>
                          )}
                        </span>
                      </div>
                      {group.isRequired && (
                        <span className={`productModal__groupBadge ${isValid ? 'productModal__groupBadge--valid' : 'productModal__groupBadge--required'}`}>
                          {isValid ? <Check size={12} /> : null}
                          {isValid ? 'Listo' : 'Obligatorio'}
                        </span>
                      )}
                    </div>

                    {/* Group Extras */}
                    <div className="productModal__extras">
                      {groupExtras.map((extra) => {
                        // Extra with options (dropdown)
                        if (extra.hasOptions && extra.options?.length > 0) {
                          const selectedOption = selectedOptions[extra.id]
                          const isSelected = !!selectedOption?.optionId
                          
                          return (
                            <div 
                              key={extra.id} 
                              className={`productModal__extraWithOptions ${isSelected ? 'productModal__extraWithOptions--selected' : ''}`}
                            >
                              <div className="productModal__extraInfo">
                                <span className="productModal__extraName">{extra.name}</span>
                                {extra.description && (
                                  <span className="productModal__extraDesc">{extra.description}</span>
                                )}
                              </div>
                              <div className="productModal__extraSelect">
                                <select
                                  value={selectedOption?.optionId || ''}
                                  onChange={(e) => handleOptionChange(extra, e.target.value)}
                                  className="productModal__selectInput"
                                >
                                  <option value="">Seleccionar...</option>
                                  {extra.options.map((opt) => (
                                    <option key={opt.id} value={opt.id}>
                                      {opt.label} {opt.price > 0 ? `(+${formatPrice(opt.price)})` : '(Gratis)'}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown size={16} className="productModal__selectIcon" />
                              </div>
                            </div>
                          )
                        }

                        // Simple extra (toggle)
                        const isSelected = selectedExtras[extra.id]
                        const isDisabled = !isSelected && !canSelectMore

                        return (
                          <button
                            key={extra.id}
                            type="button"
                            className={`productModal__extra ${isSelected ? 'productModal__extra--selected' : ''} ${isDisabled ? 'productModal__extra--disabled' : ''}`}
                            onClick={() => !isDisabled && toggleExtra(extra)}
                            disabled={isDisabled}
                          >
                            <div className="productModal__extraCheck">
                              {isSelected && <Check size={16} />}
                            </div>
                            <div className="productModal__extraInfo">
                              <span className="productModal__extraName">{extra.name}</span>
                              {extra.description && (
                                <span className="productModal__extraDesc">{extra.description}</span>
                              )}
                            </div>
                            <span className={`productModal__extraPrice ${extra.price === 0 ? 'productModal__extraPrice--free' : ''}`}>
                              {extra.price > 0 ? `+ ${formatPrice(extra.price)}` : 'Gratis'}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* No extras message */}
          {sortedGroups.length === 0 && (
            <div className="productModal__noExtras">
              <p>No hay extras disponibles para este producto</p>
            </div>
          )}

          {/* Comments */}
          <div className="productModal__comments">
            <h4 className="productModal__commentsTitle">Comentarios</h4>
            <span className="productModal__commentsHint">(Opcional)</span>
            <textarea
              className="productModal__commentsInput"
              placeholder="Instrucciones especiales, alergias, etc."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows="2"
            />
          </div>

          {/* Selected Extras Summary */}
          {selectedExtrasList.length > 0 && (
            <div className="productModal__summary">
              <h4 className="productModal__summaryTitle">Extras seleccionados</h4>
              <div className="productModal__summaryList">
                {selectedExtrasList.map((extra, i) => (
                  <div key={i} className="productModal__summaryItem">
                    <span>{extra.name}</span>
                    <span className="productModal__summaryPrice">
                      {extra.price > 0 ? `+${formatPrice(extra.price)}` : 'Gratis'}
                    </span>
                  </div>
                ))}
              </div>
              {extrasTotal > 0 && (
                <div className="productModal__summaryTotal">
                  <span>Total extras:</span>
                  <span>+{formatPrice(extrasTotal)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="productModal__footer">
          {/* Quantity Selector */}
          <div className={`productModal__quantity ${isOutOfStock ? 'productModal__quantity--disabled' : ''}`}>
            <button
              type="button"
              className="productModal__qtyBtn"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1 || isOutOfStock}
            >
              <Minus size={18} />
            </button>
            <span className="productModal__qtyValue">{isOutOfStock ? 0 : quantity}</span>
            <button
              type="button"
              className="productModal__qtyBtn"
              onClick={() => setQuantity((q) => Math.min(q + 1, maxStock === Infinity ? q + 1 : maxStock))}
              disabled={(maxStock !== Infinity && quantity >= maxStock) || isOutOfStock}
            >
              <Plus size={18} />
            </button>
          </div>
          
          {/* Stock warning */}
          {maxStock !== Infinity && maxStock <= 5 && maxStock > 0 && (
            <span className={`productModal__stockWarning ${isLimitedByCategory ? 'productModal__stockWarning--category' : ''}`}>
              {maxStock === 1 ? '¡ÚLTIMA!' : `¡ÚLTIMAS: ${maxStock}!`}
            </span>
          )}
          {maxStock === 0 && !isOutOfStock && (
            <span className="productModal__maxReached">
              Máximo alcanzado
            </span>
          )}
          {isOutOfStock && (
            <span className="productModal__outOfStock">
              Sin stock disponible
            </span>
          )}

          {/* Add Button */}
          <button
            type="button"
            className={`productModal__addBtn ${!allGroupsValid || isOutOfStock ? 'productModal__addBtn--disabled' : ''}`}
            onClick={handleAddToCart}
            disabled={!allGroupsValid || isOutOfStock}
          >
            {isOutOfStock ? (
              <>
                <AlertCircle size={18} />
                Producto sin stock
              </>
            ) : allGroupsValid ? (
              <>
                {isEditing ? 'Actualizar' : 'Agregar al carrito'}
                <span className="productModal__addPrice">{formatPrice(totalPrice)}</span>
              </>
            ) : (
              <>
                <AlertCircle size={18} />
                Completa las opciones obligatorias
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
