import { useState, useRef, useCallback, useEffect } from 'react'
import './ImageCropperModal.css'
import Button from '../Button/Button'
import { 
  X, ZoomIn, ZoomOut, RotateCw, RotateCcw, 
  Move, Check, Upload, Link2, Focus, RefreshCw
} from 'lucide-react'

// Componente de ajuste/enfoque de imagen
export default function ImageCropperModal({
  isOpen,
  onClose,
  onCropComplete,
  initialImage = null,
  aspectRatio = null, // null = libre, 1 = cuadrado, 16/9 = panorámico, etc.
  title = 'Ajustar imagen',
  allowUrl = true,
  allowUpload = true,
}) {
  const [imageSrc, setImageSrc] = useState(initialImage)
  const [urlInput, setUrlInput] = useState('')
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 0, height: 0 })
  
  const containerRef = useRef(null)
  const imageRef = useRef(null)
  const fileInputRef = useRef(null)
  const canvasRef = useRef(null)

  // Reset cuando cambia initialImage
  useEffect(() => {
    if (initialImage) {
      setImageSrc(initialImage)
      resetCrop()
    }
  }, [initialImage])

  // Reset cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      if (initialImage) {
        setImageSrc(initialImage)
      }
      resetCrop()
    }
  }, [isOpen, initialImage])

  // Calcular área de recorte basado en aspect ratio
  useEffect(() => {
    if (!containerRef.current) return
    
    const rect = containerRef.current.getBoundingClientRect()
    setContainerSize({ width: rect.width, height: rect.height })
    
    // Calcular área de recorte
    let cropWidth, cropHeight
    if (aspectRatio) {
      if (rect.width / rect.height > aspectRatio) {
        cropHeight = rect.height * 0.8
        cropWidth = cropHeight * aspectRatio
      } else {
        cropWidth = rect.width * 0.8
        cropHeight = cropWidth / aspectRatio
      }
    } else {
      cropWidth = rect.width * 0.8
      cropHeight = rect.height * 0.8
    }
    
    setCropArea({
      x: (rect.width - cropWidth) / 2,
      y: (rect.height - cropHeight) / 2,
      width: cropWidth,
      height: cropHeight,
    })
  }, [aspectRatio, isOpen, imageSrc])

  const resetCrop = () => {
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setRotation(0)
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = () => {
      setImageSrc(reader.result)
      resetCrop()
      setShowUrlInput(false)
    }
    reader.readAsDataURL(file)
  }

  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) return
    
    const url = urlInput.trim()
    
    // Intentar convertir la imagen a base64 para evitar problemas de CORS
    try {
      const response = await fetch(url, { mode: 'cors' })
      const blob = await response.blob()
      const reader = new FileReader()
      reader.onload = () => {
        setImageSrc(reader.result)
        resetCrop()
        setShowUrlInput(false)
        setUrlInput('')
      }
      reader.readAsDataURL(blob)
    } catch (err) {
      // Si falla CORS, usar la URL directamente (el recorte devolverá la URL original)
      console.warn('CORS fetch failed, using URL directly:', err)
      setImageSrc(url)
      resetCrop()
      setShowUrlInput(false)
      setUrlInput('')
    }
  }

  const handleImageLoad = (e) => {
    const img = e.target
    setImageSize({ width: img.naturalWidth, height: img.naturalHeight })
  }

  // Mouse/Touch handlers para arrastrar
  const handleMouseDown = (e) => {
    if (!imageSrc) return
    e.preventDefault()
    setIsDragging(true)
    setDragStart({
      x: e.clientX - crop.x,
      y: e.clientY - crop.y,
    })
  }

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return
    setCrop({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    })
  }, [isDragging, dragStart])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  // Touch handlers
  const handleTouchStart = (e) => {
    if (!imageSrc || e.touches.length !== 1) return
    const touch = e.touches[0]
    setIsDragging(true)
    setDragStart({
      x: touch.clientX - crop.x,
      y: touch.clientY - crop.y,
    })
  }

  const handleTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) return
    const touch = e.touches[0]
    setCrop({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    })
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
  }

  // Zoom con scroll
  const handleWheel = (e) => {
    if (!imageSrc) return
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setZoom(prev => Math.max(0.2, Math.min(3, prev + delta)))
  }

  // Generar imagen ajustada - captura exactamente lo que se ve en el área de recorte
  const generateCroppedImage = async () => {
    if (!imageSrc || !imageRef.current || !canvasRef.current) return null
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    // Crear una nueva imagen con crossOrigin para evitar tainted canvas
    const img = new Image()
    img.crossOrigin = 'anonymous'
    
    // Esperar a que la imagen cargue
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
      img.src = imageSrc
    })
    
    // Tamaño de salida (alta calidad)
    const maxOutputSize = 800
    let outputWidth, outputHeight
    
    if (aspectRatio) {
      if (aspectRatio >= 1) {
        outputWidth = maxOutputSize
        outputHeight = maxOutputSize / aspectRatio
      } else {
        outputHeight = maxOutputSize
        outputWidth = maxOutputSize * aspectRatio
      }
    } else {
      outputWidth = cropArea.width * 2
      outputHeight = cropArea.height * 2
    }
    
    canvas.width = outputWidth
    canvas.height = outputHeight
    
    // Limpiar
    ctx.clearRect(0, 0, outputWidth, outputHeight)
    
    // La imagen en CSS tiene width: 100% y height: auto
    // Esto significa que siempre se escala al ancho del contenedor
    const baseScale = containerSize.width / img.naturalWidth
    
    // Escala final con zoom del usuario
    const finalScale = baseScale * zoom
    
    // Tamaño de la imagen escalada en el contenedor
    const scaledWidth = img.naturalWidth * finalScale
    const scaledHeight = img.naturalHeight * finalScale
    
    // La imagen está centrada con margin-left: -50% y margin-top: -50%
    // más transform translate del crop
    const imgX = (containerSize.width - scaledWidth) / 2 + crop.x
    const imgY = (containerSize.height - scaledHeight) / 2 + crop.y
    
    // Calcular qué parte de la imagen original corresponde al área de recorte
    const sourceX = (cropArea.x - imgX) / finalScale
    const sourceY = (cropArea.y - imgY) / finalScale
    const sourceWidth = cropArea.width / finalScale
    const sourceHeight = cropArea.height / finalScale
    
    // Aplicar rotación si es necesario
    if (rotation !== 0) {
      ctx.translate(outputWidth / 2, outputHeight / 2)
      ctx.rotate((rotation * Math.PI) / 180)
      ctx.translate(-outputWidth / 2, -outputHeight / 2)
    }
    
    // Dibujar la porción visible de la imagen
    ctx.drawImage(
      img,
      sourceX, sourceY, sourceWidth, sourceHeight,
      0, 0, outputWidth, outputHeight
    )
    
    // Convertir a data URL
    return canvas.toDataURL('image/jpeg', 0.9)
  }

  const handleCropComplete = async () => {
    try {
      const croppedImage = await generateCroppedImage()
      if (croppedImage) {
        onCropComplete(croppedImage)
        onClose()
      } else if (imageSrc) {
        // Si no se pudo recortar, devolver la imagen original
        onCropComplete(imageSrc)
        onClose()
      }
    } catch (err) {
      console.error('Error cropping image:', err)
      // Devolver imagen original en caso de error
      if (imageSrc) {
        onCropComplete(imageSrc)
        onClose()
      }
    }
  }

  const handleClose = () => {
    setImageSrc(initialImage)
    setUrlInput('')
    setShowUrlInput(false)
    resetCrop()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="imageCropper__overlay">
      <div className="imageCropper__modal">
        {/* Header */}
        <div className="imageCropper__header">
          <h3>
            <Focus size={20} />
            {title}
          </h3>
          <button className="imageCropper__close" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="imageCropper__body">
          {/* Área de imagen/recorte */}
          <div 
            ref={containerRef}
            className="imageCropper__container"
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onWheel={handleWheel}
          >
            {imageSrc ? (
              <>
                <img
                  ref={imageRef}
                  src={imageSrc}
                  alt="Preview"
                  className="imageCropper__image"
                  crossOrigin="anonymous"
                  style={{
                    transform: `translate(${crop.x}px, ${crop.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                  }}
                  onLoad={handleImageLoad}
                  onError={(e) => {
                    // Si falla con crossOrigin, intentar sin él
                    if (e.target.crossOrigin) {
                      e.target.crossOrigin = null
                      e.target.src = imageSrc
                    }
                  }}
                  draggable={false}
                />
                {/* Overlay oscuro con área de recorte transparente */}
                <div className="imageCropper__overlay-mask">
                  <div 
                    className="imageCropper__crop-area"
                    style={{
                      left: cropArea.x,
                      top: cropArea.y,
                      width: cropArea.width,
                      height: cropArea.height,
                    }}
                  >
                    <div className="imageCropper__crop-corner imageCropper__crop-corner--tl" />
                    <div className="imageCropper__crop-corner imageCropper__crop-corner--tr" />
                    <div className="imageCropper__crop-corner imageCropper__crop-corner--bl" />
                    <div className="imageCropper__crop-corner imageCropper__crop-corner--br" />
                    <div className="imageCropper__crop-grid" />
                  </div>
                </div>
              </>
            ) : (
              <div className="imageCropper__placeholder">
                <div className="imageCropper__placeholderContent">
                  <Upload size={48} />
                  <p>Sube o pega una imagen para comenzar</p>
                </div>
              </div>
            )}
          </div>

          {/* Canvas oculto para generar la imagen recortada */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Controles */}
          <div className="imageCropper__controls">
            {/* Source buttons */}
            <div className="imageCropper__sourceButtons">
              {allowUpload && (
                <>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={16} />
                    Subir imagen
                  </Button>
                </>
              )}
              {allowUrl && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowUrlInput(!showUrlInput)}
                >
                  <Link2 size={16} />
                  Desde URL
                </Button>
              )}
            </div>

            {/* URL Input */}
            {showUrlInput && (
              <div className="imageCropper__urlInput">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://ejemplo.com/imagen.jpg"
                  onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
                />
                <Button size="sm" onClick={handleUrlSubmit}>
                  Cargar
                </Button>
              </div>
            )}

            {/* Zoom & Rotation controls */}
            {imageSrc && (
              <div className="imageCropper__adjustments">
                <div className="imageCropper__slider">
                  <ZoomOut size={16} />
                  <input
                    type="range"
                    min="0.2"
                    max="3"
                    step="0.1"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                  />
                  <ZoomIn size={16} />
                  <span className="imageCropper__value">{Math.round(zoom * 100)}%</span>
                </div>
                
                <div className="imageCropper__rotationBtns">
                  <button 
                    type="button" 
                    className="imageCropper__iconBtn"
                    onClick={() => setRotation(r => r - 90)}
                    title="Rotar izquierda"
                  >
                    <RotateCcw size={18} />
                  </button>
                  <button 
                    type="button" 
                    className="imageCropper__iconBtn"
                    onClick={() => setRotation(r => r + 90)}
                    title="Rotar derecha"
                  >
                    <RotateCw size={18} />
                  </button>
                  <button 
                    type="button" 
                    className="imageCropper__iconBtn"
                    onClick={resetCrop}
                    title="Resetear"
                  >
                    <RefreshCw size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="imageCropper__footer">
          <Button variant="secondary" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleCropComplete} disabled={!imageSrc}>
            <Check size={16} />
            Aplicar recorte
          </Button>
        </div>
      </div>
    </div>
  )
}
