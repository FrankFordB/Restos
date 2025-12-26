import './ProductCard.css'
import Button from '../../ui/Button/Button'

export default function ProductCard({ 
  product, 
  quantity = 0, 
  onAdd, 
  onRemove,
  onEdit,
  onDelete,
  layout = 'classic',
  colors = {},
  isEditable = false,
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

  const isOutOfStock = product.trackStock && (product.stock ?? 0) <= 0;
  return (
    <article className={`productCard ${layoutClass} ${isBanner ? 'productCard--fullWidth' : ''}`} style={cardStyle}>
      {/* Editable actions */}
      {isEditable && (
        <div className="productCard__editActions">
          {onEdit && (
            <button 
              className="productCard__editBtn" 
              type="button" 
              onClick={() => onEdit(product)}
              aria-label="Editar producto"
            >
              ✏️
            </button>
          )}
          {onDelete && (
            <button 
              className="productCard__deleteBtn" 
              type="button" 
              onClick={() => onDelete(product)}
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
              {quantity > 0 ? (
                <div className="stepper stepper--overlay" role="group" aria-label="Cantidad">
                  <button className="stepper__btn" type="button" onClick={onRemove} aria-label="Quitar uno">−</button>
                  <span className="stepper__value">{quantity}</span>
                  <button className="stepper__btn" type="button" onClick={onAdd} aria-label="Agregar uno">+</button>
                </div>
              ) : (
                <button className="productCard__overlayBtn" type="button" onClick={onAdd}>+</button>
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
              <Button size="sm" disabled style={{ background: '#ccc', color: '#888', cursor: 'not-allowed' }}>
                Sin stock
              </Button>
            ) : quantity > 0 ? (
              <div className="stepper" role="group" aria-label="Cantidad">
                <button className="stepper__btn" type="button" onClick={onRemove} aria-label="Quitar uno">−</button>
                <span className="stepper__value">{quantity}</span>
                <button className="stepper__btn" type="button" onClick={onAdd} aria-label="Agregar uno">+</button>
              </div>
            ) : (
              <Button size="sm" onClick={onAdd}>
                {isPolaroid ? '+' : 'Agregar'}
              </Button>
            )}

            {/* Mostrar stock solo si trackStock está activo y el stock es un número */}
            {product.trackStock && Number.isFinite(product.stock) && (
              <span className="productCard__meta" style={{ marginLeft: 8, color: '#888', fontSize: '0.9em' }}>
                Stock: {product.stock}
              </span>
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
