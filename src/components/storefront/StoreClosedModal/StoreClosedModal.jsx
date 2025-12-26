import './StoreClosedModal.css'
import { X, Clock, Calendar, AlertCircle } from 'lucide-react'
import { formatOpeningHours } from '../../../shared/openingHours'

export default function StoreClosedModal({ 
  isOpen, 
  onClose, 
  openingHours = [], 
  nextOpen,
  theme = {},
  tenantName = 'Restaurante'
}) {
  if (!isOpen) return null

  const formattedHours = formatOpeningHours(openingHours)
  const accentColor = theme?.accent || '#f59e0b'
  const primaryColor = theme?.primary || '#1a1a2e'

  // Group hours by time range to consolidate same schedules
  const groupedHours = formattedHours.reduce((acc, curr) => {
    const existing = acc.find(g => g.hours === curr.hours)
    if (existing) {
      existing.days.push(curr.day)
    } else {
      acc.push({ hours: curr.hours, days: [curr.day] })
    }
    return acc
  }, [])

  return (
    <div className="storeClosedModal__overlay" onClick={onClose}>
      <div 
        className="storeClosedModal" 
        onClick={e => e.stopPropagation()}
        style={{ '--modal-accent': accentColor, '--modal-primary': primaryColor }}
      >
        {/* Header with themed gradient */}
        <div className="storeClosedModal__header">
          <button className="storeClosedModal__close" onClick={onClose}>
            <X size={20} />
          </button>
          <div className="storeClosedModal__icon">
            <Clock size={32} />
          </div>
          <h2 className="storeClosedModal__title">¡Estamos cerrados!</h2>
          <p className="storeClosedModal__subtitle">{tenantName}</p>
        </div>

        {/* Body */}
        <div className="storeClosedModal__body">
          <div className="storeClosedModal__message">
            <AlertCircle size={18} />
            <p>
              Disculpa las molestias, en este momento no estamos atendiendo pedidos.
              Te invitamos a volver durante nuestro horario de atención.
            </p>
          </div>

          {nextOpen && (
            <div className="storeClosedModal__nextOpen">
              <span className="storeClosedModal__nextOpenLabel">Próxima apertura:</span>
              <span className="storeClosedModal__nextOpenTime">{nextOpen}</span>
            </div>
          )}

          {formattedHours.length > 0 && (
            <div className="storeClosedModal__schedule">
              <h3 className="storeClosedModal__scheduleTitle">
                <Calendar size={16} />
                Nuestros horarios
              </h3>
              <div className="storeClosedModal__scheduleList">
                {groupedHours.map((group, idx) => (
                  <div key={idx} className="storeClosedModal__scheduleItem">
                    <span className="storeClosedModal__scheduleDays">
                      {group.days.join(', ')}
                    </span>
                    <span className="storeClosedModal__scheduleHours">
                      {group.hours}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {formattedHours.length === 0 && (
            <p className="storeClosedModal__noSchedule">
              No hay horarios configurados. Contacta al restaurante para más información.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="storeClosedModal__footer">
          <button className="storeClosedModal__button" onClick={onClose}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}
