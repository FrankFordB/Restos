import { useEffect, useMemo, useState } from 'react'
import './DashboardPages.css'
import Card from '../../components/ui/Card/Card'
import Input from '../../components/ui/Input/Input'
import Button from '../../components/ui/Button/Button'
import ThemeManager from '../../components/dashboard/ThemeManager/ThemeManager'
import ProductsManager from '../../components/dashboard/ProductsManager/ProductsManager'
import OrdersManager from '../../components/dashboard/OrdersManager/OrdersManager'
import SubscriptionsAdmin from '../../components/dashboard/SubscriptionsAdmin/SubscriptionsAdmin'
import ConfirmModal from '../../components/ui/ConfirmModal/ConfirmModal'
import {
  adminListProfiles,
  adminListTenants,
  adminSetTenantOwnerAccountStatus,
  adminSetTenantVisibility,
  adminSetTenantTier,
  fetchTenantById,
} from '../../lib/supabaseApi'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { selectAdminManagedTenantId, setAdminManagedTenantId } from '../../features/auth/authSlice'
import { SUBSCRIPTION_TIERS, TIER_LABELS, TIER_COLORS } from '../../shared/subscriptions'

const ITEMS_PER_PAGE = 10

export default function AdminDashboardPage() {
  const dispatch = useAppDispatch()
  const adminManagedTenantId = useAppSelector(selectAdminManagedTenantId)

  const [profiles, setProfiles] = useState([])
  const [tenants, setTenants] = useState([])
  const [loadingTenants, setLoadingTenants] = useState(false)
  const [tenantsError, setTenantsError] = useState(null)
  const [tenantSearch, setTenantSearch] = useState('')
  const [managedTenant, setManagedTenant] = useState(null)
  const [managedTenantLoading, setManagedTenantLoading] = useState(false)
  const [managedTenantError, setManagedTenantError] = useState(null)
  const [savingManagedVisibility, setSavingManagedVisibility] = useState(false)
  const [ownerStatusModal, setOwnerStatusModal] = useState(null)
  const [ownerStatusLoading, setOwnerStatusLoading] = useState(false)

  // Tab navigation for managed tenant
  const [activeTab, setActiveTab] = useState('theme')

  // Filter state
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPremium, setFilterPremium] = useState('all')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)

  // Dropdown state
  const [openDropdown, setOpenDropdown] = useState(null)

  // Tier modal state
  const [tierModal, setTierModal] = useState(null) // { tenantId, tenantName, tier }
  const [tierDays, setTierDays] = useState(30)
  const [tierLoading, setTierLoading] = useState(false)

  const ownerEmailByUserId = useMemo(() => {
    const map = {}
    for (const p of profiles || []) {
      if (!p?.user_id) continue
      map[p.user_id] = {
        email: p.email || null,
        fullName: p.full_name || null,
        role: p.role || null,
        accountStatus: p.account_status || 'active',
      }
    }
    return map
  }, [profiles])

  // Stats calculations
  const stats = useMemo(() => {
    const total = tenants.length
    const publicCount = tenants.filter(t => t.is_public !== false).length
    const premiumCount = tenants.filter(t => t.subscription_tier === 'premium' && t.premium_until && new Date(t.premium_until) > new Date()).length
    const premiumProCount = tenants.filter(t => t.subscription_tier === 'premium_pro' && t.premium_until && new Date(t.premium_until) > new Date()).length
    const bannedOwners = profiles.filter(p => p.account_status === 'cancelled').length
    return { total, publicCount, premiumCount, premiumProCount, bannedOwners }
  }, [tenants, profiles])

  // Filtered tenants
  const filteredTenants = useMemo(() => {
    return tenants.filter((t) => {
      const q = tenantSearch.trim().toLowerCase()
      if (q) {
        const matchesSearch = 
          String(t?.name || '').toLowerCase().includes(q) ||
          String(t?.slug || '').toLowerCase().includes(q) ||
          String(t?.id || '').toLowerCase().includes(q)
        if (!matchesSearch) return false
      }

      if (filterStatus === 'public' && t.is_public === false) return false
      if (filterStatus === 'hidden' && t.is_public !== false) return false

      const hasPremium = t.premium_until && new Date(t.premium_until) > new Date()
      const tier = t.subscription_tier || 'free'
      if (filterPremium === 'premium' && tier !== 'premium') return false
      if (filterPremium === 'premium_pro' && tier !== 'premium_pro') return false
      if (filterPremium === 'free' && hasPremium) return false

      return true
    })
  }, [tenants, tenantSearch, filterStatus, filterPremium])

  // Pagination calculations
  const totalPages = Math.ceil(filteredTenants.length / ITEMS_PER_PAGE)
  const paginatedTenants = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredTenants.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredTenants, currentPage])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [tenantSearch, filterStatus, filterPremium])

  async function refreshTenants() {
    if (!isSupabaseConfigured) return
    setLoadingTenants(true)
    setTenantsError(null)
    try {
      const data = await adminListTenants()
      setTenants(data || [])
    } catch (e) {
      setTenantsError(e?.message || 'No se pudieron cargar los restaurantes')
    } finally {
      setLoadingTenants(false)
    }
  }

  async function refresh() {
    if (!isSupabaseConfigured) return
    try {
      const data = await adminListProfiles()
      setProfiles(data || [])
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    refresh()
    refreshTenants()
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured || !adminManagedTenantId) {
      setManagedTenant(null)
      setManagedTenantError(null)
      setManagedTenantLoading(false)
      return
    }

    let cancelled = false
    async function loadManagedTenant() {
      setManagedTenantLoading(true)
      setManagedTenantError(null)
      try {
        const tenant = await fetchTenantById(adminManagedTenantId)
        if (!cancelled) setManagedTenant(tenant)
      } catch (e) {
        if (!cancelled) setManagedTenantError(e?.message || 'No se pudo cargar')
      } finally {
        if (!cancelled) setManagedTenantLoading(false)
      }
    }
    loadManagedTenant()
    return () => { cancelled = true }
  }, [adminManagedTenantId])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = () => setOpenDropdown(null)
    if (openDropdown) {
      document.addEventListener('click', handleClick)
      return () => document.removeEventListener('click', handleClick)
    }
  }, [openDropdown])

  // Handle tier assignment
  async function handleAssignTier() {
    if (!tierModal || tierLoading) return
    setTierLoading(true)
    setTenantsError(null)
    try {
      console.log('Asignando tier:', { 
        tenantId: tierModal.tenantId, 
        tier: tierModal.tier, 
        days: Number(tierDays) 
      })
      const result = await adminSetTenantTier({ 
        tenantId: tierModal.tenantId, 
        tier: tierModal.tier, 
        days: Number(tierDays) 
      })
      console.log('Resultado:', result)
      await refreshTenants()
      setTierModal(null)
      setTierDays(30)
    } catch (e) {
      console.error('Error asignando tier:', e)
      setTenantsError(e?.message || 'Error al asignar tier')
    } finally {
      setTierLoading(false)
    }
  }

  // ========== MANAGED TENANT VIEW ==========
  if (adminManagedTenantId) {
    return (
      <div className="dash">
        <header className="dash__header">
          <div className="dash__header-top">
            <div>
              <h1>Gestionando Restaurante</h1>
              <p className="muted">
                {managedTenant?.name || 'Cargando...'} 
                {managedTenant?.slug && <span className="admin__slug"> · /{managedTenant.slug}</span>}
              </p>
            </div>
            <Button variant="secondary" onClick={() => dispatch(setAdminManagedTenantId(null))}>
              ← Volver al Panel
            </Button>
          </div>
        </header>

        {managedTenantLoading && <p className="muted">Cargando datos del restaurante...</p>}
        {managedTenantError && <div className="admin__error">{managedTenantError}</div>}

        {managedTenant && (
          <>
            <div className="admin__managedInfo">
              <div className="admin__infoItem">
                <span className="admin__infoLabel">ID</span>
                <code className="admin__infoCode">{adminManagedTenantId.slice(0, 8)}...</code>
              </div>
              <div className="admin__infoItem">
                <span className="admin__infoLabel">Estado</span>
                <span className={`admin__badge ${managedTenant.is_public !== false ? 'admin__badge--success' : 'admin__badge--warning'}`}>
                  {managedTenant.is_public !== false ? '🌐 Público' : '🔒 Oculto'}
                </span>
              </div>
              <div className="admin__infoItem">
                <span className="admin__infoLabel">Plan</span>
                <span 
                  className="admin__tierBadge"
                  style={{ '--tier-color': TIER_COLORS[managedTenant.subscription_tier] || TIER_COLORS.free }}
                >
                  {managedTenant.subscription_tier === 'premium_pro' ? '👑' : managedTenant.subscription_tier === 'premium' ? '⭐' : '📦'}
                  {TIER_LABELS[managedTenant.subscription_tier] || 'Free'}
                </span>
              </div>
              <label className="dash__switch">
                <input
                  type="checkbox"
                  checked={managedTenant.is_public !== false}
                  disabled={savingManagedVisibility}
                  onChange={async (e) => {
                    setSavingManagedVisibility(true)
                    try {
                      const updated = await adminSetTenantVisibility({
                        tenantId: adminManagedTenantId,
                        isPublic: e.target.checked,
                      })
                      setManagedTenant(updated)
                    } catch (err) {
                      setManagedTenantError(err?.message || 'Error')
                    } finally {
                      setSavingManagedVisibility(false)
                    }
                  }}
                />
                <span>Visible en Home</span>
              </label>
              <a 
                href={`/store/${managedTenant.slug}`} 
                target="_blank" 
                rel="noreferrer"
                className="admin__link"
              >
                🔗 Ver tienda
              </a>
            </div>

            <nav className="dash__tabs">
              <button 
                className={`dash__tab ${activeTab === 'theme' ? 'active' : ''}`}
                onClick={() => setActiveTab('theme')}
              >
                <span className="tab-icon">🎨</span>
                Tema
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
            </nav>

            {activeTab === 'theme' && (
              <ThemeManager 
                tenantId={adminManagedTenantId} 
                subscriptionTier={managedTenant?.subscription_tier || SUBSCRIPTION_TIERS.FREE}
                isSuperAdmin={true}
              />
            )}
            {activeTab === 'products' && <ProductsManager tenantId={adminManagedTenantId} />}
            {activeTab === 'orders' && <OrdersManager tenantId={adminManagedTenantId} />}
          </>
        )}
      </div>
    )
  }

  // ========== MAIN ADMIN DASHBOARD ==========
  return (
    <div className="dash">
      <header className="dash__header">
        <div className="dash__header-top">
          <div>
            <h1>🛡️ Panel de Super Admin</h1>
            <p className="muted">Gestión centralizada de restaurantes y usuarios</p>
          </div>
          <div className="dash__tier-badge" data-tier="premium_pro">
            <span className="tier-icon">👑</span>
            <span className="tier-name">Super Admin</span>
          </div>
        </div>
      </header>

      {!isSupabaseConfigured && (
        <div className="admin__warning">
          ⚠️ Supabase no está configurado. Configura las variables de entorno.
        </div>
      )}

      {/* Stats Grid */}
      <div className="admin__statsGrid">
        <div className="admin__statCard">
          <div className="admin__statIcon">🏪</div>
          <div className="admin__statInfo">
            <span className="admin__statValue">{stats.total}</span>
            <span className="admin__statLabel">Restaurantes</span>
          </div>
        </div>
        <div className="admin__statCard">
          <div className="admin__statIcon">🌐</div>
          <div className="admin__statInfo">
            <span className="admin__statValue">{stats.publicCount}</span>
            <span className="admin__statLabel">Públicos</span>
          </div>
        </div>
        <div className="admin__statCard admin__statCard--premium">
          <div className="admin__statIcon">⭐</div>
          <div className="admin__statInfo">
            <span className="admin__statValue">{stats.premiumCount}</span>
            <span className="admin__statLabel">Premium</span>
          </div>
        </div>
        <div className="admin__statCard admin__statCard--premiumPro">
          <div className="admin__statIcon">👑</div>
          <div className="admin__statInfo">
            <span className="admin__statValue">{stats.premiumProCount}</span>
            <span className="admin__statLabel">Premium Pro</span>
          </div>
        </div>
        <div className="admin__statCard admin__statCard--danger">
          <div className="admin__statIcon">🚫</div>
          <div className="admin__statInfo">
            <span className="admin__statValue">{stats.bannedOwners}</span>
            <span className="admin__statLabel">Baneados</span>
          </div>
        </div>
      </div>

      {/* Tenants Card */}
      <Card title="🏪 Restaurantes">
        <div className="admin__toolbar">
          <div className="admin__searchBox">
            <Input
              value={tenantSearch}
              onChange={setTenantSearch}
              placeholder="🔍 Buscar por nombre, slug o ID..."
            />
          </div>
          
          <div className="admin__filters">
            <select 
              className="admin__filterSelect"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">📊 Todos</option>
              <option value="public">🌐 Públicos</option>
              <option value="hidden">🔒 Ocultos</option>
            </select>
            
            <select 
              className="admin__filterSelect"
              value={filterPremium}
              onChange={(e) => setFilterPremium(e.target.value)}
            >
              <option value="all">💎 Todos</option>
              <option value="premium">⭐ Premium</option>
              <option value="premium_pro">👑 Premium Pro</option>
              <option value="free">📦 Free</option>
            </select>
            
            <Button size="sm" variant="secondary" onClick={refreshTenants} disabled={loadingTenants}>
              🔄 {loadingTenants ? 'Cargando...' : 'Refrescar'}
            </Button>
          </div>
        </div>

        {tenantsError && <div className="admin__error">{tenantsError}</div>}

        <div className="admin__tenantsCount">
          Mostrando <strong>{paginatedTenants.length}</strong> de <strong>{filteredTenants.length}</strong> restaurantes
          {totalPages > 1 && <span> · Página {currentPage} de {totalPages}</span>}
        </div>

        {/* Tenants Table */}
        <div className="admin__table">
          <div className="admin__tableHeader">
            <div className="admin__tableCol admin__tableCol--name">Restaurante</div>
            <div className="admin__tableCol admin__tableCol--owner">Dueño</div>
            <div className="admin__tableCol admin__tableCol--status">Estado</div>
            <div className="admin__tableCol admin__tableCol--plan">Plan</div>
            <div className="admin__tableCol admin__tableCol--actions">Acciones</div>
          </div>

          <div className="admin__tableBody">
            {paginatedTenants.map((t) => {
              const isPublic = t?.is_public !== false
              const tier = t?.subscription_tier || 'free'
              const hasPremium = t?.premium_until && new Date(t.premium_until) > Date.now()
              const owner = ownerEmailByUserId[t?.owner_user_id] || null
              const ownerIsCancelled = owner?.accountStatus === 'cancelled'
              const isDropdownOpen = openDropdown === t.id

              // Calculate remaining days
              let remainingDays = null
              if (hasPremium && t.premium_until) {
                const diff = new Date(t.premium_until) - new Date()
                remainingDays = Math.ceil(diff / (1000 * 60 * 60 * 24))
              }

              return (
                <div 
                  key={t.id} 
                  className={`admin__tableRow ${ownerIsCancelled ? 'admin__tableRow--banned' : ''}`}
                >
                  <div className="admin__tableCol admin__tableCol--name">
                    <div className="admin__tenantName">{t.name}</div>
                    <div className="admin__tenantSlug">/{t.slug}</div>
                  </div>
                  
                  <div className="admin__tableCol admin__tableCol--owner">
                    <div className="admin__ownerInfo">
                      <span className="admin__ownerName">
                        {owner?.fullName || owner?.email?.split('@')[0] || '—'}
                      </span>
                      {ownerIsCancelled && (
                        <span className="admin__badge admin__badge--danger">🚫</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="admin__tableCol admin__tableCol--status">
                    <span className={`admin__badge ${isPublic ? 'admin__badge--success' : 'admin__badge--warning'}`}>
                      {isPublic ? '🌐' : '🔒'}
                    </span>
                  </div>
                  
                  <div className="admin__tableCol admin__tableCol--plan">
                    <span 
                      className="admin__tierBadge"
                      style={{ '--tier-color': TIER_COLORS[tier] || TIER_COLORS.free }}
                    >
                      {tier === 'premium_pro' ? '👑' : tier === 'premium' ? '⭐' : '📦'}
                      <span className="tier-label">{TIER_LABELS[tier] || 'Free'}</span>
                    </span>
                    {remainingDays !== null && (
                      <span className="admin__daysRemaining">{remainingDays}d</span>
                    )}
                  </div>
                  
                  <div className="admin__tableCol admin__tableCol--actions">
                    <div className="admin__actionBtns">
                      <Button
                        size="sm"
                        onClick={() => {
                          setActiveTab('theme')
                          dispatch(setAdminManagedTenantId(t.id))
                        }}
                      >
                        ✏️
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => window.open(`/store/${t.slug}`, '_blank')}
                      >
                        👁️
                      </Button>
                      
                      <div className="admin__dropdownWrapper">
                        <Button 
                          size="sm" 
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation()
                            setOpenDropdown(isDropdownOpen ? null : t.id)
                          }}
                        >
                          ⋮
                        </Button>
                        
                        {isDropdownOpen && (
                          <div className="admin__dropdownMenu" onClick={(e) => e.stopPropagation()}>
                            <button
                              className="admin__menuItem"
                              onClick={async () => {
                                await adminSetTenantVisibility({ tenantId: t.id, isPublic: !isPublic })
                                await refreshTenants()
                                setOpenDropdown(null)
                              }}
                            >
                              {isPublic ? '🔒 Ocultar' : '🌐 Publicar'}
                            </button>
                            
                            <div className="admin__menuDivider" />
                            
                            <div className="admin__menuLabel">📋 Asignar Plan</div>
                            
                            <button
                              className={`admin__menuItem ${tier === 'free' ? 'admin__menuItem--active' : ''}`}
                              onClick={async () => {
                                await adminSetTenantTier({ tenantId: t.id, tier: 'free' })
                                await refreshTenants()
                                setOpenDropdown(null)
                              }}
                            >
                              📦 Free {tier === 'free' && '✓'}
                            </button>
                            
                            <button
                              className="admin__menuItem"
                              onClick={() => {
                                setTierModal({ tenantId: t.id, tenantName: t.name, tier: 'premium' })
                                setTierDays(30)
                                setOpenDropdown(null)
                              }}
                            >
                              ⭐ Premium... {tier === 'premium' && '✓'}
                            </button>
                            
                            <button
                              className="admin__menuItem"
                              onClick={() => {
                                setTierModal({ tenantId: t.id, tenantName: t.name, tier: 'premium_pro' })
                                setTierDays(30)
                                setOpenDropdown(null)
                              }}
                            >
                              👑 Premium Pro... {tier === 'premium_pro' && '✓'}
                            </button>
                            
                            <div className="admin__menuDivider" />
                            
                            <button
                              className={`admin__menuItem ${ownerIsCancelled ? '' : 'admin__menuItem--danger'}`}
                              onClick={() => {
                                setOwnerStatusModal({
                                  tenant: t,
                                  action: ownerIsCancelled ? 'active' : 'cancelled',
                                  owner,
                                })
                                setOpenDropdown(null)
                              }}
                            >
                              {ownerIsCancelled ? '✅ Reactivar dueño' : '🚫 Banear dueño'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            {paginatedTenants.length === 0 && !loadingTenants && (
              <div className="admin__emptyState">
                <span className="admin__emptyIcon">🔍</span>
                <span className="admin__emptyText">No se encontraron restaurantes</span>
              </div>
            )}

            {loadingTenants && (
              <div className="admin__emptyState">
                <span className="admin__emptyIcon">⏳</span>
                <span className="admin__emptyText">Cargando...</span>
              </div>
            )}
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="admin__pagination">
            <Button
              size="sm"
              variant="secondary"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
            >
              ← Anterior
            </Button>
            
            <div className="admin__paginationInfo">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  className={`admin__pageBtn ${page === currentPage ? 'active' : ''}`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              ))}
            </div>
            
            <Button
              size="sm"
              variant="secondary"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
            >
              Siguiente →
            </Button>
          </div>
        )}
      </Card>

      {/* Subscriptions Admin Section */}
      <Card title="💳 Suscripciones Activas" style={{ marginTop: '1.5rem' }}>
        <SubscriptionsAdmin />
      </Card>

      {/* Tier Assignment Modal */}
      <ConfirmModal
        open={Boolean(tierModal)}
        title={tierModal?.tier === 'premium_pro' ? '👑 Asignar Premium Pro' : '⭐ Asignar Premium'}
        message={
          <div className="admin__tierModalContent">
            <p>
              Asignar <strong>{TIER_LABELS[tierModal?.tier]}</strong> a <strong>{tierModal?.tenantName}</strong>
            </p>
            <div className="admin__tierDaysInput">
              <label>Duración (días):</label>
              <input
                type="number"
                min="1"
                max="365"
                value={tierDays}
                onChange={(e) => setTierDays(Math.max(1, Number(e.target.value) || 1))}
                className="admin__daysInputLarge"
              />
            </div>
            <div className="admin__tierQuickDays">
              <button onClick={() => setTierDays(7)}>7 días</button>
              <button onClick={() => setTierDays(14)}>14 días</button>
              <button onClick={() => setTierDays(30)}>30 días</button>
              <button onClick={() => setTierDays(90)}>90 días</button>
              <button onClick={() => setTierDays(365)}>1 año</button>
            </div>
          </div>
        }
        confirmLabel={`Asignar ${tierDays} días`}
        cancelLabel="Cancelar"
        loading={tierLoading}
        onCancel={() => !tierLoading && setTierModal(null)}
        onConfirm={handleAssignTier}
      />

      <ConfirmModal
        open={Boolean(ownerStatusModal)}
        title={ownerStatusModal?.action === 'cancelled' ? '🚫 Banear dueño' : '✅ Reactivar dueño'}
        message={(() => {
          if (!ownerStatusModal) return ''
          const tenantName = ownerStatusModal.tenant?.name || 'este restaurante'
          const ownerName = ownerStatusModal.owner?.fullName || ownerStatusModal.owner?.email || 'el usuario'
          if (ownerStatusModal.action === 'cancelled') {
            return `¿Seguro que deseas banear a ${ownerName}, dueño de ${tenantName}? Su cuenta quedará cancelada.`
          }
          return `¿Reactivar a ${ownerName}? Recuperará el acceso inmediato.`
        })()}
        confirmLabel={ownerStatusModal?.action === 'cancelled' ? 'Sí, banear' : 'Sí, reactivar'}
        cancelLabel="Cancelar"
        confirmVariant={ownerStatusModal?.action === 'cancelled' ? undefined : 'secondary'}
        loading={ownerStatusLoading}
        onCancel={() => !ownerStatusLoading && setOwnerStatusModal(null)}
        onConfirm={async () => {
          if (!ownerStatusModal || ownerStatusLoading) return
          try {
            setOwnerStatusLoading(true)
            await adminSetTenantOwnerAccountStatus({
              tenantId: ownerStatusModal.tenant.id,
              status: ownerStatusModal.action,
            })
            await Promise.all([refresh(), refreshTenants()])
            setOwnerStatusModal(null)
          } catch (err) {
            setTenantsError(err?.message || 'Error')
          } finally {
            setOwnerStatusLoading(false)
          }
        }}
      />
    </div>
  )
}
