/**
 * ReferralsManager - Panel de Referidos del Dashboard
 * 
 * Permite a los usuarios:
 * - Ver su código de referido
 * - Compartir el enlace de invitación
 * - Ver estadísticas de referidos
 * - Ver progreso hacia recompensas
 * - Ver y aplicar recompensas pendientes
 * - Ver historial de referidos
 */

import { useEffect, useState, useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '../../../app/hooks'
import {
  loadReferralData,
  fetchReferralStats,
  applyReward,
  selectReferralCode,
  selectReferralStats,
  selectReferrals,
  selectRewards,
  selectReferralUrl,
  selectReferralProgress,
  selectReferralConfig,
  selectPendingRewards,
  selectIsApplyingReward,
  selectApplyingRewardId,
  selectReferralLoadingStates,
} from '../../../features/referrals/referralsSlice'
import { REFERRAL_STATUS, REWARD_STATUS } from '../../../lib/supabaseReferralApi'
import Card from '../../ui/Card/Card'
import Button from '../../ui/Button/Button'
import './ReferralsManager.css'
import {
  Users,
  Gift,
  Copy,
  Check,
  Share2,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronRight,
  Crown,
  Sparkles,
  Link2,
  QrCode,
  RefreshCw,
  Award,
  Target,
  Zap,
  X,
} from 'lucide-react'

export default function ReferralsManager({ tenantId, userId }) {
  const dispatch = useAppDispatch()
  
  // Selectores
  const code = useAppSelector(selectReferralCode)
  const stats = useAppSelector(selectReferralStats)
  const referrals = useAppSelector(selectReferrals)
  const rewards = useAppSelector(selectRewards)
  const referralUrl = useAppSelector(selectReferralUrl)
  const progress = useAppSelector(selectReferralProgress)
  const config = useAppSelector(selectReferralConfig)
  const pendingRewards = useAppSelector(selectPendingRewards)
  const isApplyingReward = useAppSelector(selectIsApplyingReward)
  const applyingRewardId = useAppSelector(selectApplyingRewardId)
  const loadingStates = useAppSelector(selectReferralLoadingStates)
  
  // Estados locales
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState('overview') // overview, referrals, rewards
  const [refreshing, setRefreshing] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  
  // Cargar datos al montar
  useEffect(() => {
    if (tenantId && userId) {
      dispatch(loadReferralData({ tenantId, userId }))
    }
  }, [dispatch, tenantId, userId])
  
  // Copiar enlace
  const handleCopyLink = useCallback(async () => {
    if (!referralUrl) return
    
    try {
      await navigator.clipboard.writeText(referralUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Error al copiar:', err)
    }
  }, [referralUrl])
  
  // Compartir
  const handleShare = useCallback(async () => {
    if (!referralUrl || !code?.code) return
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: '¡Únete a nuestra plataforma!',
          text: `Usa mi código de referido ${code.code} y obtén beneficios exclusivos.`,
          url: referralUrl,
        })
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Error al compartir:', err)
        }
      }
    } else {
      handleCopyLink()
    }
  }, [referralUrl, code, handleCopyLink])
  
  // Compartir en red social específica
  const shareToSocial = useCallback((platform) => {
    if (!referralUrl || !code?.code) return
    
    const message = encodeURIComponent(`¡Únete usando mi código ${code.code} y obtén beneficios exclusivos!`)
    const url = encodeURIComponent(referralUrl)
    const title = encodeURIComponent('¡Únete a nuestra plataforma!')
    
    const shareUrls = {
      whatsapp: `https://wa.me/?text=${message}%20${url}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${message}`,
      twitter: `https://twitter.com/intent/tweet?text=${message}&url=${url}`,
      telegram: `https://t.me/share/url?url=${url}&text=${message}`,
      email: `mailto:?subject=${title}&body=${message}%20${url}`,
    }
    
    if (shareUrls[platform]) {
      window.open(shareUrls[platform], '_blank', 'width=600,height=400')
    }
  }, [referralUrl, code])
  
  // Aplicar recompensa
  const handleApplyReward = useCallback(async (rewardId) => {
    const result = await dispatch(applyReward({ rewardId, appliedBy: userId }))
    
    if (!result.error) {
      // Refrescar estadísticas
      dispatch(fetchReferralStats(tenantId))
    }
  }, [dispatch, tenantId, userId])
  
  // Refrescar datos
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await dispatch(loadReferralData({ tenantId, userId }))
    setRefreshing(false)
  }, [dispatch, tenantId, userId])
  
  // Loading state
  const isLoading = loadingStates.code === 'loading' || loadingStates.stats === 'loading'
  const hasCodeError = loadingStates.code === 'failed'
  
  // Debug log
  useEffect(() => {
    if (code) {
      console.log('✅ Código de referido cargado:', code)
    } else if (loadingStates.code === 'failed') {
      console.log('❌ Error cargando código de referido')
    }
  }, [code, loadingStates.code])
  
  // Formatear fecha
  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
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
  
  // Obtener icono de estado
  const getStatusIcon = (status) => {
    switch (status) {
      case REFERRAL_STATUS.CONVERTED:
        return <CheckCircle size={16} className="status-icon--converted" />
      case REFERRAL_STATUS.PENDING:
        return <Clock size={16} className="status-icon--pending" />
      case REFERRAL_STATUS.REJECTED:
        return <XCircle size={16} className="status-icon--rejected" />
      case REFERRAL_STATUS.MANUAL_REVIEW:
        return <AlertCircle size={16} className="status-icon--review" />
      default:
        return null
    }
  }
  
  // Obtener label de estado
  const getStatusLabel = (status) => {
    switch (status) {
      case REFERRAL_STATUS.CONVERTED:
        return 'Convertido'
      case REFERRAL_STATUS.PENDING:
        return 'Pendiente'
      case REFERRAL_STATUS.REJECTED:
        return 'Rechazado'
      case REFERRAL_STATUS.MANUAL_REVIEW:
        return 'En revisión'
      default:
        return status
    }
  }
  
  // Obtener label de recompensa
  const getRewardStatusLabel = (status) => {
    switch (status) {
      case REWARD_STATUS.PENDING:
        return 'Pendiente de aplicar'
      case REWARD_STATUS.APPLIED:
        return 'Aplicada'
      case REWARD_STATUS.EXPIRED:
        return 'Expirada'
      case REWARD_STATUS.REVOKED:
        return 'Revocada'
      default:
        return status
    }
  }
  
  // Obtener color de plan
  const getPlanColor = (plan) => {
    switch (plan) {
      case 'premium_pro':
        return '#8b5cf6'
      case 'premium':
        return '#f59e0b'
      default:
        return '#64748b'
    }
  }

  return (
    <div className="referrals-manager">
      {/* Header */}
      <div className="referrals-manager__header">
        <div className="referrals-manager__title">
          <Users size={24} />
          <h2>Programa de Referidos</h2>
        </div>
        <p className="referrals-manager__subtitle">
          Invita amigos y gana meses gratis de suscripción
        </p>
        <button 
          className="referrals-manager__refresh"
          onClick={handleRefresh}
          disabled={refreshing || isLoading}
          title="Actualizar datos"
        >
          <RefreshCw size={18} className={refreshing ? 'spinning' : ''} />
        </button>
      </div>
      
      {/* Tabs */}
      <div className="referrals-manager__tabs">
        <button
          className={`referrals-manager__tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <TrendingUp size={16} />
          <span>Resumen</span>
        </button>
        <button
          className={`referrals-manager__tab ${activeTab === 'referrals' ? 'active' : ''}`}
          onClick={() => setActiveTab('referrals')}
        >
          <Users size={16} />
          <span>Mis Referidos</span>
          {stats?.pending_referrals > 0 && (
            <span className="tab-badge">{stats.pending_referrals}</span>
          )}
        </button>
        <button
          className={`referrals-manager__tab ${activeTab === 'rewards' ? 'active' : ''}`}
          onClick={() => setActiveTab('rewards')}
        >
          <Gift size={16} />
          <span>Recompensas</span>
          {pendingRewards.length > 0 && (
            <span className="tab-badge tab-badge--reward">{pendingRewards.length}</span>
          )}
        </button>
      </div>
      
      {/* Content */}
      <div className="referrals-manager__content">
        {isLoading ? (
          <div className="referrals-manager__loading">
            <RefreshCw size={32} className="spinning" />
            <p>Cargando datos de referidos...</p>
          </div>
        ) : (
          <>
            {/* Tab: Overview */}
            {activeTab === 'overview' && (
              <div className="referrals-overview">
                {/* Código de referido */}
                <Card className="referral-code-card">
                  <div className="referral-code-card__header">
                    <QrCode size={20} />
                    <h3>Tu código de referido</h3>
                  </div>
                  
                  {hasCodeError ? (
                    <div className="referral-code-card__error">
                      <AlertCircle size={24} />
                      <p>No se pudo cargar tu código de referido</p>
                      <p className="error-hint">
                        {loadingStates.code === 'failed' 
                          ? 'Puede que las tablas de referidos no estén configuradas en la base de datos.' 
                          : 'Intenta refrescar la página.'}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={refreshing}
                        icon={<RefreshCw size={14} className={refreshing ? 'spinning' : ''} />}
                      >
                        Reintentar
                      </Button>
                    </div>
                  ) : !code?.code ? (
                    <div className="referral-code-card__loading">
                      <RefreshCw size={20} className="spinning" />
                      <p>Generando tu código...</p>
                    </div>
                  ) : (
                    <div className="referral-code-card__content">
                      {/* Código y enlace - Ahora a la izquierda */}
                      <div className="referral-code-card__info">
                        <div className="referral-code-card__code-section">
                          <label className="code-label">Tu código</label>
                          <div className="referral-code-card__code">
                            <span className="code-value">{code.code}</span>
                            <button 
                              className="copy-btn"
                              onClick={handleCopyLink}
                              title="Copiar enlace"
                            >
                              {copied ? <Check size={18} /> : <Copy size={18} />}
                            </button>
                          </div>
                        </div>
                        
                        <div className="referral-code-card__link-section">
                          <label className="link-label">Enlace de invitación</label>
                          <div className="referral-code-card__link">
                            <Link2 size={14} />
                            <span className="link-url">{referralUrl || 'Generando...'}</span>
                          </div>
                        </div>
                      
                        <div className="referral-code-card__actions">
                          <Button
                            variant="primary"
                            onClick={handleCopyLink}
                            icon={copied ? <Check size={16} /> : <Copy size={16} />}
                          >
                            {copied ? '¡Copiado!' : 'Copiar enlace'}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setShowShareModal(true)}
                            icon={<Share2 size={16} />}
                          >
                            Compartir
                          </Button>
                        </div>
                      </div>
                      
                      {/* QR Code - Ahora a la derecha */}
                      <div className="referral-code-card__qr">
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(referralUrl || '')}&bgcolor=1a1a2e&color=ffffff`}
                          alt="QR Code de referido"
                          className="qr-image"
                        />
                        <span className="qr-label">Escanea para registrarte</span>
                      </div>
                    </div>
                  )}
                </Card>
                
                {/* Estadísticas */}
                <div className="referrals-stats-grid">
                  <Card className="stat-card">
                    <div className="stat-card__icon stat-card__icon--total">
                      <Users size={20} />
                    </div>
                    <div className="stat-card__content">
                      <span className="stat-card__value">{stats?.total_referrals || 0}</span>
                      <span className="stat-card__label">Total referidos</span>
                    </div>
                  </Card>
                  
                  <Card className="stat-card">
                    <div className="stat-card__icon stat-card__icon--converted">
                      <CheckCircle size={20} />
                    </div>
                    <div className="stat-card__content">
                      <span className="stat-card__value">{stats?.converted_referrals || 0}</span>
                      <span className="stat-card__label">Convertidos</span>
                    </div>
                  </Card>
                  
                  <Card className="stat-card">
                    <div className="stat-card__icon stat-card__icon--pending">
                      <Clock size={20} />
                    </div>
                    <div className="stat-card__content">
                      <span className="stat-card__value">{stats?.pending_referrals || 0}</span>
                      <span className="stat-card__label">Pendientes</span>
                    </div>
                  </Card>
                  
                  <Card className="stat-card">
                    <div className="stat-card__icon stat-card__icon--rewards">
                      <Gift size={20} />
                    </div>
                    <div className="stat-card__content">
                      <span className="stat-card__value">{stats?.total_reward_months || 0}</span>
                      <span className="stat-card__label">Meses ganados</span>
                    </div>
                  </Card>
                </div>
                
                {/* Progreso hacia próxima recompensa */}
                {progress && (
                  <Card className="progress-card">
                    <div className="progress-card__header">
                      <Target size={20} />
                      <h3>Progreso hacia próxima recompensa</h3>
                    </div>
                    
                    <div className="progress-card__bar-container">
                      <div className="progress-card__bar">
                        <div 
                          className="progress-card__bar-fill"
                          style={{ width: `${progress.progress}%` }}
                        />
                      </div>
                      <span className="progress-card__count">
                        {progress.currentInTier} / {progress.nextTierReferrals}
                      </span>
                    </div>
                    
                    <div className="progress-card__info">
                      <Zap size={16} />
                      <span>
                        {progress.remaining > 0 
                          ? `¡Te faltan ${progress.remaining} referidos convertidos para ganar 1 mes gratis!`
                          : '¡Felicidades! Has alcanzado el umbral.'
                        }
                      </span>
                    </div>
                    
                    {progress.nextSpecialTier && (
                      <div className="progress-card__special">
                        <Crown size={16} />
                        <span>
                          Próximo objetivo especial: {progress.nextSpecialTier.referrals} referidos 
                          = {progress.nextSpecialTier.reward}
                          <span className="remaining">
                            ({progress.nextSpecialTier.remaining} restantes)
                          </span>
                        </span>
                      </div>
                    )}
                  </Card>
                )}
                
                {/* Recompensas pendientes */}
                {pendingRewards.length > 0 && (
                  <Card className="pending-rewards-card">
                    <div className="pending-rewards-card__header">
                      <Sparkles size={20} />
                      <h3>¡Tienes recompensas pendientes!</h3>
                    </div>
                    
                    <div className="pending-rewards-list">
                      {pendingRewards.slice(0, 3).map((reward) => (
                        <div key={reward.id} className="pending-reward-item">
                          <div className="pending-reward-item__info">
                            <Award 
                              size={18} 
                              style={{ color: getPlanColor(reward.reward_plan) }}
                            />
                            <div>
                              <span className="pending-reward-item__title">
                                {reward.reward_months} {reward.reward_months === 1 ? 'mes' : 'meses'} de {reward.reward_plan}
                              </span>
                              <span className="pending-reward-item__expires">
                                Expira: {formatDate(reward.expires_at)}
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="primary"
                            size="small"
                            onClick={() => handleApplyReward(reward.id)}
                            disabled={isApplyingReward}
                            loading={applyingRewardId === reward.id}
                          >
                            Aplicar
                          </Button>
                        </div>
                      ))}
                    </div>
                    
                    {pendingRewards.length > 3 && (
                      <button 
                        className="view-all-btn"
                        onClick={() => setActiveTab('rewards')}
                      >
                        Ver todas ({pendingRewards.length})
                        <ChevronRight size={16} />
                      </button>
                    )}
                  </Card>
                )}
                
                {/* Cómo funciona */}
                <Card className="how-it-works-card">
                  <h3>¿Cómo funciona?</h3>
                  
                  <div className="how-it-works-steps">
                    <div className="how-step">
                      <div className="how-step__number">1</div>
                      <div className="how-step__content">
                        <strong>Comparte tu código</strong>
                        <p>Envía tu enlace de referido a amigos y conocidos</p>
                      </div>
                    </div>
                    
                    <div className="how-step">
                      <div className="how-step__number">2</div>
                      <div className="how-step__content">
                        <strong>Ellos se registran</strong>
                        <p>Cuando se registran usando tu código, quedan como referidos pendientes</p>
                      </div>
                    </div>
                    
                    <div className="how-step">
                      <div className="how-step__number">3</div>
                      <div className="how-step__content">
                        <strong>Pagan su suscripción</strong>
                        <p>Cuando compran al menos 1 mes de suscripción paga, se convierten</p>
                      </div>
                    </div>
                    
                    <div className="how-step">
                      <div className="how-step__number">4</div>
                      <div className="how-step__content">
                        <strong>¡Ganas recompensas!</strong>
                        <p>Cada 5 convertidos = 1 mes gratis. ¡30 convertidos = 4 meses Premium Pro!</p>
                      </div>
                    </div>
                  </div>
                  
                  {config && (
                    <div className="rewards-tiers">
                      <h4>Niveles de recompensa</h4>
                      <div className="tier-list">
                        <div className="tier-item">
                          <span className="tier-item__referrals">{config.tier_1_referrals} referidos</span>
                          <ChevronRight size={14} />
                          <span className="tier-item__reward" style={{ color: getPlanColor(config.tier_1_reward_plan) }}>
                            {config.tier_1_reward_months} mes de {config.tier_1_reward_plan}
                          </span>
                        </div>
                        <div className="tier-item">
                          <span className="tier-item__referrals">{config.tier_2_referrals} referidos</span>
                          <ChevronRight size={14} />
                          <span className="tier-item__reward" style={{ color: getPlanColor(config.tier_2_reward_plan) }}>
                            {config.tier_2_reward_months} mes de {config.tier_2_reward_plan}
                          </span>
                        </div>
                        <div className="tier-item tier-item--special">
                          <Crown size={14} />
                          <span className="tier-item__referrals">{config.tier_3_referrals} referidos</span>
                          <ChevronRight size={14} />
                          <span className="tier-item__reward" style={{ color: getPlanColor(config.tier_3_reward_plan) }}>
                            {config.tier_3_reward_months} meses de {config.tier_3_reward_plan}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            )}
            
            {/* Tab: Referrals List */}
            {activeTab === 'referrals' && (
              <div className="referrals-list-tab">
                <Card>
                  <div className="referrals-list__header">
                    <h3>Mis Referidos</h3>
                    <span className="referrals-list__count">
                      {referrals.length} total
                    </span>
                  </div>
                  
                  {referrals.length === 0 ? (
                    <div className="referrals-list__empty">
                      <Users size={48} />
                      <h4>Aún no tienes referidos</h4>
                      <p>Comparte tu código para comenzar a ganar recompensas</p>
                      <Button
                        variant="primary"
                        onClick={handleCopyLink}
                        icon={<Copy size={16} />}
                      >
                        Copiar enlace de referido
                      </Button>
                    </div>
                  ) : (
                    <div className="referrals-table-wrapper">
                      <table className="referrals-table">
                        <thead>
                          <tr>
                            <th>Email</th>
                            <th>Fecha registro</th>
                            <th>Estado</th>
                            <th>Fecha conversión</th>
                            <th>Plan</th>
                            <th>Monto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {referrals.map((referral) => (
                            <tr key={referral.id}>
                              <td className="referral-email">
                                <span>{referral.referred_email}</span>
                              </td>
                              <td>{formatDate(referral.created_at)}</td>
                              <td>
                                <span className={`status-badge status-badge--${referral.status}`}>
                                  {getStatusIcon(referral.status)}
                                  {getStatusLabel(referral.status)}
                                </span>
                              </td>
                              <td>{formatDate(referral.converted_at)}</td>
                              <td>
                                {referral.conversion_plan ? (
                                  <span 
                                    className="plan-badge"
                                    style={{ backgroundColor: getPlanColor(referral.conversion_plan) }}
                                  >
                                    {referral.conversion_plan}
                                  </span>
                                ) : '-'}
                              </td>
                              <td>{formatAmount(referral.conversion_amount, referral.conversion_currency)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </div>
            )}
            
            {/* Tab: Rewards */}
            {activeTab === 'rewards' && (
              <div className="rewards-tab">
                <Card>
                  <div className="rewards-list__header">
                    <h3>Mis Recompensas</h3>
                    <div className="rewards-summary">
                      <span className="rewards-summary__item rewards-summary__item--pending">
                        <Clock size={14} />
                        {stats?.pending_rewards || 0} pendientes
                      </span>
                      <span className="rewards-summary__item rewards-summary__item--applied">
                        <CheckCircle size={14} />
                        {stats?.applied_rewards || 0} aplicadas
                      </span>
                    </div>
                  </div>
                  
                  {rewards.length === 0 ? (
                    <div className="rewards-list__empty">
                      <Gift size={48} />
                      <h4>Aún no tienes recompensas</h4>
                      <p>Consigue {config?.tier_1_referrals || 5} referidos convertidos para ganar tu primera recompensa</p>
                    </div>
                  ) : (
                    <div className="rewards-grid">
                      {rewards.map((reward) => (
                        <div 
                          key={reward.id} 
                          className={`reward-card reward-card--${reward.status}`}
                        >
                          <div 
                            className="reward-card__icon"
                            style={{ backgroundColor: getPlanColor(reward.reward_plan) }}
                          >
                            <Award size={24} />
                          </div>
                          
                          <div className="reward-card__content">
                            <h4>
                              {reward.reward_months} {reward.reward_months === 1 ? 'mes' : 'meses'} 
                              {reward.reward_days > 0 ? ` y ${reward.reward_days} días` : ''} 
                              de {reward.reward_plan === 'premium_pro' ? 'Premium Pro' : 'Premium'}
                            </h4>
                            <p className="reward-card__description">
                              {reward.description}
                            </p>
                            
                            <div className="reward-card__meta">
                              <span className={`reward-status reward-status--${reward.status}`}>
                                {getRewardStatusLabel(reward.status)}
                              </span>
                              
                              {reward.status === REWARD_STATUS.PENDING && (
                                <span className="reward-expires">
                                  Expira: {formatDate(reward.expires_at)}
                                </span>
                              )}
                              
                              {reward.status === REWARD_STATUS.APPLIED && reward.applied_at && (
                                <span className="reward-applied">
                                  Aplicada: {formatDate(reward.applied_at)}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {reward.status === REWARD_STATUS.PENDING && (
                            <div className="reward-card__actions">
                              <Button
                                variant="primary"
                                size="small"
                                onClick={() => handleApplyReward(reward.id)}
                                disabled={isApplyingReward}
                                loading={applyingRewardId === reward.id}
                              >
                                Aplicar ahora
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Modal de compartir */}
      {showShareModal && (
        <div className="share-modal-overlay" onClick={() => setShowShareModal(false)}>
          <div className="share-modal" onClick={e => e.stopPropagation()}>
            <div className="share-modal__header">
              <h3>
                <Share2 size={20} />
                Compartir enlace de referido
              </h3>
              <button 
                className="share-modal__close"
                onClick={() => setShowShareModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="share-modal__content">
              <p className="share-modal__desc">
                Comparte tu código <strong>{code?.code}</strong> y gana recompensas cuando tus amigos se registren.
              </p>
              
              <div className="share-modal__buttons">
                <button 
                  className="share-modal__btn share-modal__btn--whatsapp"
                  onClick={() => { shareToSocial('whatsapp'); setShowShareModal(false); }}
                >
                  <div className="share-modal__btn-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </div>
                  <span>WhatsApp</span>
                </button>
                
                <button 
                  className="share-modal__btn share-modal__btn--facebook"
                  onClick={() => { shareToSocial('facebook'); setShowShareModal(false); }}
                >
                  <div className="share-modal__btn-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </div>
                  <span>Facebook</span>
                </button>
                
                <button 
                  className="share-modal__btn share-modal__btn--twitter"
                  onClick={() => { shareToSocial('twitter'); setShowShareModal(false); }}
                >
                  <div className="share-modal__btn-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </div>
                  <span>X</span>
                </button>
                
                <button 
                  className="share-modal__btn share-modal__btn--telegram"
                  onClick={() => { shareToSocial('telegram'); setShowShareModal(false); }}
                >
                  <div className="share-modal__btn-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                    </svg>
                  </div>
                  <span>Telegram</span>
                </button>
                
                <button 
                  className="share-modal__btn share-modal__btn--linkedin"
                  onClick={() => { 
                    const url = encodeURIComponent(referralUrl)
                    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank', 'width=600,height=400')
                    setShowShareModal(false)
                  }}
                >
                  <div className="share-modal__btn-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                  </div>
                  <span>LinkedIn</span>
                </button>
                
                <button 
                  className="share-modal__btn share-modal__btn--email"
                  onClick={() => { shareToSocial('email'); setShowShareModal(false); }}
                >
                  <div className="share-modal__btn-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2"/>
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                    </svg>
                  </div>
                  <span>Email</span>
                </button>
                
                <button 
                  className="share-modal__btn share-modal__btn--copy"
                  onClick={() => { handleCopyLink(); setShowShareModal(false); }}
                >
                  <div className="share-modal__btn-icon">
                    <Copy size={24} />
                  </div>
                  <span>Copiar</span>
                </button>
                
                {navigator.share && (
                  <button 
                    className="share-modal__btn share-modal__btn--more"
                    onClick={() => { handleShare(); setShowShareModal(false); }}
                  >
                    <div className="share-modal__btn-icon">
                      <Share2 size={24} />
                    </div>
                    <span>Más</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
