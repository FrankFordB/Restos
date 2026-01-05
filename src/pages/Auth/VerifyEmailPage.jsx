import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Mail, ArrowRight, RefreshCw, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import Button from '../../components/ui/Button/Button'
import { verifyEmailOTP, resendVerificationOTP } from '../../lib/supabaseAuth'
import './AuthPages.css'

export default function VerifyEmailPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const email = location.state?.email || ''
  const returnTo = location.state?.returnTo || '/register?step=2'
  
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [status, setStatus] = useState('idle') // idle, verifying, success, error
  const [error, setError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const [canResend, setCanResend] = useState(true)
  
  const inputRefs = useRef([])

  // Countdown for resend
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    } else {
      setCanResend(true)
    }
  }, [resendCooldown])

  // Auto-focus first input
  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  // Handle input change
  const handleChange = (index, value) => {
    // Only allow numbers
    if (value && !/^\d$/.test(value)) return

    const newCode = [...code]
    newCode[index] = value
    setCode(newCode)

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all fields are filled
    if (value && index === 5 && newCode.every(c => c !== '')) {
      handleVerify(newCode.join(''))
    }
  }

  // Handle backspace
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  // Handle paste
  const handlePaste = (e) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pastedData.length === 6) {
      const newCode = pastedData.split('')
      setCode(newCode)
      inputRefs.current[5]?.focus()
      handleVerify(pastedData)
    }
  }

  // Verify OTP
  const handleVerify = async (otp) => {
    if (!email) {
      setError('No se encontró el email. Por favor, vuelve al registro.')
      return
    }

    setStatus('verifying')
    setError('')

    try {
      await verifyEmailOTP({ email, token: otp })
      setStatus('success')
      
      // Redirect after short delay
      setTimeout(() => {
        navigate(returnTo)
      }, 1500)
    } catch (err) {
      setStatus('error')
      setError(err.message || 'Código incorrecto. Intenta de nuevo.')
      setCode(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    }
  }

  // Resend verification code
  const handleResend = async () => {
    if (!canResend || !email) return

    setCanResend(false)
    setResendCooldown(60)
    setError('')

    try {
      await resendVerificationOTP(email)
    } catch (err) {
      setError('Error al reenviar el código. Intenta más tarde.')
      setCanResend(true)
      setResendCooldown(0)
    }
  }

  if (!email) {
    return (
      <div className="authPage">
        <div className="authPage__formPanel authPage__formPanel--centered">
          <div className="authPage__formWrapper">
            <div className="verifyEmail__error">
              <XCircle size={48} />
              <h2>Email no encontrado</h2>
              <p>No pudimos encontrar tu email. Por favor, vuelve a registrarte.</p>
              <Button onClick={() => navigate('/register')}>
                Volver al registro
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="authPage">
      <div className="authPage__formPanel authPage__formPanel--centered">
        <div className="authPage__formWrapper">
          <div className="verifyEmail">
            {/* Header */}
            <div className="verifyEmail__header">
              <div className="verifyEmail__icon">
                <Mail size={32} />
              </div>
              <h2 className="verifyEmail__title">Verifica tu email</h2>
              <p className="verifyEmail__subtitle">
                Enviamos un código de 6 dígitos a
              </p>
              <p className="verifyEmail__email">{email}</p>
            </div>

            {/* Status Messages */}
            {status === 'success' && (
              <div className="verifyEmail__success">
                <CheckCircle size={24} />
                <span>¡Verificación exitosa! Redirigiendo...</span>
              </div>
            )}

            {error && (
              <div className="verifyEmail__errorMsg">
                <XCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            {/* OTP Input */}
            <div className="verifyEmail__codeInputs" onPaste={handlePaste}>
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className={`verifyEmail__codeInput ${
                    status === 'error' ? 'verifyEmail__codeInput--error' : ''
                  } ${status === 'success' ? 'verifyEmail__codeInput--success' : ''}`}
                  disabled={status === 'verifying' || status === 'success'}
                />
              ))}
            </div>

            {/* Loading indicator */}
            {status === 'verifying' && (
              <div className="verifyEmail__loading">
                <Loader2 size={24} className="verifyEmail__spinner" />
                <span>Verificando...</span>
              </div>
            )}

            {/* Actions */}
            <div className="verifyEmail__actions">
              <Button
                onClick={() => handleVerify(code.join(''))}
                disabled={code.some(c => c === '') || status === 'verifying' || status === 'success'}
                className="verifyEmail__submitBtn"
              >
                Verificar
                <ArrowRight size={18} />
              </Button>
            </div>

            {/* Resend */}
            <div className="verifyEmail__resend">
              <span>¿No recibiste el código?</span>
              <button
                type="button"
                onClick={handleResend}
                disabled={!canResend}
                className="verifyEmail__resendBtn"
              >
                <RefreshCw size={14} className={!canResend ? 'verifyEmail__resendIcon--spinning' : ''} />
                {canResend ? 'Reenviar código' : `Reenviar en ${resendCooldown}s`}
              </button>
            </div>

            {/* Back to register */}
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="verifyEmail__backBtn"
            >
              ← Volver al registro
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
