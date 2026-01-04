import { useState, useEffect, useCallback, useRef } from 'react'
import './StoreFooterEditor.css'
import Card from '../../../components/ui/Card/Card'
import Input from '../../../components/ui/Input/Input'
import Button from '../../../components/ui/Button/Button'
import { 
  Save, 
  MapPin, 
  Phone, 
  Mail, 
  Instagram, 
  Facebook, 
  Twitter, 
  Youtube,
  Clock,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Link2,
  CreditCard,
  Banknote,
  MessageCircle,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Navigation,
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
  Search
} from 'lucide-react'
import { isSupabaseConfigured } from '../../../lib/supabaseClient'
import { fetchStoreFooterSettings, upsertStoreFooterSettings } from '../../../lib/supabaseApi'
import { loadJson, saveJson } from '../../../shared/storage'

const MOCK_FOOTER_KEY = 'mock.storeFooterSettings'

// Códigos telefónicos de América
const PHONE_CODES_AMERICA = [
  { code: '+1', country: 'Estados Unidos / Canadá', flag: '🇺🇸' },
  { code: '+52', country: 'México', flag: '🇲🇽' },
  { code: '+54', country: 'Argentina', flag: '🇦🇷' },
  { code: '+55', country: 'Brasil', flag: '🇧🇷' },
  { code: '+56', country: 'Chile', flag: '🇨🇱' },
  { code: '+57', country: 'Colombia', flag: '🇨🇴' },
  { code: '+58', country: 'Venezuela', flag: '🇻🇪' },
  { code: '+51', country: 'Perú', flag: '🇵🇪' },
  { code: '+53', country: 'Cuba', flag: '🇨🇺' },
  { code: '+591', country: 'Bolivia', flag: '🇧🇴' },
  { code: '+593', country: 'Ecuador', flag: '🇪🇨' },
  { code: '+595', country: 'Paraguay', flag: '🇵🇾' },
  { code: '+598', country: 'Uruguay', flag: '🇺🇾' },
  { code: '+502', country: 'Guatemala', flag: '🇬🇹' },
  { code: '+503', country: 'El Salvador', flag: '🇸🇻' },
  { code: '+504', country: 'Honduras', flag: '🇭🇳' },
  { code: '+505', country: 'Nicaragua', flag: '🇳🇮' },
  { code: '+506', country: 'Costa Rica', flag: '🇨🇷' },
  { code: '+507', country: 'Panamá', flag: '🇵🇦' },
  { code: '+509', country: 'Haití', flag: '🇭🇹' },
  { code: '+1809', country: 'República Dominicana', flag: '🇩🇴' },
  { code: '+1787', country: 'Puerto Rico', flag: '🇵🇷' },
  { code: '+501', country: 'Belice', flag: '🇧🇿' },
  { code: '+592', country: 'Guyana', flag: '🇬🇾' },
  { code: '+597', country: 'Surinam', flag: '🇸🇷' },
  { code: '+594', country: 'Guayana Francesa', flag: '🇬🇫' },
  { code: '+1868', country: 'Trinidad y Tobago', flag: '🇹🇹' },
  { code: '+1876', country: 'Jamaica', flag: '🇯🇲' },
  { code: '+1246', country: 'Barbados', flag: '🇧🇧' },
  { code: '+1242', country: 'Bahamas', flag: '🇧🇸' },
]

// Componente de botón de guardar por sección
function SectionSaveButton({ saving, success, error, onSave }) {
  return (
    <div className="footerEditor__sectionSave">
      <Button onClick={onSave} disabled={saving} size="sm" variant="primary">
        {saving ? <Loader2 size={14} className="spinning" /> : <Save size={14} />}
        {saving ? 'Guardando...' : 'Guardar'}
      </Button>
      {success && (
        <span className="footerEditor__sectionSuccess">
          <CheckCircle size={14} /> Guardado
        </span>
      )}
      {error && (
        <span className="footerEditor__sectionError">
          <AlertCircle size={14} /> {error}
        </span>
      )}
    </div>
  )
}

export default function StoreFooterEditor({ tenantId, tenantName, openingHours }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})
  const [success, setSuccess] = useState({})
  const [error, setError] = useState({})
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef = useRef(null)
  
  // Map search state
  const [mapSearchQuery, setMapSearchQuery] = useState('')
  const [mapSearchResults, setMapSearchResults] = useState([])
  const [mapSearching, setMapSearching] = useState(false)

  // Section expansion states
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    contact: false,
    location: false,
    social: false,
    payments: false,
    links: false,
    terms: false,
    visibility: false
  })

  // Footer data
  const [footerData, setFooterData] = useState({
    store_name: '',
    short_description: '',
    address: '',
    city: '',
    country: '',
    phone: '',
    phone_country_code: '+54',
    whatsapp: '',
    email: '',
    instagram_url: '',
    facebook_url: '',
    twitter_url: '',
    tiktok_url: '',
    youtube_url: '',
    custom_links: [],
    show_address: true,
    show_phone: true,
    show_email: true,
    show_hours: true,
    show_social: true,
    show_payment_methods: true,
    accepts_cash: true,
    accepts_card: true,
    accepts_mercadopago: true,
    legal_text: '',
    copyright_text: '',
    location_address: '',
    location_lat: null,
    location_lng: null,
    use_site_terms: false
  })

  // Custom links management
  const [newLinkLabel, setNewLinkLabel] = useState('')
  const [newLinkUrl, setNewLinkUrl] = useState('')

  // Load footer settings
  useEffect(() => {
    if (!tenantId) {
      setLoading(false)
      return
    }

    async function loadSettings() {
      setLoading(true)
      try {
        if (isSupabaseConfigured) {
          const data = await fetchStoreFooterSettings(tenantId)
          if (data) {
            setFooterData(prev => ({
              ...prev,
              ...data,
              custom_links: Array.isArray(data.custom_links) 
                ? data.custom_links 
                : (data.custom_links ? JSON.parse(data.custom_links) : [])
            }))
          } else {
            // No data yet, use tenant name as default
            setFooterData(prev => ({
              ...prev,
              store_name: tenantName || ''
            }))
          }
        } else {
          // Mock mode
          const mockData = loadJson(MOCK_FOOTER_KEY, {})
          if (mockData[tenantId]) {
            setFooterData(prev => ({
              ...prev,
              ...mockData[tenantId]
            }))
          } else {
            setFooterData(prev => ({
              ...prev,
              store_name: tenantName || ''
            }))
          }
        }
      } catch (err) {
        console.error('Error loading footer settings:', err)
        setError('Error al cargar configuración del footer')
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [tenantId, tenantName])

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const updateField = useCallback((field, value) => {
    setFooterData(prev => ({
      ...prev,
      [field]: value
    }))
  }, [])

  const addCustomLink = () => {
    if (!newLinkLabel.trim() || !newLinkUrl.trim()) return

    const newLink = {
      label: newLinkLabel.trim(),
      url: newLinkUrl.trim(),
      external: !newLinkUrl.startsWith('/')
    }

    setFooterData(prev => ({
      ...prev,
      custom_links: [...(prev.custom_links || []), newLink]
    }))

    setNewLinkLabel('')
    setNewLinkUrl('')
  }

  const removeCustomLink = (index) => {
    setFooterData(prev => ({
      ...prev,
      custom_links: prev.custom_links.filter((_, i) => i !== index)
    }))
  }

  // Save function for a specific section - accepts optional overrideData for async state updates
  const handleSaveSection = async (sectionName, overrideData = null) => {
    if (!tenantId) return

    setSaving(prev => ({ ...prev, [sectionName]: true }))
    setError(prev => ({ ...prev, [sectionName]: null }))
    setSuccess(prev => ({ ...prev, [sectionName]: false }))

    const dataToSave = overrideData || footerData

    try {
      if (isSupabaseConfigured) {
        await upsertStoreFooterSettings({
          tenantId,
          settings: dataToSave
        })
      } else {
        // Mock mode
        const mockData = loadJson(MOCK_FOOTER_KEY, {})
        mockData[tenantId] = dataToSave
        saveJson(MOCK_FOOTER_KEY, mockData)
      }
      setSuccess(prev => ({ ...prev, [sectionName]: true }))
      setTimeout(() => setSuccess(prev => ({ ...prev, [sectionName]: false })), 3000)
    } catch (err) {
      console.error('Error saving footer settings:', err)
      setError(prev => ({ ...prev, [sectionName]: err.message || 'Error al guardar' }))
    } finally {
      setSaving(prev => ({ ...prev, [sectionName]: false }))
    }
  }

  // Search for locations using Nominatim
  const handleMapSearch = async () => {
    if (!mapSearchQuery.trim()) return
    
    setMapSearching(true)
    setMapSearchResults([])
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(mapSearchQuery)}&format=json&limit=5&addressdetails=1`
      )
      const results = await response.json()
      setMapSearchResults(results)
    } catch (err) {
      console.error('Error searching location:', err)
    } finally {
      setMapSearching(false)
    }
  }

  // Select a search result and update map
  const selectSearchResult = (result) => {
    const lat = parseFloat(result.lat)
    const lng = parseFloat(result.lon)
    const address = result.display_name
    
    // Center map on selected location
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([lat, lng], 16)
      
      // Update or create marker
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng])
      } else {
        markerRef.current = window.L.marker([lat, lng]).addTo(mapInstanceRef.current)
      }
    }
    
    // Update footer data and save
    const updatedData = {
      ...footerData,
      location_lat: lat,
      location_lng: lng,
      location_address: address
    }
    
    setFooterData(updatedData)
    setMapSearchResults([])
    setMapSearchQuery('')
    
    // Auto-save
    handleSaveSection('location', updatedData)
  }

  // Initialize map when location section is expanded
  useEffect(() => {
    if (!expandedSections.location || !mapRef.current) return
    
    // Load Google Maps script if not already loaded
    if (!window.google?.maps) {
      // Use OpenStreetMap with Leaflet instead (free, no API key needed)
      if (!window.L) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(link)
        
        const script = document.createElement('script')
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
        script.onload = () => initMap()
        document.head.appendChild(script)
      } else {
        initMap()
      }
    }
    
    function initMap() {
      if (!mapRef.current || mapInstanceRef.current) return
      
      // Default location: Buenos Aires
      const defaultLat = footerData.location_lat || -34.6037
      const defaultLng = footerData.location_lng || -58.3816
      
      const map = window.L.map(mapRef.current).setView([defaultLat, defaultLng], 15)
      
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map)
      
      // Add marker if we have coordinates
      if (footerData.location_lat && footerData.location_lng) {
        markerRef.current = window.L.marker([footerData.location_lat, footerData.location_lng]).addTo(map)
      }
      
      // Click handler to set location
      map.on('click', async (e) => {
        const { lat, lng } = e.latlng
        
        // Update or create marker
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng])
        } else {
          markerRef.current = window.L.marker([lat, lng]).addTo(map)
        }
        
        // Reverse geocode to get address
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
          )
          const data = await response.json()
          const address = data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`
          
          const updatedData = {
            ...footerData,
            location_lat: lat,
            location_lng: lng,
            location_address: address
          }
          
          setFooterData(updatedData)
          
          // Auto-save after selecting location - pass the updated data directly
          handleSaveSection('location', updatedData)
        } catch (err) {
          console.error('Error getting address:', err)
          const updatedData = {
            ...footerData,
            location_lat: lat,
            location_lng: lng,
            location_address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`
          }
          
          setFooterData(updatedData)
          handleSaveSection('location', updatedData)
        }
      })
      
      mapInstanceRef.current = map
    }
    
    // Small delay to ensure container is rendered
    const timer = setTimeout(() => {
      if (window.L && !mapInstanceRef.current) {
        initMap()
      }
    }, 100)
    
    return () => clearTimeout(timer)
  }, [expandedSections.location])

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  if (loading) {
    return (
      <Card title="Footer de la tienda" icon={<MapPin size={20} />}>
        <div className="footerEditor__loading">Cargando configuración...</div>
      </Card>
    )
  }

  return (
    <Card title="Footer de la tienda" icon={<MapPin size={20} />} className="footerEditor">
      <p className="footerEditor__description">
        Personaliza el pie de página de tu tienda con tu información de contacto, redes sociales y más.
      </p>

      {/* Basic Info Section */}
      <div className="footerEditor__section">
        <button 
          className={`footerEditor__sectionHeader ${expandedSections.basic ? 'expanded' : ''}`}
          onClick={() => toggleSection('basic')}
        >
          <span>Información básica</span>
          {expandedSections.basic ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {expandedSections.basic && (
          <div className="footerEditor__sectionContent">
            <div className="footerEditor__field">
              <label>Nombre de la tienda</label>
              <Input 
                value={footerData.store_name}
                onChange={(val) => updateField('store_name', val)}
                placeholder="Mi Restaurante"
              />
            </div>
            <div className="footerEditor__field">
              <label>Descripción corta</label>
              <Input 
                value={footerData.short_description}
                onChange={(val) => updateField('short_description', val)}
                placeholder="Los mejores platos de la ciudad"
              />
            </div>
            <div className="footerEditor__row">
              <div className="footerEditor__field">
                <label>Texto legal</label>
                <Input 
                  value={footerData.legal_text}
                  onChange={(val) => updateField('legal_text', val)}
                  placeholder="CUIT: XX-XXXXXXXX-X"
                />
              </div>
              <div className="footerEditor__field">
                <label>Copyright</label>
                <Input 
                  value={footerData.copyright_text}
                  onChange={(val) => updateField('copyright_text', val)}
                  placeholder="© 2024 Mi Tienda. Todos los derechos reservados."
                />
              </div>
            </div>
            <SectionSaveButton
              saving={saving.basic}
              success={success.basic}
              error={error.basic}
              onSave={() => handleSaveSection('basic')}
            />
          </div>
        )}
      </div>

      {/* Contact Section */}
      <div className="footerEditor__section">
        <button 
          className={`footerEditor__sectionHeader ${expandedSections.contact ? 'expanded' : ''}`}
          onClick={() => toggleSection('contact')}
        >
          <Phone size={16} />
          <span>Contacto</span>
          {expandedSections.contact ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {expandedSections.contact && (
          <div className="footerEditor__sectionContent">
            <div className="footerEditor__row">
              <div className="footerEditor__field">
                <label>Dirección</label>
                <Input 
                  value={footerData.address}
                  onChange={(val) => updateField('address', val)}
                  placeholder="Av. Principal 123"
                />
              </div>
              <div className="footerEditor__field">
                <label>Ciudad</label>
                <Input 
                  value={footerData.city}
                  onChange={(val) => updateField('city', val)}
                  placeholder="Buenos Aires"
                />
              </div>
            </div>
            <div className="footerEditor__row">
              <div className="footerEditor__field">
                <label>País</label>
                <Input 
                  value={footerData.country}
                  onChange={(val) => updateField('country', val)}
                  placeholder="Argentina"
                />
              </div>
            </div>
            <div className="footerEditor__row">
              <div className="footerEditor__field footerEditor__field--phone">
                <label><Phone size={14} /> Teléfono</label>
                <div className="footerEditor__phoneInput">
                  <select
                    className="footerEditor__phoneCode"
                    value={footerData.phone_country_code || '+54'}
                    onChange={(e) => updateField('phone_country_code', e.target.value)}
                  >
                    {PHONE_CODES_AMERICA.map(({ code, country, flag }) => (
                      <option key={code} value={code}>
                        {flag} {code}
                      </option>
                    ))}
                  </select>
                  <Input 
                    value={footerData.phone}
                    onChange={(val) => updateField('phone', val)}
                    placeholder="11 1234-5678"
                  />
                </div>
              </div>
              <div className="footerEditor__field">
                <label><MessageCircle size={14} /> WhatsApp (con código de país)</label>
                <Input 
                  value={footerData.whatsapp}
                  onChange={(val) => updateField('whatsapp', val)}
                  placeholder="+5411123456789"
                />
              </div>
            </div>
            <div className="footerEditor__field">
              <label><Mail size={14} /> Email</label>
              <Input 
                value={footerData.email}
                onChange={(val) => updateField('email', val)}
                placeholder="contacto@mitienda.com"
              />
            </div>
            <SectionSaveButton
              saving={saving.contact}
              success={success.contact}
              error={error.contact}
              onSave={() => handleSaveSection('contact')}
            />
          </div>
        )}
      </div>

      {/* Location Section */}
      <div className="footerEditor__section">
        <button 
          className={`footerEditor__sectionHeader ${expandedSections.location ? 'expanded' : ''}`}
          onClick={() => toggleSection('location')}
        >
          <Navigation size={16} />
          <span>Ubicación en el mapa</span>
          {expandedSections.location ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {expandedSections.location && (
          <div className="footerEditor__sectionContent">
            <p className="footerEditor__hint">
              Busca una dirección o haz clic en el mapa para seleccionar la ubicación de tu tienda.
            </p>
            
            {/* Map Search */}
            <div className="footerEditor__mapSearch">
              <div className="footerEditor__mapSearchInput">
                <Input 
                  value={mapSearchQuery}
                  onChange={setMapSearchQuery}
                  placeholder="Buscar dirección..."
                  onKeyPress={(e) => e.key === 'Enter' && handleMapSearch()}
                />
                <button 
                  className="footerEditor__mapSearchBtn"
                  onClick={handleMapSearch}
                  disabled={mapSearching}
                  type="button"
                >
                  {mapSearching ? <Loader2 size={16} className="spinning" /> : <Search size={16} />}
                </button>
              </div>
              
              {/* Search Results */}
              {mapSearchResults.length > 0 && (
                <ul className="footerEditor__mapSearchResults">
                  {mapSearchResults.map((result) => (
                    <li key={result.place_id}>
                      <button 
                        type="button"
                        onClick={() => selectSearchResult(result)}
                        className="footerEditor__mapSearchResult"
                      >
                        <MapPin size={14} />
                        <span>{result.display_name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            
            {/* Interactive Map */}
            <div className="footerEditor__mapContainer" ref={mapRef}></div>
            
            {/* Current Address Display */}
            {footerData.location_address && (
              <div className="footerEditor__currentLocation">
                <MapPin size={16} />
                <span>{footerData.location_address}</span>
              </div>
            )}
            
            <SectionSaveButton
              saving={saving.location}
              success={success.location}
              error={error.location}
              onSave={() => handleSaveSection('location')}
            />
          </div>
        )}
      </div>

      {/* Social Media Section */}
      <div className="footerEditor__section">
        <button 
          className={`footerEditor__sectionHeader ${expandedSections.social ? 'expanded' : ''}`}
          onClick={() => toggleSection('social')}
        >
          <Instagram size={16} />
          <span>Redes sociales</span>
          {expandedSections.social ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {expandedSections.social && (
          <div className="footerEditor__sectionContent">
            <div className="footerEditor__field">
              <label><Instagram size={14} /> Instagram</label>
              <Input 
                value={footerData.instagram_url}
                onChange={(val) => updateField('instagram_url', val)}
                placeholder="https://instagram.com/tu_tienda"
              />
            </div>
            <div className="footerEditor__field">
              <label><Facebook size={14} /> Facebook</label>
              <Input 
                value={footerData.facebook_url}
                onChange={(val) => updateField('facebook_url', val)}
                placeholder="https://facebook.com/tu_tienda"
              />
            </div>
            <div className="footerEditor__row">
              <div className="footerEditor__field">
                <label><Twitter size={14} /> Twitter / X</label>
                <Input 
                  value={footerData.twitter_url}
                  onChange={(val) => updateField('twitter_url', val)}
                  placeholder="https://twitter.com/tu_tienda"
                />
              </div>
              <div className="footerEditor__field">
                <label>TikTok</label>
                <Input 
                  value={footerData.tiktok_url}
                  onChange={(val) => updateField('tiktok_url', val)}
                  placeholder="https://tiktok.com/@tu_tienda"
                />
              </div>
            </div>
            <div className="footerEditor__field">
              <label><Youtube size={14} /> YouTube</label>
              <Input 
                value={footerData.youtube_url}
                onChange={(val) => updateField('youtube_url', val)}
                placeholder="https://youtube.com/@tu_tienda"
              />
            </div>
            <SectionSaveButton
              saving={saving.social}
              success={success.social}
              error={error.social}
              onSave={() => handleSaveSection('social')}
            />
          </div>
        )}
      </div>

      {/* Payment Methods Section */}
      <div className="footerEditor__section">
        <button 
          className={`footerEditor__sectionHeader ${expandedSections.payments ? 'expanded' : ''}`}
          onClick={() => toggleSection('payments')}
        >
          <CreditCard size={16} />
          <span>Métodos de pago</span>
          {expandedSections.payments ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {expandedSections.payments && (
          <div className="footerEditor__sectionContent">
            <div className="footerEditor__checkboxList">
              <label className="footerEditor__checkboxItem">
                <input
                  type="checkbox"
                  checked={footerData.accepts_cash}
                  onChange={(e) => updateField('accepts_cash', e.target.checked)}
                />
                <Banknote size={16} />
                <span>Efectivo</span>
              </label>
              <label className="footerEditor__checkboxItem">
                <input
                  type="checkbox"
                  checked={footerData.accepts_card}
                  onChange={(e) => updateField('accepts_card', e.target.checked)}
                />
                <CreditCard size={16} />
                <span>Tarjeta</span>
              </label>
              <label className="footerEditor__checkboxItem">
                <input
                  type="checkbox"
                  checked={footerData.accepts_mercadopago}
                  onChange={(e) => updateField('accepts_mercadopago', e.target.checked)}
                />
                <Smartphone size={16} />
                <span>MercadoPago</span>
              </label>
            </div>
            <SectionSaveButton
              saving={saving.payments}
              success={success.payments}
              error={error.payments}
              onSave={() => handleSaveSection('payments')}
            />
          </div>
        )}
      </div>

      {/* Custom Links Section */}
      <div className="footerEditor__section">
        <button 
          className={`footerEditor__sectionHeader ${expandedSections.links ? 'expanded' : ''}`}
          onClick={() => toggleSection('links')}
        >
          <Link2 size={16} />
          <span>Enlaces personalizados</span>
          {expandedSections.links ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {expandedSections.links && (
          <div className="footerEditor__sectionContent">
            <p className="footerEditor__hint">
              Añade enlaces adicionales como políticas, términos, etc.
            </p>
            
            {/* Existing links */}
            {footerData.custom_links?.length > 0 && (
              <ul className="footerEditor__linksList">
                {footerData.custom_links.map((link, index) => (
                  <li key={index} className="footerEditor__linkItem">
                    <span className="footerEditor__linkLabel">{link.label}</span>
                    <span className="footerEditor__linkUrl">{link.url}</span>
                    <button 
                      onClick={() => removeCustomLink(index)}
                      className="footerEditor__linkRemove"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            
            {/* Add new link */}
            <div className="footerEditor__addLink">
              <Input 
                value={newLinkLabel}
                onChange={setNewLinkLabel}
                placeholder="Etiqueta (ej: Política de privacidad)"
              />
              <Input 
                value={newLinkUrl}
                onChange={setNewLinkUrl}
                placeholder="URL (ej: /privacidad)"
              />
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={addCustomLink}
                disabled={!newLinkLabel.trim() || !newLinkUrl.trim()}
              >
                <Plus size={14} /> Añadir
              </Button>
            </div>
            <SectionSaveButton
              saving={saving.links}
              success={success.links}
              error={error.links}
              onSave={() => handleSaveSection('links')}
            />
          </div>
        )}
      </div>

      {/* Terms & Conditions Section */}
      <div className="footerEditor__section">
        <button 
          className={`footerEditor__sectionHeader ${expandedSections.terms ? 'expanded' : ''}`}
          onClick={() => toggleSection('terms')}
        >
          <FileText size={16} />
          <span>Términos y condiciones</span>
          {expandedSections.terms ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {expandedSections.terms && (
          <div className="footerEditor__sectionContent">
            <label className="footerEditor__checkboxItem footerEditor__checkboxItem--full">
              <input
                type="checkbox"
                checked={footerData.use_site_terms}
                onChange={(e) => updateField('use_site_terms', e.target.checked)}
              />
              <FileText size={16} />
              <div className="footerEditor__termsInfo">
                <span>Usar términos de Restos</span>
                <small>Muestra un enlace a los términos y condiciones de la plataforma en el footer de tu tienda.</small>
              </div>
            </label>
            {footerData.use_site_terms && (
              <p className="footerEditor__hint footerEditor__hint--success">
                ✓ Se mostrará un enlace "Términos y condiciones" que llevará a una página con las políticas de Restos dentro de tu tienda.
              </p>
            )}
            <SectionSaveButton
              saving={saving.terms}
              success={success.terms}
              error={error.terms}
              onSave={() => handleSaveSection('terms')}
            />
          </div>
        )}
      </div>

      {/* Visibility Section */}
      <div className="footerEditor__section">
        <button 
          className={`footerEditor__sectionHeader ${expandedSections.visibility ? 'expanded' : ''}`}
          onClick={() => toggleSection('visibility')}
        >
          <Eye size={16} />
          <span>Visibilidad de secciones</span>
          {expandedSections.visibility ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {expandedSections.visibility && (
          <div className="footerEditor__sectionContent">
            <p className="footerEditor__hint">
              Elige qué secciones mostrar en el footer.
            </p>
            <div className="footerEditor__checkboxList footerEditor__checkboxList--grid">
              <label className="footerEditor__checkboxItem">
                <input
                  type="checkbox"
                  checked={footerData.show_address}
                  onChange={(e) => updateField('show_address', e.target.checked)}
                />
                <MapPin size={16} />
                <span>Dirección</span>
              </label>
              <label className="footerEditor__checkboxItem">
                <input
                  type="checkbox"
                  checked={footerData.show_phone}
                  onChange={(e) => updateField('show_phone', e.target.checked)}
                />
                <Phone size={16} />
                <span>Teléfono</span>
              </label>
              <label className="footerEditor__checkboxItem">
                <input
                  type="checkbox"
                  checked={footerData.show_email}
                  onChange={(e) => updateField('show_email', e.target.checked)}
                />
                <Mail size={16} />
                <span>Email</span>
              </label>
              <label className="footerEditor__checkboxItem">
                <input
                  type="checkbox"
                  checked={footerData.show_hours}
                  onChange={(e) => updateField('show_hours', e.target.checked)}
                />
                <Clock size={16} />
                <span>Horarios</span>
              </label>
              <label className="footerEditor__checkboxItem">
                <input
                  type="checkbox"
                  checked={footerData.show_social}
                  onChange={(e) => updateField('show_social', e.target.checked)}
                />
                <Instagram size={16} />
                <span>Redes sociales</span>
              </label>
              <label className="footerEditor__checkboxItem">
                <input
                  type="checkbox"
                  checked={footerData.show_payment_methods}
                  onChange={(e) => updateField('show_payment_methods', e.target.checked)}
                />
                <CreditCard size={16} />
                <span>Métodos de pago</span>
              </label>
            </div>
            <SectionSaveButton
              saving={saving.visibility}
              success={success.visibility}
              error={error.visibility}
              onSave={() => handleSaveSection('visibility')}
            />
          </div>
        )}
      </div>
    </Card>
  )
}
