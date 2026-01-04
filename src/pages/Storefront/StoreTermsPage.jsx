import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { FileText, ChevronLeft, ShoppingBag, Clock, Shield, Users, Mail, AlertCircle, Scale, Store } from 'lucide-react'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import { fetchTenantBySlug } from '../../lib/supabaseApi'
import { loadJson } from '../../shared/storage'
import './StoreTermsPage.css'

export default function StoreTermsPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [tenant, setTenant] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.scrollTo(0, 0)
    
    async function loadTenant() {
      try {
        if (isSupabaseConfigured) {
          const data = await fetchTenantBySlug(slug)
          setTenant(data)
        } else {
          // Mock mode
          const mockTenants = loadJson('mock.tenants', {})
          const found = Object.values(mockTenants).find(t => t.slug === slug)
          setTenant(found || null)
        }
      } catch (err) {
        console.error('Error loading tenant:', err)
      } finally {
        setLoading(false)
      }
    }

    loadTenant()
  }, [slug])

  if (loading) {
    return (
      <div className="storeTerms">
        <div className="storeTerms__loading">
          <div className="storeTerms__spinner" />
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="storeTerms">
        <div className="storeTerms__error">
          <Store size={48} />
          <h2>Tienda no encontrada</h2>
          <p>No pudimos encontrar la tienda que buscas.</p>
          <Link to="/" className="storeTerms__errorBtn">
            Volver al inicio
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="storeTerms">
      {/* Hero */}
      <div className="storeTerms__hero">
        <div className="storeTerms__heroContent">
          <div className="storeTerms__storeBadge">
            {tenant.logo ? (
              <img src={tenant.logo} alt={tenant.name} className="storeTerms__storeLogo" />
            ) : (
              <Store size={24} />
            )}
            <span>{tenant.name}</span>
          </div>
          <div className="storeTerms__icon">
            <FileText size={32} />
          </div>
          <h1 className="storeTerms__title">Términos y Condiciones</h1>
          <p className="storeTerms__subtitle">
            Condiciones generales que rigen el uso de esta tienda
          </p>
          <div className="storeTerms__lastUpdate">
            <Clock size={14} />
            Última actualización: Enero 2026
          </div>
        </div>
      </div>

      <div className="storeTerms__content">
        {/* Back to Store Button */}
        <Link to={`/tienda/${slug}`} className="storeTerms__back">
          <ChevronLeft size={18} />
          Volver a la tienda
        </Link>

        <section className="storeTerms__section">
          <h2 className="storeTerms__sectionTitle">
            <span className="storeTerms__sectionNumber">1</span>
            Aceptación de los Términos
          </h2>
          <p className="storeTerms__text">
            Al acceder y utilizar la plataforma Restos ("el Servicio"), usted acepta estar sujeto a estos 
            Términos de Servicio, todas las leyes y regulaciones aplicables, y acepta que es responsable 
            del cumplimiento de las leyes locales aplicables. Si no está de acuerdo con alguno de estos 
            términos, tiene prohibido usar o acceder a este sitio.
          </p>
          <p className="storeTerms__text">
            Nos reservamos el derecho de modificar estos términos en cualquier momento. Los cambios 
            entrarán en vigor inmediatamente después de su publicación en el sitio. Su uso continuado 
            del Servicio después de cualquier cambio constituye su aceptación de los nuevos términos.
          </p>
        </section>

        <section className="storeTerms__section">
          <h2 className="storeTerms__sectionTitle">
            <span className="storeTerms__sectionNumber">2</span>
            Descripción del Servicio
          </h2>
          <p className="storeTerms__text">
            Restos es una plataforma de gestión para restaurantes y establecimientos gastronómicos que permite:
          </p>
          <ul className="storeTerms__list">
            <li>Crear y administrar tiendas online para venta de productos alimenticios</li>
            <li>Gestionar catálogos de productos, precios e inventario</li>
            <li>Recibir y procesar pedidos de clientes</li>
            <li>Personalizar la apariencia de la tienda virtual</li>
            <li>Integrar métodos de pago electrónico</li>
            <li>Acceder a reportes y estadísticas de ventas</li>
          </ul>
        </section>

        <section className="storeTerms__section">
          <h2 className="storeTerms__sectionTitle">
            <span className="storeTerms__sectionNumber">3</span>
            Cuentas de Usuario
          </h2>
          <div className="storeTerms__card">
            <div className="storeTerms__cardIcon">
              <Users size={24} />
            </div>
            <div className="storeTerms__cardContent">
              <h3>Registro y Responsabilidad</h3>
              <p>
                Al crear una cuenta, usted garantiza que la información proporcionada es precisa 
                y se compromete a mantenerla actualizada. Es responsable de mantener la confidencialidad 
                de sus credenciales de acceso y de todas las actividades que ocurran bajo su cuenta.
              </p>
            </div>
          </div>
        </section>

        <section className="storeTerms__section">
          <h2 className="storeTerms__sectionTitle">
            <span className="storeTerms__sectionNumber">4</span>
            Política de Pedidos y Pagos
          </h2>
          <p className="storeTerms__text">
            Todos los pedidos realizados a través de la tienda están sujetos a disponibilidad y confirmación 
            del establecimiento. Los precios mostrados incluyen impuestos aplicables según la legislación local.
          </p>
          <p className="storeTerms__text">
            Los métodos de pago aceptados se mostrarán claramente durante el proceso de compra. 
            El establecimiento se reserva el derecho de cancelar pedidos en caso de errores en precios 
            o falta de disponibilidad de productos.
          </p>
        </section>

        <section className="storeTerms__section">
          <h2 className="storeTerms__sectionTitle">
            <span className="storeTerms__sectionNumber">5</span>
            Política de Privacidad
          </h2>
          <div className="storeTerms__card">
            <div className="storeTerms__cardIcon">
              <Shield size={24} />
            </div>
            <div className="storeTerms__cardContent">
              <h3>Protección de Datos</h3>
              <p>
                Sus datos personales serán tratados de acuerdo con nuestra política de privacidad 
                y las leyes de protección de datos aplicables. No compartimos su información con 
                terceros sin su consentimiento expreso, excepto cuando sea requerido por ley.
              </p>
            </div>
          </div>
        </section>

        <section className="storeTerms__section">
          <h2 className="storeTerms__sectionTitle">
            <span className="storeTerms__sectionNumber">6</span>
            Limitación de Responsabilidad
          </h2>
          <p className="storeTerms__text">
            El establecimiento no será responsable por daños indirectos, incidentales, especiales o 
            consecuentes que resulten del uso o la imposibilidad de uso del servicio. La responsabilidad 
            total del establecimiento no excederá el monto pagado por el pedido en cuestión.
          </p>
        </section>

        <section className="storeTerms__section">
          <h2 className="storeTerms__sectionTitle">
            <span className="storeTerms__sectionNumber">7</span>
            Contacto
          </h2>
          <div className="storeTerms__contact">
            <Mail size={20} />
            <div>
              <p>Para consultas relacionadas con estos términos, puede contactarnos:</p>
              <strong>Email: soporte@restos.com</strong>
            </div>
          </div>
        </section>

        {/* CTA - Back to Store */}
        <div className="storeTerms__cta">
          <div className="storeTerms__ctaContent">
            <ShoppingBag size={32} />
            <h3>¿Listo para comprar?</h3>
            <p>Regresa a la tienda y descubre nuestros productos</p>
          </div>
          <Link to={`/tienda/${slug}`} className="storeTerms__ctaBtn">
            <ShoppingBag size={18} />
            Volver a comprar
          </Link>
        </div>
      </div>
    </div>
  )
}
