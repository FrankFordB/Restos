import { useState, useEffect } from 'react'
import './PaymentMethodsConfig.css'
import { Banknote, CreditCard, Smartphone, Save, Loader2, CheckCircle, AlertTriangle, ToggleLeft, ToggleRight } from 'lucide-react'
import { fetchPaymentMethodsConfig, updatePaymentMethodsConfig } from '../../../lib/supabaseApi'
import { isSupabaseConfigured } from '../../../lib/supabaseClient'
import { loadJson, saveJson } from '../../../shared/storage'

const PAYMENT_METHODS = [
  {
    key: 'efectivo',
    label: 'Efectivo',
    description: 'El cliente paga en efectivo al recibir el pedido',
    icon: Banknote,
    color: '#10b981',
  },
  {
    key: 'tarjeta',
    label: 'Tarjeta en el local',
    description: 'El cliente paga con tarjeta de débito/crédito al retirar o recibir',
    icon: CreditCard,
    color: '#3b82f6',
  },
  {
    key: 'qr',
    label: 'MercadoPago',
    description: 'El cliente paga online vía MercadoPago (requiere configurar credenciales)',
    icon: Smartphone,
    color: '#00b1ea',
    requiresMP: true,
  },
]

export default function PaymentMethodsConfig({ tenantId, mpConfigured = false }) {
  const [config, setConfig] = useState({ efectivo: true, tarjeta: true, qr: true })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [originalConfig, setOriginalConfig] = useState(null)

  const cacheKey = `paymentMethodsConfig.${tenantId}`

  useEffect(() => {
    loadConfig()
  }, [tenantId])

  const loadConfig = async () => {
    setLoading(true)
    try {
      if (isSupabaseConfigured) {
        const data = await fetchPaymentMethodsConfig(tenantId)
        setConfig(data)
        setOriginalConfig(data)
        saveJson(cacheKey, data)
      } else {
        const cached = loadJson(cacheKey, { efectivo: true, tarjeta: true, qr: true })
        setConfig(cached)
        setOriginalConfig(cached)
      }
    } catch (err) {
      console.error('Error loading payment methods config:', err)
      const cached = loadJson(cacheKey, { efectivo: true, tarjeta: true, qr: true })
      setConfig(cached)
      setOriginalConfig(cached)
    } finally {
      setLoading(false)
    }
  }

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const handleToggle = (key) => {
    // Don't allow disabling all payment methods
    const newConfig = { ...config, [key]: !config[key] }
    const enabledCount = Object.values(newConfig).filter(Boolean).length
    if (enabledCount === 0) {
      showToast('Debes tener al menos un método de pago habilitado', 'error')
      return
    }
    setConfig(newConfig)
    setHasChanges(JSON.stringify(newConfig) !== JSON.stringify(originalConfig))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (isSupabaseConfigured) {
        await updatePaymentMethodsConfig(tenantId, config)
      }
      saveJson(cacheKey, config)
      setOriginalConfig(config)
      setHasChanges(false)
      showToast('Métodos de pago actualizados')
    } catch (err) {
      console.error('Error saving payment methods config:', err)
      showToast('Error al guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="paymentMethodsConfig">
        <div className="paymentMethodsConfig__loading">
          <Loader2 size={24} className="icon-spin" />
          <span>Cargando métodos de pago...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="paymentMethodsConfig">
      <div className="paymentMethodsConfig__header">
        <h3 className="paymentMethodsConfig__title">
          <CreditCard size={20} />
          Métodos de Pago
        </h3>
        <p className="paymentMethodsConfig__subtitle">
          Elige qué opciones de pago ofreces a tus clientes
        </p>
      </div>

      <div className="paymentMethodsConfig__list">
        {PAYMENT_METHODS.map((method) => {
          const Icon = method.icon
          const isEnabled = config[method.key] !== false
          const isDisabledMP = method.requiresMP && !mpConfigured

          return (
            <div
              key={method.key}
              className={`paymentMethodsConfig__item ${isEnabled ? 'paymentMethodsConfig__item--enabled' : ''} ${isDisabledMP ? 'paymentMethodsConfig__item--mpDisabled' : ''}`}
            >
              <div className="paymentMethodsConfig__itemIcon" style={{ color: isEnabled ? method.color : '#9ca3af' }}>
                <Icon size={24} />
              </div>
              <div className="paymentMethodsConfig__itemInfo">
                <span className="paymentMethodsConfig__itemLabel">{method.label}</span>
                <span className="paymentMethodsConfig__itemDesc">{method.description}</span>
                {isDisabledMP && (
                  <span className="paymentMethodsConfig__mpWarning">
                    <AlertTriangle size={12} /> Configura tus credenciales de MercadoPago primero
                  </span>
                )}
              </div>
              <button
                className={`paymentMethodsConfig__toggle ${isEnabled ? 'paymentMethodsConfig__toggle--on' : ''}`}
                onClick={() => handleToggle(method.key)}
                disabled={isDisabledMP}
                title={isEnabled ? 'Desactivar' : 'Activar'}
              >
                {isEnabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
              </button>
            </div>
          )
        })}
      </div>

      {hasChanges && (
        <div className="paymentMethodsConfig__actions">
          <button
            className="paymentMethodsConfig__saveBtn"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <><Loader2 size={16} className="icon-spin" /> Guardando...</>
            ) : (
              <><Save size={16} /> Guardar cambios</>
            )}
          </button>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`paymentMethodsConfig__toast paymentMethodsConfig__toast--${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          {toast.message}
        </div>
      )}
    </div>
  )
}
