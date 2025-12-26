import { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import './Header.css'
import Button from '../../ui/Button/Button'
import PremiumModal from '../../ui/PremiumModal/PremiumModal'
import { useAppDispatch, useAppSelector } from '../../../app/hooks'
import { selectUser, signOut } from '../../../features/auth/authSlice'
import { selectTenants } from '../../../features/tenants/tenantsSlice'
import { ROLES } from '../../../shared/constants'
import { SUBSCRIPTION_TIERS, TIER_LABELS, TIER_COLORS } from '../../../shared/subscriptions'

export default function Header({ sidebarCollapsed = false }) {
  const user = useAppSelector(selectUser)
  const tenants = useAppSelector(selectTenants)
  const dispatch = useAppDispatch()
  const location = useLocation()
  const [showPremiumModal, setShowPremiumModal] = useState(false)

  const isLanding = location.pathname === '/'

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
            Resto Proyect
          </Link>

          <nav className="header__nav">
            <NavLink className={({ isActive }) => (isActive ? 'navlink navlink--active' : 'navlink')} to="/">
              Home
            </NavLink>

            {user ? (
              <>
                <NavLink
                  className={({ isActive }) => (isActive ? 'navlink navlink--active' : 'navlink')}
                  to={storeHref}
                >
                  Tienda
                </NavLink>
                <NavLink
                  className={({ isActive }) => (isActive ? 'navlink navlink--active' : 'navlink')}
                  to={user.role === ROLES.SUPER_ADMIN ? '/admin' : '/dashboard'}
                >
                  Dashboard
                </NavLink>
              </>
            ) : null}

            {/* Premium Badge or Upgrade Button */}
            {user && user.role !== ROLES.SUPER_ADMIN && (
              isPremiumUser ? (
                <button 
                  className="header__tierBadge"
                  style={{ '--tier-color': TIER_COLORS[currentTier] }}
                  onClick={() => setShowPremiumModal(true)}
                >
                  <span className="tier-icon">{currentTier === SUBSCRIPTION_TIERS.PREMIUM_PRO ? '👑' : '⭐'}</span>
                  <span className="tier-name">{TIER_LABELS[currentTier]}</span>
                </button>
              ) : (
                <button 
                  className="header__upgradeCta"
                  onClick={() => setShowPremiumModal(true)}
                >
                  <span className="upgrade-icon">✨</span>
                  <span className="upgrade-text">Hazte Premium</span>
                  <span className="upgrade-arrow">→</span>
                </button>
              )
            )}

            {user ? (
              <>
                <span className="header__user">{user.email}</span>
                <Button variant="secondary" size="sm" onClick={() => dispatch(signOut())}>
                  Salir
                </Button>
              </>
            ) : (
              <>
                <NavLink
                  className={({ isActive }) => (isActive ? 'navlink navlink--active' : 'navlink')}
                  to="/login"
                >
                  Login
                </NavLink>
                <NavLink
                  className={({ isActive }) => (isActive ? 'navlink navlink--active' : 'navlink')}
                  to="/register"
                >
                  Registro
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
      />
    </>
  )
}
