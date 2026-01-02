import { useState, useMemo } from 'react'
import './SalesStats.css'
import Card from '../../ui/Card/Card'
import { useAppSelector } from '../../../app/hooks'
import { selectOrdersForTenant } from '../../../features/orders/ordersSlice'
import { selectProductsForTenant } from '../../../features/products/productsSlice'
import { selectCategoriesForTenant } from '../../../features/categories/categoriesSlice'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Users,
  Package,
  Clock,
  Percent,
  AlertTriangle,
  RotateCcw,
  Star,
  UserPlus,
  UserCheck,
  PieChart,
  BarChart3,
  Calendar,
  Filter,
} from 'lucide-react'

// Períodos de tiempo para filtrar
const TIME_PERIODS = {
  today: { label: 'Hoy', days: 0 },
  week: { label: 'Esta semana', days: 7 },
  month: { label: 'Este mes', days: 30 },
  quarter: { label: 'Trimestre', days: 90 },
  year: { label: 'Este año', days: 365 },
  all: { label: 'Todo el tiempo', days: Infinity },
}

// Helpers para fechas
const startOfDay = (date) => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

const startOfWeek = (date) => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday first
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

const startOfMonth = (date) => {
  const d = new Date(date)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

export default function SalesStats({ tenantId }) {
  const [selectedPeriod, setSelectedPeriod] = useState('month')
  const [activeSection, setActiveSection] = useState('overview')

  const orders = useAppSelector(selectOrdersForTenant(tenantId))
  const products = useAppSelector(selectProductsForTenant(tenantId))
  const categories = useAppSelector(selectCategoriesForTenant(tenantId))

  // Filtrar pedidos por período seleccionado
  const filteredOrders = useMemo(() => {
    const now = new Date()
    const period = TIME_PERIODS[selectedPeriod]
    
    if (period.days === Infinity) return orders
    
    const cutoffDate = new Date()
    if (period.days === 0) {
      // Hoy
      cutoffDate.setHours(0, 0, 0, 0)
    } else {
      cutoffDate.setDate(now.getDate() - period.days)
    }

    return orders.filter(order => {
      const orderDate = new Date(order.created_at)
      return orderDate >= cutoffDate
    })
  }, [orders, selectedPeriod])

  // Solo pedidos completados (para ventas)
  const completedOrders = useMemo(() => {
    return filteredOrders.filter(o => 
      o.status === 'completed' || o.status === 'delivered' || o.status === 'ready'
    )
  }, [filteredOrders])

  // Pedidos del período anterior (para comparación)
  const previousPeriodOrders = useMemo(() => {
    const period = TIME_PERIODS[selectedPeriod]
    if (period.days === Infinity || period.days === 0) return []
    
    const now = new Date()
    const periodStart = new Date()
    periodStart.setDate(now.getDate() - period.days)
    
    const prevPeriodStart = new Date()
    prevPeriodStart.setDate(now.getDate() - (period.days * 2))

    return orders.filter(order => {
      const orderDate = new Date(order.created_at)
      return orderDate >= prevPeriodStart && orderDate < periodStart &&
        (order.status === 'completed' || order.status === 'delivered' || order.status === 'ready')
    })
  }, [orders, selectedPeriod])

  // ==================== CÁLCULOS DE ESTADÍSTICAS ====================

  // 1. VENTAS TOTALES
  const salesStats = useMemo(() => {
    const totalRevenue = completedOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0)
    const prevRevenue = previousPeriodOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0)
    const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0
    
    const totalOrders = completedOrders.length
    const prevOrdersCount = previousPeriodOrders.length
    const ordersChange = prevOrdersCount > 0 ? ((totalOrders - prevOrdersCount) / prevOrdersCount) * 100 : 0

    return {
      totalRevenue,
      prevRevenue,
      revenueChange,
      totalOrders,
      ordersChange,
    }
  }, [completedOrders, previousPeriodOrders])

  // Ventas diarias
  const dailySales = useMemo(() => {
    const salesByDay = {}
    completedOrders.forEach(order => {
      const day = startOfDay(order.created_at).toISOString().split('T')[0]
      if (!salesByDay[day]) salesByDay[day] = { revenue: 0, orders: 0 }
      salesByDay[day].revenue += Number(order.total) || 0
      salesByDay[day].orders += 1
    })
    return Object.entries(salesByDay)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 7)
  }, [completedOrders])

  // Ventas por hora
  const hourlySales = useMemo(() => {
    const salesByHour = Array(24).fill(null).map((_, i) => ({
      hour: i,
      label: `${i.toString().padStart(2, '0')}:00`,
      revenue: 0,
      orders: 0,
    }))
    
    completedOrders.forEach(order => {
      const hour = new Date(order.created_at).getHours()
      salesByHour[hour].revenue += Number(order.total) || 0
      salesByHour[hour].orders += 1
    })

    return salesByHour
  }, [completedOrders])

  // Hora pico
  const peakHour = useMemo(() => {
    return hourlySales.reduce((peak, current) => 
      current.orders > peak.orders ? current : peak
    , { hour: 0, orders: 0, label: '00:00' })
  }, [hourlySales])

  // 2. PRODUCTOS VENDIDOS
  const productStats = useMemo(() => {
    const productSales = {}
    let totalProductsSold = 0

    completedOrders.forEach(order => {
      const items = order.items || order.order_items || []
      items.forEach(item => {
        const productId = item.product_id || item.productId || item.id
        const productName = item.product_name || item.name || 'Producto'
        const qty = Number(item.quantity) || Number(item.qty) || 1
        const unitPrice = Number(item.unit_price) || Number(item.unitPrice) || Number(item.price) || 0

        totalProductsSold += qty

        if (!productSales[productId]) {
          productSales[productId] = {
            id: productId,
            name: productName,
            quantity: 0,
            revenue: 0,
          }
        }
        productSales[productId].quantity += qty
        productSales[productId].revenue += qty * unitPrice
      })
    })

    const sortedProducts = Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)

    return {
      totalProductsSold,
      topProducts: sortedProducts.slice(0, 10),
      allProductSales: sortedProducts,
    }
  }, [completedOrders])

  // 3. PROMEDIO DE VENTA POR CLIENTE
  const averageStats = useMemo(() => {
    const avgTicket = completedOrders.length > 0 
      ? salesStats.totalRevenue / completedOrders.length 
      : 0

    // Productos promedio por pedido
    let totalItems = 0
    completedOrders.forEach(order => {
      const items = order.items || order.order_items || []
      items.forEach(item => {
        totalItems += Number(item.quantity) || Number(item.qty) || 1
      })
    })
    const avgItemsPerOrder = completedOrders.length > 0 ? totalItems / completedOrders.length : 0

    return {
      avgTicket,
      avgItemsPerOrder,
    }
  }, [completedOrders, salesStats.totalRevenue])

  // 4. VENTAS POR CATEGORÍA
  const categoryStats = useMemo(() => {
    const categorySales = {}
    
    completedOrders.forEach(order => {
      const items = order.items || order.order_items || []
      items.forEach(item => {
        const productId = item.product_id || item.productId || item.id
        const product = products.find(p => p.id === productId)
        const categoryName = product?.category || item.category || 'Sin categoría'
        const qty = Number(item.quantity) || Number(item.qty) || 1
        const unitPrice = Number(item.unit_price) || Number(item.unitPrice) || Number(item.price) || 0

        if (!categorySales[categoryName]) {
          categorySales[categoryName] = { name: categoryName, revenue: 0, quantity: 0 }
        }
        categorySales[categoryName].revenue += qty * unitPrice
        categorySales[categoryName].quantity += qty
      })
    })

    const sorted = Object.values(categorySales).sort((a, b) => b.revenue - a.revenue)
    const totalRevenue = sorted.reduce((sum, c) => sum + c.revenue, 0)

    return sorted.map(cat => ({
      ...cat,
      percentage: totalRevenue > 0 ? (cat.revenue / totalRevenue) * 100 : 0,
    }))
  }, [completedOrders, products])

  // 5. MÉTODO DE ENTREGA
  const deliveryStats = useMemo(() => {
    const byType = {}
    
    completedOrders.forEach(order => {
      const type = order.delivery_type || 'mostrador'
      if (!byType[type]) byType[type] = { count: 0, revenue: 0 }
      byType[type].count += 1
      byType[type].revenue += Number(order.total) || 0
    })

    return Object.entries(byType).map(([type, data]) => ({
      type,
      label: type === 'domicilio' ? 'Delivery' : type === 'mostrador' ? 'Mostrador' : type,
      ...data,
      percentage: completedOrders.length > 0 ? (data.count / completedOrders.length) * 100 : 0,
    }))
  }, [completedOrders])

  // 6. MÉTODO DE PAGO
  const paymentStats = useMemo(() => {
    const byMethod = {}
    
    completedOrders.forEach(order => {
      const method = order.payment_method || 'efectivo'
      if (!byMethod[method]) byMethod[method] = { count: 0, revenue: 0 }
      byMethod[method].count += 1
      byMethod[method].revenue += Number(order.total) || 0
    })

    const labels = {
      efectivo: 'Efectivo',
      mercadopago: 'MercadoPago',
      tarjeta: 'Tarjeta',
      transferencia: 'Transferencia',
    }

    return Object.entries(byMethod).map(([method, data]) => ({
      method,
      label: labels[method] || method,
      ...data,
      percentage: completedOrders.length > 0 ? (data.count / completedOrders.length) * 100 : 0,
    }))
  }, [completedOrders])

  // 7. INVENTARIO - Solo productos con stock limitado (stock !== null)
  const inventoryStats = useMemo(() => {
    const productsWithStock = products.filter(p => p.stock !== null && p.stock !== undefined)
    const lowStock = productsWithStock.filter(p => p.stock <= 5 && p.stock > 0)
    const outOfStock = productsWithStock.filter(p => p.stock === 0)
    const totalStock = productsWithStock.reduce((sum, p) => sum + (p.stock || 0), 0)
    
    // Calcular cantidades vendidas por producto desde pedidos completados/en curso
    const soldQuantities = {}
    filteredOrders
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
    
    // Agregar info de ventas a productos con stock
    const enrichedProducts = productsWithStock.map(p => ({
      ...p,
      sold: soldQuantities[p.id] || 0,
    }))
    
    // Top productos más vendidos (con stock limitado)
    const topSelling = [...enrichedProducts]
      .sort((a, b) => b.sold - a.sold)
      .filter(p => p.sold > 0)
      .slice(0, 5)
    
    // Productos próximos a agotarse (ordenados por stock)
    const nearDepletion = [...enrichedProducts]
      .filter(p => p.stock > 0 && p.sold > 0)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 5)

    return {
      lowStock: lowStock.map(p => ({ ...p, sold: soldQuantities[p.id] || 0 })),
      outOfStock: outOfStock.map(p => ({ ...p, sold: soldQuantities[p.id] || 0 })),
      totalStock,
      totalProducts: productsWithStock.length,
      topSelling,
      nearDepletion,
      totalSold: Object.values(soldQuantities).reduce((sum, qty) => sum + qty, 0),
    }
  }, [products, filteredOrders])

  // 8. CANCELACIONES
  const cancellationStats = useMemo(() => {
    const cancelled = filteredOrders.filter(o => o.status === 'cancelled')
    const total = filteredOrders.length
    const rate = total > 0 ? (cancelled.length / total) * 100 : 0
    const lostRevenue = cancelled.reduce((sum, o) => sum + (Number(o.total) || 0), 0)

    return {
      count: cancelled.length,
      rate,
      lostRevenue,
    }
  }, [filteredOrders])

  // 9. CLIENTES
  const customerStats = useMemo(() => {
    const customers = {}
    
    completedOrders.forEach(order => {
      const phone = order.customer_phone || 'unknown'
      const name = order.customer_name || 'Cliente'
      
      if (!customers[phone]) {
        customers[phone] = {
          name,
          phone,
          orders: 0,
          totalSpent: 0,
          firstOrder: order.created_at,
          lastOrder: order.created_at,
        }
      }
      customers[phone].orders += 1
      customers[phone].totalSpent += Number(order.total) || 0
      if (new Date(order.created_at) > new Date(customers[phone].lastOrder)) {
        customers[phone].lastOrder = order.created_at
      }
    })

    const allCustomers = Object.values(customers)
    const recurring = allCustomers.filter(c => c.orders > 1)
    const newCustomers = allCustomers.filter(c => c.orders === 1)
    const topCustomers = allCustomers.sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5)

    return {
      total: allCustomers.length,
      recurring: recurring.length,
      new: newCustomers.length,
      topCustomers,
      recurrenceRate: allCustomers.length > 0 ? (recurring.length / allCustomers.length) * 100 : 0,
    }
  }, [completedOrders])

  // Formatear moneda
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  // Formatear porcentaje
  const formatPercent = (value) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
  }

  // Secciones del menú
  const sections = [
    { id: 'overview', label: 'Resumen', icon: PieChart },
    { id: 'products', label: 'Productos', icon: Package },
    { id: 'customers', label: 'Clientes', icon: Users },
    { id: 'inventory', label: 'Inventario', icon: AlertTriangle },
    { id: 'hourly', label: 'Por hora', icon: Clock },
  ]

  return (
    <div className="salesStats">
      {/* Filtros de período */}
      <div className="salesStats__filters">
        <div className="salesStats__periodSelector">
          <Calendar size={16} />
          <select 
            value={selectedPeriod} 
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="salesStats__periodSelect"
          >
            {Object.entries(TIME_PERIODS).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <div className="salesStats__sectionTabs">
          {sections.map(section => (
            <button
              key={section.id}
              className={`salesStats__sectionTab ${activeSection === section.id ? 'active' : ''}`}
              onClick={() => setActiveSection(section.id)}
            >
              <section.icon size={16} />
              <span>{section.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* SECCIÓN: RESUMEN GENERAL */}
      {activeSection === 'overview' && (
        <>
          {/* KPIs principales */}
          <div className="salesStats__kpiGrid">
            <div className="salesStats__kpi salesStats__kpi--primary">
              <div className="salesStats__kpiIcon">
                <DollarSign size={24} />
              </div>
              <div className="salesStats__kpiContent">
                <span className="salesStats__kpiLabel">Ingresos Totales</span>
                <span className="salesStats__kpiValue">{formatCurrency(salesStats.totalRevenue)}</span>
                {salesStats.revenueChange !== 0 && (
                  <span className={`salesStats__kpiChange ${salesStats.revenueChange >= 0 ? 'positive' : 'negative'}`}>
                    {salesStats.revenueChange >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {formatPercent(salesStats.revenueChange)} vs período anterior
                  </span>
                )}
              </div>
            </div>

            <div className="salesStats__kpi">
              <div className="salesStats__kpiIcon">
                <ShoppingBag size={24} />
              </div>
              <div className="salesStats__kpiContent">
                <span className="salesStats__kpiLabel">Pedidos Completados</span>
                <span className="salesStats__kpiValue">{salesStats.totalOrders}</span>
                {salesStats.ordersChange !== 0 && (
                  <span className={`salesStats__kpiChange ${salesStats.ordersChange >= 0 ? 'positive' : 'negative'}`}>
                    {salesStats.ordersChange >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {formatPercent(salesStats.ordersChange)}
                  </span>
                )}
              </div>
            </div>

            <div className="salesStats__kpi">
              <div className="salesStats__kpiIcon">
                <Users size={24} />
              </div>
              <div className="salesStats__kpiContent">
                <span className="salesStats__kpiLabel">Ticket Promedio</span>
                <span className="salesStats__kpiValue">{formatCurrency(averageStats.avgTicket)}</span>
                <span className="salesStats__kpiSubtext">
                  ~{averageStats.avgItemsPerOrder.toFixed(1)} items/pedido
                </span>
              </div>
            </div>

            <div className="salesStats__kpi">
              <div className="salesStats__kpiIcon">
                <Clock size={24} />
              </div>
              <div className="salesStats__kpiContent">
                <span className="salesStats__kpiLabel">Hora Pico</span>
                <span className="salesStats__kpiValue">{peakHour.label}</span>
                <span className="salesStats__kpiSubtext">
                  {peakHour.orders} pedidos
                </span>
              </div>
            </div>
          </div>

          {/* Ventas por categoría y método de pago */}
          <div className="salesStats__row">
            <Card title="Ventas por Categoría" className="salesStats__card">
              {categoryStats.length > 0 ? (
                <div className="salesStats__categoryList">
                  {categoryStats.map((cat, idx) => (
                    <div key={cat.name} className="salesStats__categoryItem">
                      <div className="salesStats__categoryInfo">
                        <span className="salesStats__categoryRank">#{idx + 1}</span>
                        <span className="salesStats__categoryName">{cat.name}</span>
                      </div>
                      <div className="salesStats__categoryBar">
                        <div 
                          className="salesStats__categoryBarFill"
                          style={{ width: `${cat.percentage}%` }}
                        />
                      </div>
                      <div className="salesStats__categoryValues">
                        <span className="salesStats__categoryRevenue">{formatCurrency(cat.revenue)}</span>
                        <span className="salesStats__categoryPercent">{cat.percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="salesStats__empty">
                  <PieChart size={32} />
                  <p>No hay datos de categorías</p>
                </div>
              )}
            </Card>

            <Card title="Métodos de Pago" className="salesStats__card">
              {paymentStats.length > 0 ? (
                <div className="salesStats__paymentList">
                  {paymentStats.map(method => (
                    <div key={method.method} className="salesStats__paymentItem">
                      <div className="salesStats__paymentInfo">
                        <span className="salesStats__paymentLabel">{method.label}</span>
                        <span className="salesStats__paymentCount">{method.count} pedidos</span>
                      </div>
                      <div className="salesStats__paymentBar">
                        <div 
                          className="salesStats__paymentBarFill"
                          style={{ width: `${method.percentage}%` }}
                        />
                      </div>
                      <span className="salesStats__paymentRevenue">{formatCurrency(method.revenue)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="salesStats__empty">
                  <DollarSign size={32} />
                  <p>No hay datos de pagos</p>
                </div>
              )}
            </Card>
          </div>

          {/* Tipo de entrega y cancelaciones */}
          <div className="salesStats__row">
            <Card title="Tipo de Entrega" className="salesStats__card">
              {deliveryStats.length > 0 ? (
                <div className="salesStats__deliveryGrid">
                  {deliveryStats.map(delivery => (
                    <div key={delivery.type} className="salesStats__deliveryItem">
                      <div className="salesStats__deliveryIcon">
                        {delivery.type === 'domicilio' ? '🛵' : '🏪'}
                      </div>
                      <div className="salesStats__deliveryInfo">
                        <span className="salesStats__deliveryLabel">{delivery.label}</span>
                        <span className="salesStats__deliveryCount">{delivery.count} pedidos</span>
                        <span className="salesStats__deliveryRevenue">{formatCurrency(delivery.revenue)}</span>
                      </div>
                      <span className="salesStats__deliveryPercent">{delivery.percentage.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="salesStats__empty">
                  <Package size={32} />
                  <p>No hay datos de entregas</p>
                </div>
              )}
            </Card>

            <Card title="Cancelaciones" className="salesStats__card salesStats__card--warning">
              <div className="salesStats__cancellationStats">
                <div className="salesStats__cancellationMain">
                  <span className="salesStats__cancellationCount">{cancellationStats.count}</span>
                  <span className="salesStats__cancellationLabel">Pedidos cancelados</span>
                </div>
                <div className="salesStats__cancellationDetails">
                  <div className="salesStats__cancellationDetail">
                    <Percent size={16} />
                    <span>Tasa: {cancellationStats.rate.toFixed(1)}%</span>
                  </div>
                  <div className="salesStats__cancellationDetail">
                    <DollarSign size={16} />
                    <span>Pérdida: {formatCurrency(cancellationStats.lostRevenue)}</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Ventas diarias */}
          <Card title="Ventas Últimos 7 Días" className="salesStats__card salesStats__card--full">
            {dailySales.length > 0 ? (
              <div className="salesStats__dailyChart">
                {dailySales.map(day => {
                  const maxRevenue = Math.max(...dailySales.map(d => d.revenue))
                  const height = maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0
                  return (
                    <div key={day.date} className="salesStats__dailyBar">
                      <div className="salesStats__dailyBarWrapper">
                        <div 
                          className="salesStats__dailyBarFill"
                          style={{ height: `${height}%` }}
                        >
                          <span className="salesStats__dailyBarValue">{formatCurrency(day.revenue)}</span>
                        </div>
                      </div>
                      <span className="salesStats__dailyBarLabel">
                        {new Date(day.date).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' })}
                      </span>
                      <span className="salesStats__dailyBarOrders">{day.orders} ped.</span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="salesStats__empty">
                <BarChart3 size={32} />
                <p>No hay datos de ventas diarias</p>
              </div>
            )}
          </Card>
        </>
      )}

      {/* SECCIÓN: PRODUCTOS */}
      {activeSection === 'products' && (
        <>
          <div className="salesStats__kpiGrid salesStats__kpiGrid--compact">
            <div className="salesStats__kpi">
              <div className="salesStats__kpiIcon"><Package size={24} /></div>
              <div className="salesStats__kpiContent">
                <span className="salesStats__kpiLabel">Productos Vendidos</span>
                <span className="salesStats__kpiValue">{productStats.totalProductsSold}</span>
              </div>
            </div>
            <div className="salesStats__kpi">
              <div className="salesStats__kpiIcon"><Star size={24} /></div>
              <div className="salesStats__kpiContent">
                <span className="salesStats__kpiLabel">Producto Estrella</span>
                <span className="salesStats__kpiValue salesStats__kpiValue--small">
                  {productStats.topProducts[0]?.name || 'N/A'}
                </span>
              </div>
            </div>
          </div>

          <Card title="Top 10 Productos Más Vendidos" className="salesStats__card salesStats__card--full">
            {productStats.topProducts.length > 0 ? (
              <div className="salesStats__productTable">
                <div className="salesStats__productHeader">
                  <span>#</span>
                  <span>Producto</span>
                  <span>Cantidad</span>
                  <span>Ingresos</span>
                </div>
                {productStats.topProducts.map((product, idx) => (
                  <div key={product.id} className="salesStats__productRow">
                    <span className="salesStats__productRank">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                    </span>
                    <span className="salesStats__productName">{product.name}</span>
                    <span className="salesStats__productQty">{product.quantity} uds</span>
                    <span className="salesStats__productRevenue">{formatCurrency(product.revenue)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="salesStats__empty">
                <Package size={32} />
                <p>No hay datos de productos</p>
              </div>
            )}
          </Card>
        </>
      )}

      {/* SECCIÓN: CLIENTES */}
      {activeSection === 'customers' && (
        <>
          <div className="salesStats__kpiGrid">
            <div className="salesStats__kpi">
              <div className="salesStats__kpiIcon"><Users size={24} /></div>
              <div className="salesStats__kpiContent">
                <span className="salesStats__kpiLabel">Total Clientes</span>
                <span className="salesStats__kpiValue">{customerStats.total}</span>
              </div>
            </div>
            <div className="salesStats__kpi">
              <div className="salesStats__kpiIcon"><UserCheck size={24} /></div>
              <div className="salesStats__kpiContent">
                <span className="salesStats__kpiLabel">Clientes Recurrentes</span>
                <span className="salesStats__kpiValue">{customerStats.recurring}</span>
                <span className="salesStats__kpiSubtext">{customerStats.recurrenceRate.toFixed(1)}% de recurrencia</span>
              </div>
            </div>
            <div className="salesStats__kpi">
              <div className="salesStats__kpiIcon"><UserPlus size={24} /></div>
              <div className="salesStats__kpiContent">
                <span className="salesStats__kpiLabel">Clientes Nuevos</span>
                <span className="salesStats__kpiValue">{customerStats.new}</span>
              </div>
            </div>
          </div>

          <Card title="Mejores Clientes" className="salesStats__card salesStats__card--full">
            {customerStats.topCustomers.length > 0 ? (
              <div className="salesStats__customerTable">
                <div className="salesStats__customerHeader">
                  <span>#</span>
                  <span>Cliente</span>
                  <span>Pedidos</span>
                  <span>Total Gastado</span>
                </div>
                {customerStats.topCustomers.map((customer, idx) => (
                  <div key={customer.phone} className="salesStats__customerRow">
                    <span className="salesStats__customerRank">
                      {idx === 0 ? '🏆' : `#${idx + 1}`}
                    </span>
                    <div className="salesStats__customerInfo">
                      <span className="salesStats__customerName">{customer.name}</span>
                      <span className="salesStats__customerPhone">{customer.phone}</span>
                    </div>
                    <span className="salesStats__customerOrders">{customer.orders}</span>
                    <span className="salesStats__customerSpent">{formatCurrency(customer.totalSpent)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="salesStats__empty">
                <Users size={32} />
                <p>No hay datos de clientes</p>
              </div>
            )}
          </Card>
        </>
      )}

      {/* SECCIÓN: INVENTARIO */}
      {activeSection === 'inventory' && (
        <>
          <div className="salesStats__kpiGrid">
            <div className="salesStats__kpi">
              <div className="salesStats__kpiIcon"><Package size={24} /></div>
              <div className="salesStats__kpiContent">
                <span className="salesStats__kpiLabel">Productos con Stock</span>
                <span className="salesStats__kpiValue">{inventoryStats.totalProducts}</span>
              </div>
            </div>
            <div className="salesStats__kpi">
              <div className="salesStats__kpiIcon"><BarChart3 size={24} /></div>
              <div className="salesStats__kpiContent">
                <span className="salesStats__kpiLabel">Stock Total</span>
                <span className="salesStats__kpiValue">{inventoryStats.totalStock}</span>
              </div>
            </div>
            <div className="salesStats__kpi salesStats__kpi--info">
              <div className="salesStats__kpiIcon"><TrendingUp size={24} /></div>
              <div className="salesStats__kpiContent">
                <span className="salesStats__kpiLabel">Unidades Vendidas</span>
                <span className="salesStats__kpiValue">{inventoryStats.totalSold}</span>
              </div>
            </div>
            <div className="salesStats__kpi salesStats__kpi--warning">
              <div className="salesStats__kpiIcon"><AlertTriangle size={24} /></div>
              <div className="salesStats__kpiContent">
                <span className="salesStats__kpiLabel">Stock Bajo</span>
                <span className="salesStats__kpiValue">{inventoryStats.lowStock.length}</span>
              </div>
            </div>
            <div className="salesStats__kpi salesStats__kpi--danger">
              <div className="salesStats__kpiIcon"><AlertTriangle size={24} /></div>
              <div className="salesStats__kpiContent">
                <span className="salesStats__kpiLabel">Sin Stock</span>
                <span className="salesStats__kpiValue">{inventoryStats.outOfStock.length}</span>
              </div>
            </div>
          </div>

          {/* Top productos vendidos */}
          {inventoryStats.topSelling.length > 0 && (
            <Card title="🔥 Más Vendidos (con stock limitado)" className="salesStats__card salesStats__card--full">
              <div className="salesStats__inventoryList">
                {inventoryStats.topSelling.map((product, idx) => (
                  <div key={product.id} className="salesStats__inventoryItem salesStats__inventoryItem--selling">
                    <span className="salesStats__inventoryRank">#{idx + 1}</span>
                    <span className="salesStats__inventoryName">{product.name}</span>
                    <div className="salesStats__inventoryStats">
                      <span className="salesStats__inventorySold">{product.sold} vendidos</span>
                      <span className={`salesStats__inventoryStock ${product.stock <= 5 ? 'salesStats__inventoryStock--low' : ''}`}>
                        {product.stock} en stock
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {inventoryStats.lowStock.length > 0 && (
            <Card title="⚠️ Productos con Stock Bajo" className="salesStats__card salesStats__card--full">
              <div className="salesStats__inventoryList">
                {inventoryStats.lowStock.map(product => (
                  <div key={product.id} className="salesStats__inventoryItem salesStats__inventoryItem--warning">
                    <span className="salesStats__inventoryName">{product.name}</span>
                    <div className="salesStats__inventoryStats">
                      <span className="salesStats__inventorySold">{product.sold} vendidos</span>
                      <span className="salesStats__inventoryStock salesStats__inventoryStock--low">{product.stock} unidades</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {inventoryStats.outOfStock.length > 0 && (
            <Card title="🚫 Productos Agotados" className="salesStats__card salesStats__card--full">
              <div className="salesStats__inventoryList">
                {inventoryStats.outOfStock.map(product => (
                  <div key={product.id} className="salesStats__inventoryItem salesStats__inventoryItem--danger">
                    <span className="salesStats__inventoryName">{product.name}</span>
                    <div className="salesStats__inventoryStats">
                      <span className="salesStats__inventorySold">{product.sold} vendidos</span>
                      <span className="salesStats__inventoryStock salesStats__inventoryStock--out">Sin stock</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {inventoryStats.totalProducts === 0 && (
            <Card className="salesStats__card salesStats__card--full">
              <div className="salesStats__empty">
                <Package size={48} />
                <h3>Sin productos con stock limitado</h3>
                <p>Configura el stock de tus productos desde el gestor de productos para ver métricas aquí.</p>
              </div>
            </Card>
          )}

          {inventoryStats.totalProducts > 0 && inventoryStats.lowStock.length === 0 && inventoryStats.outOfStock.length === 0 && (
            <Card className="salesStats__card salesStats__card--full">
              <div className="salesStats__empty salesStats__empty--success">
                <Package size={48} />
                <h3>¡Inventario en orden! ✓</h3>
                <p>Todos los productos tienen stock suficiente.</p>
              </div>
            </Card>
          )}
        </>
      )}

      {/* SECCIÓN: VENTAS POR HORA */}
      {activeSection === 'hourly' && (
        <>
          <Card title="Ventas por Hora del Día" className="salesStats__card salesStats__card--full">
            <div className="salesStats__hourlyChart">
              {hourlySales.map(hour => {
                const maxOrders = Math.max(...hourlySales.map(h => h.orders))
                const height = maxOrders > 0 ? (hour.orders / maxOrders) * 100 : 0
                const isPeak = hour.hour === peakHour.hour && hour.orders > 0
                return (
                  <div 
                    key={hour.hour} 
                    className={`salesStats__hourlyBar ${isPeak ? 'peak' : ''}`}
                    title={`${hour.label}: ${hour.orders} pedidos - ${formatCurrency(hour.revenue)}`}
                  >
                    <div className="salesStats__hourlyBarWrapper">
                      <div 
                        className="salesStats__hourlyBarFill"
                        style={{ height: `${height}%` }}
                      />
                    </div>
                    <span className="salesStats__hourlyLabel">{hour.hour}</span>
                  </div>
                )
              })}
            </div>
            <div className="salesStats__hourlyLegend">
              <div className="salesStats__hourlyLegendItem">
                <span className="salesStats__hourlyLegendDot peak"></span>
                <span>Hora pico: {peakHour.label} ({peakHour.orders} pedidos)</span>
              </div>
            </div>
          </Card>

          <div className="salesStats__row">
            <Card title="Resumen por Horario" className="salesStats__card">
              <div className="salesStats__timeSlots">
                {[
                  { label: 'Mañana (6-12)', start: 6, end: 12, icon: '🌅' },
                  { label: 'Mediodía (12-15)', start: 12, end: 15, icon: '☀️' },
                  { label: 'Tarde (15-19)', start: 15, end: 19, icon: '🌤️' },
                  { label: 'Noche (19-23)', start: 19, end: 23, icon: '🌙' },
                ].map(slot => {
                  const slotData = hourlySales
                    .filter(h => h.hour >= slot.start && h.hour < slot.end)
                    .reduce((acc, h) => ({ orders: acc.orders + h.orders, revenue: acc.revenue + h.revenue }), { orders: 0, revenue: 0 })
                  
                  return (
                    <div key={slot.label} className="salesStats__timeSlot">
                      <span className="salesStats__timeSlotIcon">{slot.icon}</span>
                      <div className="salesStats__timeSlotInfo">
                        <span className="salesStats__timeSlotLabel">{slot.label}</span>
                        <span className="salesStats__timeSlotOrders">{slotData.orders} pedidos</span>
                      </div>
                      <span className="salesStats__timeSlotRevenue">{formatCurrency(slotData.revenue)}</span>
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
