import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Cropper from 'react-easy-crop'
import {
  X,
  ZoomIn,
  ZoomOut,
  Check,
  RefreshCw,
  Maximize,
} from 'lucide-react'
import './ImageEditorModal.css'

/**
 * Modal de edicion de imagen con react-easy-crop.
 *
 * Props:
 * - isOpen        : boolean
 * - onClose       : () => void
 * - onConfirm     : (focalPoint: { x: number, y: number }, file?: File) => void
 * - imageSrc      : string (base64 data-url o URL remota)
 * - imageFile     : File (opcional, el archivo original para devolver en confirm)
 * - aspect        : number (ancho/alto, default 1)
 * - title         : string
 */
export default function ImageEditorModal({
  isOpen,
  onClose,
  onConfirm,
  imageSrc,
  imageFile = null,
  aspect = 1,
  title = 'Editar imagen',
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  // Inicializar con un valor por defecto para que el botón confirmar funcione
  // incluso si onCropComplete no se dispara inmediatamente
  const [croppedAreaPercent, setCroppedAreaPercent] = useState({ x: 0, y: 0, width: 100, height: 100 })

  // Aspecto libre vs fijo
  const [freeAspect, setFreeAspect] = useState(false)
  const [currentAspect, setCurrentAspect] = useState(aspect)

  // Ref para cerrar con Escape
  const modalRef = useRef(null)

  // Reset al abrir con nueva imagen
  useEffect(() => {
    if (isOpen && imageSrc) {
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setCroppedAreaPercent({ x: 0, y: 0, width: 100, height: 100 })
      setFreeAspect(false)
      setCurrentAspect(aspect)
    }
  }, [isOpen, imageSrc, aspect])

  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  const onCropComplete = useCallback((croppedArea) => {
    setCroppedAreaPercent(croppedArea)
  }, [])

  const handleReset = () => {
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setFreeAspect(false)
    setCurrentAspect(aspect)
  }

  const setAspectPreset = (value) => {
    setFreeAspect(false)
    setCurrentAspect(value)
  }

  const toggleFreeAspect = () => {
    const next = !freeAspect
    setFreeAspect(next)
    setCurrentAspect(next ? undefined : aspect)
  }

  const handleConfirm = () => {
    console.log('[ImageEditorModal] handleConfirm llamado, croppedAreaPercent:', croppedAreaPercent)
    if (!croppedAreaPercent) {
      console.log('[ImageEditorModal] No hay croppedAreaPercent, abortando')
      return
    }
    // Calcular punto focal (centro del área de recorte en porcentajes)
    const focalPoint = {
      x: Math.round(croppedAreaPercent.x + croppedAreaPercent.width / 2),
      y: Math.round(croppedAreaPercent.y + croppedAreaPercent.height / 2),
    }
    console.log('[ImageEditorModal] Focal point calculado:', focalPoint, 'imageFile:', imageFile?.name)
    onConfirm(focalPoint, imageFile)
  }

  if (!isOpen || !imageSrc) return null

  // Detectar aspecto activo para estilos
  const isAspectActive = (val) =>
    !freeAspect && Math.abs((currentAspect || 0) - val) < 0.01

  return createPortal(
    <div
      className="imageEditor__overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="imageEditor__modal"
        ref={modalRef}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="imageEditor__header">
          <h3>{title}</h3>
          <button
            className="imageEditor__closeBtn"
            onClick={onClose}
            type="button"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Crop area */}
        <div className="imageEditor__cropContainer">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={currentAspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            objectFit="contain"
            showGrid
            restrictPosition={false}
          />
        </div>

        {/* Aspect ratio presets */}
        <div className="imageEditor__aspectRow">
          <button
            type="button"
            className={`imageEditor__aspectBtn ${isAspectActive(1) ? 'imageEditor__aspectBtn--active' : ''}`}
            onClick={() => setAspectPreset(1)}
          >
            1:1
          </button>
          <button
            type="button"
            className={`imageEditor__aspectBtn ${isAspectActive(16 / 9) ? 'imageEditor__aspectBtn--active' : ''}`}
            onClick={() => setAspectPreset(16 / 9)}
          >
            16:9
          </button>
          <button
            type="button"
            className={`imageEditor__aspectBtn ${isAspectActive(4 / 3) ? 'imageEditor__aspectBtn--active' : ''}`}
            onClick={() => setAspectPreset(4 / 3)}
          >
            4:3
          </button>
          <button
            type="button"
            className={`imageEditor__aspectBtn ${isAspectActive(9 / 16) ? 'imageEditor__aspectBtn--active' : ''}`}
            onClick={() => setAspectPreset(9 / 16)}
          >
            9:16
          </button>
          <button
            type="button"
            className={`imageEditor__aspectBtn ${freeAspect ? 'imageEditor__aspectBtn--active' : ''}`}
            onClick={toggleFreeAspect}
            title="Recorte libre"
          >
            <Maximize size={14} />
            Libre
          </button>
        </div>

        {/* Zoom + rotation controls */}
        <div className="imageEditor__controls">
          <div className="imageEditor__slider">
            <button
              type="button"
              className="imageEditor__iconBtn"
              onClick={() => setZoom((z) => Math.max(1, z - 0.1))}
              title="Alejar"
            >
              <ZoomOut size={18} />
            </button>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="imageEditor__range"
            />
            <button
              type="button"
              className="imageEditor__iconBtn"
              onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
              title="Acercar"
            >
              <ZoomIn size={18} />
            </button>
            <span className="imageEditor__zoomValue">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          <div className="imageEditor__rotationBtns">
            <button
              type="button"
              className="imageEditor__iconBtn"
              onClick={handleReset}
              title="Resetear"
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="imageEditor__actions">
          <button
            className="imageEditor__cancelBtn"
            onClick={onClose}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="imageEditor__confirmBtn"
            onClick={handleConfirm}
            disabled={!croppedAreaPercent}
            type="button"
          >
            <Check size={16} />
            Confirmar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
