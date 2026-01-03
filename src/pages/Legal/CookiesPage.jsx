import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import './LegalPages.css'
import { Cookie, ChevronLeft, Mail, Settings, BarChart3, Target, Clock, ToggleLeft } from 'lucide-react'

export default function CookiesPage() {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="legalPage">
      <div className="legalPage__hero">
        <div className="legalPage__heroContent">
          <div className="legalPage__icon">
            <Cookie size={32} />
          </div>
          <h1 className="legalPage__title">Política de Cookies</h1>
          <p className="legalPage__subtitle">
            Información sobre las cookies que utilizamos y cómo gestionarlas
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
          <Link to="/terminos" className="legalPage__navLink">Términos</Link>
          <Link to="/privacidad" className="legalPage__navLink">Privacidad</Link>
          <Link to="/cookies" className="legalPage__navLink legalPage__navLink--active">Cookies</Link>
          <Link to="/devoluciones" className="legalPage__navLink">Devoluciones</Link>
        </nav>

        <section className="legalPage__section">
          <h2 className="legalPage__sectionTitle">
            <span className="legalPage__sectionNumber">1</span>
            ¿Qué son las Cookies?
          </h2>
          <p className="legalPage__text">
            Las cookies son pequeños archivos de texto que se almacenan en su dispositivo (ordenador, 
            tablet o móvil) cuando visita un sitio web. Las cookies permiten que el sitio recuerde 
            sus acciones y preferencias durante un período de tiempo, para que no tenga que 
            reintroducirlos cada vez que regrese al sitio o navegue entre páginas.
          </p>
          <p className="legalPage__text">
            También utilizamos tecnologías similares como almacenamiento local (localStorage), 
            almacenamiento de sesión (sessionStorage) y píxeles de seguimiento para propósitos similares.
          </p>
        </section>

        <section className="legalPage__section">
          <h2 className="legalPage__sectionTitle">
            <span className="legalPage__sectionNumber">2</span>
            Tipos de Cookies que Utilizamos
          </h2>
          
          <div className="legalPage__cookieType">
            <h3 className="legalPage__sectionSubtitle">🔒 Cookies Estrictamente Necesarias</h3>
            <p className="legalPage__text">
              Estas cookies son esenciales para que el sitio funcione correctamente. No pueden ser 
              desactivadas en nuestros sistemas.
            </p>
            <table className="legalPage__table">
              <thead>
                <tr>
                  <th>Cookie</th>
                  <th>Propósito</th>
                  <th>Duración</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>session_token</td>
                  <td>Mantiene su sesión iniciada</td>
                  <td>Sesión</td>
                </tr>
                <tr>
                  <td>csrf_token</td>
                  <td>Seguridad contra ataques CSRF</td>
                  <td>Sesión</td>
                </tr>
                <tr>
                  <td>cookie_consent</td>
                  <td>Guarda sus preferencias de cookies</td>
                  <td>1 año</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="legalPage__cookieType">
            <h3 className="legalPage__sectionSubtitle">⚙️ Cookies de Funcionalidad</h3>
            <p className="legalPage__text">
              Permiten funciones mejoradas y personalización, como recordar su idioma preferido 
              o la región en la que se encuentra.
            </p>
            <table className="legalPage__table">
              <thead>
                <tr>
                  <th>Cookie</th>
                  <th>Propósito</th>
                  <th>Duración</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>theme_preference</td>
                  <td>Guarda su preferencia de tema (claro/oscuro)</td>
                  <td>1 año</td>
                </tr>
                <tr>
                  <td>language</td>
                  <td>Recuerda su idioma preferido</td>
                  <td>1 año</td>
                </tr>
                <tr>
                  <td>cart_data</td>
                  <td>Mantiene los productos en su carrito</td>
                  <td>7 días</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="legalPage__cookieType">
            <h3 className="legalPage__sectionSubtitle">📊 Cookies de Análisis</h3>
            <p className="legalPage__text">
              Nos ayudan a entender cómo los visitantes interactúan con el sitio recopilando 
              información de forma anónima.
            </p>
            <table className="legalPage__table">
              <thead>
                <tr>
                  <th>Cookie</th>
                  <th>Propósito</th>
                  <th>Duración</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>_ga</td>
                  <td>Google Analytics - distingue usuarios</td>
                  <td>2 años</td>
                </tr>
                <tr>
                  <td>_gid</td>
                  <td>Google Analytics - distingue usuarios</td>
                  <td>24 horas</td>
                </tr>
                <tr>
                  <td>_gat</td>
                  <td>Google Analytics - limita tasa de solicitudes</td>
                  <td>1 minuto</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="legalPage__cookieType">
            <h3 className="legalPage__sectionSubtitle">🎯 Cookies de Marketing</h3>
            <p className="legalPage__text">
              Se utilizan para rastrear visitantes en los sitios web con la intención de mostrar 
              anuncios relevantes y atractivos.
            </p>
            <table className="legalPage__table">
              <thead>
                <tr>
                  <th>Cookie</th>
                  <th>Propósito</th>
                  <th>Duración</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>_fbp</td>
                  <td>Facebook Pixel - publicidad personalizada</td>
                  <td>3 meses</td>
                </tr>
                <tr>
                  <td>fr</td>
                  <td>Facebook - publicidad y análisis</td>
                  <td>3 meses</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="legalPage__section">
          <h2 className="legalPage__sectionTitle">
            <span className="legalPage__sectionNumber">3</span>
            Cómo Gestionar las Cookies
          </h2>
          <p className="legalPage__text">
            Puede controlar y/o eliminar las cookies según desee. Tiene las siguientes opciones:
          </p>
          
          <h3 className="legalPage__sectionSubtitle">A través de nuestro sitio:</h3>
          <p className="legalPage__text">
            Cuando visita nuestro sitio por primera vez, se le muestra un banner de cookies donde 
            puede aceptar o rechazar las cookies no esenciales. Puede cambiar sus preferencias en 
            cualquier momento desde la configuración de su cuenta.
          </p>

          <h3 className="legalPage__sectionSubtitle">A través de su navegador:</h3>
          <p className="legalPage__text">
            La mayoría de los navegadores le permiten:
          </p>
          <ul className="legalPage__list">
            <li>Ver qué cookies tiene almacenadas y eliminarlas individualmente</li>
            <li>Bloquear cookies de terceros</li>
            <li>Bloquear cookies de sitios específicos</li>
            <li>Bloquear todas las cookies</li>
            <li>Eliminar todas las cookies al cerrar el navegador</li>
          </ul>

          <div className="legalPage__highlight">
            <p>
              <strong>Nota:</strong> Si bloquea o elimina las cookies, algunas funciones del sitio 
              pueden no funcionar correctamente. Por ejemplo, no podremos recordar sus preferencias 
              o mantener su sesión iniciada.
            </p>
          </div>
        </section>

        <section className="legalPage__section">
          <h2 className="legalPage__sectionTitle">
            <span className="legalPage__sectionNumber">4</span>
            Enlaces a Configuración de Navegadores
          </h2>
          <p className="legalPage__text">
            Puede encontrar información sobre cómo gestionar cookies en los navegadores más populares:
          </p>
          <ul className="legalPage__list">
            <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer">Google Chrome</a></li>
            <li><a href="https://support.mozilla.org/es/kb/habilitar-y-deshabilitar-cookies" target="_blank" rel="noopener noreferrer">Mozilla Firefox</a></li>
            <li><a href="https://support.apple.com/es-es/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer">Safari</a></li>
            <li><a href="https://support.microsoft.com/es-es/microsoft-edge/eliminar-cookies-en-microsoft-edge" target="_blank" rel="noopener noreferrer">Microsoft Edge</a></li>
          </ul>
        </section>

        <section className="legalPage__section">
          <h2 className="legalPage__sectionTitle">
            <span className="legalPage__sectionNumber">5</span>
            Almacenamiento Local
          </h2>
          <p className="legalPage__text">
            Además de cookies, utilizamos tecnologías de almacenamiento local del navegador:
          </p>
          <ul className="legalPage__list">
            <li><strong>localStorage:</strong> almacena datos sin fecha de expiración (preferencias, caché)</li>
            <li><strong>sessionStorage:</strong> almacena datos solo para la sesión actual</li>
          </ul>
          <p className="legalPage__text">
            Puede eliminar estos datos a través de las herramientas de desarrollo de su navegador 
            o limpiando los datos del sitio en la configuración.
          </p>
        </section>

        <section className="legalPage__section">
          <h2 className="legalPage__sectionTitle">
            <span className="legalPage__sectionNumber">6</span>
            Actualizaciones de esta Política
          </h2>
          <p className="legalPage__text">
            Podemos actualizar esta Política de Cookies para reflejar cambios en nuestras prácticas 
            o por otros motivos operativos, legales o regulatorios. Le animamos a revisar esta 
            política periódicamente para estar informado sobre cómo utilizamos las cookies.
          </p>
        </section>

        <div className="legalPage__contact">
          <h3 className="legalPage__contactTitle">¿Preguntas sobre cookies?</h3>
          <p className="legalPage__contactText">
            Si tiene alguna duda sobre nuestra política de cookies, contáctenos
          </p>
          <a href="mailto:privacidad@restos.app" className="legalPage__contactBtn">
            <Mail size={18} />
            privacidad@restos.app
          </a>
        </div>
      </div>
    </div>
  )
}
