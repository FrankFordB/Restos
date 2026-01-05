import './CartPanel.css'
import Button from '../../ui/Button/Button'
import { ShoppingBag, Trash2, Plus, Minus, Package, Sparkles, ArrowRight, Clock, Pencil } from 'lucide-react'

export default function CartPanel({ items, total, onClear, onCheckout, onAdd, onRemove, onEdit, storeStatus }) {
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
  
  // Calculate total items count
  const itemCount = items.reduce((sum, item) => sum + (item.qty || item.quantity || 0), 0)

  // Handle remove entire item
  const handleRemoveItem = (itemId, quantity) => {
    for (let i = 0; i < quantity; i++) {
      onRemove(itemId)
    }
  }

  return (
    <aside className="cart" aria-label="Carrito">
      <header className="cart__header">
        <div className="cart__headerLeft">
          <div className="cart__headerIcon">
            <ShoppingBag size={20} />
          </div>
          <div className="cart__headerInfo">
            <div className="cart__title">Tu Pedido</div>
            <div className="cart__subtitle">
              {itemCount > 0 ? `${itemCount} ${itemCount === 1 ? 'producto' : 'productos'}` : 'Carrito vacío'}
            </div>
          </div>
        </div>
        {items.length > 0 && (
          <button className="cart__clearBtn" onClick={onClear}>
            <Trash2 size={14} />
            Vaciar
          </button>
        )}
      </header>

      {items.length === 0 ? (
        <div className="cart__empty">
          <div className="cart__emptyIcon">
            <ShoppingBag size={40} />
          </div>
          <p className="cart__emptyTitle">Tu carrito está vacío</p>
          <p className="cart__emptyText">Agrega productos para comenzar tu pedido</p>
        </div>
      ) : (
        <div className="cart__list">
          {items.map((it) => {
            const itemId = it.cartItemId || it.product?.id
            const quantity = it.qty || it.quantity || 1
            const hasExtras = it.extras && it.extras.length > 0
            const hasComment = it.comment && it.comment.trim() !== ''
            
            return (
              <div key={itemId} className="cart__row">
                {/* Top row: image + info + actions */}
                <div className="cart__rowTop">
                  {/* Thumbnail */}
                  <div className="cart__thumb">
                    {it.product?.imageUrl ? (
                      <img src={it.product.imageUrl} alt={it.product.name} />
                    ) : (
                      <div className="cart__thumbPlaceholder">
                        <Package size={16} />
                      </div>
                    )}
                  </div>
                  
                  {/* Info */}
                  <div className="cart__info">
                    <div className="cart__name">{it.product?.name}</div>
                    <div className="cart__unitPrice">{formatPrice(it.unitPrice || it.product?.price || 0)} c/u</div>
                  </div>

                  {/* Actions */}
                  <div className="cart__actions">
                    {onEdit && (
                      <button 
                        className="cart__actionBtn cart__actionBtn--edit"
                        onClick={() => onEdit(it)}
                        aria-label="Editar producto"
                        title="Editar extras"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    <button 
                      className="cart__actionBtn cart__actionBtn--delete"
                      onClick={() => handleRemoveItem(itemId, quantity)}
                      aria-label="Eliminar producto"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Extras tags */}
                {hasExtras && (
                  <div className="cart__extrasTags">
                    {it.extras.map((extra) => (
                      <span key={extra.id} className="cart__extraTag">
                        <Sparkles size={10} />
                        {extra.name}
                        {extra.price > 0 && <span className="cart__extraTagPrice">+{formatPrice(extra.price)}</span>}
                      </span>
                    ))}
                  </div>
                )}

                {/* Comment */}
                {hasComment && (
                  <div className="cart__commentBadge">
                    💬 {it.comment}
                  </div>
                )}

                {/* Bottom row: stepper + total */}
                <div className="cart__rowBottom">
                  <div className="cart__stepper">
                    <button 
                      className="cart__stepperBtn cart__stepperBtn--minus" 
                      type="button" 
                      onClick={() => onRemove(itemId)}
                    >
                      <Minus size={14} />
                    </button>
                    <span className="cart__stepperValue">{quantity}</span>
                    <button 
                      className="cart__stepperBtn cart__stepperBtn--plus" 
                      type="button" 
                      onClick={() => onAdd(itemId)}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <div className="cart__lineTotal">{formatPrice(it.lineTotal || it.totalPrice || 0)}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <footer className="cart__footer">
        <div className="cart__summary">
          <div className="cart__summaryRow">
            <span>Subtotal ({itemCount} productos)</span>
            <span>{formatPrice(total)}</span>
          </div>
          <div className="cart__summaryRow cart__summaryRow--total">
            <span>Total a pagar</span>
            <strong>{formatPrice(total)}</strong>
          </div>
        </div>
        
        {isClosed && (
          <div className="cart__closedAlert">
            <div className="cart__closedIcon">
              <Clock size={18} />
            </div>
            <div className="cart__closedText">
              <strong>Local cerrado</strong>
              {storeStatus.nextOpen && <span>Abre {storeStatus.nextOpen}</span>}
            </div>
          </div>
        )}
        
        <Button 
          onClick={onCheckout} 
          disabled={items.length === 0 || isClosed}
          className="cart__checkoutBtn"
        >
          <ShoppingBag size={18} />
          {isClosed ? 'Local cerrado' : 'Continuar pedido'}
          {!isClosed && <ArrowRight size={18} />}
        </Button>
      </footer>
    </aside>
  )
}
