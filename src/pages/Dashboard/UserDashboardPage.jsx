import './DashboardPages.css'
import { useAppSelector } from '../../app/hooks'
import { selectUser } from '../../features/auth/authSlice'
import ProductsManager from '../../components/dashboard/ProductsManager/ProductsManager'
import ThemeManager from '../../components/dashboard/ThemeManager/ThemeManager'
import OrdersManager from '../../components/dashboard/OrdersManager/OrdersManager'

export default function UserDashboardPage() {
  const user = useAppSelector(selectUser)

  if (!user?.tenantId) return <p className="muted">No hay tenant asignado.</p>

  return (
    <div className="dash">
      <header className="dash__header">
        <h1>Dashboard del restaurante</h1>
        <p className="muted">Administra productos, precios y diseño.</p>
      </header>

      <div className="dash__grid">
        <ThemeManager tenantId={user.tenantId} />
        <ProductsManager tenantId={user.tenantId} />
        <OrdersManager tenantId={user.tenantId} />
      </div>
    </div>
  )
}
