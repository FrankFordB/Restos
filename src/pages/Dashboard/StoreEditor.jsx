import { useState, useEffect, useRef } from 'react'
import './AccountSection.css' // Reutilizamos los estilos
import Card from '../../components/ui/Card/Card'
import Input from '../../components/ui/Input/Input'
import Button from '../../components/ui/Button/Button'
import WelcomeModalEditor from '../../components/dashboard/WelcomeModalEditor/WelcomeModalEditor'
import ImageCropperModal from '../../components/ui/ImageCropperModal/ImageCropperModal'
import { useAppSelector } from '../../app/hooks'
import { selectUser } from '../../features/auth/authSlice'
import { selectTenants } from '../../features/tenants/tenantsSlice'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import { fetchTenantFull, updateTenantInfo, updateTenantWelcomeModal, updateTenantOpeningHours } from '../../lib/supabaseApi'
import { uploadTenantLogo, uploadWelcomeImage } from '../../lib/supabaseStorage'
import { loadJson, saveJson } from '../../shared/storage'
import { DAYS_OPTIONS, TIME_OPTIONS } from '../../shared/openingHours'
import { SUBSCRIPTION_TIERS } from '../../shared/subscriptions'
import { Save, Store, Image, MessageSquare, Upload, X, Eye, EyeOff, Clock, Plus, Trash2, FileText, AlertTriangle, Crop, Link2 } from 'lucide-react'

const MOCK_TENANT_KEY = 'mock.tenantCustomization'

export default function StoreEditor() {
  const user = useAppSelector(selectUser)
  const tenants = useAppSelector(selectTenants)
  
  const currentTenant = user?.tenantId ? tenants.find((t) => t.id === user.tenantId) : null
  
  // Form state
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Restaurant customization fields
  const [tenantData, setTenantData] = useState(null)
  const [tenantName, setTenantName] = useState('')
  const [tenantLogo, setTenantLogo] = useState('')
  const [tenantDescription, setTenantDescription] = useState('')
  const [tenantSlogan, setTenantSlogan] = useState('')
  const [welcomeModalEnabled, setWelcomeModalEnabled] = useState(true)
  const [welcomeModalTitle, setWelcomeModalTitle] = useState('')
  const [welcomeModalMessage, setWelcomeModalMessage] = useState('')
  const [welcomeModalImage, setWelcomeModalImage] = useState('')
  const [welcomeModalFeatures, setWelcomeModalFeatures] = useState(null) // null = usar default
  const [welcomeModalFeaturesDesign, setWelcomeModalFeaturesDesign] = useState('pills')
  const [savingRestaurant, setSavingRestaurant] = useState(false)
  const [restaurantSuccess, setRestaurantSuccess] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingWelcomeImage, setUploadingWelcomeImage] = useState(false)
  
  // Opening hours state
  const [openingHours, setOpeningHours] = useState([])
  const [showAddHour, setShowAddHour] = useState(false)
  const [newHourDay, setNewHourDay] = useState('')
  const [newHourOpen, setNewHourOpen] = useState('09:00')
  const [newHourClose, setNewHourClose] = useState('22:00')
  const [savingHours, setSavingHours] = useState(false)
  
  // Image Cropper states
  const [showLogoCropper, setShowLogoCropper] = useState(false)
  const [logoCropperImage, setLogoCropperImage] = useState(null)
  const [showLogoUrlInput, setShowLogoUrlInput] = useState(false)
  const [logoUrlInput, setLogoUrlInput] = useState('')
  
  const logoInputRef = useRef(null)
  const welcomeImageInputRef = useRef(null)

  // Load tenant customization data
  useEffect(() => {
    let cancelled = false

    async function loadTenant() {
      if (!user?.tenantId) {
        setLoading(false)
        return
      }

      setLoading(true)

      try {
        if (isSupabaseConfigured) {
          const tenant = await fetchTenantFull(user.tenantId)
          if (tenant && !cancelled) {
            setTenantData(tenant)
            setTenantName(tenant.name || '')
            setTenantLogo(tenant.logo || '')
            setTenantDescription(tenant.description || '')
            setTenantSlogan(tenant.slogan || '')
            setWelcomeModalEnabled(tenant.welcome_modal_enabled !== false)
            setWelcomeModalTitle(tenant.welcome_modal_title || '')
            setWelcomeModalMessage(tenant.welcome_modal_message || '')
            setWelcomeModalImage(tenant.welcome_modal_image || '')
            setWelcomeModalFeatures(tenant.welcome_modal_features || null)
            setWelcomeModalFeaturesDesign(tenant.welcome_modal_features_design || 'pills')
            setOpeningHours(tenant.opening_hours || [])
          }
        } else {
          // Load from localStorage in mock mode
          const mockTenant = loadJson(MOCK_TENANT_KEY, {})
          if (mockTenant[user.tenantId] && !cancelled) {
            const t = mockTenant[user.tenantId]
            setTenantData(t)
            setTenantName(t.name || currentTenant?.name || '')
            setTenantLogo(t.logo || '')
            setTenantDescription(t.description || '')
            setTenantSlogan(t.slogan || '')
            setWelcomeModalEnabled(t.welcomeModalEnabled !== false)
            setWelcomeModalTitle(t.welcomeModalTitle || '')
            setWelcomeModalMessage(t.welcomeModalMessage || '')
            setWelcomeModalImage(t.welcomeModalImage || '')
            setWelcomeModalFeatures(t.welcomeModalFeatures || null)
            setWelcomeModalFeaturesDesign(t.welcomeModalFeaturesDesign || 'pills')
            setOpeningHours(t.openingHours || [])
          } else if (currentTenant) {
            setTenantName(currentTenant.name || '')
          }
        }
      } catch (e) {
        console.error('Error loading tenant customization:', e)
        setError('Error al cargar la configuración del restaurante')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadTenant()
    return () => { cancelled = true }
  }, [user?.tenantId, currentTenant])

  // Abre el cropper con el archivo seleccionado
  const handleLogoFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = () => {
      setLogoCropperImage(reader.result)
      setShowLogoCropper(true)
    }
    reader.readAsDataURL(file)
    e.target.value = '' // Permite seleccionar el mismo archivo
  }

  // Abre el cropper con una URL
  const handleLogoUrlSubmit = () => {
    if (logoUrlInput.trim()) {
      setLogoCropperImage(logoUrlInput.trim())
      setShowLogoCropper(true)
      setShowLogoUrlInput(false)
      setLogoUrlInput('')
    }
  }

  // Cuando el usuario termina de recortar el logo
  const handleLogoCropComplete = async (croppedImage) => {
    setShowLogoCropper(false)
    setLogoCropperImage(null)
    setUploadingLogo(true)
    setError(null)

    try {
      if (isSupabaseConfigured) {
        // Convertir base64 a File para subir
        const response = await fetch(croppedImage)
        const blob = await response.blob()
        const file = new File([blob], 'logo.jpg', { type: 'image/jpeg' })
        const logoUrl = await uploadTenantLogo({ tenantId: user.tenantId, file })
        setTenantLogo(logoUrl)
      } else {
        // Mock: usar directamente el data URL
        setTenantLogo(croppedImage)
      }
    } catch (e) {
      setError(e?.message || 'Error al subir el logo')
    } finally {
      setUploadingLogo(false)
    }
  }

  // Handler legacy para compatibilidad
  const handleLogoUpload = async (e) => {
    handleLogoFileSelect(e)
  }

  const handleWelcomeImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingWelcomeImage(true)
    setError(null)

    try {
      if (isSupabaseConfigured) {
        const imageUrl = await uploadWelcomeImage({ tenantId: user.tenantId, file })
        setWelcomeModalImage(imageUrl)
      } else {
        // Mock: convert to data URL for local storage
        const reader = new FileReader()
        reader.onload = () => {
          setWelcomeModalImage(reader.result)
        }
        reader.readAsDataURL(file)
      }
    } catch (e) {
      setError(e?.message || 'Error al subir la imagen')
    } finally {
      setUploadingWelcomeImage(false)
    }
  }

  const handleSaveRestaurant = async () => {
    if (!user?.tenantId) return

    setSavingRestaurant(true)
    setError(null)
    setRestaurantSuccess(false)

    try {
      if (isSupabaseConfigured) {
        // Save tenant info
        await updateTenantInfo({
          tenantId: user.tenantId,
          name: tenantName,
          logo: tenantLogo,
          description: tenantDescription,
          slogan: tenantSlogan,
        })

        // Save welcome modal settings
        await updateTenantWelcomeModal({
          tenantId: user.tenantId,
          enabled: welcomeModalEnabled,
          title: welcomeModalTitle,
          message: welcomeModalMessage,
          image: welcomeModalImage,
          features: welcomeModalFeatures,
          featuresDesign: welcomeModalFeaturesDesign,
        })

        // Save opening hours
        await updateTenantOpeningHours({
          tenantId: user.tenantId,
          openingHours: openingHours,
        })
      } else {
        // Save to localStorage in mock mode
        const mockTenant = loadJson(MOCK_TENANT_KEY, {})
        mockTenant[user.tenantId] = {
          name: tenantName,
          logo: tenantLogo,
          description: tenantDescription,
          slogan: tenantSlogan,
          welcomeModalEnabled,
          welcomeModalTitle,
          welcomeModalMessage,
          welcomeModalImage,
          welcomeModalFeatures,
          welcomeModalFeaturesDesign,
          openingHours,
        }
        saveJson(MOCK_TENANT_KEY, mockTenant)
      }
      setRestaurantSuccess(true)
      setTimeout(() => setRestaurantSuccess(false), 3000)
    } catch (e) {
      setError(e?.message || 'Error al guardar la configuración del restaurante')
    } finally {
      setSavingRestaurant(false)
    }
  }

  // Opening hours handlers - auto-save to database
  const saveOpeningHours = async (hours) => {
    setSavingHours(true)
    
    if (!isSupabaseConfigured) {
      // Save to localStorage in mock mode
      const mockTenant = loadJson(MOCK_TENANT_KEY, {})
      mockTenant[user.tenantId] = {
        ...(mockTenant[user.tenantId] || {}),
        openingHours: hours,
      }
      saveJson(MOCK_TENANT_KEY, mockTenant)
      console.log('[Opening Hours] Saved to localStorage (MOCK mode):', hours)
      setSavingHours(false)
      return true
    }
    
    try {
      const result = await updateTenantOpeningHours({
        tenantId: user.tenantId,
        openingHours: hours,
      })
      console.log('[Opening Hours] Saved to Supabase:', result)
      setSavingHours(false)
      return true
    } catch (e) {
      console.error('[Opening Hours] Error saving to Supabase:', e)
      setError('Error al guardar los horarios: ' + (e.message || 'Error desconocido'))
      setSavingHours(false)
      return false
    }
  }

  const handleAddHour = async () => {
    if (!newHourDay) return
    
    // Check if day already exists
    const existingIndex = openingHours.findIndex(h => h.day === newHourDay)
    let newHours
    if (existingIndex >= 0) {
      // Update existing
      newHours = [...openingHours]
      newHours[existingIndex] = { day: newHourDay, open: newHourOpen, close: newHourClose, enabled: true }
    } else {
      // Add new
      newHours = [...openingHours, { day: newHourDay, open: newHourOpen, close: newHourClose, enabled: true }]
    }
    
    setOpeningHours(newHours)
    await saveOpeningHours(newHours)
    
    setShowAddHour(false)
    setNewHourDay('')
    setNewHourOpen('09:00')
    setNewHourClose('22:00')
  }

  const handleRemoveHour = async (index) => {
    const newHours = openingHours.filter((_, i) => i !== index)
    setOpeningHours(newHours)
    await saveOpeningHours(newHours)
  }

  const handleToggleHourEnabled = async (index) => {
    const newHours = [...openingHours]
    newHours[index] = { ...newHours[index], enabled: !newHours[index].enabled }
    setOpeningHours(newHours)
    await saveOpeningHours(newHours)
  }

  // Generate default welcome content based on restaurant data
  const getDefaultWelcomeTitle = () => tenantName || 'Bienvenido'
  const getDefaultWelcomeMessage = () => {
    if (tenantSlogan) return tenantSlogan
    if (tenantDescription) return tenantDescription
    return `¡Bienvenido a ${tenantName || 'nuestro restaurante'}! Explora nuestro menú y realiza tu pedido.`
  }

  if (loading) {
    return (
      <div className="account">
        <header className="dash__header">
          <h1>Editar mi Tienda</h1>
          <p className="muted">Cargando información...</p>
        </header>
        <Card>
          <div className="account__loading">
            <div className="account__spinner"></div>
            <p>Cargando datos de la Tienda...</p>
          </div>
        </Card>
      </div>
    )
  }

  if (!user?.tenantId) {
    return (
      <div className="account">
        <header className="dash__header">
          <h1>Editar mi tienda</h1>
          <p className="muted">Configura la información de tu Tienda</p>
        </header>
        <Card>
          <div className="account__section">
            <p>No tienes una Tienda asignada. Crea una primero para poder editar su configuración.</p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="account">
      <header className="dash__header">
        <h1>Editar mi tienda</h1>
        <p className="muted">Personaliza la información y apariencia de tu Tienda</p>
      </header>

      {error && (
        <div className="account__alert account__alert--error">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Restaurant Info */}
      <Card title="Información del Restaurante">
        <div className="account__section">
          <div className="account__field">
            <label className="account__label">
              <Store size={16} />
              Nombre de la Tienda
            </label>
            <Input
              value={tenantName}
              onChange={setTenantName}
              placeholder="Mi Tienda"
            />
          </div>

          <div className="account__field">
            <label className="account__label">
              <Image size={16} />
              Logo de la Tienda
            </label>
            <div className="account__logoUpload">
              {tenantLogo ? (
                <div className="account__logoPreview">
                  <img src={tenantLogo} alt="Logo" />
                  <button 
                    className="account__logoRemove"
                    onClick={() => setTenantLogo('')}
                    title="Quitar logo"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="account__logoPlaceholder">
                  <Store size={32} />
                  <span>Sin logo</span>
                </div>
              )}
              <input
                type="file"
                ref={logoInputRef}
                accept="image/*"
                onChange={handleLogoFileSelect}
                style={{ display: 'none' }}
              />
              <div className="account__logoActions">
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                >
                  <Upload size={16} />
                  {uploadingLogo ? 'Subiendo...' : 'Subir archivo'}
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={() => setShowLogoUrlInput(!showLogoUrlInput)}
                  disabled={uploadingLogo}
                >
                  <Link2 size={16} />
                  Desde URL
                </Button>
                {tenantLogo && (
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={() => {
                      setLogoCropperImage(tenantLogo)
                      setShowLogoCropper(true)
                    }}
                    disabled={uploadingLogo}
                  >
                    <Crop size={16} />
                    Recortar
                  </Button>
                )}
              </div>
              
              {showLogoUrlInput && (
                <div className="account__urlInput">
                  <input
                    type="url"
                    value={logoUrlInput}
                    onChange={(e) => setLogoUrlInput(e.target.value)}
                    placeholder="https://ejemplo.com/imagen.jpg"
                    onKeyDown={(e) => e.key === 'Enter' && handleLogoUrlSubmit()}
                  />
                  <Button size="sm" onClick={handleLogoUrlSubmit}>
                    Cargar
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="account__field">
            <label className="account__label">
              <MessageSquare size={16} />
              Slogan / Frase corta
            </label>
            <Input
              value={tenantSlogan}
              onChange={setTenantSlogan}
              placeholder="Las mejores hamburguesas de la ciudad"
            />
            <p className="account__hint">Se muestra en el modal de bienvenida</p>
          </div>

          
        </div>
      </Card>

      {/* Welcome Modal */}
      <Card title="Modal de Bienvenida">
        <div className="account__infoBox" style={{ marginBottom: '16px', marginLeft: '16px', marginRight: '16px' }}>
          <Eye size={18} />
          <p>El Saludo de bienvenida se lo muestra a los visitantes que no han iniciado sesión y en el modo de vista previa. Es una excelente forma de dar la bienvenida a tus clientes.</p>
        </div>
        <WelcomeModalEditor
          welcomeModalEnabled={welcomeModalEnabled}
          onEnabledChange={setWelcomeModalEnabled}
          welcomeModalTitle={welcomeModalTitle}
          onTitleChange={setWelcomeModalTitle}
          welcomeModalMessage={welcomeModalMessage}
          onMessageChange={setWelcomeModalMessage}
          welcomeModalImage={welcomeModalImage}
          onImageChange={setWelcomeModalImage}
          welcomeModalFeatures={welcomeModalFeatures}
          onFeaturesChange={setWelcomeModalFeatures}
          welcomeModalFeaturesDesign={welcomeModalFeaturesDesign}
          onFeaturesDesignChange={setWelcomeModalFeaturesDesign}
          tenantLogo={tenantLogo}
          tenantName={tenantName}
          tenantSlogan={tenantSlogan}
          currentTier={currentTenant?.subscription_tier || SUBSCRIPTION_TIERS.FREE}
          onImageUpload={handleWelcomeImageUpload}
          uploadingImage={uploadingWelcomeImage}
        />
      </Card>

      {/* Opening Hours */}
      <Card title="Horarios de Apertura">
        <div className="account__section">
          <div className="account__openingHoursHeader">
            <p className="account__hint">
              Configura los días y horarios en que tu restaurante está abierto. 
              Si no configuras horarios, se asumirá que siempre está abierto.
              {isSupabaseConfigured && <strong> Los cambios se guardan automáticamente en la base de datos.</strong>}
              {savingHours && <span className="account__savingIndicator" style={{ marginLeft: '8px' }}>Guardando...</span>}
            </p>
          </div>

          {openingHours.length > 0 && (
            <div className="account__hoursList">
              {openingHours.map((hour, index) => (
                <div key={index} className={`account__hoursItem ${!hour.enabled ? 'account__hoursItem--disabled' : ''}`}>
                  <span className="account__hoursDay">
                    {hour.day.charAt(0).toUpperCase() + hour.day.slice(1)}
                  </span>
                  <span className="account__hoursTime">
                    {hour.open} - {hour.close}
                  </span>
                  <div className="account__hoursActions">
                    <button 
                      className="account__hoursToggle"
                      onClick={() => handleToggleHourEnabled(index)}
                      title={hour.enabled ? 'Desactivar' : 'Activar'}
                    >
                      {hour.enabled ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                    <button 
                      className="account__hoursRemove"
                      onClick={() => handleRemoveHour(index)}
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showAddHour ? (
            <div className="account__addHourForm">
              <div className="account__addHourRow">
                <select 
                  value={newHourDay} 
                  onChange={(e) => setNewHourDay(e.target.value)}
                  className="account__select"
                >
                  <option value="">Seleccionar día...</option>
                  {DAYS_OPTIONS.map(day => (
                    <option key={day.value} value={day.value}>{day.label}</option>
                  ))}
                </select>
                <select 
                  value={newHourOpen} 
                  onChange={(e) => setNewHourOpen(e.target.value)}
                  className="account__select"
                >
                  {TIME_OPTIONS.map(time => (
                    <option key={time.value} value={time.value}>{time.label}</option>
                  ))}
                </select>
                <span className="account__addHourSeparator">a</span>
                <select 
                  value={newHourClose} 
                  onChange={(e) => setNewHourClose(e.target.value)}
                  className="account__select"
                >
                  {TIME_OPTIONS.map(time => (
                    <option key={time.value} value={time.value}>{time.label}</option>
                  ))}
                </select>
              </div>
              <div className="account__addHourActions">
                <Button variant="secondary" size="sm" onClick={() => setShowAddHour(false)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleAddHour} disabled={!newHourDay}>
                  <Plus size={16} />
                  Agregar
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setShowAddHour(true)}>
              <Plus size={16} />
              Agregar día y horario
            </Button>
          )}
        </div>
      </Card>

      {/* Save Button */}
      <div className="account__actions" style={{ marginTop: '16px' }}>
        <Button onClick={handleSaveRestaurant} disabled={savingRestaurant}>
          <Save size={16} />
          {savingRestaurant ? 'Guardando...' : 'Guardar todos los cambios'}
        </Button>
      </div>

      {restaurantSuccess && (
        <div className="account__successMessage">
          <div className="account__successIcon">✓</div>
          <span>Configuración del restaurante guardada correctamente</span>
        </div>
      )}

      {/* Modal de Recorte de Logo */}
      <ImageCropperModal
        isOpen={showLogoCropper}
        onClose={() => {
          setShowLogoCropper(false)
          setLogoCropperImage(null)
        }}
        onCropComplete={handleLogoCropComplete}
        initialImage={logoCropperImage}
        aspectRatio={1}
        title="Ajustar Logo"
        allowUrl={false}
        allowUpload={false}
      />
    </div>
  )
}
