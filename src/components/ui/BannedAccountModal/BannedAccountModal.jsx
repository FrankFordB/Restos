import { useEffect } from 'react'
import { ShieldX, AlertTriangle, Mail, FileText, LogOut, X, MessageCircle, ClipboardList } from 'lucide-react'
import './BannedAccountModal.css'

/**
 * Modal moderno para cuentas baneadas/suspendidas
 * Muestra información clara sobre la suspensión y enlace a términos y condiciones
 */
export default function BannedAccountModal({
  open,
  email,
  message,
  onSignOut,
}) {
  // Bloquear scroll cuando el modal está abierto
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return (
    <div className="bannedModal" role="dialog" aria-modal="true">
      <div className="bannedModal__backdrop" />
      
      <div className="bannedModal__content">
        {/* Header */}
        <div className="bannedModal__header">
          <div className="bannedModal__iconWrapper">
            <ShieldX size={32} strokeWidth={1.5} />
          </div>
          <div className="bannedModal__headerText">
            <h2 className="bannedModal__title">Cuenta Suspendida</h2>
            <p className="bannedModal__subtitle">Tu acceso ha sido restringido</p>
          </div>
          <button 
            className="bannedModal__closeBtn"
            onClick={onSignOut}
            aria-label="Cerrar sesión"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="bannedModal__body">
          {/* Mensaje principal */}
          <div className="bannedModal__message">
            <AlertTriangle size={20} className="bannedModal__messageIcon" />
            <p className="bannedModal__messageText">
              {message || 'Tu cuenta ha sido suspendida por no cumplir con nuestras políticas de uso.'}
            </p>
          </div>

          {/* Email de la cuenta */}
          {email && (
            <div className="bannedModal__accountInfo">
              <Mail size={18} />
              <span className="bannedModal__accountEmail">{email}</span>
            </div>
          )}

          {/* Razones */}
          <div className="bannedModal__reasons">
            <h4 className="bannedModal__reasonsTitle">
              <ClipboardList size={18} />
              Posibles motivos de suspensión
            </h4>
            <ul className="bannedModal__reasonsList">
              <li>Contenido inapropiado o engañoso</li>
              <li>Uso indebido de la plataforma</li>
              <li>Violación de derechos de terceros</li>
              <li>Actividad sospechosa o fraudulenta</li>
            </ul>
          </div>

          {/* Términos y condiciones */}
          <div className="bannedModal__terms">
            <FileText size={20} className="bannedModal__termsIcon" />
            <p className="bannedModal__termsText">
              Para más información, consulta nuestros{' '}
              <a href="/terminos" target="_blank" rel="noopener noreferrer" className="bannedModal__termsLink">
                Términos y Condiciones
              </a>
              {' '}y{' '}
              <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="bannedModal__termsLink">
                Política de Privacidad
              </a>.
            </p>
          </div>

          {/* Contacto */}
          <div className="bannedModal__contact">
            <MessageCircle size={20} className="bannedModal__contactIcon" />
            <div className="bannedModal__contactContent">
              <strong>¿Crees que es un error?</strong>
              <p>
                Si consideras que tu cuenta fue suspendida por error, puedes contactarnos para solicitar una revisión:
              </p>
              
            </div>
          </div>
        <div className="bannedModal__contactButtons">
                <a 
                  href="mailto:soporte@pymecenter.app?subject=Revisión de cuenta suspendida" 
                  className="bannedModal__contactBtn bannedModal__contactBtn--email"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Mail size={16} />
                  Enviar email
                </a>
                <a 
                  href="https://wa.me/5493517532818?text=Hola, mi cuenta fue suspendida y creo que es un error. Mi email es: " 
                  className="bannedModal__contactBtn bannedModal__contactBtn--whatsapp"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  WhatsApp
                </a>
              </div>
          
        </div>
      </div>
    </div>
  )
}
