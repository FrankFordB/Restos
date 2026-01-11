import './ScheduledChangeModal.css'
import { Calendar, ArrowRight, Check, X } from 'lucide-react'
import Button from '../Button/Button'
import { TIER_LABELS, TIER_ICONS, TIER_COLORS } from '../../../shared/subscriptions'

/**
 * Modal moderno que muestra la confirmación de un cambio de plan programado
 */
export default function ScheduledChangeModal({
  isOpen,
  currentTier,
  newTier,
  effectiveDate,
  onClose,
  onCancelSchedule,
}) {
  if (!isOpen) return null

  const currentLabel = TIER_LABELS[currentTier] || 'Premium Pro'
  const scheduledLabel = TIER_LABELS[newTier] || 'Premium'
  const currentColor = TIER_COLORS[currentTier] || '#8b5cf6'
  const scheduledColor = TIER_COLORS[newTier] || '#f59e0b'
  
  const formattedDate = effectiveDate 
    ? new Date(effectiveDate).toLocaleDateString('es-AR', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      })
    : 'que expire tu suscripción'

  return (
    <div className="scheduledModal__overlay" onClick={onClose}>
      <div className="scheduledModal__card" onClick={e => e.stopPropagation()}>
        {/* Header con icono de éxito */}
        <div className="scheduledModal__header">
          <div className="scheduledModal__successIcon">
            <Check size={32} strokeWidth={3} />
          </div>
          <h2 className="scheduledModal__title">¡Cambio programado!</h2>
          <p className="scheduledModal__subtitle">Tu solicitud ha sido procesada correctamente</p>
        </div>

        {/* Contenido */}
        <div className="scheduledModal__content">
          {/* Visual de cambio de plan */}
          <div className="scheduledModal__planChange">
            <div className="scheduledModal__plan" style={{ '--plan-color': currentColor }}>
              <span className="scheduledModal__planIcon">{TIER_ICONS[currentTier]}</span>
              <span className="scheduledModal__planLabel">{currentLabel}</span>
              <span className="scheduledModal__planStatus">Plan actual</span>
            </div>
            
            <div className="scheduledModal__arrow">
              <ArrowRight size={24} />
            </div>
            
            <div className="scheduledModal__plan scheduledModal__plan--scheduled" style={{ '--plan-color': scheduledColor }}>
              <span className="scheduledModal__planIcon">{TIER_ICONS[newTier]}</span>
              <span className="scheduledModal__planLabel">{scheduledLabel}</span>
              <span className="scheduledModal__planStatus">A partir del {formattedDate.split(' de ')[0]}</span>
            </div>
          </div>

          {/* Info de fecha */}
          <div className="scheduledModal__dateInfo">
            <Calendar size={20} />
            <div>
              <strong>Tu plan actual seguirá activo</strong>
              <p>Mantendrás todos los beneficios de {currentLabel} hasta el <strong>{formattedDate}</strong>.</p>
            </div>
          </div>

          {/* Qué esperar */}
          <div className="scheduledModal__whatToExpect">
            <h4>¿Qué pasará después?</h4>
            <ul>
              <li>
                <Check size={16} />
                <span>Seguirás disfrutando de {currentLabel} con todas sus funciones</span>
              </li>
              <li>
                <Check size={16} />
                <span>El cambio se aplicará automáticamente el {formattedDate}</span>
              </li>
              <li>
                <Check size={16} />
                <span>Puedes cancelar este cambio en cualquier momento</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Acciones */}
        <div className="scheduledModal__actions">
          <Button variant="primary" onClick={onClose}>
            Entendido
          </Button>
          {onCancelSchedule && (
            <button className="scheduledModal__cancelLink" onClick={onCancelSchedule}>
              Cancelar cambio programado
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
