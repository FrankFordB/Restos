import { useState, useEffect } from 'react'
import './SuccessModal.css'
import { X, CheckCircle, Clock, PartyPopper, Heart } from 'lucide-react'
import Button from '../../ui/Button/Button'

export default function SuccessModal({ 
  isOpen, 
  onClose, 
  tenant,
  orderNumber = null
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setVisible(true), 50)
      return () => clearTimeout(timer)
    } else {
      setVisible(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const storeName = tenant?.name || 'Nuestra Tienda'
  const logo = tenant?.logo || null

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 200)
  }

  return (
    <div className={`successModal__overlay ${visible ? 'successModal__overlay--visible' : ''}`}>
      <div className={`successModal ${visible ? 'successModal--visible' : ''}`}>
        <button className="successModal__close" onClick={handleClose} aria-label="Cerrar">
          <X size={20} />
        </button>

        {/* Confetti Animation */}
        <div className="successModal__confetti">
          <div className="successModal__confettiPiece"></div>
          <div className="successModal__confettiPiece"></div>
          <div className="successModal__confettiPiece"></div>
          <div className="successModal__confettiPiece"></div>
          <div className="successModal__confettiPiece"></div>
          <div className="successModal__confettiPiece"></div>
          <div className="successModal__confettiPiece"></div>
          <div className="successModal__confettiPiece"></div>
        </div>

        {/* Success Icon */}
        <div className="successModal__iconWrapper">
          <div className="successModal__iconBg">
            <CheckCircle size={48} className="successModal__icon" />
          </div>
          <div className="successModal__pulse"></div>
        </div>

        {/* Content */}
        <div className="successModal__body">
          <h2 className="successModal__title">
            <PartyPopper size={24} className="successModal__titleIcon" />
            ¡Pedido Confirmado!
            <PartyPopper size={24} className="successModal__titleIcon successModal__titleIcon--flip" />
          </h2>
          
          <p className="successModal__message">
            Gracias por tu compra en <strong>{storeName}</strong>
          </p>

          <div className="successModal__status">
            <div className="successModal__statusIcon">
              <Clock size={20} />
            </div>
            <div className="successModal__statusText">
              <span className="successModal__statusLabel">Estado del pedido</span>
              <span className="successModal__statusValue">En preparación</span>
            </div>
          </div>

          {orderNumber && (
            <div className="successModal__orderNumber">
              <span>Nº de pedido:</span>
              <strong>{orderNumber}</strong>
            </div>
          )}

          <div className="successModal__footer">
            <div className="successModal__thanks">
              <Heart size={16} className="successModal__heartIcon" />
              <span>¡Esperamos que disfrutes tu pedido!</span>
            </div>
          </div>

          {/* CTA Button */}
          <div className="successModal__actions">
            <Button onClick={handleClose} className="successModal__cta">
              Volver a la tienda
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
