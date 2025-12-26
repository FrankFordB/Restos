import './WelcomeModal.css'
import Button from '../Button/Button'

const BENEFITS = [
  {
    icon: '💳',
    title: 'Pagos online verificados',
    description: 'Cobrá con tarjeta, transferencia o QR. Verificamos cada pago antes de confirmar el pedido. Sin riesgos.',
    highlight: true,
  },
  {
    icon: '🚀',
    title: 'Sin comisiones por venta',
    description: 'Tu ganancia es 100% tuya. No cobramos porcentaje por cada pedido como otras plataformas.',
  },
  {
    icon: '📱',
    title: 'Pedidos directo a tu WhatsApp',
    description: 'Recibí notificaciones instantáneas y contactá a tus clientes sin intermediarios.',
  },
  {
    icon: '🎨',
    title: 'Tu marca, tu estilo',
    description: 'Personalizá colores, logo y menú. Tu tienda online sin logos de terceros.',
  },
  {
    icon: '⚡',
    title: 'Activo en minutos',
    description: 'Cargá tu menú, configurá los pagos y empezá a vender hoy mismo.',
  },
  {
    icon: '📊',
    title: 'Control total',
    description: 'Gestioná pedidos, productos, precios y estadísticas desde un solo panel.',
  },
]

export default function WelcomeModal({ open, userName, onClose }) {
  if (!open) return null

  return (
    <div className="welcomeModal__overlay" role="dialog" aria-modal="true">
      <div className="welcomeModal__card welcomeModal__card--noHeader">
        <div className="welcomeModal__intro">
          
          <p className="welcomeModal__subtitle">
            Tu restaurante ahora tiene su propia tienda online con <strong>pagos verificados</strong>
          </p>
        </div>

        <div className="welcomeModal__benefits">
          {BENEFITS.map((benefit, i) => (
            <div 
              key={i} 
              className={`welcomeModal__benefit ${benefit.highlight ? 'welcomeModal__benefit--highlight' : ''}`}
            >
              <span className="welcomeModal__benefitIcon">{benefit.icon}</span>
              <div>
                <strong>{benefit.title}</strong>
                <p>{benefit.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="welcomeModal__cta">
          <div className="welcomeModal__ctaHighlight">
            <span className="welcomeModal__ctaIcon">✅</span>
            <div>
              <strong>Verificación de pagos en tiempo real</strong>
              <p>A diferencia de otras apps, nosotros confirmamos que el pago llegó antes de procesar el pedido. Cero pérdidas, cero estafas.</p>
            </div>
          </div>
          <Button onClick={onClose} size="lg">
            Comenzar a vender 🚀
          </Button>
        </div>
      </div>
    </div>
  )
}

