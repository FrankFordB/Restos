import './DashboardPages.css'
import TenantsManager from '../../components/dashboard/TenantsManager/TenantsManager'

export default function AdminDashboardPage() {
  return (
    <div className="dash">
      <header className="dash__header">
        <h1>Admin (super usuario)</h1>
        <p className="muted">Crea y administra restaurantes (tenants). En integración real, aquí irían usuarios, pagos, etc.</p>
      </header>

      <div className="dash__grid">
        <TenantsManager />
      </div>
    </div>
  )
}
