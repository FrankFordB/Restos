import { useState, useEffect } from 'react'
import { 
  Crown, 
  Star, 
  Gift, 
  AlertTriangle, 
  Clock, 
  RefreshCw,
  Search,
  Filter,
  Download,
  Eye,
  History,
  Users,
  TrendingUp,
  Calendar,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react'
import Button from '../../components/ui/Button/Button'
import './AdminSubscriptionsPage.css'
import {
  getAllActiveSubscriptions,
  getSubscriptionsSummary,
  giftSubscription,
  getAdminGiftLog,
  getAuditLog,
  expireSubscriptions,
  formatSubscriptionDate,
  getSubscriptionStatusColor,
} from '../../lib/supabaseSubscriptionApi'
import { TIER_LABELS, TIER_COLORS } from '../../shared/subscriptions'
import { useSelector } from 'react-redux'

export default function AdminSubscriptionsPage() {
  const user = useSelector(state => state.auth.user)
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Filtros
  const [searchQuery, setSearchQuery] = useState('')
  const [tierFilter, setTierFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  
  // Modal de regalo
  const [showGiftModal, setShowGiftModal] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [giftForm, setGiftForm] = useState({ planTier: 'premium', days: 30, reason: '' })
  const [gifting, setGifting] = useState(false)
  const [giftError, setGiftError] = useState(null)
  
  // Tabs
  const [activeTab, setActiveTab] = useState('subscriptions')
  const [giftLog, setGiftLog] = useState([])
  const [auditLog, setAuditLog] = useState([])
  const [logsLoading, setLogsLoading] = useState(false)
  
  // Expandir detalles
  const [expandedTenant, setExpandedTenant] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (activeTab === 'gifts' && giftLog.length === 0) {
      loadGiftLog()
    } else if (activeTab === 'audit' && auditLog.length === 0) {
      loadAuditLog()
    }
  }, [activeTab])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getSubscriptionsSummary()
      setSummary(data)
    } catch (err) {
      console.error('Error cargando suscripciones:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadGiftLog = async () => {
    try {
      setLogsLoading(true)
      const data = await getAdminGiftLog({ limit: 100 })
      setGiftLog(data)
    } catch (err) {
      console.error('Error cargando log de regalos:', err)
    } finally {
      setLogsLoading(false)
    }
  }

  const loadAuditLog = async () => {
    try {
      setLogsLoading(true)
      const data = await getAuditLog({ limit: 100 })
      setAuditLog(data)
    } catch (err) {
      console.error('Error cargando log de auditoría:', err)
    } finally {
      setLogsLoading(false)
    }
  }

  const handleOpenGiftModal = (tenant) => {
    setSelectedTenant(tenant)
    setGiftForm({ planTier: tenant.subscription_tier || 'premium', days: 30, reason: '' })
    setGiftError(null)
    setShowGiftModal(true)
  }

  const handleGift = async () => {
    if (!selectedTenant) return
    
    try {
      setGifting(true)
      setGiftError(null)
      
      await giftSubscription({
        tenantId: selectedTenant.tenant_id,
        planTier: giftForm.planTier,
        days: parseInt(giftForm.days),
        reason: giftForm.reason,
        adminUserId: user?.id,
        adminEmail: user?.email,
      })
      
      setShowGiftModal(false)
      await loadData()
      if (activeTab === 'gifts') {
        await loadGiftLog()
      }
    } catch (err) {
      console.error('Error regalando suscripción:', err)
      setGiftError(err.message)
    } finally {
      setGifting(false)
    }
  }

  const handleExpireAll = async () => {
    if (!confirm('¿Expirar todas las suscripciones vencidas? Esta acción degradará a FREE a todos los tenants con premium_until pasado.')) {
      return
    }
    
    try {
      const expired = await expireSubscriptions()
      alert(`Se expiraron ${expired.length} suscripciones`)
      await loadData()
    } catch (err) {
      console.error('Error expirando suscripciones:', err)
      alert('Error: ' + err.message)
    }
  }

  // Filtrar suscripciones
  const filteredSubscriptions = summary?.subscriptions?.filter(sub => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (!sub.tenant_name?.toLowerCase().includes(query) && 
          !sub.tenant_slug?.toLowerCase().includes(query)) {
        return false
      }
    }
    if (tierFilter !== 'all' && sub.subscription_tier !== tierFilter) {
      return false
    }
    if (statusFilter === 'expiring' && (sub.days_remaining <= 0 || sub.days_remaining > 7)) {
      return false
    }
    if (statusFilter === 'expired' && sub.days_remaining > 0) {
      return false
    }
    if (statusFilter === 'active' && sub.days_remaining <= 0) {
      return false
    }
    return true
  }) || []

  if (loading) {
    return (
      <div className="adminSubscriptions adminSubscriptions--loading">
        <div className="adminSubscriptions__spinner" />
        <p>Cargando suscripciones...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="adminSubscriptions adminSubscriptions--error">
        <AlertTriangle size={32} />
        <p>{error}</p>
        <Button onClick={loadData}>Reintentar</Button>
      </div>
    )
  }

  return (
    <div className="adminSubscriptions">
      <header className="adminSubscriptions__header">
        <div>
          <h1><Crown size={28} /> Gestión de Suscripciones</h1>
          <p>Administra las suscripciones de todos los tenants</p>
        </div>
        <div className="adminSubscriptions__headerActions">
          <Button variant="secondary" onClick={handleExpireAll}>
            <Clock size={16} /> Expirar vencidas
          </Button>
          <Button variant="secondary" onClick={loadData}>
            <RefreshCw size={16} /> Actualizar
          </Button>
        </div>
      </header>

      {/* KPIs */}
      <div className="adminSubscriptions__kpis">
        <div className="adminSubscriptions__kpi">
          <div className="adminSubscriptions__kpiIcon" style={{ background: '#f59e0b20', color: '#f59e0b' }}>
            <Star size={24} />
          </div>
          <div className="adminSubscriptions__kpiInfo">
            <span className="value">{summary?.premium || 0}</span>
            <span className="label">Premium</span>
          </div>
        </div>
        
        <div className="adminSubscriptions__kpi">
          <div className="adminSubscriptions__kpiIcon" style={{ background: '#8b5cf620', color: '#8b5cf6' }}>
            <Crown size={24} />
          </div>
          <div className="adminSubscriptions__kpiInfo">
            <span className="value">{summary?.premiumPro || 0}</span>
            <span className="label">Premium Pro</span>
          </div>
        </div>
        
        <div className="adminSubscriptions__kpi warning">
          <div className="adminSubscriptions__kpiIcon" style={{ background: '#f9731620', color: '#f97316' }}>
            <AlertTriangle size={24} />
          </div>
          <div className="adminSubscriptions__kpiInfo">
            <span className="value">{summary?.expiringSoon || 0}</span>
            <span className="label">Por expirar (7 días)</span>
          </div>
        </div>
        
        <div className="adminSubscriptions__kpi danger">
          <div className="adminSubscriptions__kpiIcon" style={{ background: '#ef444420', color: '#ef4444' }}>
            <Clock size={24} />
          </div>
          <div className="adminSubscriptions__kpiInfo">
            <span className="value">{summary?.expired || 0}</span>
            <span className="label">Expirados</span>
          </div>
        </div>
        
        <div className="adminSubscriptions__kpi">
          <div className="adminSubscriptions__kpiIcon" style={{ background: '#22c55e20', color: '#22c55e' }}>
            <RefreshCw size={24} />
          </div>
          <div className="adminSubscriptions__kpiInfo">
            <span className="value">{summary?.autoRenewEnabled || 0}</span>
            <span className="label">Auto-renovación</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="adminSubscriptions__tabs">
        <button 
          className={`adminSubscriptions__tab ${activeTab === 'subscriptions' ? 'active' : ''}`}
          onClick={() => setActiveTab('subscriptions')}
        >
          <Users size={16} /> Suscripciones ({summary?.total || 0})
        </button>
        <button 
          className={`adminSubscriptions__tab ${activeTab === 'gifts' ? 'active' : ''}`}
          onClick={() => setActiveTab('gifts')}
        >
          <Gift size={16} /> Regalos
        </button>
        <button 
          className={`adminSubscriptions__tab ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          <History size={16} /> Auditoría
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'subscriptions' && (
        <div className="adminSubscriptions__content">
          {/* Filtros */}
          <div className="adminSubscriptions__filters">
            <div className="adminSubscriptions__searchBox">
              <Search size={18} />
              <input
                type="text"
                placeholder="Buscar por nombre o slug..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <select 
              value={tierFilter} 
              onChange={(e) => setTierFilter(e.target.value)}
              className="adminSubscriptions__select"
            >
              <option value="all">Todos los planes</option>
              <option value="premium">Premium</option>
              <option value="premium_pro">Premium Pro</option>
            </select>
            
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              className="adminSubscriptions__select"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="expiring">Por expirar</option>
              <option value="expired">Expirados</option>
            </select>
          </div>

          {/* Tabla */}
          <div className="adminSubscriptions__tableWrapper">
            <table className="adminSubscriptions__table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Plan</th>
                  <th>Expira</th>
                  <th>Días</th>
                  <th>Auto-renew</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubscriptions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="adminSubscriptions__empty">
                      No hay suscripciones que mostrar
                    </td>
                  </tr>
                ) : (
                  filteredSubscriptions.map(sub => (
                    <tr 
                      key={sub.tenant_id}
                      className={`${sub.days_remaining <= 0 ? 'expired' : ''} ${sub.days_remaining > 0 && sub.days_remaining <= 7 ? 'expiring' : ''}`}
                    >
                      <td>
                        <div className="adminSubscriptions__tenantCell">
                          <strong>{sub.tenant_name}</strong>
                          <span className="slug">/{sub.tenant_slug}</span>
                        </div>
                      </td>
                      <td>
                        <span 
                          className="adminSubscriptions__tierBadge"
                          style={{ 
                            background: `${TIER_COLORS[sub.subscription_tier]}20`,
                            color: TIER_COLORS[sub.subscription_tier] 
                          }}
                        >
                          {sub.subscription_tier === 'premium_pro' ? <Crown size={14} /> : <Star size={14} />}
                          {TIER_LABELS[sub.subscription_tier]}
                        </span>
                      </td>
                      <td>
                        <span className="adminSubscriptions__date">
                          {formatSubscriptionDate(sub.premium_until)}
                        </span>
                      </td>
                      <td>
                        <span 
                          className="adminSubscriptions__days"
                          style={{ color: getSubscriptionStatusColor(sub.days_remaining) }}
                        >
                          {sub.days_remaining <= 0 ? (
                            <span className="expired">Expirado</span>
                          ) : (
                            <>{sub.days_remaining} días</>
                          )}
                        </span>
                      </td>
                      <td>
                        {sub.auto_renew ? (
                          <span className="adminSubscriptions__autoRenew active">
                            <RefreshCw size={14} /> Sí
                          </span>
                        ) : (
                          <span className="adminSubscriptions__autoRenew">No</span>
                        )}
                      </td>
                      <td>
                        <Button 
                          size="sm" 
                          variant="secondary"
                          onClick={() => handleOpenGiftModal(sub)}
                        >
                          <Gift size={14} /> Regalar días
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'gifts' && (
        <div className="adminSubscriptions__content">
          {logsLoading ? (
            <div className="adminSubscriptions__loading">
              <div className="adminSubscriptions__spinner" />
              <p>Cargando log de regalos...</p>
            </div>
          ) : (
            <div className="adminSubscriptions__logList">
              {giftLog.length === 0 ? (
                <div className="adminSubscriptions__empty">
                  <Gift size={32} />
                  <p>No hay regalos registrados</p>
                </div>
              ) : (
                giftLog.map(gift => (
                  <div key={gift.id} className="adminSubscriptions__logItem">
                    <div className="adminSubscriptions__logIcon">
                      <Gift size={20} />
                    </div>
                    <div className="adminSubscriptions__logInfo">
                      <div className="adminSubscriptions__logTitle">
                        <strong>{gift.admin_email}</strong> regaló{' '}
                        <span className="highlight">{gift.days_granted} días</span> de{' '}
                        <span className="tier">{TIER_LABELS[gift.plan_tier]}</span> a{' '}
                        <strong>{gift.tenant_name}</strong>
                      </div>
                      <div className="adminSubscriptions__logMeta">
                        <span><Calendar size={12} /> {formatSubscriptionDate(gift.created_at)}</span>
                        <span className="reason">"{gift.reason}"</span>
                      </div>
                    </div>
                    <div className="adminSubscriptions__logResult">
                      Válido hasta: {formatSubscriptionDate(gift.new_expires_at)}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="adminSubscriptions__content">
          {logsLoading ? (
            <div className="adminSubscriptions__loading">
              <div className="adminSubscriptions__spinner" />
              <p>Cargando log de auditoría...</p>
            </div>
          ) : (
            <div className="adminSubscriptions__logList">
              {auditLog.length === 0 ? (
                <div className="adminSubscriptions__empty">
                  <History size={32} />
                  <p>No hay eventos de auditoría</p>
                </div>
              ) : (
                auditLog.map(log => (
                  <div key={log.id} className="adminSubscriptions__logItem">
                    <div className={`adminSubscriptions__logIcon type--${log.action_type}`}>
                      {getAuditIcon(log.action_type)}
                    </div>
                    <div className="adminSubscriptions__logInfo">
                      <div className="adminSubscriptions__logTitle">
                        <span className={`action action--${log.action}`}>{formatAction(log.action)}</span>
                        {log.tenants?.name && (
                          <span className="tenant">• {log.tenants.name}</span>
                        )}
                      </div>
                      <div className="adminSubscriptions__logMeta">
                        <span><Calendar size={12} /> {formatSubscriptionDate(log.created_at)}</span>
                        <span className="type">{log.action_type}</span>
                        {log.description && <span className="desc">{log.description}</span>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal de regalo */}
      {showGiftModal && selectedTenant && (
        <div className="adminSubscriptions__modal" onClick={() => setShowGiftModal(false)}>
          <div className="adminSubscriptions__modalContent" onClick={e => e.stopPropagation()}>
            <button className="adminSubscriptions__modalClose" onClick={() => setShowGiftModal(false)}>
              <X size={20} />
            </button>
            
            <div className="adminSubscriptions__modalHeader">
              <Gift size={28} />
              <h2>Regalar Suscripción</h2>
            </div>
            
            <p className="adminSubscriptions__modalSubtitle">
              Otorgar días de suscripción gratuita a <strong>{selectedTenant.tenant_name}</strong>
            </p>

            {giftError && (
              <div className="adminSubscriptions__modalError">
                <AlertTriangle size={16} /> {giftError}
              </div>
            )}

            <div className="adminSubscriptions__formGroup">
              <label>Plan a otorgar</label>
              <select 
                value={giftForm.planTier}
                onChange={(e) => setGiftForm(prev => ({ ...prev, planTier: e.target.value }))}
              >
                <option value="premium">Premium</option>
                <option value="premium_pro">Premium Pro</option>
              </select>
            </div>

            <div className="adminSubscriptions__formGroup">
              <label>Días a regalar</label>
              <div className="adminSubscriptions__daysInput">
                {[7, 15, 30, 60, 90].map(d => (
                  <button
                    key={d}
                    type="button"
                    className={giftForm.days === d ? 'active' : ''}
                    onClick={() => setGiftForm(prev => ({ ...prev, days: d }))}
                  >
                    {d}
                  </button>
                ))}
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={giftForm.days}
                  onChange={(e) => setGiftForm(prev => ({ ...prev, days: parseInt(e.target.value) || 0 }))}
                  placeholder="Otro"
                />
              </div>
            </div>

            <div className="adminSubscriptions__formGroup">
              <label>Razón del regalo *</label>
              <textarea
                value={giftForm.reason}
                onChange={(e) => setGiftForm(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Ej: Compensación por falla del servicio, promoción especial, etc."
                rows={3}
              />
              <span className="hint">Esta información queda registrada en el log de auditoría</span>
            </div>

            <div className="adminSubscriptions__modalPreview">
              <h4>Resultado:</h4>
              <p>
                <strong>{selectedTenant.tenant_name}</strong> tendrá{' '}
                <span className="highlight">{TIER_LABELS[giftForm.planTier]}</span> por{' '}
                <span className="days">{giftForm.days} días</span> adicionales.
              </p>
            </div>

            <div className="adminSubscriptions__modalActions">
              <Button 
                variant="secondary" 
                onClick={() => setShowGiftModal(false)}
                disabled={gifting}
              >
                Cancelar
              </Button>
              <Button 
                variant="primary"
                onClick={handleGift}
                disabled={gifting || !giftForm.reason.trim() || giftForm.days <= 0}
              >
                {gifting ? 'Procesando...' : `Regalar ${giftForm.days} días`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Helpers
function getAuditIcon(actionType) {
  switch (actionType) {
    case 'admin': return <Crown size={16} />
    case 'webhook': return <RefreshCw size={16} />
    case 'cron': return <Clock size={16} />
    case 'user': return <Users size={16} />
    default: return <History size={16} />
  }
}

function formatAction(action) {
  const translations = {
    subscription_created: 'Suscripción creada',
    subscription_activated: 'Suscripción activada',
    subscription_expired: 'Suscripción expirada',
    subscription_cancelled: 'Suscripción cancelada',
    subscription_renewed: 'Suscripción renovada',
    admin_gift: 'Regalo de admin',
    admin_extend: 'Extensión de admin',
    auto_renew_enabled: 'Auto-renovación activada',
    auto_renew_disabled: 'Auto-renovación desactivada',
    payment_received: 'Pago recibido',
    payment_failed: 'Pago fallido',
    cron_expiration_check: 'Verificación de expiración',
  }
  return translations[action] || action
}
