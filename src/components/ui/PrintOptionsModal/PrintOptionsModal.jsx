import React from 'react';
import { Printer, ChefHat, Receipt, FileStack, ChevronRight, X } from 'lucide-react';
import { printKitchenTicket, printClientTicket, printCombinedTicket } from '../../../lib/ticketPrinter';
import './PrintOptionsModal.css';

/**
 * Modal para seleccionar tipo de impresión de ticket
 * @param {Object} props
 * @param {Object} props.order - El pedido a imprimir
 * @param {Object} props.tenant - Datos del comercio
 * @param {boolean} props.isPaid - Si el pedido está pagado
 * @param {Function} props.onClose - Función para cerrar el modal
 */
export default function PrintOptionsModal({ order, tenant, isPaid = false, onClose }) {
  const handlePrint = (type) => {
    if (!order) return;
    
    const options = {
      isPaid,
      thankYouMessage: tenant?.ticket_message || '¡Gracias por tu compra!'
    };
    
    switch (type) {
      case 'kitchen':
        printKitchenTicket(order);
        break;
      case 'client':
        printClientTicket(order, tenant, options);
        break;
      case 'both':
        printCombinedTicket(order, tenant, options);
        break;
      default:
        break;
    }
    
    onClose();
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="printModal__overlay" onClick={handleOverlayClick}>
      <div className="printModal">
        <div className="printModal__header">
          <div className="printModal__icon">
            <Printer size={28} />
          </div>
          <h3 className="printModal__title">Imprimir Ticket</h3>
          <p className="printModal__subtitle">
            Pedido #{order?.id?.slice(-6).toUpperCase() || '------'}
          </p>
        </div>

        <div className="printModal__options">
          <button 
            className="printModal__option"
            onClick={() => handlePrint('kitchen')}
          >
            <div className="printModal__optionIcon printModal__optionIcon--kitchen">
              <ChefHat size={22} />
            </div>
            <div className="printModal__optionText">
              <div className="printModal__optionTitle">Solo Cocina</div>
              <div className="printModal__optionDesc">Comanda sin precios para preparación</div>
            </div>
            <ChevronRight size={20} className="printModal__optionArrow" />
          </button>

          <button 
            className="printModal__option"
            onClick={() => handlePrint('client')}
          >
            <div className="printModal__optionIcon printModal__optionIcon--client">
              <Receipt size={22} />
            </div>
            <div className="printModal__optionText">
              <div className="printModal__optionTitle">Solo Cliente</div>
              <div className="printModal__optionDesc">Ticket con precios y detalle de pago</div>
            </div>
            <ChevronRight size={20} className="printModal__optionArrow" />
          </button>

          <button 
            className="printModal__option"
            onClick={() => handlePrint('both')}
          >
            <div className="printModal__optionIcon printModal__optionIcon--both">
              <FileStack size={22} />
            </div>
            <div className="printModal__optionText">
              <div className="printModal__optionTitle">Ambos Tickets</div>
              <div className="printModal__optionDesc">Imprimir cocina y cliente juntos</div>
            </div>
            <ChevronRight size={20} className="printModal__optionArrow" />
          </button>
        </div>

        <button className="printModal__cancel" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
