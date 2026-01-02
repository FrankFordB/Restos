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
  stockLimit = null, // Límite efectivo de stock (mínimo entre producto y categoría)
  categoryName = null, // Nombre de la categoría para el mensaje
  isPopular = false, // Si es uno de los 3 productos más vendidos
  isLimitedByCategory = false, // Si el límite viene del stock global de categoría
}) {
  const layoutClass = `productCard--${layout}`
  
  // Detectar si el producto está sin stock (considerando límite efectivo)
  const effectiveStock = stockLimit !== null ? stockLimit : (product.stock ?? null)
  const isOutOfStock = effectiveStock !== null && effectiveStock === 0
  const isLowStock = effectiveStock !== null && effectiveStock > 0 && effectiveStock <= 5
  
  // Verificar si al agregar uno más se excedería el stock
  const wouldExceedStock = effectiveStock !== null && quantity >= effectiveStock
  const canAddMore = !wouldExceedStock && !isOutOfStock
  
  const isDisabled = disabled || isOutOfStock
  const isAddDisabled = disabled || !canAddMore
  
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
      className={`productCard ${layoutClass} ${isBanner ? 'productCard--fullWidth' : ''} ${(onClick && !isEditable) || isEditable ? 'productCard--clickable' : ''} ${isDisabled ? 'productCard--disabled' : ''} ${isOutOfStock ? 'productCard--outOfStock' : ''} ${isLowStock ? 'productCard--lowStock' : ''} ${wouldExceedStock && !isOutOfStock ? 'productCard--maxReached' : ''}`} 
      style={cardStyle}
      onClick={handleCardClick}
    >
      {/* Badge Popular - solo para los 3 más vendidos */}
      {isPopular && !isOutOfStock && !wouldExceedStock && !isLowStock && (
        <div className="productCard__popularBadge">
          <span>🔥 Popular</span>
        </div>
      )}
      
      {/* Badge de Sin Stock */}
      {isOutOfStock && (
        <div className="productCard__outOfStockBadge">
          <span>AGOTADO</span>
        </div>
      )}
      
      {/* Badge de Máximo alcanzado (cuando hay items en carrito pero no puede agregar más) */}
      {wouldExceedStock && !isOutOfStock && (
        <div className={`productCard__maxStockBadge ${isLimitedByCategory ? 'productCard__maxStockBadge--category' : ''}`}>
          <span>{effectiveStock === 1 ? `ÚLTIMA: ${effectiveStock}` : `ÚLTIMAS: ${effectiveStock}`}</span>
        </div>
      )}
      
      {/* Badge de Últimas unidades */}
      {isLowStock && !isOutOfStock && !wouldExceedStock && (
        <div className={`productCard__lowStockBadge ${isLimitedByCategory ? 'productCard__lowStockBadge--category' : ''}`}>
          <span>{effectiveStock === 1 ? `¡ÚLTIMA!` : `¡ÚLTIMAS: ${effectiveStock}!`}</span>
        </div>
      )}
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

      <div 
        className={`productCard__media ${isOverlay ? 'productCard__media--overlay' : ''}`} 
        aria-hidden="true"
      >
        {/* Liquid Glass background effect cuando hay zoom < 1 */}
        {product.imageUrl && product.focalPoint?.zoom && product.focalPoint.zoom < 1 && (
          <>
            <div 
              className="productCard__liquidBg"
              style={{
                backgroundImage: `url(${product.imageUrl})`,
              }}
            />
            <div 
              className="productCard__liquidOverlay"
              style={{
                backgroundColor: product.focalPoint.bgColor || 'rgba(0,0,0,0.1)',
              }}
            />
          </>
        )}
        
        {product.imageUrl ? (
          product.focalPoint?.zoom && product.focalPoint.zoom !== 1 ? (
            <div
              className="productCard__img productCard__img--bg"
              style={{
                backgroundImage: `url(${product.imageUrl})`,
                backgroundPosition: `${product.focalPoint.x}% ${product.focalPoint.y}%`,
                backgroundSize: `${product.focalPoint.zoom * 100}%`,
              }}
            />
          ) : (
            <img
              src={product.imageUrl}
              alt=""
              className="productCard__img"
              loading="lazy"
              style={product.focalPoint ? {
                objectPosition: `${product.focalPoint.x}% ${product.focalPoint.y}%`
              } : undefined}
            />
          )
        ) : (
          <div className="productCard__glyph">{(product.name || 'P')[0]?.toUpperCase()}</div>
        )}
        
        {/* Overlay content */}
        {isOverlay && (
          <div className="productCard__overlayContent">
            <h3 className="productCard__title">{product.name}</h3>
            <div className="productCard__price">${Number(product.price).toFixed(2)}</div>
            <div className="productCard__overlayActions">
              {isOutOfStock ? (
                <span className="productCard__overlayOutOfStock">Sin stock</span>
              ) : quantity > 0 && !isDisabled ? (
                <div className="stepper stepper--overlay" role="group" aria-label="Cantidad">
                  <button className="stepper__btn" type="button" onClick={onRemove} aria-label="Quitar uno">−</button>
                  <span className="stepper__value">{quantity}</span>
                  <button 
                    className={`stepper__btn ${!canAddMore ? 'stepper__btn--disabled' : ''}`} 
                    type="button" 
                    onClick={canAddMore ? onAdd : undefined} 
                    disabled={!canAddMore}
                    aria-label="Agregar uno"
                    title={!canAddMore ? `Stock insuficiente: quedan ${effectiveStock}` : 'Agregar uno'}
                  >+</button>
                </div>
              ) : (
                <button 
                  className={`productCard__overlayBtn ${isAddDisabled ? 'productCard__overlayBtn--disabled' : ''}`} 
                  type="button" 
                  onClick={!isAddDisabled ? onAdd : undefined}
                  disabled={isAddDisabled}
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
            {isOutOfStock ? (
              <span className="productCard__outOfStockText">Sin stock disponible</span>
            ) : quantity > 0 && !isDisabled ? (
              <div className="stepper" role="group" aria-label="Cantidad">
                <button className="stepper__btn" type="button" onClick={onRemove} aria-label="Quitar uno">−</button>
                <span className="stepper__value">{quantity}</span>
                <button 
                  className={`stepper__btn ${!canAddMore ? 'stepper__btn--disabled' : ''}`} 
                  type="button" 
                  onClick={canAddMore ? onAdd : undefined} 
                  disabled={!canAddMore}
                  aria-label="Agregar uno"
                  title={!canAddMore ? `Stock insuficiente: quedan ${effectiveStock}` : 'Agregar uno'}
                >+</button>
              </div>
            ) : (
              <Button size="sm" onClick={!isAddDisabled ? onAdd : undefined} disabled={isAddDisabled}>
                {disabled ? '🔒 Cerrado' : isPolaroid ? '+' : 'Agregar'}
              </Button>
            )}

            {/* Mensaje de stock máximo alcanzado */}
            {wouldExceedStock && !isOutOfStock && quantity > 0 && (
              <span className="productCard__stockLimitText">
                Stock insuficiente: quedan {effectiveStock}
              </span>
            )}

            {!isMinimal && !isPolaroid && !isHorizontal && !wouldExceedStock && (
              <span className="productCard__meta">Entrega 20–35 min</span>
            )}
          </div>
        </div>
      )}
    </article>
  )
}
