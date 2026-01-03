import './StoreClosedModal.css'
import { X, Clock, Calendar, AlertCircle, Pause, ShoppingBag, Crown } from 'lucide-react'
import { formatOpeningHours } from '../../../shared/openingHours'
import { TIER_LABELS } from '../../../shared/subscriptions'

export default function StoreClosedModal({ 
  isOpen, 
  onClose, 
  openingHours = [], 
  nextOpen,
  theme = {},
  tenantName = 'Restaurante',
  isPaused = false,
  pauseMessage = '',
  // Order limit props
  isOrderLimitReached = false,
  ordersRemaining = 0,
  ordersLimit = 15,
  subscriptionTier = 'free',
  resetDate = null
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

  // Format reset date for display (now daily)
  const formatResetDate = (dateStr) => {
    if (!dateStr) return 'mañana a las 00:00'
    const date = new Date(dateStr)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    const isTomorrow = date.toDateString() === new Date(now.getTime() + 86400000).toDateString()
    
    if (isToday) return 'hoy a las 00:00'
    if (isTomorrow) return 'mañana a las 00:00'
    
    return date.toLocaleDateString('es-ES', { 
      weekday: 'long',
      day: 'numeric', 
      month: 'long'
    }) + ' a las 00:00'
  }

  // If order limit reached, show that message
  if (isOrderLimitReached) {
    return (
      <div className="storeClosedModal__overlay">
        <div 
          className="storeClosedModal storeClosedModal--orderLimit"
          style={{ '--modal-accent': '#ef4444', '--modal-primary': primaryColor }}
        >
          {/* Header with themed gradient */}
          <div className="storeClosedModal__header storeClosedModal__header--orderLimit">
            <button className="storeClosedModal__close" onClick={onClose}>
              <X size={20} />
            </button>
            <div className="storeClosedModal__icon storeClosedModal__icon--orderLimit">
              <ShoppingBag size={32} />
            </div>
            <h2 className="storeClosedModal__title">Límite de pedidos alcanzado</h2>
            <p className="storeClosedModal__subtitle">{tenantName}</p>
          </div>

          {/* Body */}
          <div className="storeClosedModal__body">
            <div className="storeClosedModal__message storeClosedModal__message--orderLimit">
              <AlertCircle size={18} />
              <p>
                Lo sentimos, esta tienda ha alcanzado el límite de pedidos de hoy. Plan{' '}
                <strong>{TIER_LABELS[subscriptionTier] || 'Gratis'}</strong> ({ordersLimit} pedidos/día).
              </p>
            </div>

            <div className="storeClosedModal__orderLimitInfo">
              <div className="storeClosedModal__orderLimitStat">
                <span className="storeClosedModal__orderLimitLabel">Pedidos usados</span>
                <span className="storeClosedModal__orderLimitValue">{ordersLimit} / {ordersLimit}</span>
              </div>
              {resetDate && (
                <div className="storeClosedModal__orderLimitReset">
                  <Clock size={16} />
                  <span>Los pedidos se renuevan {formatResetDate(resetDate)}</span>
                </div>
              )}
            </div>

            <p className="storeClosedModal__orderLimitSuggestion">
              ¡Vuelve mañana! Los pedidos se renuevan cada día a la medianoche.
            </p>
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

  // If store is paused, show pause message instead of schedule
  if (isPaused) {
    return (
      <div className="storeClosedModal__overlay">
        <div 
          className="storeClosedModal storeClosedModal--paused"
          style={{ '--modal-accent': accentColor, '--modal-primary': primaryColor }}
        >
          {/* Header with themed gradient */}
          <div className="storeClosedModal__header storeClosedModal__header--paused">
            <button className="storeClosedModal__close" onClick={onClose}>
              <X size={20} />
            </button>
            <div className="storeClosedModal__icon">
              <Pause size={32} />
            </div>
            <h2 className="storeClosedModal__title">Tienda en pausa</h2>
            <p className="storeClosedModal__subtitle">{tenantName}</p>
          </div>

          {/* Body */}
          <div className="storeClosedModal__body">
            <div className="storeClosedModal__message storeClosedModal__message--paused">
              <AlertCircle size={18} />
              <p>
                {pauseMessage || 'La tienda está temporalmente cerrada. Por favor, vuelve más tarde.'}
              </p>
            </div>
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

  return (
    <div className="storeClosedModal__overlay">
      <div 
        className="storeClosedModal"
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
