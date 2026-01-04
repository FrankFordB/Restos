import { Outlet, useLocation, useParams } from 'react-router-dom'
import './AppLayout.css'
import Header from '../Header/Header'
import Footer from '../Footer/Footer'
import ThemeApplier from '../../theme/ThemeApplier'
import ConfirmModal from '../../ui/ConfirmModal/ConfirmModal'
import LoginWelcomeModal from '../../ui/LoginWelcomeModal/LoginWelcomeModal'
import { useAppDispatch, useAppSelector } from '../../../app/hooks'
import { clearBannedInfo, clearWelcomeInfo, selectAuth, signOut } from '../../../features/auth/authSlice'
import { selectTenants } from '../../../features/tenants/tenantsSlice'
import { DashboardProvider, useDashboard } from '../../../contexts/DashboardContext'

function AppLayoutContent() {
  const dispatch = useAppDispatch()
  const auth = useAppSelector(selectAuth)
  const tenants = useAppSelector(selectTenants)
  const location = useLocation()
  const dashboard = useDashboard()

  const user = auth.user
  const tenantId = user?.tenantId || null
  const accountCancelled = user?.accountStatus === 'cancelled'
  const bannedInfo = auth.bannedInfo
  const showBannedModal = Boolean(bannedInfo || accountCancelled)
  const welcomeInfo = auth.welcomeInfo
  const showWelcomeModal = auth.status === 'authenticated' && !showBannedModal && Boolean(welcomeInfo)

  // Get current tenant slug from user
  const userTenant = tenantId ? tenants.find(t => t.id === tenantId) : null
  const userTenantSlug = userTenant?.slug || null

  // Check if current path is user's own store
  const storeMatch = location.pathname.match(/^\/(?:store|tienda)\/([^\/]+)/)
  const currentStoreSlug = storeMatch ? storeMatch[1] : null
  const isOwnStore = userTenantSlug && currentStoreSlug && userTenantSlug === currentStoreSlug

  // Show global header: always for logged-in users, hide only for public store visitors
  const isStorePage = location.pathname.startsWith('/store/') || location.pathname.startsWith('/tienda/')
  const isLoggedIn = auth.status === 'authenticated' && user
  const showGlobalHeader = isLoggedIn || !isStorePage

  // Detect if we're in a dashboard page with sidebar
  const isDashboardPage = location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/admin')
  
  // Hide main footer for logged-in users in their own store or in dashboard
  // The store has its own StoreFooter component
  const hideMainFooter = (isLoggedIn && isOwnStore) || isDashboardPage || isStorePage

  const bannedMessage = (() => {
    if (bannedInfo?.message) return bannedInfo.message
    if (accountCancelled) return 'Tu cuenta está baneada por no respetar nuestros términos y condiciones.'
    return ''
  })()

  const bannedEmail = bannedInfo?.email || user?.email || null

  return (
    <div className={`app ${isDashboardPage ? 'app--withSidebar' : ''}`}>
      <ConfirmModal
        open={showBannedModal}
        title="Cuenta baneada"
        message={bannedEmail ? `${bannedMessage}
Cuenta: ${bannedEmail}` : bannedMessage}
        confirmLabel={null}
        cancelLabel={null}
        onConfirm={null}
        onCancel={null}
      />
      <LoginWelcomeModal
        open={showWelcomeModal}
        onClose={() => dispatch(clearWelcomeInfo())}
        userName={user?.email}
      />
      <ThemeApplier tenantId={tenantId} key={location.pathname} />
      {showGlobalHeader && <Header onTabChange={dashboard?.changeTab} />}
      <main className={`app__main ${isStorePage ? 'app__main--store' : 'container'}`}>
        <Outlet />
      </main>
      {showGlobalHeader && !hideMainFooter && <Footer />}
    </div>
  )
}

export default function AppLayout() {
  return (
    <DashboardProvider>
      <AppLayoutContent />
    </DashboardProvider>
  )
}
