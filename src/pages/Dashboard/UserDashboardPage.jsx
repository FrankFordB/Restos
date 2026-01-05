import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import './DashboardPages.css'
import Card from '../../components/ui/Card/Card'
import Input from '../../components/ui/Input/Input'
import Button from '../../components/ui/Button/Button'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { selectUser } from '../../features/auth/authSlice'
import { setTenantId, setUserRole } from '../../features/auth/authSlice'
import ProductsManager from '../../components/dashboard/ProductsManager/ProductsManager'
import OrdersManager from '../../components/dashboard/OrdersManager/OrdersManager'
import ExtrasManager from '../../components/dashboard/ExtrasManager/ExtrasManager'
import SalesStats from '../../components/dashboard/SalesStats/SalesStats'
import MobilePreviewEditor from '../../components/dashboard/MobilePreviewEditor/MobilePreviewEditor'
import MercadoPagoConfig from '../../components/dashboard/MercadoPagoConfig/MercadoPagoConfig'
import SubscriptionCheckout from '../../components/dashboard/SubscriptionCheckout/SubscriptionCheckout'
import SubscriptionStatus from '../../components/dashboard/SubscriptionStatus/SubscriptionStatus'
import OrderLimitWarningModal from '../../components/dashboard/OrderLimitWarningModal/OrderLimitWarningModal'
import Sidebar from '../../components/dashboard/Sidebar/Sidebar'
import AccountSection from './AccountSection'
import StoreEditor from './StoreEditor'
import { createTenant } from '../../features/tenants/tenantsSlice'
import { selectOrdersForTenant, updateOrder, deleteOrder, fetchOrdersForTenant } from '../../features/orders/ordersSlice'
import { selectProductsForTenant, fetchProductsForTenant } from '../../features/products/productsSlice'
import { fetchTenantById, updateTenantVisibility, upsertProfile, generateUniqueSlug, fetchTenantSoundConfig, fetchOrderLimitsStatus, subscribeToOrderLimits, checkAndFixSubscriptionExpiration } from '../../lib/supabaseApi'
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient'
import { loadJson } from '../../shared/storage'
import { SUBSCRIPTION_TIERS, TIER_LABELS, TIER_ICONS, getSubscriptionStatus, ORDER_LIMITS } from '../../shared/subscriptions'
import { ROLES } from '../../shared/constants'
import { useDashboard } from '../../contexts/DashboardContext'
import { 
  QrCode, 
  Copy, 
  Check, 
  TrendingUp, 
  ShoppingBag, 
  DollarSign,
  Users,
  Package,
  ChefHat,
  Settings,
  AlertCircle,
  Download,
  X,
  Clock,
  User,
  Truck,
  UtensilsCrossed,
  Home,
  Bell,
  Volume2,
} from 'lucide-react'

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
  const location = useLocation()
  const dashboard = useDashboard()

  const [tenantName, setTenantName] = useState('')
  const [tenantSlug, setTenantSlug] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const [currentTenant, setCurrentTenant] = useState(null)
  const [_loadingTenant, setLoadingTenant] = useState(false)
  const [_tenantLoadError, setTenantLoadError] = useState(null)
  const [savingVisibility, setSavingVisibility] = useState(false)

  // Tab navigation - use context if available, otherwise local state
  const activeTab = dashboard?.activeTab || 'overview'
  const setActiveTab = dashboard?.setActiveTab || (() => {})
  
  // Solo sincronizar desde URL al montar o cuando cambia location.search
  // (no incluir activeTab en dependencias para evitar loops)
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const tabFromUrl = params.get('tab')
    if (tabFromUrl) {
      setActiveTab(tabFromUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search])
  
  // Sidebar collapsed state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Sincronizar clase de sidebar colapsado con el documento para que el header se adapte
  useEffect(() => {
    const appElement = document.querySelector('.app')
    if (appElement) {
      if (sidebarCollapsed) {
        appElement.classList.add('app--sidebarCollapsed')
      } else {
        appElement.classList.remove('app--sidebarCollapsed')
      }
    }
    return () => {
      // Limpiar al desmontar
      const el = document.querySelector('.app')
      if (el) el.classList.remove('app--sidebarCollapsed')
    }
  }, [sidebarCollapsed])

  const suggestedSlug = useMemo(() => slugify(tenantName), [tenantName])

  // Determine subscription tier (only active if premium_until is in the future)
  const subscriptionTier = useMemo(() => {
    if (!currentTenant) return SUBSCRIPTION_TIERS.FREE
    
    const tier = currentTenant.subscription_tier || SUBSCRIPTION_TIERS.FREE
    const premiumUntil = currentTenant.premium_until
    
    // If tier is not free, check if premium is still active
    if (tier !== SUBSCRIPTION_TIERS.FREE && premiumUntil) {
      try {
        const expiryDate = new Date(premiumUntil)
        const now = new Date()
        // Si la fecha es válida y aún no ha expirado, devolver el tier
        if (!isNaN(expiryDate.getTime()) && expiryDate > now) {
          return tier
        }
      } catch (e) {
        console.warn('Error calculando premium_until:', e)
      }
    }
    return SUBSCRIPTION_TIERS.FREE
  }, [currentTenant])

  // Get premium expiration date
  const premiumUntil = currentTenant?.premium_until
  const _isPremiumActive = premiumUntil && new Date(premiumUntil) > new Date() && subscriptionTier !== 'free'

  // Copied state for links - debe estar antes de cualquier return condicional
  const [copiedLink, setCopiedLink] = useState(null)
  
  // Modal de pedidos pendientes
  const [showPendingModal, setShowPendingModal] = useState(false)

  // Obtener pedidos para contar los pendientes
  const orders = useAppSelector(selectOrdersForTenant(user?.tenantId))
  const pendingOrdersCount = useMemo(() => {
    return orders.filter(o => o.status === 'pending').length
  }, [orders])
  const pendingOrders = useMemo(() => {
    return orders.filter(o => o.status === 'pending')
  }, [orders])

  // Obtener productos
  const products = useAppSelector(selectProductsForTenant(user?.tenantId))
  const productsCount = products?.length || 0

  // ========== NOTIFICACIONES GLOBALES DE NUEVOS PEDIDOS ==========
  const audioRef = useRef(null)
  const alertAudioRef = useRef(null) // Sonido de alerta para límite de pedidos
  const [globalNewOrdersCount, setGlobalNewOrdersCount] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(true) // Toggle local de sonido
  const [soundConfig, setSoundConfig] = useState({
    enabled: true,
    repeatCount: 3,
    delayMs: 1500,
  })
  
  // ========== LÍMITES DE PEDIDOS ==========
  const [orderLimitsStatus, setOrderLimitsStatus] = useState({
    limit: null,
    remaining: null,
    isUnlimited: true,
    canAcceptOrders: true,
    resetDate: null,
    tier: 'free',
  })
  const [showOrderLimitModal, setShowOrderLimitModal] = useState(false)
  const prevOrdersRemainingRef = useRef(null) // Para detectar cuando llega a 0

  // Cargar configuración de sonido
  useEffect(() => {
    async function loadSoundConfig() {
      if (!user?.tenantId) return
      
      if (isSupabaseConfigured) {
        try {
          const config = await fetchTenantSoundConfig(user.tenantId)
          setSoundConfig(config)
          setSoundEnabled(config.enabled)
        } catch (err) {
          console.error('Error loading sound config:', err)
          const saved = loadJson(`soundConfig.${user.tenantId}`, null)
          if (saved) {
            setSoundConfig(saved)
            setSoundEnabled(saved.enabled !== false)
          }
        }
      } else {
        const saved = loadJson(`soundConfig.${user.tenantId}`, null)
        if (saved) {
          setSoundConfig(saved)
          setSoundEnabled(saved.enabled !== false)
        }
      }
    }
    loadSoundConfig()
  }, [user?.tenantId])

  // Función para reproducir sonido
  const playNotificationSound = useCallback(() => {
    if (!soundEnabled) {
      return
    }
    if (!audioRef.current) {
      return
    }
    
    let played = 0
    const playOnce = () => {
      if (played >= soundConfig.repeatCount) return
      
      audioRef.current.currentTime = 0
      audioRef.current.play()
        .catch((err) => {
          // Silently handle autoplay restrictions
        })
      played++
      
      if (played < soundConfig.repeatCount) {
        setTimeout(playOnce, soundConfig.delayMs)
      }
    }
    
    playOnce()
  }, [soundEnabled, soundConfig.repeatCount, soundConfig.delayMs])

  // Función para reproducir sonido de alerta (límite de pedidos)
  const playAlertSound = useCallback(() => {
    if (!alertAudioRef.current) return
    
    // Reproducir sonido de alerta 3 veces con más urgencia
    let played = 0
    const playOnce = () => {
      if (played >= 3) return
      
      alertAudioRef.current.currentTime = 0
      alertAudioRef.current.play()
        .catch((err) => {
          // Silently handle autoplay restrictions
        })
      played++
      
      if (played < 3) {
        setTimeout(playOnce, 800)
      }
    }
    
    playOnce()
  }, [])

  // Cargar y suscribirse a límites de pedidos
  useEffect(() => {
    if (!user?.tenantId) {
      return
    }
    
    const loadOrderLimits = async () => {
      try {
        const status = await fetchOrderLimitsStatus(user.tenantId)
        setOrderLimitsStatus(status)
        prevOrdersRemainingRef.current = status.remaining
      } catch (err) {
        // Silently handle error
      }
    }
    
    loadOrderLimits()
    
    // Suscribirse a cambios en tiempo real
    if (isSupabaseConfigured) {
      const unsubscribe = subscribeToOrderLimits(user.tenantId, (newStatus) => {
        // Detectar si acaba de llegar a 0
        const wasNotZero = prevOrdersRemainingRef.current > 0
        const isNowZero = !newStatus.isUnlimited && newStatus.remaining <= 0
        
        if (wasNotZero && isNowZero) {
          playAlertSound()
          setShowOrderLimitModal(true)
        }
        
        prevOrdersRemainingRef.current = newStatus.remaining
        setOrderLimitsStatus(newStatus)
      })
      
      return () => unsubscribe()
    }
  }, [user?.tenantId, playAlertSound])

  // Suscripción global a tiempo real de pedidos
  useEffect(() => {
    if (!user?.tenantId || !isSupabaseConfigured) return
    
    const channel = supabase
      .channel(`global-orders-${user.tenantId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `tenant_id=eq.${user.tenantId}`,
        },
        (payload) => {
          dispatch(fetchOrdersForTenant(user.tenantId))
          setGlobalNewOrdersCount((prev) => prev + 1)
          playNotificationSound()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `tenant_id=eq.${user.tenantId}`,
        },
        () => {
          dispatch(fetchOrdersForTenant(user.tenantId))
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'orders',
          filter: `tenant_id=eq.${user.tenantId}`,
        },
        () => {
          dispatch(fetchOrdersForTenant(user.tenantId))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.tenantId, dispatch, playNotificationSound])

  // Limpiar contador de nuevos pedidos
  const clearGlobalNotifications = useCallback(() => {
    setGlobalNewOrdersCount(0)
  }, [])

  // Cargar datos iniciales y refrescar cada 30 segundos para estadísticas en tiempo real
  useEffect(() => {
    if (!user?.tenantId) return
    
    // Carga inicial
    dispatch(fetchOrdersForTenant(user.tenantId))
    dispatch(fetchProductsForTenant(user.tenantId))
    
    // Refresh cada 30 segundos para tiempo real
    const interval = setInterval(() => {
      dispatch(fetchOrdersForTenant(user.tenantId))
    }, 30000)
    
    return () => clearInterval(interval)
  }, [dispatch, user?.tenantId])

  // Calcular estadísticas de hoy
  const todayStats = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const todayOrders = orders.filter(order => {
      const orderDate = new Date(order.created_at)
      orderDate.setHours(0, 0, 0, 0)
      return orderDate.getTime() === today.getTime()
    })
    
    const ordersToday = todayOrders.length
    const salesToday = todayOrders
      .filter(o => o.status !== 'cancelled')
      .reduce((sum, order) => sum + (order.total || 0), 0)
    
    // Clientes únicos de hoy (por teléfono o nombre)
    const uniqueCustomers = new Set(
      todayOrders
        .filter(o => o.customer_phone || o.customer_name)
        .map(o => o.customer_phone || o.customer_name)
    )
    const customersToday = uniqueCustomers.size
    
    return { ordersToday, salesToday, customersToday }
  }, [orders])

  useEffect(() => {
    let cancelled = false

    async function loadTenant() {
      if (!isSupabaseConfigured) return
      if (!user?.tenantId) return

      setLoadingTenant(true)
      setTenantLoadError(null)
      try {
        // Primero verificar si la suscripción expiró y corregir
        const subscriptionCheck = await checkAndFixSubscriptionExpiration(user.tenantId)
        
        // Luego cargar el tenant actualizado
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
                let slug = (tenantSlug.trim() || suggestedSlug).trim()
                if (!name || !slug) {
                  setError('Nombre y slug son requeridos.')
                  return
                }

                setSaving(true)
                try {
                  // Generar slug único para evitar duplicados
                  slug = await generateUniqueSlug(slug)
                  
                  const tenant = await dispatch(createTenant({ name, slug, ownerUserId: user.id })).unwrap()
                  if (!tenant?.id) throw new Error('No se pudo crear el tenant')

                  // Update user role to tenant_admin and set tenant_id
                  await upsertProfile({ userId: user.id, role: ROLES.TENANT_ADMIN, tenantId: tenant.id })
                  dispatch(setTenantId(tenant.id))
                  dispatch(setUserRole(ROLES.TENANT_ADMIN))
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

  const copyToClipboard = (text, linkId) => {
    navigator.clipboard.writeText(text)
    setCopiedLink(linkId)
    setTimeout(() => setCopiedLink(null), 2000)
  }

  const storeUrl = currentTenant?.slug ? `${window.location.origin}/store/${currentTenant.slug}` : ''
  const menuUrl = currentTenant?.slug ? `${window.location.origin}/r/${currentTenant.slug}` : ''

  return (
    <div className={`dash dash--withSidebar ${sidebarCollapsed ? 'dash--sidebarCollapsed' : ''}`}>
      {/* Audio global para notificaciones de pedidos */}
      <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" preload="auto" />
      {/* Audio de alerta para límite de pedidos agotado */}
      <audio ref={alertAudioRef} src="https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3" preload="auto" />
      
      {/* Indicador global de notificaciones - fijo en pantalla */}
      <div 
        className={`dash__globalNotification ${globalNewOrdersCount > 0 ? 'dash__globalNotification--active' : ''} ${!soundEnabled ? 'dash__globalNotification--muted' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          // Toggle del sonido
          setSoundEnabled(prev => !prev)
          // Si hay pedidos nuevos, limpiar el contador
          if (globalNewOrdersCount > 0) {
            clearGlobalNotifications()
          }
        }}
        title={
          globalNewOrdersCount > 0 
            ? `${globalNewOrdersCount} nuevo(s) pedido(s) - Click para ${soundEnabled ? 'silenciar' : 'activar sonido'}` 
            : soundEnabled 
              ? 'Sonido activado - Click para silenciar' 
              : 'Sonido silenciado - Click para activar'
        }
      >
        {soundEnabled ? <Bell size={20} /> : <Volume2 size={20} />}
        {globalNewOrdersCount > 0 && (
          <span className="dash__globalNotificationCount">{globalNewOrdersCount}</span>
        )}
        {!soundEnabled && <span className="dash__globalNotificationMuted">✕</span>}
      </div>
      
      <Sidebar 
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tenantName={currentTenant?.name || 'Mi Restaurante'}
        tenantLogo={currentTenant?.logo || ''}
        tenantSlug={currentTenant?.slug || ''}
        subscriptionTier={subscriptionTier}
        pendingOrdersCount={pendingOrdersCount}
        isCollapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        onPendingOrdersClick={() => setShowPendingModal(true)}
        orderLimitsStatus={orderLimitsStatus}
      />

      {/* Modal de pedidos pendientes */}
      {showPendingModal && (
        <PendingOrdersModal 
          orders={pendingOrders}
          tenantId={user?.tenantId}
          onClose={() => setShowPendingModal(false)}
        />
      )}

      {/* Modal de límite de pedidos alcanzado */}
      <OrderLimitWarningModal
        isOpen={showOrderLimitModal}
        onClose={() => setShowOrderLimitModal(false)}
        currentTier={subscriptionTier}
        ordersUsed={orderLimitsStatus?.ordersLimit - orderLimitsStatus?.ordersRemaining || 0}
        ordersLimit={orderLimitsStatus?.ordersLimit || ORDER_LIMITS[subscriptionTier]}
        onUpgrade={(selectedPlan) => {
          setShowOrderLimitModal(false);
          setActiveTab('plans');
        }}
      />

      <main className="dash__main">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            <header className="dash__header">
              <h1>Dashboard</h1>
              <p className="muted">Bienvenido de vuelta. Aquí está el resumen de tu restaurante.</p>
            </header>

            {/* Stats Cards */}
            <div className="dash__statsRow">
              <div className="dash__statCard" onClick={() => setActiveTab('orders')} style={{ cursor: 'pointer' }}>
                <div className="dash__statIcon dash__statIcon--orders">
                  <ShoppingBag size={24} />
                </div>
                <div className="dash__statContent">
                  <span className="dash__statValue">{todayStats.ordersToday}</span>
                  <span className="dash__statLabel">Pedidos hoy</span>
                </div>
              </div>
              <div className="dash__statCard" onClick={() => setActiveTab('sales')} style={{ cursor: 'pointer' }}>
                <div className="dash__statIcon dash__statIcon--sales">
                  <DollarSign size={24} />
                </div>
                <div className="dash__statContent">
                  <span className="dash__statValue">${todayStats.salesToday.toLocaleString()}</span>
                  <span className="dash__statLabel">Ventas hoy</span>
                </div>
              </div>
              <div className="dash__statCard" onClick={() => setActiveTab('menu')} style={{ cursor: 'pointer' }}>
                <div className="dash__statIcon dash__statIcon--products">
                  <Package size={24} />
                </div>
                <div className="dash__statContent">
                  <span className="dash__statValue">{productsCount}</span>
                  <span className="dash__statLabel">Productos</span>
                </div>
              </div>
              <div className="dash__statCard">
                <div className="dash__statIcon dash__statIcon--customers">
                  <Users size={24} />
                </div>
                <div className="dash__statContent">
                  <span className="dash__statValue">{todayStats.customersToday}</span>
                  <span className="dash__statLabel">Clientes hoy</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <Card title="Acciones rápidas">
              <div className="dash__quickGrid">
                <button className="dash__quickAction" onClick={() => setActiveTab('menu')}>
                  <Package size={20} />
                  <span>Agregar producto</span>
                </button>
                <button className="dash__quickAction" onClick={() => setActiveTab('orders')}>
                  <ShoppingBag size={20} />
                  <span>Ver pedidos</span>
                </button>
                <button className="dash__quickAction" onClick={() => setActiveTab('settings')}>
                  <Settings size={20} />
                  <span>Configurar tienda</span>
                </button>
                <button className="dash__quickAction" onClick={() => setActiveTab('qr')}>
                  <QrCode size={20} />
                  <span>Generar QR</span>
                </button>
              </div>
            </Card>

            {/* Store Visibility */}
            {currentTenant && (
              <Card title="Visibilidad de la tienda">
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
                    <span>Mostrar mi restaurante en el directorio público</span>
                  </label>
                  {savingVisibility && <span className="muted">Guardando...</span>}
                </div>
              </Card>
            )}
          </>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <>
            <OrdersManager tenantId={user.tenantId} />
          </>
        )}

        {/* Sales Tab */}
        {activeTab === 'sales' && (
          <>
            <header className="dash__header">
              <h1>Ventas</h1>
              <p className="muted">Analiza el rendimiento de tu negocio.</p>
            </header>
            <SalesStats tenantId={user.tenantId} />
          </>
        )}

        {/* Menu Tab */}
        {activeTab === 'menu' && (
          <>
            <header className="dash__header">
              <h1>Menú</h1>
              <p className="muted">Administra los productos de tu restaurante.</p>
            </header>
            <ProductsManager tenantId={user.tenantId} />
          </>
        )}

        {/* Extras Tab */}
        {activeTab === 'extras' && (
          <>
            <header className="dash__header">
              <h1>Extras y Toppings</h1>
              <p className="muted">Configura los extras que se pueden agregar a cualquier producto.</p>
            </header>
            <ExtrasManager tenantId={user.tenantId} />
          </>
        )}

        {/* Kitchen Tab */}
        {activeTab === 'kitchen' && (
          <>
            <header className="dash__header">
              <h1>Cocina</h1>
              <p className="muted">Vista de cocina para preparar pedidos.</p>
            </header>
            <Card title="Pantalla de cocina">
              <div className="dash__emptyState">
                <ChefHat size={48} />
                <h3>Próximamente</h3>
                <p className="muted">La vista de cocina para gestionar pedidos en tiempo real estará disponible pronto.</p>
              </div>
            </Card>
          </>
        )}

        {/* Inventory Tab */}
        {activeTab === 'inventory' && (
          <>
            <header className="dash__header">
              <h1>Inventario</h1>
              <p className="muted">Controla el stock de tus productos.</p>
            </header>
            <Card title="Gestión de inventario">
              <div className="dash__emptyState">
                <Package size={48} />
                <h3>Próximamente</h3>
                <p className="muted">El sistema de inventario estará disponible pronto.</p>
              </div>
            </Card>
          </>
        )}

        {/* Store Editor Tab */}
        {activeTab === 'store-editor' && (
          <StoreEditor />
        )}

        {/* QR & Links Tab */}
        {activeTab === 'qr' && (
          <>
            <header className="dash__header">
              <h1>QR y Enlaces</h1>
              <p className="muted">Comparte tu tienda con tus clientes.</p>
            </header>

            <div className="dash__qrGrid">
              {/* QR Code Card */}
              <Card title="Código QR">
                <div className="dash__qrContainer">
                  <div className="dash__qrCode">
                    {currentTenant?.slug ? (
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(storeUrl)}`}
                        alt="QR Code"
                        className="dash__qrImage"
                      />
                    ) : (
                      <div className="dash__qrPlaceholder">
                        <QrCode size={64} />
                        <p className="muted">Crea tu tienda para generar un QR</p>
                      </div>
                    )}
                  </div>
                  {currentTenant?.slug && (
                    <Button 
                      variant="secondary"
                      onClick={() => {
                        const link = document.createElement('a')
                        link.href = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(storeUrl)}`
                        link.download = `qr-${currentTenant.slug}.png`
                        link.click()
                      }}
                    >
                      <Download size={16} /> Descargar QR
                    </Button>
                  )}
                </div>
              </Card>

              {/* Links Card */}
              <Card title="Enlaces de tu tienda">
                <div className="dash__linksGrid">
                  <div className="dash__linkItem">
                    <div className="dash__linkInfo">
                      <span className="dash__linkLabel">Tienda online</span>
                      <code className="dash__linkUrl">{storeUrl || 'No disponible'}</code>
                    </div>
                    <div className="dash__linkActions">
                      <button 
                        className="dash__linkBtn"
                        onClick={() => copyToClipboard(storeUrl, 'store')}
                        disabled={!storeUrl}
                        title="Copiar enlace"
                      >
                        {copiedLink === 'store' ? <Check size={18} /> : <Copy size={18} />}
                      </button>
                      <a 
                        href={storeUrl || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="dash__linkBtn"
                        title="Abrir en nueva pestaña"
                      >
                        <ExternalLink size={18} />
                      </a>
                    </div>
                  </div>

                  <div className="dash__linkItem">
                    <div className="dash__linkInfo">
                      <span className="dash__linkLabel">Menú / Carta</span>
                      <code className="dash__linkUrl">{menuUrl || 'No disponible'}</code>
                    </div>
                    <div className="dash__linkActions">
                      <button 
                        className="dash__linkBtn"
                        onClick={() => copyToClipboard(menuUrl, 'menu')}
                        disabled={!menuUrl}
                        title="Copiar enlace"
                      >
                        {copiedLink === 'menu' ? <Check size={18} /> : <Copy size={18} />}
                      </button>
                      <a 
                        href={menuUrl || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="dash__linkBtn"
                        title="Abrir en nueva pestaña"
                      >
                        <ExternalLink size={18} />
                      </a>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </>
        )}

        {activeTab === 'mobile-preview' && (
          <MobilePreviewEditor 
            tenantId={currentTenant?.id}
            tenantName={currentTenant?.name || 'Mi Tienda'}
            tenantLogo={currentTenant?.logo || ''}
            tenantSlug={currentTenant?.slug || ''}
            currentTier={subscriptionTier}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsSection tenantId={currentTenant?.id} />
        )}

        {activeTab === 'mercadopago' && currentTenant?.id && (
          <>
            <header className="dash__header">
              <h1>Configuración de MercadoPago</h1>
              <p className="muted">Configura tus credenciales para recibir pagos de tus clientes</p>
            </header>
            <MercadoPagoConfig tenantId={currentTenant.id} />
          </>
        )}

        {activeTab === 'plans' && (
          <>
            <header className="dash__header">
              <h1>Mi Plan de Suscripción</h1>
              <p className="muted">Elige el plan que mejor se adapte a tu negocio</p>
            </header>
            
            {/* Estado actual de la suscripción (solo si es premium) */}
            <SubscriptionStatus
              tenant={currentTenant}
              onRenewalComplete={(newTier) => {
                if (currentTenant?.id) {
                  fetchTenantById(currentTenant.id).then(setCurrentTenant)
                }
              }}
            />
            
            <SubscriptionCheckout
              tenantId={currentTenant?.id}
              tenantName={currentTenant?.name || 'Mi Tienda'}
              currentTier={subscriptionTier}
              userEmail={user?.email}
              onSubscriptionComplete={(newTier) => {
                // Recargar datos del tenant
                if (currentTenant?.id) {
                  fetchTenantById(currentTenant.id).then(setCurrentTenant)
                }
              }}
            />
          </>
        )}

        {activeTab === 'account' && (
          <AccountSection subscriptionTier={subscriptionTier} />
        )}
      </main>
    </div>
  )
}

// Componente de Reportes
function ReportsSection({ tenantId }) {
  const orders = useAppSelector(selectOrdersForTenant(tenantId))
  const [dateRange, setDateRange] = useState('week') // week, month, all

  const stats = useMemo(() => {
    const now = new Date()
    let filtered = orders

    if (dateRange === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      filtered = orders.filter(o => new Date(o.created_at) >= weekAgo)
    } else if (dateRange === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      filtered = orders.filter(o => new Date(o.created_at) >= monthAgo)
    }

    const total = filtered.reduce((sum, o) => sum + Number(o.total), 0)
    const count = filtered.length
    const completed = filtered.filter(o => o.status === 'completed').length
    const pending = filtered.filter(o => o.status === 'pending').length
    const avgTicket = count > 0 ? total / count : 0

    const byDeliveryType = {
      mostrador: filtered.filter(o => o.delivery_type === 'mostrador').length,
      domicilio: filtered.filter(o => o.delivery_type === 'domicilio').length,
      mesa: filtered.filter(o => o.delivery_type === 'mesa').length,
    }

    const byPayment = {}
    filtered.forEach(o => {
      byPayment[o.payment_method] = (byPayment[o.payment_method] || 0) + 1
    })

    return { total, count, completed, pending, avgTicket, byDeliveryType, byPayment }
  }, [orders, dateRange])

  return (
    <>
      <header className="dash__header">
        <h1>Reportes</h1>
        <p className="muted">Análisis y estadísticas de tus pedidos y ventas.</p>
      </header>

      <div className="reports__filters">
        {[
          { key: 'week', label: 'Esta Semana' },
          { key: 'month', label: 'Este Mes' },
          { key: 'all', label: 'Todos los Pedidos' },
        ].map((filter) => (
          <button
            key={filter.key}
            className={`reports__filterBtn ${dateRange === filter.key ? 'reports__filterBtn--active' : ''}`}
            onClick={() => setDateRange(filter.key)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="reports__grid">
        <Card className="reports__card">
          <div className="reports__stat">
            <div className="reports__statLabel">Total de Ventas</div>
            <div className="reports__statValue">${stats.total.toFixed(2)}</div>
            <div className="reports__statDetail">{stats.count} pedidos</div>
          </div>
        </Card>

        <Card className="reports__card">
          <div className="reports__stat">
            <div className="reports__statLabel">Ticket Promedio</div>
            <div className="reports__statValue">${stats.avgTicket.toFixed(2)}</div>
            <div className="reports__statDetail">Por pedido</div>
          </div>
        </Card>

        <Card className="reports__card">
          <div className="reports__stat">
            <div className="reports__statLabel">Pedidos Completados</div>
            <div className="reports__statValue">{stats.completed}</div>
            <div className="reports__statDetail">{stats.pending} pendientes</div>
          </div>
        </Card>

        <Card className="reports__card">
          <div className="reports__stat">
            <div className="reports__statLabel">Tasa de Conversión</div>
            <div className="reports__statValue">
              {stats.count > 0 ? ((stats.completed / stats.count) * 100).toFixed(0) : 0}%
            </div>
            <div className="reports__statDetail">De pedidos completados</div>
          </div>
        </Card>
      </div>

      <div className="reports__section">
        <Card title="Tipos de Entrega">
          <div className="reports__breakdown">
            <div className="reports__breakdownItem">
              <span>🍴 Mostrador</span>
              <span className="reports__breakdownValue">{stats.byDeliveryType.mostrador}</span>
            </div>
            <div className="reports__breakdownItem">
              <span>🚚 A Domicilio</span>
              <span className="reports__breakdownValue">{stats.byDeliveryType.domicilio}</span>
            </div>
            <div className="reports__breakdownItem">
              <span>🏠 En Mesa</span>
              <span className="reports__breakdownValue">{stats.byDeliveryType.mesa}</span>
            </div>
          </div>
        </Card>

        <Card title="Formas de Pago">
          <div className="reports__breakdown">
            {Object.entries(stats.byPayment).map(([method, count]) => (
              <div key={method} className="reports__breakdownItem">
                <span>{method === 'efectivo' ? '💵' : method === 'tarjeta' ? '💳' : '📱'} {method === 'efectivo' ? 'Efectivo' : method === 'tarjeta' ? 'Tarjeta' : 'QR'}</span>
                <span className="reports__breakdownValue">{count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Últimos Pedidos">
        <div className="reports__table">
          {orders.slice(0, 10).map((order) => (
            <div key={order.id} className="reports__tableRow">
              <span className="reports__tableCell">{new Date(order.created_at).toLocaleDateString('es-AR')}</span>
              <span className="reports__tableCell">{order.customer_name}</span>
              <span className="reports__tableCell">${Number(order.total).toFixed(2)}</span>
              <span className={`reports__tableCell reports__status reports__status--${order.status}`}>
                {order.status === 'completed' ? '✓' : order.status === 'pending' ? '⏳' : '⚙️'} {order.status}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}

// Modal de pedidos pendientes
function PendingOrdersModal({ orders, tenantId, onClose }) {
  const dispatch = useAppDispatch()
  const [processingOrder, setProcessingOrder] = useState(null)

  const DELIVERY_TYPES = {
    mostrador: { label: 'Mostrador', icon: <UtensilsCrossed size={14} /> },
    domicilio: { label: 'Domicilio', icon: <Truck size={14} /> },
    mesa: { label: 'Mesa', icon: <Home size={14} /> },
  }

  const handleAcceptOrder = async (orderId) => {
    setProcessingOrder(orderId)
    try {
      await dispatch(updateOrder({ tenantId, orderId, newStatus: 'in_progress' })).unwrap()
    } finally {
      setProcessingOrder(null)
    }
  }

  const handleDeleteOrder = async (orderId) => {
    setProcessingOrder(orderId)
    try {
      await dispatch(deleteOrder({ tenantId, orderId })).unwrap()
    } finally {
      setProcessingOrder(null)
    }
  }

  const getTimeAgo = (dateString) => {
    const created = new Date(dateString)
    const now = new Date()
    const diffMs = now - created
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    
    if (diffHours > 0) return `Hace ${diffHours}h ${diffMins % 60}m`
    if (diffMins > 0) return `Hace ${diffMins}m`
    return 'Ahora'
  }

  return createPortal(
    <div className="pendingModal__overlay">
      <div className="pendingModal">
        <div className="pendingModal__header">
          <h3>🔔 Pedidos Pendientes ({orders.length})</h3>
          <button className="pendingModal__close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="pendingModal__content">
          {orders.length === 0 ? (
            <div className="pendingModal__empty">
              <p>🎉 No hay pedidos pendientes</p>
              <p className="muted">Los nuevos pedidos aparecerán aquí</p>
            </div>
          ) : (
            <div className="pendingModal__list">
              {orders.map((order) => (
                <div key={order.id} className="pendingModal__order">
                  <div className="pendingModal__orderHeader">
                    <span className="pendingModal__orderId">
                      #{order.id?.slice(0, 8).toUpperCase()}
                    </span>
                    <span className="pendingModal__orderTime">
                      <Clock size={12} /> {getTimeAgo(order.created_at)}
                    </span>
                  </div>

                  <div className="pendingModal__orderInfo">
                    <div className="pendingModal__orderRow">
                      <User size={14} />
                      <span>{order.customer_name || 'Sin nombre'}</span>
                    </div>
                    <div className="pendingModal__orderRow">
                      {DELIVERY_TYPES[order.delivery_type]?.icon}
                      <span>{DELIVERY_TYPES[order.delivery_type]?.label || order.delivery_type}</span>
                    </div>
                    <div className="pendingModal__orderTotal">
                      ${Number(order.total).toFixed(2)}
                    </div>
                  </div>

                  {order.items && order.items.length > 0 && (
                    <div className="pendingModal__orderItems">
                      {order.items.map((item, idx) => (
                        <span key={idx} className="pendingModal__orderItem">
                          {item.qty || item.quantity}x {item.name}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="pendingModal__orderActions">
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={processingOrder === order.id}
                      onClick={() => handleDeleteOrder(order.id)}
                    >
                      {processingOrder === order.id ? '...' : '❌ Rechazar'}
                    </Button>
                    <Button
                      size="sm"
                      disabled={processingOrder === order.id}
                      onClick={() => handleAcceptOrder(order.id)}
                    >
                      {processingOrder === order.id ? '...' : '✅ Aceptar'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}