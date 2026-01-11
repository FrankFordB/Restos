/**
 * Sistema de Impresión de Tickets
 * Soporta impresoras térmicas de 80mm y PDF
 * 
 * Dos tipos de tickets:
 * 1. Ticket de Cocina (Comanda): Para uso interno, sin precios
 * 2. Ticket de Cliente: Comprobante con precios y datos fiscales
 */

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const TICKET_CONFIG = {
  // Ancho del ticket en mm (80mm es estándar para impresoras térmicas)
  width: '80mm',
  // Moneda
  currency: '$',
  // Mensaje de agradecimiento por defecto
  defaultThankYouMessage: '¡Gracias por tu compra!',
  // Prioridades
  priorities: {
    normal: { label: 'Normal', color: '#333' },
    urgent: { label: '⚡ URGENTE', color: '#dc2626' }
  }
}

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Formatea fecha a formato argentino
 */
function formatDateTime(date) {
  const d = new Date(date)
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Formatea solo hora
 */
function formatTime(date) {
  const d = new Date(date)
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Genera número de pedido corto
 */
function getOrderNumber(orderId) {
  return orderId?.slice(0, 8).toUpperCase() || 'N/A'
}

/**
 * Obtiene etiqueta de tipo de entrega
 */
function getDeliveryTypeLabel(type) {
  const labels = {
    mostrador: 'MOSTRADOR',
    domicilio: 'DELIVERY',
    mesa: 'MESA',
  }
  return labels[type] || type?.toUpperCase() || 'N/A'
}

/**
 * Obtiene etiqueta de método de pago
 */
function getPaymentMethodLabel(method) {
  const labels = {
    efectivo: 'Efectivo',
    tarjeta: 'Tarjeta',
    qr: 'QR / Mercado Pago',
    transferencia: 'Transferencia',
  }
  return labels[method] || method || 'N/A'
}

/**
 * Obtiene etiqueta de estado
 */
function getStatusLabel(status) {
  const labels = {
    pending: 'Pendiente',
    in_progress: 'En Preparación',
    completed: 'Completado',
    cancelled: 'Cancelado',
  }
  return labels[status] || status || 'N/A'
}

// ============================================================================
// ESTILOS BASE PARA IMPRESIÓN TÉRMICA
// Papel estándar: 80mm (302.36px a 96dpi) o 58mm (219.21px a 96dpi)
// Usamos 80mm como estándar, el más común en restaurantes
// ============================================================================

const baseStyles = `
  @page {
    size: 80mm auto;
    margin: 0;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { 
    width: 80mm;
    max-width: 80mm;
    margin: 0 auto;
    padding: 0;
  }
  body { 
    font-family: 'Courier New', Courier, monospace; 
    font-size: 12px;
    width: 80mm;
    max-width: 80mm;
    padding: 3mm;
    background: white;
    color: #000;
    margin: 0 auto;
  }
  .ticket { 
    width: 100%; 
    max-width: 74mm;
    margin: 0 auto;
  }
  .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
  .header h1 { font-size: 18px; font-weight: bold; margin-bottom: 4px; }
  .header h2 { font-size: 14px; font-weight: bold; margin-bottom: 4px; }
  .header .order-number { font-size: 24px; font-weight: bold; letter-spacing: 2px; }
  .header .datetime { font-size: 11px; color: #333; }
  
  .section { margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px dashed #ccc; }
  .section:last-child { border-bottom: none; }
  .section-title { font-weight: bold; font-size: 12px; margin-bottom: 4px; text-transform: uppercase; }
  
  .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
  .label { font-weight: bold; }
  .value { text-align: right; }
  
  .items { margin: 8px 0; }
  .item { margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px dotted #ddd; }
  .item:last-child { border-bottom: none; }
  .item-header { display: flex; justify-content: space-between; font-weight: bold; }
  .item-qty { font-size: 16px; font-weight: bold; min-width: 30px; }
  .item-name { flex: 1; font-size: 13px; }
  .item-price { font-size: 12px; text-align: right; min-width: 60px; }
  
  .item-mods { padding-left: 15px; margin-top: 4px; font-size: 11px; color: #555; }
  .item-mod { margin-bottom: 2px; }
  .mod-warning { color: #dc2626; font-weight: bold; }
  .mod-note { font-style: italic; font-size: 12px; color: #333; font-weight: 500; }
  
  .extras { padding-left: 15px; margin-top: 4px; }
  .extra { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px; }
  .extra-name { color: #555; }
  .extra-price { color: #16a34a; }
  
  .totals { border-top: 2px solid #000; padding-top: 8px; margin-top: 8px; }
  .total-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
  .total-row.grand-total { font-size: 16px; font-weight: bold; border-top: 1px solid #000; padding-top: 6px; margin-top: 6px; }
  
  .footer { text-align: center; margin-top: 12px; padding-top: 8px; border-top: 2px dashed #000; font-size: 10px; color: #666; }
  .footer p { margin-bottom: 4px; }
  
  .urgent { background: #fef2f2; border: 2px solid #dc2626; padding: 4px; margin-bottom: 8px; text-align: center; }
  .urgent-text { color: #dc2626; font-weight: bold; font-size: 14px; }
  
  .delivery-info { background: #f0f9ff; border: 1px solid #0ea5e9; padding: 6px; margin-bottom: 8px; }
  .table-info { background: #fef3c7; border: 1px solid #f59e0b; padding: 6px; margin-bottom: 8px; text-align: center; }
  .table-number { font-size: 20px; font-weight: bold; }
  
  .notes { background: #fefce8; border: 1px dashed #eab308; padding: 6px; margin-top: 8px; font-style: italic; }
  
  .separator { border-bottom: 2px dashed #000; margin: 8px 0; }
  .cut-line { border-bottom: 1px dashed #999; margin: 16px 0; position: relative; }
  .cut-line::after { content: '✂'; position: absolute; left: 50%; transform: translateX(-50%); top: -8px; background: white; padding: 0 4px; }
  
  @media print {
    @page {
      size: 80mm auto;
      margin: 0;
    }
    html, body { 
      width: 80mm !important;
      max-width: 80mm !important;
      margin: 0 auto !important;
      padding: 2mm !important;
    }
    .ticket {
      width: 100% !important;
      max-width: 76mm !important;
      margin: 0 auto !important;
    }
    .no-print { display: none !important; }
  }
`

// ============================================================================
// TICKET DE COCINA (COMANDA)
// ============================================================================

/**
 * Genera HTML para el ticket de cocina
 * NO incluye precios, solo información de preparación
 * 
 * @param {Object} order - Objeto del pedido
 * @param {Object} options - Opciones adicionales
 * @param {string} options.priority - 'normal' | 'urgent'
 * @param {string} options.staffName - Nombre del mozo/cajero
 * @returns {string} HTML del ticket
 */
export function generateKitchenTicketHTML(order, options = {}) {
  const {
    priority = 'normal',
    staffName = ''
  } = options

  const orderNumber = getOrderNumber(order.id)
  const deliveryType = getDeliveryTypeLabel(order.delivery_type)
  const isUrgent = priority === 'urgent'
  const isDelivery = order.delivery_type === 'domicilio'
  const isTable = order.delivery_type === 'mesa'

  // Generar HTML de items
  const itemsHTML = order.items?.map(item => {
    const name = item.product_name || item.name || 'Producto'
    const qty = item.quantity || item.qty || 1
    
    // Modificaciones y notas
    let modsHTML = ''
    
    // Extras como modificaciones
    if (item.extras && item.extras.length > 0) {
      const extrasItems = item.extras.map(extra => {
        const extraQty = extra.quantity > 1 ? `x${extra.quantity}` : ''
        return `<div class="item-mod">+ ${extra.name} ${extraQty}</div>`
      }).join('')
      modsHTML += extrasItems
    }
    
    // Notas especiales del producto
    if (item.notes || item.special_notes) {
      modsHTML += `<div class="item-mod mod-note">📝 ${item.notes || item.special_notes}</div>`
    }
    
    // Comentario del cliente para este item
    if (item.comment && item.comment.trim()) {
      modsHTML += `<div class="item-mod mod-note">💬 ${item.comment}</div>`
    }
    
    // Alergias o restricciones
    if (item.allergens) {
      modsHTML += `<div class="item-mod mod-warning">⚠️ ALERGIAS: ${item.allergens}</div>`
    }
    
    if (item.no_tacc) {
      modsHTML += `<div class="item-mod mod-warning">⚠️ SIN TACC</div>`
    }

    return `
      <div class="item">
        <div class="item-header">
          <span class="item-qty">${qty}x</span>
          <span class="item-name">${name}</span>
        </div>
        ${modsHTML ? `<div class="item-mods">${modsHTML}</div>` : ''}
      </div>
    `
  }).join('') || ''

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Comanda #${orderNumber}</title>
      <meta charset="UTF-8">
      <style>${baseStyles}</style>
    </head>
    <body>
      <div class="ticket">
        <!-- Header -->
        <div class="header">
          <h1>🍳 COCINA</h1>
          <div class="order-number">#${orderNumber}</div>
          <div class="datetime">${formatDateTime(order.created_at)}</div>
        </div>

        <!-- Urgente -->
        ${isUrgent ? `
          <div class="urgent">
            <span class="urgent-text">⚡ PEDIDO URGENTE ⚡</span>
          </div>
        ` : ''}

        <!-- Tipo de Servicio -->
        <div class="section">
          <div class="row">
            <span class="label">SERVICIO:</span>
            <span class="value" style="font-size: 14px; font-weight: bold;">${deliveryType}</span>
          </div>
          ${staffName ? `
            <div class="row">
              <span class="label">ATENDIDO POR:</span>
              <span class="value">${staffName}</span>
            </div>
          ` : ''}
        </div>

        <!-- Mesa -->
        ${isTable && order.table_number ? `
          <div class="table-info">
            <div>MESA</div>
            <div class="table-number">${order.table_number}</div>
          </div>
        ` : ''}

        <!-- Cliente (solo nombre para identificar) -->
        ${order.customer_name ? `
          <div class="section">
            <div class="row">
              <span class="label">CLIENTE:</span>
              <span class="value">${order.customer_name}</span>
            </div>
          </div>
        ` : ''}

        <div class="separator"></div>

        <!-- Productos -->
        <div class="section">
          <div class="section-title">📋 PEDIDO</div>
          <div class="items">
            ${itemsHTML}
          </div>
        </div>

        <!-- Notas internas para cocina (destacadas) -->
        ${order.internal_notes && order.internal_notes.trim() ? `
          <div style="background: #fef3c7; border: 2px solid #f59e0b; padding: 10px; margin: 10px 0; border-radius: 4px;">
            <div style="font-weight: bold; font-size: 14px; margin-bottom: 6px; color: #92400e;">⚠️ NOTA IMPORTANTE:</div>
            <div style="font-size: 14px; font-weight: 500; color: #78350f; line-height: 1.4;">${order.internal_notes}</div>
          </div>
        ` : ''}

        <!-- Notas generales del pedido -->
        ${order.notes || order.customer_notes ? `
          <div class="notes">
            <strong>📝 NOTAS:</strong> ${order.notes || order.customer_notes}
          </div>
        ` : ''}

        <!-- Footer -->
        <div class="footer">
          <p>Impreso: ${formatTime(new Date())}</p>
        </div>
      </div>
    </body>
    </html>
  `

  return html
}

// ============================================================================
// TICKET DE CLIENTE
// ============================================================================

/**
 * Genera HTML para el ticket del cliente
 * Incluye precios, datos del restaurante y comprobante de pago
 * 
 * @param {Object} order - Objeto del pedido
 * @param {Object} tenant - Datos del restaurante
 * @param {Object} options - Opciones adicionales
 * @returns {string} HTML del ticket
 */
export function generateClientTicketHTML(order, tenant = {}, options = {}) {
  const {
    showQR = false,
    thankYouMessage = TICKET_CONFIG.defaultThankYouMessage,
    staffName = '',
    isPaid = null // Si es null, se usa el valor del order
  } = options

  const orderNumber = getOrderNumber(order.id)
  const deliveryType = getDeliveryTypeLabel(order.delivery_type)
  const paymentMethod = getPaymentMethodLabel(order.payment_method)
  const isDelivery = order.delivery_type === 'domicilio'

  // Calcular totales
  let subtotal = 0
  const itemsHTML = order.items?.map(item => {
    const name = item.product_name || item.name || 'Producto'
    const qty = item.quantity || item.qty || 1
    const price = Number(item.price || item.unit_price || 0)
    const itemSubtotal = price * qty
    subtotal += itemSubtotal
    
    // Extras
    let extrasHTML = ''
    let extrasTotal = 0
    if (item.extras && item.extras.length > 0) {
      const extrasItems = item.extras.map(extra => {
        const extraPrice = Number(extra.price || 0) * (extra.quantity || 1)
        extrasTotal += extraPrice
        subtotal += extraPrice
        const extraQty = extra.quantity > 1 ? `x${extra.quantity}` : ''
        return `
          <div class="extra">
            <span class="extra-name">+ ${extra.name} ${extraQty}</span>
            <span class="extra-price">+$${extraPrice.toFixed(2)}</span>
          </div>
        `
      }).join('')
      extrasHTML = `<div class="extras">${extrasItems}</div>`
    }
    
    // Comentario del cliente
    let commentHTML = ''
    if (item.comment && item.comment.trim()) {
      commentHTML = `<div class="item-comment" style="font-size: 12px; color: #333; font-style: italic; font-weight: 500; padding-left: 20px; margin-top: 3px;">💬 ${item.comment}</div>`
    }

    return `
      <div class="item">
        <div class="item-header">
          <span class="item-qty">${qty}x</span>
          <span class="item-name">${name}</span>
          <span class="item-price">$${itemSubtotal.toFixed(2)}</span>
        </div>
        ${extrasHTML}
        ${commentHTML}
      </div>
    `
  }).join('') || ''

  // Calcular envío y total
  const deliveryCost = Number(order.delivery_cost || order.shipping_cost || 0)
  const discount = Number(order.discount || 0)
  const total = Number(order.total || (subtotal + deliveryCost - discount))

  // Estado del pago - priorizar isPaid de options si está definido
  const paymentConfirmed = isPaid !== null ? isPaid : (order.payment_status === 'approved' || order.is_paid === true)
  const paymentStatusText = paymentConfirmed ? '✅ PAGADO' : '⏳ Pendiente de pago'
  const paymentStatusColor = paymentConfirmed ? '#16a34a' : '#f59e0b'

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Ticket #${orderNumber}</title>
      <meta charset="UTF-8">
      <style>
        ${baseStyles}
        .restaurant-name { font-size: 16px; font-weight: bold; }
        .restaurant-info { font-size: 10px; color: #666; margin-top: 4px; }
        .payment-status { 
          text-align: center; 
          padding: 6px; 
          margin: 8px 0; 
          border-radius: 4px;
          font-weight: bold;
        }
        .thank-you { 
          text-align: center; 
          font-size: 13px; 
          padding: 8px; 
          margin-top: 8px;
          background: #f0fdf4;
          border-radius: 4px;
        }
      </style>
    </head>
    <body>
      <div class="ticket">
        <!-- Header con datos del restaurante -->
        <div class="header">
          ${tenant.logo ? `<img src="${tenant.logo}" alt="Logo" style="max-width: 60px; max-height: 60px; margin-bottom: 8px;">` : ''}
          <div class="restaurant-name">${tenant.name || 'Restaurante'}</div>
          ${tenant.address ? `<div class="restaurant-info">📍 ${tenant.address}</div>` : ''}
          ${tenant.phone ? `<div class="restaurant-info">📞 ${tenant.phone}</div>` : ''}
          ${tenant.cuit ? `<div class="restaurant-info">CUIT: ${tenant.cuit}</div>` : ''}
          <div style="margin-top: 8px;">
            <div class="order-number">#${orderNumber}</div>
            <div class="datetime">${formatDateTime(order.created_at)}</div>
          </div>
        </div>

        <!-- Tipo de entrega -->
        <div class="section">
          <div class="row">
            <span class="label">Tipo:</span>
            <span class="value">${deliveryType}</span>
          </div>
          ${staffName ? `
            <div class="row">
              <span class="label">Atendido por:</span>
              <span class="value">${staffName}</span>
            </div>
          ` : ''}
        </div>

        <!-- Datos del cliente -->
        <div class="section">
          <div class="section-title">Cliente</div>
          <div class="row">
            <span class="label">Nombre:</span>
            <span class="value">${order.customer_name || 'N/A'}</span>
          </div>
          ${order.customer_phone ? `
            <div class="row">
              <span class="label">Teléfono:</span>
              <span class="value">${order.customer_phone}</span>
            </div>
          ` : ''}
          ${isDelivery && order.delivery_address ? `
            <div class="row">
              <span class="label">Dirección:</span>
              <span class="value" style="font-size: 11px;">${order.delivery_address}</span>
            </div>
          ` : ''}
        </div>

        <div class="separator"></div>

        <!-- Detalle de productos -->
        <div class="section">
          <div class="section-title">Detalle de consumo</div>
          <div class="items">
            ${itemsHTML}
          </div>
        </div>

        <!-- Notas especiales (si las hay) -->
        ${order.internal_notes && order.internal_notes.trim() ? `
          <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 8px; margin: 8px 0; border-radius: 4px; font-size: 11px;">
            <strong>📝 Nota:</strong> ${order.internal_notes}
          </div>
        ` : ''}

        <!-- Totales -->
        <div class="totals">
          <div class="total-row">
            <span>Subtotal:</span>
            <span>$${subtotal.toFixed(2)}</span>
          </div>
          ${deliveryCost > 0 ? `
            <div class="total-row">
              <span>Envío:</span>
              <span>$${deliveryCost.toFixed(2)}</span>
            </div>
          ` : ''}
          ${discount > 0 ? `
            <div class="total-row">
              <span>Descuento:</span>
              <span>-$${discount.toFixed(2)}</span>
            </div>
          ` : ''}
          <div class="total-row grand-total">
            <span>TOTAL:</span>
            <span>$${total.toFixed(2)}</span>
          </div>
        </div>

        <!-- Método de pago -->
        <div class="section">
          <div class="row">
            <span class="label">Método de pago:</span>
            <span class="value">${paymentMethod}</span>
          </div>
          <div class="payment-status" style="background: ${paymentStatusColor}15; color: ${paymentStatusColor}; border: 1px solid ${paymentStatusColor};">
            ${paymentStatusText}
          </div>
        </div>

        <!-- Mensaje de agradecimiento -->
        ${thankYouMessage ? `
          <div class="thank-you">
            ${thankYouMessage}
          </div>
        ` : ''}

        <!-- Footer -->
        <div class="footer">
          <p>Ticket #${orderNumber}</p>
          <p>Impreso: ${formatDateTime(new Date())}</p>
          <p style="font-size: 9px; margin-top: 4px;">Este ticket no es válido como factura</p>
        </div>
      </div>
    </body>
    </html>
  `

  return html
}

// ============================================================================
// FUNCIONES DE IMPRESIÓN
// ============================================================================

/**
 * Imprime un HTML en una ventana nueva
 * @param {string} html - HTML a imprimir
 * @param {string} title - Título de la ventana
 */
function printHTML(html, title = 'Ticket') {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    console.error('No se pudo abrir la ventana de impresión. ¿Está bloqueado el popup?')
    alert('No se pudo abrir la ventana de impresión. Por favor, permite los popups para este sitio.')
    return false
  }
  
  printWindow.document.write(html)
  printWindow.document.close()
  
  // Variable para evitar doble impresión
  let hasPrinted = false
  
  const doPrint = () => {
    if (hasPrinted) return
    hasPrinted = true
    printWindow.focus()
    printWindow.print()
  }
  
  // Esperar a que cargue el contenido antes de imprimir
  printWindow.onload = () => {
    setTimeout(doPrint, 100)
  }
  
  // Fallback por si onload no se dispara (algunos navegadores)
  setTimeout(() => {
    if (!hasPrinted) {
      doPrint()
    }
  }, 500)
  
  return true
}

/**
 * Imprime solo el ticket de cocina
 * @param {Object} order - Pedido
 * @param {Object} options - Opciones
 */
export function printKitchenTicket(order, options = {}) {
  const html = generateKitchenTicketHTML(order, options)
  return printHTML(html, `Comanda #${getOrderNumber(order.id)}`)
}

/**
 * Imprime solo el ticket del cliente
 * @param {Object} order - Pedido
 * @param {Object} tenant - Datos del restaurante
 * @param {Object} options - Opciones
 */
export function printClientTicket(order, tenant = {}, options = {}) {
  const html = generateClientTicketHTML(order, tenant, options)
  return printHTML(html, `Ticket #${getOrderNumber(order.id)}`)
}

/**
 * Imprime ambos tickets (cocina y cliente)
 * @param {Object} order - Pedido
 * @param {Object} tenant - Datos del restaurante
 * @param {Object} options - Opciones adicionales
 */
export function printBothTickets(order, tenant = {}, options = {}) {
  const { priority = 'normal', staffName = '' } = options
  
  // Imprimir ticket de cocina
  printKitchenTicket(order, { priority, staffName })
  
  // Pequeño delay para que no se bloqueen las ventanas
  setTimeout(() => {
    // Imprimir ticket de cliente
    printClientTicket(order, tenant, options)
  }, 800)
  
  return true
}

/**
 * Genera ambos tickets combinados en un solo documento (con línea de corte)
 * Útil si solo hay una impresora
 * @param {Object} order - Pedido
 * @param {Object} tenant - Datos del restaurante
 * @param {Object} options - Opciones
 */
export function printCombinedTicket(order, tenant = {}, options = {}) {
  const { priority = 'normal', staffName = '', thankYouMessage, isPaid } = options
  
  // Generar ambos tickets
  const kitchenHTML = generateKitchenTicketHTML(order, { priority, staffName })
  const clientHTML = generateClientTicketHTML(order, tenant, { staffName, thankYouMessage, isPaid })
  
  // Extraer solo el contenido del body de cada ticket
  const extractBody = (html) => {
    const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
    return match ? match[1] : ''
  }
  
  const combinedHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Tickets #${getOrderNumber(order.id)}</title>
      <meta charset="UTF-8">
      <style>
        ${baseStyles}
        .cut-line { 
          border: none;
          border-top: 2px dashed #999; 
          margin: 20px 0; 
          position: relative;
          page-break-after: always;
        }
        .cut-label {
          text-align: center;
          color: #999;
          font-size: 10px;
          margin: 4px 0;
        }
        .ticket-section { margin-bottom: 10px; }
        @media print {
          .cut-line { page-break-after: always; }
        }
      </style>
    </head>
    <body>
      <!-- Ticket Cocina -->
      <div class="ticket-section">
        ${extractBody(kitchenHTML)}
      </div>
      
      <!-- Línea de corte -->
      <div class="cut-label">✂ - - - - - - - - - - - - - - - - - - - - - - - ✂</div>
      <div class="cut-line"></div>
      
      <!-- Ticket Cliente -->
      <div class="ticket-section">
        ${extractBody(clientHTML)}
      </div>
    </body>
    </html>
  `
  
  return printHTML(combinedHTML, `Tickets #${getOrderNumber(order.id)}`)
}

// ============================================================================
// EXPORTAR UTILIDADES
// ============================================================================

export {
  formatDateTime,
  formatTime,
  getOrderNumber,
  getDeliveryTypeLabel,
  getPaymentMethodLabel,
  getStatusLabel,
  TICKET_CONFIG
}

export default {
  printKitchenTicket,
  printClientTicket,
  printBothTickets,
  printCombinedTicket,
  generateKitchenTicketHTML,
  generateClientTicketHTML
}
