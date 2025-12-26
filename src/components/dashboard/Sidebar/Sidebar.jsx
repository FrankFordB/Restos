import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './Sidebar.css'
import {
  ClipboardList,
  DollarSign,
  UtensilsCrossed,
  ChefHat,
  Package,
  Users,
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
} from 'lucide-react'

const MENU_ITEMS = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'orders', label: 'Pedidos', icon: ClipboardList },
  { id: 'sales', label: 'Ventas', icon: DollarSign },
  { id: 'menu', label: 'Menú', icon: UtensilsCrossed },
  { id: 'extras', label: 'Extras / Toppings', icon: Layers },
  { id: 'kitchen', label: 'Cocina', icon: ChefHat },
  { id: 'inventory', label: 'Inventario', icon: Package },
  { id: 'customers', label: 'Clientes', icon: Users },
  { id: 'settings', label: 'Configuraciones', icon: Settings },
  { id: 'reports', label: 'Reportes', icon: BarChart3 },
  { id: 'preview', label: 'Vista previa', icon: Eye },
  { id: 'qr', label: 'QR y Enlaces', icon: QrCode },
]

export default function Sidebar({ 
  activeTab, 
  onTabChange, 
  tenantName = 'Mi Restaurante',
  tenantSlug = '',
  subscriptionTier = 'free',
  pendingOrdersCount = 0,
  isCollapsed = false,
  onCollapsedChange,
  onPendingOrdersClick,
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
    if (tabId === 'preview' && tenantSlug) {
      // Open store in new tab
      window.open(`/store/${tenantSlug}`, '_blank')
      return
    }
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
      {/* Mobile Toggle Button */}
      <button 
        className="sidebar__mobileToggle"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        aria-label={isMobileOpen ? 'Cerrar menú' : 'Abrir menú'}
      >
        {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="sidebar__overlay"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${isCollapsed ? 'sidebar--collapsed' : ''} ${isMobileOpen ? 'sidebar--mobileOpen' : ''}`}>
        {/* Header */}
        <div className="sidebar__header">
          {!isCollapsed && (
            <div className="sidebar__brand">
              <div className="sidebar__brandIcon">
                <UtensilsCrossed size={20} />
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
              <UtensilsCrossed size={24} />
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="sidebar__nav">
          <ul className="sidebar__menu">
            {MENU_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              const showBadge = item.id === 'orders' && pendingOrdersCount > 0
              
              return (
                <li key={item.id}>
                  <button
                    className={`sidebar__menuItem ${isActive ? 'sidebar__menuItem--active' : ''}`}
                    onClick={() => handleTabClick(item.id)}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <span className="sidebar__menuIcon">
                      <Icon size={20} />
                      {showBadge && (
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
                    {!isCollapsed && showBadge && (
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
      </aside>
    </>
  )
}
