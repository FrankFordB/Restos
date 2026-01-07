import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { useAppDispatch } from '../../app/hooks'
import { handleOAuthCallback } from '../../lib/supabaseAuth'
import { setUserFromOAuth } from '../../features/auth/authSlice'
import './AuthPages.css'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const [status, setStatus] = useState('loading') // loading, success, error
  const [error, setError] = useState('')

  useEffect(() => {
    handleCallback()
  }, [])

  const handleCallback = async () => {
    try {
      const session = await handleOAuthCallback()
      
      if (!session) {
        throw new Error('No se pudo obtener la sesión')
      }

      // Login user and redirect to dashboard
      await dispatch(setUserFromOAuth(session))
      setStatus('success')
      setTimeout(() => {
        navigate('/dashboard')
      }, 1000)
    } catch (err) {
      setStatus('error')
      setError(err.message || 'Error en la autenticación')
    }
  }

  return (
    <div className="authPage">
      <div className="authPage__formPanel authPage__formPanel--centered">
        <div className="authPage__formWrapper">
          <div className="authCallback">
            {status === 'loading' && (
              <div className="authCallback__loading">
                <Loader2 size={48} className="authCallback__spinner" />
                <h2>Procesando autenticación...</h2>
                <p>Espera un momento mientras verificamos tu cuenta</p>
              </div>
            )}

            {status === 'success' && (
              <div className="authCallback__success">
                <CheckCircle size={48} />
                <h2>¡Autenticación exitosa!</h2>
                <p>Redirigiendo...</p>
              </div>
            )}

            {status === 'error' && (
              <div className="authCallback__error">
                <XCircle size={48} />
                <h2>Error de autenticación</h2>
                <p>{error}</p>
                <button
                  onClick={() => navigate('/login')}
                  className="authCallback__retryBtn"
                >
                  Volver al login
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
