import { useEffect } from 'react'
import './PaymentFailureModal.css'
import { X, Search, Lightbulb, RefreshCw } from 'lucide-react'

/**
 * Modal profesional para pago fallido/rechazado
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Si el modal está abierto
 * @param {function} props.onClose - Función para cerrar el modal
 * @param {string} props.errorReason - Razón del error (opcional)
 * @param {function} props.onRetry - Función para reintentar el pago
 * @param {function} props.onGoBack - Función para volver atrás
 */
export default function PaymentFailureModal({
  isOpen,
  onClose,
  errorReason,
  onRetry,
  onGoBack,
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

  const handleRetry = () => {
    if (onRetry) {
      onRetry()
    }
    onClose()
  }

  const handleGoBack = () => {
    if (onGoBack) {
      onGoBack()
    }
    onClose()
  }

  return (
    <div className="paymentFailureModal" role="dialog" aria-modal="true">
      <div className="paymentFailureModal__backdrop" onClick={onClose} />
      
      <div className="paymentFailureModal__content">
        {/* Header */}
        <div className="paymentFailureModal__header">
          <div className="paymentFailureModal__iconWrapper">
            <span className="paymentFailureModal__icon"><X size={32} /></span>
          </div>
          
          <h2 className="paymentFailureModal__title">Pago No Procesado</h2>
          <p className="paymentFailureModal__subtitle">
            No pudimos completar tu transacción
          </p>
        </div>

        {/* Body */}
        <div className="paymentFailureModal__body">
          {/* Mensaje principal */}
          <div className="paymentFailureModal__message">
            <p className="paymentFailureModal__messageText">
              Lo sentimos, hubo un problema al procesar tu pago. 
              No te preocupes, no se realizó ningún cargo a tu cuenta.
            </p>
          </div>

          {/* Razones posibles */}
          <div className="paymentFailureModal__reasons">
            <h4 className="paymentFailureModal__reasonsTitle">
              <Search size={18} />
              Posibles causas
            </h4>
            <ul className="paymentFailureModal__reasonsList">
              <li>Fondos insuficientes en la cuenta</li>
              <li>Datos de tarjeta incorrectos</li>
              <li>Límite de compra excedido</li>
              <li>Tarjeta vencida o bloqueada</li>
              {errorReason && <li><strong>{errorReason}</strong></li>}
            </ul>
          </div>

          {/* Ayuda */}
          <div className="paymentFailureModal__help">
            <span className="paymentFailureModal__helpIcon"><Lightbulb size={20} /></span>
            <p className="paymentFailureModal__helpText">
              Verifica los datos de tu medio de pago e intenta nuevamente. 
              Si el problema persiste, contacta a tu banco o prueba con otro método de pago.
            </p>
          </div>

          {/* Botones de acción */}
          <div className="paymentFailureModal__actions">
            <button 
              className="paymentFailureModal__retryBtn"
              onClick={handleRetry}
            >
              <RefreshCw size={18} />
              Intentar Nuevamente
            </button>
            
            <button 
              className="paymentFailureModal__secondaryBtn"
              onClick={handleGoBack}
            >
              Volver
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
