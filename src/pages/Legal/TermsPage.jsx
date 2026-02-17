import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import './LegalPages.css'
import { FileText, ChevronLeft, Mail, Shield, Users, AlertCircle, Scale, Clock } from 'lucide-react'

export default function TermsPage() {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="legalPage">
      <div className="legalPage__hero">
        <div className="legalPage__heroContent">
          <div className="legalPage__icon">
            <FileText size={32} />
          </div>
          <h1 className="legalPage__title">Términos de Servicio</h1>
          <p className="legalPage__subtitle">
            Condiciones generales que rigen el uso de nuestra plataforma
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
          <Link to="/terminos" className="legalPage__navLink legalPage__navLink--active">Términos</Link>
          <Link to="/privacidad" className="legalPage__navLink">Privacidad</Link>
          <Link to="/cookies" className="legalPage__navLink">Cookies</Link>
          <Link to="/devoluciones" className="legalPage__navLink">Devoluciones</Link>
        </nav>

        <section className="legalPage__section">
          <h2 className="legalPage__sectionTitle">
            <span className="legalPage__sectionNumber">1</span>
            Aceptación de los Términos
          </h2>
          <p className="legalPage__text">
            Al acceder y utilizar la plataforma Pyme Center ("el Servicio"), usted acepta estar sujeto a estos 
            Términos de Servicio, todas las leyes y regulaciones aplicables, y acepta que es responsable 
            del cumplimiento de las leyes locales aplicables. Si no está de acuerdo con alguno de estos 
            términos, tiene prohibido usar o acceder a este sitio.
          </p>
          <p className="legalPage__text">
            Nos reservamos el derecho de modificar estos términos en cualquier momento. Los cambios 
            entrarán en vigor inmediatamente después de su publicación en el sitio. Su uso continuado 
            del Servicio después de cualquier cambio constituye su aceptación de los nuevos términos.
          </p>
        </section>

        <section className="legalPage__section">
          <h2 className="legalPage__sectionTitle">
            <span className="legalPage__sectionNumber">2</span>
            Descripción del Servicio
          </h2>
          <p className="legalPage__text">
            Pyme Center es una plataforma de gestión para negocios y emprendimientos que permite:
          </p>
          <ul className="legalPage__list">
            <li>Crear y administrar tiendas online para venta de productos alimenticios</li>
            <li>Gestionar catálogos de productos, precios e inventario</li>
            <li>Recibir y procesar pedidos de clientes</li>
            <li>Personalizar la apariencia de la tienda virtual</li>
            <li>Integrar métodos de pago electrónico</li>
            <li>Acceder a reportes y estadísticas de ventas</li>
          </ul>
        </section>

        <section className="legalPage__section">
          <h2 className="legalPage__sectionTitle">
            <span className="legalPage__sectionNumber">3</span>
            Registro y Cuentas de Usuario
          </h2>
          <p className="legalPage__text">
            Para utilizar ciertas funciones del Servicio, debe registrarse y crear una cuenta. 
            Al registrarse, usted se compromete a:
          </p>
          <ul className="legalPage__list">
            <li>Proporcionar información precisa, actual y completa</li>
            <li>Mantener la seguridad de su contraseña y cuenta</li>
            <li>Notificarnos inmediatamente sobre cualquier uso no autorizado de su cuenta</li>
            <li>Aceptar la responsabilidad por todas las actividades que ocurran bajo su cuenta</li>
          </ul>
          <div className="legalPage__highlight">
            <p>
              <strong>Importante:</strong> Nos reservamos el derecho de suspender o cancelar cuentas 
              que violen estos términos o que permanezcan inactivas por períodos prolongados.
            </p>
          </div>
        </section>

        <section className="legalPage__section">
          <h2 className="legalPage__sectionTitle">
            <span className="legalPage__sectionNumber">4</span>
            Obligaciones de los Restaurantes
          </h2>
          <p className="legalPage__text">
            Los restaurantes y establecimientos que utilizan nuestra plataforma se comprometen a:
          </p>
          <ul className="legalPage__list">
            <li>Cumplir con todas las regulaciones sanitarias y de seguridad alimentaria aplicables</li>
            <li>Mantener las licencias y permisos necesarios para operar su negocio</li>
            <li>Proporcionar información precisa sobre productos, precios y tiempos de entrega</li>
            <li>Gestionar los pedidos de manera oportuna y profesional</li>
            <li>Resolver las quejas y reclamos de los clientes de manera justa</li>
            <li>No publicar contenido ilegal, ofensivo o que infrinja derechos de terceros</li>
          </ul>
        </section>

        <section className="legalPage__section">
          <h2 className="legalPage__sectionTitle">
            <span className="legalPage__sectionNumber">5</span>
            Pagos y Facturación
          </h2>
          <p className="legalPage__text">
            Los términos de pago varían según el plan de suscripción seleccionado. Al suscribirse 
            a un plan de pago, usted autoriza a Pyme Center a cobrar las tarifas aplicables según el 
            método de pago proporcionado.
          </p>
          <ul className="legalPage__list">
            <li>Los precios están sujetos a cambios con previo aviso de 30 días</li>
            <li>Los pagos son procesados de forma segura a través de proveedores certificados</li>
            <li>Las facturas se emiten mensualmente y están disponibles en su panel de control</li>
            <li>El incumplimiento de pago puede resultar en la suspensión del servicio</li>
          </ul>
        </section>

        <section className="legalPage__section">
          <h2 className="legalPage__sectionTitle">
            <span className="legalPage__sectionNumber">6</span>
            Propiedad Intelectual
          </h2>
          <p className="legalPage__text">
            Todo el contenido, características y funcionalidad del Servicio, incluyendo pero no 
            limitado a textos, gráficos, logotipos, iconos, imágenes, clips de audio, descargas 
            digitales y software, son propiedad de Pyme Center o sus licenciantes y están protegidos 
            por las leyes de propiedad intelectual.
          </p>
          <p className="legalPage__text">
            El contenido que usted suba a la plataforma (imágenes de productos, descripciones, etc.) 
            sigue siendo de su propiedad, pero nos otorga una licencia para usarlo en el contexto 
            del Servicio.
          </p>
        </section>

        <section className="legalPage__section">
          <h2 className="legalPage__sectionTitle">
            <span className="legalPage__sectionNumber">7</span>
            Limitación de Responsabilidad
          </h2>
          <p className="legalPage__text">
            Pyme Center no será responsable por daños indirectos, incidentales, especiales, consecuentes 
            o punitivos, incluyendo pérdida de beneficios, datos, uso, buena voluntad u otras 
            pérdidas intangibles, resultantes de:
          </p>
          <ul className="legalPage__list">
            <li>Su acceso o uso (o incapacidad de acceder o usar) el Servicio</li>
            <li>Cualquier conducta o contenido de terceros en el Servicio</li>
            <li>Contenido obtenido del Servicio</li>
            <li>Acceso no autorizado, uso o alteración de sus transmisiones o contenido</li>
          </ul>
        </section>

        <section className="legalPage__section">
          <h2 className="legalPage__sectionTitle">
            <span className="legalPage__sectionNumber">8</span>
            Terminación
          </h2>
          <p className="legalPage__text">
            Podemos terminar o suspender su cuenta inmediatamente, sin previo aviso ni responsabilidad, 
            por cualquier razón, incluyendo sin limitación si usted incumple los Términos.
          </p>
          <p className="legalPage__text">
            Tras la terminación, su derecho a usar el Servicio cesará inmediatamente. Si desea 
            cancelar su cuenta, puede simplemente dejar de usar el Servicio o contactarnos para 
            solicitar la eliminación de su cuenta.
          </p>
        </section>

        <section className="legalPage__section">
          <h2 className="legalPage__sectionTitle">
            <span className="legalPage__sectionNumber">9</span>
            Ley Aplicable
          </h2>
          <p className="legalPage__text">
            Estos Términos se regirán e interpretarán de acuerdo con las leyes de la República Argentina, 
            sin tener en cuenta sus disposiciones sobre conflictos de leyes. Cualquier disputa que surja 
            de estos Términos será sometida a la jurisdicción exclusiva de los tribunales competentes 
            de la Ciudad Autónoma de Buenos Aires.
          </p>
        </section>

        <div className="legalPage__contact">
          <h3 className="legalPage__contactTitle">¿Tienes preguntas sobre estos términos?</h3>
          <p className="legalPage__contactText">
            Nuestro equipo legal está disponible para aclarar cualquier duda
          </p>
          <a href="mailto:legal@pymecenter.app" className="legalPage__contactBtn">
            <Mail size={18} />
            Contactar al equipo legal
          </a>
        </div>
      </div>
    </div>
  )
}
