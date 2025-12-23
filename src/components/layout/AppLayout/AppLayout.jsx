import { Outlet, useLocation } from 'react-router-dom'
import './AppLayout.css'
import Header from '../Header/Header'
import Footer from '../Footer/Footer'
import ThemeApplier from '../../theme/ThemeApplier'
import { useAppSelector } from '../../../app/hooks'
import { selectUser } from '../../../features/auth/authSlice'

export default function AppLayout() {
  const user = useAppSelector(selectUser)
  const location = useLocation()

  const tenantId = user?.tenantId || null

  return (
    <div className="app">
      <ThemeApplier tenantId={tenantId} key={location.pathname} />
      <Header />
      <main className="container app__main">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
