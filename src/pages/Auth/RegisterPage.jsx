import { useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import './AuthPages.css'
import Input from '../../components/ui/Input/Input'
import Button from '../../components/ui/Button/Button'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { addTenant } from '../../features/tenants/tenantsSlice'
import { clearAuthError, registerWithEmail, selectAuth, setUserFromOAuth } from '../../features/auth/authSlice'
import { signUpWithEmailOTP } from '../../lib/supabaseAuth'
import { 
  Store, 
  User, 
  Mail, 
  Lock, 
  Phone, 
  MapPin, 
  Building2,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  ShieldCheck,
  Zap,
  Loader2
} from 'lucide-react'

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

const BUSINESS_TYPES = [
  { value: 'restaurant', label: 'Restaurante' },
  { value: 'dark_kitchen', label: 'Dark Kitchen' },
  { value: 'cafe', label: 'Cafetería' },
  { value: 'bakery', label: 'Panadería / Pastelería' },
  { value: 'fast_food', label: 'Comida Rápida' },
  { value: 'food_truck', label: 'Food Truck' },
  { value: 'bar', label: 'Bar / Pub' },
  { value: 'pizzeria', label: 'Pizzería' },
  { value: 'ice_cream', label: 'Heladería' },
  { value: 'other', label: 'Otro' }
]

const COUNTRIES = [
  { value: 'AR', label: 'Argentina', code: '+54' },
  { value: 'MX', label: 'México', code: '+52' },
  { value: 'CO', label: 'Colombia', code: '+57' },
  { value: 'CL', label: 'Chile', code: '+56' },
  { value: 'PE', label: 'Perú', code: '+51' },
  { value: 'UY', label: 'Uruguay', code: '+598' },
  { value: 'ES', label: 'España', code: '+34' },
  { value: 'US', label: 'Estados Unidos', code: '+1' },
  { value: 'OTHER', label: 'Otro', code: '' }
]

export default function RegisterPage() {
  const dispatch = useAppDispatch()
  const auth = useAppSelector(selectAuth)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Check if returning from email verification (step=2)
  const urlStep = searchParams.get('step')
  const isStep2 = urlStep === '2'

  // Step tracking
  const [step, setStep] = useState(isStep2 ? 2 : 1)
  
  // Step 1: User data
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [country, setCountry] = useState('AR')
  const [city, setCity] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  
  // Step 2: Store data
  const [tenantName, setTenantName] = useState('')
  const [tenantSlug, setTenantSlug] = useState('')
  const [businessType, setBusinessType] = useState('restaurant')
  const [storePhone, setStorePhone] = useState('')
  const [storeAddress, setStoreAddress] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  
  // Validation errors
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const selectedCountry = COUNTRIES.find(c => c.value === country)
  const phoneCode = selectedCountry?.code || ''

  // Auto-generate slug from store name
  const handleTenantNameChange = (value) => {
    setTenantName(value)
    if (!tenantSlug || tenantSlug === slugify(tenantName)) {
      setTenantSlug(slugify(value))
    }
  }

  const validateStep1 = () => {
    const newErrors = {}
    
    if (!fullName.trim()) {
      newErrors.fullName = 'El nombre completo es requerido'
    }
    
    if (!email.trim()) {
      newErrors.email = 'El email es requerido'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Email inválido'
    }
    
    if (!password) {
      newErrors.password = 'La contraseña es requerida'
    } else if (password.length < 6) {
      newErrors.password = 'Mínimo 6 caracteres'
    }
    
    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden'
    }
    
    if (!city.trim()) {
      newErrors.city = 'La ciudad es requerida'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validateStep2 = () => {
    const newErrors = {}
    
    if (!tenantName.trim()) {
      newErrors.tenantName = 'El nombre de la tienda es requerido'
    }
    
    if (!tenantSlug.trim()) {
      newErrors.tenantSlug = 'La URL de la tienda es requerida'
    } else if (!/^[a-z0-9-]+$/.test(tenantSlug)) {
      newErrors.tenantSlug = 'Solo letras minúsculas, números y guiones'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNextStep = async () => {
    if (step === 1 && validateStep1()) {
      dispatch(clearAuthError())
      setIsSubmitting(true)
      
      try {
        // Send OTP to email for verification
        const result = await signUpWithEmailOTP(email, {
          fullName,
          country,
          city,
          phoneNumber: phoneNumber ? `${phoneCode}${phoneNumber}` : null
        })
        
        if (result.error) {
          throw new Error(result.error.message || 'Error al enviar código de verificación')
        }
        
        // Store registration data in sessionStorage for step 2
        sessionStorage.setItem('pendingRegistration', JSON.stringify({
          email,
          password,
          fullName,
          country,
          city,
          phoneNumber: phoneNumber ? `${phoneCode}${phoneNumber}` : null
        }))
        
        // Navigate to verify page
        navigate('/auth/verify', { 
          state: { 
            email,
            returnTo: '/register?step=2'
          }
        })
      } catch (err) {
        setErrors({ submit: err.message || 'Error al enviar código de verificación' })
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  const handlePrevStep = () => {
    if (step === 2) {
      setStep(1)
    }
  }

  const handleSubmit = async () => {
    if (!validateStep2()) return
    
    dispatch(clearAuthError())
    setIsSubmitting(true)
    
    try {
      // Get stored registration data if coming from verification
      const storedData = sessionStorage.getItem('pendingRegistration')
      const pendingData = storedData ? JSON.parse(storedData) : null
      
      // Use stored data or current form data
      const registrationEmail = pendingData?.email || email
      const registrationPassword = pendingData?.password || password
      const registrationFullName = pendingData?.fullName || fullName
      const registrationCountry = pendingData?.country || country
      const registrationCity = pendingData?.city || city
      const registrationPhone = pendingData?.phoneNumber || (phoneNumber ? `${phoneCode}${phoneNumber}` : null)
      
      const result = await dispatch(
        registerWithEmail({ 
          email: registrationEmail, 
          password: registrationPassword, 
          tenantName, 
          tenantSlug,
          isPublic,
          // Additional data
          fullName: registrationFullName,
          country: registrationCountry,
          city: registrationCity,
          phoneNumber: registrationPhone,
          businessType,
          storePhone,
          storeAddress,
          // Flag to indicate email is already verified
          emailVerified: isStep2
        }),
      ).unwrap()
      
      // Clear pending registration data
      sessionStorage.removeItem('pendingRegistration')
      
      if (result?.createdTenant) {
        dispatch(addTenant(result.createdTenant))
      }
      navigate('/dashboard')
    } catch (err) {
      // Error handled in slice
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="authPage">
      {/* Hero Panel */}
      <div className="authPage__hero">
        <div className="authPage__heroOverlay"></div>
        
        <div className="authPage__floatingElements">
          <div className="authPage__floatingCard authPage__floatingCard--1">🍔</div>
          <div className="authPage__floatingCard authPage__floatingCard--2">🍕</div>
          <div className="authPage__floatingCard authPage__floatingCard--3">🍣</div>
          <div className="authPage__floatingCard authPage__floatingCard--4">☕</div>
        </div>
        
        <div className="authPage__heroContent">
          <div className="authPage__heroLogo">
            <Store size={40} />
          </div>
          <h1 className="authPage__heroTitle">
            Crea tu <span>restaurante online</span>
          </h1>
          <p className="authPage__heroSubtitle">
            Tu tienda digital lista en minutos. Gestiona pedidos, personaliza tu marca 
            y haz crecer tu negocio gastronómico.
          </p>
          
          <div className="authPage__features">
            <div className="authPage__feature">
              <div className="authPage__featureIcon">
                <Zap size={20} />
              </div>
              <div className="authPage__featureText">
                <strong>Rápido y fácil</strong>
                <span>Configura en 5 minutos</span>
              </div>
            </div>
            <div className="authPage__feature">
              <div className="authPage__featureIcon">
                <ShieldCheck size={20} />
              </div>
              <div className="authPage__featureText">
                <strong>Pagos seguros</strong>
                <span>Integración con MercadoPago</span>
              </div>
            </div>
            <div className="authPage__feature">
              <div className="authPage__featureIcon">
                <Sparkles size={20} />
              </div>
              <div className="authPage__featureText">
                <strong>100% personalizable</strong>
                <span>Tu marca, tu estilo</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Form Panel */}
      <div className="authPage__formPanel">
        <div className="authPage__formWrapper">
          <div className="authPage__formHeader">
            <h2 className="authPage__formTitle">
              {step === 1 ? 'Crea tu cuenta' : 'Configura tu tienda'}
            </h2>
            <p className="authPage__formSubtitle">
              {step === 1 
                ? 'Ingresa tus datos personales' 
                : 'Datos básicos de tu negocio'}
            </p>
            
            {/* Step indicator */}
            <div className="authPage__steps">
              <div className={`authPage__step ${step >= 1 ? 'authPage__step--active' : ''} ${step > 1 ? 'authPage__step--completed' : ''}`}>
                <div className="authPage__stepCircle">
                  {step > 1 ? <Check size={14} /> : '1'}
                </div>
                <span>Tu cuenta</span>
              </div>
              <div className="authPage__stepLine"></div>
              <div className={`authPage__step ${step >= 2 ? 'authPage__step--active' : ''}`}>
                <div className="authPage__stepCircle">2</div>
                <span>Tu tienda</span>
              </div>
            </div>
          </div>

          {auth.error && (
            <div className="authPage__error">{auth.error}</div>
          )}

          {errors.submit && (
            <div className="authPage__error">{errors.submit}</div>
          )}

          {step === 1 && (
            <div className="authPage__form">
              <div className="authPage__inputGroup">
                <label className="authPage__label">
                  <User size={16} />
                  Nombre completo
                </label>
                <Input 
                  value={fullName} 
                  onChange={setFullName} 
                  placeholder="Tu nombre y apellido"
                  error={errors.fullName}
                />
              </div>

              <div className="authPage__inputGroup">
                <label className="authPage__label">
                  <Mail size={16} />
                  Email
                </label>
                <Input 
                  type="email"
                  value={email} 
                  onChange={setEmail} 
                  placeholder="tu@email.com"
                  error={errors.email}
                />
              </div>

              <div className="authPage__inputRow">
                <div className="authPage__inputGroup">
                  <label className="authPage__label">
                    <Lock size={16} />
                    Contraseña
                  </label>
                  <Input 
                    type="password"
                    value={password} 
                    onChange={setPassword} 
                    placeholder="Mínimo 6 caracteres"
                    error={errors.password}
                  />
                </div>
                <div className="authPage__inputGroup">
                  <label className="authPage__label">
                    <Lock size={16} />
                    Confirmar
                  </label>
                  <Input 
                    type="password"
                    value={confirmPassword} 
                    onChange={setConfirmPassword} 
                    placeholder="Repetir contraseña"
                    error={errors.confirmPassword}
                  />
                </div>
              </div>

              <div className="authPage__inputRow">
                <div className="authPage__inputGroup">
                  <label className="authPage__label">
                    <MapPin size={16} />
                    País
                  </label>
                  <select 
                    className="authPage__select"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  >
                    {COUNTRIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="authPage__inputGroup">
                  <label className="authPage__label">
                    <Building2 size={16} />
                    Ciudad
                  </label>
                  <Input 
                    value={city} 
                    onChange={setCity} 
                    placeholder="Tu ciudad"
                    error={errors.city}
                  />
                </div>
              </div>

              <div className="authPage__inputGroup">
                <label className="authPage__label">
                  <Phone size={16} />
                  Teléfono (opcional)
                </label>
                <div className="authPage__phoneInput">
                  <span className="authPage__phoneCode">{phoneCode}</span>
                  <Input 
                    value={phoneNumber} 
                    onChange={setPhoneNumber} 
                    placeholder="1234567890"
                  />
                </div>
              </div>

              <Button 
                onClick={handleNextStep}
                disabled={isSubmitting}
                className="authPage__submitBtn"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="authPage__spinner" />
                    Enviando código...
                  </>
                ) : (
                  <>
                    Continuar
                    <ArrowRight size={18} />
                  </>
                )}
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="authPage__form">
              <div className="authPage__inputGroup">
                <label className="authPage__label">
                  <Store size={16} />
                  Nombre de tu tienda
                </label>
                <Input 
                  value={tenantName} 
                  onChange={handleTenantNameChange} 
                  placeholder="Mi Restaurante"
                  error={errors.tenantName}
                />
              </div>

              <div className="authPage__inputGroup">
                <label className="authPage__label">
                  URL de tu tienda
                </label>
                <div className="authPage__slugInput">
                  <span className="authPage__slugPrefix">restos.app/tienda/</span>
                  <Input 
                    value={tenantSlug} 
                    onChange={setTenantSlug} 
                    placeholder="mi-restaurante"
                    error={errors.tenantSlug}
                  />
                </div>
              </div>

              <div className="authPage__inputGroup">
                <label className="authPage__label">
                  Tipo de negocio
                </label>
                <select 
                  className="authPage__select"
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                >
                  {BUSINESS_TYPES.map(bt => (
                    <option key={bt.value} value={bt.value}>{bt.label}</option>
                  ))}
                </select>
              </div>

              <div className="authPage__inputRow">
                <div className="authPage__inputGroup">
                  <label className="authPage__label">
                    <Phone size={16} />
                    Teléfono tienda
                  </label>
                  <Input 
                    value={storePhone} 
                    onChange={setStorePhone} 
                    placeholder="(opcional)"
                  />
                </div>
                <div className="authPage__inputGroup">
                  <label className="authPage__label">
                    <MapPin size={16} />
                    Dirección
                  </label>
                  <Input 
                    value={storeAddress} 
                    onChange={setStoreAddress} 
                    placeholder="(opcional)"
                  />
                </div>
              </div>

              <label className="authPage__checkbox">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                />
                <span>Mostrar mi tienda en el directorio público</span>
              </label>

              <div className="authPage__formActions">
                <button 
                  type="button"
                  onClick={handlePrevStep}
                  className="authPage__backBtn"
                >
                  <ArrowLeft size={18} />
                  Volver
                </button>
                <Button 
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="authPage__submitBtn"
                >
                  {isSubmitting ? 'Creando...' : 'Crear mi tienda'}
                  <ArrowRight size={18} />
                </Button>
              </div>
            </div>
          )}

          <div className="authPage__footer">
            <p>
              ¿Ya tienes cuenta?{' '}
              <Link to="/login" className="authPage__footerLink">
                Inicia sesión
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
