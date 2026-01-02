import { useState, useEffect } from 'react'
import './SubscriptionsAdmin.css'
import { getAllPlatformSubscriptions, getSubscriptionsSummary } from '../../../lib/supabaseMercadopagoApi'
import { TIER_LABELS } from '../../../shared/subscriptions'

/**
 * Panel de administración de suscripciones para super_admin
 * Muestra todas las suscripciones activas con días restantes
 */
export default function SubscriptionsAdmin() {
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all') // 'all', 'expiring', 'expired'

  useEffect(() => {
    loadSubscriptions()
  }, [])

  const loadSubscriptions = async () => {
    try {
      setLoading(true)
      const data = await getSubscriptionsSummary()
      setSummary(data)
    } catch (err) {
      console.error('Error loading subscriptions:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getFilteredSubscriptions = () => {
    if (!summary?.subscriptions) return []
    
    switch (filter) {
      case 'expiring':
        return summary.subscriptions.filter(s => s.days_remaining > 0 && s.days_remaining <= 7)
      case 'expired':
        return summary.subscriptions.filter(s => s.days_remaining <= 0)
      default:
        return summary.subscriptions
    }
  }

  const getDaysLabel = (days) => {
    if (days <= 0) return { text: 'Expirado', className: 'expired' }
    if (days === 1) return { text: '1 día', className: 'critical' }
    if (days <= 3) return { text: `${days} días`, className: 'critical' }
    if (days <= 7) return { text: `${days} días`, className: 'warning' }
    return { text: `${days} días`, className: 'ok' }
  }

  if (loading) {
    return (
      <div className="subscriptionsAdmin">
        <div className="subscriptionsAdmin__loading">
          <div className="subscriptionsAdmin__spinner"></div>
          <p>Cargando suscripciones...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="subscriptionsAdmin">
        <div className="subscriptionsAdmin__error">
          <p>❌ Error: {error}</p>
          <button onClick={loadSubscriptions}>Reintentar</button>
        </div>
      </div>
    )
  }

  const filteredSubs = getFilteredSubscriptions()

  return (
    <div className="subscriptionsAdmin">
      <div className="subscriptionsAdmin__header">
        <h2>📊 Gestión de Suscripciones</h2>
        <button 
          className="subscriptionsAdmin__refreshBtn"
          onClick={loadSubscriptions}
        >
          🔄 Actualizar
        </button>
      </div>

      {/* Summary Cards */}
      <div className="subscriptionsAdmin__summary">
        <div className="subscriptionsAdmin__card">
          <div className="subscriptionsAdmin__cardIcon">👥</div>
          <div className="subscriptionsAdmin__cardContent">
            <span className="subscriptionsAdmin__cardValue">{summary?.total || 0}</span>
            <span className="subscriptionsAdmin__cardLabel">Total Suscritos</span>
          </div>
        </div>

        <div className="subscriptionsAdmin__card subscriptionsAdmin__card--premium">
          <div className="subscriptionsAdmin__cardIcon">⭐</div>
          <div className="subscriptionsAdmin__cardContent">
            <span className="subscriptionsAdmin__cardValue">{summary?.premium || 0}</span>
            <span className="subscriptionsAdmin__cardLabel">Premium</span>
          </div>
        </div>

        <div className="subscriptionsAdmin__card subscriptionsAdmin__card--pro">
          <div className="subscriptionsAdmin__cardIcon">👑</div>
          <div className="subscriptionsAdmin__cardContent">
            <span className="subscriptionsAdmin__cardValue">{summary?.premiumPro || 0}</span>
            <span className="subscriptionsAdmin__cardLabel">Premium Pro</span>
          </div>
        </div>

        <div className="subscriptionsAdmin__card subscriptionsAdmin__card--warning">
          <div className="subscriptionsAdmin__cardIcon">⚠️</div>
          <div className="subscriptionsAdmin__cardContent">
            <span className="subscriptionsAdmin__cardValue">{summary?.expiringSoon || 0}</span>
            <span className="subscriptionsAdmin__cardLabel">Por Vencer (7 días)</span>
          </div>
        </div>

        <div className="subscriptionsAdmin__card subscriptionsAdmin__card--danger">
          <div className="subscriptionsAdmin__cardIcon">🚫</div>
          <div className="subscriptionsAdmin__cardContent">
            <span className="subscriptionsAdmin__cardValue">{summary?.expired || 0}</span>
            <span className="subscriptionsAdmin__cardLabel">Expirados</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="subscriptionsAdmin__filters">
        <button
          className={`subscriptionsAdmin__filterBtn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Todos ({summary?.total || 0})
        </button>
        <button
          className={`subscriptionsAdmin__filterBtn ${filter === 'expiring' ? 'active' : ''}`}
          onClick={() => setFilter('expiring')}
        >
          ⚠️ Por Vencer ({summary?.expiringSoon || 0})
        </button>
        <button
          className={`subscriptionsAdmin__filterBtn ${filter === 'expired' ? 'active' : ''}`}
          onClick={() => setFilter('expired')}
        >
          🚫 Expirados ({summary?.expired || 0})
        </button>
      </div>

      {/* Subscriptions Table */}
      <div className="subscriptionsAdmin__table">
        <div className="subscriptionsAdmin__tableHeader">
          <span>Tienda</span>
          <span>Plan</span>
          <span>Días Restantes</span>
          <span>Vence</span>
          <span>Auto-Renovación</span>
        </div>

        {filteredSubs.length === 0 ? (
          <div className="subscriptionsAdmin__empty">
            <p>No hay suscripciones en esta categoría</p>
          </div>
        ) : (
          filteredSubs.map(sub => {
            const daysInfo = getDaysLabel(sub.days_remaining)
            return (
              <div key={sub.tenant_id || sub.id} className="subscriptionsAdmin__tableRow">
                <div className="subscriptionsAdmin__tenantInfo">
                  <span className="subscriptionsAdmin__tenantName">
                    {sub.tenant_name || sub.name || 'Sin nombre'}
                  </span>
                  <span className="subscriptionsAdmin__tenantSlug">
                    /{sub.tenant_slug || sub.slug}
                  </span>
                </div>
                
                <div className={`subscriptionsAdmin__tier subscriptionsAdmin__tier--${sub.subscription_tier}`}>
                  {sub.subscription_tier === 'premium_pro' ? '👑' : '⭐'}
                  {TIER_LABELS[sub.subscription_tier] || sub.subscription_tier}
                </div>
                
                <div className={`subscriptionsAdmin__days subscriptionsAdmin__days--${daysInfo.className}`}>
                  {daysInfo.text}
                </div>
                
                <div className="subscriptionsAdmin__date">
                  {sub.premium_until 
                    ? new Date(sub.premium_until).toLocaleDateString('es-AR')
                    : '-'
                  }
                </div>
                
                <div className="subscriptionsAdmin__autoRenew">
                  {sub.auto_renew ? (
                    <span className="subscriptionsAdmin__autoRenew--on">✅ Activa</span>
                  ) : (
                    <span className="subscriptionsAdmin__autoRenew--off">❌ Inactiva</span>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
