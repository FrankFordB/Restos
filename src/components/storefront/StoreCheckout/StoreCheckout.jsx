import { useState, useEffect } from 'react'
import './StoreCheckout.css'
import { X, MapPin, AlertTriangle, Lock, Check } from 'lucide-react'
import {
  createStoreOrderPreference,
  formatAmount,
} from '../../../lib/mercadopago'
import {
  getTenantActiveCredentials,
  isTenantMPConfigured,
} from '../../../lib/supabaseMercadopagoApi'

/**
 * Checkout modal para tiendas de tenants
 * Permite al cliente elegir método de pago y completar datos
 */
export default function StoreCheckout({
  isOpen,
  onClose,
  tenant,
  items,
  total,
  onOrderComplete,
}) {
  const [step, setStep] = useState(1) // 1: datos, 2: pago
  const [loading, setLoading] = useState(false)
  const [checkingMP, setCheckingMP] = useState(true)
  const [mpConfigured, setMpConfigured] = useState(false)
  const [error, setError] = useState(null)
  
  // Datos del cliente
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [notes, setNotes] = useState('')
  
  // Método de pago
  const [paymentMethod, setPaymentMethod] = useState('cash') // 'cash' | 'mercadopago'

  // Verificar si el tenant tiene MP configurado
  useEffect(() => {
    if (isOpen && tenant?.id) {
      checkMercadoPago()
    }
  }, [isOpen, tenant?.id])

  const checkMercadoPago = async () => {
    try {
      setCheckingMP(true)
      const configured = await isTenantMPConfigured(tenant.id)
      setMpConfigured(configured)
      if (configured) {
        setPaymentMethod('mercadopago')
      }
    } catch (err) {
      console.error('Error verificando MP:', err)
      setMpConfigured(false)
    } finally {
      setCheckingMP(false)
    }
  }

  const formatPrice = (price) => formatAmount(price, 'ARS')

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (step === 1) {
      // Validar datos mínimos
      if (!customerName.trim()) {
        setError('Por favor ingresa tu nombre')
        return
      }
      if (!customerPhone.trim()) {
        setError('Por favor ingresa tu teléfono')
        return
      }
      setError(null)
      setStep(2)
      return
    }

    // Step 2: Procesar pago
    try {
      setLoading(true)
      setError(null)

      // Crear orden local primero
      const order = {
        id: `order_${Date.now()}`,
        customerName,
        customerPhone,
        customerAddress,
        notes,
        items: items.map(it => ({
          productId: it.product?.id,
          name: it.product?.name,
          unitPrice: it.unitPrice || it.product?.price,
          qty: it.qty || it.quantity,
          lineTotal: it.lineTotal || it.totalPrice,
          extras: it.extras,
        })),
        total,
        paymentMethod,
        status: paymentMethod === 'cash' ? 'pending' : 'pending_payment',
        createdAt: new Date().toISOString(),
      }

      if (paymentMethod === 'mercadopago') {
        // Obtener credenciales del tenant
        const credentials = await getTenantActiveCredentials(tenant.id)
        
        if (!credentials) {
          throw new Error('El local no tiene configurado MercadoPago')
        }

        // Crear preferencia de pago
        const preference = await createStoreOrderPreference({
          credentials,
          order,
          items: order.items,
          tenant,
        })

        // Redirigir a MercadoPago
        window.location.href = preference.initPoint
        return
      }

      // Pago en efectivo: completar orden directamente
      if (onOrderComplete) {
        onOrderComplete(order)
      }
      
      onClose()
      
    } catch (err) {
      console.error('Error procesando pedido:', err)
      setError(err.message || 'Error al procesar el pedido')
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    if (step === 2) {
      setStep(1)
      setError(null)
    } else {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="storeCheckout">
      <div className="storeCheckout__backdrop" onClick={onClose} />
      
      <div className="storeCheckout__content">
        {/* Header */}
        <header className="storeCheckout__header">
          <div className="storeCheckout__headerTop">
            <h2 className="storeCheckout__title">
              {step === 1 ? 'Tus Datos' : 'Método de Pago'}
            </h2>
            <button className="storeCheckout__closeBtn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
          <p className="storeCheckout__storeName">{tenant?.name}</p>
          
          {/* Steps indicator */}
          <div className="storeCheckout__steps">
            <div className={`storeCheckout__step ${step >= 1 ? 'storeCheckout__step--completed' : ''}`} />
            <div className={`storeCheckout__step ${step >= 2 ? 'storeCheckout__step--active' : ''}`} />
          </div>
        </header>

        {loading || checkingMP ? (
          <div className="storeCheckout__loading">
            <div className="storeCheckout__spinner" />
            <p className="storeCheckout__loadingText">
              {checkingMP ? 'Verificando métodos de pago...' : 'Procesando tu pedido...'}
            </p>
          </div>
        ) : (
          <form className="storeCheckout__body" onSubmit={handleSubmit}>
            {/* Resumen del pedido */}
            <div className="storeCheckout__section">
              <h3 className="storeCheckout__sectionTitle">
                <span></span> Tu Pedido
              </h3>
              <div className="storeCheckout__orderItems">
                {items.map((item, idx) => (
                  <div key={idx} className="storeCheckout__orderItem">
                    <div className="storeCheckout__itemInfo">
                      <span className="storeCheckout__itemName">{item.product?.name}</span>
                      <span className="storeCheckout__itemQty">x{item.qty || item.quantity}</span>
                      {item.extras && item.extras.length > 0 && (
                        <span className="storeCheckout__itemExtras">
                          +{item.extras.map(e => e.name).join(', ')}
                        </span>
                      )}
                    </div>
                    <span className="storeCheckout__itemPrice">
                      {formatPrice(item.lineTotal || item.totalPrice)}
                    </span>
                  </div>
                ))}
                <div className="storeCheckout__total">
                  <span>Total</span>
                  <span>{formatPrice(total)}</span>
                </div>
              </div>
            </div>

            {step === 1 ? (
              /* Step 1: Datos del cliente */
              <div className="storeCheckout__section">
                <h3 className="storeCheckout__sectionTitle">
                  <span></span> Tus Datos
                </h3>
                
                <div className="storeCheckout__field">
                  <label className="storeCheckout__label">Nombre *</label>
                  <input
                    type="text"
                    className="storeCheckout__input"
                    placeholder="Tu nombre completo"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    required
                  />
                </div>

                <div className="storeCheckout__field">
                  <label className="storeCheckout__label">Teléfono/WhatsApp *</label>
                  <input
                    type="tel"
                    className="storeCheckout__input"
                    placeholder="11 1234-5678"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    required
                  />
                </div>

                <div className="storeCheckout__field">
                  <label className="storeCheckout__label">Dirección de entrega</label>
                  <input
                    type="text"
                    className="storeCheckout__input"
                    placeholder="Calle, número, piso, depto"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                  />
                </div>

                <div className="storeCheckout__field">
                  <label className="storeCheckout__label">Notas adicionales</label>
                  <textarea
                    className="storeCheckout__input storeCheckout__input--textarea"
                    placeholder="Instrucciones especiales, alergias, etc."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              /* Step 2: Método de pago */
              <div className="storeCheckout__section">
                <h3 className="storeCheckout__sectionTitle">
                  <span></span> ¿Cómo vas a pagar?
                </h3>

                <div className="storeCheckout__paymentMethods">
                  {/* MercadoPago */}
                  <div
                    className={`storeCheckout__paymentOption ${paymentMethod === 'mercadopago' ? 'storeCheckout__paymentOption--selected' : ''} ${!mpConfigured ? 'storeCheckout__paymentOption--disabled' : ''}`}
                    onClick={() => mpConfigured && setPaymentMethod('mercadopago')}
                  >
                    <div className="storeCheckout__paymentRadio" />
                    <span className="storeCheckout__paymentIcon"></span>
                    <div className="storeCheckout__paymentInfo">
                      <h4>
                        MercadoPago
                        <span className="storeCheckout__mpBadge">Recomendado</span>
                      </h4>
                      <p>
                        {mpConfigured 
                          ? 'Transferencia, efectivo en puntos de pago'
                          : 'No disponible en esta tienda'
                        }
                      </p>
                    </div>
                  </div>

                  {/* Efectivo */}
                  <div
                    className={`storeCheckout__paymentOption ${paymentMethod === 'cash' ? 'storeCheckout__paymentOption--selected' : ''}`}
                    onClick={() => setPaymentMethod('cash')}
                  >
                    <div className="storeCheckout__paymentRadio" />
                    <span className="storeCheckout__paymentIcon"></span>
                    <div className="storeCheckout__paymentInfo">
                      <h4>Efectivo</h4>
                      <p>Pago al recibir el pedido</p>
                    </div>
                  </div>
                </div>

                <div className="storeCheckout__deliveryInfo">
                  <span className="storeCheckout__deliveryIcon"><MapPin size={18} /></span>
                  <p className="storeCheckout__deliveryText">
                    Te contactaremos al <strong>{customerPhone}</strong> para confirmar tu pedido y coordinar la entrega.
                  </p>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="storeCheckout__error">
                <span><AlertTriangle size={18} /></span>
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="storeCheckout__actions">
              <button
                type="submit"
                className={`storeCheckout__submitBtn ${paymentMethod === 'mercadopago' && step === 2 ? 'storeCheckout__submitBtn--mp' : ''}`}
                disabled={loading}
              >>
                {step === 1 ? (
                  <>Continuar</>
                ) : paymentMethod === 'mercadopago' ? (
                  <><Lock size={16} /> Pagar con MercadoPago</>
                ) : (
                  <><Check size={16} /> Confirmar Pedido</>
                )}
              </button>
              
              {step === 2 && (
                <button
                  type="button"
                  className="storeCheckout__submitBtn"
                  style={{ background: 'transparent', color: '#6b7280', marginTop: '0.5rem' }}
                  onClick={handleBack}
                >
                  ← Volver
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
