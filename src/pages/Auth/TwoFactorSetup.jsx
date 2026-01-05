import { useState, useEffect } from 'react'
import { Shield, Smartphone, Key, Check, X, Loader2, Copy, CheckCircle, AlertTriangle } from 'lucide-react'
import Button from '../../components/ui/Button/Button'
import {
  enrollTOTP,
  verifyTOTPEnrollment,
  getMFAFactors,
  unenrollMFA,
  getAuthenticatorAssuranceLevel,
} from '../../lib/supabaseAuth'
import './TwoFactorSetup.css'

export default function TwoFactorSetup({ onComplete, onClose }) {
  const [step, setStep] = useState('intro') // intro, qr, verify, success
  const [totpData, setTotpData] = useState(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [factors, setFactors] = useState([])
  const [copied, setCopied] = useState(false)

  // Load existing MFA factors
  useEffect(() => {
    loadFactors()
  }, [])

  const loadFactors = async () => {
    try {
      const { totp } = await getMFAFactors()
      setFactors(totp || [])
      
      // If already has 2FA enabled, show manage view
      if (totp && totp.length > 0) {
        setStep('manage')
      }
    } catch (err) {
      // No factors
    }
  }

  // Start enrollment
  const handleStartEnrollment = async () => {
    setIsLoading(true)
    setError('')

    try {
      const data = await enrollTOTP()
      setTotpData(data)
      setStep('qr')
    } catch (err) {
      setError(err.message || 'Error al configurar 2FA')
    } finally {
      setIsLoading(false)
    }
  }

  // Verify and complete enrollment
  const handleVerify = async (e) => {
    e?.preventDefault()
    if (code.length !== 6) {
      setError('El código debe tener 6 dígitos')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      await verifyTOTPEnrollment({
        factorId: totpData.factorId,
        code,
      })
      setStep('success')
      
      // Notify parent after delay
      setTimeout(() => {
        onComplete?.()
      }, 2000)
    } catch (err) {
      setError(err.message || 'Código incorrecto')
      setCode('')
    } finally {
      setIsLoading(false)
    }
  }

  // Disable 2FA
  const handleDisable2FA = async (factorId) => {
    if (!confirm('¿Estás seguro de desactivar la autenticación de dos factores?')) {
      return
    }

    setIsLoading(true)
    try {
      await unenrollMFA(factorId)
      setFactors([])
      setStep('intro')
    } catch (err) {
      setError(err.message || 'Error al desactivar 2FA')
    } finally {
      setIsLoading(false)
    }
  }

  // Copy secret to clipboard
  const copySecret = () => {
    navigator.clipboard.writeText(totpData?.secret || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Intro step
  if (step === 'intro') {
    return (
      <div className="twoFactorSetup">
        <div className="twoFactorSetup__header">
          <div className="twoFactorSetup__icon">
            <Shield size={32} />
          </div>
          <h2>Autenticación de Dos Factores</h2>
          <p>Añade una capa extra de seguridad a tu cuenta</p>
        </div>

        <div className="twoFactorSetup__benefits">
          <div className="twoFactorSetup__benefit">
            <Shield size={20} />
            <div>
              <strong>Protección adicional</strong>
              <span>Incluso si alguien obtiene tu contraseña, no podrá acceder sin el código</span>
            </div>
          </div>
          <div className="twoFactorSetup__benefit">
            <Smartphone size={20} />
            <div>
              <strong>App autenticadora</strong>
              <span>Usa Google Authenticator, Authy u otra app compatible</span>
            </div>
          </div>
          <div className="twoFactorSetup__benefit">
            <Key size={20} />
            <div>
              <strong>Códigos únicos</strong>
              <span>Cada código expira en 30 segundos</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="twoFactorSetup__error">
            <AlertTriangle size={18} />
            {error}
          </div>
        )}

        <div className="twoFactorSetup__actions">
          <Button onClick={handleStartEnrollment} disabled={isLoading}>
            {isLoading ? <Loader2 size={18} className="spin" /> : <Shield size={18} />}
            Configurar 2FA
          </Button>
          {onClose && (
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
          )}
        </div>
      </div>
    )
  }

  // QR Code step
  if (step === 'qr') {
    return (
      <div className="twoFactorSetup">
        <div className="twoFactorSetup__header">
          <h2>Escanea el código QR</h2>
          <p>Abre tu app autenticadora y escanea este código</p>
        </div>

        <div className="twoFactorSetup__qrContainer">
          {totpData?.qrCode && (
            <img 
              src={totpData.qrCode} 
              alt="QR Code para 2FA" 
              className="twoFactorSetup__qr"
            />
          )}
        </div>

        <div className="twoFactorSetup__secretContainer">
          <p className="twoFactorSetup__secretLabel">
            ¿No puedes escanear? Ingresa este código manualmente:
          </p>
          <div className="twoFactorSetup__secret">
            <code>{totpData?.secret}</code>
            <button
              type="button"
              onClick={copySecret}
              className="twoFactorSetup__copyBtn"
            >
              {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
            </button>
          </div>
        </div>

        <form onSubmit={handleVerify} className="twoFactorSetup__verifyForm">
          <p className="twoFactorSetup__verifyLabel">
            Ingresa el código de 6 dígitos de tu app:
          </p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            className="twoFactorSetup__codeInput"
            autoFocus
          />

          {error && (
            <div className="twoFactorSetup__error">
              <AlertTriangle size={18} />
              {error}
            </div>
          )}

          <div className="twoFactorSetup__actions">
            <Button type="submit" disabled={code.length !== 6 || isLoading}>
              {isLoading ? <Loader2 size={18} className="spin" /> : <Check size={18} />}
              Verificar y activar
            </Button>
            <Button variant="ghost" onClick={() => setStep('intro')}>
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    )
  }

  // Success step
  if (step === 'success') {
    return (
      <div className="twoFactorSetup">
        <div className="twoFactorSetup__success">
          <div className="twoFactorSetup__successIcon">
            <CheckCircle size={48} />
          </div>
          <h2>¡2FA Activado!</h2>
          <p>Tu cuenta ahora está protegida con autenticación de dos factores</p>
        </div>
      </div>
    )
  }

  // Manage existing 2FA
  if (step === 'manage') {
    return (
      <div className="twoFactorSetup">
        <div className="twoFactorSetup__header">
          <div className="twoFactorSetup__icon twoFactorSetup__icon--active">
            <Shield size={32} />
          </div>
          <h2>2FA Activo</h2>
          <p>Tu cuenta está protegida con autenticación de dos factores</p>
        </div>

        <div className="twoFactorSetup__factorList">
          {factors.map((factor) => (
            <div key={factor.id} className="twoFactorSetup__factor">
              <div className="twoFactorSetup__factorInfo">
                <Smartphone size={20} />
                <div>
                  <strong>{factor.friendly_name || 'Authenticator App'}</strong>
                  <span>Configurado el {new Date(factor.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDisable2FA(factor.id)}
                className="twoFactorSetup__removeBtn"
                disabled={isLoading}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>

        {error && (
          <div className="twoFactorSetup__error">
            <AlertTriangle size={18} />
            {error}
          </div>
        )}

        <div className="twoFactorSetup__actions">
          {onClose && (
            <Button variant="ghost" onClick={onClose}>
              Cerrar
            </Button>
          )}
        </div>
      </div>
    )
  }

  return null
}
