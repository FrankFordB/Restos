import { useState, useRef, useEffect } from 'react'
import { Shield, Loader2, AlertTriangle, ArrowLeft } from 'lucide-react'
import Button from '../../components/ui/Button/Button'
import { createTOTPChallenge, verifyTOTPChallenge } from '../../lib/supabaseAuth'
import './AuthPages.css'

export default function TwoFactorChallenge({ factors, onSuccess, onCancel }) {
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [challengeId, setChallengeId] = useState(null)
  const inputRefs = useRef([])

  const activeFactor = factors?.[0]

  // Create challenge on mount
  useEffect(() => {
    if (activeFactor) {
      createChallenge()
    }
  }, [activeFactor])

  // Auto-focus first input
  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  const createChallenge = async () => {
    try {
      const challenge = await createTOTPChallenge(activeFactor.id)
      setChallengeId(challenge.id)
    } catch (err) {
      setError('Error al crear el desafío de verificación')
    }
  }

  // Handle input change
  const handleChange = (index, value) => {
    if (value && !/^\d$/.test(value)) return

    const newCode = [...code]
    newCode[index] = value
    setCode(newCode)

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit
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

  // Verify code
  const handleVerify = async (otp) => {
    if (!challengeId || !activeFactor) {
      setError('No hay desafío activo. Intenta de nuevo.')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      await verifyTOTPChallenge({
        factorId: activeFactor.id,
        challengeId,
        code: otp,
      })
      onSuccess?.()
    } catch (err) {
      setError(err.message || 'Código incorrecto')
      setCode(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
      
      // Create new challenge for retry
      await createChallenge()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="twoFactorChallenge">
      <div className="twoFactorChallenge__header">
        <div className="twoFactorChallenge__icon">
          <Shield size={32} />
        </div>
        <h2>Verificación de dos factores</h2>
        <p>Ingresa el código de 6 dígitos de tu app autenticadora</p>
      </div>

      {error && (
        <div className="twoFactorChallenge__error">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      <div className="twoFactorChallenge__codeInputs" onPaste={handlePaste}>
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
            className="twoFactorChallenge__codeInput"
            disabled={isLoading}
          />
        ))}
      </div>

      {isLoading && (
        <div className="twoFactorChallenge__loading">
          <Loader2 size={20} className="spin" />
          Verificando...
        </div>
      )}

      <div className="twoFactorChallenge__actions">
        <Button
          onClick={() => handleVerify(code.join(''))}
          disabled={code.some(c => c === '') || isLoading}
        >
          Verificar
        </Button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="twoFactorChallenge__backBtn"
          >
            <ArrowLeft size={16} />
            Volver al login
          </button>
        )}
      </div>
    </div>
  )
}
