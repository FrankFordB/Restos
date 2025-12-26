import './ProductCard.css'
import Button from '../../ui/Button/Button'
import { Settings } from 'lucide-react'

export default function ProductCard({ 
  product, 
  quantity = 0, 
  onAdd, 
  onRemove,
  onClick,
  onEdit,
  onDelete,
  onConfigExtras,
  layout = 'classic',
  colors = {},
  isEditable = false,
  hasExtras = false,
  hasProductExtras = false,
  isPremium = false,
  disabled = false, // For when store is closed
}) {
  const layoutClass = `productCard--${layout}`
  
  // Custom colors as CSS variables
  const cardStyle = {
    '--card-bg': colors.cardBg || undefined,
    '--card-text': colors.cardText || undefined,
    '--card-desc': colors.cardDesc || undefined,
    '--card-price': colors.cardPrice || undefined,
    '--card-button': colors.cardButton || undefined,
  }
  
  // Overlay layout has text on image
  const isOverlay = layout === 'overlay'
  const isMinimal = layout === 'minimal'
  const isPolaroid = layout === 'polaroid'
  const isBanner = layout === 'banner'
  const isHorizontal = layout === 'horizontal' || layout === 'compact'

  // Handle card click (for opening product detail modal)
  const handleCardClick = (e) => {
    // Don't trigger if clicking on edit/delete buttons or stepper or config extras
    if (e.target.closest('.productCard__editActions') || 
        e.target.closest('.stepper') ||
        e.target.closest('.productCard__actions') ||
        e.target.closest('.productCard__overlayActions') ||
        e.target.closest('.productCard__configExtrasBtn')) {
      return
    }
    
    // Always call onClick to open the product detail modal
    onClick?.(product)
  }

  return (
    <article 
      className={`productCard ${layoutClass} ${isBanner ? 'productCard--fullWidth' : ''} ${(onClick && !isEditable) || isEditable ? 'productCard--clickable' : ''} ${disabled ? 'productCard--disabled' : ''}`} 
      style={cardStyle}
      onClick={handleCardClick}
    >
      {/* Editable actions */}
      {isEditable && (
        <div className="productCard__editActions">
          {onConfigExtras && (
            <button 
              className="productCard__configExtrasBtn" 
              type="button" 
              onClick={(e) => {
                e.stopPropagation()
                onConfigExtras()
              }}
              aria-label="Configurar extras"
              title="Configurar extras/toppings"
            >
              <Settings size={14} />
              {hasProductExtras && <span className="productCard__extrasIndicator" />}
            </button>
          )}
          {onEdit && (
            <button 
              className="productCard__editBtn" 
              type="button" 
              onClick={(e) => {
                e.stopPropagation()
                onEdit(product)
              }}
              aria-label="Editar producto"
            >
              ✏️
            </button>
          )}
          {onDelete && (
            <button 
              className="productCard__deleteBtn" 
              type="button" 
              onClick={(e) => {
                e.stopPropagation()
                onDelete(product)
              }}
              aria-label="Eliminar producto"
            >
              🗑️
            </button>
          )}
        </div>
      )}

      <div className={`productCard__media ${isOverlay ? 'productCard__media--overlay' : ''}`} aria-hidden="true">
        {!isPolaroid && !isMinimal && (
          <div className="productCard__badge">Popular</div>
        )}
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt=""
            className="productCard__img"
            loading="lazy"
          />
        ) : (
          <div className="productCard__glyph">{(product.name || 'P')[0]?.toUpperCase()}</div>
        )}
        
        {/* Overlay content */}
        {isOverlay && (
          <div className="productCard__overlayContent">
            <h3 className="productCard__title">{product.name}</h3>
            <div className="productCard__price">${Number(product.price).toFixed(2)}</div>
            <div className="productCard__overlayActions">
              {quantity > 0 && !disabled ? (
                <div className="stepper stepper--overlay" role="group" aria-label="Cantidad">
                  <button className="stepper__btn" type="button" onClick={onRemove} aria-label="Quitar uno">−</button>
                  <span className="stepper__value">{quantity}</span>
                  <button className="stepper__btn" type="button" onClick={onAdd} aria-label="Agregar uno">+</button>
                </div>
              ) : (
                <button 
                  className={`productCard__overlayBtn ${disabled ? 'productCard__overlayBtn--disabled' : ''}`} 
                  type="button" 
                  onClick={onAdd}
                  disabled={disabled}
                >
                  {disabled ? '🔒' : '+'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Standard content (non-overlay) */}
      {!isOverlay && (
        <div className={`productCard__content ${isHorizontal ? 'productCard__content--horizontal' : ''}`}>
          <div className="productCard__top">
            <h3 className="productCard__title">{product.name}</h3>
            <div className="productCard__price">${Number(product.price).toFixed(2)}</div>
          </div>
          
          {!isMinimal && !isPolaroid && (
            <p className="productCard__desc">{product.description || 'Sin descripción'}</p>
          )}

          <div className={`productCard__actions ${isMinimal ? 'productCard__actions--hover' : ''}`}>
            {quantity > 0 && !disabled ? (
              <div className="stepper" role="group" aria-label="Cantidad">
                <button className="stepper__btn" type="button" onClick={onRemove} aria-label="Quitar uno">−</button>
                <span className="stepper__value">{quantity}</span>
                <button className="stepper__btn" type="button" onClick={onAdd} aria-label="Agregar uno">+</button>
              </div>
            ) : (
              <Button size="sm" onClick={onAdd} disabled={disabled}>
                {disabled ? '🔒 Cerrado' : isPolaroid ? '+' : 'Agregar'}
              </Button>
            )}

            {!isMinimal && !isPolaroid && !isHorizontal && (
              <span className="productCard__meta">Entrega 20–35 min</span>
            )}
          </div>
        </div>
      )}
    </article>
  )
}
