import './CartPanel.css'
import Button from '../../ui/Button/Button'

export default function CartPanel({ items, total, onClear, onCheckout, onAdd, onRemove }) {
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
            <div key={it.product.id} className="cart__row">
              <div className="cart__rowMain">
                <div className="cart__name">{it.product.name}</div>
                <div className="cart__price">${it.product.price.toFixed(2)}</div>
              </div>

              <div className="cart__rowBottom">
                <div className="cartStepper" role="group" aria-label={`Cantidad ${it.product.name}`}>
                  <button className="cartStepper__btn" type="button" onClick={() => onRemove(it.product.id)}>
                    −
                  </button>
                  <span className="cartStepper__value">{it.qty}</span>
                  <button className="cartStepper__btn" type="button" onClick={() => onAdd(it.product.id)}>
                    +
                  </button>
                </div>
                <div className="cart__lineTotal">${it.lineTotal.toFixed(2)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <footer className="cart__footer">
        <div className="cart__totalRow">
          <span>Total</span>
          <strong>${total.toFixed(2)}</strong>
        </div>
        <Button onClick={onCheckout} disabled={items.length === 0}>
          Ir a pagar
        </Button>
      </footer>
    </aside>
  )
}
