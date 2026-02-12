import { useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import { Upload, Loader2 } from 'lucide-react'
import ImageEditorModal from '../ImageEditorModal/ImageEditorModal'
import { isValidImageFile, resizeImageForPreview } from '../../../utils/imageUtils'
import './ImageUploaderWithEditor.css'

/**
 * Componente reutilizable de subida de imagen con editor integrado (react-easy-crop).
 *
 * Flujo normal:
 *   click -> file picker -> ImageEditorModal -> onImageReady(file, focalPoint)
 *
 * Re-edicion:
 *   - El componente mantiene la imagen original en memoria.
 *   - El padre puede reabrir el editor llamando ref.current.openEditor()
 *     (usa la imagen original guardada) o ref.current.openEditor(url)
 *     para editar una imagen remota existente.
 *   - NO se recorta la imagen. Se devuelve null + punto focal.
 *
 * Props:
 *   aspect      : number       - aspect ratio del encuadre (default 1)
 *   onImageReady: (file, fp)   - callback con File original + focalPoint {x,y}
 *   children    : ReactNode    - contenido custom del trigger
 *   disabled    : boolean
 *   maxSize     : number       - tamano maximo en bytes (default 5 MB)
 *   modalTitle  : string
 *   className   : string
 *
 * Ref API:
 *   openEditor(imageSrc?)  - abre el editor; sin argumento usa la imagen guardada
 *   openFilePicker()       - abre el dialogo de archivo directamente
 *   hasOriginal()          - true si hay una imagen original en memoria
 */
const ImageUploaderWithEditor = forwardRef(function ImageUploaderWithEditor(
  {
    aspect = 1,
    onImageReady,
    children,
    disabled = false,
    maxSize = 5 * 1024 * 1024,
    modalTitle = 'Editar imagen',
    className = '',
  },
  ref,
) {
  const fileInputRef = useRef(null)

  // Imagen original sin editar (data-URL) - se mantiene para re-edicion
  const [originalImage, setOriginalImage] = useState(null)
  // Archivo original sin editar - se pasa al padre para subir
  const [originalFile, setOriginalFile] = useState(null)
  // Ref espejo del archivo original para evitar problemas de closure/stale state
  const originalFileRef = useRef(null)
  const [showEditor, setShowEditor] = useState(false)
  // Imagen que se pasa al editor (puede ser la original o una URL remota)
  const [editorImage, setEditorImage] = useState(null)
  // Estado de carga mientras se lee/redimensiona la imagen
  const [loading, setLoading] = useState(false)
  // Error visible para el usuario
  const [fileError, setFileError] = useState(null)
  // Distinguir si el editor se abrió por un archivo nuevo o por re-edición
  const isNewFileSessionRef = useRef(false)

  // Exponer metodos al padre via ref
  useImperativeHandle(
    ref,
    () => ({
      /** Abre el editor para re-editar. Sin argumento usa la imagen original guardada. */
      openEditor: (imageSrc) => {
        const src = imageSrc || originalImage
        if (!src) return
        isNewFileSessionRef.current = false // re-edicion, no archivo nuevo
        setEditorImage(src)
        setShowEditor(true)
      },
      /** Abre el dialogo de seleccion de archivo. */
      openFilePicker: () => {
        if (!disabled && !loading) fileInputRef.current?.click()
      },
      /** Retorna true si hay una imagen original en memoria. */
      hasOriginal: () => !!originalImage,
    }),
    [originalImage, disabled, loading],
  )

  // Abrir file picker
  const openFilePicker = useCallback(() => {
    if (disabled || loading) return
    fileInputRef.current?.click()
  }, [disabled, loading])

  // Manejar seleccion de archivo
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    // Guardar referencia al input ANTES de cualquier await
    const inputEl = e.target
    if (!file) return

    setFileError(null)

    // Validar tipo de archivo (con fallback a extensión para Windows)
    if (!isValidImageFile(file)) {
      setFileError('Solo se permiten archivos de imagen (JPG, PNG, WebP, etc.)')
      inputEl.value = ''
      return
    }

    if (file.size > maxSize) {
      const mb = Math.round(maxSize / (1024 * 1024))
      setFileError(`La imagen no puede superar ${mb}MB. Tu archivo pesa ${(file.size / (1024 * 1024)).toFixed(1)}MB.`)
      inputEl.value = ''
      return
    }

    setOriginalFile(file)
    originalFileRef.current = file
    isNewFileSessionRef.current = true // archivo nuevo seleccionado
    setLoading(true)

    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(new Error('No se pudo leer el archivo. Intentá de nuevo.'))
        reader.readAsDataURL(file)
      })

      // Redimensionar para el editor (el archivo original se sube tal cual)
      let previewUrl
      try {
        previewUrl = await resizeImageForPreview(dataUrl)
      } catch {
        // Si falla el resize, usar el dataUrl original
        previewUrl = dataUrl
      }

      setOriginalImage(previewUrl)
      setEditorImage(previewUrl)
      setShowEditor(true)
    } catch (err) {
      console.error('Error procesando imagen:', err)
      setFileError(err?.message || 'Error al procesar la imagen. Intentá con otro archivo.')
    } finally {
      setLoading(false)
      // Resetear input para permitir seleccionar el mismo archivo de nuevo
      try { inputEl.value = '' } catch { /* input may have been removed */ }
    }
  }

  // Cuando el usuario confirma el encuadre
  const handleConfirm = (focalPoint) => {
    setShowEditor(false)
    // Usar ref para evitar stale closure sobre originalFile (state puede estar desactualizado)
    const file = isNewFileSessionRef.current ? originalFileRef.current : null
    onImageReady?.(file, focalPoint)
  }

  // Cerrar editor sin confirmar
  const handleClose = () => {
    setShowEditor(false)
  }

  return (
    <>
      {children ? (
        <div
          className={`imageUploader__wrapper ${loading ? 'imageUploader__wrapper--loading' : ''} ${className}`}
          onClick={
            disabled || loading
              ? undefined
              : (e) => {
                  // NO usar e.preventDefault() — consume el user-gesture y
                  // bloquea el fileInput.click() programático en algunos browsers
                  e.stopPropagation()
                  openFilePicker()
                }
          }
          role={disabled || loading ? undefined : 'button'}
          tabIndex={disabled || loading ? -1 : 0}
          onKeyDown={
            disabled || loading
              ? undefined
              : (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    openFilePicker()
                  }
                }
          }
          aria-label="Seleccionar imagen"
        >
          {/* Input oculto dentro del wrapper para que quede contenido */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleFileChange}
            onClick={(e) => e.stopPropagation()}
            className="imageUploader__hiddenInput"
            tabIndex={-1}
          />
          {loading ? (
            <div className="imageUploader__loadingOverlay">
              <Loader2 size={20} className="imageUploader__spinner" />
              <span>Procesando imagen...</span>
            </div>
          ) : (
            children
          )}
        </div>
      ) : (
        <>
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleFileChange}
            className="imageUploader__hiddenInput"
            tabIndex={-1}
          />
          <button
            type="button"
            className={`imageUploader__trigger ${className}`}
            onClick={openFilePicker}
            disabled={disabled || loading}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="imageUploader__spinner" />
                Procesando...
              </>
            ) : (
              <>
                <Upload size={16} />
                Subir imagen
              </>
            )}
          </button>
        </>
      )}

      {/* Error visible para el usuario */}
      {fileError && (
        <div className="imageUploader__error">
          {fileError}
        </div>
      )}

      <ImageEditorModal
        isOpen={showEditor}
        onClose={handleClose}
        onConfirm={handleConfirm}
        imageSrc={editorImage}
        aspect={aspect}
        title={modalTitle}
      />
    </>
  )
})

export default ImageUploaderWithEditor
