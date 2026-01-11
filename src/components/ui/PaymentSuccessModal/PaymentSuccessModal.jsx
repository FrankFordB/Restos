import { useEffect, useState } from 'react'
import './PaymentSuccessModal.css'
import { formatAmount } from '../../../lib/mercadopago'
import { Check, Mail, PartyPopper, Heart } from 'lucide-react'

/**
 * Modal profesional de agradecimiento por compra exitosa
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Si el modal está abierto
 * @param {function} props.onClose - Función para cerrar el modal
 * @param {'subscription' | 'order'} props.type - Tipo de compra
 * @param {Object} props.paymentData - Datos del pago
 * @param {string} props.paymentData.amount - Monto pagado
 * @param {string} props.paymentData.paymentId - ID del pago
 * @param {string} props.paymentData.planName - Nombre del plan (para suscripciones)
 * @param {string} props.paymentData.storeName - Nombre de la tienda (para órdenes)
 * @param {function} props.onPrimaryAction - Acción principal (ir al dashboard, ver orden, etc.)
 * @param {string} props.primaryActionLabel - Texto del botón principal
 * @param {function} props.onSecondaryAction - Acción secundaria opcional
 * @param {string} props.secondaryActionLabel - Texto del botón secundario
 */
export default function PaymentSuccessModal({
  isOpen,
  onClose,
  type = 'order',
  paymentData = {},
  onPrimaryAction,
  primaryActionLabel,
  onSecondaryAction,
  secondaryActionLabel,
}) {
  // Bloquear scroll cuando el modal está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  const isSubscription = type === 'subscription'
  
  // Mensajes según el tipo de compra
  const messages = {
    subscription: {
      title: '¡Bienvenido a Premium!',
      subtitle: 'Tu suscripción está activa',
      message: 'Gracias por confiar en nosotros. Ahora tienes acceso a todas las funcionalidades premium para hacer crecer tu negocio.',
      info: 'Recibirás un correo de confirmación con los detalles de tu suscripción. Tu plan se renovará automáticamente.',
      primaryLabel: primaryActionLabel || 'Ir a Mi Dashboard',
      secondaryLabel: secondaryActionLabel || 'Explorar Funciones Premium',
    },
    order: {
      title: '¡Pedido Confirmado!',
      subtitle: 'Tu pago fue procesado correctamente',
      message: `Gracias por tu compra${paymentData.storeName ? ` en ${paymentData.storeName}` : ''}. Tu pedido está siendo preparado con mucho cariño.`,
      info: 'Recibirás una notificación cuando tu pedido esté listo. ¡Gracias por elegirnos!',
      primaryLabel: primaryActionLabel || 'Ver Mi Pedido',
      secondaryLabel: secondaryActionLabel || 'Seguir Comprando',
    },
  }

  const content = messages[type] || messages.order

  const handlePrimaryAction = () => {
    if (onPrimaryAction) {
      onPrimaryAction()
    }
    onClose()
  }

  const handleSecondaryAction = () => {
    if (onSecondaryAction) {
      onSecondaryAction()
    }
    onClose()
  }

  return (
    <div className="paymentSuccessModal" role="dialog" aria-modal="true">
      <div className="paymentSuccessModal__backdrop" onClick={onClose} />
      
      <div className="paymentSuccessModal__content">
        {/* Header con animación */}
        <div className="paymentSuccessModal__header">
          {/* Confeti animado */}
          <div className="paymentSuccessModal__confetti">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>

          <div className="paymentSuccessModal__iconWrapper">
            <span className="paymentSuccessModal__icon"><Check size={32} /></span>
          </div>
          
          <h2 className="paymentSuccessModal__title">{content.title}</h2>
          <p className="paymentSuccessModal__subtitle">{content.subtitle}</p>
        </div>

        {/* Body */}
        <div className="paymentSuccessModal__body">
          {/* Mensaje principal */}
          <div className="paymentSuccessModal__message">
            <p className="paymentSuccessModal__messageText">
              {content.message}
            </p>
          </div>

          {/* Detalles del pago */}
          <div className="paymentSuccessModal__details">
            {paymentData.paymentId && (
              <div className="paymentSuccessModal__detailRow">
                <span className="paymentSuccessModal__detailLabel">ID de Transacción</span>
                <span className="paymentSuccessModal__detailValue">#{paymentData.paymentId}</span>
              </div>
            )}
            
            {isSubscription && paymentData.planName && (
              <div className="paymentSuccessModal__detailRow">
                <span className="paymentSuccessModal__detailLabel">Plan</span>
                <span className="paymentSuccessModal__detailValue">{paymentData.planName}</span>
              </div>
            )}
            
            {paymentData.amount && (
              <div className="paymentSuccessModal__detailRow">
                <span className="paymentSuccessModal__detailLabel">Total Pagado</span>
                <span className="paymentSuccessModal__detailValue paymentSuccessModal__detailValue--amount">
                  {typeof paymentData.amount === 'number' 
                    ? formatAmount(paymentData.amount, paymentData.currency || 'ARS')
                    : paymentData.amount
                  }
                </span>
              </div>
            )}
          </div>

          {/* Info adicional */}
          <div className="paymentSuccessModal__info">
            <span className="paymentSuccessModal__infoIcon"><Mail size={20} /></span>
            <p className="paymentSuccessModal__infoText">
              {content.info}
            </p>
          </div>

          {/* Botones de acción */}
          <div className="paymentSuccessModal__actions">
            <button 
              className="paymentSuccessModal__primaryBtn"
              onClick={handlePrimaryAction}
            >
              <PartyPopper size={18} />
              {content.primaryLabel}
            </button>
            
            {onSecondaryAction && (
              <button 
                className="paymentSuccessModal__secondaryBtn"
                onClick={handleSecondaryAction}
              >
                {content.secondaryLabel}
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="paymentSuccessModal__footer">
          <p className="paymentSuccessModal__footerText">
            Hecho con <span className="paymentSuccessModal__footerHeart"><Heart size={14} fill="currentColor" /></span> para ti
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * Hook para manejar el modal de éxito de pago
 */
export function usePaymentSuccessModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [modalData, setModalData] = useState({})

  const openModal = (data) => {
    setModalData(data)
    setIsOpen(true)
  }

  const closeModal = () => {
    setIsOpen(false)
    setModalData({})
  }

  return {
    isOpen,
    modalData,
    openModal,
    closeModal,
  }
}
