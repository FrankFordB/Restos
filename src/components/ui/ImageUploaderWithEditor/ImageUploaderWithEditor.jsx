import { useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import { Upload, Loader2 } from 'lucide-react'
import ImageEditorModal from '../ImageEditorModal/ImageEditorModal'
import { isValidImageFile, resizeImageForPreview, checkUnsupportedFormat } from '../../../utils/imageUtils'
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

// Contador global para generar IDs únicos por instancia
let _instanceCounter = 0

// Almacenamiento temporal de archivos a nivel de módulo
// Persiste incluso si el componente se remonta
const _pendingFiles = new Map()

const ImageUploaderWithEditor = forwardRef(function ImageUploaderWithEditor(
  {
    aspect = 1,
    onImageReady,
    children,
    disabled = false,
    maxSize = 10 * 1024 * 1024, // 10 MB por defecto
    modalTitle = 'Editar imagen',
    className = '',
  },
  ref,
) {
  const fileInputRef = useRef(null)
  // ID único y estable para asociar <label htmlFor> con <input id>
  const inputId = useRef(`imgUp_${++_instanceCounter}_${Date.now()}`).current

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

  // Guardar archivo en el storage global usando el inputId como key
  const saveFileToGlobal = useCallback((file) => {
    if (file) {
      _pendingFiles.set(inputId, file)
      console.log('[ImageUploader] Archivo guardado en storage global:', file.name)
    }
  }, [inputId])

  const getFileFromGlobal = useCallback(() => {
    return _pendingFiles.get(inputId) || null
  }, [inputId])

  const clearFileFromGlobal = useCallback(() => {
    _pendingFiles.delete(inputId)
  }, [inputId])

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

  // Manejar seleccion de archivo
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    // Guardar referencia al input ANTES de cualquier await
    const inputEl = e.target
    if (!file) {
      console.log('[ImageUploader] No se seleccionó archivo')
      return
    }

    console.log('[ImageUploader] Archivo seleccionado:', {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified,
    })

    setFileError(null)

    // Verificar formato no soportado (HEIC, etc.) - solo estos específicos
    const { isUnsupported, format } = checkUnsupportedFormat(file)
    if (isUnsupported) {
      console.log('[ImageUploader] Formato no soportado:', format)
      setFileError(`El formato ${format} no es compatible. Convertilo a JPG o PNG antes de subirlo.`)
      inputEl.value = ''
      return
    }

    // Validar tipo de archivo - muy permisivo
    if (!isValidImageFile(file)) {
      console.log('[ImageUploader] Archivo no reconocido como imagen')
      setFileError('Solo se permiten archivos de imagen (JPG, PNG, WebP, etc.)')
      inputEl.value = ''
      return
    }

    if (file.size > maxSize) {
      const mb = Math.round(maxSize / (1024 * 1024))
      console.log('[ImageUploader] Archivo muy grande:', file.size)
      setFileError(`La imagen no puede superar ${mb}MB. Tu archivo pesa ${(file.size / (1024 * 1024)).toFixed(1)}MB.`)
      inputEl.value = ''
      return
    }

    console.log('[ImageUploader] Validaciones pasadas, procesando...')
    setOriginalFile(file)
    originalFileRef.current = file
    saveFileToGlobal(file) // Guardar en storage global como respaldo
    isNewFileSessionRef.current = true // archivo nuevo seleccionado
    setLoading(true)

    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          console.log('[ImageUploader] FileReader completado, largo del resultado:', reader.result?.length)
          resolve(reader.result)
        }
        reader.onerror = (err) => {
          console.error('[ImageUploader] FileReader error:', err)
          reject(new Error('No se pudo leer el archivo. Verificá que no esté dañado.'))
        }
        reader.onabort = () => {
          console.warn('[ImageUploader] FileReader abortado')
          reject(new Error('La lectura del archivo fue cancelada.'))
        }
        reader.readAsDataURL(file)
      })

      if (!dataUrl || typeof dataUrl !== 'string') {
        console.error('[ImageUploader] dataUrl inválido:', typeof dataUrl)
        throw new Error('No se pudo procesar el archivo. Intentá con otro.')
      }

      // Ser más permisivo con el formato del data URL
      if (!dataUrl.startsWith('data:')) {
        console.warn('[ImageUploader] dataUrl no empieza con data:', dataUrl.substring(0, 50))
        // Intentar usarlo de todos modos
      }

      console.log('[ImageUploader] Redimensionando para preview...')
      // Redimensionar para el editor (el archivo original se sube tal cual)
      let previewUrl
      try {
        previewUrl = await resizeImageForPreview(dataUrl)
        console.log('[ImageUploader] Preview generado, largo:', previewUrl?.length)
      } catch (resizeErr) {
        console.warn('[ImageUploader] Error redimensionando, usando original:', resizeErr)
        // Si falla el resize, usar el dataUrl original
        previewUrl = dataUrl
      }

      setOriginalImage(previewUrl)
      setEditorImage(previewUrl)
      setShowEditor(true)
      console.log('[ImageUploader] Editor abierto')
    } catch (err) {
      console.error('[ImageUploader] Error procesando imagen:', err)
      // Mensaje más descriptivo según el tipo de error
      let errorMsg = 'Error al procesar la imagen. Intentá con otro archivo.'
      if (err?.message) {
        errorMsg = err.message
      }
      setFileError(errorMsg)
    } finally {
      setLoading(false)
      // Resetear input para permitir seleccionar el mismo archivo de nuevo
      try { inputEl.value = '' } catch { /* input may have been removed */ }
    }
  }

  // Cuando el usuario confirma el encuadre
  const handleConfirm = (focalPoint, fileFromModal) => {
    console.log('[ImageUploader] handleConfirm llamado con focalPoint:', focalPoint, 'fileFromModal:', fileFromModal?.name)
    
    // Prioridad: archivo del modal, luego storage global, luego ref, luego state
    const globalFile = getFileFromGlobal()
    const file = fileFromModal || globalFile || originalFileRef.current || originalFile || null
    
    const source = fileFromModal ? 'modal' : globalFile ? 'global' : originalFileRef.current ? 'ref' : originalFile ? 'state' : 'ninguna'
    console.log('[ImageUploader] Archivo final a enviar:', file?.name || 'ninguno', '(fuente:', source, ')')
    
    // Limpiar el archivo global después de usarlo
    clearFileFromGlobal()
    
    setShowEditor(false)
    
    console.log('[ImageUploader] Llamando onImageReady, existe:', !!onImageReady)
    try {
      onImageReady?.(file, focalPoint)
      console.log('[ImageUploader] onImageReady ejecutado sin error')
    } catch (err) {
      console.error('[ImageUploader] Error en onImageReady:', err)
    }
  }

  // Cerrar editor sin confirmar
  const handleClose = () => {
    setShowEditor(false)
  }

  // Abrir file picker
  const openFilePicker = useCallback(() => {
    console.log('[ImageUploader] openFilePicker llamado, disabled:', disabled, 'loading:', loading)
    if (disabled || loading) return
    
    const input = fileInputRef.current
    if (input) {
      // Resetear el valor para permitir seleccionar el mismo archivo de nuevo
      input.value = ''
      console.log('[ImageUploader] Abriendo selector de archivos...')
      input.click()
    } else {
      console.error('[ImageUploader] Input ref es null!')
    }
  }, [disabled, loading])

  return (
    <>
      {/* Input oculto - posicionado fuera de viewport */}
      <input
        id={inputId}
        type="file"
        ref={fileInputRef}
        accept="image/*,.jpg,.jpeg,.png,.gif,.webp,.bmp,.svg,.avif,.tiff,.tif,.ico"
        onChange={(e) => {
          console.log('[ImageUploader] onChange disparado, files:', e.target.files?.length)
          handleFileChange(e)
        }}
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
        tabIndex={-1}
      />

      {children ? (
        <div
          className={`imageUploader__wrapper ${loading ? 'imageUploader__wrapper--loading' : ''} ${disabled || loading ? 'imageUploader__wrapper--disabled' : ''} ${className}`}
          aria-label="Seleccionar imagen"
          onClick={openFilePicker}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openFilePicker() }}
          role="button"
          tabIndex={disabled || loading ? -1 : 0}
          style={{ cursor: disabled || loading ? 'default' : 'pointer' }}
        >
          {loading ? (
            <div className="imageUploader__loadingOverlay">
              <Loader2 size={20} className="imageUploader__spinner" />
              <span>Procesando imagen...</span>
            </div>
          ) : (
            <div className="imageUploader__childrenWrap" style={{ pointerEvents: 'none' }}>
              {children}
            </div>
          )}
        </div>
      ) : (
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
        imageFile={originalFile}
        aspect={aspect}
        title={modalTitle}
      />
    </>
  )
})

export default ImageUploaderWithEditor
