import { useState, useEffect } from 'react'
import './SuccessModal.css'
import { X, CheckCircle, Clock, PartyPopper, Heart, MapPin, Navigation } from 'lucide-react'
import Button from '../../ui/Button/Button'

export default function SuccessModal({ 
  isOpen, 
  onClose, 
  tenant,
  orderNumber = null,
  deliveryType = null,
  storeLocation = null,
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

  // Check if we should show store location (pickup from store)
  const isPickup = deliveryType === 'mostrador'
  const hasLocation = storeLocation && (storeLocation.lat || storeLocation.address)
  const showLocation = isPickup && hasLocation

  // Google Maps directions URL
  const mapsUrl = storeLocation?.lat && storeLocation?.lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${storeLocation.lat},${storeLocation.lng}`
    : storeLocation?.address
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(storeLocation.address)}`
      : null

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

          {/* Store Location for Pickup */}
          {showLocation && (
            <div className="successModal__locationSection">
              <div className="successModal__locationHeader">
                <MapPin size={18} />
                <span>Retirá tu pedido en:</span>
              </div>
              {storeLocation.address && (
                <p className="successModal__locationAddress">{storeLocation.address}</p>
              )}
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="successModal__locationBtn"
                >
                  <Navigation size={16} />
                  Cómo llegar
                </a>
              )}
            </div>
          )}

          <div className="successModal__footer">
            <div className="successModal__thanks">
              <Heart size={16} className="successModal__heartIcon" />
              <span>{isPickup ? '¡Te esperamos en el local!' : '¡Esperamos que disfrutes tu pedido!'}</span>
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
