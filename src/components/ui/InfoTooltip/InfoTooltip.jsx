import { useState, useRef, useEffect } from 'react'
import { Info } from 'lucide-react'
import './InfoTooltip.css'

/**
 * Componente de icono informativo con tooltip flotante
 * @param {string} text - Texto a mostrar en el tooltip
 * @param {string} position - Posición del tooltip: 'top', 'bottom', 'left', 'right' (default: 'right')
 * @param {number} size - Tamaño del icono (default: 14)
 * @param {string} className - Clase CSS adicional
 */
export default function InfoTooltip({ 
  text, 
  position = 'right', 
  size = 14, 
  className = '' 
}) {
  const [isVisible, setIsVisible] = useState(false)
  const [adjustedPosition, setAdjustedPosition] = useState(position)
  const tooltipRef = useRef(null)
  const containerRef = useRef(null)

  // Ajustar posición si el tooltip se sale de la pantalla
  useEffect(() => {
    if (isVisible && tooltipRef.current && containerRef.current) {
      const tooltipRect = tooltipRef.current.getBoundingClientRect()
      const containerRect = containerRef.current.getBoundingClientRect()
      
      let newPosition = position
      
      // Verificar si se sale por la derecha
      if (position === 'right' && tooltipRect.right > window.innerWidth - 10) {
        newPosition = 'left'
      }
      // Verificar si se sale por la izquierda
      if (position === 'left' && tooltipRect.left < 10) {
        newPosition = 'right'
      }
      // Verificar si se sale por arriba
      if (position === 'top' && tooltipRect.top < 10) {
        newPosition = 'bottom'
      }
      // Verificar si se sale por abajo
      if (position === 'bottom' && tooltipRect.bottom > window.innerHeight - 10) {
        newPosition = 'top'
      }
      
      setAdjustedPosition(newPosition)
    }
  }, [isVisible, position])

  return (
    <div 
      ref={containerRef}
      className={`infoTooltip ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
      tabIndex={0}
      role="button"
      aria-label="Información"
    >
      <Info size={size} className="infoTooltip__icon" />
      
      {isVisible && text && (
        <div 
          ref={tooltipRef}
          className={`infoTooltip__popup infoTooltip__popup--${adjustedPosition}`}
          role="tooltip"
        >
          <div className="infoTooltip__content">
            {text}
          </div>
          <div className="infoTooltip__arrow" />
        </div>
      )}
    </div>
  )
}
