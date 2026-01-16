import { useEffect, useState, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import './OrdersManager.css'
import Card from '../../ui/Card/Card'
import Button from '../../ui/Button/Button'
import Input from '../../ui/Input/Input'
import InfoTooltip from '../../ui/InfoTooltip/InfoTooltip'
import PageTutorialButton from '../PageTutorialButton/PageTutorialButton'
import TutorialSection from '../TutorialSection/TutorialSection'
import ProductDetailModal from '../../storefront/ProductDetailModal/ProductDetailModal'
import { useAppDispatch, useAppSelector } from '../../../app/hooks'
import { selectUser } from '../../../features/auth/authSlice'
import { selectTenantById } from '../../../features/tenants/tenantsSlice'
import { fetchOrdersForTenant, selectOrdersForTenant, createPaidOrder, updateOrder, deleteOrder, markOrderPaid, updateInternalNotes, updateOrderItemsList } from '../../../features/orders/ordersSlice'
import { fetchProductsForTenant, selectProductsForTenant } from '../../../features/products/productsSlice'
import { fetchCategoriesForTenant, selectCategoriesForTenant, patchCategory } from '../../../features/categories/categoriesSlice'
import { fetchExtrasForTenant, selectExtrasForTenant, fetchExtraGroupsForTenant, selectExtraGroupsForTenant } from '../../../features/extras/extrasSlice'
import { fetchDeliveryConfig, updateDeliveryConfig, fetchTenantPauseStatus, updateTenantPauseStatus, fetchTutorialVideo, upsertTutorialVideo } from '../../../lib/supabaseApi'
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient'
import { loadJson, saveJson } from '../../../shared/storage'
import ProductCard from '../../storefront/ProductCard/ProductCard'
import { printBothTickets, printKitchenTicket, printClientTicket, printCombinedTicket } from '../../../lib/ticketPrinter'
import PrintOptionsModal from '../../ui/PrintOptionsModal/PrintOptionsModal'
import {
  RefreshCw,
  Search,
  Pause,
  Play,
  Plus,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle,
  X,
  MapPin,
  DollarSign,
  User,
  Phone,
  MapPinIcon,
  Truck,
  Home,
  UtensilsCrossed,
  Filter,
  ArrowLeft,
  ShoppingCart,
  AlertTriangle,
  Package,
  AlertCircle,
  Infinity,
  Edit2,
  Settings,
  Check,
  Trash2,
  Printer,
  Banknote,
  XCircle,
  MessageSquare,
  Building2,
  CreditCard,
  Smartphone,
  Wallet,
  StickyNote,
  RotateCcw,
} from 'lucide-react'

const DELIVERY_TYPES = {
  mostrador: { label: 'Mostrador', icon: <UtensilsCrossed size={16} /> },
  domicilio: { label: 'A Domicilio', icon: <Truck size={16} /> },
  mesa: { label: 'Mesa', icon: <Home size={16} /> },
}

const STATUS_CONFIG = {
  pending: { 
    color: '#f97316', 
    icon: <Clock size={16} />, 
    label: 'Pendiente',
    gradient: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)'
  },
  in_progress: { 
    color: '#3b82f6', 
    icon: <RefreshCw size={16} />, 
    label: 'En curso',
    gradient: 'linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)'
  },
  completed: { 
    color: '#10b981', 
    icon: <CheckCircle size={16} />, 
    label: 'Completado',
    gradient: 'linear-gradient(135deg, #34d399 0%, #059669 100%)'
  },
  cancelled: { 
    color: '#ef4444', 
    icon: <X size={16} />, 
    label: 'Cancelado',
    gradient: 'linear-gradient(135deg, #f87171 0%, #dc2626 100%)'
  },
}

const PAYMENT_METHODS = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  qr: 'QR (Mercado Pago)',
  transferencia: 'Transferencia',
}

const ORDER_STATUSES = {
  pending: 'Pendiente',
  in_progress: 'En curso',
  completed: 'Completado',
  cancelled: 'Cancelado',
}

export default function OrdersManager({ tenantId }) {
  const dispatch = useAppDispatch()
  const user = useAppSelector(selectUser)
  const tenant = useAppSelector(selectTenantById(tenantId))
  const orders = useAppSelector(selectOrdersForTenant(tenantId))
  const products = useAppSelector(selectProductsForTenant(tenantId))
  const categories = useAppSelector(selectCategoriesForTenant(tenantId))
  const extras = useAppSelector(selectExtrasForTenant(tenantId))
  const extraGroups = useAppSelector(selectExtraGroupsForTenant(tenantId))
  const visibleProducts = useMemo(() => products.filter((p) => p.active), [products])

  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('status') // 'status' o 'delivery'
  const [filterStatus, setFilterStatus] = useState('all') // all, pending, in_progress, completed
  const [filterDelivery, setFilterDelivery] = useState('all') // all, mostrador, domicilio, mesa
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [showStockGlobalModal, setShowStockGlobalModal] = useState(false) // Modal de stock global
  const [showPaymentModal, setShowPaymentModal] = useState(null) // order ID
  const [selectedOrder, setSelectedOrder] = useState(null) // order object for detail modal
  
  // Tutorial video state
  const [tutorialVideo, setTutorialVideo] = useState({ url: '', type: 'youtube' })
  
  // Modo tienda embebida para crear pedido
  const [showCreateStore, setShowCreateStore] = useState(false)
  const [cart, setCart] = useState({}) // { cartItemId: { productId, product, quantity, extras, extrasTotal, unitPrice, totalPrice, comment } }
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [checkoutData, setCheckoutData] = useState({
    customerName: '',
    customerPhone: '',
    deliveryType: 'mostrador',
    deliveryAddress: '',
    deliveryNotes: '',
    paymentMethod: 'efectivo',
  })
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState(null)
  
  // Modal de detalle de producto (para extras)
  const [showProductDetailModal, setShowProductDetailModal] = useState(false)
  const [selectedProductForDetail, setSelectedProductForDetail] = useState(null)
  const [editingCartItemId, setEditingCartItemId] = useState(null)
  
  // Categoría seleccionada para filtrar productos (null = "Todos")
  const [selectedCategory, setSelectedCategory] = useState(null)
  
  // Selección múltiple de pedidos
  const [selectedOrderIds, setSelectedOrderIds] = useState(new Set())
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false)
  
  // Configuración de tipos de envío disponibles (persiste en Supabase o localStorage como fallback)
  const deliveryConfigKey = `deliveryConfig.${tenantId}`
  const [deliveryConfig, setDeliveryConfig] = useState({
    mostrador: true,
    domicilio: true,
    mesa: true,
  })
  const [loadingConfig, setLoadingConfig] = useState(true)
  
  // Estado de pausa de la tienda
  const [showPauseModal, setShowPauseModal] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [pauseMessage, setPauseMessage] = useState('')
  const [pauseLoading, setPauseLoading] = useState(false)
  
  // Estado del modal de stock de productos
  const [showStockProductsModal, setShowStockProductsModal] = useState(false)
  
  // Estado del modal de opciones de impresión
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [printingOrder, setPrintingOrder] = useState(null)
  const [printingOrderIsPaid, setPrintingOrderIsPaid] = useState(false)

  // Cargar configuración desde Supabase al montar
  useEffect(() => {
    const loadConfig = async () => {
      if (!tenantId) return
      setLoadingConfig(true)
      try {
        if (isSupabaseConfigured) {
          const config = await fetchDeliveryConfig(tenantId)
          setDeliveryConfig(config)
          // También guardamos en localStorage como cache
          saveJson(deliveryConfigKey, config)
          
          // Cargar estado de pausa
          const pauseStatus = await fetchTenantPauseStatus(tenantId)
          setIsPaused(pauseStatus.isPaused)
          setPauseMessage(pauseStatus.pauseMessage || '')
        } else {
          // Fallback a localStorage si no hay Supabase
          const cached = loadJson(deliveryConfigKey, { mostrador: true, domicilio: true, mesa: true })
          setDeliveryConfig(cached)
          // Cargar pausa desde localStorage
          const pauseCache = loadJson(`pauseStatus.${tenantId}`, { isPaused: false, pauseMessage: '' })
          setIsPaused(pauseCache.isPaused)
          setPauseMessage(pauseCache.pauseMessage)
        }
      } catch (err) {
        console.error('Error loading delivery config:', err)
        // Fallback a localStorage
        const cached = loadJson(deliveryConfigKey, { mostrador: true, domicilio: true, mesa: true })
        setDeliveryConfig(cached)
      } finally {
        setLoadingConfig(false)
      }
    }
    loadConfig()
  }, [tenantId, deliveryConfigKey])

  // Load tutorial video
  useEffect(() => {
    async function loadTutorial() {
      try {
        const tutorial = await fetchTutorialVideo('orders')
        if (tutorial) {
          setTutorialVideo({ url: tutorial.video_url || '', type: tutorial.video_type || 'youtube' })
        }
      } catch (e) {
        console.warn('Error loading tutorial:', e)
      }
    }
    loadTutorial()
  }, [])

  // Save tutorial video
  const handleSaveTutorial = async (sectionId, videoUrl, videoType) => {
    try {
      await upsertTutorialVideo({ sectionId, videoUrl, videoType })
      setTutorialVideo({ url: videoUrl, type: videoType })
    } catch (e) {
      console.error('Error saving tutorial:', e)
      throw e
    }
  }

  // Helper: Filtrar grupos de extras según la categoría del producto
  const getExtraGroupsForProduct = useCallback((product) => {
    if (!product) return extraGroups
    const productCategoryId = categories.find(c => c.name === product.category)?.id
    return extraGroups.filter(group => {
      const groupCategoryIds = group.categoryIds || []
      return groupCategoryIds.length === 0 || groupCategoryIds.includes(productCategoryId)
    })
  }, [extraGroups, categories])

  // Refrescar pedidos
  const handleRefresh = useCallback(() => {
    if (tenantId) {
      dispatch(fetchOrdersForTenant(tenantId))
      dispatch(fetchProductsForTenant(tenantId))
      dispatch(fetchCategoriesForTenant(tenantId))
      dispatch(fetchExtrasForTenant(tenantId))
      dispatch(fetchExtraGroupsForTenant(tenantId))
    }
  }, [tenantId, dispatch])

  useEffect(() => {
    handleRefresh()
  }, [tenantId, handleRefresh])

  // Suscripción realtime para stock de categorías
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !tenantId) return

    const channel = supabase
      .channel(`admin-categories-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'product_categories',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          // Recargar categorías cuando cambie el stock
          dispatch(fetchCategoriesForTenant(tenantId))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tenantId, dispatch])

  // Funciones del carrito para tienda embebida (con soporte de extras)
  const openProductDetail = useCallback((product) => {
    setSelectedProductForDetail(product)
    setEditingCartItemId(null)
    setShowProductDetailModal(true)
  }, [])

  const addItemToCart = useCallback(({ product, quantity, selectedExtras, extrasTotal, unitPrice, totalPrice, comment }) => {
    const cartItemId = `${product.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    setCart((c) => ({
      ...c,
      [cartItemId]: {
        productId: product.id,
        product,
        quantity,
        extras: selectedExtras || [],
        extrasTotal: extrasTotal || 0,
        unitPrice,
        totalPrice,
        comment: comment || null,
      },
    }))
    setShowProductDetailModal(false)
    setSelectedProductForDetail(null)
  }, [])

  const updateCartItem = useCallback((cartItemId, { quantity, selectedExtras, extrasTotal, unitPrice, totalPrice, comment }) => {
    setCart((c) => {
      if (!c[cartItemId]) return c
      return {
        ...c,
        [cartItemId]: {
          ...c[cartItemId],
          quantity,
          extras: selectedExtras || [],
          extrasTotal: extrasTotal || 0,
          unitPrice,
          totalPrice,
          comment: comment || null,
        },
      }
    })
    setShowProductDetailModal(false)
    setSelectedProductForDetail(null)
    setEditingCartItemId(null)
  }, [])

  const removeCartItem = useCallback((cartItemId) => {
    setCart((c) => {
      const { [cartItemId]: _, ...rest } = c
      return rest
    })
  }, [])

  const incrementCartItem = useCallback((cartItemId) => {
    setCart((c) => {
      if (!c[cartItemId]) return c
      const item = c[cartItemId]
      const newQty = item.quantity + 1
      const newTotal = (item.unitPrice + (item.extrasTotal || 0)) * newQty
      return {
        ...c,
        [cartItemId]: {
          ...item,
          quantity: newQty,
          totalPrice: newTotal,
        },
      }
    })
  }, [])

  const decrementCartItem = useCallback((cartItemId) => {
    setCart((c) => {
      if (!c[cartItemId]) return c
      const item = c[cartItemId]
      const newQty = item.quantity - 1
      if (newQty <= 0) {
        const { [cartItemId]: _, ...rest } = c
        return rest
      }
      const newTotal = (item.unitPrice + (item.extrasTotal || 0)) * newQty
      return {
        ...c,
        [cartItemId]: {
          ...item,
          quantity: newQty,
          totalPrice: newTotal,
        },
      }
    })
  }, [])

  const editCartItem = useCallback((cartItemId) => {
    const item = cart[cartItemId]
    if (!item) return
    setSelectedProductForDetail(item.product)
    setEditingCartItemId(cartItemId)
    setShowProductDetailModal(true)
  }, [cart])

  const clearCart = useCallback(() => {
    setCart({})
  }, [])

  // Calcular items del carrito (nuevo formato)
  const cartItems = useMemo(() => {
    return Object.entries(cart)
      .map(([cartItemId, item]) => {
        if (typeof item !== 'object' || !item.product) return null
        return {
          ...item,
          cartItemId,
          qty: item.quantity,
          lineTotal: item.totalPrice,
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.lineTotal - a.lineTotal)
  }, [cart])

  const cartTotal = useMemo(() => {
    const total = cartItems.reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0)
    return Math.round(total * 100) / 100
  }, [cartItems])
  const cartCount = useMemo(() => cartItems.reduce((sum, item) => sum + item.qty, 0), [cartItems])

  // Calcular cantidad en carrito por producto
  const getProductCartQuantity = useCallback((productId) => {
    return Object.values(cart).reduce((sum, item) => {
      if (typeof item === 'object' && item.productId === productId) {
        return sum + item.quantity
      }
      return sum
    }, 0)
  }, [cart])

  // Payload para crear orden (con extras)
  const orderItemsPayload = useMemo(() => {
    return cartItems.map((item) => ({
      productId: item.product.id,
      product_name: item.product.name,
      name: item.product.name,
      unitPrice: Number(item.unitPrice),
      qty: item.quantity,
      quantity: item.quantity,
      lineTotal: item.totalPrice,
      price: item.unitPrice,
      extras: item.extras?.map((e) => ({ 
        id: e.id, 
        name: e.name, 
        price: e.price,
        quantity: e.quantity || 1,
        selectedOption: e.selectedOption || null,
      })) || [],
      extrasTotal: item.extrasTotal || 0,
      comment: item.comment || null,
    }))
  }, [cartItems])

  // Productos filtrados por categoría
  const filteredProducts = useMemo(() => {
    if (selectedCategory === null) {
      return visibleProducts
    }
    if (selectedCategory === '__unassigned__') {
      return visibleProducts.filter((p) => !p.category)
    }
    return visibleProducts.filter((p) => p.category === selectedCategory)
  }, [visibleProducts, selectedCategory])

  // Manejar checkout desde tienda embebida
  const handleEmbeddedCheckout = async () => {
    if (!checkoutData.customerName.trim() || !checkoutData.customerPhone.trim()) {
      setCheckoutError('Nombre y teléfono son requeridos')
      return
    }

    if (checkoutData.deliveryType === 'domicilio' && !checkoutData.deliveryAddress.trim()) {
      setCheckoutError('La dirección es requerida para delivery')
      return
    }

    setCheckoutLoading(true)
    setCheckoutError(null)

    try {
      await dispatch(
        createPaidOrder({
          tenantId,
          items: orderItemsPayload,
          total: Math.round(cartTotal * 100) / 100,
          customer: {
            name: checkoutData.customerName,
            phone: checkoutData.customerPhone,
          },
          deliveryType: checkoutData.deliveryType,
          deliveryAddress: checkoutData.deliveryType === 'domicilio' ? checkoutData.deliveryAddress : null,
          deliveryNotes: checkoutData.deliveryNotes,
          paymentMethod: checkoutData.paymentMethod,
        }),
      ).unwrap()

      // Éxito - resetear todo
      setCart({})
      setCheckoutData({
        customerName: '',
        customerPhone: '',
        deliveryType: 'mostrador',
        deliveryAddress: '',
        deliveryNotes: '',
        paymentMethod: 'efectivo',
      })
      setIsCheckingOut(false)
      setShowCreateStore(false)
      handleRefresh()
    } catch (e) {
      setCheckoutError(e?.message || 'Error al procesar el pedido')
    } finally {
      setCheckoutLoading(false)
    }
  }

  // Volver de modo tienda
  const handleBackFromStore = () => {
    setShowCreateStore(false)
    setIsCheckingOut(false)
    setCheckoutError(null)
  }

  // Filtrar pedidos
  const filteredOrders = useMemo(() => {
    // Eliminar duplicados por ID
    const uniqueOrders = Array.from(
      new Map(orders.map(o => [o.id, o])).values()
    )
    
    let result = uniqueOrders.filter((o) => {
      const matchesSearch =
        o.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.customer_phone?.includes(searchTerm)
      return matchesSearch
    })

    // Aplicar filtro según el tipo seleccionado
    if (filterType === 'status' && filterStatus !== 'all') {
      result = result.filter((o) => o.status === filterStatus)
    }

    if (filterType === 'delivery' && filterDelivery !== 'all') {
      result = result.filter((o) => o.delivery_type === filterDelivery)
    }

    return result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [orders, searchTerm, filterType, filterStatus, filterDelivery])

  // Pedidos únicos para conteos
  const uniqueOrders = useMemo(() => 
    Array.from(new Map(orders.map(o => [o.id, o])).values()),
    [orders]
  )

  // Contar estados por tipo de envío
  const counts = useMemo(
    () => ({
      all: uniqueOrders.length,
      pending: uniqueOrders.filter((o) => o.status === 'pending').length,
      in_progress: uniqueOrders.filter((o) => o.status === 'in_progress').length,
      completed: uniqueOrders.filter((o) => o.status === 'completed').length,
      cancelled: uniqueOrders.filter((o) => o.status === 'cancelled').length,
      mostrador: uniqueOrders.filter((o) => o.delivery_type === 'mostrador').length,
      domicilio: uniqueOrders.filter((o) => o.delivery_type === 'domicilio').length,
      mesa: uniqueOrders.filter((o) => o.delivery_type === 'mesa').length,
    }),
    [uniqueOrders],
  )

  // Calcular estadísticas de stock y ventas por producto
  const stockStats = useMemo(() => {
    // Obtener productos con stock limitado
    const productsWithStock = products.filter(p => p.stock !== null && p.stock !== undefined)
    
    // Calcular cantidades vendidas por producto desde pedidos completados/en curso
    const soldQuantities = {}
    orders
      .filter(o => o.status === 'completed' || o.status === 'in_progress')
      .forEach(order => {
        const items = order.items || order.order_items || []
        items.forEach(item => {
          const productId = item.product_id
          if (!soldQuantities[productId]) {
            soldQuantities[productId] = 0
          }
          soldQuantities[productId] += item.quantity || 1
        })
      })
    
    // Generar estadísticas por producto
    const stats = productsWithStock.map(product => ({
      id: product.id,
      name: product.name,
      currentStock: product.stock,
      sold: soldQuantities[product.id] || 0,
      isLow: product.stock <= 5 && product.stock > 0,
      isOut: product.stock === 0,
      category: product.category || 'Sin categoría',
    }))
    
    // Ordenar: sin stock primero, luego stock bajo, luego por nombre
    stats.sort((a, b) => {
      if (a.isOut && !b.isOut) return -1
      if (!a.isOut && b.isOut) return 1
      if (a.isLow && !b.isLow) return -1
      if (!a.isLow && b.isLow) return 1
      return a.name.localeCompare(b.name)
    })
    
    return {
      products: stats,
      totalWithStock: productsWithStock.length,
      outOfStock: stats.filter(s => s.isOut).length,
      lowStock: stats.filter(s => s.isLow).length,
    }
  }, [products, orders])

  // Estadísticas de stock global por categoría
  const categoryStockStats = useMemo(() => {
    const catsWithStock = categories.filter(c => c.maxStock !== null && c.maxStock !== undefined)
    return {
      total: catsWithStock.length,
      outOfStock: catsWithStock.filter(c => c.currentStock === 0).length,
      lowStock: catsWithStock.filter(c => c.currentStock > 0 && c.currentStock <= 5).length,
      categories: catsWithStock.map(c => ({
        id: c.id,
        name: c.name,
        current: c.currentStock ?? 0,
        max: c.maxStock,
        isOut: c.currentStock === 0,
        isLow: c.currentStock > 0 && c.currentStock <= 5,
      })).sort((a, b) => {
        if (a.isOut && !b.isOut) return -1
        if (!a.isOut && b.isOut) return 1
        if (a.isLow && !b.isLow) return -1
        if (!a.isLow && b.isLow) return 1
        return a.name.localeCompare(b.name)
      })
    }
  }, [categories])

  const handleToggleDeliveryType = async (type) => {
    const newConfig = {
      ...deliveryConfig,
      [type]: !deliveryConfig[type],
    }
    
    // Actualizar estado local inmediatamente para UX
    setDeliveryConfig(newConfig)
    
    // Guardar en localStorage como cache
    saveJson(deliveryConfigKey, newConfig)
    
    // Guardar en Supabase si está configurado
    if (isSupabaseConfigured) {
      try {
        await updateDeliveryConfig(tenantId, newConfig)
      } catch (err) {
        console.error('Error saving delivery config:', err)
        // Si falla, revertir al estado anterior
        setDeliveryConfig(deliveryConfig)
        saveJson(deliveryConfigKey, deliveryConfig)
      }
    }
  }

  // Guardar estado de pausa (recibe valores del modal)
  const handleSavePauseStatus = async (newIsPaused, newPauseMessage) => {
    setPauseLoading(true)
    try {
      if (isSupabaseConfigured) {
        await updateTenantPauseStatus({ tenantId, isPaused: newIsPaused, pauseMessage: newPauseMessage })
      }
      // Guardar en localStorage como cache/fallback
      saveJson(`pauseStatus.${tenantId}`, { isPaused: newIsPaused, pauseMessage: newPauseMessage })
      // Actualizar estado del componente padre
      setIsPaused(newIsPaused)
      setPauseMessage(newPauseMessage)
      setShowPauseModal(false)
      
      // Emitir evento para que otros componentes (Header) se actualicen
      window.dispatchEvent(new CustomEvent('storePauseChange', {
        detail: { tenantId, isPaused: newIsPaused, pauseMessage: newPauseMessage }
      }))
    } catch (err) {
      console.error('Error saving pause status:', err)
      alert('Error al guardar el estado de pausa. Intenta nuevamente.')
    } finally {
      setPauseLoading(false)
    }
  }

  // Toggle rápido de pausa (sin abrir modal)
  const handleQuickTogglePause = async () => {
    const newPausedState = !isPaused
    setIsPaused(newPausedState)
    
    // Si se está pausando y no hay mensaje, abrir modal
    if (newPausedState && !pauseMessage) {
      setShowPauseModal(true)
      return
    }
    
    // Guardar directamente
    try {
      if (isSupabaseConfigured) {
        await updateTenantPauseStatus({ tenantId, isPaused: newPausedState, pauseMessage })
      }
      saveJson(`pauseStatus.${tenantId}`, { isPaused: newPausedState, pauseMessage })
    } catch (err) {
      console.error('Error toggling pause:', err)
      setIsPaused(!newPausedState) // Revertir
    }
  }

  // =====================
  // FUNCIONES DE SELECCIÓN MÚLTIPLE
  // =====================
  
  // Toggle selección de un pedido
  const toggleOrderSelection = (orderId) => {
    setSelectedOrderIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(orderId)) {
        newSet.delete(orderId)
      } else {
        newSet.add(orderId)
      }
      return newSet
    })
  }

  // Seleccionar/deseleccionar todos los pedidos filtrados
  const toggleSelectAll = () => {
    if (selectedOrderIds.size === filteredOrders.length) {
      setSelectedOrderIds(new Set())
    } else {
      setSelectedOrderIds(new Set(filteredOrders.map((o) => o.id)))
    }
  }

  // Limpiar selección
  const clearSelection = () => {
    setSelectedOrderIds(new Set())
  }

  // Acción masiva: Cambiar estado
  const bulkChangeStatus = async (newStatus) => {
    if (selectedOrderIds.size === 0) return
    setIsBulkActionLoading(true)
    try {
      const promises = Array.from(selectedOrderIds).map((orderId) =>
        dispatch(updateOrder({ tenantId, orderId, newStatus })).unwrap()
      )
      await Promise.all(promises)
      clearSelection()
      // Pequeño delay para que Supabase procese, luego refresh
      setTimeout(() => handleRefresh(), 500)
    } catch (e) {
      console.error('Error en acción masiva:', e)
      handleRefresh()
    } finally {
      setIsBulkActionLoading(false)
    }
  }

  // Acción masiva: Eliminar pedidos
  const bulkDeleteOrders = async () => {
    if (selectedOrderIds.size === 0) return
    if (!confirm(`¿Eliminar ${selectedOrderIds.size} pedido(s)? Esta acción no se puede deshacer.`)) return
    setIsBulkActionLoading(true)
    try {
      const orderIdsToDelete = Array.from(selectedOrderIds)
      
      const results = await Promise.allSettled(
        orderIdsToDelete.map((orderId) =>
          dispatch(deleteOrder({ tenantId, orderId })).unwrap()
        )
      )
      
      const successCount = results.filter(r => r.status === 'fulfilled').length
      const failCount = results.filter(r => r.status === 'rejected').length
      
      if (failCount > 0) {
        alert(`Se eliminaron ${successCount} pedido(s). ${failCount} fallaron.`)
      }
      
      clearSelection()
      // Pequeño delay para que Supabase procese los deletes, luego refresh
      setTimeout(() => handleRefresh(), 500)
    } catch (e) {
      console.error('Error eliminando pedidos:', e)
      alert('Error eliminando pedidos: ' + (e.message || e))
      handleRefresh()
    } finally {
      setIsBulkActionLoading(false)
    }
  }

  // Acción masiva: Marcar como pagados (base de datos)
  const bulkMarkAsPaid = async () => {
    if (selectedOrderIds.size === 0) return
    setIsBulkActionLoading(true)
    try {
      const promises = Array.from(selectedOrderIds).map((orderId) =>
        dispatch(markOrderPaid({ tenantId, orderId, isPaid: true }))
      )
      await Promise.all(promises)
      clearSelection()
    } finally {
      setIsBulkActionLoading(false)
    }
  }

  // Acción masiva: Imprimir todos
  const bulkPrintOrders = () => {
    if (selectedOrderIds.size === 0) return
    const ordersToPrint = orders.filter((o) => selectedOrderIds.has(o.id))
    ordersToPrint.forEach((order, index) => {
      // Delay entre impresiones para evitar bloqueo de popups
      setTimeout(() => {
        printCombinedTicket(order, tenant, {
          thankYouMessage: tenant?.ticket_message || '¡Gracias por tu compra!'
        })
      }, index * 1000)
    })
  }

  // Verificar si todos están seleccionados
  const allSelected = filteredOrders.length > 0 && selectedOrderIds.size === filteredOrders.length

  return (
    <div className="ordersManager">
      
      <div className="ordersManager__header">
        <div className="ordersManager__titleRow">
          <h3 className="ordersManager__title">
            Gestión de Pedidos
            <InfoTooltip 
              text="Aquí gestionas todos los pedidos de tu tienda. Puedes cambiar estados, ver detalles, imprimir tickets y configurar envíos."
              position="right"
              size={16}
            />
          </h3>
          <PageTutorialButton 
            sectionId="tutorial-orders" 
            label="Tutorial"
            hasVideo={Boolean(tutorialVideo.url)}
          />
        </div>

        <div className="ordersManager__actions">
          <InfoTooltip 
            text="Pausa la tienda temporalmente. Los clientes no podrán hacer pedidos mientras esté pausada."
            position="bottom"
            size={14}
          />
          <Button
            variant={isPaused ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setShowPauseModal(true)}
            title={isPaused ? 'Tienda pausada - Click para gestionar' : 'Pausar tienda'}
            className={isPaused ? 'ordersManager__pauseBtn--active' : ''}
          >
            {isPaused ? <Play size={16} /> : <Pause size={16} />}
            {isPaused ? 'Reanudar' : 'Pausar'}
          </Button>
          <InfoTooltip 
            text="Configura los tipos de entrega disponibles: mostrador, delivery o mesa."
            position="bottom"
            size={14}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowConfigModal(true)}
            title="Configurar tipos de envío"
          >
            <Truck size={16} />
            Configurar
          </Button>
          {/* El botón de Stock Global se eliminó - ahora se muestra inline abajo */}
          {stockStats.totalWithStock > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowStockProductsModal(true)}
              title="Ver stock de productos"
              className="ordersManager__stockBtn"
            >
              <Package size={16} />
              <span>Stock Productos</span>
              {stockStats.outOfStock > 0 && (
                <span className="ordersManager__stockBtnBadge ordersManager__stockBtnBadge--danger">
                  {stockStats.outOfStock}
                </span>
              )}
              {stockStats.lowStock > 0 && (
                <span className="ordersManager__stockBtnBadge ordersManager__stockBtnBadge--warning">
                  {stockStats.lowStock}
                </span>
              )}
            </Button>
          )}
          <Button size="sm" onClick={() => setShowCreateStore(true)}>
            <Plus size={16} />
            Crear Pedido
          </Button>
        </div>
      </div>

      {/* Indicador de tienda pausada */}
      {isPaused && (
        <div className="ordersManager__pauseBanner">
          <AlertTriangle size={18} />
          <span>La tienda está pausada. Los clientes no pueden hacer pedidos.</span>
          <button onClick={() => setShowPauseModal(true)}>Gestionar</button>
        </div>
      )}

      {/* TIENDA EMBEBIDA para crear pedido */}
      {showCreateStore && (
        <div className="ordersManager__embeddedStore">
          {/* Header de tienda embebida */}
          <div className="embeddedStore__header">
            <Button variant="secondary" size="sm" onClick={handleBackFromStore}>
              <ArrowLeft size={16} />
              Volver a Pedidos
            </Button>
            <h3 className="embeddedStore__title">Crear Nuevo Pedido</h3>
            {cartCount > 0 && (
              <div className="embeddedStore__cartBadge">
                <ShoppingCart size={16} />
                <span>{cartCount}</span>
              </div>
            )}
          </div>

          {/* Vista de checkout */}
          {isCheckingOut ? (
            <div className="embeddedStore__checkout">
              <div className="embeddedStore__checkoutHeader">
                <Button variant="secondary" size="sm" onClick={() => setIsCheckingOut(false)}>
                  <ArrowLeft size={16} />
                  Volver a Productos
                </Button>
                <h4>Finalizar Pedido</h4>
              </div>

              {/* Resumen del carrito */}
              <div className="embeddedStore__summary">
                <h4>Resumen del Pedido</h4>
                <div className="embeddedStore__items">
                  {cartItems.map((item) => (
                    <div key={item.cartItemId} className="embeddedStore__item">
                      <div className="embeddedStore__itemDetails">
                        <span className="embeddedStore__itemName">{item.product.name}</span>
                        {item.extras && item.extras.length > 0 && (
                          <div className="embeddedStore__itemExtras">
                            {item.extras.map((extra, idx) => (
                              <span key={idx} className="embeddedStore__itemExtra">
                                + {extra.name} {extra.quantity > 1 ? `(x${extra.quantity})` : ''} ${extra.price.toFixed(2)}
                              </span>
                            ))}
                          </div>
                        )}
                        {item.comment && (
                          <span className="embeddedStore__itemComment">
                            <MessageSquare size={12} /> {item.comment}
                          </span>
                        )}
                      </div>
                      <span className="embeddedStore__itemQty">x{item.qty}</span>
                      <span className="embeddedStore__itemPrice">${item.lineTotal.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="embeddedStore__total">
                  <span>Total:</span>
                  <strong>${cartTotal.toFixed(2)}</strong>
                </div>
              </div>

              {/* Formulario de checkout */}
              <div className="embeddedStore__form">
                <div className="embeddedStore__section">
                  <h4><User size={18} /> Datos del Cliente</h4>
                  <Input
                    label="Nombre *"
                    value={checkoutData.customerName}
                    onChange={(v) => setCheckoutData({ ...checkoutData, customerName: v })}
                    placeholder="Nombre del cliente"
                  />
                  <Input
                    label="Teléfono *"
                    value={checkoutData.customerPhone}
                    onChange={(v) => setCheckoutData({ ...checkoutData, customerPhone: v })}
                    placeholder="+54 9 11 2000-0000"
                  />
                </div>

                <div className="embeddedStore__section">
                  <h4><Truck size={18} /> Tipo de Entrega</h4>
                  <div className="embeddedStore__deliveryTypes">
                    {Object.entries(DELIVERY_TYPES).map(([key, { label, icon }]) => {
                      const isEnabled = deliveryConfig[key] !== false
                      return (
                        <button
                          key={key}
                          className={`embeddedStore__deliveryType ${checkoutData.deliveryType === key ? 'embeddedStore__deliveryType--active' : ''} ${!isEnabled ? 'embeddedStore__deliveryType--disabled' : ''}`}
                          onClick={() => isEnabled && setCheckoutData({ ...checkoutData, deliveryType: key })}
                          disabled={!isEnabled}
                        >
                          {icon}
                          <span>{label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {checkoutData.deliveryType === 'domicilio' && (
                  <div className="embeddedStore__section">
                    <Input
                      label="Dirección de Entrega *"
                      value={checkoutData.deliveryAddress}
                      onChange={(v) => setCheckoutData({ ...checkoutData, deliveryAddress: v })}
                      placeholder="Calle, número, apartamento"
                    />
                    <Input
                      label="Notas de Entrega"
                      value={checkoutData.deliveryNotes}
                      onChange={(v) => setCheckoutData({ ...checkoutData, deliveryNotes: v })}
                      placeholder="Timbre roto, portón naranja, etc."
                    />
                  </div>
                )}

                <div className="embeddedStore__section">
                  <h4><Wallet size={18} /> Forma de Pago</h4>
                  <div className="embeddedStore__paymentMethods">
                    {Object.entries(PAYMENT_METHODS).map(([key, label]) => (
                      <button
                        key={key}
                        className={`embeddedStore__paymentMethod ${checkoutData.paymentMethod === key ? 'embeddedStore__paymentMethod--active' : ''}`}
                        onClick={() => setCheckoutData({ ...checkoutData, paymentMethod: key })}
                      >
                        {key === 'efectivo' ? <Banknote size={18} /> : key === 'tarjeta' ? <CreditCard size={18} /> : key === 'qr' ? <Smartphone size={18} /> : <Building2 size={18} />}
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {checkoutError && (
                  <div className="embeddedStore__error">
                    <AlertTriangle size={16} /> {checkoutError}
                  </div>
                )}

                <div className="embeddedStore__actions">
                  <Button variant="secondary" onClick={() => setIsCheckingOut(false)} disabled={checkoutLoading}>
                    Cancelar
                  </Button>
                  <Button onClick={handleEmbeddedCheckout} disabled={checkoutLoading || cartCount === 0}>
                    {checkoutLoading ? 'Procesando...' : `Crear Pedido - $${cartTotal.toFixed(2)}`}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* Vista de productos */
            <div className="embeddedStore__products">
              {/* Navegación por categorías */}
              <div className="embeddedStore__categories">
                <button
                  className={`embeddedStore__categoryBtn ${selectedCategory === null ? 'embeddedStore__categoryBtn--active' : ''}`}
                  onClick={() => setSelectedCategory(null)}
                >
                  Todos ({visibleProducts.length})
                </button>
                {categories.map((cat) => {
                  const count = visibleProducts.filter((p) => p.category === cat.name).length
                  if (count === 0) return null
                  return (
                    <button
                      key={cat.id}
                      className={`embeddedStore__categoryBtn ${selectedCategory === cat.name ? 'embeddedStore__categoryBtn--active' : ''}`}
                      onClick={() => setSelectedCategory(cat.name)}
                    >
                      {cat.name} ({count})
                    </button>
                  )
                })}
                {/* Categoría "Sin asignar" si hay productos sin categoría */}
                {visibleProducts.some((p) => !p.category) && (
                  <button
                    className={`embeddedStore__categoryBtn ${selectedCategory === '__unassigned__' ? 'embeddedStore__categoryBtn--active' : ''}`}
                    onClick={() => setSelectedCategory('__unassigned__')}
                  >
                    Sin asignar ({visibleProducts.filter((p) => !p.category).length})
                  </button>
                )}
              </div>

              <div className="embeddedStore__mainContent">
                <div className="embeddedStore__productsGrid">
                  {filteredProducts.length === 0 ? (
                    <div className="embeddedStore__empty">
                      <p>No hay productos disponibles</p>
                      <p className="muted">Agrega productos desde la sección de Productos</p>
                    </div>
                  ) : (
                    filteredProducts.map((product) => {
                      const productExtraGroups = getExtraGroupsForProduct(product)
                      return (
                        <ProductCard
                          key={product.id}
                          product={product}
                          quantity={getProductCartQuantity(product.id)}
                          onAdd={() => openProductDetail(product)}
                          onRemove={() => {
                            // Remover el primer item de este producto del carrito
                            const cartItemId = Object.keys(cart).find((id) => {
                              const item = cart[id]
                              return typeof item === 'object' && item.productId === product.id
                            })
                            if (cartItemId) decrementCartItem(cartItemId)
                          }}
                          onClick={() => openProductDetail(product)}
                          layout="classic"
                          isEditable={false}
                          hasExtras={productExtraGroups.length > 0 || (product.productExtras?.length > 0)}
                          hasProductExtras={product.productExtras?.length > 0}
                        />
                      )
                    })
                  )}
                </div>

                {/* Carrito lateral */}
                <div className="embeddedStore__cart">
                  <div className="embeddedStore__cartHeader">
                    <h4><ShoppingCart size={18} /> Carrito</h4>
                    {cartCount > 0 && (
                      <Button variant="secondary" size="sm" onClick={clearCart}>
                        Vaciar
                      </Button>
                    )}
                  </div>

                  {cartItems.length === 0 ? (
                    <div className="embeddedStore__cartEmpty">
                      <p className="muted">Agrega productos al carrito</p>
                    </div>
                  ) : (
                    <>
                      <div className="embeddedStore__cartItems">
                        {cartItems.map((item) => (
                          <div key={item.cartItemId} className="embeddedStore__cartItem">
                            {/* Fila superior: nombre y acciones */}
                            <div className="embeddedStore__cartItemRow">
                              <span className="embeddedStore__cartItemName">{item.product.name}</span>
                              <div className="embeddedStore__cartItemActions">
                                <button 
                                  className="embeddedStore__cartItemEdit" 
                                  onClick={() => editCartItem(item.cartItemId)}
                                  title="Editar"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button 
                                  className="embeddedStore__cartItemDelete" 
                                  onClick={() => removeCartItem(item.cartItemId)}
                                  title="Eliminar"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                            
                            {/* Extras y comentarios */}
                            {(item.extras?.length > 0 || item.comment) && (
                              <div className="embeddedStore__cartItemInfo">
                                {item.extras && item.extras.length > 0 && (
                                  <div className="embeddedStore__cartItemExtras">
                                    {item.extras.map((extra, idx) => (
                                      <span key={idx} className="embeddedStore__cartItemExtra">
                                        + {extra.name} {extra.quantity > 1 ? `(x${extra.quantity})` : ''}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {item.comment && (
                                  <span className="embeddedStore__cartItemComment">
                                    <MessageSquare size={12} /> {item.comment}
                                  </span>
                                )}
                              </div>
                            )}
                            
                            {/* Fila inferior: precio, controles y total */}
                            <div className="embeddedStore__cartItemRow">
                              <span className="embeddedStore__cartItemPrice">${item.unitPrice.toFixed(2)} c/u</span>
                              <div className="embeddedStore__cartItemControls">
                                <button onClick={() => decrementCartItem(item.cartItemId)}>−</button>
                                <span>{item.qty}</span>
                                <button onClick={() => incrementCartItem(item.cartItemId)}>+</button>
                              </div>
                              <span className="embeddedStore__cartItemTotal">${item.lineTotal.toFixed(2)}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="embeddedStore__cartFooter">
                        <div className="embeddedStore__cartTotal">
                          <span>Total:</span>
                          <strong>${cartTotal.toFixed(2)}</strong>
                        </div>
                        <Button onClick={() => setIsCheckingOut(true)}>
                          Continuar al Checkout
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Vista normal de pedidos (solo cuando NO estamos en modo tienda) */}
      {!showCreateStore && (
        <>
          {/* Alerta de Stock Global Agotado */}
          {categoryStockStats.outOfStock > 0 && (
            <div className="ordersManager__stockAlert ordersManager__stockAlert--danger">
              <div className="ordersManager__stockAlertIcon">
                <AlertTriangle size={24} />
              </div>
              <div className="ordersManager__stockAlertContent">
                <strong><AlertTriangle size={16} /> ¡Atención! {categoryStockStats.outOfStock === 1 ? 'Una categoría sin stock' : `${categoryStockStats.outOfStock} categorías sin stock`}</strong>
                <p>
                  {categoryStockStats.categories.filter(c => c.isOut).map(c => c.name).join(', ')} 
                  {categoryStockStats.outOfStock === 1 ? ' está agotada' : ' están agotadas'}. 
                  Los clientes no pueden comprar productos de {categoryStockStats.outOfStock === 1 ? 'esta categoría' : 'estas categorías'}.
                </p>
              </div>
              <Button 
                size="sm" 
                onClick={() => setShowStockGlobalModal(true)}
              >
                Gestionar Stock
              </Button>
            </div>
          )}

          {/* Panel de Stock Global en Vivo - Siempre visible */}
          <StockGlobalPanel 
            categories={categories} 
            categoryStockStats={categoryStockStats}
            tenantId={tenantId}
            dispatch={dispatch}
          />
        
          {/* Selector de tipo de filtro + Filtros */}
          <div className="ordersManager__filterGroup">
            <div className="ordersManager__filterHeader">
              <div className="ordersManager__filterSelect">
                <Filter size={16} />
                <select 
                  value={filterType} 
                  onChange={(e) => setFilterType(e.target.value)}
                  className="ordersManager__select"
                >
                  <option value="status">Por Estado</option>
                  <option value="delivery">Por Tipo de Envío</option>
                </select>
                <ChevronDown size={16} className="ordersManager__selectIcon" />
              </div>
            </div>

            {/* Filtros por Estado */}
            {filterType === 'status' && (
              <div className="ordersManager__filters">
                <button
                  className={`ordersManager__filterBtn ${filterStatus === 'all' ? 'ordersManager__filterBtn--active' : ''}`}
                  onClick={() => setFilterStatus('all')}
                >
                  <span>Todos</span>
                  <span className="ordersManager__badge">{counts.all}</span>
                </button>
                <button
                  className={`ordersManager__filterBtn ${filterStatus === 'pending' ? 'ordersManager__filterBtn--active' : ''}`}
                  onClick={() => setFilterStatus('pending')}
                >
                  <Clock size={14} />
                  <span>Pendientes</span>
                  <span className="ordersManager__badge ordersManager__badge--warning">{counts.pending}</span>
                </button>
                <button
                  className={`ordersManager__filterBtn ${filterStatus === 'in_progress' ? 'ordersManager__filterBtn--active' : ''}`}
                  onClick={() => setFilterStatus('in_progress')}
                >
                  <RefreshCw size={14} />
                  <span>En Curso</span>
                  <span className="ordersManager__badge ordersManager__badge--info">{counts.in_progress}</span>
                </button>
                <button
                  className={`ordersManager__filterBtn ${filterStatus === 'completed' ? 'ordersManager__filterBtn--active' : ''}`}
                  onClick={() => setFilterStatus('completed')}
                >
                  <CheckCircle size={14} />
                  <span>Finalizados</span>
                  <span className="ordersManager__badge ordersManager__badge--success">{counts.completed}</span>
                </button>
              </div>
            )}

            {/* Filtros por Tipo de Envío */}
            {filterType === 'delivery' && (
              <div className="ordersManager__filters">
                <button
                  className={`ordersManager__filterBtn ${filterDelivery === 'all' ? 'ordersManager__filterBtn--active' : ''}`}
                  onClick={() => setFilterDelivery('all')}
                >
                  <span>Todos</span>
                  <span className="ordersManager__badge">{counts.all}</span>
                </button>
                {deliveryConfig.mostrador && (
                  <button
                    className={`ordersManager__filterBtn ${filterDelivery === 'mostrador' ? 'ordersManager__filterBtn--active' : ''}`}
                    onClick={() => setFilterDelivery('mostrador')}
                  >
                    <UtensilsCrossed size={14} />
                    <span>Mostrador</span>
                    <span className="ordersManager__badge">{counts.mostrador}</span>
                  </button>
                )}
                {deliveryConfig.domicilio && (
                  <button
                    className={`ordersManager__filterBtn ${filterDelivery === 'domicilio' ? 'ordersManager__filterBtn--active' : ''}`}
                    onClick={() => setFilterDelivery('domicilio')}
                  >
                    <Truck size={14} />
                    <span>Domicilio</span>
                    <span className="ordersManager__badge">{counts.domicilio}</span>
                  </button>
                )}
                {deliveryConfig.mesa && (
                  <button
                    className={`ordersManager__filterBtn ${filterDelivery === 'mesa' ? 'ordersManager__filterBtn--active' : ''}`}
                    onClick={() => setFilterDelivery('mesa')}
                  >
                    <Home size={14} />
                    <span>Mesa</span>
                    <span className="ordersManager__badge">{counts.mesa}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Barra de acciones masivas */}
          {selectedOrderIds.size > 0 && (
            <div className="ordersManager__bulkActions">
              <div className="ordersManager__bulkInfo">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="ordersManager__bulkCheckbox"
                />
                <span>{selectedOrderIds.size} pedido(s) seleccionado(s)</span>
                <button className="ordersManager__bulkClear" onClick={clearSelection}>
                  <X size={14} /> Limpiar
                </button>
              </div>
              <div className="ordersManager__bulkButtons">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => bulkChangeStatus('in_progress')}
                  disabled={isBulkActionLoading}
                >
                  <Play size={14} /> Aceptar
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => bulkChangeStatus('completed')}
                  disabled={isBulkActionLoading}
                >
                  <Check size={14} /> Finalizar
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={bulkMarkAsPaid}
                  disabled={isBulkActionLoading}
                >
                  <Banknote size={14} /> Marcar Pagado
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={bulkPrintOrders}
                  disabled={isBulkActionLoading}
                >
                  <Printer size={14} /> Imprimir
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => bulkChangeStatus('cancelled')}
                  disabled={isBulkActionLoading}
                >
                  <XCircle size={14} /> Cancelar
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={bulkDeleteOrders}
                  disabled={isBulkActionLoading}
                >
                  <Trash2 size={14} /> Eliminar
                </Button>
              </div>
            </div>
          )}

          <div className="ordersManager__searchRow">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRefresh}
              title="Actualizar pedidos"
            >
              <RefreshCw size={16} />
              Actualizar
            </Button>
            <div className="ordersManager__searchBox">
              <Search size={16} />
              <input
                type="text"
                placeholder="Buscar por ID, nombre o teléfono..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="ordersManager__searchInput"
              />
            </div>
          </div>

          {/* Lista de pedidos */}
          <div className="ordersManager__list">
            {/* Header de selección */}
            {filteredOrders.length > 0 && (
              <div className="ordersManager__listHeader">
                <label className="ordersManager__selectAllLabel">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="ordersManager__checkbox"
                  />
                  <span>Seleccionar todos ({filteredOrders.length})</span>
                </label>
              </div>
            )}
            
            {filteredOrders.length === 0 ? (
              <div className="ordersManager__empty">
                <div className="ordersManager__emptyIcon"><Package size={48} /></div>
                <p>No hay pedidos en esta categoría</p>
                <p className="muted">Los pedidos aparecerán aquí cuando se realicen desde la tienda</p>
              </div>
            ) : (
              filteredOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  tenantId={tenantId}
                  tenant={tenant}
                  onOpenDetail={(o) => setSelectedOrder(o)}
                  isSelected={selectedOrderIds.has(order.id)}
                  onToggleSelect={() => toggleOrderSelection(order.id)}
                  onOpenPrintModal={(o, isPaid) => {
                    setPrintingOrder(o)
                    setPrintingOrderIsPaid(isPaid)
                    setShowPrintModal(true)
                  }}
                />
              ))
            )}
          </div>
        </>
      )}

      {/* Modal configurar tipos de envío */}
      {showConfigModal && (
        <ConfigDeliveryModal
          deliveryConfig={deliveryConfig}
          onToggle={handleToggleDeliveryType}
          onClose={() => setShowConfigModal(false)}
        />
      )}

      {/* Modal pausar tienda */}
      {showPauseModal && (
        <PauseStoreModal
          isPaused={isPaused}
          pauseMessage={pauseMessage}
          onSave={handleSavePauseStatus}
          onClose={() => setShowPauseModal(false)}
          loading={pauseLoading}
        />
      )}

      {/* Modal Stock Global por categoría */}
      {showStockGlobalModal && (
        <StockGlobalModal
          categories={categories}
          tenantId={tenantId}
          onClose={() => setShowStockGlobalModal(false)}
        />
      )}

      {/* Modal Stock de Productos */}
      {showStockProductsModal && (
        <StockProductsModal
          stockStats={stockStats}
          onClose={() => setShowStockProductsModal(false)}
        />
      )}

      {/* Modal pagar */}
      {showPaymentModal && (
        <PaymentModal
          order={orders.find((o) => o.id === showPaymentModal)}
          onClose={() => setShowPaymentModal(null)}
          onSuccess={() => {
            setShowPaymentModal(null)
            handleRefresh()
          }}
        />
      )}

      {/* Modal detalle de pedido */}
      {selectedOrder && (
        <OrderDetailModal
          order={orders.find((o) => o.id === selectedOrder.id) || selectedOrder}
          tenantId={tenantId}
          tenant={tenant}
          onClose={() => setSelectedOrder(null)}
          products={products}
          extras={extras}
          extraGroups={extraGroups}
          categories={categories}
          onOpenPrintModal={(o, isPaid) => {
            setPrintingOrder(o)
            setPrintingOrderIsPaid(isPaid)
            setShowPrintModal(true)
          }}
        />
      )}

      {/* Sección de Tutorial */}
      <div id="tutorial-orders">
        <TutorialSection
          sectionId="orders"
          title="Tutorial: Gestión de Pedidos"
          user={user}
          videoUrl={tutorialVideo.url}
          videoType={tutorialVideo.type}
          onSaveVideo={handleSaveTutorial}
        />
      </div>

      {/* Modal de detalle de producto para extras */}
      {showProductDetailModal && selectedProductForDetail && (
        <ProductDetailModal
          product={selectedProductForDetail}
          groups={getExtraGroupsForProduct(selectedProductForDetail)}
          extras={extras}
          onClose={() => {
            setShowProductDetailModal(false)
            setSelectedProductForDetail(null)
            setEditingCartItemId(null)
          }}
          onAddToCart={(itemData) => {
            if (editingCartItemId) {
              updateCartItem(editingCartItemId, itemData)
            } else {
              addItemToCart(itemData)
            }
          }}
          currentCartQuantity={selectedProductForDetail ? getProductCartQuantity(selectedProductForDetail.id) : 0}
          initialQuantity={editingCartItemId && cart[editingCartItemId] ? cart[editingCartItemId].quantity : 1}
          initialExtras={editingCartItemId && cart[editingCartItemId] ? cart[editingCartItemId].extras : []}
          initialComment={editingCartItemId && cart[editingCartItemId] ? cart[editingCartItemId].comment : ''}
          isEditing={!!editingCartItemId}
        />
      )}

      {/* Modal de opciones de impresión */}
      {showPrintModal && printingOrder && (
        <PrintOptionsModal
          order={printingOrder}
          tenant={tenant}
          isPaid={printingOrderIsPaid}
          onClose={() => {
            setShowPrintModal(false)
            setPrintingOrder(null)
            setPrintingOrderIsPaid(false)
          }}
        />
      )}
    </div>
  )
}

// Card de orden individual - Compacta, clic abre modal
function OrderCard({ order, tenantId, tenant, onOpenDetail, isSelected = false, onToggleSelect, onOpenPrintModal }) {
  const dispatch = useAppDispatch()
  const [isUpdating, setIsUpdating] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false)
  const [showTransferConfirm, setShowTransferConfirm] = useState(false)
  const [showNoteTooltip, setShowNoteTooltip] = useState(false)
  const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
  const deliveryType = DELIVERY_TYPES[order.delivery_type] || DELIVERY_TYPES.mostrador
  const paymentMethod = PAYMENT_METHODS[order.payment_method] || order.payment_method

  // Estado de pago confirmado (desde la base de datos)
  const isPaymentConfirmed = order.is_paid === true

  const markAsPaid = async (e) => {
    if (e) e.stopPropagation()
    setIsUpdating(true)
    try {
      await dispatch(markOrderPaid({ tenantId, orderId: order.id, isPaid: true }))
    } finally {
      setIsUpdating(false)
    }
  }

  const markAsUnpaid = async (e) => {
    if (e) e.stopPropagation()
    setIsUpdating(true)
    try {
      await dispatch(markOrderPaid({ tenantId, orderId: order.id, isPaid: false }))
    } finally {
      setIsUpdating(false)
    }
  }

  const handleStatusChange = async (e, newStatus) => {
    if (e) e.stopPropagation()
    setIsUpdating(true)
    try {
      await dispatch(updateOrder({ tenantId, orderId: order.id, newStatus }))
      
      // Al tomar pedido (pasar a in_progress), imprimir tickets automáticamente
      if (newStatus === 'in_progress') {
        // Imprimir ticket combinado (cocina + cliente)
        printCombinedTicket(order, tenant, {
          priority: 'normal',
          isPaid: isPaymentConfirmed,
          thankYouMessage: tenant?.ticket_message || '¡Gracias por tu compra!'
        })
      }
    } finally {
      setIsUpdating(false)
    }
  }

  // Finalizar pedido con lógica de pago y delivery
  const finalizeOrder = async (e) => {
    if (e) e.stopPropagation()
    setIsUpdating(true)
    try {
      // Marcar como pagado automáticamente al finalizar
      if (!isPaymentConfirmed && (order.payment_method === 'efectivo' || order.payment_method === 'transferencia')) {
        markAsPaid()
      }
      await dispatch(updateOrder({ tenantId, orderId: order.id, newStatus: 'completed' }))
      // Solo abrir WhatsApp si es delivery
      if (order.delivery_type === 'domicilio' && order.customer_phone) {
        sendWhatsAppMessage(order.customer_phone, 'Tu pedido lo tiene el delivery y será entregado a la brevedad')
      }
    } finally {
      setIsUpdating(false)
      setShowPaymentConfirm(false)
      setShowTransferConfirm(false)
    }
  }

  const handleCompleteOrder = (e) => {
    e.stopPropagation()
    
    // Si ya confirmó el pago antes, finalizar directamente
    if (isPaymentConfirmed) {
      finalizeOrder(e)
      return
    }
    
    // Si es pago en efectivo, preguntar si pagó
    if (order.payment_method === 'efectivo') {
      setShowPaymentConfirm(true)
      return
    }
    
    // Si es transferencia, preguntar si llegó la transferencia
    if (order.payment_method === 'transferencia') {
      setShowTransferConfirm(true)
      return
    }
    
    // Si pagó con tarjeta/QR, finalizar directamente
    finalizeOrder(e)
  }

  const handleDeleteOrder = async (e) => {
    e.stopPropagation()
    setIsUpdating(true)
    try {
      await dispatch(deleteOrder({ tenantId, orderId: order.id }))
    } finally {
      setIsUpdating(false)
      setShowDeleteConfirm(false)
    }
  }

  // Calcular tiempo transcurrido
  const getTimeAgo = (dateString) => {
    const created = new Date(dateString)
    const now = new Date()
    const diffMs = now - created
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffDays > 0) return `Hace ${diffDays}d`
    if (diffHours > 0) return `Hace ${diffHours}h`
    if (diffMins > 0) return `Hace ${diffMins}m`
    return 'Ahora'
  }

  // Determinar si hay que cobrar (efectivo o transferencia) o ya fue pagado
  const needsManualPayment = order.payment_method === 'efectivo' || order.payment_method === 'transferencia'
  const isDelivery = order.delivery_type === 'domicilio'
  const isOrderCompleted = order.status === 'completed' || order.status === 'cancelled'
  // El pago está confirmado si: el pedido está completado O si el usuario lo marcó manualmente
  const isPaid = isOrderCompleted || isPaymentConfirmed

  return (
    <div className={`orderCard orderCard--redesign ${isSelected ? 'orderCard--selected' : ''}`} onClick={() => onOpenDetail(order)}>
      {/* Barra de estado lateral */}
      <div className="orderCard__statusBar" style={{ backgroundColor: status.color }} />
      
      {/* Contenido principal */}
      <div className="orderCard__main">
        {/* Fila superior: ID + Estado + Tiempo + Checkbox */}
        <div className="orderCard__topRow">
          <div className="orderCard__idSection">
            <span className="orderCard__orderId">#{order.id?.slice(0, 8).toUpperCase()}</span>
            <span className="orderCard__statusBadge" style={{ backgroundColor: status.color + '18', color: status.color }}>
              {status.icon}
              {status.label}
            </span>
          </div>
          {/* Fila de comentarios (si hay) */}
        {(() => {
          const itemsWithComments = order.items?.filter(item => item.comment && item.comment.trim() !== '') || []
          if (itemsWithComments.length === 0) return null
          const firstComment = itemsWithComments[0].comment
          const truncated = firstComment.length > 50 ? firstComment.slice(0, 50) + '...' : firstComment
          return (
            <div className="orderCard__commentRow">
              <div className="orderCard__commentPreview" title={itemsWithComments.map(i => `${i.product_name || i.name}: ${i.comment}`).join('\n')}>
                <MessageSquare size={14} />
                <span className="orderCard__commentText">{truncated}</span>
                {itemsWithComments.length > 1 && (
                  <span className="orderCard__commentMore">+{itemsWithComments.length - 1} más</span>
                )}
              </div>
            </div>
          )
        })()}
          <div className="orderCard__timeSection">
            <Clock size={14} />
            <span>{getTimeAgo(order.created_at)}</span>
          </div>
          <div className="orderCard__selectBox" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggleSelect}
              className="orderCard__checkbox"
            />
          </div>
        </div>

        {/* Fila central: Info del cliente y detalles */}
        <div className="orderCard__middleRow">
          {/* Columna izquierda: Cliente */}
          <div className="orderCard__customerSection">
            <div className="orderCard__customerName">
              <User size={16} />
              <span>{order.customer_name || 'Cliente'}</span>
            </div>
            {order.customer_phone && (
              <div className="orderCard__customerPhone">
                <Phone size={14} />
                <span>{order.customer_phone}</span>
              </div>
            )}
          </div>

          {/* Columna central: Tags (Delivery + Pago) */}
          <div className="orderCard__tagsSection">
            <div className="orderCard__deliveryTag">
              {deliveryType.icon}
              <span>{deliveryType.label}</span>
            </div>
            <div className={`orderCard__paymentTag ${needsManualPayment && !isPaid ? 'orderCard__paymentTag--cash' : ''} ${isPaid && needsManualPayment ? 'orderCard__paymentTag--paid' : ''}`}>
              {order.payment_method === 'efectivo' ? <Banknote size={14} /> : order.payment_method === 'transferencia' ? <Building2 size={14} /> : <CreditCard size={14} />}
              <span>{paymentMethod}</span>
              {needsManualPayment && !isPaid && <span className="orderCard__paymentWarning">COBRAR</span>}
              {needsManualPayment && isPaid && <span className="orderCard__paymentPaid">PAGADO</span>}
            </div>
          </div>

          {/* Columna derecha: Total prominente */}
          <div className="orderCard__totalSection">
            <span className="orderCard__totalLabel">Total</span>
            <span className="orderCard__totalAmount">${Number(order.total).toFixed(2)}</span>
          </div>
        </div>

        

        {/* Fila inferior: Acciones */}
        <div className="orderCard__actionsRow" onClick={(e) => e.stopPropagation()}>
          {/* Botón principal de estado */}
          {order.status === 'pending' && (
            <Button 
              size="sm" 
              disabled={isUpdating}
              onClick={(e) => handleStatusChange(e, 'in_progress')}
              className="orderCard__primaryAction"
            >
              <Check size={16} /> Tomar pedido
            </Button>
          )}
          {order.status === 'in_progress' && (
            <Button 
              size="sm"
              disabled={isUpdating}
              onClick={handleCompleteOrder}
              className="orderCard__primaryAction"
            >
              <Play size={16} /> Finalizar
            </Button>
          )}
          
          {/* Botones de pago - doble acción para efectivo/transferencia */}
          {needsManualPayment && !isOrderCompleted && (
            <div className="orderCard__paymentActions">
              {!isPaid ? (
                <Button 
                  size="sm" 
                  variant="success"
                  disabled={isUpdating}
                  onClick={(e) => {
                    e.stopPropagation()
                    markAsPaid(e)
                  }}
                  title="Marcar como pagado"
                  className="orderCard__paidBtn"
                >
                  <DollarSign size={16} /> Pagó
                </Button>
              ) : (
                <Button 
                  size="sm" 
                  variant="secondary"
                  disabled={isUpdating}
                  onClick={(e) => {
                    e.stopPropagation()
                    markAsUnpaid(e)
                  }}
                  title="Desmarcar pago (error)"
                  className="orderCard__unpaidBtn"
                >
                  <XCircle size={16} /> No pagó
                </Button>
              )}
            </div>
          )}

          {/* Acciones secundarias */}
          <div className="orderCard__secondaryActions">
            {/* Botón de nota (solo si hay nota) */}
            {order.internal_notes && order.internal_notes.trim() && (
              <div className="orderCard__noteWrapper">
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowNoteTooltip(!showNoteTooltip)
                  }}
                  title="Ver nota"
                  className="orderCard__noteBtn"
                >
                  <StickyNote size={16} />
                </Button>
                {showNoteTooltip && (
                  <div className="orderCard__noteTooltip" onClick={(e) => e.stopPropagation()}>
                    <div className="orderCard__noteTooltipHeader">
                      <span>📝 Nota para cocina</span>
                      <button 
                        className="orderCard__noteTooltipClose"
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowNoteTooltip(false)
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="orderCard__noteTooltipContent">
                      {order.internal_notes}
                    </div>
                  </div>
                )}
              </div>
            )}
            <Button 
              size="sm" 
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation()
                onOpenPrintModal(order, isPaymentConfirmed)
              }}
              title="Opciones de impresión"
            >
              <Printer size={16} />
            </Button>
            <Button 
              size="sm" 
              variant="ghost"
              disabled={isUpdating}
              onClick={(e) => {
                e.stopPropagation()
                setShowDeleteConfirm(true)
              }}
              title="Eliminar pedido"
              className="orderCard__deleteBtn"
            >
              <Trash2 size={16} />
            </Button>
          </div>
        </div>
      </div>
      {/* Modal de confirmación de pago en efectivo - Renderizado en portal */}
      {showPaymentConfirm && createPortal(
        <div className="orderCard__deleteConfirm" onClick={(e) => {
          e.stopPropagation()
          setShowPaymentConfirm(false)
        }}>
          <div className="orderCard__deleteConfirmContent orderCard__paymentConfirmContent" onClick={(e) => e.stopPropagation()}>
            <div className="orderCard__paymentIcon"><DollarSign size={16} /></div>
            <h4>¿El cliente pagó este pedido?</h4>
            <p className="orderCard__paymentAmount">Total: <strong>${Number(order.total).toFixed(2)}</strong></p>
            <p className="muted">Pago en efectivo - {isDelivery ? 'Delivery' : 'En el local'}</p>
            <div className="orderCard__deleteConfirmActions">
              <Button 
                size="sm" 
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowPaymentConfirm(false)
                }}
              >
                No, aún no
              </Button>
              <Button 
                size="sm" 
                disabled={isUpdating}
                onClick={(e) => {
                  e.stopPropagation()
                  finalizeOrder(e)
                }}
              >
                {isUpdating ? 'Finalizando...' : `Sí, pagó${isDelivery ? ' (abrir WhatsApp)' : ''}`}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal de confirmación de transferencia - Renderizado en portal */}
      {showTransferConfirm && createPortal(
        <div className="orderCard__deleteConfirm" onClick={(e) => {
          e.stopPropagation()
          setShowTransferConfirm(false)
        }}>
          <div className="orderCard__deleteConfirmContent orderCard__paymentConfirmContent" onClick={(e) => e.stopPropagation()}>
            <div className="orderCard__paymentIcon"><Building2 size={32} /></div>
            <h4>¿Llegó la transferencia?</h4>
            <p className="orderCard__paymentAmount">Total: <strong>${Number(order.total).toFixed(2)}</strong></p>
            <p className="muted">Pago por transferencia - {isDelivery ? 'Delivery' : 'En el local'}</p>
            <div className="orderCard__deleteConfirmActions">
              <Button 
                size="sm" 
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowTransferConfirm(false)
                }}
              >
                No, aún no
              </Button>
              <Button 
                size="sm" 
                disabled={isUpdating}
                onClick={(e) => {
                  e.stopPropagation()
                  finalizeOrder(e)
                }}
              >
                {isUpdating ? 'Finalizando...' : `Sí, llegó${isDelivery ? ' (abrir WhatsApp)' : ''}`}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal de confirmación de eliminación - Renderizado en portal */}
      {showDeleteConfirm && createPortal(
        <div className="orderCard__deleteConfirm" onClick={(e) => {
          e.stopPropagation()
          setShowDeleteConfirm(false)
        }}>
          <div className="orderCard__deleteConfirmContent" onClick={(e) => e.stopPropagation()}>
            <div className="orderCard__paymentIcon"><Trash2 size={32} /></div>
            <h4>¿Eliminar este pedido?</h4>
            <p className="muted">Se eliminará permanentemente de la base de datos</p>
            <div className="orderCard__deleteConfirmActions">
              <Button 
                size="sm" 
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowDeleteConfirm(false)
                }}
              >
                No, volver
              </Button>
              <Button 
                size="sm" 
                variant="danger"
                disabled={isUpdating}
                onClick={handleDeleteOrder}
              >
                {isUpdating ? 'Eliminando...' : 'Sí, eliminar'}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// Modal para pagar
function PaymentModal({ order, onClose, onSuccess }) {
  const [paymentMethod, setPaymentMethod] = useState('efectivo')
  const [saving, setSaving] = useState(false)

  const handlePay = async () => {
    setSaving(true)
    try {
      // Aquí se enviaría a la API para registrar el pago
      alert('Pago registrado exitosamente')
      onSuccess()
    } catch (e) {
      alert('Error: ' + (e?.message || 'No se pudo registrar el pago'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal__overlay">
      <Card
        className="modal__card"
        title="Procesar Pago"
        actions={<button className="modal__close" onClick={onClose}><X size={18} /></button>}
      >
        <div className="modal__content">
          <div className="modal__section">
            <div className="modal__orderSummary">
              <div className="modal__summaryRow">
                <span>Pedido:</span>
                <span>#{order.id?.slice(0, 8).toUpperCase()}</span>
              </div>
              <div className="modal__summaryRow">
                <span>Cliente:</span>
                <span>{order.customer_name}</span>
              </div>
              <div className="modal__summaryRow modal__summaryRow--total">
                <span>Total:</span>
                <span>${Number(order.total).toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="modal__section">
            <h4>Forma de Pago</h4>
            <div className="modal__paymentMethods">
              {Object.entries(PAYMENT_METHODS).map(([key, label]) => (
                <button
                  key={key}
                  className={`modal__paymentMethod ${paymentMethod === key ? 'modal__paymentMethod--active' : ''}`}
                  onClick={() => setPaymentMethod(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="modal__actions">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handlePay} disabled={saving}>
              {saving ? 'Procesando...' : `Pagar $${Number(order.total).toFixed(2)}`}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

// Modal de detalle de pedido completo
function OrderDetailModal({ order, tenantId, tenant, onClose, products = [], extras = [], extraGroups = [], categories = [], onOpenPrintModal }) {
  const dispatch = useAppDispatch()
  const [isUpdating, setIsUpdating] = useState(false)
  const [internalNotes, setInternalNotes] = useState(order.internal_notes || '')
  const [notesChanged, setNotesChanged] = useState(false)
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState('')
  const [productQty, setProductQty] = useState(1)
  const [editedItems, setEditedItems] = useState(order.items || [])
  const [originalItems] = useState(order.items || []) // Guardar items originales al abrir el modal
  const [itemsChanged, setItemsChanged] = useState(false)
  const [selectedExtras, setSelectedExtras] = useState({}) // { extraId: quantity }
  
  // Estados para la vista de tienda embebida
  const [showProductStore, setShowProductStore] = useState(false)
  const [storeSelectedCategory, setStoreSelectedCategory] = useState(null)
  const [storeSelectedProduct, setStoreSelectedProduct] = useState(null)
  const [showStoreProductDetail, setShowStoreProductDetail] = useState(false)
  const [editingCartItemIndex, setEditingCartItemIndex] = useState(null) // Índice del item que se está editando
  
  // Obtener producto seleccionado y sus extras disponibles (para el selector simple)
  const selectedProduct = products.find(p => p.id === selectedProductId)
  const productExtrasFromProduct = selectedProduct?.productExtras || []
  const hasInlineExtras = productExtrasFromProduct.length > 0 && typeof productExtrasFromProduct[0] === 'object'
  const availableExtras = hasInlineExtras 
    ? productExtrasFromProduct.filter(e => e.active !== false)
    : extras.filter(e => productExtrasFromProduct.includes(e.id) && e.active !== false)
  
  // Productos visibles (activos)
  const visibleProducts = useMemo(() => products.filter(p => p.active !== false), [products])
  
  // Helper: Filtrar grupos de extras según la categoría del producto
  const getExtraGroupsForProduct = useCallback((product) => {
    if (!product) return extraGroups
    const productCategoryId = categories.find(c => c.name === product.category)?.id
    return extraGroups.filter(group => {
      const groupCategoryIds = group.categoryIds || []
      return groupCategoryIds.length === 0 || groupCategoryIds.includes(productCategoryId)
    })
  }, [extraGroups, categories])
  
  // Filtrar productos por categoría
  const filteredStoreProducts = useMemo(() => {
    if (storeSelectedCategory === null) return visibleProducts
    if (storeSelectedCategory === '__unassigned__') return visibleProducts.filter(p => !p.category)
    return visibleProducts.filter(p => p.category === storeSelectedCategory)
  }, [visibleProducts, storeSelectedCategory])
  
  // Sincronizar notas cuando cambia el order (pero solo si no hay cambios pendientes)
  useEffect(() => {
    if (!notesChanged) {
      setInternalNotes(order.internal_notes || '')
    }
  }, [order.id, order.internal_notes, notesChanged])
  
  // Sincronizar items cuando cambia el order
  useEffect(() => {
    if (!itemsChanged) {
      setEditedItems(order.items || [])
    }
  }, [order.id, order.items, itemsChanged])
  
  // Limpiar extras al cambiar de producto
  useEffect(() => {
    setSelectedExtras({})
  }, [selectedProductId])
  
  const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
  const deliveryType = DELIVERY_TYPES[order.delivery_type] || DELIVERY_TYPES.mostrador

  // Estado de pago (desde la base de datos)
  const isPaymentConfirmed = order.is_paid === true
  
  // Abrir detalle de producto en la tienda
  const openStoreProductDetail = (product) => {
    setStoreSelectedProduct(product)
    setShowStoreProductDetail(true)
  }
  
  // Agregar producto desde la tienda embebida
  const handleAddFromStore = ({ product, quantity, selectedExtras: extrasFromModal, extrasTotal, unitPrice, totalPrice, comment }) => {
    // Si estamos editando un item existente
    if (editingCartItemIndex !== null) {
      const updatedItems = [...editedItems]
      updatedItems[editingCartItemIndex] = {
        ...updatedItems[editingCartItemIndex],
        price: unitPrice + (extrasTotal || 0),
        unit_price: unitPrice,
        quantity: quantity,
        extras: extrasFromModal || [],
        comment: comment || null
      }
      setEditedItems(updatedItems)
      setEditingCartItemIndex(null)
    } else {
      // Agregar nuevo item
      const newItem = {
        product_id: product.id,
        product_name: product.name,
        price: unitPrice + (extrasTotal || 0),
        unit_price: unitPrice,
        quantity: quantity,
        extras: extrasFromModal || [],
        comment: comment || null
      }
      setEditedItems([...editedItems, newItem])
    }
    
    setItemsChanged(true)
    setShowStoreProductDetail(false)
    setStoreSelectedProduct(null)
  }
  
  // Editar un item del carrito
  const handleEditCartItem = (idx) => {
    const item = editedItems[idx]
    // Buscar el producto original para obtener sus extras disponibles
    const product = products.find(p => p.id === item.product_id)
    if (product) {
      setEditingCartItemIndex(idx)
      setStoreSelectedProduct({
        ...product,
        // Pasar los datos actuales del item para pre-cargar en el modal
        _editData: {
          quantity: item.quantity || item.qty || 1,
          extras: item.extras || [],
          comment: item.comment || ''
        }
      })
      setShowStoreProductDetail(true)
    }
  }
  
  // Editar un item desde la lista normal (sin modo tienda)
  const handleEditItemFromList = (idx) => {
    const item = editedItems[idx]
    // Buscar el producto original para obtener sus extras disponibles
    const product = products.find(p => p.id === (item.product_id || item.productId))
    if (product) {
      setEditingCartItemIndex(idx)
      setStoreSelectedProduct({
        ...product,
        _editData: {
          quantity: item.quantity || item.qty || 1,
          extras: item.extras || [],
          comment: item.comment || ''
        }
      })
      setShowStoreProductDetail(true)
    }
  }
  
  // Agregar producto al pedido (método simple)
  const handleAddProduct = () => {
    if (!selectedProductId) return
    const product = products.find(p => p.id === selectedProductId)
    if (!product) return
    
    // Construir extras seleccionados (buscar en availableExtras que ya tiene la lógica correcta)
    const extrasToAdd = Object.entries(selectedExtras)
      .filter(([_, qty]) => qty > 0)
      .map(([extraId, qty]) => {
        // Buscar primero en availableExtras (puede ser inline o de extras globales)
        const extra = availableExtras.find(e => e.id === extraId)
        return extra ? {
          id: extra.id,
          name: extra.name,
          price: Number(extra.price) || 0,
          quantity: qty
        } : null
      })
      .filter(Boolean)
    
    const extrasTotal = extrasToAdd.reduce((sum, e) => sum + (e.price * e.quantity), 0)
    
    const newItem = {
      product_id: product.id,
      product_name: product.name,
      price: product.price + extrasTotal, // Precio base + extras
      unit_price: product.price,
      quantity: productQty,
      extras: extrasToAdd
    }
    
    setEditedItems([...editedItems, newItem])
    setItemsChanged(true)
    setSelectedProductId('')
    setProductQty(1)
    setSelectedExtras({})
    setShowAddProduct(false)
  }
  
  // Toggle extra
  const handleToggleExtra = (extraId) => {
    setSelectedExtras(prev => ({
      ...prev,
      [extraId]: prev[extraId] ? 0 : 1
    }))
  }
  
  // Cambiar cantidad de extra
  const handleExtraQtyChange = (extraId, delta) => {
    setSelectedExtras(prev => ({
      ...prev,
      [extraId]: Math.max(0, (prev[extraId] || 0) + delta)
    }))
  }
  
  // Eliminar producto del pedido
  const handleRemoveItem = (index) => {
    const newItems = editedItems.filter((_, idx) => idx !== index)
    setEditedItems(newItems)
    setItemsChanged(true)
  }
  
  // Cambiar cantidad de un item
  const handleChangeItemQty = (index, newQty) => {
    if (newQty < 1) return
    const newItems = [...editedItems]
    newItems[index] = { ...newItems[index], quantity: newQty, qty: newQty }
    setEditedItems(newItems)
    setItemsChanged(true)
  }
  
  // Guardar cambios en los items
  const handleSaveItems = async () => {
    if (!itemsChanged) return
    setIsUpdating(true)
    try {
      const newTotal = editedItems.reduce((acc, item) => 
        acc + (Number(item.price || item.unit_price || 0) * (item.quantity || item.qty || 1)), 0
      ) - (order.discount || 0)
      
      await dispatch(updateOrderItemsList({ 
        tenantId, 
        orderId: order.id, 
        items: editedItems, 
        newTotal,
        originalItems // Usar los items originales guardados al abrir el modal
      }))
      setItemsChanged(false)
    } catch (e) {
      console.error('Error guardando items:', e)
    } finally {
      setIsUpdating(false)
    }
  }
  
  // Guardar notas internas
  const handleSaveNotes = async () => {
    if (!notesChanged) return
    setIsUpdating(true)
    try {
      await dispatch(updateInternalNotes({ tenantId, orderId: order.id, notes: internalNotes }))
      setNotesChanged(false)
    } finally {
      setIsUpdating(false)
    }
  }

  // Calcular tiempo transcurrido
  const getTimeAgo = (dateString) => {
    const created = new Date(dateString)
    const now = new Date()
    const diffMs = now - created
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffDays > 0) return `${diffDays} día(s)`
    if (diffHours > 0) return `${diffHours} hora(s)`
    if (diffMins > 0) return `${diffMins} minuto(s)`
    return 'Hace un momento'
  }

  const handleStatusChange = async (newStatus) => {
    setIsUpdating(true)
    try {
      await dispatch(updateOrder({ tenantId, orderId: order.id, newStatus }))
      
      // Al tomar pedido (pasar a in_progress), imprimir tickets automáticamente
      if (newStatus === 'in_progress') {
        printCombinedTicket(order, tenant, {
          priority: 'normal',
          isPaid: isPaymentConfirmed,
          thankYouMessage: tenant?.ticket_message || '¡Gracias por tu compra!'
        })
      }
    } finally {
      setIsUpdating(false)
    }
  }

  const handleCompleteOrder = () => {
    handleStatusChange('completed')
    if (order.customer_phone) {
      sendWhatsAppMessage(order.customer_phone, 'Tu pedido lo tiene el delivery y sera entregado a la brevedad')
    }
  }

  const handleWhatsApp = () => {
    if (order.customer_phone) {
      sendWhatsAppMessage(order.customer_phone, `Hola ${order.customer_name || ''}, te contactamos por tu pedido #${order.id?.slice(0, 8).toUpperCase()}`)
    }
  }

  const handleDeleteOrder = async () => {
    setIsUpdating(true)
    try {
      await dispatch(deleteOrder({ tenantId, orderId: order.id }))
      onClose()
    } catch (e) {
      console.error('Error eliminando pedido:', e)
    } finally {
      setIsUpdating(false)
    }
  }

  // Cálculo de subtotal y descuentos usando editedItems
  const subtotal = editedItems?.reduce((acc, item) => acc + (Number(item.price || item.unit_price || 0) * (item.quantity || item.qty || 1)), 0) || 0
  const discount = order.discount || 0
  const total = itemsChanged ? subtotal - discount : (Number(order.total) || subtotal - discount)

  return (
    <div className="modal__overlay">
      <div className="orderDetailModal">
        {/* Header */}
        <div className="orderDetailModal__header" style={{ background: status.gradient }}>
          <div className="orderDetailModal__titleRow">
            <div className="orderDetailModal__orderInfo">
              <h2>Pedido #{order.id?.slice(0, 8).toUpperCase()}</h2>
              <span 
                className="orderDetailModal__status"
                style={{ backgroundColor: status.color + '20', color: status.color }}
              >
                {status.icon} {status.label}
              </span>
            </div>
            <button className="orderDetailModal__close" onClick={onClose}><X size={18} /></button>
          </div>
          <div className="orderDetailModal__meta">
            <span><Clock size={14} /> {new Date(order.created_at).toLocaleString()}</span>
            <span><Clock size={14} /> {getTimeAgo(order.created_at)}</span>
          </div>
        </div>

        {/* Body - Grid layout de 3 columnas */}
        <div className={`orderDetailModal__body ${showProductStore ? 'orderDetailModal__body--storeMode' : ''}`}>
          {/* Columna Izquierda - Cliente y Entrega (oculta en modo tienda) */}
          {!showProductStore && (
          <div className="orderDetailModal__left">
            {/* Cliente */}
            <div className="orderDetailModal__section">
              <h4><User size={16} /> Cliente</h4>
              <div className="orderDetailModal__row">
                <span>Nombre:</span>
                <strong>{order.customer_name || 'N/A'}</strong>
              </div>
              <div className="orderDetailModal__row">
                <span>Teléfono:</span>
                <div className="orderDetailModal__phoneRow">
                  <strong>{order.customer_phone || 'N/A'}</strong>
                  {order.customer_phone && (
                    <button 
                      className="orderDetailModal__whatsappCircle"
                      onClick={handleWhatsApp}
                      title="Enviar WhatsApp"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              {order.customer_email && (
                <div className="orderDetailModal__row">
                  <span>Email:</span>
                  <strong>{order.customer_email}</strong>
                </div>
              )}
            </div>

            {/* Entrega */}
            <div className="orderDetailModal__section">
              <h4><Truck size={16} /> Entrega</h4>
              <div className="orderDetailModal__row">
                <span>Tipo:</span>
                <strong>{deliveryType.icon} {deliveryType.label}</strong>
              </div>
              {order.delivery_address && (
                <div className="orderDetailModal__row">
                  <span>Dirección:</span>
                  <strong>{order.delivery_address}</strong>
                </div>
              )}
              {order.delivery_notes && (
                <div className="orderDetailModal__row">
                  <span>Notas:</span>
                  <strong>{order.delivery_notes}</strong>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Columna Central - Productos */}
          <div className="orderDetailModal__center">
            {/* Vista de tienda para agregar productos */}
            {showProductStore ? (
              <>
              <div className="orderDetailModal__productStore">
                <div className="orderDetailModal__storeHeader">
                  <button 
                    className="orderDetailModal__storeBack"
                    onClick={() => setShowProductStore(false)}
                  >
                    <ArrowLeft size={16} /> Volver
                  </button>
                  <h4>Agregar Productos</h4>
                </div>
                
                {/* Categorías */}
                <div className="orderDetailModal__storeCategories">
                  <button
                    className={`orderDetailModal__storeCatBtn ${storeSelectedCategory === null ? 'orderDetailModal__storeCatBtn--active' : ''}`}
                    onClick={() => setStoreSelectedCategory(null)}
                  >
                    Todos
                  </button>
                  {categories.filter(c => c.active !== false).map(cat => (
                    <button
                      key={cat.id}
                      className={`orderDetailModal__storeCatBtn ${storeSelectedCategory === cat.name ? 'orderDetailModal__storeCatBtn--active' : ''}`}
                      onClick={() => setStoreSelectedCategory(cat.name)}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
                
                {/* Grid de productos */}
                <div className="orderDetailModal__storeGrid">
                  {filteredStoreProducts.map(product => (
                    <div 
                      key={product.id} 
                      className="orderDetailModal__storeProduct"
                      onClick={() => openStoreProductDetail(product)}
                    >
                      {product.imageUrl && (
                        <img 
                          src={product.imageUrl} 
                          alt={product.name}
                          className="orderDetailModal__storeProductImg"
                        />
                      )}
                      <div className="orderDetailModal__storeProductInfo">
                        <span className="orderDetailModal__storeProductName">{product.name}</span>
                        <span className="orderDetailModal__storeProductPrice">${product.price}</span>
                        {(product.productExtras?.length > 0 || getExtraGroupsForProduct(product).length > 0) && (
                          <span className="orderDetailModal__storeProductExtras">
                            + Extras disponibles
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Modal de detalle del producto */}
                {showStoreProductDetail && storeSelectedProduct && (
                  <ProductDetailModal
                    product={storeSelectedProduct}
                    groups={getExtraGroupsForProduct(storeSelectedProduct)}
                    extras={extras}
                    onClose={() => {
                      setShowStoreProductDetail(false)
                      setStoreSelectedProduct(null)
                      setEditingCartItemIndex(null)
                    }}
                    onAddToCart={handleAddFromStore}
                    currentCartQuantity={0}
                    initialQuantity={storeSelectedProduct._editData?.quantity || 1}
                    initialExtras={storeSelectedProduct._editData?.extras || []}
                    initialComment={storeSelectedProduct._editData?.comment || ''}
                    isEditing={editingCartItemIndex !== null}
                  />
                )}
              </div>
              
              {/* Carrito lateral en modo tienda */}
              <div className="orderDetailModal__storeCart">
                <div className="orderDetailModal__storeCartHeader">
                  <h4><ShoppingCart size={16} /> Carrito ({editedItems?.length || 0})</h4>
                  {itemsChanged && (
                    <button 
                      className="orderDetailModal__saveItemsBtn"
                      onClick={handleSaveItems}
                      disabled={isUpdating}
                    >
                      {isUpdating ? 'Guardando...' : '✓ Guardar'}
                    </button>
                  )}
                </div>
                <div className="orderDetailModal__storeCartItems">
                  {editedItems?.length === 0 ? (
                    <div className="orderDetailModal__storeCartEmpty">
                      <ShoppingCart size={32} />
                      <p>Carrito vacío</p>
                      <span>Selecciona productos para agregar</span>
                    </div>
                  ) : (
                    editedItems?.map((item, idx) => (
                      <div key={idx} className="orderDetailModal__storeCartItem">
                        <div className="orderDetailModal__storeCartItemHeader">
                          <span className="orderDetailModal__storeCartItemName">{item.product_name || item.name}</span>
                          <button 
                            className="orderDetailModal__storeCartEdit"
                            onClick={() => handleEditCartItem(idx)}
                            title="Editar"
                          >
                            <Edit2 size={14} />
                          </button>
                        </div>
                        
                        {/* Extras detallados */}
                        {item.extras && item.extras.length > 0 && (
                          <div className="orderDetailModal__storeCartItemExtrasDetail">
                            {item.extras.map((extra, extraIdx) => (
                              <div key={extraIdx} className="orderDetailModal__storeCartItemExtra">
                                <span className="orderDetailModal__storeCartItemExtraName">
                                  + {extra.name}{extra.selectedOption ? ` (${extra.selectedOption})` : ''}
                                </span>
                                {extra.quantity > 1 && (
                                  <span className="orderDetailModal__storeCartItemExtraQty">x{extra.quantity}</span>
                                )}
                                <span className="orderDetailModal__storeCartItemExtraPrice">
                                  +${(Number(extra.price || 0) * (extra.quantity || 1)).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Comentario */}
                        {item.comment && (
                          <div className="orderDetailModal__storeCartItemComment">
                            <MessageSquare size={12} />
                            <span>{item.comment}</span>
                          </div>
                        )}
                        
                        <div className="orderDetailModal__storeCartItemActions">
                          <div className="orderDetailModal__storeCartQty">
                            <button onClick={() => handleChangeItemQty(idx, (item.quantity || item.qty || 1) - 1)}>-</button>
                            <span>{item.quantity || item.qty}</span>
                            <button onClick={() => handleChangeItemQty(idx, (item.quantity || item.qty || 1) + 1)}>+</button>
                          </div>
                          <span className="orderDetailModal__storeCartItemPrice">
                            ${(Number(item.price || item.unit_price || 0) * (item.quantity || item.qty || 1)).toFixed(2)}
                          </span>
                          <button 
                            className="orderDetailModal__storeCartRemove"
                            onClick={() => handleRemoveItem(idx)}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="orderDetailModal__storeCartTotal">
                  <span>Total:</span>
                  <strong>${subtotal.toFixed(2)}</strong>
                </div>
              </div>
              </>
            ) : (
              /* Vista normal de productos del pedido */
              <div className="orderDetailModal__section">
                <div className="orderDetailModal__sectionHeader">
                  <h4><ShoppingCart size={16} /> Productos ({editedItems?.length || 0})</h4>
                  <div className="orderDetailModal__sectionActions">
                    {itemsChanged && (
                      <button 
                        className="orderDetailModal__saveItemsBtn"
                        onClick={handleSaveItems}
                        disabled={isUpdating}
                      >
                        {isUpdating ? 'Guardando...' : '✓ Guardar'}
                      </button>
                    )}
                    {editedItems?.length > 0 && (
                      <button 
                        className="orderDetailModal__editBtn"
                        onClick={() => setShowProductStore(true)}
                        title="Editar productos del pedido"
                      >
                        <Edit2 size={14} /> Editar
                      </button>
                    )}
                    <button 
                      className="orderDetailModal__addBtn"
                      onClick={() => setShowProductStore(true)}
                    >
                      + Agregar
                    </button>
                  </div>
                </div>
              
              {showAddProduct && (
                <div className="orderDetailModal__addProduct">
                  <div className="orderDetailModal__addProductRow">
                    <select 
                      className="orderDetailModal__productSelect"
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                    >
                      <option value="">Seleccionar producto...</option>
                      {products.filter(p => p.active !== false).map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} - ${p.price} {p.stock !== null && p.stock !== undefined ? `(Stock: ${p.stock})` : ''}
                        </option>
                      ))}
                    </select>
                    <div className="orderDetailModal__qtyControl">
                      <button 
                        className="orderDetailModal__qtyBtn"
                        onClick={() => setProductQty(Math.max(1, productQty - 1))}
                      >-</button>
                      <span>{productQty}</span>
                      <button 
                        className="orderDetailModal__qtyBtn"
                        onClick={() => setProductQty(productQty + 1)}
                      >+</button>
                    </div>
                  </div>
                  
                  {/* Extras disponibles para el producto seleccionado */}
                  {availableExtras.length > 0 && (
                    <div className="orderDetailModal__extrasSection">
                      <span className="orderDetailModal__extrasLabel">Extras disponibles:</span>
                      <div className="orderDetailModal__extrasList">
                        {availableExtras.map(extra => (
                          <div 
                            key={extra.id} 
                            className={`orderDetailModal__extraItem ${selectedExtras[extra.id] > 0 ? 'orderDetailModal__extraItem--selected' : ''}`}
                          >
                            <button 
                              className="orderDetailModal__extraToggle"
                              onClick={() => handleToggleExtra(extra.id)}
                            >
                              <span>{extra.name}</span>
                              <span className="orderDetailModal__extraPrice">+${extra.price}</span>
                            </button>
                            {selectedExtras[extra.id] > 0 && (
                              <div className="orderDetailModal__extraQty">
                                <button onClick={() => handleExtraQtyChange(extra.id, -1)}>-</button>
                                <span>{selectedExtras[extra.id]}</span>
                                <button onClick={() => handleExtraQtyChange(extra.id, 1)}>+</button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <button 
                    className="orderDetailModal__addItemBtn"
                    onClick={handleAddProduct}
                    disabled={!selectedProductId}
                  >
                    + Agregar al pedido
                  </button>
                </div>
              )}

              <div className="orderDetailModal__items">
                {editedItems?.map((item, idx) => (
                  <div key={idx} className="orderDetailModal__item">
                    <div className="orderDetailModal__itemMain">
                      <span className="orderDetailModal__itemName">{item.product_name || item.name}</span>
                      <div className="orderDetailModal__itemQtyControl">
                        <button 
                          className="orderDetailModal__itemQtyBtn"
                          onClick={() => handleChangeItemQty(idx, (item.quantity || item.qty || 1) - 1)}
                        >-</button>
                        <span className="orderDetailModal__itemQty">x{item.quantity || item.qty}</span>
                        <button 
                          className="orderDetailModal__itemQtyBtn"
                          onClick={() => handleChangeItemQty(idx, (item.quantity || item.qty || 1) + 1)}
                        >+</button>
                      </div>
                      <span className="orderDetailModal__itemPrice">
                        ${(Number(item.price || item.unit_price || 0) * (item.quantity || item.qty || 1)).toFixed(2)}
                      </span>
                      <button 
                        className="orderDetailModal__itemEdit"
                        onClick={() => handleEditItemFromList(idx)}
                        title="Editar extras y comentario"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        className="orderDetailModal__itemRemove"
                        onClick={() => handleRemoveItem(idx)}
                        title="Eliminar"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    {/* Extras del producto */}
                    {item.extras && item.extras.length > 0 && (
                      <div className="orderDetailModal__itemExtras">
                        {item.extras.map((extra, extraIdx) => (
                          <div key={extraIdx} className="orderDetailModal__itemExtra">
                            <span className="orderDetailModal__itemExtraName">
                              + {extra.name}{extra.selectedOption ? ` (${extra.selectedOption})` : ''}
                            </span>
                            {extra.quantity > 1 && (
                              <span className="orderDetailModal__itemExtraQty">x{extra.quantity}</span>
                            )}
                            <span className="orderDetailModal__itemExtraPrice">
                              +${(Number(extra.price || 0) * (extra.quantity || 1)).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Comentario del cliente para este producto */}
                    {item.comment && (
                      <div className="orderDetailModal__itemComment">
                        <span className="orderDetailModal__itemCommentIcon"><MessageSquare size={12} /></span>
                        <span className="orderDetailModal__itemCommentText">{item.comment}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              </div>
            )}
            
            {/* Modal de edición de producto (disponible en ambos modos) */}
            {showStoreProductDetail && storeSelectedProduct && !showProductStore && (
              <ProductDetailModal
                product={storeSelectedProduct}
                groups={getExtraGroupsForProduct(storeSelectedProduct)}
                extras={extras}
                onClose={() => {
                  setShowStoreProductDetail(false)
                  setStoreSelectedProduct(null)
                  setEditingCartItemIndex(null)
                }}
                onAddToCart={handleAddFromStore}
                currentCartQuantity={0}
                initialQuantity={storeSelectedProduct._editData?.quantity || 1}
                initialExtras={storeSelectedProduct._editData?.extras || []}
                initialComment={storeSelectedProduct._editData?.comment || ''}
                isEditing={editingCartItemIndex !== null}
              />
            )}
          </div>

          {/* Columna Derecha - Totales y Notas */}
          <div className="orderDetailModal__right">
            {/* Totales */}
            <div className="orderDetailModal__section orderDetailModal__section--totals">
              <h4><DollarSign size={16} /> Resumen</h4>
              <div className="orderDetailModal__row">
                <span>Subtotal:</span>
                <strong>${subtotal.toFixed(2)}</strong>
              </div>
              {discount > 0 && (
                <div className="orderDetailModal__row orderDetailModal__row--discount">
                  <span>Descuento:</span>
                  <strong>-${discount.toFixed(2)}</strong>
                </div>
              )}
              <div className="orderDetailModal__row orderDetailModal__row--total">
                <span>TOTAL:</span>
                <strong>${total.toFixed(2)}</strong>
              </div>
              {order.payment_method && (
                <div className="orderDetailModal__row">
                  <span>Método de pago:</span>
                  <strong>{PAYMENT_METHODS[order.payment_method] || order.payment_method}</strong>
                </div>
              )}
              <div className="orderDetailModal__row">
                <span>Estado de pago:</span>
                <strong className={isPaymentConfirmed ? 'orderDetailModal__paymentPaid' : 'orderDetailModal__paymentPending'}>
                  {isPaymentConfirmed ? <><CheckCircle size={14} /> Pagado</> : <><Clock size={14} /> Pendiente</>}
                </strong>
              </div>
            </div>

            {/* Comentario interno para cocina */}
            <div className="orderDetailModal__section">
              <div className="orderDetailModal__sectionHeader">
                <h4><MessageSquare size={16} /> Nota para cocina</h4>
                {notesChanged && (
                  <button 
                    className="orderDetailModal__saveNoteBtn"
                    onClick={handleSaveNotes}
                    disabled={isUpdating}
                  >
                    {isUpdating ? 'Guardando...' : 'Guardar'}
                  </button>
                )}
              </div>
              <textarea
                className="orderDetailModal__comment"
                value={internalNotes}
                onChange={(e) => {
                  setInternalNotes(e.target.value)
                  setNotesChanged(true)
                }}
                placeholder="Ej: Sin sal, bien cocida, alergia a maní..."
                rows="3"
              />
            </div>
          </div>
        </div>

        {/* Footer - Acciones */}
        <div className="orderDetailModal__footer">
          {/* Acciones principales según estado */}
          <div className="orderDetailModal__primaryActions">
            {order.status === 'pending' && (
              <>
                <button 
                  className="orderDetailModal__btn orderDetailModal__btn--primary"
                  disabled={isUpdating}
                  onClick={() => handleStatusChange('in_progress')}
                >
                  <Play size={18} />
                  <span>Tomar Pedido</span>
                </button>
                <button 
                  className="orderDetailModal__btn orderDetailModal__btn--danger"
                  disabled={isUpdating}
                  onClick={() => handleStatusChange('cancelled')}
                >
                  <XCircle size={18} />
                  <span>Rechazar</span>
                </button>
              </>
            )}
            {order.status === 'in_progress' && (
              <>
                <button 
                  className="orderDetailModal__btn orderDetailModal__btn--success"
                  disabled={isUpdating}
                  onClick={handleCompleteOrder}
                >
                  <Check size={18} />
                  <span>Finalizar</span>
                </button>
                <button 
                  className="orderDetailModal__btn orderDetailModal__btn--danger"
                  disabled={isUpdating}
                  onClick={() => handleStatusChange('cancelled')}
                >
                  <XCircle size={18} />
                  <span>Cancelar</span>
                </button>
              </>
            )}
            {order.status === 'completed' && (
              <div className="orderDetailModal__statusBadge orderDetailModal__statusBadge--completed">
                <CheckCircle size={18} />
                <span>Completado</span>
              </div>
            )}
            {order.status === 'cancelled' && (
              <>
                <div className="orderDetailModal__statusBadge orderDetailModal__statusBadge--cancelled">
                  <XCircle size={18} />
                  <span>Cancelado</span>
                </div>
                <button 
                  className="orderDetailModal__btn orderDetailModal__btn--restore"
                  disabled={isUpdating}
                  onClick={() => handleStatusChange('pending')}
                >
                  <RotateCcw size={18} />
                  <span>Restaurar</span>
                </button>
              </>
            )}
          </div>
          
          {/* Acciones secundarias */}
          <div className="orderDetailModal__secondaryActions">
            <button 
              className="orderDetailModal__btn orderDetailModal__btn--icon"
              onClick={() => onOpenPrintModal(order, isPaymentConfirmed)}
              title="Imprimir"
            >
              <Printer size={18} />
            </button>
            <button 
              className="orderDetailModal__btn orderDetailModal__btn--icon orderDetailModal__btn--iconDanger"
              onClick={() => setShowDeleteConfirm(true)}
              title="Eliminar"
            >
              <Trash2 size={18} />
            </button>
            <button 
              className="orderDetailModal__btn orderDetailModal__btn--close"
              onClick={onClose}
            >
              Cerrar
            </button>
          </div>
        </div>

        {/* Modal de confirmación de eliminación */}
        {showDeleteConfirm && (
          <div className="orderCard__deleteConfirm" onClick={(e) => {
            e.stopPropagation()
            setShowDeleteConfirm(false)
          }}>
            <div className="orderCard__deleteConfirmContent" onClick={(e) => e.stopPropagation()}>
              <div className="orderCard__paymentIcon"><Trash2 size={32} /></div>
              <h4>¿Eliminar este pedido?</h4>
              <p className="orderCard__paymentAmount">Pedido #{order.id?.slice(0, 8).toUpperCase()}</p>
              <p className="muted">Esta acción eliminará el pedido de la base de datos permanentemente</p>
              <div className="orderCard__deleteConfirmActions">
                <Button 
                  size="sm" 
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowDeleteConfirm(false)
                  }}
                >
                  No, cancelar
                </Button>
                <Button 
                  size="sm" 
                  variant="danger"
                  disabled={isUpdating}
                  onClick={handleDeleteOrder}
                >
                  {isUpdating ? 'Eliminando...' : 'Sí, eliminar'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Modal para configurar tipos de envío
function ConfigDeliveryModal({ deliveryConfig, onToggle, onClose }) {
  const deliveryTypes = [
    {
      key: 'mostrador',
      label: 'Retira en Mostrador',
      icon: <UtensilsCrossed size={24} />,
      description: 'El cliente retira su pedido en el mostrador',
      color: '#f97316',
    },
    {
      key: 'domicilio',
      label: 'A Domicilio',
      icon: <Truck size={24} />,
      description: 'Se entrega en el domicilio del cliente',
      color: '#3b82f6',
    },
    {
      key: 'mesa',
      label: 'Para Comer en Mesa',
      icon: <Home size={24} />,
      description: 'El cliente come en la mesa del local',
      color: '#10b981',
    },
  ]

  const enabledCount = Object.values(deliveryConfig).filter(Boolean).length

  return (
    <div className="modal__overlay">
      <Card
        className="modal__card"
        title="Configurar Tipos de Envío"
        actions={<button className="modal__close" onClick={onClose}><X size={18} /></button>}
      >
        <div className="modal__content">
          <p className="muted" style={{ marginBottom: '20px' }}>
            Habilita los tipos de envío que ofreces. Los deshabilitados no aparecerán en la tienda.
          </p>

          <div className="deliveryConfig__list">
            {deliveryTypes.map((type) => (
              <div key={type.key} className="deliveryConfig__item">
                <div className="deliveryConfig__icon" style={{ color: type.color }}>
                  {type.icon}
                </div>
                <div className="deliveryConfig__info">
                  <h4 className="deliveryConfig__label">{type.label}</h4>
                  <p className="deliveryConfig__description">{type.description}</p>
                </div>
                <button
                  className={`deliveryConfig__toggle ${deliveryConfig[type.key] ? 'deliveryConfig__toggle--on' : ''}`}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onToggle(type.key)
                  }}
                  title={deliveryConfig[type.key] ? 'Habilitado' : 'Deshabilitado'}
                >
                  <span className="deliveryConfig__toggleCircle" />
                </button>
              </div>
            ))}
          </div>

          {enabledCount === 0 && (
            <div className="deliveryConfig__warning">
              <p><AlertTriangle size={16} /> Debes habilitar al menos un tipo de envío</p>
            </div>
          )}

          <div className="modal__actions">
            <Button variant="secondary" onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onClose()
            }}>
              Cerrar
            </Button>
            <Button disabled={enabledCount === 0} onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onClose()
            }}>
              <Check size={16} /> Guardar Configuración
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

// Modal para pausar la tienda
function PauseStoreModal({ isPaused: initialIsPaused, pauseMessage: initialPauseMessage, onSave, onClose, loading }) {
  // Estados internos del modal (se resetean al cerrar)
  const [localIsPaused, setLocalIsPaused] = useState(initialIsPaused)
  const [localPauseMessage, setLocalPauseMessage] = useState(initialPauseMessage)
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false)
  
  // Verificar si hay cambios sin guardar
  const hasChanges = localIsPaused !== initialIsPaused || localPauseMessage !== initialPauseMessage
  
  // Prevenir cierre del modal al hacer clic dentro
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }
  
  // Manejar cierre: si hay cambios, mostrar advertencia
  const handleClose = () => {
    if (hasChanges) {
      setShowUnsavedWarning(true)
      return
    }
    onClose()
  }
  
  // Descartar cambios y cerrar
  const handleDiscardChanges = () => {
    setShowUnsavedWarning(false)
    onClose()
  }
  
  // Guardar cambios
  const handleSave = () => {
    onSave(localIsPaused, localPauseMessage)
  }

  return (
    <div className="modal__overlay">
      <div
        className="pauseModal__card"
      >
        <div className="pauseModal__header">
          <h3>{localIsPaused ? <><Pause size={18} /> Tienda Pausada</> : <><Play size={18} /> Tienda Activa</>}</h3>
          <button className="modal__close" onClick={handleClose} type="button"><X size={18} /></button>
        </div>
        <div className="pauseModal__body">
          <p className="muted" style={{ marginBottom: '20px' }}>
            {localIsPaused 
              ? 'La tienda está pausada. Los clientes verán el mensaje personalizado y no podrán hacer pedidos.'
              : 'La tienda está activa. Los clientes pueden hacer pedidos normalmente.'}
          </p>

          <div className="pauseModal__toggle">
            <span className="pauseModal__toggleLabel">Estado de la tienda:</span>
            <label className={`pauseModal__switch ${localIsPaused ? 'pauseModal__switch--paused' : 'pauseModal__switch--active'}`}>
              <input
                type="checkbox"
                checked={!localIsPaused}
                onChange={() => setLocalIsPaused(!localIsPaused)}
              />
              <span className="pauseModal__switchSlider"></span>
            </label>
            <span className={`pauseModal__storeStatus ${localIsPaused ? 'pauseModal__storeStatus--paused' : 'pauseModal__storeStatus--active'}`}>
              {localIsPaused ? 'PAUSADA' : 'ACTIVA'}
            </span>
          </div>

          {localIsPaused && (
            <div className="pauseModal__messageSection">
              <label className="pauseModal__label">
                Mensaje para los clientes:
              </label>
              <textarea
                className="pauseModal__textarea"
                value={localPauseMessage}
                onChange={(e) => setLocalPauseMessage(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
                placeholder="Ej: Estamos cerrados por vacaciones. Volvemos el 2 de enero. ¡Gracias por tu paciencia!"
                rows={4}
              />
              <p className="pauseModal__hint">
                Este mensaje se mostrará a los clientes cuando intenten acceder a tu tienda.
              </p>
            </div>
          )}

          <div className="pauseModal__preview">
            <h4>Vista previa:</h4>
            <div className={`pauseModal__previewBox ${localIsPaused ? 'pauseModal__previewBox--paused' : ''}`}>
              {localIsPaused ? (
                <>
                  <AlertTriangle size={32} />
                  <strong>Tienda temporalmente no disponible</strong>
                  <p>{localPauseMessage || 'La tienda está temporalmente cerrada. Por favor, vuelve más tarde.'}</p>
                </>
              ) : (
                <>
                  <CheckCircle size={32} />
                  <strong>Tienda abierta</strong>
                  <p>Los clientes pueden hacer pedidos normalmente.</p>
                </>
              )}
            </div>
          </div>

          <div className="pauseModal__actions">
            <Button variant="secondary" onClick={handleClose} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? 'Guardando...' : <><Check size={16} /> Guardar Cambios</>}
            </Button>
          </div>
        </div>
      </div>

      {/* Modal de advertencia de cambios sin guardar */}
      {showUnsavedWarning && (
        <div className="pauseModal__warningOverlay" onClick={(e) => e.stopPropagation()}>
          <div className="pauseModal__warningCard">
            <div className="pauseModal__warningIcon">
              <AlertTriangle size={40} />
            </div>
            <h4 className="pauseModal__warningTitle">Cambios sin guardar</h4>
            <p className="pauseModal__warningText">
              Has modificado el estado de la tienda pero no has guardado los cambios.
            </p>
            <div className="pauseModal__warningActions">
              <Button 
                variant="secondary" 
                size="sm"
                onClick={handleDiscardChanges}
              >
                Descartar cambios
              </Button>
              <Button 
                size="sm"
                onClick={() => {
                  setShowUnsavedWarning(false)
                  handleSave()
                }}
                disabled={loading}
              >
                {loading ? 'Guardando...' : 'Guardar y salir'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Modal para configurar stock global por categoría
// Solo muestra categorías que tienen productos DIRECTAMENTE (categorías "hoja")
function StockGlobalModal({ categories, tenantId, onClose }) {
  const dispatch = useAppDispatch()
  const allProducts = useAppSelector(selectProductsForTenant(tenantId))
  const [loading, setLoading] = useState(false)
  const [feedbackModal, setFeedbackModal] = useState(null) // { type: 'success' | 'error', message: string }
  
  // Filtrar solo categorías que pueden tener stock:
  // 1. No tienen subcategorías (hasChildren = false)
  // 2. Tienen productos directamente asignados
  const leafCategoriesWithProducts = useMemo(() => {
    return categories.filter(cat => {
      // Si tiene hijos (subcategorías), no puede tener stock configurado
      const hasChildren = cat.hasChildren || categories.some(c => c.parentId === cat.id)
      if (hasChildren) return false
      
      // Verificar que tenga productos directamente
      const hasProducts = allProducts.some(p => 
        p.categoryId === cat.id || 
        p.subcategoryId === cat.id ||
        (p.category === cat.name && !p.subcategoryId)
      )
      
      return hasProducts
    })
  }, [categories, allProducts])
  
  const [localCategories, setLocalCategories] = useState(
    leafCategoriesWithProducts.map(cat => ({
      ...cat,
      maxStock: cat.maxStock ?? null,
      currentStock: cat.currentStock ?? null,
      isUnlimited: cat.maxStock === null || cat.maxStock === undefined
    }))
  )

  const handleToggleUnlimited = (catId) => {
    setLocalCategories(prev => prev.map(cat => {
      if (cat.id === catId) {
        const newUnlimited = !cat.isUnlimited
        // Al cambiar a limitado, NO resetear currentStock si ya tiene valor
        // Solo usar maxStock como default si nunca tuvo stock configurado
        const defaultMax = cat.maxStock || 100
        return {
          ...cat,
          isUnlimited: newUnlimited,
          maxStock: newUnlimited ? null : defaultMax,
          // IMPORTANTE: Preservar currentStock si ya existe, no reiniciar
          currentStock: newUnlimited ? null : (cat.currentStock !== null && cat.currentStock !== undefined ? cat.currentStock : defaultMax)
        }
      }
      return cat
    }))
  }

  // Cambiar el stock máximo (límite)
  const handleChangeMaxStock = (catId, value) => {
    const numValue = parseInt(value, 10)
    if (isNaN(numValue) || numValue < 0) return
    
    setLocalCategories(prev => prev.map(cat => {
      if (cat.id === catId) {
        return { ...cat, maxStock: numValue }
      }
      return cat
    }))
  }

  // Reiniciar el stock actual al máximo
  const handleResetStock = (catId) => {
    setLocalCategories(prev => prev.map(cat => {
      if (cat.id === catId) {
        return { ...cat, currentStock: cat.maxStock }
      }
      return cat
    }))
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      // Guardar cambios de cada categoría
      for (const cat of localCategories) {
        const originalCat = categories.find(c => c.id === cat.id)
        const patch = {}
        
        // Solo actualizar max_stock si cambió
        if (cat.isUnlimited) {
          patch.max_stock = null
          patch.current_stock = null
        } else {
          patch.max_stock = cat.maxStock
          // Solo actualizar current_stock si fue reiniciado explícitamente
          // (comparando con el valor original)
          if (cat.currentStock !== originalCat?.currentStock) {
            patch.current_stock = cat.currentStock
          }
        }
        
        await dispatch(patchCategory({
          tenantId,
          categoryId: cat.id,
          patch
        })).unwrap()
      }
      setFeedbackModal({
        type: 'success',
        message: 'La configuración de stock se guardó correctamente.'
      })
    } catch (error) {
      console.error('Error guardando stock:', error)
      setFeedbackModal({
        type: 'error',
        message: 'Hubo un error al guardar la configuración de stock. Por favor, intenta nuevamente.'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCloseFeedback = () => {
    if (feedbackModal?.type === 'success') {
      setFeedbackModal(null)
      onClose()
    } else {
      setFeedbackModal(null)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    }
  }

  return (
    <div className="modal__overlay">
      <Card
        className="modal__card"
        title="Stock Global por Categoría"
        actions={<button className="modal__close" onClick={onClose}><X size={18} /></button>}
      >
        <div className="modal__content">
          <p className="muted" style={{ marginBottom: '20px' }}>
            Configura el stock máximo por categoría. El stock actual se resta automáticamente con cada venta.
          </p>
          
          {localCategories.length === 0 ? (
            <p className="muted" style={{ textAlign: 'center', padding: '20px' }}>No hay categorías disponibles.</p>
          ) : (
            <div className="stockConfig__list">
              {localCategories.map(cat => (
                <div key={cat.id} className="stockConfig__item">
                  <div className="stockConfig__icon">
                    <Package size={24} />
                  </div>
                  <div className="stockConfig__info">
                    <h4 className="stockConfig__label">
                      {cat.name}
                      {!cat.isUnlimited && cat.currentStock === 0 && (
                        <span className="stockConfig__outBadge">Sin stock</span>
                      )}
                    </h4>
                    <p className="stockConfig__description">
                      {cat.isUnlimited ? (
                        <span style={{ color: '#10b981' }}>∞ Stock ilimitado</span>
                      ) : (
                        <span>
                          Actual: <strong style={{ color: cat.currentStock === 0 ? '#dc2626' : cat.currentStock <= 5 ? '#f59e0b' : '#10b981' }}>{cat.currentStock ?? 0}</strong> / Máx: {cat.maxStock ?? 0}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="stockConfig__controls">
                    {!cat.isUnlimited && (
                      <>
                        <div className="stockConfig__inputWrapper stockConfig__inputWrapper--visible">
                          <label className="stockConfig__inputLabel">Máx:</label>
                          <input
                            type="number"
                            min="0"
                            value={cat.maxStock ?? 0}
                            onChange={(e) => handleChangeMaxStock(cat.id, e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="stockConfig__inlineInput"
                            placeholder="Máx"
                          />
                        </div>
                        <button
                          className="stockConfig__resetBtn"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleResetStock(cat.id)
                          }}
                          title="Reiniciar stock al máximo"
                          disabled={cat.currentStock === cat.maxStock}
                        >
                          <RefreshCw size={14} />
                        </button>
                      </>
                    )}
                    <button
                      className={`stockConfig__toggle ${cat.isUnlimited ? 'stockConfig__toggle--on' : ''}`}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleToggleUnlimited(cat.id)
                      }}
                      title={cat.isUnlimited ? 'Ilimitado' : 'Limitado'}
                    >
                      <span className="stockConfig__toggleCircle">
                        {cat.isUnlimited ? <Infinity size={12} /> : null}
                      </span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="modal__actions">
            <Button variant="secondary" onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onClose()
            }} disabled={loading}>
              Cerrar
            </Button>
            <Button onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleSave()
            }} disabled={loading}>
              {loading ? 'Guardando...' : <><Check size={16} /> Guardar Configuración</>}
            </Button>
          </div>
        </div>
      </Card>

      {/* Modal de feedback */}
      {feedbackModal && (
        <div className="modal__overlay stockFeedback__overlay">
          <Card
            className="modal__card stockFeedback__card"
            title={feedbackModal.type === 'success' ? 'Guardado' : 'Error'}
            actions={<button className="modal__close" onClick={handleCloseFeedback}><X size={18} /></button>}
          >
            <div className="modal__content">
              <div className={`stockFeedback__icon ${feedbackModal.type === 'success' ? 'stockFeedback__icon--success' : 'stockFeedback__icon--error'}`}>
                {feedbackModal.type === 'success' ? <CheckCircle size={48} /> : <AlertTriangle size={48} />}
              </div>
              <p className="stockFeedback__message">{feedbackModal.message}</p>
              <div className="modal__actions" style={{ justifyContent: 'center' }}>
                <Button onClick={handleCloseFeedback}>
                  {feedbackModal.type === 'success' ? 'Continuar' : 'Cerrar'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

// Modal para ver stock de productos
function StockProductsModal({ stockStats, onClose }) {
  const [filter, setFilter] = useState('all') // 'all', 'out', 'low'
  
  // Filtrar productos según selección
  const filteredProducts = stockStats.products.filter(product => {
    if (filter === 'out') return product.isOut
    if (filter === 'low') return product.isLow && !product.isOut
    return true
  })

  return (
    <div className="modal__overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="stockProductsModal">
        <div className="stockProductsModal__header">
          <h3>Stock de Productos</h3>
          <button className="modal__close" onClick={onClose}><X size={18} /></button>
        </div>
        
        <div className="stockProductsModal__body">
          {/* Badges de filtro clickeables */}
          <div className="stockProducts__filters">
            <button 
              className={`stockProducts__filterBtn ${filter === 'all' ? 'stockProducts__filterBtn--active' : ''}`}
              onClick={() => setFilter('all')}
            >
              <Package size={18} />
              <span className="stockProducts__filterValue">{stockStats.totalWithStock}</span>
              <span className="stockProducts__filterLabel">Con stock</span>
            </button>
            {stockStats.outOfStock > 0 && (
              <button 
                className={`stockProducts__filterBtn stockProducts__filterBtn--danger ${filter === 'out' ? 'stockProducts__filterBtn--active' : ''}`}
                onClick={() => setFilter('out')}
              >
                <AlertCircle size={18} />
                <span className="stockProducts__filterValue">{stockStats.outOfStock}</span>
                <span className="stockProducts__filterLabel">Sin stock</span>
              </button>
            )}
            {stockStats.lowStock > 0 && (
              <button 
                className={`stockProducts__filterBtn stockProducts__filterBtn--warning ${filter === 'low' ? 'stockProducts__filterBtn--active' : ''}`}
                onClick={() => setFilter('low')}
              >
                <AlertTriangle size={18} />
                <span className="stockProducts__filterValue">{stockStats.lowStock}</span>
                <span className="stockProducts__filterLabel">Stock bajo</span>
              </button>
            )}
          </div>

          {/* Lista de productos */}
          <div className="stockProducts__listContainer">
            {filteredProducts.length > 0 ? (
              <div className="stockProducts__list">
                {filteredProducts.map(product => (
                  <div 
                    key={product.id} 
                    className={`stockProducts__item ${product.isOut ? 'stockProducts__item--out' : ''} ${product.isLow ? 'stockProducts__item--low' : ''}`}
                  >
                    <div className="stockProducts__itemIcon">
                      <Package size={24} />
                    </div>
                    <div className="stockProducts__itemInfo">
                      <h4 className="stockProducts__itemName">
                        {product.name}
                        {product.isOut && (
                          <span className="stockProducts__badge stockProducts__badge--danger">Sin stock</span>
                        )}
                        {product.isLow && !product.isOut && (
                          <span className="stockProducts__badge stockProducts__badge--warning">Stock bajo</span>
                        )}
                      </h4>
                      <p className="stockProducts__itemCategory">{product.category}</p>
                    </div>
                    <div className="stockProducts__itemStats">
                      <div className="stockProducts__stat">
                        <span className="stockProducts__statLabel">Vendidos</span>
                        <span className="stockProducts__statValue stockProducts__statValue--sold">{product.sold}</span>
                      </div>
                      <div className="stockProducts__stat">
                        <span className="stockProducts__statLabel">Disponible</span>
                        <span className={`stockProducts__statValue ${product.isOut ? 'stockProducts__statValue--out' : ''} ${product.isLow ? 'stockProducts__statValue--low' : ''}`}>
                          {product.currentStock}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="stockProducts__empty">
                <Package size={48} />
                <p>
                  {filter === 'out' ? 'No hay productos sin stock' : 
                   filter === 'low' ? 'No hay productos con stock bajo' :
                   'No hay productos con stock limitado configurado'}
                </p>
              </div>
            )}
          </div>
        </div>
        
        <div className="stockProductsModal__footer">
          <Button onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  )
}

// Función para enviar mensaje por WhatsApp
function sendWhatsAppMessage(phoneNumber, message) {
  if (!phoneNumber) {
    alert('No hay número de teléfono disponible')
    return
  }
  
  // Limpiar número: remover espacios, guiones, etc.
  const cleanPhone = phoneNumber.replace(/\D/g, '')
  
  // Si no empieza con código de país, agregar +54 (Argentina)
  const whatsappPhone = cleanPhone.startsWith('54') ? cleanPhone : '54' + cleanPhone.replace(/^0/, '')
  
  const encodedMessage = encodeURIComponent(message)
  const whatsappUrl = `https://wa.me/${whatsappPhone}?text=${encodedMessage}`
  
  window.open(whatsappUrl, '_blank')
}

// Función para imprimir pedido
function printOrder(order) {
  const printWindow = window.open('', '_blank')
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Pedido #${order.id?.slice(0, 8).toUpperCase()}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
        .header h1 { font-size: 24px; margin-bottom: 5px; }
        .header p { color: #666; margin: 5px 0; }
        .section { margin-bottom: 25px; }
        .section h3 { font-size: 14px; font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
        .row { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .label { font-weight: bold; color: #333; }
        .value { color: #666; }
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        .items-table th { border-bottom: 2px solid #333; padding: 10px; text-align: left; font-weight: bold; }
        .items-table th:nth-child(2),
        .items-table th:nth-child(3),
        .items-table th:nth-child(4) { text-align: right; }
        .items-table td { border-bottom: 1px solid #ddd; padding: 10px; vertical-align: top; }
        .items-table td:nth-child(2),
        .items-table td:nth-child(3),
        .items-table td:nth-child(4) { text-align: right; vertical-align: top; }
        .items-table td.item-qty { font-size: 14px; font-weight: 600; }
        .items-table td.item-price { font-size: 16px; font-weight: 700; color: #333; }
        .items-table td.item-subtotal { font-size: 18px; font-weight: 800; color: #000; }
        .item-name { font-size: 15px; font-weight: 600; display: block; margin-bottom: 6px; }
        .item-name-price { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
        .item-name-text { font-size: 15px; font-weight: 600; }
        .item-name-amount { font-size: 16px; font-weight: 700; color: #000; }
        .item-extras { padding-left: 16px; border-left: 2px solid #ddd; margin-top: 4px; }
        .item-extra { font-size: 13px; color: #555; padding: 3px 0; display: flex; justify-content: space-between; align-items: center; }
        .item-extra-name { color: #555; }
        .item-extra-price { color: #22c55e; font-weight: 600; font-size: 12px; margin-left: 12px; white-space: nowrap; }
        .total-section { border-top: 2px solid #333; padding-top: 10px; margin-top: 15px; }
        .total-row { display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; }
        .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>PEDIDO</h1>
        <p>#${order.id?.slice(0, 8).toUpperCase()}</p>
        <p>${new Date(order.created_at).toLocaleString('es-AR')}</p>
      </div>

      <div class="section">
        <h3>CLIENTE</h3>
        <div class="row">
          <span class="label">Nombre:</span>
          <span class="value">${order.customer_name || 'N/A'}</span>
        </div>
        <div class="row">
          <span class="label">Teléfono:</span>
          <span class="value">${order.customer_phone || 'N/A'}</span>
        </div>
      </div>

      <div class="section">
        <h3>ENTREGA</h3>
        <div class="row">
          <span class="label">Tipo:</span>
          <span class="value">${getDeliveryTypeLabel(order.delivery_type)}</span>
        </div>
        ${order.delivery_type === 'domicilio' ? `
          <div class="row">
            <span class="label">Dirección:</span>
            <span class="value">${order.delivery_address || 'N/A'}</span>
          </div>
          ${order.delivery_notes ? `
            <div class="row">
              <span class="label">Notas:</span>
              <span class="value">${order.delivery_notes}</span>
            </div>
          ` : ''}
        ` : ''}
      </div>

      <div class="section">
        <h3>PRODUCTOS</h3>
        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 50%;">Producto</th>
              <th style="width: 15%;">Cant.</th>
              <th style="width: 15%;">Precio</th>
              <th style="width: 20%;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${order.items?.map(item => {
              const name = item.product_name || item.name || 'Producto'
              const qty = item.quantity || item.qty || 1
              const price = Number(item.price || item.unit_price || 0)
              const subtotal = price * qty
              const extrasHtml = item.extras && item.extras.length > 0 
                ? `<div class="item-extras">
                    ${item.extras.map(extra => {
                      const extraPrice = Number(extra.price || 0) * (extra.quantity || 1)
                      const extraName = extra.name || ''
                      return `<div class="item-extra">
                        <span class="item-extra-name">+ ${extraName}</span>
                        <span class="item-extra-price">+$${extraPrice.toFixed(2)}</span>
                      </div>`
                    }).join('')}
                  </div>`
                : ''
              return `
              <tr>
                <td>
                  <div class="item-name-price">
                    <span class="item-name-text">${name}</span>
                    <span class="item-name-amount">$${price.toFixed(2)}</span>
                  </div>
                  ${extrasHtml}
                </td>
                <td class="item-qty">${qty}</td>
                <td class="item-price">$${price.toFixed(2)}</td>
                <td class="item-subtotal">$${subtotal.toFixed(2)}</td>
              </tr>
            `}).join('')}
          </tbody>
        </table>
      </div>

      <div class="section">
        <h3>PAGO</h3>
        <div class="row">
          <span class="label">Forma de pago:</span>
          <span class="value">${getPaymentMethodLabel(order.payment_method)}</span>
        </div>
        <div class="total-section">
          <div class="total-row">
            <span>TOTAL:</span>
            <span>$${Number(order.total).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div class="section">
        <h3>ESTADO</h3>
        <div class="row">
          <span class="label">Estado:</span>
          <span class="value">${getStatusLabel(order.status)}</span>
        </div>
      </div>

      <div class="footer">
        <p>Este documento fue impreso automáticamente</p>
        <p>${new Date().toLocaleString('es-AR')}</p>
      </div>
    </body>
    </html>
  `
  
  printWindow.document.write(html)
  printWindow.document.close()
  
  setTimeout(() => {
    printWindow.print()
  }, 250)
}

// Funciones auxiliares para etiquetas
function getDeliveryTypeLabel(type) {
  const labels = {
    mostrador: 'Retira en Mostrador',
    domicilio: 'A Domicilio',
    mesa: 'Para Comer en Mesa',
  }
  return labels[type] || type
}

function getPaymentMethodLabel(method) {
  const labels = {
    efectivo: 'Efectivo',
    tarjeta: 'Tarjeta de Crédito',
    qr: 'QR (Mercado Pago)',
  }
  return labels[method] || method
}

function getStatusLabel(status) {
  const labels = {
    pending: 'Pendiente',
    in_progress: 'En Curso',
    completed: 'Completado',
    cancelled: 'Cancelado',
  }
  return labels[status] || status
}

// Panel de Stock Global siempre visible con edición inline
function StockGlobalPanel({ categories, categoryStockStats, tenantId, dispatch }) {
  const [editingCatId, setEditingCatId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [showToast, setShowToast] = useState(null)
  const [pendingSave, setPendingSave] = useState(null) // Para manejar el save mientras se actualiza
  const [isExpanded, setIsExpanded] = useState(false) // Estado para el desplegable

  const handleStartEdit = (catId, currentMax) => {
    setEditingCatId(catId)
    setEditValue(currentMax?.toString() || '100')
  }

  const handleCancelEdit = () => {
    setEditingCatId(null)
    setEditValue('')
    setPendingSave(null)
  }

  const handleSaveStock = async (catId, catName) => {
    const numValue = parseInt(editValue, 10)
    if (isNaN(numValue) || numValue < 0) {
      setShowToast({ type: 'error', message: 'Ingresa un número válido' })
      setTimeout(() => setShowToast(null), 3000)
      return
    }

    setSaving(true)
    setPendingSave({ catId, catName, value: numValue })
    
    try {
      await dispatch(patchCategory({
        tenantId,
        categoryId: catId,
        patch: {
          max_stock: numValue,
          current_stock: numValue // Inicializar con el máximo
        }
      })).unwrap()
      
      setEditingCatId(null)
      setEditValue('')
      setPendingSave(null)
      setShowToast({ type: 'success', message: `Stock de "${catName}" configurado a ${numValue}` })
      setTimeout(() => setShowToast(null), 3000)
    } catch (error) {
      console.error('Error guardando stock:', error)
      setPendingSave(null)
      setShowToast({ type: 'error', message: 'Error al guardar el stock' })
      setTimeout(() => setShowToast(null), 3000)
    } finally {
      setSaving(false)
    }
  }

  const handleResetStock = async (catId, catName, maxValue) => {
    setSaving(true)
    try {
      await dispatch(patchCategory({
        tenantId,
        categoryId: catId,
        patch: {
          current_stock: maxValue
        }
      })).unwrap()
      
      setShowToast({ type: 'success', message: `Stock de "${catName}" reiniciado a ${maxValue}` })
      setTimeout(() => setShowToast(null), 3000)
    } catch (error) {
      console.error('Error reiniciando stock:', error)
      setShowToast({ type: 'error', message: 'Error al reiniciar el stock' })
      setTimeout(() => setShowToast(null), 3000)
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveStockLimit = async (catId, catName) => {
    setSaving(true)
    try {
      await dispatch(patchCategory({
        tenantId,
        categoryId: catId,
        patch: {
          max_stock: null,
          current_stock: null
        }
      })).unwrap()
      
      setShowToast({ type: 'success', message: `Stock ilimitado para "${catName}"` })
      setTimeout(() => setShowToast(null), 3000)
    } catch (error) {
      console.error('Error removiendo límite:', error)
      setShowToast({ type: 'error', message: 'Error al quitar el límite' })
      setTimeout(() => setShowToast(null), 3000)
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e, catId, catName) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveStock(catId, catName)
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }

  // Categorías sin stock configurado
  const categoriesWithoutStock = categories.filter(c => c.maxStock === null || c.maxStock === undefined)

  // Contar categorías con problemas para mostrar alerta en el header
  const hasStockIssues = categoryStockStats.outOfStock > 0 || categoryStockStats.lowStock > 0

  return (
    <div className={`ordersManager__stockPanel ordersManager__stockPanel--always ${isExpanded ? 'ordersManager__stockPanel--expanded' : ''}`}>
      {/* Toast notification */}
      {showToast && (
        <div className={`ordersManager__stockToast ordersManager__stockToast--${showToast.type}`}>
          {showToast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {showToast.message}
        </div>
      )}

      {/* Header clickeable para expandir/colapsar */}
      <button 
        className="ordersManager__stockPanelHeader ordersManager__stockPanelHeader--clickable"
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
      >
        <div className="ordersManager__stockPanelTitle">
          <Package size={18} />
          <span>Stock Global por Categoría</span>
          {hasStockIssues && !isExpanded && (
            <span className="ordersManager__stockPanelAlert">
              <AlertTriangle size={14} />
              {categoryStockStats.outOfStock > 0 && `${categoryStockStats.outOfStock} agotado${categoryStockStats.outOfStock > 1 ? 's' : ''}`}
              {categoryStockStats.outOfStock > 0 && categoryStockStats.lowStock > 0 && ' · '}
              {categoryStockStats.lowStock > 0 && `${categoryStockStats.lowStock} bajo${categoryStockStats.lowStock > 1 ? 's' : ''}`}
            </span>
          )}
        </div>
        <div className="ordersManager__stockPanelToggle">
          <span className="ordersManager__stockPanelHint">
            {categoryStockStats.total > 0 
              ? `${categoryStockStats.total} categoría${categoryStockStats.total > 1 ? 's' : ''}`
              : 'Configurar'
            }
          </span>
          <ChevronDown 
            size={18} 
            className={`ordersManager__stockPanelChevron ${isExpanded ? 'ordersManager__stockPanelChevron--up' : ''}`}
          />
        </div>
      </button>

      {/* Contenido desplegable */}
      {isExpanded && (
        <div className="ordersManager__stockPanelContent">
          {/* Categorías con stock configurado */}
          {categoryStockStats.total > 0 && (
            <div className="ordersManager__stockPanelGrid">
              {categoryStockStats.categories.map(cat => (
                <div 
                  key={cat.id} 
                  className={`ordersManager__stockCard ${cat.isOut ? 'ordersManager__stockCard--out' : cat.isLow ? 'ordersManager__stockCard--low' : 'ordersManager__stockCard--ok'}`}
                >
                  <div className="ordersManager__stockCardHeader">
                    <span className="ordersManager__stockCardName">{cat.name}</span>
                    <div className="ordersManager__stockCardActions">
                      {cat.isOut && (
                        <span className="ordersManager__stockCardBadge ordersManager__stockCardBadge--out">
                          <AlertTriangle size={12} /> SIN STOCK
                        </span>
                      )}
                      {cat.isLow && !cat.isOut && (
                        <span className="ordersManager__stockCardBadge ordersManager__stockCardBadge--low">BAJO</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="ordersManager__stockCardBody">
                    <div className="ordersManager__stockCardValue">
                      <span className={`ordersManager__stockCardCurrent ${cat.isOut ? 'ordersManager__stockCardCurrent--out' : ''}`}>
                        {cat.current}
                      </span>
                      <span className="ordersManager__stockCardMax">/{cat.max}</span>
                    </div>
                    <div className="ordersManager__stockCardBar">
                      <div 
                        className="ordersManager__stockCardBarFill"
                        style={{ width: `${Math.min(100, (cat.current / cat.max) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="ordersManager__stockCardControls">
                    <button
                      className="ordersManager__stockBtn ordersManager__stockBtn--reset"
                      onClick={() => handleResetStock(cat.id, cat.name, cat.max)}
                      disabled={saving || cat.current === cat.max}
                      title="Reiniciar al máximo"
                    >
                      <RefreshCw size={14} />
                      Reiniciar
                    </button>
                    <button
                      className="ordersManager__stockBtn ordersManager__stockBtn--edit"
                      onClick={() => handleStartEdit(cat.id, cat.max)}
                      disabled={saving}
                      title="Editar máximo"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      className="ordersManager__stockBtn ordersManager__stockBtn--remove"
                      onClick={() => handleRemoveStockLimit(cat.id, cat.name)}
                      disabled={saving}
                      title="Quitar límite (ilimitado)"
                    >
                      <Infinity size={14} />
                    </button>
                  </div>

                  {/* Modal de edición inline */}
                  {editingCatId === cat.id && (
                    <div className="ordersManager__stockEditOverlay">
                      <div className="ordersManager__stockEditBox">
                        <label>Stock máximo para {cat.name}:</label>
                        <input
                          type="number"
                          min="0"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, cat.id, cat.name)}
                          autoFocus
                          className="ordersManager__stockEditInput"
                        />
                        <div className="ordersManager__stockEditActions">
                          <button 
                            className="ordersManager__stockEditBtn ordersManager__stockEditBtn--save"
                            onClick={() => handleSaveStock(cat.id, cat.name)}
                            disabled={saving}
                          >
                            {saving ? 'Guardando...' : 'Guardar'}
                          </button>
                          <button 
                            className="ordersManager__stockEditBtn ordersManager__stockEditBtn--cancel"
                            onClick={handleCancelEdit}
                            disabled={saving}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Sección para categorías sin stock */}
          {categoriesWithoutStock.length > 0 && (
            <div className="ordersManager__stockAddSection">
              <div className="ordersManager__stockAddTitle">
                <Infinity size={16} />
                <span>Categorías sin límite de stock ({categoriesWithoutStock.length})</span>
              </div>
              <div className="ordersManager__stockAddGrid">
                {categoriesWithoutStock.map(cat => (
                  <div key={cat.id} className="ordersManager__stockAddCard">
                    <span className="ordersManager__stockAddName">{cat.name}</span>
                    {editingCatId === cat.id || (pendingSave && pendingSave.catId === cat.id) ? (
                      <div className="ordersManager__stockAddInputGroup">
                        {pendingSave && pendingSave.catId === cat.id ? (
                          <span className="ordersManager__stockAddSaving">Guardando {pendingSave.value}...</span>
                        ) : (
                          <>
                            <input
                              type="number"
                              min="1"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, cat.id, cat.name)}
                              autoFocus
                              placeholder="Cantidad"
                              className="ordersManager__stockAddInput"
                            />
                            <button 
                              className="ordersManager__stockAddBtn ordersManager__stockAddBtn--save"
                              onClick={() => handleSaveStock(cat.id, cat.name)}
                              disabled={saving}
                            >
                              <CheckCircle size={14} />
                            </button>
                            <button 
                              className="ordersManager__stockAddBtn ordersManager__stockAddBtn--cancel"
                              onClick={handleCancelEdit}
                            >
                              <X size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    ) : (
                      <button 
                        className="ordersManager__stockAddBtn ordersManager__stockAddBtn--add"
                        onClick={() => handleStartEdit(cat.id, 100)}
                      >
                        <Plus size={14} />
                        Agregar stock
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {categories.length === 0 && (
        <div className="ordersManager__stockEmpty">
          <Package size={32} />
          <p>No hay categorías creadas</p>
          <span>Crea categorías en tu menú para gestionar el stock global</span>
        </div>
      )}
    </div>
  )
}

// Helper components are defined below...
