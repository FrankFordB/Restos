import { useState } from 'react'
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
} from '../../features/auth/authSlice'
import { ROLES } from '../../shared/constants'
import { Store, Utensils, ShoppingBag, ChefHat, Lock, Mail, ArrowRight, Sparkles } from 'lucide-react'

export default function LoginPage() {
  const dispatch = useAppDispatch()
  const auth = useAppSelector(selectAuth)
  const navigate = useNavigate()
  const location = useLocation()

  const [resetInfo, setResetInfo] = useState('')
  const [resetCooldownUntil, setResetCooldownUntil] = useState(0)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

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
      const user = await dispatch(signInWithEmail({ email, password })).unwrap()
      goAfter(user.role)
    } catch {
      // El slice maneja errores y bans
    } finally {
      setIsLoading(false)
    }
  }

  const handleDemoLogin = () => {
    setEmail('demo@resto.local')
    setPassword('demo123')
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
            Bienvenido a <span>Restos</span>
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
            <span>🍕</span>
          </div>
          <div className="authPage__floatingCard authPage__floatingCard--2">
            <span>🍔</span>
          </div>
          <div className="authPage__floatingCard authPage__floatingCard--3">
            <span>🍣</span>
          </div>
          <div className="authPage__floatingCard authPage__floatingCard--4">
            <span>🥗</span>
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
                'Ingresando...'
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
