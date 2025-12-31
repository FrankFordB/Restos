import { useEffect, useState, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import './OrdersManager.css'
import Card from '../../ui/Card/Card'
import Button from '../../ui/Button/Button'
import Input from '../../ui/Input/Input'
import { useAppDispatch, useAppSelector } from '../../../app/hooks'
import { fetchOrdersForTenant, selectOrdersForTenant, createPaidOrder, updateOrder, deleteOrder } from '../../../features/orders/ordersSlice'
import { fetchProductsForTenant, selectProductsForTenant } from '../../../features/products/productsSlice'
import { fetchDeliveryConfig, updateDeliveryConfig, fetchTenantPauseStatus, updateTenantPauseStatus } from '../../../lib/supabaseApi'
import { isSupabaseConfigured } from '../../../lib/supabaseClient'
import { loadJson, saveJson } from '../../../shared/storage'
import ProductCard from '../../storefront/ProductCard/ProductCard'
import {
  RefreshCw,
  Search,
  Pause,
  Play,
  Plus,
  ChevronDown,
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
} from 'lucide-react'

const DELIVERY_TYPES = {
  mostrador: { label: 'Mostrador', icon: <UtensilsCrossed size={16} /> },
  domicilio: { label: 'A Domicilio', icon: <Truck size={16} /> },
  mesa: { label: 'Mesa', icon: <Home size={16} /> },
}

const STATUS_CONFIG = {
  pending: { color: '#f97316', icon: <Clock size={16} />, label: 'Pendiente' },
  in_progress: { color: '#3b82f6', icon: <RefreshCw size={16} />, label: 'En curso' },
  completed: { color: '#10b981', icon: <CheckCircle size={16} />, label: 'Completado' },
  cancelled: { color: '#ef4444', icon: <X size={16} />, label: 'Cancelado' },
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
  const orders = useAppSelector(selectOrdersForTenant(tenantId))
  const products = useAppSelector(selectProductsForTenant(tenantId))
  const visibleProducts = useMemo(() => products.filter((p) => p.active), [products])

  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('status') // 'status' o 'delivery'
  const [filterStatus, setFilterStatus] = useState('all') // all, pending, in_progress, completed
  const [filterDelivery, setFilterDelivery] = useState('all') // all, mostrador, domicilio, mesa
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(null) // order ID
  const [selectedOrder, setSelectedOrder] = useState(null) // order object for detail modal
  
  // Modo tienda embebida para crear pedido
  const [showCreateStore, setShowCreateStore] = useState(false)
  const [cart, setCart] = useState({}) // { productId: quantity }
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

  // Refrescar pedidos
  const handleRefresh = useCallback(() => {
    if (tenantId) {
      dispatch(fetchOrdersForTenant(tenantId))
      dispatch(fetchProductsForTenant(tenantId))
    }
  }, [tenantId, dispatch])

  useEffect(() => {
    handleRefresh()
  }, [tenantId, handleRefresh])

  // Funciones del carrito para tienda embebida
  const addToCart = useCallback((productId) => {
    setCart((prev) => ({ ...prev, [productId]: (prev[productId] || 0) + 1 }))
  }, [])

  const removeFromCart = useCallback((productId) => {
    setCart((prev) => {
      const newQty = (prev[productId] || 0) - 1
      if (newQty <= 0) {
        const { [productId]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [productId]: newQty }
    })
  }, [])

  const clearCart = useCallback(() => {
    setCart({})
  }, [])

  // Calcular items del carrito
  const cartItems = useMemo(() => {
    return Object.entries(cart)
      .map(([productId, qty]) => {
        const product = products.find((p) => p.id === productId)
        if (!product) return null
        return {
          product,
          qty,
          lineTotal: product.price * qty,
        }
      })
      .filter(Boolean)
  }, [cart, products])

  const cartTotal = useMemo(() => cartItems.reduce((sum, item) => sum + item.lineTotal, 0), [cartItems])
  const cartCount = useMemo(() => cartItems.reduce((sum, item) => sum + item.qty, 0), [cartItems])

  // Payload para crear orden
  const orderItemsPayload = useMemo(() => {
    return cartItems.map((item) => ({
      productId: item.product.id,
      name: item.product.name,
      unitPrice: item.product.price,
      qty: item.qty,
      lineTotal: item.lineTotal,
    }))
  }, [cartItems])

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
    let result = orders.filter((o) => {
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

  // Contar estados por tipo de envío
  const counts = useMemo(
    () => ({
      all: orders.length,
      pending: orders.filter((o) => o.status === 'pending').length,
      in_progress: orders.filter((o) => o.status === 'in_progress').length,
      completed: orders.filter((o) => o.status === 'completed').length,
      cancelled: orders.filter((o) => o.status === 'cancelled').length,
      mostrador: orders.filter((o) => o.delivery_type === 'mostrador').length,
      domicilio: orders.filter((o) => o.delivery_type === 'domicilio').length,
      mesa: orders.filter((o) => o.delivery_type === 'mesa').length,
    }),
    [orders],
  )

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
      console.log('🗑️ Intentando eliminar pedidos:', orderIdsToDelete)
      
      const results = await Promise.allSettled(
        orderIdsToDelete.map((orderId) =>
          dispatch(deleteOrder({ tenantId, orderId })).unwrap()
        )
      )
      
      // Log resultados
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          console.log(`✅ Pedido ${orderIdsToDelete[index]} eliminado`)
        } else {
          console.error(`❌ Error eliminando pedido ${orderIdsToDelete[index]}:`, result.reason)
        }
      })
      
      const successCount = results.filter(r => r.status === 'fulfilled').length
      const failCount = results.filter(r => r.status === 'rejected').length
      
      if (failCount > 0) {
        alert(`Se eliminaron ${successCount} pedido(s). ${failCount} fallaron. Revisa la consola para más detalles.`)
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

  // Acción masiva: Marcar como pagados (localStorage)
  const bulkMarkAsPaid = () => {
    if (selectedOrderIds.size === 0) return
    const paidOrdersKey = `paidOrders.${tenantId}`
    const currentPaid = loadJson(paidOrdersKey, {})
    const updated = { ...currentPaid }
    selectedOrderIds.forEach((id) => {
      updated[id] = true
    })
    saveJson(paidOrdersKey, updated)
    clearSelection()
    handleRefresh()
  }

  // Acción masiva: Imprimir todos
  const bulkPrintOrders = () => {
    if (selectedOrderIds.size === 0) return
    const ordersToPrint = orders.filter((o) => selectedOrderIds.has(o.id))
    ordersToPrint.forEach((order) => {
      printOrder(order)
    })
  }

  // Verificar si todos están seleccionados
  const allSelected = filteredOrders.length > 0 && selectedOrderIds.size === filteredOrders.length

  return (
    <div className="ordersManager">
      {/* Header con acciones */}
      <div className="ordersManager__header">
        <div className="ordersManager__titleRow">
          <h3 className="ordersManager__title">Gestión de Pedidos</h3>
        </div>
        <div className="ordersManager__actions">
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
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowConfigModal(true)}
            title="Configurar tipos de envío"
          >
            <Truck size={16} />
            Configurar
          </Button>
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
                    <div key={item.product.id} className="embeddedStore__item">
                      <span className="embeddedStore__itemName">{item.product.name}</span>
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
                  <h4>👤 Datos del Cliente</h4>
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
                  <h4>🚚 Tipo de Entrega</h4>
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
                  <h4>💵 Forma de Pago</h4>
                  <div className="embeddedStore__paymentMethods">
                    {Object.entries(PAYMENT_METHODS).map(([key, label]) => (
                      <button
                        key={key}
                        className={`embeddedStore__paymentMethod ${checkoutData.paymentMethod === key ? 'embeddedStore__paymentMethod--active' : ''}`}
                        onClick={() => setCheckoutData({ ...checkoutData, paymentMethod: key })}
                      >
                        {key === 'efectivo' ? '💵' : key === 'tarjeta' ? '💳' : key === 'qr' ? '📱' : '🏦'}
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {checkoutError && (
                  <div className="embeddedStore__error">
                    ⚠️ {checkoutError}
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
              <div className="embeddedStore__productsGrid">
                {visibleProducts.length === 0 ? (
                  <div className="embeddedStore__empty">
                    <p>No hay productos disponibles</p>
                    <p className="muted">Agrega productos desde la sección de Productos</p>
                  </div>
                ) : (
                  visibleProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      quantity={cart[product.id] || 0}
                      onAdd={() => addToCart(product.id)}
                      onRemove={() => removeFromCart(product.id)}
                      layout="classic"
                      isEditable={false}
                    />
                  ))
                )}
              </div>

              {/* Carrito lateral */}
              <div className="embeddedStore__cart">
                <div className="embeddedStore__cartHeader">
                  <h4>🛒 Carrito</h4>
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
                        <div key={item.product.id} className="embeddedStore__cartItem">
                          <div className="embeddedStore__cartItemInfo">
                            <span className="embeddedStore__cartItemName">{item.product.name}</span>
                            <span className="embeddedStore__cartItemPrice">${item.product.price.toFixed(2)}</span>
                          </div>
                          <div className="embeddedStore__cartItemControls">
                            <button onClick={() => removeFromCart(item.product.id)}>−</button>
                            <span>{item.qty}</span>
                            <button onClick={() => addToCart(item.product.id)}>+</button>
                          </div>
                          <span className="embeddedStore__cartItemTotal">${item.lineTotal.toFixed(2)}</span>
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
          )}
        </div>
      )}

      {/* Vista normal de pedidos (solo cuando NO estamos en modo tienda) */}
      {!showCreateStore && (
        <>
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
                  ✕ Limpiar
                </button>
              </div>
              <div className="ordersManager__bulkButtons">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => bulkChangeStatus('in_progress')}
                  disabled={isBulkActionLoading}
                >
                  ✅ Aceptar
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => bulkChangeStatus('completed')}
                  disabled={isBulkActionLoading}
                >
                  ✔️ Finalizar
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={bulkMarkAsPaid}
                  disabled={isBulkActionLoading}
                >
                  💵 Marcar Pagado
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={bulkPrintOrders}
                  disabled={isBulkActionLoading}
                >
                  🖨️ Imprimir
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => bulkChangeStatus('cancelled')}
                  disabled={isBulkActionLoading}
                >
                  ❌ Cancelar
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={bulkDeleteOrders}
                  disabled={isBulkActionLoading}
                >
                  🗑️ Eliminar
                </Button>
              </div>
            </div>
          )}

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
                <div className="ordersManager__emptyIcon">📦</div>
                <p>No hay pedidos en esta categoría</p>
                <p className="muted">Los pedidos aparecerán aquí cuando se realicen desde la tienda</p>
              </div>
            ) : (
              filteredOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  tenantId={tenantId}
                  onOpenDetail={(o) => setSelectedOrder(o)}
                  isSelected={selectedOrderIds.has(order.id)}
                  onToggleSelect={() => toggleOrderSelection(order.id)}
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
          order={selectedOrder}
          tenantId={tenantId}
          onClose={() => setSelectedOrder(null)}
          products={[]}
        />
      )}
    </div>
  )
}

// Card de orden individual - Compacta, clic abre modal
function OrderCard({ order, tenantId, onOpenDetail, isSelected = false, onToggleSelect }) {
  const dispatch = useAppDispatch()
  const [isUpdating, setIsUpdating] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false)
  const [showTransferConfirm, setShowTransferConfirm] = useState(false)
  const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
  const deliveryType = DELIVERY_TYPES[order.delivery_type] || DELIVERY_TYPES.mostrador
  const paymentMethod = PAYMENT_METHODS[order.payment_method] || order.payment_method

  // Estado de pago confirmado (persistido en localStorage)
  const paidOrdersKey = `paidOrders.${tenantId}`
  const [paidOrders, setPaidOrders] = useState(() => {
    return loadJson(paidOrdersKey, {})
  })
  const isPaymentConfirmed = paidOrders[order.id] === true

  const markAsPaid = (e) => {
    if (e) e.stopPropagation()
    const newPaidOrders = { ...paidOrders, [order.id]: true }
    setPaidOrders(newPaidOrders)
    saveJson(paidOrdersKey, newPaidOrders)
  }

  const handleStatusChange = async (e, newStatus) => {
    if (e) e.stopPropagation()
    setIsUpdating(true)
    try {
      await dispatch(updateOrder({ tenantId, orderId: order.id, newStatus }))
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
    <div className={`orderCard orderCard--compact ${isSelected ? 'orderCard--selected' : ''}`} onClick={() => onOpenDetail(order)}>
      {/* Checkbox de selección */}
      <div className="orderCard__selectBox" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          className="orderCard__checkbox"
        />
      </div>
      
      {/* Header compacto */}
      <div className="orderCard__header">
        <div className="orderCard__status" style={{ borderLeftColor: status.color }}>
          <div className="orderCard__statusIcon" style={{ color: status.color }}>
            {status.icon}
          </div>
          <div className="orderCard__info">
            <div className="orderCard__title">
              #{order.id?.slice(0, 8).toUpperCase()}
            </div>
            <span className="orderCard__badge" style={{ backgroundColor: status.color + '20', color: status.color }}>
              {status.label}
            </span>
          </div>
        </div>

        <div className="orderCard__summary">
          <div className="orderCard__customer">
            <User size={14} />
            <span>{order.customer_name || 'Cliente'}</span>
          </div>
          {/* Tipo de envío */}
          <div className="orderCard__deliveryTag">
            {deliveryType.icon}
            <span>{deliveryType.label}</span>
          </div>
          {/* Método de pago */}
          <div className={`orderCard__paymentTag ${needsManualPayment && !isPaid ? 'orderCard__paymentTag--cash' : ''} ${isPaid && needsManualPayment ? 'orderCard__paymentTag--paid' : ''}`}>
            {order.payment_method === 'efectivo' ? '💵' : order.payment_method === 'transferencia' ? '🏦' : '💳'}
            <span>{paymentMethod}</span>
            {needsManualPayment && !isPaid && <span className="orderCard__paymentWarning">COBRAR</span>}
            {needsManualPayment && isPaid && <span className="orderCard__paymentPaid">PAGADO</span>}
          </div>
          <div className="orderCard__total">
            <span className="orderCard__amount">${Number(order.total).toFixed(2)}</span>
          </div>
          <div className="orderCard__time">
            <Clock size={12} />
            <span>{getTimeAgo(order.created_at)}</span>
          </div>
        </div>

        {/* Actions inline */}
        <div className="orderCard__actions">
          {/* Botón marcar como pagado - solo para efectivo/transferencia y pedidos no completados */}
          {needsManualPayment && !isPaid && !isOrderCompleted && (
            <Button 
              size="sm" 
              variant="secondary"
              disabled={isUpdating}
              onClick={(e) => {
                e.stopPropagation()
                markAsPaid(e)
              }}
              title="Marcar como pagado"
            >
              💰 Pagó
            </Button>
          )}
          {order.status === 'pending' && (
            <Button 
              size="sm" 
              disabled={isUpdating}
              onClick={(e) => handleStatusChange(e, 'in_progress')}
            >
              ✅ Tomar
            </Button>
          )}
          {order.status === 'in_progress' && (
            <Button 
              size="sm"
              disabled={isUpdating}
              onClick={handleCompleteOrder}
            >
              ✔️ Finalizar
            </Button>
          )}
          <Button 
            size="sm" 
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation()
              printOrder(order)
            }}
          >
            🖨️
          </Button>
          {/* Botón eliminar pedido */}
          <Button 
            size="sm" 
            variant="danger"
            disabled={isUpdating}
            onClick={(e) => {
              e.stopPropagation()
              setShowDeleteConfirm(true)
            }}
          >
            🗑️
          </Button>
        </div>
      </div>

      {/* Modal de confirmación de pago en efectivo - Renderizado en portal */}
      {showPaymentConfirm && createPortal(
        <div className="orderCard__deleteConfirm" onClick={(e) => {
          e.stopPropagation()
          setShowPaymentConfirm(false)
        }}>
          <div className="orderCard__deleteConfirmContent orderCard__paymentConfirmContent" onClick={(e) => e.stopPropagation()}>
            <div className="orderCard__paymentIcon">💵</div>
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
            <div className="orderCard__paymentIcon">🏦</div>
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
            <div className="orderCard__paymentIcon">🗑️</div>
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
      console.log({ orderId: order.id, paymentMethod })
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
        actions={<button className="modal__close" onClick={onClose}>✕</button>}
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
function OrderDetailModal({ order, tenantId, onClose, products = [] }) {
  const dispatch = useAppDispatch()
  const [isUpdating, setIsUpdating] = useState(false)
  const [comment, setComment] = useState(order.comment || '')
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
  const deliveryType = DELIVERY_TYPES[order.delivery_type] || DELIVERY_TYPES.mostrador

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

  // Cálculo de subtotal y descuentos
  const subtotal = order.items?.reduce((acc, item) => acc + (Number(item.price || item.unit_price || 0) * (item.quantity || item.qty || 1)), 0) || 0
  const discount = order.discount || 0
  const total = Number(order.total) || subtotal - discount

  return (
    <div className="modal__overlay">
      <div className="orderDetailModal">
        {/* Header */}
        <div className="orderDetailModal__header">
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
            <button className="orderDetailModal__close" onClick={onClose}>✕</button>
          </div>
          <div className="orderDetailModal__meta">
            <span>📅 {new Date(order.created_at).toLocaleString()}</span>
            <span>⏱️ {getTimeAgo(order.created_at)}</span>
          </div>
        </div>

        {/* Body - Grid layout */}
        <div className="orderDetailModal__body">
          {/* Columna Izquierda */}
          <div className="orderDetailModal__left">
            {/* Cliente */}
            <div className="orderDetailModal__section">
              <h4>👤 Cliente</h4>
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
                      className="orderDetailModal__whatsappBtn"
                      onClick={handleWhatsApp}
                    >
                      💬 WhatsApp
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
              <h4>🚚 Entrega</h4>
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

            {/* Comentario */}
            <div className="orderDetailModal__section">
              <h4>💬 Comentario interno</h4>
              <textarea
                className="orderDetailModal__comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Agregar nota interna..."
                rows="2"
              />
            </div>
          </div>

          {/* Columna Derecha */}
          <div className="orderDetailModal__right">
            {/* Productos */}
            <div className="orderDetailModal__section">
              <div className="orderDetailModal__sectionHeader">
                <h4>🛒 Productos ({order.items?.length || 0})</h4>
                <button 
                  className="orderDetailModal__addBtn"
                  onClick={() => setShowAddProduct(!showAddProduct)}
                >
                  + Agregar
                </button>
              </div>
              
              {showAddProduct && (
                <div className="orderDetailModal__addProduct">
                  <select className="orderDetailModal__productSelect">
                    <option value="">Seleccionar producto...</option>
                    {products.filter(p => p.active).map(p => (
                      <option key={p.id} value={p.id}>{p.name} - ${p.price}</option>
                    ))}
                  </select>
                  <Button size="sm">Agregar</Button>
                </div>
              )}

              <div className="orderDetailModal__items">
                {order.items?.map((item, idx) => (
                  <div key={idx} className="orderDetailModal__item">
                    <div className="orderDetailModal__itemMain">
                      <span className="orderDetailModal__itemName">{item.product_name || item.name}</span>
                      <span className="orderDetailModal__itemQty">x{item.quantity || item.qty}</span>
                      <span className="orderDetailModal__itemPrice">
                        ${(Number(item.price || item.unit_price || 0) * (item.quantity || item.qty || 1)).toFixed(2)}
                      </span>
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
                  </div>
                ))}
              </div>
            </div>

            {/* Totales */}
            <div className="orderDetailModal__section orderDetailModal__section--totals">
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
            </div>
          </div>
        </div>

        {/* Footer - Acciones */}
        <div className="orderDetailModal__footer">
          <div className="orderDetailModal__actions">
            {/* Acciones de estado */}
            {order.status === 'pending' && (
              <>
                <Button 
                  disabled={isUpdating}
                  onClick={() => handleStatusChange('in_progress')}
                >
                  ✅ Tomar Pedido
                </Button>
                <Button 
                  variant="danger"
                  disabled={isUpdating}
                  onClick={() => handleStatusChange('cancelled')}
                >
                  ❌ Rechazar
                </Button>
              </>
            )}
            {order.status === 'in_progress' && (
              <>
                <Button 
                  disabled={isUpdating}
                  onClick={handleCompleteOrder}
                >
                  ✔️ Finalizar Pedido
                </Button>
                <Button 
                  variant="danger"
                  disabled={isUpdating}
                  onClick={() => handleStatusChange('cancelled')}
                >
                  ❌ Cancelar
                </Button>
              </>
            )}
            {order.status === 'completed' && (
              <span className="orderDetailModal__completedBadge">✅ Pedido Completado</span>
            )}
            {order.status === 'cancelled' && (
              <span className="orderDetailModal__cancelledBadge">❌ Pedido Cancelado</span>
            )}
          </div>
          
          <div className="orderDetailModal__secondaryActions">
            <Button 
              variant="secondary" 
              onClick={() => printOrder(order)}
            >
              🖨️ Imprimir
            </Button>
            <Button 
              variant="danger" 
              onClick={() => setShowDeleteConfirm(true)}
            >
              🗑️ Eliminar
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>

        {/* Modal de confirmación de eliminación */}
        {showDeleteConfirm && (
          <div className="orderCard__deleteConfirm" onClick={(e) => {
            e.stopPropagation()
            setShowDeleteConfirm(false)
          }}>
            <div className="orderCard__deleteConfirmContent" onClick={(e) => e.stopPropagation()}>
              <div className="orderCard__paymentIcon">🗑️</div>
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
        actions={<button className="modal__close" onClick={onClose}>✕</button>}
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
              <p>⚠️ Debes habilitar al menos un tipo de envío</p>
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
              ✓ Guardar Configuración
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
          <h3>{localIsPaused ? '⏸️ Tienda Pausada' : '▶️ Tienda Activa'}</h3>
          <button className="modal__close" onClick={handleClose} type="button">✕</button>
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
              {loading ? 'Guardando...' : '✓ Guardar Cambios'}
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
