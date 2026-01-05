import { useState, useEffect, useCallback } from 'react'
import './CartToast.css'
import { ShoppingBag, Check, Trash2, Plus, Minus, X } from 'lucide-react'

/**
 * CartToast - Toast notification component for cart actions
 * Shows feedback when adding, removing, or updating cart items
 */
export default function CartToast({ toast, onDismiss }) {
  const [isVisible, setIsVisible] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  useEffect(() => {
    if (toast) {
      setIsVisible(true)
      setIsLeaving(false)
      
      // Auto dismiss after duration
      const timer = setTimeout(() => {
        handleDismiss()
      }, toast.duration || 3000)
      
      return () => clearTimeout(timer)
    }
  }, [toast])

  const handleDismiss = useCallback(() => {
    setIsLeaving(true)
    setTimeout(() => {
      setIsVisible(false)
      setIsLeaving(false)
      onDismiss?.()
    }, 300)
  }, [onDismiss])

  if (!toast || !isVisible) return null

  const getIcon = () => {
    switch (toast.type) {
      case 'add':
        return <Plus size={18} />
      case 'remove':
        return <Minus size={18} />
      case 'delete':
        return <Trash2 size={18} />
      case 'clear':
        return <Trash2 size={18} />
      case 'success':
        return <Check size={18} />
      default:
        return <ShoppingBag size={18} />
    }
  }

  const getTypeClass = () => {
    switch (toast.type) {
      case 'add':
        return 'cartToast--add'
      case 'remove':
      case 'delete':
      case 'clear':
        return 'cartToast--remove'
      case 'success':
        return 'cartToast--success'
      default:
        return ''
    }
  }

  return (
    <div className={`cartToast ${getTypeClass()} ${isLeaving ? 'cartToast--leaving' : ''}`}>
      <div className="cartToast__icon">
        {getIcon()}
      </div>
      <div className="cartToast__content">
        <span className="cartToast__message">{toast.message}</span>
        {toast.productName && (
          <span className="cartToast__product">{toast.productName}</span>
        )}
      </div>
      <button className="cartToast__close" onClick={handleDismiss}>
        <X size={16} />
      </button>
    </div>
  )
}

// Hook to manage cart toasts
export function useCartToast() {
  const [toast, setToast] = useState(null)

  const showToast = useCallback((options) => {
    setToast({
      id: Date.now(),
      duration: 2500,
      ...options,
    })
  }, [])

  const dismissToast = useCallback(() => {
    setToast(null)
  }, [])

  // Convenience methods
  const showAddToast = useCallback((productName, quantity = 1) => {
    showToast({
      type: 'add',
      message: quantity > 1 ? `${quantity}× agregados al carrito` : 'Agregado al carrito',
      productName,
    })
  }, [showToast])

  const showRemoveToast = useCallback((productName) => {
    showToast({
      type: 'remove',
      message: 'Cantidad reducida',
      productName,
    })
  }, [showToast])

  const showDeleteToast = useCallback((productName) => {
    showToast({
      type: 'delete',
      message: 'Eliminado del carrito',
      productName,
    })
  }, [showToast])

  const showClearToast = useCallback(() => {
    showToast({
      type: 'clear',
      message: 'Carrito vaciado',
    })
  }, [showToast])

  return {
    toast,
    showToast,
    dismissToast,
    showAddToast,
    showRemoveToast,
    showDeleteToast,
    showClearToast,
  }
}
