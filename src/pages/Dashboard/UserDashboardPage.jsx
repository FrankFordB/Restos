import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import './DashboardPages.css'
import Card from '../../components/ui/Card/Card'
import Input from '../../components/ui/Input/Input'
import Button from '../../components/ui/Button/Button'
import InfoTooltip from '../../components/ui/InfoTooltip/InfoTooltip'
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
import DashboardWelcomeModal from '../../components/dashboard/DashboardWelcomeModal/DashboardWelcomeModal'
import ReferralsManager from '../../components/dashboard/ReferralsManager/ReferralsManager'
import Sidebar from '../../components/dashboard/Sidebar/Sidebar'
import AccountSection from './AccountSection'
import StoreEditor from './StoreEditor'
import { createTenant } from '../../features/tenants/tenantsSlice'
import { selectOrdersForTenant, updateOrder, deleteOrder, fetchOrdersForTenant } from '../../features/orders/ordersSlice'
import { selectProductsForTenant, fetchProductsForTenant } from '../../features/products/productsSlice'
import { fetchTenantById, updateTenantVisibility, upsertProfile, generateUniqueSlug, fetchTenantSoundConfig, fetchOrderLimitsStatus, subscribeToOrderLimits, checkAndFixSubscriptionExpiration, checkFirstLogin, markWelcomeTutorialSeen } from '../../lib/supabaseApi'
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
  ExternalLink,
  Banknote,
  CreditCard,
  Smartphone,
  CheckCircle,
  Loader,
  PartyPopper,
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
  
  // Función para recargar el tenant
  const refreshTenant = async () => {
    if (!user?.tenantId || !isSupabaseConfigured) return
    try {
      const updated = await fetchTenantById(user.tenantId)
      if (updated) {
        setCurrentTenant(updated)
        console.log('✅ Tenant refrescado:', updated.subscription_tier, updated.premium_until)
      }
    } catch (err) {
      console.error('Error refrescando tenant:', err)
    }
  }
  
  // Recargar tenant cuando la ventana gana foco (ej: volver de MercadoPago)
  // Usar debounce largo para evitar interferir con file pickers e imagen processing
  useEffect(() => {
    let focusTimeoutId = null
    
    const handleFocus = () => {
      // Cancelar cualquier refresh pendiente
      if (focusTimeoutId) clearTimeout(focusTimeoutId)
      
      // Esperar 2 segundos para dar tiempo a que se procese la imagen
      focusTimeoutId = setTimeout(() => {
        // No recargar si hay modal de imagen abierto
        const hasOpenModal = document.querySelector('.imageEditor__overlay')
        if (hasOpenModal) {
          console.log('🔄 Dashboard: modal de imagen abierto, saltando recarga')
          return
        }
        console.log('🔄 Ventana ganó foco, refrescando tenant...')
        refreshTenant()
      }, 2000)
    }
    
    window.addEventListener('focus', handleFocus)
    return () => {
      if (focusTimeoutId) clearTimeout(focusTimeoutId)
      window.removeEventListener('focus', handleFocus)
    }
  }, [user?.tenantId])
  
  // Detectar si viene de un pago exitoso (payment_success en URL o localStorage)
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const paymentSuccess = params.get('payment_success')
    const storedPayment = localStorage.getItem('payment_just_completed')
    
    console.log('🔍 Verificando pago:', { paymentSuccess, storedPayment, tenantId: user?.tenantId })
    
    if (paymentSuccess === 'true' || storedPayment === 'true') {
      console.log('💳 Pago detectado! Refrescando tenant...')
      localStorage.removeItem('payment_just_completed')
      // Limpiar el parámetro de la URL
      if (paymentSuccess) {
        params.delete('payment_success')
        const newUrl = params.toString() 
          ? `${location.pathname}?${params.toString()}` 
          : location.pathname
        window.history.replaceState({}, '', newUrl)
      }
      // Refrescar inmediatamente y después de un delay
      refreshTenant()
      setTimeout(refreshTenant, 1000)
      setTimeout(refreshTenant, 3000)
    }
  }, [location.search, user?.tenantId])
  
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

  // Get premium expiration date and gift status
  const premiumUntil = currentTenant?.premium_until
  const isGifted = currentTenant?.is_gifted || false
  const _isPremiumActive = premiumUntil && new Date(premiumUntil) > new Date() && subscriptionTier !== 'free'

  // Copied state for links - debe estar antes de cualquier return condicional
  const [copiedLink, setCopiedLink] = useState(null)
  
  // Modal de pedidos pendientes
  const [showPendingModal, setShowPendingModal] = useState(false)
  
  // Modal de bienvenida para primer inicio de sesión
  const [showWelcomeModal, setShowWelcomeModal] = useState(false)

  // Obtener pedidos para contar los pendientes
  const orders = useAppSelector(selectOrdersForTenant(user?.tenantId))
  const pendingOrdersCount = useMemo(() => {
    return orders.filter(o => o.status === 'pending' && !((o.payment_method === 'mercadopago' || o.payment_method === 'qr') && !o.is_paid)).length
  }, [orders])
  const pendingOrders = useMemo(() => {
    return orders.filter(o => o.status === 'pending' && !((o.payment_method === 'mercadopago' || o.payment_method === 'qr') && !o.is_paid))
  }, [orders])

  // Obtener productos
  const products = useAppSelector(selectProductsForTenant(user?.tenantId))
  const productsCount = products?.length || 0

  // ========== NOTIFICACIONES GLOBALES DE NUEVOS PEDIDOS ==========
  const audioRef = useRef(null)
  const alertAudioRef = useRef(null) // Sonido de alerta para límite de pedidos
  const [globalNewOrdersCount, setGlobalNewOrdersCount] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(true) // Toggle local de sonido
  const [userHasInteracted, setUserHasInteracted] = useState(false) // Para autoplay
  const [soundConfig, setSoundConfig] = useState({
    enabled: true,
    repeatCount: 3,
    delayMs: 1500,
  })
  // Ref estable para el callback de sonido (evita re-crear el canal realtime)
  const playNotificationSoundRef = useRef(null)
  
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

  // Detectar interacción del usuario para permitir autoplay de audio
  useEffect(() => {
    const handleInteraction = () => {
      setUserHasInteracted(true)
      // Pre-cargar el audio con volumen 0 para "desbloquear" autoplay
      if (audioRef.current) {
        audioRef.current.volume = 0
        audioRef.current.play().then(() => {
          audioRef.current.pause()
          audioRef.current.currentTime = 0
          audioRef.current.volume = 1
          console.log('🔊 Audio desbloqueado por interacción del usuario')
        }).catch(() => {})
      }
      // Remover listeners después de la primera interacción
      document.removeEventListener('click', handleInteraction)
      document.removeEventListener('touchstart', handleInteraction)
      document.removeEventListener('keydown', handleInteraction)
    }
    
    document.addEventListener('click', handleInteraction)
    document.addEventListener('touchstart', handleInteraction)
    document.addEventListener('keydown', handleInteraction)
    
    return () => {
      document.removeEventListener('click', handleInteraction)
      document.removeEventListener('touchstart', handleInteraction)
      document.removeEventListener('keydown', handleInteraction)
    }
  }, [])

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

  // Generar sonido con Web Audio API (fallback confiable)
  const playBeepSound = useCallback(() => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (!AudioContext) return false
      
      const ctx = new AudioContext()
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)
      
      oscillator.frequency.setValueAtTime(880, ctx.currentTime) // La5 - tono agudo de alerta
      oscillator.type = 'sine'
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
      
      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.5)
      
      // Segundo tono más alto para que suene como notificación
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.frequency.setValueAtTime(1100, ctx.currentTime + 0.15)
      osc2.type = 'sine'
      gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.15)
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.65)
      osc2.start(ctx.currentTime + 0.15)
      osc2.stop(ctx.currentTime + 0.65)
      
      // Limpiar contexto después
      setTimeout(() => ctx.close().catch(() => {}), 1000)
      return true
    } catch {
      return false
    }
  }, [])

  // Función para reproducir sonido
  const playNotificationSound = useCallback(() => {
    if (!soundEnabled) {
      console.log('🔇 Sonido desactivado por el usuario')
      return
    }
    
    console.log('🔔 Reproduciendo sonido de notificación...')
    let played = 0
    const playOnce = () => {
      if (played >= soundConfig.repeatCount) return
      
      // Intentar con el elemento <audio> primero
      const audioEl = audioRef.current
      let audioPlayed = false
      
      if (audioEl && audioEl.readyState >= 2) { // HAVE_CURRENT_DATA
        audioEl.currentTime = 0
        audioEl.play()
          .then(() => {
            console.log('🔊 Sonido MP3 reproducido correctamente')
          })
          .catch((err) => {
            console.warn('⚠️ MP3 falló, usando Web Audio API:', err.message)
            playBeepSound()
          })
        audioPlayed = true
      }
      
      // Si el audio no está listo, usar Web Audio API directamente
      if (!audioPlayed) {
        console.log('🔊 Usando Web Audio API (audio MP3 no disponible)')
        const beeped = playBeepSound()
        if (!beeped && navigator.vibrate) {
          navigator.vibrate([200, 100, 200])
        }
      }
      
      played++
      
      if (played < soundConfig.repeatCount) {
        setTimeout(playOnce, soundConfig.delayMs)
      }
    }
    
    playOnce()
  }, [soundEnabled, soundConfig.repeatCount, soundConfig.delayMs, playBeepSound])
  
  // Mantener ref sincronizada para evitar re-crear canales realtime
  useEffect(() => {
    playNotificationSoundRef.current = playNotificationSound
  }, [playNotificationSound])

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

  // Verificar si es el primer inicio de sesión para mostrar tutorial de bienvenida
  useEffect(() => {
    async function checkWelcome() {
      if (!user?.id) return
      
      // Primero verificar localStorage para evitar llamadas innecesarias
      const localKey = `dashboard.welcomeTutorial.seen.${user.id}`
      if (localStorage.getItem(localKey) === 'true') return
      
      try {
        const isFirstLogin = await checkFirstLogin(user.id)
        if (isFirstLogin) {
          // Pequeño delay para que el dashboard cargue primero
          setTimeout(() => setShowWelcomeModal(true), 500)
        }
      } catch (err) {
        console.warn('Error checking first login:', err)
      }
    }
    checkWelcome()
  }, [user?.id])

  // Cerrar modal de bienvenida y marcar como visto
  const handleCloseWelcome = async () => {
    setShowWelcomeModal(false)
    if (user?.id) {
      try {
        await markWelcomeTutorialSeen(user.id)
      } catch (err) {
        console.warn('Error marking welcome as seen:', err)
      }
    }
  }

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
    
    console.log('📡 Iniciando suscripción realtime para tenant:', user.tenantId)
    
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
          console.log('📥 Realtime INSERT recibido:', payload.new?.id, payload.new?.payment_method, payload.new?.is_paid)
          // NO reproducir sonido ni notificar si es pago con MercadoPago pendiente
          // El sonido se reproducirá cuando se actualice a is_paid=true
          const newOrder = payload.new
          const isMPPendingPayment = newOrder?.payment_method === 'mercadopago' && !newOrder?.is_paid
          
          if (isMPPendingPayment) {
            console.log('🔇 Orden MP pendiente de pago, sin notificación')
            dispatch(fetchOrdersForTenant(user.tenantId))
            return // No hacer sonido, esperar el UPDATE cuando pague
          }
          
          dispatch(fetchOrdersForTenant(user.tenantId))
          setGlobalNewOrdersCount((prev) => prev + 1)
          playNotificationSoundRef.current?.()
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
        (payload) => {
          console.log('📝 Realtime UPDATE recibido:', payload.new?.id, 'is_paid:', payload.new?.is_paid, 'old is_paid:', payload.old?.is_paid)
          const updatedOrder = payload.new
          const oldOrder = payload.old || {}
          
          // Detectar pago MP completado:
          // 1) Si payload.old tiene datos (REPLICA IDENTITY FULL): comparar is_paid
          // 2) Si payload.old está vacío (sin REPLICA IDENTITY): verificar si is_paid=true y payment_method=mercadopago
          const hasOldData = Object.keys(oldOrder).length > 0
          const isMPPaymentCompleted = updatedOrder?.payment_method === 'mercadopago' && updatedOrder?.is_paid === true
          
          if (isMPPaymentCompleted) {
            // Con REPLICA IDENTITY FULL: verificamos que cambió
            // Sin REPLICA IDENTITY: notificamos siempre que is_paid=true (puede haber duplicado pero es mejor que perder la notificación)
            if (!hasOldData || oldOrder.is_paid === false) {
              console.log('💰 ¡Pago MP completado! Notificando...')
              setGlobalNewOrdersCount((prev) => prev + 1)
              playNotificationSoundRef.current?.()
            }
          }
          
          // También notificar si el status cambió a 'confirmed' (orden confirmada por webhook)
          if (updatedOrder?.status === 'confirmed' && (!hasOldData || oldOrder.status !== 'confirmed')) {
            console.log('✅ Orden confirmada! Notificando...')
            setGlobalNewOrdersCount((prev) => prev + 1)
            playNotificationSoundRef.current?.()
          }
          
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
          console.log('🗑️ Realtime DELETE recibido')
          dispatch(fetchOrdersForTenant(user.tenantId))
        }
      )
      .subscribe((status, err) => {
        console.log('📡 Estado del canal realtime:', status)
        if (status === 'SUBSCRIBED') {
          console.log('✅ Suscripción realtime ACTIVA para órdenes')
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Error en canal realtime:', err)
        } else if (status === 'TIMED_OUT') {
          console.warn('⏰ Timeout en suscripción realtime, reintentando...')
        }
      })

    return () => {
      console.log('🔌 Desconectando canal realtime')
      supabase.removeChannel(channel)
    }
  }, [user?.tenantId, dispatch])  // NO incluir playNotificationSound - usar ref

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
      <audio 
        ref={audioRef} 
        src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" 
        preload="auto" 
        crossOrigin="anonymous"
        onError={() => console.warn('⚠️ No se pudo cargar el audio MP3 (se usará Web Audio API)')}
      />
      {/* Audio de alerta para límite de pedidos agotado */}
      <audio 
        ref={alertAudioRef} 
        src="https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3" 
        preload="auto" 
        crossOrigin="anonymous"
        onError={() => console.warn('⚠️ No se pudo cargar el audio de alerta')}
      />
      
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
        {!soundEnabled && <span className="dash__globalNotificationMuted"><X size={12} /></span>}
      </div>
      
      <Sidebar 
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tenantName={currentTenant?.name || 'Mi Restaurante'}
        tenantLogo={currentTenant?.logo || ''}
        tenantSlug={currentTenant?.slug || ''}
        subscriptionTier={subscriptionTier}
        premiumUntil={premiumUntil}
        isGifted={isGifted}
        pendingOrdersCount={pendingOrdersCount}
        isCollapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        onPendingOrdersClick={() => setShowPendingModal(true)}
        orderLimitsStatus={orderLimitsStatus}
        onUpgradeClick={() => setActiveTab('plans')}
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

      {/* Modal de bienvenida para primer inicio de sesión */}
      <DashboardWelcomeModal
        open={showWelcomeModal}
        onClose={handleCloseWelcome}
        userName={user?.email}
        onNavigateToTab={setActiveTab}
      />

      <main className="dash__main">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            <header className="dash__header">
              <div className="dash__headerTop">
                <div>
                  <h1>
                    Dashboard
                    <InfoTooltip 
                      text="Panel principal con resumen de ventas, pedidos del día y accesos rápidos a todas las funciones de tu tienda."
                      position="right"
                      size={18}
                    />
                  </h1>
                  <p className="muted">Bienvenido de vuelta. Aquí está el resumen de tu restaurante.</p>
                </div>
              </div>
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
          <SalesStats tenantId={user.tenantId} />
        )}

        {/* Menu Tab */}
        {activeTab === 'menu' && (
          <ProductsManager tenantId={user.tenantId} />
        )}

        {/* Extras Tab */}
        {activeTab === 'extras' && (
          <ExtrasManager tenantId={user.tenantId} />
        )}

        {/* Kitchen Tab */}
        {activeTab === 'kitchen' && (
          <Card title="Pantalla de cocina">
            <div className="dash__emptyState">
              <ChefHat size={48} />
              <h3>Próximamente</h3>
              <p className="muted">La vista de cocina para gestionar pedidos en tiempo real estará disponible pronto.</p>
            </div>
          </Card>
        )}

        {/* Inventory Tab */}
        {activeTab === 'inventory' && (
          <Card title="Gestión de inventario">
            <div className="dash__emptyState">
              <Package size={48} />
              <h3>Próximamente</h3>
              <p className="muted">El sistema de inventario estará disponible pronto.</p>
            </div>
          </Card>
        )}

        {/* Store Editor Tab */}
        {activeTab === 'store-editor' && (
          <StoreEditor />
        )}

        {/* QR & Links Tab */}
        {activeTab === 'qr' && (
          <>
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
            user={user}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsSection tenantId={currentTenant?.id} />
        )}

        {activeTab === 'mercadopago' && currentTenant?.id && (
          <MercadoPagoConfig tenantId={currentTenant.id} />
        )}

        {activeTab === 'plans' && (
          <>
            {/* Estado actual de la suscripción (solo si es premium) */}
            <SubscriptionStatus
              tenant={currentTenant}
              onRenewalComplete={(newTier) => {
                if (currentTenant?.id) {
                  fetchTenantById(currentTenant.id).then(setCurrentTenant)
                }
              }}
              onTenantUpdate={async () => {
                // Capturamos el ID en el momento de la llamada
                const tenantId = currentTenant?.id
                console.log('onTenantUpdate llamado, tenantId:', tenantId)
                if (tenantId) {
                  try {
                    // Pequeño delay para asegurar que la BD se actualizó
                    await new Promise(resolve => setTimeout(resolve, 500))
                    const updated = await fetchTenantById(tenantId)
                    console.log('Tenant actualizado:', updated)
                    console.log('scheduled_tier:', updated?.scheduled_tier)
                    if (updated) {
                      setCurrentTenant(updated)
                    }
                  } catch (err) {
                    console.error('Error recargando tenant:', err)
                  }
                }
              }}
            />
            
            <SubscriptionCheckout
              tenantId={currentTenant?.id}
              tenantName={currentTenant?.name || 'Mi Tienda'}
              currentTier={subscriptionTier}
              premiumUntil={currentTenant?.premium_until}
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

        {activeTab === 'referrals' && currentTenant?.id && user?.id && (
          <ReferralsManager 
            tenantId={currentTenant.id} 
            userId={user.id}
          />
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
              <span><UtensilsCrossed size={16} /> Mostrador</span>
              <span className="reports__breakdownValue">{stats.byDeliveryType.mostrador}</span>
            </div>
            <div className="reports__breakdownItem">
              <span><Truck size={16} /> A Domicilio</span>
              <span className="reports__breakdownValue">{stats.byDeliveryType.domicilio}</span>
            </div>
            <div className="reports__breakdownItem">
              <span><Home size={16} /> En Mesa</span>
              <span className="reports__breakdownValue">{stats.byDeliveryType.mesa}</span>
            </div>
          </div>
        </Card>

        <Card title="Formas de Pago">
          <div className="reports__breakdown">
            {Object.entries(stats.byPayment).map(([method, count]) => (
              <div key={method} className="reports__breakdownItem">
                <span>{method === 'efectivo' ? <Banknote size={16} /> : method === 'tarjeta' ? <CreditCard size={16} /> : <Smartphone size={16} />} {method === 'efectivo' ? 'Efectivo' : method === 'tarjeta' ? 'Tarjeta' : 'QR'}</span>
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
                {order.status === 'completed' ? <CheckCircle size={14} /> : order.status === 'pending' ? <Loader size={14} /> : <Settings size={14} />} {order.status}
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
          <h3><Bell size={18} /> Pedidos Pendientes ({orders.length})</h3>
          <button className="pendingModal__close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="pendingModal__content">
          {orders.length === 0 ? (
            <div className="pendingModal__empty">
              <p><PartyPopper size={20} /> No hay pedidos pendientes</p>
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
                      {processingOrder === order.id ? '...' : <><X size={14} /> Rechazar</>}
                    </Button>
                    <Button
                      size="sm"
                      disabled={processingOrder === order.id}
                      onClick={() => handleAcceptOrder(order.id)}
                    >
                      {processingOrder === order.id ? '...' : <><CheckCircle size={14} /> Aceptar</>}
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