import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import './StoreFooter.css'
import { 
  MapPin, 
  Phone, 
  Mail, 
  Clock, 
  Instagram, 
  Facebook, 
  Twitter, 
  Youtube,
  CreditCard,
  Banknote,
  Smartphone,
  ExternalLink,
  Store,
  FileText,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

// WhatsApp icon (official style)
const WhatsAppIcon = ({ size = 16 }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

// TikTok icon (not in lucide-react)
const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
)

export default function StoreFooter({ footerData, tenantData, themeData, storeSlug }) {
  const [hoursExpanded, setHoursExpanded] = useState(false)
  
  const {
    store_name,
    short_description,
    address,
    city,
    country,
    phone,
    phone_country_code,
    whatsapp,
    email,
    instagram_url,
    facebook_url,
    twitter_url,
    tiktok_url,
    youtube_url,
    custom_links,
    show_address = true,
    show_phone = true,
    show_email = true,
    show_hours = true,
    show_social = true,
    show_payment_methods = true,
    accepts_cash = true,
    accepts_card = true,
    accepts_mercadopago = true,
    legal_text,
    copyright_text,
    location_address,
    location_lat,
    location_lng,
    use_site_terms
  } = footerData || {}

  // Fallback to tenant data if no footer data
  const displayName = store_name || tenantData?.name || 'Mi Tienda'
  const displayLogo = tenantData?.logo || tenantData?.logo_url || null
  const displayAddress = address || tenantData?.address || ''
  const displayCity = city || tenantData?.city || ''
  const displayPhone = phone || tenantData?.phone || ''
  const displayEmail = email || tenantData?.email || ''
  const displayPhoneCode = phone_country_code || '+54'
  const fullPhone = displayPhone ? `${displayPhoneCode} ${displayPhone}` : ''
  const fullWhatsApp = whatsapp ? `${displayPhoneCode} ${whatsapp}` : ''
  
  // Use location_address from map picker if available, otherwise build from fields
  const displayLocation = location_address || (displayAddress ? `${displayAddress}${displayCity ? ', ' + displayCity : ''}${country ? ', ' + country : ''}` : '')

  // Get opening hours from tenant data
  const openingHours = tenantData?.opening_hours || []

  // Check if we have social links
  const hasSocialLinks = instagram_url || facebook_url || twitter_url || tiktok_url || youtube_url

  // Format opening hours for display
  const formattedHours = useMemo(() => {
    if (!openingHours || !Array.isArray(openingHours) || openingHours.length === 0) return null
    
    return openingHours
      .filter(h => h.enabled)
      .map(h => ({
        day: h.day,
        hours: `${h.open} - ${h.close}`
      }))
  }, [openingHours])

  // Google Maps URL for directions
  const googleMapsUrl = useMemo(() => {
    // If we have coordinates, use them for more accurate directions
    if (location_lat && location_lng) {
      return `https://www.google.com/maps/dir/?api=1&destination=${location_lat},${location_lng}`
    }
    const locationToUse = location_address || `${displayAddress}, ${displayCity}, ${country || ''}`
    if (!locationToUse.trim() || locationToUse === ', , ') return null
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(locationToUse.trim())}`
  }, [location_address, location_lat, location_lng, displayAddress, displayCity, country])

  // Static map URL using OpenStreetMap
  const staticMapUrl = useMemo(() => {
    if (!location_lat || !location_lng) return null
    // Using OpenStreetMap static map tiles
    const zoom = 15
    return `https://staticmap.openstreetmap.de/staticmap.php?center=${location_lat},${location_lng}&zoom=${zoom}&size=280x120&markers=${location_lat},${location_lng},red-pushpin`
  }, [location_lat, location_lng])

  // Check if we have a map location
  const hasMapLocation = location_lat && location_lng

  // Parse custom links
  const parsedLinks = useMemo(() => {
    if (!custom_links) return []
    if (Array.isArray(custom_links)) return custom_links
    try {
      return JSON.parse(custom_links)
    } catch {
      return []
    }
  }, [custom_links])

  // Dynamic styles from theme
  const footerStyles = useMemo(() => {
    if (!themeData) return {}
    return {
      '--footer-bg': themeData.footer_bg || '#1a1a2e',
      '--footer-text': themeData.footer_text || '#ffffff',
      '--footer-accent': themeData.accent || '#f59e0b'
    }
  }, [themeData])

  return (
    <footer className="storeFooter" style={footerStyles}>
      <div className="storeFooter__container">
        {/* Brand Section */}
        <div className="storeFooter__brand">
          <div className="storeFooter__brandHeader">
            {displayLogo ? (
              <img 
                src={displayLogo} 
                alt={displayName}
                className="storeFooter__logo"
              />
            ) : (
              <div className="storeFooter__logoPlaceholder">
                <Store size={28} />
              </div>
            )}
            <h3 className="storeFooter__title">{displayName}</h3>
          </div>
          {short_description && (
            <p className="storeFooter__description">{short_description}</p>
          )}
          
          {/* Social Links */}
          {show_social && hasSocialLinks && (
            <div className="storeFooter__social">
              {instagram_url && (
                <a href={instagram_url} target="_blank" rel="noopener noreferrer" className="storeFooter__socialLink" title="Instagram">
                  <Instagram size={20} />
                </a>
              )}
              {facebook_url && (
                <a href={facebook_url} target="_blank" rel="noopener noreferrer" className="storeFooter__socialLink" title="Facebook">
                  <Facebook size={20} />
                </a>
              )}
              {twitter_url && (
                <a href={twitter_url} target="_blank" rel="noopener noreferrer" className="storeFooter__socialLink" title="Twitter/X">
                  <Twitter size={20} />
                </a>
              )}
              {tiktok_url && (
                <a href={tiktok_url} target="_blank" rel="noopener noreferrer" className="storeFooter__socialLink" title="TikTok">
                  <TikTokIcon />
                </a>
              )}
              {youtube_url && (
                <a href={youtube_url} target="_blank" rel="noopener noreferrer" className="storeFooter__socialLink" title="YouTube">
                  <Youtube size={20} />
                </a>
              )}
            </div>
          )}
        </div>

        {/* Contact Info */}
        <div className="storeFooter__section">
          <h4 className="storeFooter__sectionTitle">Contacto</h4>
          
          {/* Mini Map */}
          {show_address && hasMapLocation && googleMapsUrl && (
            <a 
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="storeFooter__miniMap"
              title="Cómo llegar"
            >
              <div className="storeFooter__miniMapPlaceholder">
                <div className="storeFooter__miniMapPin">
                  <MapPin size={32} />
                </div>
                <div className="storeFooter__miniMapGrid"></div>
              </div>
              <div className="storeFooter__miniMapOverlay">
                <MapPin size={18} />
                <span>Cómo llegar</span>
              </div>
            </a>
          )}
          
          <ul className="storeFooter__list">
            {show_address && displayLocation && !hasMapLocation && (
              <li className="storeFooter__item">
                <MapPin size={16} />
                {googleMapsUrl ? (
                  <a 
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="storeFooter__addressLink"
                    title="Ver en Google Maps"
                  >
                    {displayLocation}
                  </a>
                ) : (
                  <span>{displayLocation}</span>
                )}
              </li>
            )}
            {show_phone && fullPhone && (
              <li className="storeFooter__item">
                <Phone size={16} />
                <a href={`tel:${fullPhone.replace(/\s/g, '')}`}>{fullPhone}</a>
              </li>
            )}
            {whatsapp && (
              <li className="storeFooter__item">
                <WhatsAppIcon size={16} />
                <a 
                  href={`https://wa.me/${displayPhoneCode.replace('+', '')}${whatsapp.replace(/\D/g, '')}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  {fullWhatsApp}
                </a>
              </li>
            )}
            {show_email && displayEmail && (
              <li className="storeFooter__item">
                <Mail size={16} />
                <a href={`mailto:${displayEmail}`}>{displayEmail}</a>
              </li>
            )}
          </ul>
        </div>

        {/* Business Hours - Collapsible */}
        {show_hours && formattedHours && formattedHours.length > 0 && (
          <div className="storeFooter__section storeFooter__section--hours">
            <button 
              className="storeFooter__hoursToggle"
              onClick={() => setHoursExpanded(!hoursExpanded)}
              type="button"
            >
              <h4 className="storeFooter__sectionTitle">
                <Clock size={16} />
                Horarios
              </h4>
              {hoursExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {hoursExpanded && (
              <ul className="storeFooter__hours">
                {formattedHours.map(({ day, hours }) => (
                  <li key={day} className="storeFooter__hourItem">
                    <span className="storeFooter__day">{day}</span>
                    <span className="storeFooter__time">{hours}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Payment Methods */}
        {show_payment_methods && (accepts_cash || accepts_card || accepts_mercadopago) && (
          <div className="storeFooter__section">
            <h4 className="storeFooter__sectionTitle">Métodos de pago</h4>
            <div className="storeFooter__payments">
              {accepts_cash && (
                <div className="storeFooter__paymentMethod" title="Efectivo">
                  <Banknote size={20} />
                  <span>Efectivo</span>
                </div>
              )}
              {accepts_card && (
                <div className="storeFooter__paymentMethod" title="Tarjeta">
                  <CreditCard size={20} />
                  <span>Tarjeta</span>
                </div>
              )}
              {accepts_mercadopago && (
                <div className="storeFooter__paymentMethod" title="MercadoPago">
                  <Smartphone size={20} />
                  <span>MercadoPago</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Custom Links */}
        {(parsedLinks.length > 0 || use_site_terms) && (
          <div className="storeFooter__section">
            <h4 className="storeFooter__sectionTitle">Enlaces</h4>
            <ul className="storeFooter__links">
              {use_site_terms && storeSlug && (
                <li>
                  <Link 
                    to={`/tienda/${storeSlug}/terminos`}
                    className="storeFooter__customLink"
                  >
                    <FileText size={14} />
                    Términos y condiciones
                  </Link>
                </li>
              )}
              {parsedLinks.map((link, index) => (
                <li key={index}>
                  <a 
                    href={link.url} 
                    target={link.external ? '_blank' : '_self'}
                    rel={link.external ? 'noopener noreferrer' : undefined}
                    className="storeFooter__customLink"
                  >
                    {link.label}
                    {link.external && <ExternalLink size={12} />}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="storeFooter__bottom">
        <div className="storeFooter__bottomContainer">
          {legal_text && (
            <p className="storeFooter__legal">{legal_text}</p>
          )}
          <p className="storeFooter__copyright">
            {copyright_text || `© ${new Date().getFullYear()} ${displayName}. Todos los derechos reservados.`}
          </p>
          <p className="storeFooter__powered">
            Creado con <a href="/" target="_blank" rel="noopener noreferrer">Pyme Center</a>
          </p>
        </div>
      </div>
    </footer>
  )
}
