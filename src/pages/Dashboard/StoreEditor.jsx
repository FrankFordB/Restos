import { useState, useEffect, useRef, useMemo } from 'react'
import './AccountSection.css' // Reutilizamos los estilos
import Card from '../../components/ui/Card/Card'
import Input from '../../components/ui/Input/Input'
import Button from '../../components/ui/Button/Button'
import WelcomeModalEditor from '../../components/dashboard/WelcomeModalEditor/WelcomeModalEditor'
import ImageCropperModal from '../../components/ui/ImageCropperModal/ImageCropperModal'
import ThemeManager from '../../components/dashboard/ThemeManager/ThemeManager'
import StoreFooterEditor from '../../components/dashboard/StoreFooterEditor/StoreFooterEditor'
import { useAppSelector } from '../../app/hooks'
import { selectUser } from '../../features/auth/authSlice'
import { selectTenants } from '../../features/tenants/tenantsSlice'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import { fetchTenantFull, updateTenantInfo, updateTenantWelcomeModal, updateTenantOpeningHours, updateTenantSoundConfig } from '../../lib/supabaseApi'
import { uploadTenantLogo, uploadWelcomeImage } from '../../lib/supabaseStorage'
import { loadJson, saveJson } from '../../shared/storage'
import { DAYS_OPTIONS, TIME_OPTIONS } from '../../shared/openingHours'
import { SUBSCRIPTION_TIERS, getActiveSubscriptionTier } from '../../shared/subscriptions'
import { Save, Store, Image, MessageSquare, Upload, X, Eye, EyeOff, Clock, Plus, Trash2, FileText, AlertTriangle, Crop, Link2, Bell, Volume2, VolumeX, Pencil } from 'lucide-react'

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
  
  // Subscription tier activo (considerando fecha de expiración) - debe ir después de tenantData
  const subscriptionTier = useMemo(() => getActiveSubscriptionTier(tenantData || currentTenant), [tenantData, currentTenant])
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
  const [editingHourIndex, setEditingHourIndex] = useState(null) // Para edición
  const [hourError, setHourError] = useState('') // Para errores de validación
  
  // Image Cropper states
  const [showLogoCropper, setShowLogoCropper] = useState(false)
  const [logoCropperImage, setLogoCropperImage] = useState(null)
  const [showLogoUrlInput, setShowLogoUrlInput] = useState(false)
  const [logoUrlInput, setLogoUrlInput] = useState('')
  
  const logoInputRef = useRef(null)
  
  // Sound notification config
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [soundRepeatCount, setSoundRepeatCount] = useState(3)
  const [soundDelayMs, setSoundDelayMs] = useState(1500)
  const [savingSound, setSavingSound] = useState(false)
  const audioRef = useRef(null)

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
            // Sound config
            setSoundEnabled(tenant.sound_enabled !== false)
            setSoundRepeatCount(tenant.sound_repeat_count || 3)
            setSoundDelayMs(tenant.sound_delay_ms || 1500)
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
            // Sound config (mock mode)
            setSoundEnabled(t.soundEnabled !== false)
            setSoundRepeatCount(t.soundRepeatCount || 3)
            setSoundDelayMs(t.soundDelayMs || 1500)
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

  // Cuando el usuario termina de ajustar el logo
  const handleLogoCropComplete = async (imageSrc, focalPoint) => {
    setShowLogoCropper(false)
    setLogoCropperImage(null)
    setUploadingLogo(true)
    setError(null)

    try {
      if (isSupabaseConfigured) {
        // Convertir base64 a File para subir
        const response = await fetch(imageSrc)
        const blob = await response.blob()
        const file = new File([blob], 'logo.jpg', { type: 'image/jpeg' })
        const logoUrl = await uploadTenantLogo({ tenantId: user.tenantId, file })
        setTenantLogo(logoUrl)
        // TODO: Guardar focalPoint para el logo si es necesario
      } else {
        // Mock: usar directamente el data URL
        setTenantLogo(imageSrc)
      }
    } catch (e) {
      setError(e?.message || 'Error al subir el logo')
    } finally {
      setUploadingLogo(false)
    }
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

  // Handler para guardar configuración de sonido
  const handleSaveSoundConfig = async () => {
    if (!user?.tenantId) return
    
    setSavingSound(true)
    setError(null)
    
    try {
      if (isSupabaseConfigured) {
        await updateTenantSoundConfig({
          tenantId: user.tenantId,
          soundEnabled: soundEnabled,
          soundRepeatCount: soundRepeatCount,
          soundDelayMs: soundDelayMs,
        })
      } else {
        // Guardar en localStorage en modo mock
        const mockTenant = loadJson(MOCK_TENANT_KEY, {})
        mockTenant[user.tenantId] = {
          ...(mockTenant[user.tenantId] || {}),
          soundEnabled,
          soundRepeatCount,
          soundDelayMs,
        }
        saveJson(MOCK_TENANT_KEY, mockTenant)
      }
    } catch (e) {
      setError(e?.message || 'Error al guardar la configuración de sonido')
    } finally {
      setSavingSound(false)
    }
  }
  
  // Función para probar el sonido
  const playTestSound = () => {
    if (!soundEnabled || !audioRef.current) return
    
    let played = 0
    const playOnce = () => {
      if (played >= soundRepeatCount) return
      
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => {})
      played++
      
      if (played < soundRepeatCount) {
        setTimeout(playOnce, soundDelayMs)
      }
    }
    
    playOnce()
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
    
    // Validar que la hora de apertura sea menor que la de cierre
    const openMinutes = parseInt(newHourOpen.split(':')[0]) * 60 + parseInt(newHourOpen.split(':')[1])
    const closeMinutes = parseInt(newHourClose.split(':')[0]) * 60 + parseInt(newHourClose.split(':')[1])
    
    if (openMinutes >= closeMinutes) {
      setHourError('La hora de apertura debe ser menor que la hora de cierre')
      return
    }
    
    setHourError('') // Limpiar error si todo está bien
    
    let newHours
    
    // Si estamos editando un horario existente
    if (editingHourIndex !== null) {
      newHours = [...openingHours]
      newHours[editingHourIndex] = { 
        day: newHourDay, 
        open: newHourOpen, 
        close: newHourClose, 
        enabled: newHours[editingHourIndex].enabled 
      }
    } else {
      // Check if day already exists
      const existingIndex = openingHours.findIndex(h => h.day === newHourDay)
      if (existingIndex >= 0) {
        // Update existing
        newHours = [...openingHours]
        newHours[existingIndex] = { day: newHourDay, open: newHourOpen, close: newHourClose, enabled: true }
      } else {
        // Add new
        newHours = [...openingHours, { day: newHourDay, open: newHourOpen, close: newHourClose, enabled: true }]
      }
    }
    
    setOpeningHours(newHours)
    await saveOpeningHours(newHours)
    
    // Reset form
    setShowAddHour(false)
    setEditingHourIndex(null)
    setNewHourDay('')
    setNewHourOpen('09:00')
    setNewHourClose('22:00')
    setHourError('')
  }

  const handleEditHour = (index) => {
    const hour = openingHours[index]
    setNewHourDay(hour.day)
    setNewHourOpen(hour.open)
    setNewHourClose(hour.close)
    setEditingHourIndex(index)
    setShowAddHour(true)
    setHourError('')
  }

  const handleCancelEdit = () => {
    setShowAddHour(false)
    setEditingHourIndex(null)
    setNewHourDay('')
    setNewHourOpen('09:00')
    setNewHourClose('22:00')
    setHourError('')
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

  // Generate default welcome content based on restaurant data (available for future use)
  const _getDefaultWelcomeTitle = () => tenantName || 'Bienvenido'
  const _getDefaultWelcomeMessage = () => {
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
                    Ajustar
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
                      className="account__hoursEdit"
                      onClick={() => handleEditHour(index)}
                      title="Editar"
                    >
                      <Pencil size={16} />
                    </button>
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
                  onChange={(e) => { setNewHourOpen(e.target.value); setHourError(''); }}
                  className="account__select"
                >
                  {TIME_OPTIONS.map(time => (
                    <option key={time.value} value={time.value}>{time.label}</option>
                  ))}
                </select>
                <span className="account__addHourSeparator">a</span>
                <select 
                  value={newHourClose} 
                  onChange={(e) => { setNewHourClose(e.target.value); setHourError(''); }}
                  className="account__select"
                >
                  {TIME_OPTIONS.map(time => (
                    <option key={time.value} value={time.value}>{time.label}</option>
                  ))}
                </select>
              </div>
              {hourError && (
                <div className="account__hourError">
                  <AlertTriangle size={14} />
                  {hourError}
                </div>
              )}
              <div className="account__addHourActions">
                <Button variant="secondary" size="sm" onClick={handleCancelEdit}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleAddHour} disabled={!newHourDay}>
                  {editingHourIndex !== null ? <Save size={16} /> : <Plus size={16} />}
                  {editingHourIndex !== null ? 'Guardar' : 'Agregar'}
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

      {/* Configuración de Notificaciones de Sonido */}
      <Card title="Notificaciones de Sonido">
        <div className="account__section">
          <p className="account__hint" style={{ marginBottom: '20px' }}>
            Configura cómo suena la notificación cuando llega un nuevo pedido.
            {savingSound && <span className="account__savingIndicator" style={{ marginLeft: '8px' }}>Guardando...</span>}
          </p>

          {/* Sonido habilitado */}
          <div className="account__soundItem">
            <div className="account__soundInfo">
              <label className="account__label">
                {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                Sonido habilitado
              </label>
              <p className="muted">Activa o desactiva el sonido de notificaciones</p>
            </div>
            <button
              className={`account__toggle ${soundEnabled ? 'account__toggle--on' : ''}`}
              onClick={() => {
                setSoundEnabled(!soundEnabled)
                handleSaveSoundConfig()
              }}
            >
              <span className="account__toggleCircle" />
            </button>
          </div>

          {/* Repeticiones */}
          <div className="account__soundItem">
            <div className="account__soundInfo">
              <label className="account__label">
                <Bell size={16} />
                Repeticiones
              </label>
              <p className="muted">Cuántas veces suena la notificación (1-10)</p>
            </div>
            <div className="account__soundControl">
              <button 
                className="account__soundBtn"
                onClick={() => {
                  const newVal = Math.max(1, soundRepeatCount - 1)
                  setSoundRepeatCount(newVal)
                  setTimeout(handleSaveSoundConfig, 100)
                }}
                disabled={!soundEnabled || soundRepeatCount <= 1}
              >
                −
              </button>
              <span className="account__soundValue">{soundRepeatCount}x</span>
              <button 
                className="account__soundBtn"
                onClick={() => {
                  const newVal = Math.min(10, soundRepeatCount + 1)
                  setSoundRepeatCount(newVal)
                  setTimeout(handleSaveSoundConfig, 100)
                }}
                disabled={!soundEnabled || soundRepeatCount >= 10}
              >
                +
              </button>
            </div>
          </div>

          {/* Delay entre sonidos */}
          <div className="account__soundItem">
            <div className="account__soundInfo">
              <label className="account__label">
                <Clock size={16} />
                Delay entre sonidos
              </label>
              <p className="muted">Tiempo de espera entre cada repetición</p>
            </div>
            <select
              className="account__select"
              value={soundDelayMs}
              onChange={(e) => {
                setSoundDelayMs(parseInt(e.target.value))
                setTimeout(handleSaveSoundConfig, 100)
              }}
              disabled={!soundEnabled}
              style={{ minWidth: '140px' }}
            >
              <option value={500}>0.5 segundos</option>
              <option value={1000}>1 segundo</option>
              <option value={1500}>1.5 segundos</option>
              <option value={2000}>2 segundos</option>
              <option value={3000}>3 segundos</option>
              <option value={5000}>5 segundos</option>
            </select>
          </div>

          {/* Botón de prueba */}
          <div className="account__soundTest">
            <Button 
              variant="secondary" 
              size="sm"
              onClick={playTestSound}
              disabled={!soundEnabled}
            >
              🔊 Probar Sonido
            </Button>
          </div>
        </div>
        
        {/* Audio element para prueba de sonido */}
        <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" preload="auto" />
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

      {/* Diseño y Personalización */}
      <ThemeManager tenantId={user?.tenantId} subscriptionTier={subscriptionTier} />

      {/* Footer de la tienda */}
      <StoreFooterEditor tenantId={user?.tenantId} tenantName={tenantName} openingHours={openingHours} />

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
