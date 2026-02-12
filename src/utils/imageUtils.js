/**
 * Utilidades para procesamiento de imagenes con react-easy-crop.
 *
 * Usa drawImage (sin getImageData/putImageData) para evitar errores
 * de taint en canvas con origenes remotos o data-URLs.
 */

/**
 * Crea un HTMLImageElement desde una URL o base64.
 * @param {string} url
 * @returns {Promise<HTMLImageElement>}
 */
export function createImage(url) {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', (err) =>
      reject(err instanceof Error ? err : new Error('No se pudo cargar la imagen')),
    )
    // crossOrigin solo para URLs remotas; data: URLs no lo necesitan
    if (url && !url.startsWith('data:')) {
      img.setAttribute('crossOrigin', 'anonymous')
    }
    img.src = url
  })
}

/**
 * Calcula el bounding-box de una imagen rotada.
 */
function getRotatedSize(width, height, rotation) {
  const rad = (rotation * Math.PI) / 180
  return {
    width:
      Math.abs(Math.cos(rad) * width) + Math.abs(Math.sin(rad) * height),
    height:
      Math.abs(Math.sin(rad) * width) + Math.abs(Math.cos(rad) * height),
  }
}

/**
 * Genera una imagen recortada a partir del output de react-easy-crop.
 *
 * Flujo:
 *   1. Dibuja la imagen rotada en un canvas temporal.
 *   2. Extrae el rectangulo de recorte con drawImage (sin putImageData).
 *   3. Devuelve { file: File, url: objectURL }.
 *
 * @param {string} imageSrc
 * @param {{ x:number, y:number, width:number, height:number }} pixelCrop
 * @param {number} [rotation=0]
 * @returns {Promise<{ file: File, url: string }>}
 */
export async function getCroppedImg(imageSrc, pixelCrop, rotation = 0) {
  const image = await createImage(imageSrc)

  // --- Paso 1: dibujar imagen rotada en canvas auxiliar ---
  const { width: bBoxW, height: bBoxH } = getRotatedSize(
    image.width,
    image.height,
    rotation,
  )

  const rotCanvas = document.createElement('canvas')
  rotCanvas.width = Math.round(bBoxW)
  rotCanvas.height = Math.round(bBoxH)

  const rotCtx = rotCanvas.getContext('2d')
  if (!rotCtx) throw new Error('No se pudo obtener contexto 2D')

  rotCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2)
  rotCtx.rotate((rotation * Math.PI) / 180)
  rotCtx.drawImage(image, -image.width / 2, -image.height / 2)

  // --- Paso 2: recortar ---
  const cropCanvas = document.createElement('canvas')
  cropCanvas.width = pixelCrop.width
  cropCanvas.height = pixelCrop.height

  const cropCtx = cropCanvas.getContext('2d')
  if (!cropCtx) throw new Error('No se pudo obtener contexto 2D')

  cropCtx.drawImage(
    rotCanvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  )

  // --- Paso 3: exportar ---
  return new Promise((resolve, reject) => {
    cropCanvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Error al generar la imagen recortada (blob null)'))
          return
        }
        const file = new File([blob], `edited_${Date.now()}.jpg`, {
          type: 'image/jpeg',
        })
        const url = URL.createObjectURL(file)
        resolve({ file, url })
      },
      'image/jpeg',
      0.92,
    )
  })
}

/**
 * Verifica si un archivo es una imagen válida, usando type y extensión como fallback.
 * En Windows, file.type puede ser '' para ciertos formatos (HEIC, etc.).
 * @param {File} file
 * @returns {boolean}
 */
export function isValidImageFile(file) {
  if (file?.type?.startsWith('image/')) return true

  // Fallback: verificar extensión del archivo
  const name = (file?.name || '').toLowerCase()
  const imageExtensions = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp',
    '.svg', '.avif', '.heic', '.heif', '.ico', '.tiff', '.tif',
  ]
  return imageExtensions.some((ext) => name.endsWith(ext))
}

/**
 * Redimensiona una imagen (File o data-URL) a un tamaño máximo para preview.
 * Es útil para no cargar imágenes enormes (>10MP) en el editor/cropper.
 * Devuelve una data-URL con la imagen redimensionada.
 *
 * IMPORTANTE: NO reemplaza el archivo original (que se sube tal cual).
 * Solo genera una versión ligera para el editor.
 *
 * @param {string} dataUrl - data-URL de la imagen original
 * @param {number} [maxDimension=2048] - dimensión máxima (ancho o alto)
 * @returns {Promise<string>} data-URL redimensionada
 */
export async function resizeImageForPreview(dataUrl, maxDimension = 2048) {
  const img = await createImage(dataUrl)

  // Si la imagen ya es suficientemente pequeña, devolver la original
  if (img.width <= maxDimension && img.height <= maxDimension) {
    return dataUrl
  }

  const ratio = Math.min(maxDimension / img.width, maxDimension / img.height)
  const newWidth = Math.round(img.width * ratio)
  const newHeight = Math.round(img.height * ratio)

  const canvas = document.createElement('canvas')
  canvas.width = newWidth
  canvas.height = newHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo obtener contexto 2D para redimensionar')

  ctx.drawImage(img, 0, 0, newWidth, newHeight)

  return canvas.toDataURL('image/jpeg', 0.9)
}
