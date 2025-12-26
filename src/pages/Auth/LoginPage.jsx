import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import './AuthPages.css'
import Card from '../../components/ui/Card/Card'
import Input from '../../components/ui/Input/Input'
import Button from '../../components/ui/Button/Button'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import {
  clearAuthError,
  requestPasswordReset,
  selectAuth,
  signInWithEmail,
} from '../../features/auth/authSlice'
import { ROLES } from '../../shared/constants'

export default function LoginPage() {
  const dispatch = useAppDispatch()
  const auth = useAppSelector(selectAuth)
  const navigate = useNavigate()
  const location = useLocation()

  const [resetInfo, setResetInfo] = useState('')
  const [resetCooldownUntil, setResetCooldownUntil] = useState(0)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const cooldownSecondsLeft = Math.max(0, Math.ceil((resetCooldownUntil - Date.now()) / 1000))
  const resetDisabled = cooldownSecondsLeft > 0

  const goAfter = (role) => {
    const from = location.state?.from
    if (from) return navigate(from)
    return navigate(role === ROLES.SUPER_ADMIN ? '/admin' : '/dashboard')
  }

  const handleLogin = async () => {
    if (!email || !password) return
    setIsLoggingIn(true)
    dispatch(clearAuthError())
    try {
      const user = await dispatch(signInWithEmail({ email, password })).unwrap()
      goAfter(user.role)
    } catch {
      // El slice maneja errores y bans
    } finally {
      setIsLoggingIn(false)
    }
  }

  return (
    <div className="auth">

      <Card
        title="Iniciar sesión"
        actions={
          <Link to="/register" className="auth__link">
            Crear cuenta
          </Link>
        }
      >
        <div className="auth__form">
          <Input label="Email" value={email} onChange={setEmail} placeholder="demo@resto.local" />
          <Input label="Password" type="password" value={password} onChange={setPassword} placeholder="demo123" />

          {auth.error ? <div className="auth__error">{auth.error}</div> : null}

          {resetInfo ? <div className="muted">{resetInfo}</div> : null}

          <div className="auth__actions" style={{ justifyContent: 'space-between', gap: 12 }}>
            <button
              type="button"
              className="auth__link"
              disabled={resetDisabled}
              onClick={async () => {
                dispatch(clearAuthError())
                setResetInfo('')
                if (resetDisabled) return
                if (!email) {
                  setResetInfo('Escribe tu email arriba para poder enviarte el link de recuperación.')
                  return
                }
                try {
                  // Debe coincidir con Allowed Redirect URLs en Supabase
                  const redirectTo = `${window.location.origin}/login`
                  await dispatch(requestPasswordReset({ email, redirectTo })).unwrap()
                  setResetInfo('Te enviamos un email para recuperar tu contraseña (revisa spam).')

                  // Evita spam del endpoint /recover
                  setResetCooldownUntil(Date.now() + 60_000)
                } catch {
                  // Si falló (incluye rate limit), igual aplicamos cooldown para no spamear.
                  setResetCooldownUntil(Date.now() + 60_000)
                  // error handled in slice
                }
              }}
            >
              {resetDisabled ? `Espera ${cooldownSecondsLeft}s` : 'Olvidé mi contraseña'}
            </button>
          </div>

          <div className="auth__actions">
            <Button
              onClick={handleLogin}
              disabled={isLoggingIn || !email || !password}
            >
              {isLoggingIn ? 'Entrando...' : 'Entrar'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setEmail('demo@resto.local')
                setPassword('demo123')
              }}
            >
              Cargar demo
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
