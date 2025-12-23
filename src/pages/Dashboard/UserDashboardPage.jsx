import { useEffect, useMemo, useState } from 'react'
import './DashboardPages.css'
import Card from '../../components/ui/Card/Card'
import Input from '../../components/ui/Input/Input'
import Button from '../../components/ui/Button/Button'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { selectUser } from '../../features/auth/authSlice'
import { setTenantId } from '../../features/auth/authSlice'
import ProductsManager from '../../components/dashboard/ProductsManager/ProductsManager'
import ThemeManager from '../../components/dashboard/ThemeManager/ThemeManager'
import OrdersManager from '../../components/dashboard/OrdersManager/OrdersManager'
import { createTenant } from '../../features/tenants/tenantsSlice'
import { fetchTenantById, upsertProfile } from '../../lib/supabaseApi'
import { isSupabaseConfigured } from '../../lib/supabaseClient'

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

export default function UserDashboardPage() {
  const dispatch = useAppDispatch()
  const user = useAppSelector(selectUser)

  const [tenantName, setTenantName] = useState('')
  const [tenantSlug, setTenantSlug] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const [currentTenant, setCurrentTenant] = useState(null)
  const [loadingTenant, setLoadingTenant] = useState(false)
  const [tenantLoadError, setTenantLoadError] = useState(null)

  const suggestedSlug = useMemo(() => slugify(tenantName), [tenantName])

  useEffect(() => {
    let cancelled = false

    async function loadTenant() {
      if (!isSupabaseConfigured) return
      if (!user?.tenantId) return

      setLoadingTenant(true)
      setTenantLoadError(null)
      try {
        const tenant = await fetchTenantById(user.tenantId)
        if (!cancelled) setCurrentTenant(tenant)
      } catch (e) {
        const msg = e?.message ? String(e.message) : 'No se pudo cargar el restaurante'
        if (!cancelled) setTenantLoadError(msg)
      } finally {
        if (!cancelled) setLoadingTenant(false)
      }
    }

    loadTenant()
    return () => {
      cancelled = true
    }
  }, [user?.tenantId])

  if (!user?.tenantId) {
    return (
      <div className="dash">
        <header className="dash__header">
          <h1>Dashboard del restaurante</h1>
          <p className="muted">Tu usuario no tiene restaurante asignado todavía.</p>
        </header>

        <Card title="Crear y asignar mi restaurante">
          {!isSupabaseConfigured ? (
            <p className="muted">Configura Supabase para guardar datos en la base de datos.</p>
          ) : null}

          <div className="dash__grid" style={{ gridTemplateColumns: '1fr' }}>
            <Input
              label="Nombre del restaurante"
              value={tenantName}
              onChange={setTenantName}
              placeholder="Mi Hamburguesería"
            />
            <Input
              label="Slug (URL)"
              value={tenantSlug}
              onChange={setTenantSlug}
              placeholder={suggestedSlug || 'mi-hamburgueseria'}
            />
            <p className="muted">Se publicará en: /r/&lt;slug&gt; y /store/&lt;slug&gt;</p>

            {error ? <p className="muted">{error}</p> : null}

            <Button
              disabled={saving || !isSupabaseConfigured}
              onClick={async () => {
                setError(null)
                if (!user?.id) {
                  setError('No hay usuario autenticado.')
                  return
                }
                const name = tenantName.trim()
                const slug = (tenantSlug.trim() || suggestedSlug).trim()
                if (!name || !slug) {
                  setError('Nombre y slug son requeridos.')
                  return
                }

                setSaving(true)
                try {
                  const tenant = await dispatch(createTenant({ name, slug, ownerUserId: user.id })).unwrap()
                  if (!tenant?.id) throw new Error('No se pudo crear el tenant')

                  await upsertProfile({ userId: user.id, role: user.role, tenantId: tenant.id })
                  dispatch(setTenantId(tenant.id))
                } catch (e) {
                  const msg = e?.message ? String(e.message) : 'Error creando restaurante'
                  setError(msg)
                } finally {
                  setSaving(false)
                }
              }}
            >
              {saving ? 'Creando...' : 'Crear restaurante'}
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="dash">
      <header className="dash__header">
        <h1>Dashboard del restaurante</h1>
        <p className="muted">Administra productos, precios y diseño.</p>
      </header>

      {isSupabaseConfigured ? (
        <Card title="Tu tienda pública">
          {loadingTenant ? <p className="muted">Cargando restaurante...</p> : null}
          {tenantLoadError ? <p className="muted">{tenantLoadError}</p> : null}
          {currentTenant?.slug ? (
            <>
              <p className="muted">
                Slug: <strong>{currentTenant.slug}</strong>
              </p>
              <p className="muted">Links:</p>
              <p className="muted">/r/{currentTenant.slug}</p>
              <p className="muted">/store/{currentTenant.slug}</p>
            </>
          ) : !loadingTenant && !tenantLoadError ? (
            <p className="muted">No se encontró el slug para este restaurante.</p>
          ) : null}
        </Card>
      ) : null}

      <div className="dash__grid">
        <ThemeManager tenantId={user.tenantId} />
        <ProductsManager tenantId={user.tenantId} />
        <OrdersManager tenantId={user.tenantId} />
      </div>
    </div>
  )
}
