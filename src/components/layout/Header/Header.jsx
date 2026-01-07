import { useState, useRef, useEffect } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import './Header.css'
import Button from '../../ui/Button/Button'
import PremiumModal from '../../ui/PremiumModal/PremiumModal'
import ConfirmModal from '../../ui/ConfirmModal/ConfirmModal'
import { useAppDispatch, useAppSelector } from '../../../app/hooks'
import { selectUser, signOut } from '../../../features/auth/authSlice'
import { selectTenants } from '../../../features/tenants/tenantsSlice'
import { ROLES } from '../../../shared/constants'
import { SUBSCRIPTION_TIERS, TIER_LABELS, TIER_COLORS } from '../../../shared/subscriptions'
import { fetchTenantPauseStatus } from '../../../lib/supabaseApi'
import { isSupabaseConfigured } from '../../../lib/supabaseClient'
import { loadJson } from '../../../shared/storage'
import { Menu, X, Shield } from 'lucide-react'

export default function Header({ sidebarCollapsed = false, onTabChange }) {
  const user = useAppSelector(selectUser)
  const tenants = useAppSelector(selectTenants)
  const dispatch = useAppDispatch()
  const location = useLocation()
  const navigate = useNavigate()
  
  // Check if we're in dashboard context (onTabChange provided)
  const isInDashboard = location.pathname === '/dashboard' || location.pathname === '/admin'
  
  // Handler for menu items that can switch tabs
  const handleMenuTabClick = (tabId) => {
    setShowUserMenu(false)
    if (isInDashboard && onTabChange) {
      onTabChange(tabId)
    } else {
      navigate(`/dashboard?tab=${tabId}`)
    }
  }
  const [showPremiumModal, setShowPremiumModal] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const menuRef = useRef(null)
  const mobileMenuRef = useRef(null)

  const isLanding = location.pathname === '/'

  // Cerrar menú al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowUserMenu(false)
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target) && !event.target.closest('.header__mobileToggle')) {
        setShowMobileMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Cargar estado de pausa del tenant
  useEffect(() => {
    const loadPauseStatus = async () => {
      if (!user?.tenantId) return
      
      try {
        if (isSupabaseConfigured) {
          const status = await fetchTenantPauseStatus(user.tenantId)
          setIsPaused(status.isPaused)
        } else {
          // Fallback a localStorage
          const cached = loadJson(`pauseStatus.${user.tenantId}`, { isPaused: false })
          setIsPaused(cached.isPaused)
        }
      } catch (err) {
        console.error('Error loading pause status:', err)
      }
    }
    
    loadPauseStatus()
    // Recargar cada 30 segundos para mantener sincronizado
    const interval = setInterval(loadPauseStatus, 30000)
    
    // Escuchar evento de cambio de estado de pausa (desde OrdersManager)
    const handlePauseChange = (e) => {
      if (e.detail?.tenantId === user?.tenantId) {
        setIsPaused(e.detail.isPaused)
      }
    }
    window.addEventListener('storePauseChange', handlePauseChange)
    
    return () => {
      clearInterval(interval)
      window.removeEventListener('storePauseChange', handlePauseChange)
    }
  }, [user?.tenantId])

  const tenantSlug = user?.tenantId ? tenants.find((t) => t.id === user.tenantId)?.slug : null
  const storeHref = tenantSlug ? `/store/${tenantSlug}` : '/store/demo-burgers'

  // Obtener el tier actual del tenant del usuario
  const currentTenant = user?.tenantId ? tenants.find((t) => t.id === user.tenantId) : null
  const currentTier = (() => {
    const tier = currentTenant?.subscription_tier || SUBSCRIPTION_TIERS.FREE
    const premiumUntil = currentTenant?.premium_until
    
    if (tier !== SUBSCRIPTION_TIERS.FREE && premiumUntil) {
      try {
        const expiryDate = new Date(premiumUntil)
        const now = new Date()
        if (!isNaN(expiryDate.getTime()) && expiryDate > now) {
          return tier
        }
      } catch (e) {
        console.warn('Error calculando premium_until:', e)
      }
    }
    return SUBSCRIPTION_TIERS.FREE
  })()
  
  const isPremiumUser = currentTier !== SUBSCRIPTION_TIERS.FREE

  return (
    <>
      <header className={`header app__header ${sidebarCollapsed ? 'header--sidebarCollapsed' : ''}`}>
        <div className="container header__inner">
          <Link className="header__brand" to="/">
FrankFood
          </Link>

          {/* Store Status Indicator - Solo para admins con tenant */}
          {user && user.tenantId && user.role !== ROLES.SUPER_ADMIN && (
            <div className={`header__storeStatus ${isPaused ? 'header__storeStatus--paused' : 'header__storeStatus--active'}`}>
              <span className="header__storeStatusDot"></span>
              <span className="header__storeStatusText">
                {isPaused ? 'Tienda pausada' : 'Tienda activa'}
              </span>
            </div>
          )}

          {/* Mobile Toggle Button */}
          <button 
            className="header__mobileToggle"
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            aria-label="Toggle menu"
          >
            {showMobileMenu ? <X size={22} /> : <Menu size={22} />}
          </button>

          {/* Mobile Menu Overlay */}
          {showMobileMenu && (
            <div className="header__mobileOverlay" onClick={() => setShowMobileMenu(false)} />
          )}

          {/* Navigation - Desktop & Mobile */}
          <nav className={`header__nav ${showMobileMenu ? 'header__nav--open' : ''}`} ref={mobileMenuRef}>
            {/* Close button inside mobile menu */}
            <button 
              className="header__mobileClose"
              onClick={() => setShowMobileMenu(false)}
            >
              <X size={24} />
            </button>

            <NavLink 
              className={({ isActive }) => (isActive ? 'navlink navlink--active' : 'navlink')} 
              to="/"
              onClick={() => setShowMobileMenu(false)}
            >
              Home
            </NavLink>

            {user ? (
              <>
                <NavLink
                  className={({ isActive }) => (isActive ? 'navlink navlink--active' : 'navlink')}
                  to={storeHref}
                  onClick={() => setShowMobileMenu(false)}
                >
                  Tienda
                </NavLink>
                <NavLink
                  className={({ isActive }) => (isActive ? 'navlink navlink--active' : 'navlink')}
                  to={user.role === ROLES.SUPER_ADMIN ? '/admin' : '/dashboard'}
                  onClick={() => setShowMobileMenu(false)}
                >
                  Dashboard
                </NavLink>
                
                {/* Super Admin Exclusive Button */}
                {user.role === ROLES.SUPER_ADMIN && (
                  <NavLink
                    className="header__superAdminBtn"
                    to="/admin"
                    onClick={() => setShowMobileMenu(false)}
                  >
                    <Shield size={16} />
                    <span>Panel Admin</span>
                  </NavLink>
                )}
              </>
            ) : null}

            {/* Premium Badge - solo para usuarios premium */}
            {user && user.role !== ROLES.SUPER_ADMIN && isPremiumUser && (
              <button 
                className="header__tierBadge"
                style={{ '--tier-color': TIER_COLORS[currentTier] }}
                onClick={() => { 
                  handleMenuTabClick('plans')
                  setShowMobileMenu(false) 
                }}
                title="Ver mi plan"
              >
                <span className="tier-icon">{currentTier === SUBSCRIPTION_TIERS.PREMIUM_PRO ? '👑' : '⭐'}</span>
                <span className="tier-name">{TIER_LABELS[currentTier]}</span>
              </button>
            )}

            {user ? (
              <>
                <div className="header__userMenu" ref={menuRef}>
                  <button 
                    className="header__userMenuTrigger"
                    onClick={() => setShowUserMenu(!showUserMenu)}
                  >
                    {currentTenant?.logo ? (
                      <img 
                        src={currentTenant.logo} 
                        alt={currentTenant.name || 'Logo'} 
                        className="header__userMenuLogo"
                      />
                    ) : (
                      <span className="header__userMenuDefaultLogo">🍔</span>
                    )}
                    <span className="header__userMenuEmail">{user.email}</span>
                    <span className={`header__userMenuArrow ${showUserMenu ? 'open' : ''}`}>▼</span>
                  </button>

                  {showUserMenu && (
                    <div className="header__userMenuDropdown">
                      <div className="header__userMenuHeader">
                        {currentTenant?.logo ? (
                          <img 
                            src={currentTenant.logo} 
                            alt={currentTenant.name || 'Logo'} 
                            className="header__userMenuHeaderLogo"
                          />
                        ) : (
                          <span className="header__userMenuHeaderDefaultLogo">🍔</span>
                        )}
                        <div className="header__userMenuHeaderInfo">
                          <span className="header__userMenuHeaderName">{currentTenant?.name || 'My Burger'}</span>
                          <span className="header__userMenuHeaderEmail">{user.email}</span>
                          <span className="header__userMenuHeaderRole">
                            {isPremiumUser ? TIER_LABELS[currentTier] : 'Free'} - {user.role === ROLES.SUPER_ADMIN ? 'Super Admin' : 'Admin'}
                          </span>
                        </div>
                      </div>

                      <div className="header__userMenuDivider"></div>

                      <div className="header__userMenuSection">
                        <button className="header__userMenuItem" onClick={() => handleMenuTabClick('account')}>
                          <span className="header__userMenuItemIcon">👤</span>
                          Mi cuenta
                        </button>
                        <button className="header__userMenuItem header__userMenuItem--plan" onClick={() => { setShowUserMenu(false); setShowPremiumModal(true); }}>
                          <span className="header__userMenuItemIcon">{isPremiumUser ? (currentTier === SUBSCRIPTION_TIERS.PREMIUM_PRO ? '👑' : '⭐') : '📋'}</span>
                          <span className="header__userMenuItemContent">
                            Mi Plan
                            <span className={`header__userMenuItemPlanBadge ${isPremiumUser ? 'premium' : 'free'}`}>
                              {isPremiumUser ? TIER_LABELS[currentTier] : 'Free'}
                            </span>
                          </span>
                        </button>
                        <button className="header__userMenuItem" onClick={() => handleMenuTabClick('account')}>
                          <span className="header__userMenuItemIcon">💳</span>
                          Método de pago
                        </button>
                        <button className="header__userMenuItem" onClick={() => handleMenuTabClick('invoices')}>
                          <span className="header__userMenuItemIcon">📄</span>
                          Facturas
                        </button>
                      </div>

                      <div className="header__userMenuDivider"></div>

                      <div className="header__userMenuSection">
                        {!isPremiumUser && (
                          <button className="header__userMenuItem header__userMenuItem--highlight" onClick={() => { setShowUserMenu(false); setShowPremiumModal(true); }}>
                            <span className="header__userMenuItemIcon">✨</span>
                            Hazte Premium
                          </button>
                        )}
                        {isPremiumUser && currentTier !== SUBSCRIPTION_TIERS.PREMIUM_PRO && (
                          <button className="header__userMenuItem header__userMenuItem--highlight" onClick={() => { setShowUserMenu(false); setShowPremiumModal(true); }}>
                            <span className="header__userMenuItemIcon">👑</span>
                            Actualiza a Premium Pro
                          </button>
                        )}
                      </div>

                      <div className="header__userMenuDivider"></div>

                      <div className="header__userMenuSection">
                        <button className="header__userMenuItem" onClick={() => { setShowUserMenu(false); }}>
                          <span className="header__userMenuItemIcon">💻</span>
                          Descargar App de escritorio
                        </button>
                        <button className="header__userMenuItem" onClick={() => { setShowUserMenu(false); }}>
                          <span className="header__userMenuItemIcon">🎧</span>
                          Soporte
                        </button>
                        <button className="header__userMenuItem" onClick={() => { setShowUserMenu(false); }}>
                          <span className="header__userMenuItemIcon">💡</span>
                          Sugerir una idea
                        </button>
                        <button className="header__userMenuItem" onClick={() => { setShowUserMenu(false); }}>
                          <span className="header__userMenuItemIcon">📜</span>
                          Términos y condiciones
                        </button>
                      </div>

                      <div className="header__userMenuDivider"></div>

                      <div className="header__userMenuSection">
                        <button 
                          className="header__userMenuItem header__userMenuItem--logout"
                          onClick={() => { setShowUserMenu(false); setShowLogoutModal(true); }}
                        >
                          <span className="header__userMenuItemIcon">🚪</span>
                          Cerrar sesión
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <NavLink
                  className={({ isActive }) => (isActive ? 'navlink navlink--active' : 'navlink')}
                  to="/login"
                  onClick={() => setShowMobileMenu(false)}
                >
                  Iniciar sesión
                </NavLink>
                <NavLink
                  className={({ isActive }) => (isActive ? 'navlink navlink--active header__registerBtn' : 'navlink header__registerBtn')}
                  to="/register"
                  onClick={() => setShowMobileMenu(false)}
                >
                  Crear cuenta
                </NavLink>
              </>
            )}
          </nav>
        </div>
      </header>

      <PremiumModal 
        open={showPremiumModal} 
        onClose={() => setShowPremiumModal(false)}
        currentTier={currentTier}
        tenantId={user?.tenantId}
        tenantName={currentTenant?.name}
        userEmail={user?.email}
        premiumUntil={currentTenant?.premium_until}
      />

      <ConfirmModal
        open={showLogoutModal}
        title="Cerrar sesión"
        message="¿Estás seguro de que deseas cerrar tu sesión?"
        confirmLabel="Cerrar sesión"
        cancelLabel="Cancelar"
        confirmVariant="danger"
        onConfirm={() => {
          setShowLogoutModal(false)
          dispatch(signOut())
        }}
        onCancel={() => setShowLogoutModal(false)}
      />
    </>
  )
}
