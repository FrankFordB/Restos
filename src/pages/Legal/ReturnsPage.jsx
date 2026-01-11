import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import './LegalPages.css'
import { RotateCcw, ChevronLeft, Mail, Store, AlertTriangle, Clock, CheckCircle, Pizza, Package } from 'lucide-react'

export default function ReturnsPage() {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="legalPage">
      <div className="legalPage__hero">
        <div className="legalPage__heroContent">
          <div className="legalPage__icon">
            <RotateCcw size={32} />
          </div>
          <h1 className="legalPage__title">Política de Devoluciones</h1>
          <p className="legalPage__subtitle">
            Información sobre devoluciones y reembolsos en la plataforma
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
          <Link to="/cookies" className="legalPage__navLink">Cookies</Link>
          <Link to="/devoluciones" className="legalPage__navLink legalPage__navLink--active">Devoluciones</Link>
        </nav>

        <div className="legalPage__importantNotice">
          <AlertTriangle size={24} />
          <div>
            <h3>Información Importante</h3>
            <p>
              Restos es una plataforma que conecta restaurantes con sus clientes. <strong>Las políticas 
              de devolución son gestionadas individualmente por cada restaurante</strong> según sus 
              propias normas y procedimientos.
            </p>
          </div>
        </div>

        <section className="legalPage__section">
          <h2 className="legalPage__sectionTitle">
            <span className="legalPage__sectionNumber">1</span>
            Sobre las Devoluciones de Pedidos
          </h2>
          <p className="legalPage__text">
            Cada restaurante que opera en nuestra plataforma es responsable de establecer y aplicar 
            sus propias políticas de devolución y reembolso. Estas políticas pueden variar según:
          </p>
          <ul className="legalPage__list">
            <li>El tipo de establecimiento y productos ofrecidos</li>
            <li>La naturaleza del problema (error en el pedido, calidad, demora, etc.)</li>
            <li>Las leyes y regulaciones locales aplicables</li>
            <li>Los términos específicos del restaurante</li>
          </ul>
        </section>

        <section className="legalPage__section">
          <h2 className="legalPage__sectionTitle">
            <span className="legalPage__sectionNumber">2</span>
            Cómo Solicitar una Devolución
          </h2>
          <p className="legalPage__text">
            Si tiene un problema con su pedido, siga estos pasos:
          </p>
          
          <div className="legalPage__steps">
            <div className="legalPage__step">
              <span className="legalPage__stepNumber">1</span>
              <div className="legalPage__stepContent">
                <h4>Contacte al restaurante directamente</h4>
                <p>Comuníquese con el restaurante lo antes posible después de recibir su pedido. 
                La información de contacto está disponible en la tienda del restaurante.</p>
              </div>
            </div>
            
            <div className="legalPage__step">
              <span className="legalPage__stepNumber">2</span>
              <div className="legalPage__stepContent">
                <h4>Describa el problema</h4>
                <p>Explique claramente el motivo de su reclamo. Si es posible, tome fotografías 
                del producto o del problema.</p>
              </div>
            </div>
            
            <div className="legalPage__step">
              <span className="legalPage__stepNumber">3</span>
              <div className="legalPage__stepContent">
                <h4>Espere la respuesta del restaurante</h4>
                <p>El restaurante evaluará su solicitud y le ofrecerá una solución según sus 
                políticas internas.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="legalPage__section">
          <h2 className="legalPage__sectionTitle">
            <span className="legalPage__sectionNumber">3</span>
            Situaciones Comunes
          </h2>
          
          <div className="legalPage__scenario">
            <h3 className="legalPage__sectionSubtitle"><Pizza size={18} /> Producto incorrecto o faltante</h3>
            <p className="legalPage__text">
              Si recibió un producto diferente al ordenado o falta algún artículo, el restaurante 
              generalmente ofrecerá:
            </p>
            <ul className="legalPage__list">
              <li>Envío del producto correcto o faltante</li>
              <li>Crédito para una próxima compra</li>
              <li>Reembolso parcial o total</li>
            </ul>
          </div>

          <div className="legalPage__scenario">
            <h3 className="legalPage__sectionSubtitle"><Clock size={18} /> Demora excesiva en la entrega</h3>
            <p className="legalPage__text">
              Si su pedido llegó significativamente tarde, el restaurante puede ofrecer:
            </p>
            <ul className="legalPage__list">
              <li>Descuento en el pedido actual</li>
              <li>Cupón de descuento para futuras compras</li>
              <li>En casos extremos, reembolso parcial</li>
            </ul>
          </div>

          <div className="legalPage__scenario">
            <h3 className="legalPage__sectionSubtitle"><Package size={18} /> Producto dañado o en mal estado</h3>
            <p className="legalPage__text">
              Si el producto llegó dañado o no apto para consumo:
            </p>
            <ul className="legalPage__list">
              <li>Documente el estado con fotografías</li>
              <li>Contacte inmediatamente al restaurante</li>
              <li>El restaurante típicamente ofrecerá reemplazo o reembolso completo</li>
            </ul>
          </div>
        </section>

        <section className="legalPage__section">
          <h2 className="legalPage__sectionTitle">
            <span className="legalPage__sectionNumber">4</span>
            Cancelación de Pedidos
          </h2>
          <p className="legalPage__text">
            La posibilidad de cancelar un pedido depende del estado de preparación:
          </p>
          <ul className="legalPage__list">
            <li><strong>Antes de la confirmación:</strong> Generalmente puede cancelar sin cargo</li>
            <li><strong>En preparación:</strong> Cancelación parcial o con cargo posible</li>
            <li><strong>En camino o entregado:</strong> No es posible cancelar</li>
          </ul>
          <div className="legalPage__highlight">
            <p>
              <strong>Consejo:</strong> Si necesita cancelar, actúe lo más rápido posible y 
              comuníquese directamente con el restaurante.
            </p>
          </div>
        </section>

        <section className="legalPage__section">
          <h2 className="legalPage__sectionTitle">
            <span className="legalPage__sectionNumber">5</span>
            Reembolsos de Pagos
          </h2>
          <p className="legalPage__text">
            Cuando un reembolso es aprobado por el restaurante:
          </p>
          <ul className="legalPage__list">
            <li>Los reembolsos se procesan al mismo método de pago utilizado</li>
            <li>El tiempo de procesamiento puede variar de 3 a 10 días hábiles</li>
            <li>El tiempo exacto depende del banco o emisor de su tarjeta</li>
            <li>Para pagos en efectivo, el restaurante coordinará directamente con usted</li>
          </ul>
        </section>

        <section className="legalPage__section">
          <h2 className="legalPage__sectionTitle">
            <span className="legalPage__sectionNumber">6</span>
            Rol de Restos como Plataforma
          </h2>
          <p className="legalPage__text">
            Como plataforma intermediaria, Restos:
          </p>
          <ul className="legalPage__list">
            <li>Facilita la comunicación entre clientes y restaurantes</li>
            <li>Proporciona herramientas para gestión de pedidos</li>
            <li>Procesa pagos de manera segura</li>
            <li>Puede mediar en disputas cuando sea necesario</li>
          </ul>
          <p className="legalPage__text">
            Sin embargo, la responsabilidad final sobre la calidad del producto, el servicio y 
            las devoluciones recae en cada restaurante individual.
          </p>
        </section>

        <section className="legalPage__section">
          <h2 className="legalPage__sectionTitle">
            <span className="legalPage__sectionNumber">7</span>
            Derechos del Consumidor
          </h2>
          <p className="legalPage__text">
            Independientemente de las políticas individuales de cada restaurante, usted tiene 
            derechos como consumidor protegidos por la Ley de Defensa del Consumidor (Ley 24.240) 
            en Argentina, que incluyen:
          </p>
          <ul className="legalPage__list">
            <li>Derecho a información clara y veraz sobre productos y servicios</li>
            <li>Protección contra publicidad engañosa</li>
            <li>Derecho a reclamo ante organismos de defensa del consumidor</li>
            <li>Garantía legal sobre productos y servicios</li>
          </ul>
        </section>

        <section className="legalPage__section">
          <h2 className="legalPage__sectionTitle">
            <span className="legalPage__sectionNumber">8</span>
            Devoluciones de Suscripciones (Para Restaurantes)
          </h2>
          <p className="legalPage__text">
            Si usted es un restaurante suscrito a nuestros planes:
          </p>
          <ul className="legalPage__list">
            <li>Puede cancelar su suscripción en cualquier momento desde su panel de control</li>
            <li>La cancelación se hace efectiva al final del período de facturación actual</li>
            <li>No se emiten reembolsos por períodos parciales</li>
            <li>Los datos de su tienda se conservan por 30 días después de la cancelación</li>
          </ul>
        </section>

        <div className="legalPage__contact">
          <h3 className="legalPage__contactTitle">¿Problemas sin resolver?</h3>
          <p className="legalPage__contactText">
            Si no logra resolver un problema directamente con el restaurante, nuestro equipo de 
            soporte puede ayudar a mediar
          </p>
          <a href="mailto:soporte@restos.app" className="legalPage__contactBtn">
            <Mail size={18} />
            soporte@restos.app
          </a>
        </div>
      </div>
    </div>
  )
}
