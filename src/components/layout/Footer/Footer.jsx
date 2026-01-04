import { useState } from 'react'
import { Link } from 'react-router-dom'
import './Footer.css'
import { 
  Store, 
  MapPin, 
  Phone, 
  Mail, 
  Clock,
  Instagram,
  Facebook,
  Twitter,
  MessageCircle,
  CreditCard,
  Shield,
  Award,
  HelpCircle,
  ChevronRight,
  Send,
  Heart
} from 'lucide-react'

export default function Footer({ variant = 'full' }) {
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

  // Variante compacta para páginas de auth
  if (variant === 'compact') {
    return (
      <footer className="footer footer--compact">
        <div className="footer__container">
          <div className="footer__compactInner">
            <div className="footer__brand">
              <div className="footer__brandIcon">
                <Store size={20} />
              </div>
              <span className="footer__brandName">Restos</span>
            </div>
            
            <div className="footer__compactLinks">
              <Link to="/" className="footer__compactLink">Inicio</Link>
              <Link to="/restaurantes" className="footer__compactLink">Restaurantes</Link>
              <Link to="/terminos" className="footer__compactLink">Términos</Link>
              <Link to="/privacidad" className="footer__compactLink">Privacidad</Link>
            </div>
            
            <div className="footer__compactSocial">
              <a href="https://instagram.com" target="_blank" rel="noreferrer" className="footer__socialBtn" title="Instagram">
                <Instagram size={16} />
              </a>
              <a href="https://facebook.com" target="_blank" rel="noreferrer" className="footer__socialBtn" title="Facebook">
                <Facebook size={16} />
              </a>
              <a href="https://wa.me" target="_blank" rel="noreferrer" className="footer__socialBtn" title="WhatsApp">
                <MessageCircle size={16} />
              </a>
            </div>
            
            <div className="footer__copyright">
              © {new Date().getFullYear()} Restos. Todos los derechos reservados.
            </div>
          </div>
        </div>
      </footer>
    )
  }

  // Footer completo para Home y páginas principales
  return (
    <footer className="footer">
      <div className="footer__container">
 {/* Grid principal del footer */}
        <div className="footer__grid">
          {/* Columna 1: Marca y descripción */}
          <div className="footer__column footer__column--brand">
            <div className="footer__brand">
              <div className="footer__brandIcon">
                <Store size={24} />
              </div>
              <span className="footer__brandName">Restos</span>
            </div>
            <p className="footer__brandDesc">
              La plataforma más completa para gestionar tu restaurante y tienda online. 
              Crea, administra y haz crecer tu negocio gastronómico.
            </p>
            <div className="footer__socialLinks">
              <a href="https://instagram.com" target="_blank" rel="noreferrer" className="footer__socialBtn" title="Instagram">
                <Instagram size={18} />
              </a>
              <a href="https://facebook.com" target="_blank" rel="noreferrer" className="footer__socialBtn" title="Facebook">
                <Facebook size={18} />
              </a>
              <a href="https://twitter.com" target="_blank" rel="noreferrer" className="footer__socialBtn" title="Twitter">
                <Twitter size={18} />
              </a>
              <a href="https://wa.me" target="_blank" rel="noreferrer" className="footer__socialBtn" title="WhatsApp">
                <MessageCircle size={18} />
              </a>
            </div>
          </div>

          {/* Columna 2: Navegación */}
          <div className="footer__column">
            <h4 className="footer__columnTitle">Navegación</h4>
            <ul className="footer__links">
              <li>
                <Link to="/" className="footer__link">
                  <ChevronRight size={14} />
                  Inicio
                </Link>
              </li>
              <li>
                <Link to="/restaurantes" className="footer__link">
                  <ChevronRight size={14} />
                  Restaurantes
                </Link>
              </li>
              <li>
                <Link to="/register" className="footer__link">
                  <ChevronRight size={14} />
                  Crear mi restaurante
                </Link>
              </li>
              <li>
                <Link to="/login" className="footer__link">
                  <ChevronRight size={14} />
                  Iniciar sesión
                </Link>
              </li>
            </ul>
          </div>

          {/* Columna 3: Soporte */}
          <div className="footer__column">
            <h4 className="footer__columnTitle">Soporte</h4>
            <ul className="footer__links">
              <li>
                <a href="mailto:soporte@restos.app" className="footer__link">
                  <ChevronRight size={14} />
                  Centro de ayuda
                </a>
              </li>
              <li>
                <Link to="/faq" className="footer__link">
                  <ChevronRight size={14} />
                  Preguntas frecuentes
                </Link>
              </li>
              <li>
                <a href="mailto:soporte@restos.app" className="footer__link">
                  <ChevronRight size={14} />
                  Contactar soporte
                </a>
              </li>
              <li>
                <a href="https://wa.me/5411123456789" target="_blank" rel="noreferrer" className="footer__link">
                  <ChevronRight size={14} />
                  WhatsApp
                </a>
              </li>
            </ul>
          </div>

          {/* Columna 4: Legal */}
          <div className="footer__column">
            <h4 className="footer__columnTitle">Legal</h4>
            <ul className="footer__links">
              <li>
                <Link to="/terminos" className="footer__link">
                  <ChevronRight size={14} />
                  Términos de servicio
                </Link>
              </li>
              <li>
                <Link to="/privacidad" className="footer__link">
                  <ChevronRight size={14} />
                  Política de privacidad
                </Link>
              </li>
              <li>
                <Link to="/cookies" className="footer__link">
                  <ChevronRight size={14} />
                  Política de cookies
                </Link>
              </li>
              <li>
                <Link to="/devoluciones" className="footer__link">
                  <ChevronRight size={14} />
                  Devoluciones
                </Link>
              </li>
            </ul>
          </div>

          {/* Columna 5: Contacto */}
          <div className="footer__column">
            <h4 className="footer__columnTitle">Contacto</h4>
            <ul className="footer__contactList">
              <li className="footer__contactItem">
                <MapPin size={16} />
                <span>Buenos Aires, Argentina</span>
              </li>
              <li className="footer__contactItem">
                <Phone size={16} />
                <a href="tel:+541112345678" className="footer__contactLink">+54 11 1234-5678</a>
              </li>
              <li className="footer__contactItem">
                <Mail size={16} />
                <a href="mailto:contacto@restos.app" className="footer__contactLink">contacto@restos.app</a>
              </li>
              <li className="footer__contactItem">
                <Clock size={16} />
                <span>Lun - Vie: 9:00 - 18:00</span>
              </li>
            </ul>
            
          </div>
          
        </div>
        {/* Copyright */}
        <div className="footer__bottom">
          <div className="footer__copyright">
            © {new Date().getFullYear()} Restos. Todos los derechos reservados.
          </div>
          <div className="footer__madeWith">
            Hecho con <Heart size={14} className="footer__heart" /> para restaurantes
          </div>
          <div className="footer__backLinks">
            <Link to="/" className="footer__backLink">Volver al inicio</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
