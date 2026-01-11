import { useState, useEffect } from 'react'
import './LoginWelcomeModal.css'
import { 
  X, 
  ArrowRight, 
  Store, 
  Utensils, 
  ShoppingBag, 
  Palette, 
  Bell, 
  BarChart3,
  Sparkles,
  ChefHat,
  Rocket,
  Pizza,
  UtensilsCrossed,
  Coffee
} from 'lucide-react'

const FEATURES = [
  { icon: Store, title: 'Tu tienda', desc: 'Personaliza tu local' },
  { icon: Utensils, title: 'Productos', desc: 'Gestiona tu menú' },
  { icon: ShoppingBag, title: 'Pedidos', desc: 'En tiempo real' },
  { icon: BarChart3, title: 'Estadísticas', desc: 'Analiza ventas' },
]

const FLOATING_ITEMS = [
  { icon: Pizza, key: 'pizza' },
  { icon: UtensilsCrossed, key: 'utensils' },
  { icon: ChefHat, key: 'chef' },
  { icon: Coffee, key: 'coffee' }
]

export default function LoginWelcomeModal({ open, onClose, userName }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => setVisible(true), 50)
      return () => clearTimeout(timer)
    } else {
      setVisible(false)
    }
  }, [open])

  if (!open) return null

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 200)
  }

  const displayName = userName?.split('@')[0] || 'usuario'

  return (
    <div className={`loginWelcome__overlay ${visible ? 'loginWelcome__overlay--visible' : ''}`}>
      <div className={`loginWelcome ${visible ? 'loginWelcome--visible' : ''}`}>
        <button className="loginWelcome__close" onClick={handleClose} aria-label="Cerrar">
          <X size={20} />
        </button>

        {/* Hero Section */}
        <div className="loginWelcome__hero">
          <div className="loginWelcome__heroPattern" />
          
          {/* Floating Decorations */}
          <div className="loginWelcome__floatingElements">
            {FLOATING_ITEMS.map((item, i) => {
              const IconComponent = item.icon
              return (
                <div 
                  key={item.key} 
                  className={`loginWelcome__floatingItem loginWelcome__floatingItem--${i + 1}`}
                >
                  <IconComponent size={24} />
                </div>
              )
            })}
          </div>

          <div className="loginWelcome__heroContent">
            <div className="loginWelcome__iconWrapper">
              <Rocket size={40} />
            </div>
            <h1 className="loginWelcome__title">
              ¡Hola, <span>{displayName}</span>!
            </h1>
            <p className="loginWelcome__subtitle">
              Bienvenido a tu panel de control
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="loginWelcome__body">
          <div className="loginWelcome__message">
            <div className="loginWelcome__messageIcon">
              <Sparkles size={18} />
            </div>
            <p>
              Ahora puedes crear y administrar tu restaurante, personalizar su estilo, 
              cargar productos y gestionar tus pedidos desde el panel.
            </p>
          </div>

          {/* Features Grid */}
          <div className="loginWelcome__features">
            {FEATURES.map((feature, i) => (
              <div key={i} className="loginWelcome__feature">
                <div className="loginWelcome__featureIcon">
                  <feature.icon size={20} />
                </div>
                <div className="loginWelcome__featureText">
                  <strong>{feature.title}</strong>
                  <span>{feature.desc}</span>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button onClick={handleClose} className="loginWelcome__cta">
            <span>Explorar panel</span>
            <ArrowRight size={18} />
          </button>

          <p className="loginWelcome__footer">
            <ChefHat size={14} />
            Tu restaurante te espera
          </p>
        </div>
      </div>
    </div>
  )
}
