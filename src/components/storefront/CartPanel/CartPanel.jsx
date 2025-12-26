import './CartPanel.css'
import Button from '../../ui/Button/Button'

export default function CartPanel({ items, total, onClear, onCheckout, onAdd, onRemove, storeStatus }) {
  // Format price helper
  const formatPrice = (price) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  }

  // Check if store is closed (and has a schedule defined)
  const isClosed = storeStatus && !storeStatus.isOpen && !storeStatus.noSchedule

  return (
    <aside className="cart" aria-label="Carrito">
      <header className="cart__header">
        <div>
          <div className="cart__title">Carrito</div>
          <div className="cart__subtitle">Revisa tu pedido</div>
        </div>
        <Button variant="secondary" size="sm" onClick={onClear} disabled={items.length === 0}>
          Vaciar
        </Button>
      </header>

      {items.length === 0 ? (
        <div className="cart__empty">
          <p className="muted">Aún no agregaste productos.</p>
        </div>
      ) : (
        <div className="cart__list">
          {items.map((it) => (
            <div key={it.cartItemId || it.product?.id} className="cart__row">
              <div className="cart__rowMain">
                <div className="cart__name">{it.product?.name}</div>
                <div className="cart__price">{formatPrice(it.unitPrice || it.product?.price || 0)}</div>
              </div>

              {/* Show extras if present */}
              {it.extras && it.extras.length > 0 && (
                <div className="cart__extras">
                  {it.extras.map((extra) => (
                    <div key={extra.id} className="cart__extraItem">
                      <span className="cart__extraName">+ {extra.name}</span>
                      {extra.price > 0 && (
                        <span className="cart__extraPrice">{formatPrice(extra.price)}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Show comment if present */}
              {it.comment && (
                <div className="cart__comment">
                  <span className="cart__commentText">💬 {it.comment}</span>
                </div>
              )}

              <div className="cart__rowBottom">
                <div className="cartStepper" role="group" aria-label={`Cantidad ${it.product?.name}`}>
                  <button className="cartStepper__btn" type="button" onClick={() => onRemove(it.cartItemId || it.product?.id)}>
                    −
                  </button>
                  <span className="cartStepper__value">{it.qty || it.quantity}</span>
                  <button className="cartStepper__btn" type="button" onClick={() => onAdd(it.cartItemId || it.product?.id)}>
                    +
                  </button>
                </div>
                <div className="cart__lineTotal">{formatPrice(it.lineTotal || it.totalPrice || 0)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <footer className="cart__footer">
        <div className="cart__totalRow">
          <span>Total</span>
          <strong>{formatPrice(total)}</strong>
        </div>
        {isClosed && (
          <div className="cart__closedAlert">
            <span className="cart__closedIcon">🔴</span>
            <div className="cart__closedText">
              <strong>Cerrado</strong>
              {storeStatus.nextOpen && <span>Abre {storeStatus.nextOpen}</span>}
            </div>
          </div>
        )}
        <Button onClick={onCheckout} disabled={items.length === 0 || isClosed}>
          {isClosed ? 'Local cerrado' : 'Ir a pagar'}
        </Button>
      </footer>
    </aside>
  )
}
