import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './HomePage.css'
import Button from '../../components/ui/Button/Button'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { fetchTenants, selectTenants } from '../../features/tenants/tenantsSlice'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import { 
  Send, 
  HelpCircle, 
  MessageCircle, 
  Mail, 
  CreditCard, 
  Shield, 
  Award,
  Store,
  Palette,
  BarChart3,
  Zap,
  ChevronRight,
  Check,
  ArrowRight,
  Smartphone,
  Clock,
  Users,
  Star
} from 'lucide-react'

export default function HomePage() {
  const dispatch = useAppDispatch()
  const tenants = useAppSelector(selectTenants)
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)

  const handleSubscribe = (e) => {
    e.preventDefault()
    if (email) {
      setSubscribed(true)
      setEmail('')
      setTimeout(() => setSubscribed(false), 3000)
    }
  }

  useEffect(() => {
    if (isSupabaseConfigured) dispatch(fetchTenants())
  }, [dispatch])

  const publicTenants = (tenants || []).filter((t) => t?.isPublic !== false)

  const features = [
    {
      icon: Store,
      title: 'Tu tienda online',
      description: 'Crea tu tienda personalizada en minutos y empieza a recibir pedidos de inmediato.'
    },
    {
      icon: Palette,
      title: 'Diseño único',
      description: 'Personaliza colores, logos e imágenes para reflejar la identidad de tu marca.'
    },
    {
      icon: BarChart3,
      title: 'Panel de control',
      description: 'Gestiona productos, pedidos y estadísticas desde un dashboard intuitivo.'
    },
    {
      icon: Zap,
      title: 'Rápido y seguro',
      description: 'Tecnología moderna con pagos seguros a través de MercadoPago.'
    }
  ]

  const steps = [
    {
      number: '01',
      title: 'Registra tu negocio',
      description: 'Crea tu cuenta en segundos y configura los datos básicos de tu restaurante.'
    },
    {
      number: '02',
      title: 'Agrega tus productos',
      description: 'Sube tu menú con fotos, precios, descripciones y categorías.'
    },
    {
      number: '03',
      title: 'Personaliza tu tienda',
      description: 'Elige colores, tipografías y estilo que representen tu marca.'
    },
    {
      number: '04',
      title: 'Comienza a vender',
      description: 'Comparte tu link y recibe pedidos en tiempo real.'
    }
  ]

  const stats = [
    { value: '500+', label: 'Restaurantes activos' },
    { value: '50K+', label: 'Pedidos procesados' },
    { value: '99.9%', label: 'Uptime garantizado' },
    { value: '24/7', label: 'Soporte disponible' }
  ]

  return (
    <div className="home">
      {/* Hero Section */}
      <section className="home__hero">
        <div className="home__heroBackground">
          <div className="home__heroOrb home__heroOrb--1"></div>
          <div className="home__heroOrb home__heroOrb--2"></div>
          <div className="home__heroOrb home__heroOrb--3"></div>
        </div>
        
        <div className="home__heroContent">
          <div className="home__heroBadge">
            <Zap size={14} />
            <span>La plataforma #1 para restaurantes</span>
          </div>
          
          <h1 className="home__heroTitle">
            Tu restaurante online,
            <span className="home__heroHighlight"> listo para vender</span>
          </h1>
          
          <p className="home__heroSubtitle">
            Crea tu tienda digital en minutos. Gestiona pedidos, personaliza tu marca 
            y haz crecer tu negocio gastronómico con herramientas profesionales.
          </p>
          
          <div className="home__heroCta">
            <Link to="/register">
              <Button size="lg">
                Crear mi restaurante
                <ArrowRight size={18} />
              </Button>
            </Link>
            <Link to="/restaurantes" className="home__heroSecondaryBtn">
              <span>Ver restaurantes</span>
              <ChevronRight size={18} />
            </Link>
          </div>

          <div className="home__heroStats">
            {stats.map((stat, index) => (
              <div key={index} className="home__heroStat">
                <span className="home__heroStatValue">{stat.value}</span>
                <span className="home__heroStatLabel">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="home__heroVisual">
          <div className="home__heroCard home__heroCard--main">
            <div className="home__heroCardHeader">
              <Store size={20} />
              <span>Tu Restaurante</span>
            </div>
            <div className="home__heroCardBody">
              <div className="home__heroCardProduct">
                <div className="home__heroCardProductImg"></div>
                <div className="home__heroCardProductInfo">
                  <span className="home__heroCardProductName">Hamburguesa Classic</span>
                  <span className="home__heroCardProductPrice">$2.500</span>
                </div>
              </div>
              <div className="home__heroCardProduct">
                <div className="home__heroCardProductImg"></div>
                <div className="home__heroCardProductInfo">
                  <span className="home__heroCardProductName">Pizza Margherita</span>
                  <span className="home__heroCardProductPrice">$4.200</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="home__heroCard home__heroCard--floating home__heroCard--orders">
            <div className="home__heroFloatingIcon home__heroFloatingIcon--green">
              <Check size={16} />
            </div>
            <div>
              <span className="home__heroFloatingTitle">Nuevo pedido</span>
              <span className="home__heroFloatingSubtitle">Mesa 5 - $8.700</span>
            </div>
          </div>
          
          <div className="home__heroCard home__heroCard--floating home__heroCard--rating">
            <Star size={16} className="home__heroStarIcon" />
            <span className="home__heroRatingValue">4.9</span>
            <span className="home__heroRatingLabel">Rating</span>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="home__features">
        <div className="home__sectionHeader">
          <span className="home__sectionTag">Características</span>
          <h2 className="home__sectionTitle">Todo lo que necesitas para tu negocio</h2>
          <p className="home__sectionSubtitle">
            Herramientas profesionales diseñadas para restaurantes, dark kitchens, 
            cafeterías y emprendedores gastronómicos.
          </p>
        </div>

        <div className="home__featuresGrid">
          {features.map((feature, index) => (
            <div key={index} className="home__featureCard">
              <div className="home__featureIcon">
                <feature.icon size={24} />
              </div>
              <h3 className="home__featureTitle">{feature.title}</h3>
              <p className="home__featureDescription">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works Section */}
      <section className="home__howItWorks">
        <div className="home__sectionHeader">
          <span className="home__sectionTag">Cómo funciona</span>
          <h2 className="home__sectionTitle">Empieza en 4 simples pasos</h2>
          <p className="home__sectionSubtitle">
            Configura tu tienda online en minutos y comienza a recibir pedidos hoy mismo.
          </p>
        </div>

        <div className="home__stepsGrid">
          {steps.map((step, index) => (
            <div key={index} className="home__stepCard">
              <span className="home__stepNumber">{step.number}</span>
              <h3 className="home__stepTitle">{step.title}</h3>
              <p className="home__stepDescription">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits Section */}
      <section className="home__benefits">
        <div className="home__benefitsContent">
          <span className="home__sectionTag">¿Por qué elegirnos?</span>
          <h2 className="home__sectionTitle">Beneficios que marcan la diferencia</h2>
          
          <ul className="home__benefitsList">
            <li className="home__benefitsItem">
              <div className="home__benefitsCheck"><Check size={16} /></div>
              <span>Tu propia tienda pública con URL personalizada</span>
            </li>
            <li className="home__benefitsItem">
              <div className="home__benefitsCheck"><Check size={16} /></div>
              <span>Catálogo ilimitado con fotos y descripciones</span>
            </li>
            <li className="home__benefitsItem">
              <div className="home__benefitsCheck"><Check size={16} /></div>
              <span>Pedidos en tiempo real con notificaciones</span>
            </li>
            <li className="home__benefitsItem">
              <div className="home__benefitsCheck"><Check size={16} /></div>
              <span>Integración con MercadoPago para cobros seguros</span>
            </li>
            <li className="home__benefitsItem">
              <div className="home__benefitsCheck"><Check size={16} /></div>
              <span>Panel de estadísticas y reportes de ventas</span>
            </li>
            <li className="home__benefitsItem">
              <div className="home__benefitsCheck"><Check size={16} /></div>
              <span>Soporte técnico dedicado</span>
            </li>
          </ul>

          <Link to="/register">
            <Button>
              Comenzar ahora
              <ArrowRight size={18} />
            </Button>
          </Link>
        </div>

        <div className="home__benefitsVisual">
          <div className="home__benefitsCard">
            <div className="home__benefitsCardIcon">
              <Smartphone size={32} />
            </div>
            <h4>Diseño responsive</h4>
            <p>Tu tienda se ve perfecta en cualquier dispositivo</p>
          </div>
          <div className="home__benefitsCard">
            <div className="home__benefitsCardIcon">
              <Clock size={32} />
            </div>
            <h4>Horarios inteligentes</h4>
            <p>Configura horarios de apertura y cierre automático</p>
          </div>
          <div className="home__benefitsCard">
            <div className="home__benefitsCardIcon">
              <Users size={32} />
            </div>
            <h4>Multi-usuario</h4>
            <p>Gestiona tu equipo con roles y permisos</p>
          </div>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="home__newsletter">
        <div className="home__newsletterBackground">
          <div className="home__newsletterOrb home__newsletterOrb--1"></div>
          <div className="home__newsletterOrb home__newsletterOrb--2"></div>
        </div>
        
        <div className="home__newsletterContent">
          <h3 className="home__newsletterTitle">
            <Send size={24} />
            Suscríbete a nuestro boletín
          </h3>
          <p className="home__newsletterText">
            Recibe ofertas exclusivas, novedades de restaurantes y promociones especiales
          </p>
        </div>
        
        <form className="home__newsletterForm" onSubmit={handleSubscribe}>
          <input
            type="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="home__newsletterInput"
            required
          />
          <button type="submit" className="home__newsletterBtn">
            {subscribed ? '¡Suscrito!' : 'Suscribirse'}
          </button>
        </form>
      </section>

      {/* Help Section */}
      <section className="home__helpSection">
        <div className="home__helpContent">
          <HelpCircle size={28} />
          <div>
            <h4>¿Necesitas ayuda?</h4>
            <p>Nuestro equipo está listo para asistirte en todo momento</p>
          </div>
        </div>
        <div className="home__helpActions">
          <a href="https://wa.me" target="_blank" rel="noreferrer" className="home__helpBtn home__helpBtn--primary">
            <MessageCircle size={18} />
            Chat en vivo
          </a>
          <a href="mailto:soporte@pymecenter.app" className="home__helpBtn home__helpBtn--secondary">
            <Mail size={18} />
            Enviar email
          </a>
        </div>
      </section>

      {/* Trust Section */}
      <section className="home__trust">
        <div className="home__trustPayments">
          <span className="home__trustLabel">Métodos de pago aceptados:</span>
          <div className="home__paymentIcons">
            <div className="home__paymentIcon" title="MercadoPago">
              <a href="https://www.mercadopago.com.ar/" target='_blank' rel="noreferrer">
                <img style={{width: 120}} src="src/Img/MP_RGB_HANDSHAKE_color_horizontal.png" alt="Mercadopago" />
              </a>
            </div>
            <div className="home__paymentIcon" title="Efectivo">
              <CreditCard size={18} />
              <span>Efectivo</span>
            </div>
          </div>
        </div>
        
        <div className="home__certifications">
          <div className="home__certification" title="Sitio Seguro">
            <Shield size={18} />
            <span>Sitio Seguro</span>
          </div>
          <div className="home__certification" title="Calidad Garantizada">
            <Award size={18} />
            <span>Calidad</span>
          </div>
        </div>
      </section>
    </div>
  )
}
