import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './LegalPages.css'
import { HelpCircle, ChevronLeft, Clock, ChevronDown, ChevronUp, MessageCircle, CreditCard, Truck, Store, Settings, Shield } from 'lucide-react'

const faqData = [
  {
    category: 'General',
    icon: Store,
    questions: [
      {
        question: '¿Qué es Pyme Center?',
        answer: 'Pyme Center es una plataforma integral para la gestión de negocios y emprendimientos. Te permite crear tu tienda online, gestionar productos, recibir pedidos y personalizar la experiencia de tus clientes.'
      },
      {
        question: '¿Cómo puedo registrar mi restaurante?',
        answer: 'Registrarte es muy sencillo. Haz clic en "Crear mi restaurante" en la página principal, completa el formulario con los datos de tu negocio y en pocos minutos tendrás tu tienda online lista para empezar a vender.'
      },
      {
        question: '¿Necesito conocimientos técnicos para usar Pyme Center?',
        answer: 'No, Pyme Center está diseñado para ser intuitivo y fácil de usar. Nuestra interfaz es amigable y no requiere conocimientos de programación. Además, contamos con soporte técnico para ayudarte en todo momento.'
      },
      {
        question: '¿Puedo personalizar la apariencia de mi tienda?',
        answer: 'Sí, puedes personalizar colores, logo, imágenes de portada, tipografías y mucho más. Tu tienda reflejará la identidad visual de tu marca.'
      }
    ]
  },
  {
    category: 'Pagos',
    icon: CreditCard,
    questions: [
      {
        question: '¿Qué métodos de pago están disponibles?',
        answer: 'Aceptamos pagos a través de MercadoPago (tarjetas de crédito, débito, transferencias) y también puedes ofrecer pago en efectivo al momento de la entrega.'
      },
      {
        question: '¿Cuándo recibo el dinero de mis ventas?',
        answer: 'El dinero se deposita directamente en tu cuenta de MercadoPago. Los tiempos de acreditación dependen del método de pago utilizado por el cliente y las políticas de MercadoPago.'
      },
      {
        question: '¿Hay comisiones por las ventas?',
        answer: 'Pyme Center no cobra comisiones por venta. Solo pagas tu suscripción mensual. Las únicas comisiones son las de MercadoPago por procesar los pagos electrónicos.'
      },
      {
        question: '¿Cómo configuro MercadoPago en mi tienda?',
        answer: 'En tu panel de administración, ve a la sección "MercadoPago" e ingresa tus credenciales de acceso (Access Token). Si no tienes una cuenta de MercadoPago, puedes crear una gratuitamente.'
      }
    ]
  },
  {
    category: 'Pedidos y Entregas',
    icon: Truck,
    questions: [
      {
        question: '¿Cómo recibo los pedidos de mis clientes?',
        answer: 'Los pedidos aparecen en tiempo real en tu panel de administración. También puedes activar notificaciones sonoras para no perderte ningún pedido.'
      },
      {
        question: '¿Puedo establecer zonas de entrega?',
        answer: 'Sí, puedes configurar zonas de entrega con diferentes costos de envío o establecer un radio máximo de cobertura desde tu ubicación.'
      },
      {
        question: '¿Cómo gestiono el stock de mis productos?',
        answer: 'Desde el panel de productos puedes gestionar el stock de cada artículo. El sistema te notificará cuando un producto esté por agotarse y puedes pausar productos temporalmente.'
      },
      {
        question: '¿Puedo pausar mi tienda temporalmente?',
        answer: 'Sí, puedes pausar tu tienda en cualquier momento desde la configuración. Esto es útil para vacaciones, días de descanso o cuando no puedas atender pedidos.'
      }
    ]
  },
  {
    category: 'Configuración',
    icon: Settings,
    questions: [
      {
        question: '¿Cómo configuro los horarios de atención?',
        answer: 'En la sección de configuración puedes establecer los horarios de apertura y cierre para cada día de la semana. Tu tienda mostrará automáticamente si estás abierto o cerrado.'
      },
      {
        question: '¿Puedo agregar extras y complementos a mis productos?',
        answer: 'Sí, puedes crear grupos de extras (como salsas, ingredientes adicionales, etc.) y asociarlos a tus productos. Los clientes podrán personalizar su pedido.'
      },
      {
        question: '¿Cómo organizo mis productos en categorías?',
        answer: 'Puedes crear categorías personalizadas y asignar productos a cada una. Las categorías se muestran como pestañas en tu tienda para facilitar la navegación.'
      },
      {
        question: '¿Puedo limitar la cantidad de pedidos por hora?',
        answer: 'Sí, puedes establecer límites de pedidos por hora para gestionar mejor tu capacidad de producción y evitar sobrecarga en momentos de alta demanda.'
      }
    ]
  },
  {
    category: 'Cuenta y Suscripción',
    icon: Shield,
    questions: [
      {
        question: '¿Cuánto cuesta usar Pyme Center?',
        answer: 'Ofrecemos diferentes planes de suscripción adaptados a las necesidades de cada negocio. Contamos con un plan gratuito limitado y planes premium con más funcionalidades.'
      },
      {
        question: '¿Puedo cancelar mi suscripción en cualquier momento?',
        answer: 'Sí, puedes cancelar tu suscripción cuando quieras. Tu tienda seguirá activa hasta el final del período pagado.'
      },
      {
        question: '¿Cómo cambio mi contraseña?',
        answer: 'Puedes cambiar tu contraseña desde la sección de configuración de tu cuenta o utilizando la opción "Olvidé mi contraseña" en la página de inicio de sesión.'
      },
      {
        question: '¿Mis datos están seguros?',
        answer: 'Absolutamente. Utilizamos encriptación de última generación y seguimos las mejores prácticas de seguridad para proteger tu información y la de tus clientes.'
      }
    ]
  },
  {
    category: 'Soporte',
    icon: MessageCircle,
    questions: [
      {
        question: '¿Cómo puedo contactar al soporte técnico?',
        answer: 'Puedes contactarnos por WhatsApp, email (soporte@pymecenter.app) o a través del chat en vivo disponible en la plataforma. Nuestro horario de atención es de lunes a viernes de 9:00 a 18:00.'
      },
      {
        question: '¿Ofrecen capacitación para usar la plataforma?',
        answer: 'Sí, ofrecemos tutoriales en video, guías paso a paso y sesiones de capacitación personalizadas para clientes con planes premium.'
      },
      {
        question: '¿Qué hago si tengo un problema técnico?',
        answer: 'Contacta a nuestro equipo de soporte lo antes posible. Describe el problema con el mayor detalle posible y te ayudaremos a resolverlo rápidamente.'
      }
    ]
  }
]

function FaqItem({ question, answer, isOpen, onClick }) {
  return (
    <div className={`faqPage__item ${isOpen ? 'faqPage__item--open' : ''}`}>
      <button className="faqPage__question" onClick={onClick}>
        <span>{question}</span>
        {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>
      {isOpen && (
        <div className="faqPage__answer">
          <p>{answer}</p>
        </div>
      )}
    </div>
  )
}

export default function FaqPage() {
  const [openItems, setOpenItems] = useState({})
  const [activeCategory, setActiveCategory] = useState('General')

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const toggleItem = (categoryIndex, questionIndex) => {
    const key = `${categoryIndex}-${questionIndex}`
    setOpenItems(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const currentCategory = faqData.find(cat => cat.category === activeCategory)

  return (
    <div className="legalPage">
      <div className="legalPage__hero">
        <div className="legalPage__heroContent">
          <div className="legalPage__icon">
            <HelpCircle size={32} />
          </div>
          <h1 className="legalPage__title">Preguntas Frecuentes</h1>
          <p className="legalPage__subtitle">
            Encuentra respuestas a las dudas más comunes sobre nuestra plataforma
          </p>
          <div className="legalPage__lastUpdate">
            <Clock size={14} />
            Última actualización: Enero 2026
          </div>
        </div>
      </div>

      <div className="legalPage__content">
        <Link to="/" className="legalPage__back">
          <ChevronLeft size={18} />
          Volver al inicio
        </Link>

        <nav className="legalPage__nav">
          <Link to="/faq" className="legalPage__navLink legalPage__navLink--active">FAQ</Link>
          <Link to="/terminos" className="legalPage__navLink">Términos</Link>
          <Link to="/privacidad" className="legalPage__navLink">Privacidad</Link>
          <Link to="/cookies" className="legalPage__navLink">Cookies</Link>
          <Link to="/devoluciones" className="legalPage__navLink">Devoluciones</Link>
        </nav>

        {/* Category tabs */}
        <div className="faqPage__categories">
          {faqData.map((category) => {
            const IconComponent = category.icon
            return (
              <button
                key={category.category}
                className={`faqPage__categoryBtn ${activeCategory === category.category ? 'faqPage__categoryBtn--active' : ''}`}
                onClick={() => setActiveCategory(category.category)}
              >
                <IconComponent size={18} />
                <span>{category.category}</span>
              </button>
            )
          })}
        </div>

        {/* FAQ Items */}
        <div className="faqPage__list">
          {currentCategory && currentCategory.questions.map((item, qIndex) => {
            const categoryIndex = faqData.findIndex(c => c.category === activeCategory)
            const key = `${categoryIndex}-${qIndex}`
            return (
              <FaqItem
                key={key}
                question={item.question}
                answer={item.answer}
                isOpen={openItems[key]}
                onClick={() => toggleItem(categoryIndex, qIndex)}
              />
            )
          })}
        </div>

        {/* Contact CTA */}
        <section className="legalPage__section faqPage__contact">
          <div className="legalPage__highlight">
            <h3>¿No encontraste lo que buscabas?</h3>
            <p>
              Nuestro equipo de soporte está listo para ayudarte. Contáctanos y resolveremos 
              todas tus dudas.
            </p>
            <div className="faqPage__contactActions">
              <a href="https://wa.me/5411123456789" target="_blank" rel="noreferrer" className="faqPage__contactBtn faqPage__contactBtn--primary">
                <MessageCircle size={18} />
                WhatsApp
              </a>
              <a href="mailto:soporte@pymecenter.app" className="faqPage__contactBtn faqPage__contactBtn--secondary">
                Enviar email
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
