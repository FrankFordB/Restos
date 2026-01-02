import { useState, useEffect } from 'react'
import './FloatingCart.css'
import { ShoppingCart, X, Trash2, Plus, Minus, ArrowRight } from 'lucide-react'
import Button from '../../ui/Button/Button'

export default function FloatingCart({
  items = [],
  total = 0,
  onAdd,
  onRemove,
  onClear,
  onCheckout,
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [prevCount, setPrevCount] = useState(0)

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

  return (
    <>
      {/* Floating Button */}
      <button
        className={`floatingCart__button ${isAnimating ? 'floatingCart__button--animate' : ''}`}
        onClick={() => setIsOpen(true)}
        aria-label={`Carrito: ${itemCount} productos`}
      >
        <div className="floatingCart__iconWrapper">
          <ShoppingCart size={24} />
          <span className="floatingCart__badge">{itemCount}</span>
        </div>
        <div className="floatingCart__info">
          <span className="floatingCart__total">{formatPrice(total)}</span>
        </div>
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div className="floatingCart__overlay" onClick={() => setIsOpen(false)}>
          <div 
            className="floatingCart__modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="floatingCart__header">
              <div className="floatingCart__headerTitle">
                <ShoppingCart size={20} />
                <h2>Tu Carrito</h2>
                <span className="floatingCart__headerCount">{itemCount} productos</span>
              </div>
              <button 
                className="floatingCart__closeBtn"
                onClick={() => setIsOpen(false)}
                aria-label="Cerrar carrito"
              >
                <X size={24} />
              </button>
            </div>

            {/* Items List */}
            <div className="floatingCart__items">
              {items.map((item) => (
                <div key={item.cartItemId || item.product?.id} className="floatingCart__item">
                  {/* Product Image */}
                  {item.product?.imageUrl && (
                    <div className="floatingCart__itemImage">
                      <img src={item.product.imageUrl} alt={item.product.name} />
                    </div>
                  )}
                  
                  <div className="floatingCart__itemInfo">
                    <div className="floatingCart__itemName">{item.product?.name}</div>
                    
                    {/* Extras */}
                    {item.extras && item.extras.length > 0 && (
                      <div className="floatingCart__itemExtras">
                        {item.extras.map((extra) => (
                          <span key={extra.id} className="floatingCart__extra">
                            + {extra.name}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    <div className="floatingCart__itemPrice">
                      {formatPrice(item.unitPrice || item.product?.price || 0)}
                    </div>
                  </div>

                  {/* Quantity Controls */}
                  <div className="floatingCart__itemActions">
                    <div className="floatingCart__stepper">
                      <button 
                        className="floatingCart__stepperBtn"
                        onClick={() => onRemove?.(item.cartItemId || item.product?.id)}
                        aria-label="Quitar uno"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="floatingCart__stepperValue">
                        {item.qty || item.quantity}
                      </span>
                      <button 
                        className="floatingCart__stepperBtn"
                        onClick={() => onAdd?.(item.cartItemId || item.product?.id)}
                        aria-label="Agregar uno"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    <div className="floatingCart__itemTotal">
                      {formatPrice(item.lineTotal || item.totalPrice || 0)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="floatingCart__footer">
              <button 
                className="floatingCart__clearBtn"
                onClick={onClear}
              >
                <Trash2 size={16} />
                Vaciar carrito
              </button>

              <div className="floatingCart__totalRow">
                <span>Total</span>
                <strong>{formatPrice(total)}</strong>
              </div>

              <Button 
                onClick={handleCheckout}
                disabled={disabled || items.length === 0}
                className="floatingCart__checkoutBtn"
              >
                Ir a pagar
                <ArrowRight size={18} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
