import { Outlet, useLocation } from 'react-router-dom'
import './AppLayout.css'
import Header from '../Header/Header'
import Footer from '../Footer/Footer'
import ThemeApplier from '../../theme/ThemeApplier'
import ConfirmModal from '../../ui/ConfirmModal/ConfirmModal'
import { useAppDispatch, useAppSelector } from '../../../app/hooks'
import { clearBannedInfo, clearWelcomeInfo, selectAuth, signOut } from '../../../features/auth/authSlice'

export default function AppLayout() {
  const dispatch = useAppDispatch()
  const auth = useAppSelector(selectAuth)
  const location = useLocation()

  const user = auth.user
  const tenantId = user?.tenantId || null
  const accountCancelled = user?.accountStatus === 'cancelled'
  const bannedInfo = auth.bannedInfo
  const showBannedModal = Boolean(bannedInfo || accountCancelled)
  const welcomeInfo = auth.welcomeInfo
  const showWelcomeModal = auth.status === 'authenticated' && !showBannedModal && Boolean(welcomeInfo)

  // Show global header: always for logged-in users, hide only for public store visitors
  const isStorePage = location.pathname.startsWith('/store/')
  const isLoggedIn = auth.status === 'authenticated' && user
  const showGlobalHeader = isLoggedIn || !isStorePage

  const bannedMessage = (() => {
    if (bannedInfo?.message) return bannedInfo.message
    if (accountCancelled) return 'Tu cuenta está baneada por no respetar nuestros términos y condiciones.'
    return ''
  })()

  const bannedEmail = bannedInfo?.email || user?.email || null

  return (
    <div className="app">
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
      <ConfirmModal
        open={showWelcomeModal}
        title="¡Bienvenido!"
        message={welcomeInfo?.message || ''}
        confirmLabel="Explorar"
        confirmVariant="primary"
        cancelLabel={null}
        onConfirm={() => dispatch(clearWelcomeInfo())}
        onCancel={() => dispatch(clearWelcomeInfo())}
      />
      <ThemeApplier tenantId={tenantId} key={location.pathname} />
      {showGlobalHeader && <Header />}
      <main className={`app__main ${isStorePage ? 'app__main--store' : 'container'}`}>
        <Outlet />
      </main>
      {showGlobalHeader && <Footer />}
    </div>
  )
}
