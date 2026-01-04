import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './Sidebar.css'
import {
  ClipboardList,
  DollarSign,
  UtensilsCrossed,
  ChefHat,
  Package,
  Store,
  Settings,
  Eye,
  QrCode,
  Link2,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Menu,
  X,
  BarChart3,
  Layers,
  CreditCard,
  Crown,
  ShoppingBag,
  Infinity,
} from 'lucide-react'

const MENU_ITEMS = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'store-editor', label: 'Editar mi tienda', icon: Store },
  { id: 'mobile-preview', label: 'Vista Móvil', icon: Eye },
  { id: 'orders', label: 'Pedidos', icon: ClipboardList },
  { id: 'sales', label: 'Ventas', icon: DollarSign },
  { id: 'menu', label: 'Productos', icon: UtensilsCrossed },
  { id: 'extras', label: 'Extras / Toppings', icon: Layers },
  { id: 'mercadopago', label: 'MercadoPago', icon: CreditCard },
  { id: 'plans', label: 'Mi Plan', icon: Crown },
  { id: 'kitchen', label: 'Cocina', icon: ChefHat },
  { id: 'inventory', label: 'Inventario', icon: Package },
  { id: 'reports', label: 'Reportes', icon: BarChart3 },  
  { id: 'qr', label: 'QR y Enlaces', icon: QrCode },
  
]

export default function Sidebar({ 
  activeTab, 
  onTabChange, 
  tenantName = 'Mi Restaurante',
  tenantLogo = '',
  tenantSlug = '',
  subscriptionTier = 'free',
  pendingOrdersCount = 0,
  isCollapsed = false,
  onCollapsedChange,
  onPendingOrdersClick,
  // Order limits props
  orderLimitsStatus = null,
}) {
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  // Close mobile sidebar when route changes
  useEffect(() => {
    setIsMobileOpen(false)
  }, [location.pathname])

  // Close mobile sidebar on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') setIsMobileOpen(false)
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [])

  const handleTabClick = (tabId) => {
    onTabChange(tabId)
    setIsMobileOpen(false)
  }

  const getTierBadge = () => {
    if (subscriptionTier === 'premium_pro') return { label: 'PRO', class: 'pro' }
    if (subscriptionTier === 'premium') return { label: 'Premium', class: 'premium' }
    return null
  }

  const tierBadge = getTierBadge()

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="sidebar__overlay"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${isCollapsed ? 'sidebar--collapsed' : ''} ${isMobileOpen ? 'sidebar--mobileOpen' : ''}`}>
        {/* Mobile Toggle Tab - Parte del sidebar */}
        <button 
          className="sidebar__mobileTab"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          aria-label={isMobileOpen ? 'Cerrar menú' : 'Abrir menú'}
        >
          {isMobileOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>

        {/* Sidebar Content - Scrolleable */}
        <div className="sidebar__content">
          {/* Header */}
          <div className="sidebar__header">
            {!isCollapsed && (
              <div className="sidebar__brand">
                <div className="sidebar__brandIcon">
                  {tenantLogo ? (
                    <img src={tenantLogo} alt={tenantName} className="sidebar__brandLogo" />
                  ) : (
                    <UtensilsCrossed size={20} />
                  )}
                </div>
                <div className="sidebar__brandInfo">
                  <span className="sidebar__brandName">{tenantName}</span>
                  {tierBadge && (
                    <span className={`sidebar__tierBadge sidebar__tierBadge--${tierBadge.class}`}>
                      {tierBadge.label}
                    </span>
                  )}
                </div>
              </div>
          )}
          {isCollapsed && (
            <div className="sidebar__brandIcon sidebar__brandIcon--collapsed">
              {tenantLogo ? (
                <img src={tenantLogo} alt={tenantName} className="sidebar__brandLogo sidebar__brandLogo--collapsed" />
              ) : (
                <UtensilsCrossed size={24} />
              )}
            </div>
          )}
          </div>

          {/* Navigation */}
          <nav className="sidebar__nav">
            <ul className="sidebar__menu">
              {MENU_ITEMS.map((item) => {
                const Icon = item.icon
                const isActive = activeTab === item.id
                const showPendingBadge = item.id === 'orders' && pendingOrdersCount > 0
                const showOrderLimitsBadge = item.id === 'orders' && orderLimitsStatus && !orderLimitsStatus.isUnlimited
                
                // Calculate order limits urgency
                const getOrderLimitsUrgency = () => {
                  if (!orderLimitsStatus || orderLimitsStatus.isUnlimited) return 'normal'
                  const { remaining, limit } = orderLimitsStatus
                  if (remaining <= 0) return 'empty'
                  const percentage = limit > 0 ? (remaining / limit) * 100 : 0
                  if (percentage <= 20) return 'critical'
                  if (percentage <= 40) return 'warning'
                  return 'normal'
                }
                const orderLimitsUrgency = getOrderLimitsUrgency()
                
                return (
                  <li key={item.id}>
                    <button
                      className={`sidebar__menuItem ${isActive ? 'sidebar__menuItem--active' : ''}`}
                      onClick={() => handleTabClick(item.id)}
                      title={isCollapsed ? item.label : undefined}
                    >
                      <span className="sidebar__menuIcon">
                        <Icon size={20} />
                        {showPendingBadge && (
                          <span 
                            className="sidebar__ordersBadge"
                            onClick={(e) => {
                              e.stopPropagation()
                              onPendingOrdersClick?.()
                            }}
                            title="Ver pedidos pendientes"
                          >
                            {pendingOrdersCount > 9 ? '9+' : pendingOrdersCount}
                          </span>
                        )}
                      </span>
                      {!isCollapsed && (
                        <span className="sidebar__menuLabel">{item.label}</span>
                      )}
                      {!isCollapsed && showPendingBadge && (
                        <span 
                          className="sidebar__ordersCount"
                          onClick={(e) => {
                            e.stopPropagation()
                            onPendingOrdersClick?.()
                          }}
                          title="Ver pedidos pendientes"
                        >
                          {pendingOrdersCount}
                        </span>
                      )}
                      {isActive && <span className="sidebar__menuIndicator" />}
                    </button>
                    
                    {/* Order Limits Badge - Only show for orders menu item */}
                    {item.id === 'orders' && showOrderLimitsBadge && !isCollapsed && (
                      <div 
                        className={`sidebar__orderLimitsBadge sidebar__orderLimitsBadge--${orderLimitsUrgency}`}
                        title={`${orderLimitsStatus.remaining} de ${orderLimitsStatus.limit} pedidos disponibles hoy`}
                      >
                        <ShoppingBag size={14} />
                        <span className="sidebar__orderLimitsCount">
                          {orderLimitsStatus.remaining}
                        </span>
                        <span className="sidebar__orderLimitsLabel">
                          pedidos hoy
                        </span>
                      </div>
                    )}
                    
                    {/* Collapsed version of order limits */}
                    {item.id === 'orders' && showOrderLimitsBadge && isCollapsed && (
                      <div 
                        className={`sidebar__orderLimitsBadgeCollapsed sidebar__orderLimitsBadge--${orderLimitsUrgency}`}
                        title={`${orderLimitsStatus.remaining} de ${orderLimitsStatus.limit} pedidos disponibles hoy`}
                      >
                        {orderLimitsStatus.remaining}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* Collapse Toggle */}
          <button 
            className="sidebar__collapseBtn"
            onClick={() => onCollapsedChange?.(!isCollapsed)}
            title={isCollapsed ? 'Expandir' : 'Colapsar'}
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            {!isCollapsed && <span>Contraer</span>}
          </button>
        </div>
      </aside>
    </>
  )
}
