import { useState, useEffect, useMemo, useCallback } from 'react'
import './SuperAdminDashboard.css'
import {
  Users,
  Shield,
  Activity,
  AlertTriangle,
  Settings,
  Search,
  Filter,
  RefreshCw,
  UserCheck,
  UserX,
  Store,
  Crown,
  Star,
  Package,
  Globe,
  EyeOff,
  Mail,
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  Bell,
  Lock,
  Unlock,
  MoreVertical,
  ChevronDown,
  ChevronRight,
  Download,
  Trash2,
  Edit,
  Eye,
  Ban,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  CreditCard,
  DollarSign,
  Server,
  Database,
  Zap,
  ShieldCheck,
  ShieldOff,
  FileText,
  MessageSquare,
  HelpCircle,
  LogOut,
  Key,
  Smartphone,
  Monitor,
  MapPin,
  ExternalLink,
  Link2,
} from 'lucide-react'
import {
  adminListProfiles,
  adminListTenants,
  adminSetAccountStatus,
  adminSetTenantVisibility,
  adminSetTenantTier,
  adminUpdateUser,
  adminUpdateTenant,
  adminDeleteUser,
  adminDeleteTenant,
  adminCreateTenant,
  adminLinkTenantToUser,
  adminUnlinkTenantFromUser,
  adminGetUsersWithoutTenant,
  adminGetTenantsWithoutOwner,
  adminBlockUser,
} from '../../lib/supabaseApi'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { selectUser, setAdminManagedTenantId } from '../../features/auth/authSlice'
import { SUBSCRIPTION_TIERS, TIER_LABELS, TIER_COLORS } from '../../shared/subscriptions'
import ConfirmModal from '../../components/ui/ConfirmModal/ConfirmModal'

// Tabs del dashboard
const TABS = [
  { id: 'overview', label: 'Resumen', icon: BarChart3 },
  { id: 'users', label: 'Usuarios', icon: Users },
  { id: 'tenants', label: 'Tiendas', icon: Store },
  { id: 'subscriptions', label: 'Suscripciones', icon: CreditCard },
  { id: 'audit', label: 'Auditoría', icon: Shield },
  { id: 'alerts', label: 'Alertas', icon: Bell },
  { id: 'system', label: 'Sistema', icon: Server },
]

export default function SuperAdminDashboard() {
  const dispatch = useAppDispatch()
  const currentUser = useAppSelector(selectUser)
  
  // State
  const [activeTab, setActiveTab] = useState('overview')
  const [profiles, setProfiles] = useState([])
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [userFilter, setUserFilter] = useState({ status: 'all', role: 'all' })
  const [tenantFilter, setTenantFilter] = useState({ status: 'all', tier: 'all' })
  
  // Modals
  const [confirmModal, setConfirmModal] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [editUserModal, setEditUserModal] = useState(null)
  const [editTenantModal, setEditTenantModal] = useState(null)
  const [createTenantModal, setCreateTenantModal] = useState(false)
  const [linkModal, setLinkModal] = useState(null)
  const [deleteUserModal, setDeleteUserModal] = useState(null) // { user, tenant }
  const [deleteTenantModal, setDeleteTenantModal] = useState(null) // { tenant, owner }
  const [setPremiumModal, setSetPremiumModal] = useState(null) // { tenantId, tier, days }
  
  // Form states for modals
  const [formLoading, setFormLoading] = useState(false)
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 15

  // Selección masiva de tiendas
  const [selectedTenants, setSelectedTenants] = useState(new Set())
  const [bulkActionLoading, setBulkActionLoading] = useState(false)

  // Load data
  const loadData = useCallback(async () => {
    if (!isSupabaseConfigured) return
    setLoading(true)
    setError(null)
    try {
      const [profilesData, tenantsData] = await Promise.all([
        adminListProfiles(),
        adminListTenants()
      ])
      setProfiles(profilesData || [])
      setTenants(tenantsData || [])
    } catch (e) {
      setError(e?.message || 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Stats calculations
  const stats = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
    
    const totalUsers = profiles.length
    const activeUsers = profiles.filter(p => p.account_status === 'active').length
    const suspendedUsers = profiles.filter(p => p.account_status === 'cancelled').length
    const newUsersWeek = profiles.filter(p => p.created_at && new Date(p.created_at) >= lastWeek).length
    const newUsersMonth = profiles.filter(p => p.created_at && new Date(p.created_at) >= lastMonth).length
    
    const totalTenants = tenants.length
    const publicTenants = tenants.filter(t => t.is_public !== false).length
    const premiumTenants = tenants.filter(t => 
      t.subscription_tier === 'premium' && t.premium_until && new Date(t.premium_until) > now
    ).length
    const proTenants = tenants.filter(t => 
      t.subscription_tier === 'premium_pro' && t.premium_until && new Date(t.premium_until) > now
    ).length
    const freeTenants = totalTenants - premiumTenants - proTenants
    
    // Revenue estimation
    const monthlyRevenue = (premiumTenants * 4999) + (proTenants * 9999)
    
    return {
      totalUsers, activeUsers, suspendedUsers, newUsersWeek, newUsersMonth,
      totalTenants, publicTenants, premiumTenants, proTenants, freeTenants,
      monthlyRevenue
    }
  }, [profiles, tenants])

  // Filtered data
  const filteredUsers = useMemo(() => {
    return profiles.filter(p => {
      const q = searchQuery.toLowerCase()
      if (q) {
        // Buscar en email, nombre y nombre de tienda asociada
        const userTenant = tenants.find(t => t.id === p.tenant_id)
        const tenantName = userTenant?.name?.toLowerCase() || ''
        const matchesSearch = 
          p.email?.toLowerCase().includes(q) ||
          p.full_name?.toLowerCase().includes(q) ||
          tenantName.includes(q)
        if (!matchesSearch) return false
      }
      if (userFilter.status !== 'all' && p.account_status !== userFilter.status) return false
      if (userFilter.role !== 'all' && p.role !== userFilter.role) return false
      return true
    })
  }, [profiles, tenants, searchQuery, userFilter])

  const filteredTenants = useMemo(() => {
    return tenants.filter(t => {
      const q = searchQuery.toLowerCase()
      // Buscar también por email del owner
      const owner = profiles.find(p => p.user_id === t.owner_user_id)
      const ownerEmail = owner?.email?.toLowerCase() || ''
      if (q && !t.name?.toLowerCase().includes(q) && !t.slug?.toLowerCase().includes(q) && !ownerEmail.includes(q)) {
        return false
      }
      if (tenantFilter.status === 'public' && t.is_public === false) return false
      if (tenantFilter.status === 'hidden' && t.is_public !== false) return false
      if (tenantFilter.tier !== 'all' && t.subscription_tier !== tenantFilter.tier) return false
      return true
    })
  }, [tenants, profiles, searchQuery, tenantFilter])

  // Toggle selección de tienda
  const toggleTenantSelection = (tenantId) => {
    setSelectedTenants(prev => {
      const newSet = new Set(prev)
      if (newSet.has(tenantId)) {
        newSet.delete(tenantId)
      } else {
        newSet.add(tenantId)
      }
      return newSet
    })
  }

  // Seleccionar/deseleccionar todas las tiendas filtradas
  const toggleAllTenants = () => {
    if (selectedTenants.size === filteredTenants.length) {
      setSelectedTenants(new Set())
    } else {
      setSelectedTenants(new Set(filteredTenants.map(t => t.id)))
    }
  }

  // Acciones masivas
  const handleBulkAction = async (action) => {
    if (selectedTenants.size === 0) return
    
    const count = selectedTenants.size
    const tenantIds = Array.from(selectedTenants)
    
    switch (action) {
      case 'delete':
        setConfirmModal({
          title: `Eliminar ${count} tienda${count > 1 ? 's' : ''}`,
          message: `¿Estás seguro de eliminar ${count} tienda${count > 1 ? 's' : ''} seleccionada${count > 1 ? 's' : ''}? Esta acción no se puede deshacer.`,
          variant: 'danger',
          onConfirm: async () => {
            setBulkActionLoading(true)
            try {
              for (const tenantId of tenantIds) {
                await adminDeleteTenant({ tenantId, deleteOwner: false, blockOwner: false })
              }
              setSuccessMsg(`${count} tienda${count > 1 ? 's' : ''} eliminada${count > 1 ? 's' : ''} correctamente`)
              setSelectedTenants(new Set())
              await loadData()
            } catch (e) {
              setError(e?.message || 'Error al eliminar tiendas')
            } finally {
              setBulkActionLoading(false)
              setConfirmModal(null)
            }
          }
        })
        break
      case 'hide':
        setBulkActionLoading(true)
        try {
          const hideErrors = []
          for (const tenantId of tenantIds) {
            try {
              await adminSetTenantVisibility({ tenantId, isPublic: false })
            } catch (err) {
              hideErrors.push(err?.message || 'Error')
            }
          }
          if (hideErrors.length > 0) {
            setError(`Algunos errores: ${hideErrors.join(', ')}`)
          } else {
            setSuccessMsg(`${count} tienda${count > 1 ? 's' : ''} oculta${count > 1 ? 's' : ''}`)
          }
          setSelectedTenants(new Set())
          await loadData()
        } catch (e) {
          setError(e?.message || 'Error al ocultar tiendas')
        } finally {
          setBulkActionLoading(false)
        }
        break
      case 'show':
        setBulkActionLoading(true)
        try {
          const showErrors = []
          for (const tenantId of tenantIds) {
            try {
              await adminSetTenantVisibility({ tenantId, isPublic: true })
            } catch (err) {
              showErrors.push(err?.message || 'Error')
            }
          }
          if (showErrors.length > 0) {
            setError(`Algunos errores: ${showErrors.join(', ')}`)
          } else {
            setSuccessMsg(`${count} tienda${count > 1 ? 's' : ''} visible${count > 1 ? 's' : ''}`)
          }
          setSelectedTenants(new Set())
          await loadData()
        } catch (e) {
          setError(e?.message || 'Error al mostrar tiendas')
        } finally {
          setBulkActionLoading(false)
        }
        break
    }
  }

  // User actions
  const handleUserAction = async (userId, action, data = {}) => {
    const user = profiles.find(p => p.user_id === userId)
    if (!user) return
    const userTenant = tenants.find(t => t.id === user.tenant_id)

    switch (action) {
      case 'suspend':
        setConfirmModal({
          title: 'Suspender Usuario',
          message: `¿Estás seguro de suspender a ${user.email}? El usuario no podrá acceder a su cuenta.`,
          variant: 'danger',
          onConfirm: async () => {
            try {
              await adminSetAccountStatus({ userId, status: 'cancelled' })
              setSuccessMsg('Usuario suspendido correctamente')
              await loadData()
            } catch (e) {
              setError(e?.message)
            }
            setConfirmModal(null)
          }
        })
        break
      case 'block':
        setConfirmModal({
          title: 'Bloquear Usuario',
          message: `¿Bloquear permanentemente a ${user.email}? El usuario quedará bloqueado y no podrá acceder.`,
          variant: 'danger',
          onConfirm: async () => {
            try {
              await adminBlockUser({ userId })
              setSuccessMsg('Usuario bloqueado correctamente')
              await loadData()
            } catch (e) {
              setError(e?.message)
            }
            setConfirmModal(null)
          }
        })
        break
      case 'activate':
        setConfirmModal({
          title: 'Reactivar Usuario',
          message: `¿Reactivar la cuenta de ${user.email}? El usuario podrá volver a acceder a la plataforma.`,
          variant: 'success',
          onConfirm: async () => {
            try {
              await adminSetAccountStatus({ userId, status: 'active' })
              setSuccessMsg('Usuario reactivado correctamente')
              await loadData()
            } catch (e) {
              setError(e?.message)
            }
            setConfirmModal(null)
          }
        })
        break
      case 'delete':
        // Si tiene tienda, preguntar qué hacer
        if (userTenant) {
          setDeleteUserModal({ user, tenant: userTenant })
        } else {
          setConfirmModal({
            title: 'Eliminar Usuario',
            message: `¿Eliminar permanentemente a ${user.email}? Esta acción no se puede deshacer.`,
            variant: 'danger',
            onConfirm: async () => {
              try {
                await adminDeleteUser({ userId, deleteWithTenant: false })
                setSuccessMsg('Usuario eliminado correctamente')
                await loadData()
              } catch (e) {
                setError(e?.message)
              }
              setConfirmModal(null)
            }
          })
        }
        break
      case 'edit':
        setEditUserModal({
          ...user,
          _originalRole: user.role,
          _originalStatus: user.account_status
        })
        break
      case 'view':
        setSelectedUser(user)
        break
      case 'link-tenant':
        setLinkModal({ type: 'user-to-tenant', userId, userName: user.email })
        break
    }
  }

  // Handle delete user with tenant options
  const handleDeleteUserConfirm = async (deleteWithTenant) => {
    if (!deleteUserModal) return
    setFormLoading(true)
    try {
      await adminDeleteUser({ 
        userId: deleteUserModal.user.user_id, 
        deleteWithTenant 
      })
      setSuccessMsg(deleteWithTenant 
        ? 'Usuario y tienda eliminados correctamente' 
        : 'Usuario eliminado, tienda conservada')
      setDeleteUserModal(null)
      await loadData()
    } catch (e) {
      setError(e?.message)
    } finally {
      setFormLoading(false)
    }
  }

  // Save user edits
  const handleSaveUser = async (e) => {
    e.preventDefault()
    setFormLoading(true)
    try {
      await adminUpdateUser({
        userId: editUserModal.user_id,
        updates: {
          full_name: editUserModal.full_name,
          role: editUserModal.role,
          account_status: editUserModal.account_status
        }
      })
      setSuccessMsg('Usuario actualizado correctamente')
      setEditUserModal(null)
      await loadData()
    } catch (e) {
      setError(e?.message)
    } finally {
      setFormLoading(false)
    }
  }

  // Tenant actions
  const handleTenantAction = async (tenantId, action, data = {}) => {
    const tenant = tenants.find(t => t.id === tenantId)
    if (!tenant) return
    // Buscar el owner de esta tienda
    const owner = profiles.find(p => p.user_id === tenant.owner_user_id)

    switch (action) {
      case 'toggle-visibility':
        try {
          await adminSetTenantVisibility({ tenantId, isPublic: data.isPublic })
          setSuccessMsg(`Tienda ${data.isPublic ? 'visible' : 'oculta'} correctamente`)
          await loadData()
        } catch (e) {
          setError(e?.message)
        }
        break
      case 'manage':
        dispatch(setAdminManagedTenantId(tenantId))
        break
      case 'edit':
        setEditTenantModal({ ...tenant })
        break
      case 'delete':
        // Siempre mostrar modal con opciones (con o sin owner)
        setDeleteTenantModal({ tenant, owner: owner || null })
        break
      case 'set-tier':
        // Si viene con modal abierto, abrir modal para seleccionar días y tier
        if (data.openModal) {
          setSetPremiumModal({ tenantId, tier: data.tier || 'premium', days: data.days || 30 })
        } else {
          // Aplicar directamente (desde modal)
          try {
            await adminSetTenantTier({ tenantId, tier: data.tier, days: data.days || 30 })
            setSuccessMsg(`Plan actualizado a ${TIER_LABELS[data.tier]} por ${data.days} días`)
            await loadData()
          } catch (e) {
            setError(e?.message)
          }
        }
        break
      case 'unlink':
        setConfirmModal({
          title: 'Desvincular Usuario',
          message: `¿Desvincular al usuario de "${tenant.name}"? El usuario ya no será dueño de esta tienda.`,
          variant: 'warning',
          onConfirm: async () => {
            try {
              await adminUnlinkTenantFromUser({ tenantId })
              setSuccessMsg('Usuario desvinculado correctamente')
              await loadData()
            } catch (e) {
              setError(e?.message)
            }
            setConfirmModal(null)
          }
        })
        break
      case 'link-user':
        setLinkModal({ type: 'tenant-to-user', tenantId, tenantName: tenant.name })
        break
    }
  }

  // Handle delete tenant with owner options
  const handleDeleteTenantConfirm = async (ownerAction) => {
    // ownerAction: 'delete' | 'block' | 'keep'
    if (!deleteTenantModal) return
    setFormLoading(true)
    try {
      await adminDeleteTenant({ 
        tenantId: deleteTenantModal.tenant.id,
        deleteOwner: ownerAction === 'delete',
        blockOwner: ownerAction === 'block'
      })
      let msg = 'Tienda eliminada'
      if (ownerAction === 'delete') msg += ' junto con su dueño'
      else if (ownerAction === 'block') msg += ', dueño bloqueado'
      else msg += ', dueño conservado'
      setSuccessMsg(msg)
      setDeleteTenantModal(null)
      await loadData()
    } catch (e) {
      setError(e?.message)
    } finally {
      setFormLoading(false)
    }
  }

  // Handle set premium tier with days (marked as gift from super admin)
  const handleSetPremium = async () => {
    if (!setPremiumModal) return
    setFormLoading(true)
    try {
      await adminSetTenantTier({ 
        tenantId: setPremiumModal.tenantId, 
        tier: setPremiumModal.tier, 
        days: setPremiumModal.tier === 'free' ? null : setPremiumModal.days 
      })
      if (setPremiumModal.tier === 'free') {
        setSuccessMsg('✓ Cambiado a Free - el usuario puede comprar su propia suscripción')
      } else {
        setSuccessMsg(`🎁 Plan ${TIER_LABELS[setPremiumModal.tier]} regalado por ${setPremiumModal.days} días`)
      }
      setSetPremiumModal(null)
      await loadData()
    } catch (e) {
      setError(e?.message)
    } finally {
      setFormLoading(false)
    }
  }

  // Save tenant edits
  const handleSaveTenant = async (e) => {
    e.preventDefault()
    setFormLoading(true)
    try {
      await adminUpdateTenant({
        tenantId: editTenantModal.id,
        updates: {
          name: editTenantModal.name,
          slug: editTenantModal.slug,
          description: editTenantModal.description,
          is_public: editTenantModal.is_public
        }
      })
      setSuccessMsg('Tienda actualizada correctamente')
      setEditTenantModal(null)
      await loadData()
    } catch (e) {
      setError(e?.message)
    } finally {
      setFormLoading(false)
    }
  }

  // Create new tenant
  const handleCreateTenant = async (e) => {
    e.preventDefault()
    setFormLoading(true)
    try {
      const form = e.target
      const name = form.name.value
      const slug = form.slug.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')
      const ownerUserId = form.owner?.value || null
      
      await adminCreateTenant({ name, slug, ownerUserId: ownerUserId || null, isPublic: true })
      setSuccessMsg('Tienda creada correctamente')
      setCreateTenantModal(false)
      await loadData()
    } catch (e) {
      setError(e?.message)
    } finally {
      setFormLoading(false)
    }
  }

  // Link tenant to user
  const handleLinkConfirm = async (selectedId) => {
    setFormLoading(true)
    try {
      if (linkModal.type === 'user-to-tenant') {
        await adminLinkTenantToUser({ tenantId: selectedId, userId: linkModal.userId })
        setSuccessMsg('Tienda vinculada al usuario correctamente')
      } else {
        await adminLinkTenantToUser({ tenantId: linkModal.tenantId, userId: selectedId })
        setSuccessMsg('Usuario vinculado a la tienda correctamente')
      }
      setLinkModal(null)
      await loadData()
    } catch (e) {
      setError(e?.message)
    } finally {
      setFormLoading(false)
    }
  }

  // Format helpers
  const formatDate = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('es-AR', {
      day: 'numeric', month: 'short', year: 'numeric'
    })
  }

  const formatRelativeTime = (date) => {
    if (!date) return '-'
    const now = new Date()
    const d = new Date(date)
    const diff = now - d
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (days === 0) return 'Hoy'
    if (days === 1) return 'Ayer'
    if (days < 7) return `Hace ${days} días`
    if (days < 30) return `Hace ${Math.floor(days / 7)} semanas`
    return formatDate(date)
  }

  // Render Overview Tab
  const renderOverview = () => (
    <div className="superAdmin__overview">
      {/* Stats Cards */}
      <div className="superAdmin__statsGrid">
        <div className="superAdmin__statCard superAdmin__statCard--primary">
          <div className="superAdmin__statIcon">
            <Users size={24} />
          </div>
          <div className="superAdmin__statContent">
            <span className="superAdmin__statValue">{stats.totalUsers}</span>
            <span className="superAdmin__statLabel">Usuarios Totales</span>
          </div>
          <div className="superAdmin__statTrend superAdmin__statTrend--up">
            <TrendingUp size={14} />
            <span>+{stats.newUsersWeek} esta semana</span>
          </div>
        </div>

        <div className="superAdmin__statCard superAdmin__statCard--success">
          <div className="superAdmin__statIcon">
            <Store size={24} />
          </div>
          <div className="superAdmin__statContent">
            <span className="superAdmin__statValue">{stats.totalTenants}</span>
            <span className="superAdmin__statLabel">Tiendas Activas</span>
          </div>
          <div className="superAdmin__statMeta">
            <span>{stats.publicTenants} públicas</span>
          </div>
        </div>

        <div className="superAdmin__statCard superAdmin__statCard--warning">
          <div className="superAdmin__statIcon">
            <Crown size={24} />
          </div>
          <div className="superAdmin__statContent">
            <span className="superAdmin__statValue">{stats.premiumTenants + stats.proTenants}</span>
            <span className="superAdmin__statLabel">Suscripciones Activas</span>
          </div>
          <div className="superAdmin__statBreakdown">
            <span><Star size={12} /> {stats.premiumTenants} Premium</span>
            <span><Crown size={12} /> {stats.proTenants} Pro</span>
          </div>
        </div>

        <div className="superAdmin__statCard superAdmin__statCard--info">
          <div className="superAdmin__statIcon">
            <DollarSign size={24} />
          </div>
          <div className="superAdmin__statContent">
            <span className="superAdmin__statValue">${(stats.monthlyRevenue / 100).toLocaleString()}</span>
            <span className="superAdmin__statLabel">Ingreso Mensual Est.</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="superAdmin__section">
        <h3 className="superAdmin__sectionTitle">Acciones Rápidas</h3>
        <div className="superAdmin__quickActions">
          <button className="superAdmin__quickAction" onClick={() => setActiveTab('users')}>
            <Users size={20} />
            <span>Gestionar Usuarios</span>
          </button>
          <button className="superAdmin__quickAction" onClick={() => setActiveTab('tenants')}>
            <Store size={20} />
            <span>Ver Tiendas</span>
          </button>
          <button className="superAdmin__quickAction" onClick={() => setActiveTab('subscriptions')}>
            <CreditCard size={20} />
            <span>Suscripciones</span>
          </button>
          <button className="superAdmin__quickAction" onClick={() => setActiveTab('audit')}>
            <Shield size={20} />
            <span>Auditoría</span>
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="superAdmin__section">
        <h3 className="superAdmin__sectionTitle">Actividad Reciente</h3>
        <div className="superAdmin__activityList">
          {profiles.slice(0, 5).map(user => (
            <div key={user.user_id} className="superAdmin__activityItem">
              <div className="superAdmin__activityAvatar">
                {user.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="superAdmin__activityContent">
                <span className="superAdmin__activityUser">{user.full_name || user.email}</span>
                <span className="superAdmin__activityAction">Se registró</span>
              </div>
              <span className="superAdmin__activityTime">{formatRelativeTime(user.created_at)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Charts placeholder */}
      <div className="superAdmin__chartsRow">
        <div className="superAdmin__chart">
          <h4>Distribución de Planes</h4>
          <div className="superAdmin__pieChart">
            <div className="superAdmin__pieLegend">
              <div className="superAdmin__legendItem">
                <span className="superAdmin__legendDot" style={{ background: '#6b7280' }}></span>
                <span>Free ({stats.freeTenants})</span>
              </div>
              <div className="superAdmin__legendItem">
                <span className="superAdmin__legendDot" style={{ background: '#f59e0b' }}></span>
                <span>Premium ({stats.premiumTenants})</span>
              </div>
              <div className="superAdmin__legendItem">
                <span className="superAdmin__legendDot" style={{ background: '#8b5cf6' }}></span>
                <span>Pro ({stats.proTenants})</span>
              </div>
            </div>
          </div>
        </div>

        <div className="superAdmin__chart">
          <h4>Estado de Usuarios</h4>
          <div className="superAdmin__barChart">
            <div className="superAdmin__bar">
              <div className="superAdmin__barFill superAdmin__barFill--success" 
                   style={{ width: `${(stats.activeUsers / stats.totalUsers) * 100}%` }}>
              </div>
              <span>Activos: {stats.activeUsers}</span>
            </div>
            <div className="superAdmin__bar">
              <div className="superAdmin__barFill superAdmin__barFill--danger" 
                   style={{ width: `${(stats.suspendedUsers / stats.totalUsers) * 100}%` }}>
              </div>
              <span>Suspendidos: {stats.suspendedUsers}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // Render Users Tab
  const renderUsers = () => (
    <div className="superAdmin__users">
      {/* Filters */}
      <div className="superAdmin__toolbar">
        <div className="superAdmin__search">
          <Search size={18} />
          <input
            type="text"
            placeholder="Buscar por email, nombre o tienda..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="superAdmin__filters">
          <select 
            value={userFilter.status} 
            onChange={(e) => setUserFilter(f => ({ ...f, status: e.target.value }))}
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="cancelled">Suspendidos</option>
            <option value="blocked">Bloqueados</option>
          </select>
          <select 
            value={userFilter.role} 
            onChange={(e) => setUserFilter(f => ({ ...f, role: e.target.value }))}
          >
            <option value="all">Todos los roles</option>
            <option value="tenant_admin">Tenant Admin</option>
            <option value="super_admin">Super Admin</option>
          </select>
        </div>
        <button className="superAdmin__refreshBtn" onClick={loadData}>
          <RefreshCw size={16} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* Users Table */}
      <div className="superAdmin__tableWrapper">
        <div className="superAdmin__table superAdmin__table--users">
          <div className="superAdmin__tableHeader superAdmin__tableHeader--users">
            <span>Usuario</span>
            <span>Email</span>
            <span>Rol</span>
            <span>Estado</span>
            <span>Tienda</span>
            <span>Acciones</span>
        </div>
        <div className="superAdmin__tableBody">
          {filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(user => {
            const tenant = tenants.find(t => t.id === user.tenant_id)
            return (
              <div key={user.user_id} className="superAdmin__tableRow superAdmin__tableRow--users">
                <div className="superAdmin__userCell">
                  <div className="superAdmin__userAvatar">
                    {user.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || '?'}
                  </div>
                  <span className="superAdmin__userName">{user.full_name || 'Sin nombre'}</span>
                </div>
                <div className="superAdmin__emailCell">
                  <a href={`mailto:${user.email}`} className="superAdmin__userEmail">{user.email}</a>
                </div>
                <div className="superAdmin__roleCell">
                  <span className={`superAdmin__roleBadge superAdmin__roleBadge--${user.role}`}>
                    {user.role === 'super_admin' ? <Shield size={12} /> : <Users size={12} />}
                    {user.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                  </span>
                </div>
                <div className="superAdmin__statusCell">
                  <span className={`superAdmin__statusBadge superAdmin__statusBadge--${user.account_status}`}>
                    {user.account_status === 'active' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                    {user.account_status === 'active' ? 'Activo' : 'Suspendido'}
                  </span>
                </div>
                <div className="superAdmin__tenantCell">
                  {tenant ? (
                    <span className="superAdmin__tenantLink" onClick={() => handleTenantAction(tenant.id, 'edit')}>
                      <Store size={12} />
                      {tenant.name}
                    </span>
                  ) : (
                    <button 
                      className="superAdmin__linkBtn"
                      onClick={() => handleUserAction(user.user_id, 'link-tenant')}
                    >
                      + Vincular tienda
                    </button>
                  )}
                </div>
                <div className="superAdmin__actionsCell">
                  <button 
                    className="superAdmin__actionBtn" 
                    title="Ver perfil"
                    onClick={() => handleUserAction(user.user_id, 'view')}
                  >
                    <Eye size={16} />
                  </button>
                  <button 
                    className="superAdmin__actionBtn" 
                    title="Editar"
                    onClick={() => handleUserAction(user.user_id, 'edit')}
                  >
                    <Edit size={16} />
                  </button>
                  {user.role !== 'super_admin' && (
                    <>
                      {user.account_status === 'active' ? (
                        <button 
                          className="superAdmin__actionBtn superAdmin__actionBtn--danger" 
                          title="Suspender"
                          onClick={() => handleUserAction(user.user_id, 'suspend')}
                        >
                          <Ban size={16} />
                        </button>
                      ) : user.account_status !== 'blocked' ? (
                        <button 
                          className="superAdmin__actionBtn superAdmin__actionBtn--success" 
                          title="Reactivar"
                          onClick={() => handleUserAction(user.user_id, 'activate')}
                        >
                          <CheckCircle size={16} />
                        </button>
                      ) : null}
                      <button 
                        className="superAdmin__actionBtn superAdmin__actionBtn--danger" 
                        title="Eliminar"
                        onClick={() => handleUserAction(user.user_id, 'delete')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        </div>
      </div>

      {/* Pagination */}
      <div className="superAdmin__pagination">
        <span>Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, filteredUsers.length)} - {Math.min(currentPage * itemsPerPage, filteredUsers.length)} de {filteredUsers.length}</span>
        <div className="superAdmin__paginationBtns">
          <button 
            disabled={currentPage === 1} 
            onClick={() => setCurrentPage(p => p - 1)}
          >
            Anterior
          </button>
          <button 
            disabled={currentPage * itemsPerPage >= filteredUsers.length}
            onClick={() => setCurrentPage(p => p + 1)}
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  )

  // Render Tenants Tab
  const renderTenants = () => (
    <div className="superAdmin__tenants">
      {/* Bulk Actions Bar */}
      {selectedTenants.size > 0 && (
        <div className="superAdmin__bulkBar">
          <span className="superAdmin__bulkCount">
            {selectedTenants.size} tienda{selectedTenants.size > 1 ? 's' : ''} seleccionada{selectedTenants.size > 1 ? 's' : ''}
          </span>
          <div className="superAdmin__bulkActions">
            <button 
              className="superAdmin__bulkBtn superAdmin__bulkBtn--show"
              onClick={() => handleBulkAction('show')}
              disabled={bulkActionLoading}
            >
              <Globe size={14} />
              <span>Hacer Públicas</span>
            </button>
            <button 
              className="superAdmin__bulkBtn superAdmin__bulkBtn--hide"
              onClick={() => handleBulkAction('hide')}
              disabled={bulkActionLoading}
            >
              <EyeOff size={14} />
              <span>Ocultar</span>
            </button>
            <button 
              className="superAdmin__bulkBtn superAdmin__bulkBtn--delete"
              onClick={() => handleBulkAction('delete')}
              disabled={bulkActionLoading}
            >
              <Trash2 size={14} />
              <span>Eliminar</span>
            </button>
          </div>
          <button 
            className="superAdmin__bulkClear"
            onClick={() => setSelectedTenants(new Set())}
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="superAdmin__toolbar">
        <div className="superAdmin__checkAll">
          <input 
            type="checkbox"
            checked={selectedTenants.size === filteredTenants.length && filteredTenants.length > 0}
            onChange={toggleAllTenants}
            title="Seleccionar todas"
          />
        </div>
        <div className="superAdmin__search">
          <Search size={18} />
          <input
            type="text"
            placeholder="Buscar tienda..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="superAdmin__filters">
          <select 
            value={tenantFilter.status} 
            onChange={(e) => setTenantFilter(f => ({ ...f, status: e.target.value }))}
          >
            <option value="all">Todas</option>
            <option value="public">Públicas</option>
            <option value="hidden">Ocultas</option>
          </select>
          <select 
            value={tenantFilter.tier} 
            onChange={(e) => setTenantFilter(f => ({ ...f, tier: e.target.value }))}
          >
            <option value="all">Todos los planes</option>
            <option value="free">Free</option>
            <option value="premium">Premium</option>
            <option value="premium_pro">Pro</option>
          </select>
        </div>
        <button className="superAdmin__refreshBtn" onClick={loadData}>
          <RefreshCw size={16} />
          <span>Actualizar</span>
        </button>
        <button className="superAdmin__createBtn" onClick={() => setCreateTenantModal(true)}>
          <Store size={16} />
          <span>Nueva Tienda</span>
        </button>
      </div>

      {/* Tenants Grid */}
      <div className="superAdmin__tenantsGrid">
        {filteredTenants.map(tenant => {
          const owner = profiles.find(p => p.user_id === tenant.owner_user_id)
          const isPremium = tenant.premium_until && new Date(tenant.premium_until) > new Date()
          const isSelected = selectedTenants.has(tenant.id)
          
          return (
            <div key={tenant.id} className={`superAdmin__tenantCard ${isSelected ? 'superAdmin__tenantCard--selected' : ''}`}>
              <div className="superAdmin__tenantCheck">
                <input 
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleTenantSelection(tenant.id)}
                />
              </div>
              <div className="superAdmin__tenantHeader">
                <div className="superAdmin__tenantLogo">
                  {tenant.logo ? (
                    <img src={tenant.logo} alt={tenant.name} />
                  ) : (
                    <Store size={24} />
                  )}
                </div>
                <div className="superAdmin__tenantInfo">
                  <h4>{tenant.name}</h4>
                  <span className="superAdmin__tenantSlug">/{tenant.slug}</span>
                </div>
                <span 
                  className="superAdmin__tierBadge"
                  style={{ '--tier-color': TIER_COLORS[tenant.subscription_tier] || TIER_COLORS.free }}
                >
                  {tenant.subscription_tier === 'premium_pro' ? <Crown size={12} /> : 
                   tenant.subscription_tier === 'premium' ? <Star size={12} /> : <Package size={12} />}
                  {TIER_LABELS[tenant.subscription_tier] || 'Free'}
                  {tenant.is_gifted && <span className="superAdmin__giftIcon" title="Regalado">🎁</span>}
                </span>
              </div>
              
              <div className="superAdmin__tenantMeta">
                <div className="superAdmin__tenantMetaItem superAdmin__tenantMetaItem--owner">
                  <Users size={14} />
                  {owner ? (
                    <div className="superAdmin__ownerInfo">
                      <span className="superAdmin__ownerName">{owner.full_name || 'Sin nombre'}</span>
                      <a href={`mailto:${owner.email}`} className="superAdmin__ownerEmail">{owner.email}</a>
                    </div>
                  ) : (
                    <button 
                      className="superAdmin__linkBtnSmall"
                      onClick={() => handleTenantAction(tenant.id, 'link-user')}
                    >
                      + Vincular usuario
                    </button>
                  )}
                </div>
                <div className="superAdmin__tenantMetaItem">
                  {tenant.is_public !== false ? (
                    <><Globe size={14} /> <span>Pública</span></>
                  ) : (
                    <><EyeOff size={14} /> <span>Oculta</span></>
                  )}
                </div>
                {isPremium && tenant.premium_until && (
                  <div className="superAdmin__tenantMetaItem">
                    <Calendar size={14} />
                    <span>Expira: {formatDate(tenant.premium_until)}</span>
                  </div>
                )}
              </div>

              <div className="superAdmin__tenantActions">
                <button 
                  className="superAdmin__tenantBtn"
                  onClick={() => handleTenantAction(tenant.id, 'edit')}
                >
                  <Edit size={14} />
                  Editar
                </button>
                <a 
                  href={`/store/${tenant.slug}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="superAdmin__tenantBtn superAdmin__tenantBtn--outline"
                >
                  <ExternalLink size={14} />
                  Ver
                </a>
                <button 
                  className="superAdmin__tenantBtn superAdmin__tenantBtn--icon"
                  onClick={() => handleTenantAction(tenant.id, 'toggle-visibility', { isPublic: tenant.is_public === false })}
                  title={tenant.is_public !== false ? 'Ocultar' : 'Hacer pública'}
                >
                  {tenant.is_public !== false ? <EyeOff size={14} /> : <Globe size={14} />}
                </button>
                {owner && (
                  <button 
                    className="superAdmin__tenantBtn superAdmin__tenantBtn--icon superAdmin__tenantBtn--danger"
                    onClick={() => handleTenantAction(tenant.id, 'unlink')}
                    title="Desvincular usuario"
                  >
                    <UserX size={14} />
                  </button>
                )}
                <button 
                  className="superAdmin__tenantBtn superAdmin__tenantBtn--icon superAdmin__tenantBtn--danger"
                  onClick={() => handleTenantAction(tenant.id, 'delete')}
                  title="Eliminar tienda"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  // Render Subscriptions Tab
  const renderSubscriptions = () => (
    <div className="superAdmin__subscriptions">
      <div className="superAdmin__subStats">
        <div className="superAdmin__subStat">
          <Package size={20} />
          <div>
            <span className="superAdmin__subStatValue">{stats.freeTenants}</span>
            <span className="superAdmin__subStatLabel">Plan Free</span>
          </div>
        </div>
        <div className="superAdmin__subStat superAdmin__subStat--premium">
          <Star size={20} />
          <div>
            <span className="superAdmin__subStatValue">{stats.premiumTenants}</span>
            <span className="superAdmin__subStatLabel">Plan Premium</span>
          </div>
        </div>
        <div className="superAdmin__subStat superAdmin__subStat--pro">
          <Crown size={20} />
          <div>
            <span className="superAdmin__subStatValue">{stats.proTenants}</span>
            <span className="superAdmin__subStatLabel">Plan Pro</span>
          </div>
        </div>
      </div>

      <h3 className="superAdmin__sectionTitle">Suscripciones Activas</h3>
      <div className="superAdmin__subList">
        {tenants.filter(t => t.subscription_tier !== 'free' && t.premium_until && new Date(t.premium_until) > new Date()).map(tenant => (
          <div key={tenant.id} className="superAdmin__subItem">
            <div className="superAdmin__subItemInfo">
              <span className="superAdmin__subItemName">{tenant.name}</span>
              <span 
                className="superAdmin__tierBadge"
                style={{ '--tier-color': TIER_COLORS[tenant.subscription_tier] }}
              >
                {tenant.subscription_tier === 'premium_pro' ? <Crown size={12} /> : <Star size={12} />}
                {TIER_LABELS[tenant.subscription_tier]}
              </span>
            </div>
            <div className="superAdmin__subItemExpiry">
              <Calendar size={14} />
              <span>Expira: {formatDate(tenant.premium_until)}</span>
            </div>
            <div className="superAdmin__subItemActions">
              <button 
                onClick={() => handleTenantAction(tenant.id, 'set-tier', { tier: tenant.subscription_tier || 'premium', days: 30, openModal: true })}
                className="superAdmin__subBtn superAdmin__subBtn--primary"
              >
                <Crown size={14} /> Gestionar Plan
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  // Render Audit Tab
  const renderAudit = () => (
    <div className="superAdmin__audit">
      <div className="superAdmin__auditHeader">
        <h3>Registro de Auditoría</h3>
        <p className="superAdmin__auditSubtitle">Historial de acciones administrativas</p>
      </div>

      <div className="superAdmin__auditPlaceholder">
        <Shield size={48} />
        <h4>Auditoría en desarrollo</h4>
        <p>El registro detallado de acciones estará disponible próximamente.</p>
        <ul className="superAdmin__auditFeatures">
          <li><CheckCircle size={14} /> Historial de cambios de usuarios</li>
          <li><CheckCircle size={14} /> Registro de inicio de sesión</li>
          <li><CheckCircle size={14} /> Cambios en suscripciones</li>
          <li><CheckCircle size={14} /> Modificaciones de tiendas</li>
        </ul>
      </div>
    </div>
  )

  // Render Alerts Tab
  const renderAlerts = () => (
    <div className="superAdmin__alerts">
      <div className="superAdmin__alertsHeader">
        <h3>Centro de Alertas</h3>
        <span className="superAdmin__alertsBadge">0 nuevas</span>
      </div>

      <div className="superAdmin__alertsList">
        {stats.suspendedUsers > 0 && (
          <div className="superAdmin__alertItem superAdmin__alertItem--warning">
            <AlertTriangle size={20} />
            <div className="superAdmin__alertContent">
              <span className="superAdmin__alertTitle">Usuarios suspendidos</span>
              <span className="superAdmin__alertDesc">Hay {stats.suspendedUsers} usuarios con cuenta suspendida.</span>
            </div>
            <button onClick={() => { setActiveTab('users'); setUserFilter(f => ({ ...f, status: 'cancelled' })) }}>
              Ver
            </button>
          </div>
        )}
        
        {tenants.filter(t => {
          if (!t.premium_until) return false
          const daysLeft = Math.ceil((new Date(t.premium_until) - new Date()) / (1000 * 60 * 60 * 24))
          return daysLeft > 0 && daysLeft <= 7
        }).map(t => (
          <div key={t.id} className="superAdmin__alertItem superAdmin__alertItem--info">
            <Clock size={20} />
            <div className="superAdmin__alertContent">
              <span className="superAdmin__alertTitle">Suscripción por vencer</span>
              <span className="superAdmin__alertDesc">{t.name} - expira en {Math.ceil((new Date(t.premium_until) - new Date()) / (1000 * 60 * 60 * 24))} días</span>
            </div>
          </div>
        ))}

        {stats.suspendedUsers === 0 && (
          <div className="superAdmin__alertsEmpty">
            <Bell size={32} />
            <p>No hay alertas pendientes</p>
          </div>
        )}
      </div>
    </div>
  )

  // Render System Tab
  const renderSystem = () => (
    <div className="superAdmin__system">
      <div className="superAdmin__systemGrid">
        <div className="superAdmin__systemCard">
          <div className="superAdmin__systemCardHeader">
            <Server size={20} />
            <h4>Estado del Sistema</h4>
          </div>
          <div className="superAdmin__systemStatus">
            <span className="superAdmin__systemStatusDot superAdmin__systemStatusDot--online"></span>
            <span>Operativo</span>
          </div>
        </div>

        <div className="superAdmin__systemCard">
          <div className="superAdmin__systemCardHeader">
            <Database size={20} />
            <h4>Base de Datos</h4>
          </div>
          <div className="superAdmin__systemMeta">
            <span>{stats.totalUsers} usuarios</span>
            <span>{stats.totalTenants} tiendas</span>
          </div>
        </div>

        <div className="superAdmin__systemCard">
          <div className="superAdmin__systemCardHeader">
            <ShieldCheck size={20} />
            <h4>Seguridad</h4>
          </div>
          <div className="superAdmin__systemMeta">
            <span>SSL Activo</span>
            <span>RLS Habilitado</span>
          </div>
        </div>

        <div className="superAdmin__systemCard">
          <div className="superAdmin__systemCardHeader">
            <Zap size={20} />
            <h4>Rendimiento</h4>
          </div>
          <div className="superAdmin__systemMeta">
            <span>API: Normal</span>
            <span>CDN: Activo</span>
          </div>
        </div>
      </div>

      <div className="superAdmin__section">
        <h3 className="superAdmin__sectionTitle">Información del Sistema</h3>
        <div className="superAdmin__systemInfo">
          <div className="superAdmin__systemInfoRow">
            <span>Versión</span>
            <span>1.0.0</span>
          </div>
          <div className="superAdmin__systemInfoRow">
            <span>Entorno</span>
            <span>{import.meta.env.MODE}</span>
          </div>
          <div className="superAdmin__systemInfoRow">
            <span>Supabase</span>
            <span>{isSupabaseConfigured ? 'Conectado' : 'Mock Mode'}</span>
          </div>
          <div className="superAdmin__systemInfoRow">
            <span>Super Admin</span>
            <span>{currentUser?.email}</span>
          </div>
        </div>
      </div>
    </div>
  )

  // Render active tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview': return renderOverview()
      case 'users': return renderUsers()
      case 'tenants': return renderTenants()
      case 'subscriptions': return renderSubscriptions()
      case 'audit': return renderAudit()
      case 'alerts': return renderAlerts()
      case 'system': return renderSystem()
      default: return renderOverview()
    }
  }

  return (
    <div className="superAdmin">
      {/* Sidebar */}
      <aside className="superAdmin__sidebar">
        <div className="superAdmin__sidebarHeader">
          <Shield size={28} />
          <div>
            <h2>Super Admin</h2>
            <span>Panel de Control</span>
          </div>
        </div>

        <nav className="superAdmin__nav">
          {TABS.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            const alertCount = tab.id === 'alerts' && stats.suspendedUsers > 0 ? stats.suspendedUsers : 0
            
            return (
              <button
                key={tab.id}
                className={`superAdmin__navItem ${isActive ? 'superAdmin__navItem--active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={18} />
                <span>{tab.label}</span>
                {alertCount > 0 && (
                  <span className="superAdmin__navBadge">{alertCount}</span>
                )}
              </button>
            )
          })}
        </nav>

        <div className="superAdmin__sidebarFooter">
          <div className="superAdmin__adminInfo">
            <div className="superAdmin__adminAvatar">
              <ShieldCheck size={16} />
            </div>
            <div className="superAdmin__adminDetails">
              <span className="superAdmin__adminName">{currentUser?.email?.split('@')[0]}</span>
              <span className="superAdmin__adminRole">Super Administrador</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="superAdmin__main">
        {/* Header */}
        <header className="superAdmin__header">
          <div className="superAdmin__headerLeft">
            <h1>{TABS.find(t => t.id === activeTab)?.label || 'Dashboard'}</h1>
            <span className="superAdmin__breadcrumb">Super Admin / {TABS.find(t => t.id === activeTab)?.label}</span>
          </div>
          <div className="superAdmin__headerRight">
            <button className="superAdmin__headerBtn" onClick={loadData} title="Actualizar datos">
              <RefreshCw size={18} className={loading ? 'spin' : ''} />
            </button>
          </div>
        </header>

        {/* Error message */}
        {error && (
          <div className="superAdmin__error">
            <AlertCircle size={18} />
            <span>{error}</span>
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        {/* Success message */}
        {successMsg && (
          <div className="superAdmin__success">
            <CheckCircle size={18} />
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)}>×</button>
          </div>
        )}

        {/* Loading state */}
        {loading && profiles.length === 0 ? (
          <div className="superAdmin__loading">
            <RefreshCw size={32} className="spin" />
            <p>Cargando datos...</p>
          </div>
        ) : (
          <div className="superAdmin__content">
            {renderTabContent()}
          </div>
        )}
      </main>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="superAdmin__modal" onClick={() => setSelectedUser(null)}>
          <div className="superAdmin__modalContent" onClick={e => e.stopPropagation()}>
            <div className="superAdmin__modalHeader">
              <h3>Perfil de Usuario</h3>
              <button onClick={() => setSelectedUser(null)}>×</button>
            </div>
            <div className="superAdmin__modalBody">
              <div className="superAdmin__userProfile">
                <div className="superAdmin__userProfileAvatar">
                  {selectedUser.full_name?.[0]?.toUpperCase() || selectedUser.email?.[0]?.toUpperCase() || '?'}
                </div>
                <h4>{selectedUser.full_name || 'Sin nombre'}</h4>
                <span>{selectedUser.email}</span>
              </div>
              <div className="superAdmin__userDetails">
                <div className="superAdmin__detailRow">
                  <span>ID:</span>
                  <code>{selectedUser.user_id}</code>
                </div>
                <div className="superAdmin__detailRow">
                  <span>Rol:</span>
                  <span className={`superAdmin__roleBadge superAdmin__roleBadge--${selectedUser.role}`}>
                    {selectedUser.role}
                  </span>
                </div>
                <div className="superAdmin__detailRow">
                  <span>Estado:</span>
                  <span className={`superAdmin__statusBadge superAdmin__statusBadge--${selectedUser.account_status}`}>
                    {selectedUser.account_status}
                  </span>
                </div>
                <div className="superAdmin__detailRow">
                  <span>Tenant ID:</span>
                  <code>{selectedUser.tenant_id || 'N/A'}</code>
                </div>
                <div className="superAdmin__detailRow">
                  <span>Registrado:</span>
                  <span>{formatDate(selectedUser.created_at)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModal && (
        <ConfirmModal
          open={true}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmVariant={confirmModal.variant}
          confirmLabel="Confirmar"
          cancelLabel="Cancelar"
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}

      {/* Delete User Modal (with tenant options) */}
      {deleteUserModal && (
        <div className="superAdmin__modal" onClick={() => setDeleteUserModal(null)}>
          <div className="superAdmin__modalContent superAdmin__modalContent--compact" onClick={e => e.stopPropagation()}>
            <div className="superAdmin__modalHeader superAdmin__modalHeader--danger">
              <h3><Trash2 size={20} /> Eliminar Usuario</h3>
              <button onClick={() => setDeleteUserModal(null)}>×</button>
            </div>
            <div className="superAdmin__modalBody">
              <p className="superAdmin__modalWarning">
                <AlertTriangle size={18} />
                ¿Eliminar permanentemente a <strong>{deleteUserModal.user.email}</strong>?
              </p>
              <p className="superAdmin__modalInfo">
                Este usuario es dueño de la tienda <strong>{deleteUserModal.tenant.name}</strong>. ¿Qué deseas hacer?
              </p>
              <div className="superAdmin__optionBtns">
                <button 
                  className="superAdmin__optionBtn superAdmin__optionBtn--danger"
                  onClick={() => handleDeleteUserConfirm(true)}
                  disabled={formLoading}
                >
                  <Trash2 size={16} />
                  Eliminar usuario y tienda
                </button>
                <button 
                  className="superAdmin__optionBtn superAdmin__optionBtn--warning"
                  onClick={() => handleDeleteUserConfirm(false)}
                  disabled={formLoading}
                >
                  <Store size={16} />
                  Solo eliminar usuario (conservar tienda)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Tenant Modal (with owner options) */}
      {deleteTenantModal && (
        <div className="superAdmin__modal" onClick={() => setDeleteTenantModal(null)}>
          <div className="superAdmin__modalContent superAdmin__modalContent--compact" onClick={e => e.stopPropagation()}>
            <div className="superAdmin__modalHeader superAdmin__modalHeader--danger">
              <h3><Trash2 size={20} /> Eliminar Tienda</h3>
              <button onClick={() => setDeleteTenantModal(null)}>×</button>
            </div>
            <div className="superAdmin__modalBody">
              <p className="superAdmin__modalWarning">
                <AlertTriangle size={18} />
                ¿Eliminar permanentemente la tienda <strong>{deleteTenantModal.tenant.name}</strong>?
              </p>
              {deleteTenantModal.owner ? (
                <>
                  <p className="superAdmin__modalInfo">
                    El dueño es <strong>{deleteTenantModal.owner.email}</strong>. ¿Qué deseas hacer con él?
                  </p>
                  <div className="superAdmin__optionBtns superAdmin__optionBtns--vertical">
                    <button 
                      className="superAdmin__optionBtn superAdmin__optionBtn--danger"
                      onClick={() => handleDeleteTenantConfirm('delete')}
                      disabled={formLoading}
                    >
                      <Trash2 size={16} />
                      Eliminar tienda y dueño
                    </button>
                    <button 
                      className="superAdmin__optionBtn superAdmin__optionBtn--warning"
                      onClick={() => handleDeleteTenantConfirm('block')}
                      disabled={formLoading}
                    >
                      <ShieldOff size={16} />
                      Eliminar tienda y bloquear dueño
                    </button>
                    <button 
                      className="superAdmin__optionBtn superAdmin__optionBtn--neutral"
                      onClick={() => handleDeleteTenantConfirm('keep')}
                      disabled={formLoading}
                    >
                      <Users size={16} />
                      Solo eliminar tienda (conservar dueño)
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="superAdmin__modalInfo">
                    Esta tienda no tiene dueño asignado. Se eliminarán todos los datos asociados.
                  </p>
                  <div className="superAdmin__optionBtns">
                    <button 
                      className="superAdmin__optionBtn superAdmin__optionBtn--neutral"
                      onClick={() => setDeleteTenantModal(null)}
                      disabled={formLoading}
                    >
                      Cancelar
                    </button>
                    <button 
                      className="superAdmin__optionBtn superAdmin__optionBtn--danger"
                      onClick={() => handleDeleteTenantConfirm('keep')}
                      disabled={formLoading}
                    >
                      <Trash2 size={16} />
                      Eliminar tienda
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Set Premium Modal (tier and days) - z-index alto para mostrarse sobre otros modales */}
      {setPremiumModal && (
        <div className="superAdmin__modal superAdmin__modal--top" onClick={() => setSetPremiumModal(null)}>
          <div className="superAdmin__modalContent superAdmin__modalContent--compact" onClick={e => e.stopPropagation()}>
            <div className="superAdmin__modalHeader superAdmin__modalHeader--premium">
              <h3><Crown size={20} /> Gestionar Plan</h3>
              <button onClick={() => setSetPremiumModal(null)}>×</button>
            </div>
            <div className="superAdmin__modalBody">
              <div className="superAdmin__formGroup">
                <label>Seleccionar plan</label>
                <div className="superAdmin__tierSelector">
                  <button 
                    type="button"
                    className={`superAdmin__tierOption ${setPremiumModal.tier === 'free' ? 'superAdmin__tierOption--active' : ''}`}
                    onClick={() => setSetPremiumModal(m => ({ ...m, tier: 'free' }))}
                  >
                    <Package size={20} />
                    <span>Free</span>
                  </button>
                  <button 
                    type="button"
                    className={`superAdmin__tierOption superAdmin__tierOption--premium ${setPremiumModal.tier === 'premium' ? 'superAdmin__tierOption--active' : ''}`}
                    onClick={() => setSetPremiumModal(m => ({ ...m, tier: 'premium' }))}
                  >
                    <Star size={20} />
                    <span>Premium</span>
                  </button>
                  <button 
                    type="button"
                    className={`superAdmin__tierOption superAdmin__tierOption--pro ${setPremiumModal.tier === 'premium_pro' ? 'superAdmin__tierOption--active' : ''}`}
                    onClick={() => setSetPremiumModal(m => ({ ...m, tier: 'premium_pro' }))}
                  >
                    <Crown size={20} />
                    <span>Pro</span>
                  </button>
                </div>
              </div>
              {setPremiumModal.tier !== 'free' && (
                <div className="superAdmin__formGroup">
                  <label>Días de suscripción</label>
                  <div className="superAdmin__daysInput">
                    <input 
                      type="number" 
                      min="1" 
                      max="365"
                      value={setPremiumModal.days}
                      onChange={e => setSetPremiumModal(m => ({ ...m, days: parseInt(e.target.value) || 1 }))}
                    />
                    <span>días</span>
                  </div>
                  <div className="superAdmin__quickDays">
                    {[7, 15, 30, 60, 90, 365].map(d => (
                      <button 
                        key={d}
                        type="button"
                        className={`superAdmin__quickDayBtn ${setPremiumModal.days === d ? 'superAdmin__quickDayBtn--active' : ''}`}
                        onClick={() => setSetPremiumModal(m => ({ ...m, days: d }))}
                      >
                        {d}d
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {setPremiumModal.tier !== 'free' && (
                <div className="superAdmin__giftNote">
                  <span>🎁</span>
                  <p>Este plan será marcado como <strong>regalo</strong>. El usuario podrá comprar su propia suscripción y se activará al terminar este regalo.</p>
                </div>
              )}
              {setPremiumModal.tier === 'free' && (
                <div className="superAdmin__giftNote superAdmin__giftNote--info">
                  <span>ℹ️</span>
                  <p>El usuario será cambiado a Free y podrá <strong>comprar su propia suscripción</strong> cuando quiera.</p>
                </div>
              )}
              <div className="superAdmin__formActions">
                <button 
                  type="button" 
                  className="superAdmin__formBtn superAdmin__formBtn--secondary" 
                  onClick={() => setSetPremiumModal(null)}
                >
                  Cancelar
                </button>
                <button 
                  type="button" 
                  className={`superAdmin__formBtn ${setPremiumModal.tier === 'free' ? 'superAdmin__formBtn--danger' : 'superAdmin__formBtn--premium'}`}
                  onClick={handleSetPremium}
                  disabled={formLoading}
                >
                  {formLoading 
                    ? (setPremiumModal.tier === 'free' ? 'Cambiando...' : 'Regalando...') 
                    : (setPremiumModal.tier === 'free' ? 'Cambiar a Free' : `🎁 Regalar ${TIER_LABELS[setPremiumModal.tier]}`)
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUserModal && (
        <div className="superAdmin__modal" onClick={() => setEditUserModal(null)}>
          <div className="superAdmin__modalContent superAdmin__modalContent--form" onClick={e => e.stopPropagation()}>
            <div className="superAdmin__modalHeader">
              <h3>Editar Usuario</h3>
              <button onClick={() => setEditUserModal(null)}>×</button>
            </div>
            <form onSubmit={handleSaveUser} className="superAdmin__form">
              <div className="superAdmin__formGroup">
                <label>Email</label>
                <input type="text" value={editUserModal.email} disabled />
              </div>
              <div className="superAdmin__formGroup">
                <label>Nombre completo</label>
                <input 
                  type="text" 
                  value={editUserModal.full_name || ''} 
                  onChange={e => setEditUserModal(u => ({ ...u, full_name: e.target.value }))}
                  placeholder="Nombre del usuario"
                />
              </div>
              <div className="superAdmin__formGroup">
                <label>Rol</label>
                <select 
                  value={editUserModal.role} 
                  onChange={e => setEditUserModal(u => ({ ...u, role: e.target.value }))}
                >
                  <option value="tenant_admin">Tenant Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <div className="superAdmin__formGroup">
                <label>Estado</label>
                <select 
                  value={editUserModal.account_status} 
                  onChange={e => setEditUserModal(u => ({ ...u, account_status: e.target.value }))}
                >
                  <option value="active">Activo</option>
                  <option value="cancelled">Suspendido</option>
                </select>
              </div>
              <div className="superAdmin__formGroup">
                <label>Tienda vinculada</label>
                <input 
                  type="text" 
                  value={tenants.find(t => t.id === editUserModal.tenant_id)?.name || 'Sin tienda'} 
                  disabled 
                />
              </div>
              {/* Upgrade de suscripción si tiene tienda */}
              {editUserModal.tenant_id && (() => {
                const userTenant = tenants.find(t => t.id === editUserModal.tenant_id)
                return userTenant ? (
                  <div className="superAdmin__formGroup">
                    <label>Plan de suscripción</label>
                    <div className="superAdmin__upgradeBtnGroup">
                      <span 
                        className="superAdmin__tierBadge"
                        style={{ '--tier-color': TIER_COLORS[userTenant.subscription_tier] || TIER_COLORS.free }}
                      >
                        {userTenant.subscription_tier === 'premium_pro' ? <Crown size={12} /> : 
                         userTenant.subscription_tier === 'premium' ? <Star size={12} /> : <Package size={12} />}
                        {TIER_LABELS[userTenant.subscription_tier] || 'Free'}
                      </span>
                      <button 
                        type="button"
                        className="superAdmin__upgradeBtn"
                        onClick={() => {
                          setEditUserModal(null)
                          setSetPremiumModal({ tenantId: userTenant.id, tier: userTenant.subscription_tier || 'premium', days: 30 })
                        }}
                      >
                        <Star size={14} />
                        Cambiar Plan
                      </button>
                    </div>
                  </div>
                ) : null
              })()}
              <div className="superAdmin__formActions">
                <button type="button" className="superAdmin__formBtn superAdmin__formBtn--secondary" onClick={() => setEditUserModal(null)}>
                  Cancelar
                </button>
                <button type="submit" className="superAdmin__formBtn" disabled={formLoading}>
                  {formLoading ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Tenant Modal */}
      {editTenantModal && (
        <div className="superAdmin__modal" onClick={() => setEditTenantModal(null)}>
          <div className="superAdmin__modalContent superAdmin__modalContent--form" onClick={e => e.stopPropagation()}>
            <div className="superAdmin__modalHeader">
              <h3>Editar Tienda</h3>
              <button onClick={() => setEditTenantModal(null)}>×</button>
            </div>
            <form onSubmit={handleSaveTenant} className="superAdmin__form">
              <div className="superAdmin__formGroup">
                <label>Nombre de la tienda</label>
                <input 
                  type="text" 
                  value={editTenantModal.name} 
                  onChange={e => setEditTenantModal(t => ({ ...t, name: e.target.value }))}
                  required
                />
              </div>
              <div className="superAdmin__formGroup">
                <label>Slug (URL)</label>
                <input 
                  type="text" 
                  value={editTenantModal.slug} 
                  onChange={e => setEditTenantModal(t => ({ ...t, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))}
                  required
                />
                <span className="superAdmin__formHint">/store/{editTenantModal.slug}</span>
              </div>
              <div className="superAdmin__formGroup">
                <label>Descripción</label>
                <textarea 
                  value={editTenantModal.description || ''} 
                  onChange={e => setEditTenantModal(t => ({ ...t, description: e.target.value }))}
                  rows={3}
                  placeholder="Descripción de la tienda"
                />
              </div>
              <div className="superAdmin__formGroup">
                <label>Visibilidad</label>
                <select 
                  value={editTenantModal.is_public ? 'true' : 'false'} 
                  onChange={e => setEditTenantModal(t => ({ ...t, is_public: e.target.value === 'true' }))}
                >
                  <option value="true">Pública</option>
                  <option value="false">Oculta</option>
                </select>
              </div>
              <div className="superAdmin__formGroup">
                <label>Plan actual</label>
                <div className="superAdmin__formTierSelect">
                  <span className={`superAdmin__tierBadge superAdmin__tierBadge--${editTenantModal.subscription_tier || 'free'}`}>
                    {TIER_LABELS[editTenantModal.subscription_tier || 'free']}
                  </span>
                  <button 
                    type="button"
                    className="superAdmin__formBtn superAdmin__formBtn--small"
                    onClick={() => {
                      setSetPremiumModal({ 
                        tenantId: editTenantModal.id, 
                        tier: editTenantModal.subscription_tier || 'premium', 
                        days: 30 
                      })
                    }}
                  >
                    <Crown size={14} /> Cambiar Plan
                  </button>
                </div>
              </div>
              <div className="superAdmin__formGroup">
                <label>Dueño</label>
                <input 
                  type="text" 
                  value={profiles.find(p => p.user_id === editTenantModal.owner_user_id)?.email || 'Sin dueño'} 
                  disabled 
                />
              </div>
              <div className="superAdmin__formActions">
                <button type="button" className="superAdmin__formBtn superAdmin__formBtn--secondary" onClick={() => setEditTenantModal(null)}>
                  Cancelar
                </button>
                <button type="submit" className="superAdmin__formBtn" disabled={formLoading}>
                  {formLoading ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Tenant Modal */}
      {createTenantModal && (
        <div className="superAdmin__modal" onClick={() => setCreateTenantModal(false)}>
          <div className="superAdmin__modalContent superAdmin__modalContent--form" onClick={e => e.stopPropagation()}>
            <div className="superAdmin__modalHeader">
              <h3>Crear Nueva Tienda</h3>
              <button onClick={() => setCreateTenantModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateTenant} className="superAdmin__form">
              <div className="superAdmin__formGroup">
                <label>Nombre de la tienda *</label>
                <input 
                  type="text" 
                  name="name"
                  required
                  placeholder="Mi Restaurante"
                />
              </div>
              <div className="superAdmin__formGroup">
                <label>Slug (URL) *</label>
                <input 
                  type="text" 
                  name="slug"
                  required
                  placeholder="mi-restaurante"
                  pattern="[a-z0-9-]+"
                />
                <span className="superAdmin__formHint">Solo letras minúsculas, números y guiones</span>
              </div>
              <div className="superAdmin__formGroup">
                <label>Vincular a usuario (opcional)</label>
                <select name="owner">
                  <option value="">Sin vincular</option>
                  {profiles.filter(p => !p.tenant_id && p.role !== 'super_admin' && p.account_status === 'active').map(p => (
                    <option key={p.user_id} value={p.user_id}>{p.email}</option>
                  ))}
                </select>
                <span className="superAdmin__formHint">Solo se muestran usuarios sin tienda asignada</span>
              </div>
              <div className="superAdmin__formActions">
                <button type="button" className="superAdmin__formBtn superAdmin__formBtn--secondary" onClick={() => setCreateTenantModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="superAdmin__formBtn" disabled={formLoading}>
                  {formLoading ? 'Creando...' : 'Crear tienda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Link Modal */}
      {linkModal && (
        <div className="superAdmin__modal" onClick={() => setLinkModal(null)}>
          <div className="superAdmin__modalContent superAdmin__modalContent--form" onClick={e => e.stopPropagation()}>
            <div className="superAdmin__modalHeader">
              <h3>{linkModal.type === 'user-to-tenant' ? 'Vincular Tienda a Usuario' : 'Vincular Usuario a Tienda'}</h3>
              <button onClick={() => setLinkModal(null)}>×</button>
            </div>
            <div className="superAdmin__modalBody">
              <p className="superAdmin__linkInfo">
                {linkModal.type === 'user-to-tenant' 
                  ? `Selecciona una tienda para vincular a "${linkModal.userName}":`
                  : `Selecciona un usuario para vincular a "${linkModal.tenantName}":`
                }
              </p>
              <div className="superAdmin__linkList">
                {linkModal.type === 'user-to-tenant' ? (
                  tenants.filter(t => !t.owner_user_id).length > 0 ? (
                    tenants.filter(t => !t.owner_user_id).map(t => (
                      <button 
                        key={t.id} 
                        className="superAdmin__linkItem"
                        onClick={() => handleLinkConfirm(t.id)}
                        disabled={formLoading}
                      >
                        <Store size={16} />
                        <span>{t.name}</span>
                        <span className="superAdmin__linkItemSlug">/{t.slug}</span>
                      </button>
                    ))
                  ) : (
                    <p className="superAdmin__noItems">No hay tiendas disponibles sin dueño</p>
                  )
                ) : (
                  // Mostrar TODOS los usuarios que no son super_admin (excepto los bloqueados)
                  // Si la tienda ya tiene un owner, ese usuario se manejará en backend (se desvincula primero)
                  profiles.filter(p => p.role !== 'super_admin' && p.account_status !== 'blocked').length > 0 ? (
                    profiles.filter(p => p.role !== 'super_admin' && p.account_status !== 'blocked').map(p => {
                      const userTenant = tenants.find(t => t.id === p.tenant_id)
                      return (
                        <button 
                          key={p.user_id} 
                          className="superAdmin__linkItem"
                          onClick={() => handleLinkConfirm(p.user_id)}
                          disabled={formLoading}
                        >
                          <Users size={16} />
                          <div className="superAdmin__linkItemInfo">
                            <span>{p.full_name || 'Sin nombre'}</span>
                            <span className="superAdmin__linkItemEmail">{p.email}</span>
                            {userTenant && <span className="superAdmin__linkItemTenant"><Package size={14} /> {userTenant.name}</span>}
                          </div>
                        </button>
                      )
                    })
                  ) : (
                    <p className="superAdmin__noItems">No hay usuarios disponibles</p>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
