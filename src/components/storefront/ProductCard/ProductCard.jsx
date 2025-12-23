import './ProductCard.css'
import Button from '../../ui/Button/Button'

export default function ProductCard({ product, quantity = 0, onAdd, onRemove }) {
  return (
    <article className="productCard">
      <div className="productCard__media" aria-hidden="true">
        <div className="productCard__badge">Popular</div>
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
      </div>

      <div className="productCard__content">
        <div className="productCard__top">
          <h3 className="productCard__title">{product.name}</h3>
          <div className="productCard__price">${Number(product.price).toFixed(2)}</div>
        </div>
        <p className="productCard__desc">{product.description || 'Sin descripción'}</p>

        <div className="productCard__actions">
          {quantity > 0 ? (
            <div className="stepper" role="group" aria-label="Cantidad">
              <button className="stepper__btn" type="button" onClick={onRemove} aria-label="Quitar uno">
                −
              </button>
              <span className="stepper__value">{quantity}</span>
              <button className="stepper__btn" type="button" onClick={onAdd} aria-label="Agregar uno">
                +
              </button>
            </div>
          ) : (
            <Button size="sm" onClick={onAdd}>
              Agregar
            </Button>
          )}

          <span className="productCard__meta">Entrega 20–35 min</span>
        </div>
      </div>
    </article>
  )
}
