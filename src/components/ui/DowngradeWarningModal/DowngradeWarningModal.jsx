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
 */
export default function DowngradeWarningModal({
  open,
  currentTier,
  targetTier,
  onConfirm,
  onCancel,
  loading = false,
}) {
  if (!open) return null

  const lostFeatures = getDowngradeLostFeatures(currentTier, targetTier)
  const currentLabel = TIER_LABELS[currentTier] || 'Premium'
  const targetLabel = TIER_LABELS[targetTier] || 'Free'

  return (
    <div className="downgradeModal__overlay" role="dialog" aria-modal="true">
      <div className="downgradeModal__card">
        {/* Header con icono de advertencia */}
        <div className="downgradeModal__header">
          <div className="downgradeModal__icon">⚠️</div>
          <h2 className="downgradeModal__title">¿Cambiar a {targetLabel}?</h2>
        </div>

        {/* Contenido */}
        <div className="downgradeModal__content">
          <div className="downgradeModal__warning">
            <p className="downgradeModal__warningText">
              Estás por cambiar de <strong>{currentLabel}</strong> a <strong>{targetLabel}</strong>.
            </p>
            <p className="downgradeModal__warningSubtext">
              Al hacer esto, <strong>perderás todas las configuraciones premium</strong> y tu tienda 
              se revertirá a las opciones básicas del plan {targetLabel}.
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
            <span className="downgradeModal__alertIcon">🔄</span>
            <div className="downgradeModal__alertContent">
              <strong>Tus configuraciones se resetearán</strong>
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
            Cancelar, mantener {currentLabel}
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Procesando...' : `Confirmar cambio a ${targetLabel}`}
          </Button>
        </div>

        {/* Nota */}
        <div className="downgradeModal__note">
          💡 <strong>Consejo:</strong> Si cambias de opinión, siempre puedes volver a 
          actualizar tu plan, pero tendrás que reconfigurar todo desde cero.
        </div>
      </div>
    </div>
  )
}
