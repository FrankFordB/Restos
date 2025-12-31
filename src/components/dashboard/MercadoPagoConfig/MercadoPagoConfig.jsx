import { useState, useEffect } from 'react'
import './MercadoPagoConfig.css'
import {
  getTenantMPCredentials,
  saveTenantMPCredentials,
  deleteTenantMPCredentials,
} from '../../../lib/supabaseMercadopagoApi'

export default function MercadoPagoConfig({ tenantId }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [mode, setMode] = useState('sandbox') // 'sandbox' | 'production'
  const [showTokens, setShowTokens] = useState({})
  
  const [credentials, setCredentials] = useState({
    // Producción
    accessToken: '',
    publicKey: '',
    // Sandbox
    sandboxAccessToken: '',
    sandboxPublicKey: '',
  })

  useEffect(() => {
    loadCredentials()
  }, [tenantId])

  const loadCredentials = async () => {
    try {
      setLoading(true)
      const data = await getTenantMPCredentials(tenantId)
      if (data) {
        setCredentials({
          accessToken: data.access_token || '',
          publicKey: data.public_key || '',
          sandboxAccessToken: data.sandbox_access_token || '',
          sandboxPublicKey: data.sandbox_public_key || '',
        })
        setMode(data.is_sandbox ? 'sandbox' : 'production')
      }
    } catch (error) {
      console.error('Error cargando credenciales:', error)
      showToast('Error al cargar la configuración', 'error')
    } finally {
      setLoading(false)
    }
  }

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const handleChange = (field, value) => {
    setCredentials(prev => ({ ...prev, [field]: value }))
  }

  const toggleVisibility = (field) => {
    setShowTokens(prev => ({ ...prev, [field]: !prev[field] }))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      await saveTenantMPCredentials(tenantId, {
        ...credentials,
        isSandbox: mode === 'sandbox',
      })
      showToast('✅ Configuración guardada correctamente', 'success')
    } catch (error) {
      console.error('Error guardando credenciales:', error)
      showToast('Error al guardar la configuración', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleClear = async () => {
    if (!window.confirm('¿Estás seguro de eliminar la configuración de MercadoPago?')) {
      return
    }
    
    try {
      setSaving(true)
      await deleteTenantMPCredentials(tenantId)
      setCredentials({
        accessToken: '',
        publicKey: '',
        sandboxAccessToken: '',
        sandboxPublicKey: '',
      })
      showToast('Configuración eliminada', 'success')
    } catch (error) {
      console.error('Error eliminando credenciales:', error)
      showToast('Error al eliminar la configuración', 'error')
    } finally {
      setSaving(false)
    }
  }

  const isConfigured = mode === 'sandbox'
    ? Boolean(credentials.sandboxAccessToken && credentials.sandboxPublicKey)
    : Boolean(credentials.accessToken && credentials.publicKey)

  if (loading) {
    return (
      <div className="mpConfig">
        <div className="mpConfig__loading">Cargando configuración...</div>
      </div>
    )
  }

  return (
    <div className="mpConfig">
      <div className="mpConfig__header">
        <h2 className="mpConfig__title">
          <span className="mpConfig__titleIcon">💳</span>
          Configuración de MercadoPago
        </h2>
        <p className="mpConfig__subtitle">
          Configura tus credenciales para recibir pagos de tus clientes
        </p>
      </div>

      {/* Estado actual */}
      <div className={`mpConfig__status ${isConfigured ? 'mpConfig__status--configured' : 'mpConfig__status--notConfigured'}`}>
        <span className="mpConfig__statusIcon">
          {isConfigured ? '✅' : '⚠️'}
        </span>
        <div className="mpConfig__statusText">
          <h4>{isConfigured ? 'MercadoPago Configurado' : 'MercadoPago No Configurado'}</h4>
          <p>
            {isConfigured 
              ? `Modo ${mode === 'sandbox' ? 'Pruebas' : 'Producción'} activo. Tus clientes pueden pagar con MP.`
              : 'Agrega tus credenciales para empezar a recibir pagos.'
            }
          </p>
        </div>
      </div>

      {/* Toggle de modo */}
      <div className="mpConfig__modeToggle">
        <button
          className={`mpConfig__modeBtn mpConfig__modeBtn--sandbox ${mode === 'sandbox' ? 'mpConfig__modeBtn--active' : ''}`}
          onClick={() => setMode('sandbox')}
        >
          🧪 Pruebas (Sandbox)
        </button>
        <button
          className={`mpConfig__modeBtn mpConfig__modeBtn--production ${mode === 'production' ? 'mpConfig__modeBtn--active' : ''}`}
          onClick={() => setMode('production')}
        >
          🚀 Producción
        </button>
      </div>

      <form className="mpConfig__form" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
        {/* Credenciales según modo */}
        <div className="mpConfig__section">
          <h3 className="mpConfig__sectionTitle">
            Credenciales de {mode === 'sandbox' ? 'Pruebas' : 'Producción'}
            <span className={`mpConfig__sectionBadge mpConfig__sectionBadge--${mode}`}>
              {mode === 'sandbox' ? 'SANDBOX' : 'LIVE'}
            </span>
          </h3>
          
          <div className="mpConfig__fields">
            <div className="mpConfig__field">
              <label className="mpConfig__label">
                Public Key
              </label>
              <div className="mpConfig__inputWrapper">
                <input
                  type={showTokens.publicKey ? 'text' : 'password'}
                  className="mpConfig__input"
                  placeholder={mode === 'sandbox' ? 'TEST-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' : 'APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'}
                  value={mode === 'sandbox' ? credentials.sandboxPublicKey : credentials.publicKey}
                  onChange={(e) => handleChange(
                    mode === 'sandbox' ? 'sandboxPublicKey' : 'publicKey',
                    e.target.value
                  )}
                />
                <button
                  type="button"
                  className="mpConfig__toggleVisibility"
                  onClick={() => toggleVisibility('publicKey')}
                >
                  {showTokens.publicKey ? '🙈' : '👁️'}
                </button>
              </div>
              <span className="mpConfig__hint">
                Se usa en el frontend para inicializar el checkout
              </span>
            </div>

            <div className="mpConfig__field">
              <label className="mpConfig__label">
                Access Token
              </label>
              <div className="mpConfig__inputWrapper">
                <input
                  type={showTokens.accessToken ? 'text' : 'password'}
                  className="mpConfig__input"
                  placeholder={mode === 'sandbox' ? 'TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' : 'APP_USR-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'}
                  value={mode === 'sandbox' ? credentials.sandboxAccessToken : credentials.accessToken}
                  onChange={(e) => handleChange(
                    mode === 'sandbox' ? 'sandboxAccessToken' : 'accessToken',
                    e.target.value
                  )}
                />
                <button
                  type="button"
                  className="mpConfig__toggleVisibility"
                  onClick={() => toggleVisibility('accessToken')}
                >
                  {showTokens.accessToken ? '🙈' : '👁️'}
                </button>
              </div>
              <span className="mpConfig__hint">
                ⚠️ Mantén este token seguro. Se usa para crear preferencias de pago.
              </span>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="mpConfig__actions">
          <button
            type="submit"
            className="mpConfig__saveBtn"
            disabled={saving}
          >
            {saving ? (
              <>⏳ Guardando...</>
            ) : (
              <>💾 Guardar Configuración</>
            )}
          </button>
          
          {isConfigured && (
            <button
              type="button"
              className="mpConfig__clearBtn"
              onClick={handleClear}
              disabled={saving}
            >
              🗑️ Eliminar
            </button>
          )}
        </div>
      </form>

      {/* Ayuda */}
      <div className="mpConfig__help">
        <h4 className="mpConfig__helpTitle">
          💡 ¿Cómo obtener tus credenciales?
        </h4>
        <ol className="mpConfig__helpSteps">
          <li>
            Ingresa a{' '}
            <a
              href="https://www.mercadopago.com.ar/developers/panel/app"
              target="_blank"
              rel="noopener noreferrer"
              className="mpConfig__helpLink"
            >
              Panel de Desarrolladores de MercadoPago
            </a>
          </li>
          <li>Crea una aplicación o selecciona una existente</li>
          <li>Ve a &quot;Credenciales&quot; en el menú lateral</li>
          <li>Copia la &quot;Public Key&quot; y &quot;Access Token&quot;</li>
          <li>Para pruebas, usa las credenciales de &quot;Credenciales de prueba&quot;</li>
        </ol>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`mpConfig__toast mpConfig__toast--${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
