import { useState, useEffect } from 'react'
import './FloatingCart.css'
import { ShoppingCart, X, Trash2, Plus, Minus, ArrowRight, ShoppingBag, Sparkles, Package } from 'lucide-react'
import Button from '../../ui/Button/Button'

export default function FloatingCart({
  items = [],
  total = 0,
  onAdd,
  onRemove,
  onRemoveItem,
  onClear,
  onCheckout,
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [prevCount, setPrevCount] = useState(0)
  const [removingItem, setRemovingItem] = useState(null)

  const itemCount = items.reduce((sum, item) => sum + (item.qty || item.quantity || 0), 0)

  // Animate when items are added
  useEffect(() => {
    if (itemCount > prevCount) {
      setIsAnimating(true)
      const timer = setTimeout(() => setIsAnimating(false), 300)
      return () => clearTimeout(timer)
    }
    setPrevCount(itemCount)
  }, [itemCount, prevCount])

  // Format price helper
  const formatPrice = (price) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  }

  // Close modal when pressing escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Don't show if cart is empty
  if (items.length === 0) return null

  const handleCheckout = () => {
    setIsOpen(false)
    onCheckout?.()
  }

  // Handle remove entire item with animation
  const handleRemoveItem = (itemId) => {
    setRemovingItem(itemId)
    setTimeout(() => {
      // Remove all quantities of this item
      const item = items.find(i => (i.cartItemId || i.product?.id) === itemId)
      if (item) {
        const qty = item.qty || item.quantity || 1
        for (let i = 0; i < qty; i++) {
          onRemove?.(itemId)
        }
      }
      setRemovingItem(null)
    }, 200)
  }

  return (
    <>
      {/* Floating Button - Enhanced */}
      <button
        className={`floatingCart__button ${isAnimating ? 'floatingCart__button--animate' : ''}`}
        onClick={() => setIsOpen(true)}
        aria-label={`Carrito: ${itemCount} productos`}
      >
        <div className="floatingCart__iconWrapper">
          <ShoppingBag size={22} />
          <span className="floatingCart__badge">{itemCount}</span>
        </div>
        <div className="floatingCart__info">
          <span className="floatingCart__label">Ver carrito</span>
          <span className="floatingCart__total">{formatPrice(total)}</span>
        </div>
        <ArrowRight size={18} className="floatingCart__arrow" />
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div className="floatingCart__overlay" onClick={() => setIsOpen(false)}>
          <div 
            className="floatingCart__modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header - Enhanced */}
            <div className="floatingCart__header">
              <div className="floatingCart__headerLeft">
                <div className="floatingCart__headerIcon">
                  <ShoppingBag size={20} />
                </div>
                <div className="floatingCart__headerInfo">
                  <h2>Tu Pedido</h2>
                  <span className="floatingCart__headerCount">
                    {itemCount} {itemCount === 1 ? 'producto' : 'productos'}
                  </span>
                </div>
              </div>
              <button 
                className="floatingCart__closeBtn"
                onClick={() => setIsOpen(false)}
                aria-label="Cerrar carrito"
              >
                <X size={24} />
              </button>
            </div>

            {/* Items List - Enhanced */}
            <div className="floatingCart__items">
              {items.map((item) => {
                const itemId = item.cartItemId || item.product?.id
                const isRemoving = removingItem === itemId
                
                return (
                  <div 
                    key={itemId} 
                    className={`floatingCart__item ${isRemoving ? 'floatingCart__item--removing' : ''}`}
                  >
                    {/* Product Image */}
                    <div className="floatingCart__itemImageWrapper">
                      {item.product?.imageUrl ? (
                        <img 
                          src={item.product.imageUrl} 
                          alt={item.product.name}
                          className="floatingCart__itemImage"
                        />
                      ) : (
                        <div className="floatingCart__itemImagePlaceholder">
                          <Package size={24} />
                        </div>
                      )}
                      <span className="floatingCart__itemQtyBadge">
                        {item.qty || item.quantity}
                      </span>
                    </div>
                    
                    <div className="floatingCart__itemContent">
                      <div className="floatingCart__itemHeader">
                        <div className="floatingCart__itemName">{item.product?.name}</div>
                        <button 
                          className="floatingCart__itemRemoveBtn"
                          onClick={() => handleRemoveItem(itemId)}
                          aria-label="Eliminar producto"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      
                      {/* Extras */}
                      {item.extras && item.extras.length > 0 && (
                        <div className="floatingCart__itemExtras">
                          {item.extras.map((extra) => (
                            <span key={extra.id} className="floatingCart__extra">
                              <Sparkles size={10} />
                              {extra.name}
                              {extra.price > 0 && ` (+${formatPrice(extra.price)})`}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      <div className="floatingCart__itemFooter">
                        <div className="floatingCart__itemPrice">
                          {formatPrice(item.unitPrice || item.product?.price || 0)} c/u
                        </div>

                        {/* Quantity Controls - Enhanced */}
                        <div className="floatingCart__stepper">
                          <button 
                            className="floatingCart__stepperBtn floatingCart__stepperBtn--minus"
                            onClick={() => onRemove?.(itemId)}
                            aria-label="Quitar uno"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="floatingCart__stepperValue">
                            {item.qty || item.quantity}
                          </span>
                          <button 
                            className="floatingCart__stepperBtn floatingCart__stepperBtn--plus"
                            onClick={() => onAdd?.(itemId)}
                            aria-label="Agregar uno"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                      
                      <div className="floatingCart__itemTotal">
                        {formatPrice(item.lineTotal || item.totalPrice || 0)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Footer - Enhanced */}
            <div className="floatingCart__footer">
              <div className="floatingCart__footerTop">
                <button 
                  className="floatingCart__clearBtn"
                  onClick={onClear}
                >
                  <Trash2 size={14} />
                  Vaciar todo
                </button>
              </div>

              <div className="floatingCart__summary">
                <div className="floatingCart__summaryRow">
                  <span>Subtotal ({itemCount} productos)</span>
                  <span>{formatPrice(total)}</span>
                </div>
                <div className="floatingCart__summaryRow floatingCart__summaryRow--total">
                  <span>Total a pagar</span>
                  <strong>{formatPrice(total)}</strong>
                </div>
              </div>

              <Button 
                onClick={handleCheckout}
                disabled={disabled || items.length === 0}
                className="floatingCart__checkoutBtn"
              >
                <ShoppingBag size={18} />
                Continuar con el pedido
                <ArrowRight size={18} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
