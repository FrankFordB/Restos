import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import './TenantHomePage.css'
import Card from '../../components/ui/Card/Card'
import Button from '../../components/ui/Button/Button'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { fetchTenantBySlug, selectTenantBySlug } from '../../features/tenants/tenantsSlice'
import ThemeApplier from '../../components/theme/ThemeApplier'
import { fetchTenantTheme } from '../../features/theme/themeSlice'

export default function TenantHomePage() {
  const { slug } = useParams()
  const dispatch = useAppDispatch()
  const tenant = useAppSelector(selectTenantBySlug(slug))
  const tenantId = tenant?.id

  useEffect(() => {
    if (!slug) return
    dispatch(fetchTenantBySlug(slug))
  }, [dispatch, slug])

  useEffect(() => {
    if (!tenantId) return
    dispatch(fetchTenantTheme(tenantId))
  }, [dispatch, tenantId])

  if (!tenant) {
    return (
      <div className="tenantHome">
        <h1>Restaurante no encontrado</h1>
        <p className="muted">No existe un restaurante con ese slug.</p>
      </div>
    )
  }

  return (
    <div className="tenantHome">
      <ThemeApplier tenantId={tenantId} />

      <header className="tenantHome__header">
        <div>
          <h1 className="tenantHome__title">{tenant.name}</h1>
          <p className="muted">Home pública del restaurante</p>
        </div>

        <div className="tenantHome__actions">
          <Link to={`/store/${tenant.slug}`}>
            <Button>Ver menú</Button>
          </Link>
          <Link to="/">
            <Button variant="secondary">Volver</Button>
          </Link>
        </div>
      </header>

      <Card title="Acceso rápido">
        <div className="tenantHome__quick">
          <div>
            <div className="tenantHome__label">Home</div>
            <div className="tenantHome__value">/r/{tenant.slug}</div>
          </div>
          <div>
            <div className="tenantHome__label">Tienda</div>
            <div className="tenantHome__value">/store/{tenant.slug}</div>
          </div>
        </div>
      </Card>
    </div>
  )
}
