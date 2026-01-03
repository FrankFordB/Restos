import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import './LegalPages.css'
import { Shield, ChevronLeft, Mail, Lock, Eye, Database, Clock, UserCheck } from 'lucide-react'

export default function PrivacyPage() {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="legalPage">
      <div className="legalPage__hero">
        <div className="legalPage__heroContent">
          <div className="legalPage__icon">
            <Shield size={32} />
          </div>
          <h1 className="legalPage__title">Política de Privacidad</h1>
          <p className="legalPage__subtitle">
            Cómo recopilamos, usamos y protegemos tu información personal
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
          <Link to="/privacidad" className="legalPage__navLink legalPage__navLink--active">Privacidad</Link>
          <Link to="/cookies" className="legalPage__navLink">Cookies</Link>
          <Link to="/devoluciones" className="legalPage__navLink">Devoluciones</Link>
        </nav>

        <section className="legalPage__section">
          <h2 className="legalPage__sectionTitle">
            <span className="legalPage__sectionNumber">1</span>
            Información que Recopilamos
          </h2>
          <p className="legalPage__text">
            Recopilamos información que usted nos proporciona directamente, información que obtenemos 
            automáticamente cuando usa el Servicio, e información de terceros.
          </p>
          
          <h3 className="legalPage__sectionSubtitle">Información proporcionada directamente:</h3>
          <ul className="legalPage__list">
            <li><strong>Datos de registro:</strong> nombre, dirección de correo electrónico, número de teléfono, contraseña</li>
            <li><strong>Perfil del negocio:</strong> nombre del restaurante, dirección, horarios de operación, logotipo</li>
            <li><strong>Información de productos:</strong> descripciones, precios, imágenes de menú</li>
            <li><strong>Datos de pago:</strong> información de facturación (procesada por proveedores de pago seguros)</li>
            <li><strong>Comunicaciones:</strong> mensajes de soporte, comentarios y feedback</li>
          </ul>

          <h3 className="legalPage__sectionSubtitle">Información recopilada automáticamente:</h3>
          <ul className="legalPage__list">
            <li><strong>Datos de uso:</strong> páginas visitadas, funciones utilizadas, tiempo de sesión</li>
            <li><strong>Información del dispositivo:</strong> tipo de dispositivo, sistema operativo, navegador</li>
            <li><strong>Datos de ubicación:</strong> ubicación aproximada basada en dirección IP</li>
            <li><strong>Cookies y tecnologías similares:</strong> ver nuestra Política de Cookies</li>
          </ul>
        </section>

        <section className="legalPage__section">
          <h2 className="legalPage__sectionTitle">
            <span className="legalPage__sectionNumber">2</span>
            Cómo Usamos su Información
          </h2>
          <p className="legalPage__text">
            Utilizamos la información recopilada para los siguientes propósitos:
          </p>
          <ul className="legalPage__list">
            <li>Proporcionar, mantener y mejorar el Servicio</li>
            <li>Procesar transacciones y enviar notificaciones relacionadas</li>
            <li>Responder a sus solicitudes, comentarios y preguntas</li>
            <li>Enviar comunicaciones técnicas, actualizaciones y alertas de seguridad</li>
            <li>Enviar comunicaciones de marketing (con su consentimiento)</li>
            <li>Monitorear y analizar tendencias, uso y actividades</li>
            <li>Detectar, investigar y prevenir actividades fraudulentas</li>
            <li>Personalizar y mejorar su experiencia</li>
          </ul>
        </section>

        <section className="legalPage__section">
          <h2 className="legalPage__sectionTitle">
            <span className="legalPage__sectionNumber">3</span>
            Compartir Información
          </h2>
          <p className="legalPage__text">
            No vendemos su información personal. Compartimos información únicamente en las siguientes circunstancias:
          </p>
          <ul className="legalPage__list">
            <li><strong>Con proveedores de servicios:</strong> empresas que nos ayudan a operar el Servicio (hosting, pagos, análisis)</li>
            <li><strong>Por razones legales:</strong> cuando sea requerido por ley o para proteger derechos y seguridad</li>
            <li><strong>Transferencias comerciales:</strong> en caso de fusión, adquisición o venta de activos</li>
            <li><strong>Con su consentimiento:</strong> cuando usted nos autorice específicamente</li>
          </ul>
          <div className="legalPage__highlight">
            <p>
              <strong>Clientes finales:</strong> Cuando un cliente realiza un pedido en su restaurante, 
              compartimos con usted la información necesaria para cumplir con el pedido (nombre, dirección 
              de entrega, detalles del pedido).
            </p>
          </div>
        </section>

        <section className="legalPage__section">
          <h2 className="legalPage__sectionTitle">
            <span className="legalPage__sectionNumber">4</span>
            Seguridad de los Datos
          </h2>
          <p className="legalPage__text">
            Implementamos medidas de seguridad técnicas y organizativas diseñadas para proteger 
            su información personal contra acceso no autorizado, pérdida, destrucción o alteración:
          </p>
          <ul className="legalPage__list">
            <li>Cifrado SSL/TLS para todas las transmisiones de datos</li>
            <li>Almacenamiento seguro en servidores con acceso restringido</li>
            <li>Autenticación de dos factores disponible para cuentas</li>
            <li>Auditorías de seguridad regulares</li>
            <li>Capacitación del personal en protección de datos</li>
          </ul>
        </section>

        <section className="legalPage__section">
          <h2 className="legalPage__sectionTitle">
            <span className="legalPage__sectionNumber">5</span>
            Sus Derechos
          </h2>
          <p className="legalPage__text">
            Dependiendo de su ubicación, puede tener ciertos derechos con respecto a su información personal:
          </p>
          <ul className="legalPage__list">
            <li><strong>Acceso:</strong> solicitar una copia de la información que tenemos sobre usted</li>
            <li><strong>Rectificación:</strong> corregir información inexacta o incompleta</li>
            <li><strong>Eliminación:</strong> solicitar la eliminación de su información personal</li>
            <li><strong>Portabilidad:</strong> recibir sus datos en un formato estructurado y legible</li>
            <li><strong>Oposición:</strong> oponerse al procesamiento de sus datos para ciertos fines</li>
            <li><strong>Restricción:</strong> solicitar la limitación del procesamiento en ciertas circunstancias</li>
          </ul>
          <p className="legalPage__text">
            Para ejercer cualquiera de estos derechos, contáctenos a través de los canales indicados al final de esta página.
          </p>
        </section>

        <section className="legalPage__section">
          <h2 className="legalPage__sectionTitle">
            <span className="legalPage__sectionNumber">6</span>
            Retención de Datos
          </h2>
          <p className="legalPage__text">
            Conservamos su información personal mientras su cuenta esté activa o según sea necesario 
            para proporcionarle el Servicio. Después de la cancelación de la cuenta:
          </p>
          <ul className="legalPage__list">
            <li>Datos de cuenta: eliminados dentro de 30 días</li>
            <li>Registros de transacciones: conservados por 7 años (requisitos fiscales)</li>
            <li>Datos de análisis agregados: pueden conservarse indefinidamente</li>
            <li>Copias de seguridad: eliminadas en ciclos regulares (máximo 90 días)</li>
          </ul>
        </section>

        <section className="legalPage__section">
          <h2 className="legalPage__sectionTitle">
            <span className="legalPage__sectionNumber">7</span>
            Transferencias Internacionales
          </h2>
          <p className="legalPage__text">
            Su información puede ser transferida y almacenada en servidores ubicados fuera de su país 
            de residencia. Cuando transferimos datos a otros países, nos aseguramos de que existan 
            salvaguardas adecuadas, como cláusulas contractuales estándar o certificaciones de privacidad.
          </p>
        </section>

        <section className="legalPage__section">
          <h2 className="legalPage__sectionTitle">
            <span className="legalPage__sectionNumber">8</span>
            Menores de Edad
          </h2>
          <p className="legalPage__text">
            Nuestro Servicio no está dirigido a menores de 18 años. No recopilamos intencionalmente 
            información personal de menores. Si usted es padre o tutor y cree que su hijo nos ha 
            proporcionado información personal, contáctenos para solicitar su eliminación.
          </p>
        </section>

        <section className="legalPage__section">
          <h2 className="legalPage__sectionTitle">
            <span className="legalPage__sectionNumber">9</span>
            Cambios a esta Política
          </h2>
          <p className="legalPage__text">
            Podemos actualizar esta Política de Privacidad periódicamente. Le notificaremos sobre 
            cambios significativos publicando la nueva política en esta página y, cuando sea apropiado, 
            enviándole una notificación por correo electrónico. Le recomendamos revisar esta política 
            regularmente.
          </p>
        </section>

        <div className="legalPage__contact">
          <h3 className="legalPage__contactTitle">Delegado de Protección de Datos</h3>
          <p className="legalPage__contactText">
            Si tiene preguntas sobre el uso de sus datos personales, contáctenos
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
