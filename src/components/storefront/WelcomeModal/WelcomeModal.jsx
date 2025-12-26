import { useState, useEffect } from 'react'
import './WelcomeModal.css'
import { X, ArrowRight } from 'lucide-react'
import Button from '../../ui/Button/Button'

export default function WelcomeModal({ 
  isOpen, 
  onClose, 
  tenant,
  isPreviewMode = false 
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      // Small delay for animation
      const timer = setTimeout(() => setVisible(true), 50)
      return () => clearTimeout(timer)
    } else {
      setVisible(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  // Get content - use custom or generate defaults
  const title = tenant?.welcome_modal_title || tenant?.name || '¡Bienvenido!'
  const message = tenant?.welcome_modal_message || 
    tenant?.slogan || 
    tenant?.description || 
    `¡Bienvenido a ${tenant?.name || 'nuestro restaurante'}! Explora nuestro menú y realiza tu pedido.`
  const image = tenant?.welcome_modal_image || tenant?.logo || null

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 200)
  }

  return (
    <div className={`welcomeModal__overlay ${visible ? 'welcomeModal__overlay--visible' : ''}`}>
      <div className={`welcomeModal ${visible ? 'welcomeModal--visible' : ''}`}>
        {isPreviewMode && (
          <div className="welcomeModal__previewBadge">
            Vista previa
          </div>
        )}
        
        <button className="welcomeModal__close" onClick={handleClose}>
          <X size={20} />
        </button>

        {image && (
          <div className="welcomeModal__imageContainer">
            <img src={image} alt={tenant?.name || 'Welcome'} className="welcomeModal__image" />
          </div>
        )}

        {!image && (
          <div className="welcomeModal__iconContainer">
            <span className="welcomeModal__icon">🍔</span>
          </div>
        )}

        <div className="welcomeModal__content">
          <h2 className="welcomeModal__title">{title}</h2>
          <p className="welcomeModal__message">{message}</p>
        </div>

        <div className="welcomeModal__actions">
          <Button onClick={handleClose}>
            Explorar menú
            <ArrowRight size={18} />
          </Button>
        </div>
      </div>
    </div>
  )
}
