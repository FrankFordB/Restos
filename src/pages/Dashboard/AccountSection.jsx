import { useState, useEffect } from 'react'
import './AccountSection.css'
import Card from '../../components/ui/Card/Card'
import Input from '../../components/ui/Input/Input'
import Button from '../../components/ui/Button/Button'
import ConfirmModal from '../../components/ui/ConfirmModal/ConfirmModal'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { selectUser, signOut } from '../../features/auth/authSlice'
import { selectTenants } from '../../features/tenants/tenantsSlice'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import { fetchFullProfile, updateProfileInfo } from '../../lib/supabaseApi'
import { loadJson, saveJson } from '../../shared/storage'
import { ROLES } from '../../shared/constants'
import { SUBSCRIPTION_TIERS, TIER_LABELS } from '../../shared/subscriptions'
import { Save, User, Mail, Lock, Phone, FileText, MapPin, AlertTriangle } from 'lucide-react'

const MOCK_PROFILE_KEY = 'mock.userProfile'

const DOCUMENT_TYPES = [
  { value: '', label: 'Seleccionar...' },
  { value: 'dni', label: 'DNI' },
  { value: 'cuit', label: 'CUIT/CUIL' },
  { value: 'passport', label: 'Pasaporte' },
  { value: 'other', label: 'Otro' },
]

const COUNTRY_CODES = [
  { value: '+54', label: '🇦🇷 +54 (Argentina)' },
  { value: '+1', label: '🇺🇸 +1 (USA)' },
  { value: '+52', label: '🇲🇽 +52 (México)' },
  { value: '+34', label: '🇪🇸 +34 (España)' },
  { value: '+56', label: '🇨🇱 +56 (Chile)' },
  { value: '+57', label: '🇨🇴 +57 (Colombia)' },
  { value: '+55', label: '🇧🇷 +55 (Brasil)' },
  { value: '+51', label: '🇵🇪 +51 (Perú)' },
  { value: '+598', label: '🇺🇾 +598 (Uruguay)' },
  { value: '+595', label: '🇵🇾 +595 (Paraguay)' },
]

export default function AccountSection({ subscriptionTier = 'free' }) {
  const dispatch = useAppDispatch()
  const user = useAppSelector(selectUser)
  const tenants = useAppSelector(selectTenants)
  
  const currentTenant = user?.tenantId ? tenants.find((t) => t.id === user.tenantId) : null
  
  // Form state
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  
  // Profile fields
  const [fullName, setFullName] = useState('')
  const [phoneCountryCode, setPhoneCountryCode] = useState('+54')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [documentType, setDocumentType] = useState('')
  const [documentNumber, setDocumentNumber] = useState('')
  const [billingAddress, setBillingAddress] = useState('')
  
  // Close account modal
  const [showCloseModal, setShowCloseModal] = useState(false)

  // Load profile on mount
  useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      if (!user?.id) return

      setLoading(true)
      setError(null)

      try {
        if (isSupabaseConfigured) {
          const profile = await fetchFullProfile(user.id)
          if (profile && !cancelled) {
            setFullName(profile.full_name || '')
            setPhoneCountryCode(profile.phone_country_code || '+54')
            setPhoneNumber(profile.phone_number || '')
            setDocumentType(profile.document_type || '')
            setDocumentNumber(profile.document_number || '')
            setBillingAddress(profile.billing_address || '')
          }
        } else {
          // Load from localStorage in mock mode
          const mockProfile = loadJson(MOCK_PROFILE_KEY, {})
          if (mockProfile[user.id] && !cancelled) {
            const p = mockProfile[user.id]
            setFullName(p.fullName || '')
            setPhoneCountryCode(p.phoneCountryCode || '+54')
            setPhoneNumber(p.phoneNumber || '')
            setDocumentType(p.documentType || '')
            setDocumentNumber(p.documentNumber || '')
            setBillingAddress(p.billingAddress || '')
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'Error al cargar el perfil')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadProfile()
    return () => { cancelled = true }
  }, [user?.id])

  const handleSave = async () => {
    if (!user?.id) return

    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      if (isSupabaseConfigured) {
        await updateProfileInfo({
          userId: user.id,
          fullName,
          phoneCountryCode,
          phoneNumber,
          documentType,
          documentNumber,
          billingAddress,
        })
      } else {
        // Save to localStorage in mock mode
        const mockProfile = loadJson(MOCK_PROFILE_KEY, {})
        mockProfile[user.id] = {
          fullName,
          phoneCountryCode,
          phoneNumber,
          documentType,
          documentNumber,
          billingAddress,
        }
        saveJson(MOCK_PROFILE_KEY, mockProfile)
      }
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (e) {
      setError(e?.message || 'Error al guardar los cambios')
    } finally {
      setSaving(false)
    }
  }

  const handleCloseAccount = () => {
    // In a real app, this would call an API to deactivate the account
    dispatch(signOut())
  }

  const getRoleLabel = () => {
    if (user?.role === ROLES.SUPER_ADMIN) return 'Super Admin'
    if (user?.role === ROLES.TENANT_ADMIN) return 'Admin'
    return 'Usuario'
  }

  const getTierLabel = () => {
    return subscriptionTier !== SUBSCRIPTION_TIERS.FREE 
      ? TIER_LABELS[subscriptionTier] 
      : 'Free'
  }

  if (loading) {
    return (
      <div className="account">
        <header className="dash__header">
          <h1>Mi Cuenta</h1>
          <p className="muted">Cargando información...</p>
        </header>
        <Card>
          <div className="account__loading">
            <div className="account__spinner"></div>
            <p>Cargando datos del perfil...</p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="account">
      <header className="dash__header">
        <h1>Mi Cuenta</h1>
        <p className="muted">{getTierLabel()} - {getRoleLabel()}</p>
      </header>

      {error && (
        <div className="account__alert account__alert--error">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="account__alert account__alert--success">
          <Save size={18} />
          <span>Cambios guardados correctamente</span>
        </div>
      )}

      {/* Account Information */}
      <Card title="Información de la cuenta">
        <div className="account__section">
          <div className="account__field">
            <label className="account__label">
              <Mail size={16} />
              Correo electrónico
            </label>
            <div className="account__value account__value--readonly">
              {user?.email || 'No disponible'}
            </div>
            <p className="account__hint">El correo electrónico no puede ser modificado</p>
          </div>

          <div className="account__field">
            <label className="account__label">
              <Lock size={16} />
              Contraseña
            </label>
            <div className="account__value account__value--readonly">
              ••••••••
            </div>
            <Button variant="secondary" size="sm" disabled>
              Cambiar contraseña (próximamente)
            </Button>
          </div>
        </div>
      </Card>

      {/* Personal Information */}
      <Card title="Información personal">
        <div className="account__section">
          <div className="account__field">
            <label className="account__label">
              <User size={16} />
              Nombre Completo
            </label>
            <Input
              value={fullName}
              onChange={setFullName}
              placeholder={currentTenant?.name || 'Ingresa tu nombre completo'}
            />
          </div>

          <div className="account__field">
            <label className="account__label">
              <Phone size={16} />
              Número de teléfono
            </label>
            <div className="account__phoneGroup">
              <select
                className="account__select account__select--countryCode"
                value={phoneCountryCode}
                onChange={(e) => setPhoneCountryCode(e.target.value)}
              >
                {COUNTRY_CODES.map((cc) => (
                  <option key={cc.value} value={cc.value}>
                    {cc.label}
                  </option>
                ))}
              </select>
              <Input
                value={phoneNumber}
                onChange={setPhoneNumber}
                placeholder="2994281812"
                type="tel"
              />
            </div>
          </div>

          <div className="account__row">
            <div className="account__field account__field--half">
              <label className="account__label">
                <FileText size={16} />
                Tipo de documento
              </label>
              <select
                className="account__select"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
              >
                {DOCUMENT_TYPES.map((dt) => (
                  <option key={dt.value} value={dt.value}>
                    {dt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="account__field account__field--half">
              <label className="account__label">
                <FileText size={16} />
                Número de documento
              </label>
              <Input
                value={documentNumber}
                onChange={setDocumentNumber}
                placeholder="12345678"
              />
            </div>
          </div>

          <div className="account__field">
            <label className="account__label">
              <MapPin size={16} />
              Dirección de facturación
            </label>
            <Input
              value={billingAddress}
              onChange={setBillingAddress}
              placeholder="Calle, Número, Ciudad, País"
            />
          </div>

          <div className="account__actions">
            <Button onClick={handleSave} disabled={saving}>
              <Save size={16} />
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Close Account */}
      <Card title="Cerrar tu cuenta" className="account__dangerCard">
        <div className="account__dangerSection">
          <div className="account__dangerInfo">
            <AlertTriangle size={24} className="account__dangerIcon" />
            <div>
              <h4>¿Estás seguro de que quieres cerrar tu cuenta?</h4>
              <p className="muted">
                Cerrar tu cuenta eliminará todos tus datos, desconectará tu menú web si eres el único 
                administrador y cancelará tu plan activo.
              </p>
            </div>
          </div>
          <Button 
            variant="danger" 
            onClick={() => setShowCloseModal(true)}
          >
            Cerrar mi cuenta
          </Button>
        </div>
      </Card>

      <ConfirmModal
        open={showCloseModal}
        title="Cerrar cuenta"
        message="Esta acción es irreversible. ¿Estás seguro de que deseas cerrar tu cuenta permanentemente?"
        confirmLabel="Sí, cerrar mi cuenta"
        cancelLabel="Cancelar"
        confirmVariant="danger"
        onConfirm={handleCloseAccount}
        onCancel={() => setShowCloseModal(false)}
      />
    </div>
  )
}
