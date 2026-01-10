import './DowngradeWarningModal.css'
import Button from '../Button/Button'
import {
  SUBSCRIPTION_TIERS,
  TIER_LABELS,
  getDowngradeLostFeatures,
} from '../../../shared/subscriptions'

/**
 * Modal de advertencia al hacer downgrade de suscripción
 * Informa al usuario sobre las configuraciones que perderá
 * El cambio se programa para cuando expire la suscripción actual
 */
export default function DowngradeWarningModal({
  open,
  currentTier,
  targetTier,
  premiumUntil,
  onConfirm,
  onCancel,
  loading = false,
}) {
  if (!open) return null

  const lostFeatures = getDowngradeLostFeatures(currentTier, targetTier)
  const currentLabel = TIER_LABELS[currentTier] || 'Premium'
  const targetLabel = TIER_LABELS[targetTier] || 'Free'
  
  // Formatear fecha de expiración
  const expiryDate = premiumUntil 
    ? new Date(premiumUntil).toLocaleDateString('es-AR', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      })
    : null

  return (
    <div className="downgradeModal__overlay" role="dialog" aria-modal="true">
      <div className="downgradeModal__card">
        {/* Header con icono de advertencia */}
        <div className="downgradeModal__header">
          <div className="downgradeModal__icon">📅</div>
          <h2 className="downgradeModal__title">Programar cambio a {targetLabel}</h2>
        </div>

        {/* Contenido */}
        <div className="downgradeModal__content">
          {/* Info sobre el cambio programado */}
          <div className="downgradeModal__scheduledInfo">
            <div className="downgradeModal__scheduledIcon">🔄</div>
            <div className="downgradeModal__scheduledText">
              <strong>Tu plan actual seguirá activo</strong>
              <p>
                Mantendrás todos los beneficios de <strong>{currentLabel}</strong> hasta 
                {expiryDate ? ` el ${expiryDate}` : ' que expire tu suscripción'}.
                Después de esa fecha, cambiarás automáticamente a <strong>{targetLabel}</strong>.
              </p>
            </div>
          </div>

          <div className="downgradeModal__warning">
            <p className="downgradeModal__warningText">
              Cuando expire tu plan actual, los siguientes cambios se aplicarán:
            </p>
          </div>

          {/* Lista de lo que se perderá */}
          <div className="downgradeModal__lostFeatures">
            <h4 className="downgradeModal__lostFeaturesTitle">
              🚫 Perderás acceso a:
            </h4>
            <ul className="downgradeModal__featuresList">
              {lostFeatures.map((feature, idx) => (
                <li key={idx} className="downgradeModal__featureItem">
                  <span className="downgradeModal__featureX">✕</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Alerta de configuración */}
          <div className="downgradeModal__alert">
            <span className="downgradeModal__alertIcon">⚠️</span>
            <div className="downgradeModal__alertContent">
              <strong>Las configuraciones se resetearán al expirar</strong>
              <p>
                Los estilos de cards, fuentes, paletas de colores, hero y widgets premium 
                volverán a sus valores predeterminados del plan {targetLabel}.
              </p>
            </div>
          </div>

          {/* Lo que conservarás */}
          <div className="downgradeModal__keepFeatures">
            <h4 className="downgradeModal__keepFeaturesTitle">
              ✅ Conservarás:
            </h4>
            <ul className="downgradeModal__featuresList downgradeModal__featuresList--keep">
              <li className="downgradeModal__featureItem">
                <span className="downgradeModal__featureCheck">✓</span>
                <span>Tus productos (hasta el límite del plan {targetLabel})</span>
              </li>
              <li className="downgradeModal__featureItem">
                <span className="downgradeModal__featureCheck">✓</span>
                <span>Tu tienda pública</span>
              </li>
              <li className="downgradeModal__featureItem">
                <span className="downgradeModal__featureCheck">✓</span>
                <span>Historial de pedidos</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Acciones */}
        <div className="downgradeModal__actions">
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Procesando...' : `Programar cambio a ${targetLabel}`}
          </Button>
        </div>

        {/* Nota */}
        <div className="downgradeModal__note">
          💡 <strong>Importante:</strong> Podrás cancelar este cambio programado en cualquier 
          momento antes de que expire tu suscripción actual.
        </div>
      </div>
    </div>
  )
}
