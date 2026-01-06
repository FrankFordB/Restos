import { useState, useEffect } from 'react'
import './DashboardWelcomeModal.css'
import Button from '../../ui/Button/Button'
import { 
  X, 
  ArrowRight, 
  ArrowLeft,
  Store, 
  ShoppingBag, 
  Smartphone,
  Layers,
  Sparkles,
  Rocket,
  CheckCircle,
  Play,
  ChevronRight
} from 'lucide-react'

const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    icon: Rocket,
    title: '¡Bienvenido a tu Dashboard!',
    description: 'Este es tu centro de control. Aquí podrás gestionar todo tu restaurante de forma sencilla.',
    features: [
      'Personaliza la apariencia de tu tienda',
      'Gestiona productos y categorías',
      'Recibe y procesa pedidos en tiempo real',
      'Analiza tus ventas y estadísticas'
    ]
  },
  {
    id: 'store-editor',
    icon: Store,
    title: 'Editar mi tienda',
    description: 'Personaliza completamente la apariencia de tu restaurante online.',
    features: [
      'Cambia el logo y nombre de tu negocio',
      'Configura horarios de atención',
      'Personaliza colores y estilos',
      'Añade un mensaje de bienvenida'
    ],
    tabId: 'store-editor'
  },
  {
    id: 'orders',
    icon: ShoppingBag,
    title: 'Pedidos',
    description: 'Gestiona todos los pedidos de tus clientes desde un solo lugar.',
    features: [
      'Recibe notificaciones en tiempo real',
      'Cambia estados de pedidos fácilmente',
      'Configura entregas y mostrador',
      'Historial completo de ventas'
    ],
    tabId: 'orders'
  },
  {
    id: 'mobile-preview',
    icon: Smartphone,
    title: 'Vista Móvil',
    description: 'Ajusta cómo se ve tu tienda en dispositivos móviles.',
    features: [
      'Vista previa en tiempo real',
      'Optimiza para smartphones',
      'Diseños premium disponibles',
      'Carrusel de productos'
    ],
    tabId: 'mobile-preview'
  },
  {
    id: 'extras',
    icon: Layers,
    title: 'Extras / Toppings',
    description: 'Añade opciones adicionales a tus productos.',
    features: [
      'Crea grupos de extras (ej: salsas)',
      'Define precios por extra',
      'Marca extras obligatorios u opcionales',
      'Asigna extras a productos específicos'
    ],
    tabId: 'extras'
  }
]

export default function DashboardWelcomeModal({ 
  open, 
  onClose, 
  userName,
  onNavigateToTab
}) {
  const [visible, setVisible] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState([])

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
    setTimeout(() => {
      onClose()
      // Guardar que ya vio el tutorial
      localStorage.setItem('dashboard.welcomeTutorial.seen', 'true')
    }, 200)
  }

  const handleNext = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCompletedSteps(prev => [...prev, currentStep])
      setCurrentStep(prev => prev + 1)
    } else {
      handleClose()
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const handleSkip = () => {
    handleClose()
  }

  const handleGoToSection = (tabId) => {
    if (onNavigateToTab && tabId) {
      handleClose()
      setTimeout(() => {
        onNavigateToTab(tabId)
      }, 250)
    }
  }

  const step = TUTORIAL_STEPS[currentStep]
  const StepIcon = step.icon
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1
  const isFirstStep = currentStep === 0
  const displayName = userName?.split('@')[0] || 'usuario'

  return (
    <div className={`dashWelcome__overlay ${visible ? 'dashWelcome__overlay--visible' : ''}`}>
      <div className={`dashWelcome ${visible ? 'dashWelcome--visible' : ''}`}>
        {/* Close button */}
        <button className="dashWelcome__close" onClick={handleClose} aria-label="Cerrar">
          <X size={20} />
        </button>

        {/* Progress bar */}
        <div className="dashWelcome__progress">
          {TUTORIAL_STEPS.map((s, i) => (
            <div 
              key={s.id}
              className={`dashWelcome__progressDot ${i === currentStep ? 'dashWelcome__progressDot--active' : ''} ${i < currentStep ? 'dashWelcome__progressDot--completed' : ''}`}
              onClick={() => setCurrentStep(i)}
            />
          ))}
        </div>

        {/* Content */}
        <div className="dashWelcome__content">
          {/* Hero */}
          <div className="dashWelcome__hero">
            <div className="dashWelcome__iconWrapper">
              <StepIcon size={36} />
            </div>
            {isFirstStep && (
              <p className="dashWelcome__greeting">
                ¡Hola, <span>{displayName}</span>!
              </p>
            )}
            <h2 className="dashWelcome__title">{step.title}</h2>
            <p className="dashWelcome__description">{step.description}</p>
          </div>

          {/* Features */}
          <div className="dashWelcome__features">
            {step.features.map((feature, i) => (
              <div key={i} className="dashWelcome__feature">
                <CheckCircle size={16} className="dashWelcome__featureIcon" />
                <span>{feature}</span>
              </div>
            ))}
          </div>

          {/* Go to section button */}
          {step.tabId && (
            <button 
              className="dashWelcome__goToSection"
              onClick={() => handleGoToSection(step.tabId)}
            >
              <Play size={16} />
              Ir a {step.title}
              <ChevronRight size={16} />
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="dashWelcome__footer">
          <button 
            className="dashWelcome__skipBtn"
            onClick={handleSkip}
          >
            Saltar tutorial
          </button>
          
          <div className="dashWelcome__navBtns">
            {!isFirstStep && (
              <Button variant="secondary" onClick={handlePrev}>
                <ArrowLeft size={16} />
                Anterior
              </Button>
            )}
            <Button onClick={handleNext}>
              {isLastStep ? (
                <>
                  <Sparkles size={16} />
                  ¡Empezar!
                </>
              ) : (
                <>
                  Siguiente
                  <ArrowRight size={16} />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
