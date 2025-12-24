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
import PageBuilder from '../../components/dashboard/PageBuilder/PageBuilder'
import SubscriptionPlans from '../../components/dashboard/SubscriptionPlans/SubscriptionPlans'
import { createTenant } from '../../features/tenants/tenantsSlice'
import { fetchTenantById, updateTenantVisibility, upsertProfile } from '../../lib/supabaseApi'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import { SUBSCRIPTION_TIERS, TIER_LABELS, TIER_ICONS } from '../../shared/subscriptions'

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
  const [savingVisibility, setSavingVisibility] = useState(false)

  // Tab navigation
  const [activeTab, setActiveTab] = useState('overview')

  const suggestedSlug = useMemo(() => slugify(tenantName), [tenantName])

  // Determine subscription tier (only active if premium_until is in the future)
  const subscriptionTier = useMemo(() => {
    const tier = currentTenant?.subscription_tier || 'free'
    const premiumUntil = currentTenant?.premium_until
    
    // If tier is not free, check if premium is still active
    if (tier !== 'free' && premiumUntil) {
      const isActive = new Date(premiumUntil) > new Date()
      return isActive ? tier : 'free'
    }
    return tier
  }, [currentTenant])

  // Get premium expiration date
  const premiumUntil = currentTenant?.premium_until
  const isPremiumActive = premiumUntil && new Date(premiumUntil) > new Date() && subscriptionTier !== 'free'

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
        <div className="dash__header-top">
          <div>
            <h1>Dashboard del restaurante</h1>
            <p className="muted">Administra productos, diseño y personalización.</p>
          </div>
          <div className="dash__tier-badge" data-tier={subscriptionTier}>
            <span className="tier-icon">{TIER_ICONS[subscriptionTier] || '📦'}</span>
            <span className="tier-name">{TIER_LABELS[subscriptionTier] || 'Free'}</span>
          </div>
        </div>
        {isPremiumActive && premiumUntil && (
          <p className="muted">
            Premium activo hasta <strong>{new Date(premiumUntil).toLocaleDateString()}</strong>
          </p>
        )}
      </header>

      {/* Tab Navigation */}
      <nav className="dash__tabs">
        <button 
          className={`dash__tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <span className="tab-icon">📊</span>
          General
        </button>
        <button 
          className={`dash__tab ${activeTab === 'products' ? 'active' : ''}`}
          onClick={() => setActiveTab('products')}
        >
          <span className="tab-icon">🍔</span>
          Productos
        </button>
        <button 
          className={`dash__tab ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          <span className="tab-icon">📋</span>
          Pedidos
        </button>
        <button 
          className={`dash__tab ${activeTab === 'theme' ? 'active' : ''}`}
          onClick={() => setActiveTab('theme')}
        >
          <span className="tab-icon">🎨</span>
          Tema
        </button>
        <button 
          className={`dash__tab ${activeTab === 'builder' ? 'active' : ''}`}
          onClick={() => setActiveTab('builder')}
        >
          <span className="tab-icon">🧩</span>
          Constructor
          {subscriptionTier === 'free' && <span className="tab-badge">PRO</span>}
        </button>
        <button 
          className={`dash__tab ${activeTab === 'plans' ? 'active' : ''}`}
          onClick={() => setActiveTab('plans')}
        >
          <span className="tab-icon">💎</span>
          Planes
        </button>
      </nav>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {isSupabaseConfigured ? (
            <Card title="Tu tienda pública">
              {loadingTenant ? <p className="muted">Cargando restaurante...</p> : null}
              {tenantLoadError ? <p className="muted">{tenantLoadError}</p> : null}
              {currentTenant?.slug ? (
                <>
                  <p className="muted">
                    Slug: <strong>{currentTenant.slug}</strong>
                  </p>

                  <div className="dash__row">
                    <label className="dash__switch">
                      <input
                        type="checkbox"
                        checked={(currentTenant?.is_public ?? true) !== false}
                        disabled={savingVisibility}
                        onChange={async (e) => {
                          const next = e.target.checked
                          if (!user?.tenantId) return
                          setSavingVisibility(true)
                          setTenantLoadError(null)
                          try {
                            const updated = await updateTenantVisibility({ tenantId: user.tenantId, isPublic: next })
                            setCurrentTenant(updated)
                          } catch (err) {
                            const msg = err?.message ? String(err.message) : 'No se pudo actualizar la visibilidad'
                            setTenantLoadError(msg)
                          } finally {
                            setSavingVisibility(false)
                          }
                        }}
                      />
                      <span>Mostrar mi restaurante en el Home</span>
                    </label>
                    {savingVisibility ? <span className="muted">Guardando...</span> : null}
                  </div>

                  <div className="dash__links">
                    <p className="muted">Links de tu tienda:</p>
                    <a href={`/r/${currentTenant.slug}`} target="_blank" rel="noreferrer" className="dash__link">
                      🏠 /r/{currentTenant.slug}
                    </a>
                    <a href={`/store/${currentTenant.slug}`} target="_blank" rel="noreferrer" className="dash__link">
                      🛒 /store/{currentTenant.slug}
                    </a>
                  </div>

                  <div className="dash__stats-grid">
                    <div className="dash__stat">
                      <span className="stat-value">0</span>
                      <span className="stat-label">Productos</span>
                    </div>
                    <div className="dash__stat">
                      <span className="stat-value">0</span>
                      <span className="stat-label">Pedidos hoy</span>
                    </div>
                    <div className="dash__stat">
                      <span className="stat-value">$0</span>
                      <span className="stat-label">Ventas hoy</span>
                    </div>
                    <div className="dash__stat">
                      <span className="stat-value">0</span>
                      <span className="stat-label">Visitas</span>
                    </div>
                  </div>
                </>
              ) : !loadingTenant && !tenantLoadError ? (
                <p className="muted">No se encontró el slug para este restaurante.</p>
              ) : null}
            </Card>
          ) : null}

          {/* Quick Actions */}
          <Card title="Acciones rápidas">
            <div className="dash__quick-actions">
              <button className="quick-action" onClick={() => setActiveTab('products')}>
                <span className="qa-icon">➕</span>
                <span className="qa-text">Agregar producto</span>
              </button>
              <button className="quick-action" onClick={() => setActiveTab('theme')}>
                <span className="qa-icon">🎨</span>
                <span className="qa-text">Personalizar tema</span>
              </button>
              <button className="quick-action" onClick={() => setActiveTab('orders')}>
                <span className="qa-icon">📋</span>
                <span className="qa-text">Ver pedidos</span>
              </button>
              {subscriptionTier !== 'free' && (
                <button className="quick-action" onClick={() => setActiveTab('builder')}>
                  <span className="qa-icon">🧩</span>
                  <span className="qa-text">Abrir constructor</span>
                </button>
              )}
            </div>
          </Card>
        </>
      )}

      {/* Products Tab */}
      {activeTab === 'products' && (
        <ProductsManager tenantId={user.tenantId} />
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <OrdersManager tenantId={user.tenantId} />
      )}

      {/* Theme Tab */}
      {activeTab === 'theme' && (
        <ThemeManager tenantId={user.tenantId} subscriptionTier={subscriptionTier} />
      )}

      {/* Builder Tab */}
      {activeTab === 'builder' && (
        <PageBuilder tenantId={user.tenantId} subscriptionTier={subscriptionTier} />
      )}

      {/* Plans Tab */}
      {activeTab === 'plans' && (
        <SubscriptionPlans currentTier={subscriptionTier} tenantId={user.tenantId} />
      )}
    </div>
  )
}
