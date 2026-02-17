import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import './AuthPages.css'
import Input from '../../components/ui/Input/Input'
import Button from '../../components/ui/Button/Button'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import {
  clearAuthError,
  requestPasswordReset,
  selectAuth,
  signInWithEmail,
  selectMFARequired,
  selectMFAFactors,
  completeMFAVerification,
  cancelMFA,
} from '../../features/auth/authSlice'
import { signInWithGoogle } from '../../lib/supabaseAuth'
import { fetchProfile } from '../../lib/supabaseApi'
import { ROLES } from '../../shared/constants'
import { Store, Utensils, ShoppingBag, ChefHat, Lock, Mail, ArrowRight, Loader2, Pizza, Salad, Coffee } from 'lucide-react'
import TwoFactorChallenge from './TwoFactorChallenge'

// Google icon component
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)

export default function LoginPage() {
  const dispatch = useAppDispatch()
  const auth = useAppSelector(selectAuth)
  const mfaRequired = useAppSelector(selectMFARequired)
  const mfaFactors = useAppSelector(selectMFAFactors)
  const navigate = useNavigate()
  const location = useLocation()

  const [resetInfo, setResetInfo] = useState('')
  const [resetCooldownUntil, setResetCooldownUntil] = useState(0)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  const cooldownSecondsLeft = Math.max(0, Math.ceil((resetCooldownUntil - Date.now()) / 1000))
  const resetDisabled = cooldownSecondsLeft > 0

  const goAfter = (role) => {
    const from = location.state?.from
    if (from) return navigate(from)
    return navigate(role === ROLES.SUPER_ADMIN ? '/admin' : '/dashboard')
  }

  const handleLogin = async (e) => {
    e?.preventDefault()
    if (isLoading) return
    
    setIsLoading(true)
    dispatch(clearAuthError())
    
    try {
      const result = await dispatch(signInWithEmail({ email, password })).unwrap()
      
      // If MFA is not required, navigate directly
      if (!result.mfaRequired && result.user) {
        goAfter(result.user.role)
      }
      // If MFA is required, the component will show TwoFactorChallenge
    } catch {
      // Error handled in slice
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true)
    dispatch(clearAuthError())
    
    try {
      await signInWithGoogle()
      // Redirect is handled by OAuth callback
    } catch {
      setIsGoogleLoading(false)
    }
  }

  const handleMFASuccess = async () => {
    try {
      const pendingData = auth.pendingAuthData
      if (pendingData) {
        const profile = await fetchProfile(pendingData.id)
        dispatch(completeMFAVerification({
          id: pendingData.id,
          email: pendingData.email,
          role: profile?.role || ROLES.USER,
          tenantId: profile?.tenant_id || null,
        }))
        goAfter(profile?.role || ROLES.USER)
      }
    } catch {
      // Handle error
    }
  }

  const handleMFACancel = () => {
    dispatch(cancelMFA())
  }

  // Show 2FA challenge if required
  if (mfaRequired && mfaFactors.length > 0) {
    return (
      <div className="authPage">
        <div className="authPage__formPanel authPage__formPanel--centered">
          <div className="authPage__formWrapper">
            <TwoFactorChallenge
              factors={mfaFactors}
              onSuccess={handleMFASuccess}
              onCancel={handleMFACancel}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="authPage">
      {/* Panel izquierdo - Hero visual */}
      <div className="authPage__hero">
        <div className="authPage__heroOverlay" />
        <div className="authPage__heroContent">
          <div className="authPage__heroLogo">
            <Store size={48} />
          </div>
          <h1 className="authPage__heroTitle">
            Bienvenido a <span>Pyme Center</span>
          </h1>
          <p className="authPage__heroSubtitle">
            La plataforma más completa para gestionar tu restaurante y tienda online
          </p>
          
          <div className="authPage__features">
            <div className="authPage__feature">
              <div className="authPage__featureIcon">
                <Utensils size={24} />
              </div>
              <div className="authPage__featureText">
                <strong>Gestión de menú</strong>
                <span>Productos, categorías y extras</span>
              </div>
            </div>
            <div className="authPage__feature">
              <div className="authPage__featureIcon">
                <ShoppingBag size={24} />
              </div>
              <div className="authPage__featureText">
                <strong>Pedidos en tiempo real</strong>
                <span>Notificaciones instantáneas</span>
              </div>
            </div>
            <div className="authPage__feature">
              <div className="authPage__featureIcon">
                <ChefHat size={24} />
              </div>
              <div className="authPage__featureText">
                <strong>Tu tienda online</strong>
                <span>Personalizada y profesional</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Decoraciones flotantes */}
        <div className="authPage__floatingElements">
          <div className="authPage__floatingCard authPage__floatingCard--1">
            <Pizza size={24} />
          </div>
          <div className="authPage__floatingCard authPage__floatingCard--2">
            <Utensils size={24} />
          </div>
          <div className="authPage__floatingCard authPage__floatingCard--3">
            <ChefHat size={24} />
          </div>
          <div className="authPage__floatingCard authPage__floatingCard--4">
            <Salad size={24} />
          </div>
        </div>
      </div>

      {/* Panel derecho - Formulario */}
      <div className="authPage__formPanel">
        <div className="authPage__formWrapper">
          <div className="authPage__formHeader">
            <h2 className="authPage__formTitle">Iniciar sesión</h2>
            <p className="authPage__formSubtitle">
              Ingresa tus credenciales para acceder a tu panel
            </p>
          </div>

          {/* Google Sign In Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isGoogleLoading}
            className="authPage__googleBtn"
          >
            {isGoogleLoading ? (
              <Loader2 size={18} className="authPage__spinner" />
            ) : (
              <GoogleIcon />
            )}
            Continuar con Google
          </button>

          <div className="authPage__divider">
            <span>o</span>
          </div>

          <form className="authPage__form" onSubmit={handleLogin}>
            <div className="authPage__inputGroup">
              <label className="authPage__label">
                <Mail size={16} />
                Email
              </label>
              <Input 
                value={email} 
                onChange={setEmail} 
                placeholder="tu@email.com"
                type="email"
              />
            </div>

            <div className="authPage__inputGroup">
              <label className="authPage__label">
                <Lock size={16} />
                Contraseña
              </label>
              <Input 
                type="password" 
                value={password} 
                onChange={setPassword} 
                placeholder="••••••••"
              />
            </div>

            {auth.error && (
              <div className="authPage__error">
                {auth.error}
              </div>
            )}

            {resetInfo && (
              <div className="authPage__info">
                {resetInfo}
              </div>
            )}

            <div className="authPage__forgotPassword">
              <button
                type="button"
                className="authPage__link"
                disabled={resetDisabled}
                onClick={async () => {
                  dispatch(clearAuthError())
                  setResetInfo('')
                  if (resetDisabled) return
                  if (!email) {
                    setResetInfo('Escribe tu email arriba para enviarte el link de recuperación.')
                    return
                  }
                  try {
                    const redirectTo = `${window.location.origin}/login`
                    await dispatch(requestPasswordReset({ email, redirectTo })).unwrap()
                    setResetInfo('Te enviamos un email para recuperar tu contraseña (revisa spam).')
                    setResetCooldownUntil(Date.now() + 60_000)
                  } catch {
                    setResetCooldownUntil(Date.now() + 60_000)
                  }
                }}
              >
                {resetDisabled ? `Espera ${cooldownSecondsLeft}s` : '¿Olvidaste tu contraseña?'}
              </button>
            </div>

            <Button
              type="submit"
              disabled={isLoading || !email || !password}
              className="authPage__submitBtn"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="authPage__spinner" />
                  Ingresando...
                </>
              ) : (
                <>
                  Ingresar
                  <ArrowRight size={18} />
                </>
              )}
            </Button>
            
            <p className="authPage__registerLink">
              ¿No tienes cuenta?{' '}
              <Link to="/register" className="authPage__footerLink">
                Crear cuenta gratis
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
