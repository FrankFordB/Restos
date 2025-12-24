import './ConfirmModal.css'
import Button from '../Button/Button'

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel,
  confirmVariant,
  onConfirm,
  onCancel,
  loading = false,
}) {
  if (!open) return null

  return (
    <div className="confirmModal__overlay" role="dialog" aria-modal="true">
      <div className="confirmModal__card">
        {title ? <h3 className="confirmModal__title">{title}</h3> : null}
        {message ? <div className="confirmModal__message">{message}</div> : null}

        <div className="confirmModal__actions">
          {cancelLabel ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (!loading) onCancel?.()
              }}
              disabled={loading}
            >
              {cancelLabel}
            </Button>
          ) : null}

          <Button
            size="sm"
            variant={confirmVariant}
            onClick={() => {
              if (!loading) onConfirm?.()
            }}
            disabled={loading}
          >
            {loading ? 'Procesando…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
