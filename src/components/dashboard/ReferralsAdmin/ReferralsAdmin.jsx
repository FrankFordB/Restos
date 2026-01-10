/**
 * ReferralsAdmin - Panel de Administración de Referidos (Super Admin)
 * 
 * Permite a los super_admin:
 * - Ver todos los referidos de la plataforma
 * - Ver y gestionar recompensas
 * - Ver y resolver flags de fraude
 * - Configurar el sistema de referidos
 * - Crear recompensas manuales
 * - Revocar recompensas
 */

import { useEffect, useState, useCallback } from 'react'
import Card from '../../ui/Card/Card'
import Button from '../../ui/Button/Button'
import Input from '../../ui/Input/Input'
import './ReferralsAdmin.css'
import {
  getAllReferrals,
  getAllRewards,
  getFraudFlags,
  getReferralConfig,
  updateReferralConfig,
  rejectReferral,
  revokeReferralReward,
  resolveFraudFlag,
  createManualReward,
  REFERRAL_STATUS,
  REWARD_STATUS,
} from '../../../lib/supabaseReferralApi'
import {
  Users,
  Gift,
  AlertTriangle,
  Settings,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Shield,
  Award,
  Trash2,
  Eye,
  Plus,
  Save,
  X,
} from 'lucide-react'

export default function ReferralsAdmin({ currentUserId }) {
  // Estado principal
  const [activeTab, setActiveTab] = useState('referrals') // referrals, rewards, fraud, config
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  // Datos
  const [referrals, setReferrals] = useState([])
  const [rewards, setRewards] = useState([])
  const [fraudFlags, setFraudFlags] = useState([])
  const [config, setConfig] = useState(null)
  
  // Filtros
  const [referralFilter, setReferralFilter] = useState('all') // all, pending, converted, rejected
  const [rewardFilter, setRewardFilter] = useState('all') // all, pending, applied, revoked
  const [searchTerm, setSearchTerm] = useState('')
  
  // Modales
  const [showRejectModal, setShowRejectModal] = useState(null)
  const [showRevokeModal, setShowRevokeModal] = useState(null)
  const [showManualRewardModal, setShowManualRewardModal] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)
  
  // Form states
  const [rejectReason, setRejectReason] = useState('')
  const [revokeReason, setRevokeReason] = useState('')
  const [manualReward, setManualReward] = useState({
    tenantId: '',
    userId: '',
    rewardPlan: 'premium',
    rewardMonths: 1,
    rewardDays: 0,
    description: '',
  })
  const [configForm, setConfigForm] = useState(null)
  
  // Actions loading
  const [actionLoading, setActionLoading] = useState(null)
  
  // Cargar datos
  const loadData = useCallback(async () => {
    try {
      const [referralsData, rewardsData, flagsData, configData] = await Promise.all([
        getAllReferrals({ status: referralFilter !== 'all' ? referralFilter : null }),
        getAllRewards({ status: rewardFilter !== 'all' ? rewardFilter : null }),
        getFraudFlags({ resolved: false }),
        getReferralConfig(),
      ])
      
      setReferrals(referralsData)
      setRewards(rewardsData)
      setFraudFlags(flagsData)
      setConfig(configData)
      setConfigForm(configData)
    } catch (error) {
      console.error('Error cargando datos de referidos:', error)
    } finally {
      setLoading(false)
    }
  }, [referralFilter, rewardFilter])
  
  useEffect(() => {
    loadData()
  }, [loadData])
  
  // Refrescar
  const handleRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }
  
  // Rechazar referido
  const handleRejectReferral = async () => {
    if (!showRejectModal || !rejectReason.trim()) return
    
    setActionLoading('reject')
    try {
      await rejectReferral(showRejectModal.id, currentUserId, rejectReason)
      setShowRejectModal(null)
      setRejectReason('')
      await loadData()
    } catch (error) {
      console.error('Error rechazando referido:', error)
    } finally {
      setActionLoading(null)
    }
  }
  
  // Revocar recompensa
  const handleRevokeReward = async () => {
    if (!showRevokeModal || !revokeReason.trim()) return
    
    setActionLoading('revoke')
    try {
      await revokeReferralReward(showRevokeModal.id, currentUserId, revokeReason)
      setShowRevokeModal(null)
      setRevokeReason('')
      await loadData()
    } catch (error) {
      console.error('Error revocando recompensa:', error)
    } finally {
      setActionLoading(null)
    }
  }
  
  // Crear recompensa manual
  const handleCreateManualReward = async () => {
    if (!manualReward.tenantId || !manualReward.userId) return
    
    setActionLoading('create-reward')
    try {
      await createManualReward({
        ...manualReward,
        createdBy: currentUserId,
      })
      setShowManualRewardModal(false)
      setManualReward({
        tenantId: '',
        userId: '',
        rewardPlan: 'premium',
        rewardMonths: 1,
        rewardDays: 0,
        description: '',
      })
      await loadData()
    } catch (error) {
      console.error('Error creando recompensa:', error)
    } finally {
      setActionLoading(null)
    }
  }
  
  // Guardar configuración
  const handleSaveConfig = async () => {
    if (!configForm) return
    
    setActionLoading('save-config')
    try {
      await updateReferralConfig(configForm)
      setConfig(configForm)
      setShowConfigModal(false)
    } catch (error) {
      console.error('Error guardando configuración:', error)
    } finally {
      setActionLoading(null)
    }
  }
  
  // Formatear fecha
  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  
  // Formatear monto
  const formatAmount = (amount, currency = 'ARS') => {
    if (!amount) return '-'
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency,
    }).format(amount)
  }
  
  // Obtener etiqueta de estado
  const getStatusLabel = (status) => {
    switch (status) {
      case REFERRAL_STATUS.PENDING: return 'Pendiente'
      case REFERRAL_STATUS.CONVERTED: return 'Convertido'
      case REFERRAL_STATUS.REJECTED: return 'Rechazado'
      case REFERRAL_STATUS.MANUAL_REVIEW: return 'En revisión'
      default: return status
    }
  }
  
  // Filtrar referidos por búsqueda
  const filteredReferrals = referrals.filter(r => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      r.referred_email?.toLowerCase().includes(term) ||
      r.referral_codes?.code?.toLowerCase().includes(term) ||
      r.referral_codes?.tenants?.name?.toLowerCase().includes(term)
    )
  })
  
  // Estadísticas rápidas
  const stats = {
    totalReferrals: referrals.length,
    pending: referrals.filter(r => r.status === REFERRAL_STATUS.PENDING).length,
    converted: referrals.filter(r => r.status === REFERRAL_STATUS.CONVERTED).length,
    rejected: referrals.filter(r => r.status === REFERRAL_STATUS.REJECTED).length,
    pendingRewards: rewards.filter(r => r.status === REWARD_STATUS.PENDING).length,
    appliedRewards: rewards.filter(r => r.status === REWARD_STATUS.APPLIED).length,
    unresolvedFlags: fraudFlags.length,
  }
  
  if (loading) {
    return (
      <div className="referrals-admin__loading">
        <RefreshCw size={32} className="spinning" />
        <p>Cargando panel de referidos...</p>
      </div>
    )
  }

  return (
    <div className="referrals-admin">
      {/* Header */}
      <div className="referrals-admin__header">
        <div className="referrals-admin__title">
          <Users size={24} />
          <h2>Administración de Referidos</h2>
        </div>
        <div className="referrals-admin__actions">
          <Button
            variant="outline"
            size="small"
            onClick={() => setShowConfigModal(true)}
            icon={<Settings size={16} />}
          >
            Configuración
          </Button>
          <Button
            variant="outline"
            size="small"
            onClick={handleRefresh}
            disabled={refreshing}
            icon={<RefreshCw size={16} className={refreshing ? 'spinning' : ''} />}
          >
            Refrescar
          </Button>
        </div>
      </div>
      
      {/* Stats rápidas */}
      <div className="referrals-admin__stats">
        <div className="admin-stat">
          <span className="admin-stat__value">{stats.totalReferrals}</span>
          <span className="admin-stat__label">Total referidos</span>
        </div>
        <div className="admin-stat admin-stat--pending">
          <span className="admin-stat__value">{stats.pending}</span>
          <span className="admin-stat__label">Pendientes</span>
        </div>
        <div className="admin-stat admin-stat--converted">
          <span className="admin-stat__value">{stats.converted}</span>
          <span className="admin-stat__label">Convertidos</span>
        </div>
        <div className="admin-stat admin-stat--rewards">
          <span className="admin-stat__value">{stats.pendingRewards}</span>
          <span className="admin-stat__label">Recompensas pendientes</span>
        </div>
        {stats.unresolvedFlags > 0 && (
          <div className="admin-stat admin-stat--fraud">
            <span className="admin-stat__value">{stats.unresolvedFlags}</span>
            <span className="admin-stat__label">Alertas de fraude</span>
          </div>
        )}
      </div>
      
      {/* Tabs */}
      <div className="referrals-admin__tabs">
        <button
          className={`admin-tab ${activeTab === 'referrals' ? 'active' : ''}`}
          onClick={() => setActiveTab('referrals')}
        >
          <Users size={16} />
          Referidos
        </button>
        <button
          className={`admin-tab ${activeTab === 'rewards' ? 'active' : ''}`}
          onClick={() => setActiveTab('rewards')}
        >
          <Gift size={16} />
          Recompensas
          {stats.pendingRewards > 0 && (
            <span className="tab-count">{stats.pendingRewards}</span>
          )}
        </button>
        <button
          className={`admin-tab ${activeTab === 'fraud' ? 'active' : ''}`}
          onClick={() => setActiveTab('fraud')}
        >
          <Shield size={16} />
          Fraude
          {stats.unresolvedFlags > 0 && (
            <span className="tab-count tab-count--danger">{stats.unresolvedFlags}</span>
          )}
        </button>
      </div>
      
      {/* Content */}
      <div className="referrals-admin__content">
        {/* Tab: Referrals */}
        {activeTab === 'referrals' && (
          <Card className="admin-card">
            <div className="admin-card__header">
              <h3>Todos los Referidos</h3>
              <div className="admin-card__filters">
                <div className="search-input">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Buscar por email, código o tenant..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <select
                  value={referralFilter}
                  onChange={(e) => setReferralFilter(e.target.value)}
                >
                  <option value="all">Todos los estados</option>
                  <option value="pending">Pendientes</option>
                  <option value="converted">Convertidos</option>
                  <option value="rejected">Rechazados</option>
                  <option value="manual_review">En revisión</option>
                </select>
              </div>
            </div>
            
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Email Referido</th>
                    <th>Código</th>
                    <th>Tenant Referidor</th>
                    <th>Estado</th>
                    <th>Fecha Registro</th>
                    <th>Fecha Conversión</th>
                    <th>Monto</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReferrals.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="empty-row">
                        No hay referidos que mostrar
                      </td>
                    </tr>
                  ) : (
                    filteredReferrals.map((referral) => (
                      <tr key={referral.id}>
                        <td className="cell-email">{referral.referred_email}</td>
                        <td>
                          <code className="code-badge">
                            {referral.referral_codes?.code || referral.referral_code_id?.substring(0, 8)}
                          </code>
                        </td>
                        <td>{referral.referral_codes?.tenants?.name || '-'}</td>
                        <td>
                          <span className={`status-badge status-badge--${referral.status}`}>
                            {getStatusLabel(referral.status)}
                          </span>
                        </td>
                        <td>{formatDate(referral.created_at)}</td>
                        <td>{formatDate(referral.converted_at)}</td>
                        <td>{formatAmount(referral.conversion_amount, referral.conversion_currency)}</td>
                        <td>
                          {referral.status === REFERRAL_STATUS.PENDING && (
                            <Button
                              variant="danger"
                              size="small"
                              onClick={() => setShowRejectModal(referral)}
                              icon={<XCircle size={14} />}
                            >
                              Rechazar
                            </Button>
                          )}
                          {referral.status === REFERRAL_STATUS.MANUAL_REVIEW && (
                            <Button
                              variant="outline"
                              size="small"
                              onClick={() => setShowRejectModal(referral)}
                              icon={<Eye size={14} />}
                            >
                              Revisar
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
        
        {/* Tab: Rewards */}
        {activeTab === 'rewards' && (
          <Card className="admin-card">
            <div className="admin-card__header">
              <h3>Todas las Recompensas</h3>
              <div className="admin-card__filters">
                <select
                  value={rewardFilter}
                  onChange={(e) => setRewardFilter(e.target.value)}
                >
                  <option value="all">Todos los estados</option>
                  <option value="pending">Pendientes</option>
                  <option value="applied">Aplicadas</option>
                  <option value="expired">Expiradas</option>
                  <option value="revoked">Revocadas</option>
                </select>
                <Button
                  variant="primary"
                  size="small"
                  onClick={() => setShowManualRewardModal(true)}
                  icon={<Plus size={16} />}
                >
                  Crear Recompensa
                </Button>
              </div>
            </div>
            
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Tenant</th>
                    <th>Tipo</th>
                    <th>Plan</th>
                    <th>Meses</th>
                    <th>Estado</th>
                    <th>Fecha Creación</th>
                    <th>Fecha Expiración</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {rewards.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="empty-row">
                        No hay recompensas que mostrar
                      </td>
                    </tr>
                  ) : (
                    rewards.map((reward) => (
                      <tr key={reward.id}>
                        <td>{reward.tenants?.name || reward.tenant_id?.substring(0, 8)}</td>
                        <td>
                          <span className={`type-badge type-badge--${reward.reward_type}`}>
                            {reward.reward_type}
                          </span>
                        </td>
                        <td>
                          <span className={`plan-badge plan-badge--${reward.reward_plan}`}>
                            {reward.reward_plan}
                          </span>
                        </td>
                        <td>{reward.reward_months}{reward.reward_days > 0 ? ` + ${reward.reward_days}d` : ''}</td>
                        <td>
                          <span className={`status-badge status-badge--${reward.status}`}>
                            {reward.status}
                          </span>
                        </td>
                        <td>{formatDate(reward.created_at)}</td>
                        <td>{formatDate(reward.expires_at)}</td>
                        <td>
                          {reward.status === REWARD_STATUS.PENDING && (
                            <Button
                              variant="danger"
                              size="small"
                              onClick={() => setShowRevokeModal(reward)}
                              icon={<Trash2 size={14} />}
                            >
                              Revocar
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
        
        {/* Tab: Fraud */}
        {activeTab === 'fraud' && (
          <Card className="admin-card">
            <div className="admin-card__header">
              <h3>Alertas de Fraude</h3>
            </div>
            
            {fraudFlags.length === 0 ? (
              <div className="fraud-empty">
                <Shield size={48} />
                <h4>Sin alertas pendientes</h4>
                <p>No hay flags de fraude sin resolver</p>
              </div>
            ) : (
              <div className="fraud-list">
                {fraudFlags.map((flag) => (
                  <div key={flag.id} className={`fraud-item fraud-item--${flag.severity}`}>
                    <div className="fraud-item__icon">
                      <AlertTriangle size={20} />
                    </div>
                    <div className="fraud-item__content">
                      <div className="fraud-item__header">
                        <span className={`severity-badge severity-badge--${flag.severity}`}>
                          {flag.severity}
                        </span>
                        <span className="fraud-item__type">{flag.flag_type}</span>
                        <span className="fraud-item__date">{formatDate(flag.created_at)}</span>
                      </div>
                      <p className="fraud-item__description">{flag.description}</p>
                      {flag.evidence && (
                        <pre className="fraud-item__evidence">
                          {JSON.stringify(flag.evidence, null, 2)}
                        </pre>
                      )}
                    </div>
                    <div className="fraud-item__actions">
                      <Button
                        variant="outline"
                        size="small"
                        onClick={() => resolveFraudFlag(flag.id, currentUserId, 'dismissed', 'Falso positivo')}
                      >
                        Descartar
                      </Button>
                      <Button
                        variant="danger"
                        size="small"
                        onClick={() => resolveFraudFlag(flag.id, currentUserId, 'confirmed', 'Fraude confirmado')}
                      >
                        Confirmar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
      
      {/* Modal: Rechazar Referido */}
      {showRejectModal && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Rechazar Referido</h3>
              <button className="modal-close" onClick={() => setShowRejectModal(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                ¿Estás seguro de rechazar el referido de <strong>{showRejectModal.referred_email}</strong>?
              </p>
              <div className="form-group">
                <label>Motivo del rechazo</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Ingresa el motivo del rechazo..."
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="outline" onClick={() => setShowRejectModal(null)}>
                Cancelar
              </Button>
              <Button 
                variant="danger" 
                onClick={handleRejectReferral}
                disabled={!rejectReason.trim() || actionLoading === 'reject'}
                loading={actionLoading === 'reject'}
              >
                Rechazar
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal: Revocar Recompensa */}
      {showRevokeModal && (
        <div className="modal-overlay" onClick={() => setShowRevokeModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Revocar Recompensa</h3>
              <button className="modal-close" onClick={() => setShowRevokeModal(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                ¿Estás seguro de revocar esta recompensa de <strong>{showRevokeModal.reward_months} meses</strong>?
              </p>
              <div className="form-group">
                <label>Motivo de la revocación</label>
                <textarea
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder="Ingresa el motivo de la revocación..."
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="outline" onClick={() => setShowRevokeModal(null)}>
                Cancelar
              </Button>
              <Button 
                variant="danger" 
                onClick={handleRevokeReward}
                disabled={!revokeReason.trim() || actionLoading === 'revoke'}
                loading={actionLoading === 'revoke'}
              >
                Revocar
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal: Crear Recompensa Manual */}
      {showManualRewardModal && (
        <div className="modal-overlay" onClick={() => setShowManualRewardModal(false)}>
          <div className="modal-content modal-content--wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Crear Recompensa Manual</h3>
              <button className="modal-close" onClick={() => setShowManualRewardModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Tenant ID *</label>
                  <input
                    type="text"
                    value={manualReward.tenantId}
                    onChange={(e) => setManualReward(prev => ({ ...prev, tenantId: e.target.value }))}
                    placeholder="UUID del tenant"
                  />
                </div>
                <div className="form-group">
                  <label>User ID *</label>
                  <input
                    type="text"
                    value={manualReward.userId}
                    onChange={(e) => setManualReward(prev => ({ ...prev, userId: e.target.value }))}
                    placeholder="UUID del usuario"
                  />
                </div>
                <div className="form-group">
                  <label>Plan</label>
                  <select
                    value={manualReward.rewardPlan}
                    onChange={(e) => setManualReward(prev => ({ ...prev, rewardPlan: e.target.value }))}
                  >
                    <option value="premium">Premium</option>
                    <option value="premium_pro">Premium Pro</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Meses</label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={manualReward.rewardMonths}
                    onChange={(e) => setManualReward(prev => ({ ...prev, rewardMonths: parseInt(e.target.value) || 1 }))}
                  />
                </div>
                <div className="form-group form-group--full">
                  <label>Descripción</label>
                  <textarea
                    value={manualReward.description}
                    onChange={(e) => setManualReward(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Motivo de la recompensa manual..."
                    rows={2}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="outline" onClick={() => setShowManualRewardModal(false)}>
                Cancelar
              </Button>
              <Button 
                variant="primary" 
                onClick={handleCreateManualReward}
                disabled={!manualReward.tenantId || !manualReward.userId || actionLoading === 'create-reward'}
                loading={actionLoading === 'create-reward'}
                icon={<Plus size={16} />}
              >
                Crear Recompensa
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal: Configuración */}
      {showConfigModal && configForm && (
        <div className="modal-overlay" onClick={() => setShowConfigModal(false)}>
          <div className="modal-content modal-content--wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Configuración del Sistema de Referidos</h3>
              <button className="modal-close" onClick={() => setShowConfigModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="config-section">
                <h4>Tier 1 (Básico)</h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Referidos necesarios</label>
                    <input
                      type="number"
                      value={configForm.tier_1_referrals}
                      onChange={(e) => setConfigForm(prev => ({ ...prev, tier_1_referrals: parseInt(e.target.value) }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Meses de recompensa</label>
                    <input
                      type="number"
                      value={configForm.tier_1_reward_months}
                      onChange={(e) => setConfigForm(prev => ({ ...prev, tier_1_reward_months: parseInt(e.target.value) }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Plan</label>
                    <select
                      value={configForm.tier_1_reward_plan}
                      onChange={(e) => setConfigForm(prev => ({ ...prev, tier_1_reward_plan: e.target.value }))}
                    >
                      <option value="premium">Premium</option>
                      <option value="premium_pro">Premium Pro</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="config-section">
                <h4>Tier 2</h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Referidos necesarios</label>
                    <input
                      type="number"
                      value={configForm.tier_2_referrals}
                      onChange={(e) => setConfigForm(prev => ({ ...prev, tier_2_referrals: parseInt(e.target.value) }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Meses de recompensa</label>
                    <input
                      type="number"
                      value={configForm.tier_2_reward_months}
                      onChange={(e) => setConfigForm(prev => ({ ...prev, tier_2_reward_months: parseInt(e.target.value) }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Plan</label>
                    <select
                      value={configForm.tier_2_reward_plan}
                      onChange={(e) => setConfigForm(prev => ({ ...prev, tier_2_reward_plan: e.target.value }))}
                    >
                      <option value="premium">Premium</option>
                      <option value="premium_pro">Premium Pro</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="config-section">
                <h4>Tier 3 (Especial)</h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Referidos necesarios</label>
                    <input
                      type="number"
                      value={configForm.tier_3_referrals}
                      onChange={(e) => setConfigForm(prev => ({ ...prev, tier_3_referrals: parseInt(e.target.value) }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Meses de recompensa</label>
                    <input
                      type="number"
                      value={configForm.tier_3_reward_months}
                      onChange={(e) => setConfigForm(prev => ({ ...prev, tier_3_reward_months: parseInt(e.target.value) }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Plan</label>
                    <select
                      value={configForm.tier_3_reward_plan}
                      onChange={(e) => setConfigForm(prev => ({ ...prev, tier_3_reward_plan: e.target.value }))}
                    >
                      <option value="premium">Premium</option>
                      <option value="premium_pro">Premium Pro</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="config-section">
                <h4>Antifraude</h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Máx. referidos/mes/usuario</label>
                    <input
                      type="number"
                      value={configForm.max_referrals_per_user_per_month}
                      onChange={(e) => setConfigForm(prev => ({ ...prev, max_referrals_per_user_per_month: parseInt(e.target.value) }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Máx. conversiones/IP/día</label>
                    <input
                      type="number"
                      value={configForm.max_conversions_per_ip_per_day}
                      onChange={(e) => setConfigForm(prev => ({ ...prev, max_conversions_per_ip_per_day: parseInt(e.target.value) }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Máx. cuentas/dispositivo</label>
                    <input
                      type="number"
                      value={configForm.max_accounts_per_device}
                      onChange={(e) => setConfigForm(prev => ({ ...prev, max_accounts_per_device: parseInt(e.target.value) }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Vencimiento créditos (días)</label>
                    <input
                      type="number"
                      value={configForm.credit_expiration_days}
                      onChange={(e) => setConfigForm(prev => ({ ...prev, credit_expiration_days: parseInt(e.target.value) }))}
                    />
                  </div>
                </div>
              </div>
              
              <div className="config-section">
                <div className="form-group form-group--checkbox">
                  <label>
                    <input
                      type="checkbox"
                      checked={configForm.is_active}
                      onChange={(e) => setConfigForm(prev => ({ ...prev, is_active: e.target.checked }))}
                    />
                    Sistema de referidos activo
                  </label>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="outline" onClick={() => setShowConfigModal(false)}>
                Cancelar
              </Button>
              <Button 
                variant="primary" 
                onClick={handleSaveConfig}
                disabled={actionLoading === 'save-config'}
                loading={actionLoading === 'save-config'}
                icon={<Save size={16} />}
              >
                Guardar Configuración
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
