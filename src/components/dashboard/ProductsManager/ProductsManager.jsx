import { useEffect, useMemo, useRef, useState } from 'react'
import Cropper from 'react-easy-crop'
import './ProductsManager.css'
import Card from '../../ui/Card/Card'
import Input from '../../ui/Input/Input'
import Button from '../../ui/Button/Button'
import { useAppDispatch, useAppSelector } from '../../../app/hooks'
import { isSupabaseConfigured } from '../../../lib/supabaseClient'
import { uploadProductImage } from '../../../lib/supabaseStorage'
import {
  createProduct,
  deleteProduct,
  fetchProductsForTenant,
  patchProduct,
  selectProductsForTenant,
} from '../../../features/products/productsSlice'

export default function ProductsManager({ tenantId }) {
  const dispatch = useAppDispatch()
  const products = useAppSelector(selectProductsForTenant(tenantId))

  const createFileInputRef = useRef(null)

  useEffect(() => {
    dispatch(fetchProductsForTenant(tenantId))
  }, [dispatch, tenantId])

  // Selección múltiple de productos
  const [selectedProductIds, setSelectedProductIds] = useState(new Set())
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false)

  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [stock, setStock] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [photoStatus, setPhotoStatus] = useState(null)

  function parsePrice(raw) {
    const s = String(raw ?? '').trim()
    if (!s) return null

    // Permite 9.99 o 9,99 y elimina símbolos/espacios.
    let cleaned = s.replace(/\s/g, '').replace(/[^0-9.,-]/g, '')
    if (!cleaned) return null

    // Si tiene punto y coma: asumimos coma como separador de miles.
    if (cleaned.includes('.') && cleaned.includes(',')) {
      cleaned = cleaned.replace(/,/g, '')
    } else {
      cleaned = cleaned.replace(',', '.')
    }

    const num = Number(cleaned)
    if (!Number.isFinite(num) || num < 0) return null

    // Supabase schema usa numeric(10,2) => máximo ~ 99,999,999.99
    const rounded = Math.round(num * 100) / 100
    const MAX_PRICE = 99_999_999.99
    if (rounded > MAX_PRICE) return null
    return rounded
  }

  const [cropState, setCropState] = useState({
    open: false,
    mode: null, // 'create' | 'edit'
    productId: null,
    productName: null,
    file: null,
    src: null,
    crop: { x: 0, y: 0 },
    zoom: 1,
    croppedAreaPixels: null,
  })

  const ZOOM_MIN = 1
  const ZOOM_MAX = 3
  const ZOOM_STEP = 0.2

  async function createImage(src) {
    return await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('No se pudo cargar la imagen para recortar'))
      img.src = src
    })
  }

  async function getCroppedFile({ src, croppedAreaPixels, originalFile }) {
    if (!src) throw new Error('Fuente de imagen inválida')
    if (!croppedAreaPixels) throw new Error('No hay área de recorte')
    if (!originalFile) throw new Error('Archivo original requerido')

    const image = await createImage(src)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas no disponible')

    const { x, y, width, height } = croppedAreaPixels
    canvas.width = Math.max(1, Math.round(width))
    canvas.height = Math.max(1, Math.round(height))
    ctx.drawImage(
      image,
      Math.round(x),
      Math.round(y),
      Math.round(width),
      Math.round(height),
      0,
      0,
      Math.round(width),
      Math.round(height),
    )

    const type = originalFile.type || 'image/png'
    const blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), type, 0.92)
    })
    if (!blob) throw new Error('No se pudo generar la imagen recortada')

    const name = String(originalFile.name || 'image')
    const safeName = name.includes('.') ? name : `${name}.png`
    return new File([blob], safeName, { type })
  }

  function formatPhotoError(err) {
    const msg = err?.message ? String(err.message) : 'Error subiendo foto'

    // Mensajes típicos cuando Storage RLS/policies no están aplicadas
    const lower = msg.toLowerCase()
    const looksLikeRls =
      lower.includes('row-level security') ||
      lower.includes('violates row level security') ||
      lower.includes('new row violates') ||
      lower.includes('permission denied') ||
      lower.includes('must be owner')

    if (looksLikeRls) {
      return (
        msg +
        ' — Parece un bloqueo de RLS/Policies en Supabase Storage. Ejecuta la sección STORAGE de supabase/rls.sql como postgres/supabase_admin, o crea policies en Dashboard para el bucket product-images.'
      )
    }

    if (lower.includes('jwt') || lower.includes('not authorized') || lower.includes('unauthorized')) {
      return msg + ' — Verifica que estés logueado y que VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY sean correctas.'
    }

    return msg
  }

  async function fileToDataUrl(file) {
    if (!file) return null
    // Guardrail para no inflar localStorage en modo MOCK
    const maxBytes = 1_500_000 // ~1.5MB
    if (file.size > maxBytes) {
      throw new Error('La imagen es muy pesada para modo MOCK. Usa una más liviana o configura Supabase Storage.')
    }
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
      reader.onload = () => resolve(String(reader.result || ''))
      reader.readAsDataURL(file)
    })
  }

  const parsedPrice = useMemo(() => parsePrice(price), [price])

  const previewUrl = useMemo(() => {
    if (!imageFile) return null
    return URL.createObjectURL(imageFile)
  }, [imageFile])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function openCropper({ file, mode, productId = null, productName = null }) {
    if (!file) return
    const src = URL.createObjectURL(file)
    setCropState({
      open: true,
      mode,
      productId,
      productName,
      file,
      src,
      crop: { x: 0, y: 0 },
      zoom: 1,
      croppedAreaPixels: null,
    })
  }

  function closeCropper() {
    setCropState((prev) => {
      if (prev?.src) URL.revokeObjectURL(prev.src)
      return {
        open: false,
        mode: null,
        productId: null,
        productName: null,
        file: null,
        src: null,
        crop: { x: 0, y: 0 },
        zoom: 1,
        croppedAreaPixels: null,
      }
    })
  }

  useEffect(() => {
    if (!cropState.open) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeCropper()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [cropState.open])

  // =====================
  // FUNCIONES DE SELECCIÓN MÚLTIPLE
  // =====================
  
  const toggleProductSelection = (productId) => {
    setSelectedProductIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(productId)) {
        newSet.delete(productId)
      } else {
        newSet.add(productId)
      }
      return newSet
    })
  }

  const toggleSelectAllProducts = () => {
    if (selectedProductIds.size === products.length) {
      setSelectedProductIds(new Set())
    } else {
      setSelectedProductIds(new Set(products.map((p) => p.id)))
    }
  }

  const clearProductSelection = () => {
    setSelectedProductIds(new Set())
  }

  // Eliminar productos seleccionados de la base de datos
  const bulkDeleteProducts = async () => {
    if (selectedProductIds.size === 0) return
    if (!confirm(`¿Eliminar ${selectedProductIds.size} producto(s)? Esta acción no se puede deshacer.`)) return
    setIsBulkActionLoading(true)
    try {
      const promises = Array.from(selectedProductIds).map((productId) =>
        dispatch(deleteProduct({ tenantId, productId })).unwrap()
      )
      await Promise.all(promises)
      clearProductSelection()
      // Refrescar para sincronizar con la base de datos
      setTimeout(() => dispatch(fetchProductsForTenant(tenantId)), 500)
    } catch (e) {
      console.error('Error eliminando productos:', e)
      dispatch(fetchProductsForTenant(tenantId))
    } finally {
      setIsBulkActionLoading(false)
    }
  }

  // Activar/desactivar productos seleccionados
  const bulkToggleActive = async (active) => {
    if (selectedProductIds.size === 0) return
    setIsBulkActionLoading(true)
    try {
      const promises = Array.from(selectedProductIds).map((productId) =>
        dispatch(patchProduct({ tenantId, productId, patch: { active } })).unwrap()
      )
      await Promise.all(promises)
      clearProductSelection()
    } catch (e) {
      console.error('Error actualizando productos:', e)
    } finally {
      setIsBulkActionLoading(false)
    }
  }

  const allProductsSelected = products.length > 0 && selectedProductIds.size === products.length

  return (
    <div className="products">
      <Card
        title="Crear producto"
        actions={
          <Button
            size="sm"
            onClick={async () => {
              setPhotoStatus(null)
              if (!name.trim() || parsedPrice === null) {
                setPhotoStatus('Precio inválido. Usa 9.99 o 9,99.')
                return
              }

              let mockImageUrl = null
              try {
                if (!isSupabaseConfigured && imageFile) {
                  setPhotoStatus('Guardando foto localmente (modo MOCK)...')
                  mockImageUrl = await fileToDataUrl(imageFile)
                }
              } catch (e) {
                const msg = e?.message ? String(e.message) : 'Error procesando foto'
                setPhotoStatus(msg)
                return
              }

              let created
              try {
                created = await dispatch(
                  createProduct({
                    tenantId,
                    product: {
                      name: name.trim(),
                      price: parsedPrice,
                      description: description.trim(),
                      category: category.trim() || null,
                      stock: stock.trim() ? parseInt(stock, 10) : null,
                      ...(mockImageUrl ? { imageUrl: mockImageUrl } : null),
                    },
                  }),
                ).unwrap()
              } catch (e) {
                const msg = e?.message ? String(e.message) : 'Error creando producto'
                setPhotoStatus(msg)
                return
              }

              // Si hay archivo seleccionado y Supabase está configurado, se sube y se guarda en el producto.
              // (En modo MOCK no subimos archivos.)
              try {
                if (isSupabaseConfigured && imageFile && created?.row?.id) {
                  setPhotoStatus('Subiendo foto...')
                  const url = await uploadProductImage({
                    tenantId,
                    productId: created.row.id,
                    file: imageFile,
                  })
                  await dispatch(
                    patchProduct({ tenantId, productId: created.row.id, patch: { imageUrl: url } }),
                  ).unwrap()
                  setPhotoStatus('Foto subida y guardada ✅')
                } else if (!isSupabaseConfigured && imageFile) {
                  setPhotoStatus('Foto guardada localmente ✅')
                }
              } catch (e) {
                setPhotoStatus(formatPhotoError(e))
              }

              setName('')
              setPrice('')
              setDescription('')
              setCategory('')
              setStock('')
              setImageFile(null)
              if (createFileInputRef.current) createFileInputRef.current.value = ''
            }}
          >
            Agregar
          </Button>
        }
      >
        <div className="products__form">
          <Input label="Nombre" value={name} onChange={setName} placeholder="Hamburguesa doble" />
          <Input
            label="Precio"
            value={price}
            onChange={setPrice}
            placeholder="9,99"
            inputMode="decimal"
            autoComplete="off"
          />
          <Input label="Descripción" value={description} onChange={setDescription} placeholder="Ingredientes..." />
          <Input label="Categoría" value={category} onChange={setCategory} placeholder="Ej: Hamburguesas, Bebidas..." />
          <Input
            label="Stock"
            value={stock}
            onChange={setStock}
            placeholder="Cantidad disponible"
            inputMode="numeric"
            autoComplete="off"
          />
          <label className="products__file">
            <span className="products__fileLabel">Foto</span>
            <input
              ref={createFileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0] || null
                if (!file) return
                setPhotoStatus('Selecciona el recorte y presiona “Usar recorte”.')
                openCropper({ file, mode: 'create' })
                // permite re-seleccionar el mismo archivo luego
                e.target.value = ''
              }}
            />
          </label>

          {imageFile ? (
            <div className="products__imageRow">
              <img className="products__thumb" src={previewUrl || ''} alt="" />
              <span className="products__hint">Vista previa (recortada)</span>
            </div>
          ) : null}

          {!isSupabaseConfigured ? <p className="products__hint">Modo MOCK: la foto se guarda localmente.</p> : null}
          {photoStatus ? <p className="products__hint">{photoStatus}</p> : null}
          <p className="products__hint">Tip: el precio debe ser numérico.</p>
        </div>
      </Card>

      {cropState.open ? (
        <div
          className="products__modalOverlay"
          role="presentation"
          onMouseDown={(e) => {
            // click fuera del modal
            if (e.target === e.currentTarget) closeCropper()
          }}
        >
          <div
            className="products__modal"
            role="dialog"
            aria-modal="true"
            aria-label="Recortar foto"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Card title={cropState.mode === 'edit' ? `Recortar foto: ${cropState.productName || ''}` : 'Recortar foto'}>
              <div className="products__cropWrap">
                <div className="products__cropArea">
                  <Cropper
                    image={cropState.src}
                    crop={cropState.crop}
                    zoom={cropState.zoom}
                    aspect={1}
                    minZoom={ZOOM_MIN}
                    maxZoom={ZOOM_MAX}
                    onCropChange={(crop) => setCropState((s) => ({ ...s, crop }))}
                    onZoomChange={(zoom) =>
                      setCropState((s) => ({ ...s, zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom)) }))
                    }
                    onCropComplete={(_, croppedAreaPixels) =>
                      setCropState((s) => ({ ...s, croppedAreaPixels }))
                    }
                  />
                </div>

                <div className="products__cropActions">
                  <div className="products__zoomControls">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setCropState((s) => ({
                          ...s,
                          zoom: Math.max(ZOOM_MIN, Number(s.zoom || 1) - ZOOM_STEP),
                        }))
                      }
                    >
                      −
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setCropState((s) => ({
                          ...s,
                          zoom: Math.min(ZOOM_MAX, Number(s.zoom || 1) + ZOOM_STEP),
                        }))
                      }
                    >
                      +
                    </Button>
                  </div>
                  <Button variant="ghost" onClick={closeCropper}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={async () => {
                      setPhotoStatus(null)
                      try {
                        const cropped = await getCroppedFile({
                          src: cropState.src,
                          croppedAreaPixels: cropState.croppedAreaPixels,
                          originalFile: cropState.file,
                        })

                        if (cropState.mode === 'create') {
                          setImageFile(cropped)
                          setPhotoStatus('Recorte aplicado ✅')
                          closeCropper()
                          return
                        }

                        if (cropState.mode === 'edit' && cropState.productId) {
                          const productId = cropState.productId
                          const tenantIdForUpload = tenantId

                          if (!isSupabaseConfigured) {
                            setPhotoStatus('Guardando foto localmente (modo MOCK)...')
                            const dataUrl = await fileToDataUrl(cropped)
                            await dispatch(
                              patchProduct({ tenantId, productId, patch: { imageUrl: dataUrl } }),
                            ).unwrap()
                            setPhotoStatus('Foto actualizada (local) ✅')
                            closeCropper()
                            return
                          }

                          setPhotoStatus('Subiendo foto...')
                          const url = await uploadProductImage({ tenantId: tenantIdForUpload, productId, file: cropped })
                          await dispatch(patchProduct({ tenantId, productId, patch: { imageUrl: url } })).unwrap()
                          setPhotoStatus('Foto actualizada ✅')
                          closeCropper()
                        }
                      } catch (err) {
                        setPhotoStatus(formatPhotoError(err))
                      }
                    }}
                  >
                    Usar recorte
                  </Button>
                </div>

                <p className="products__hint">Tip: recorte cuadrado (1:1) para que la miniatura se vea bien.</p>
              </div>
            </Card>
          </div>
        </div>
      ) : null}

      <Card title="Productos">
        {/* Barra de acciones masivas */}
        {selectedProductIds.size > 0 && (
          <div className="products__bulkActions">
            <div className="products__bulkInfo">
              <input
                type="checkbox"
                checked={allProductsSelected}
                onChange={toggleSelectAllProducts}
                className="products__bulkCheckbox"
              />
              <span>{selectedProductIds.size} producto(s) seleccionado(s)</span>
              <button className="products__bulkClear" onClick={clearProductSelection}>
                ✕ Limpiar
              </button>
            </div>
            <div className="products__bulkButtons">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => bulkToggleActive(true)}
                disabled={isBulkActionLoading}
              >
                ✅ Activar
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => bulkToggleActive(false)}
                disabled={isBulkActionLoading}
              >
                ⏸️ Desactivar
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={bulkDeleteProducts}
                disabled={isBulkActionLoading}
              >
                🗑️ Eliminar
              </Button>
            </div>
          </div>
        )}

        {/* Header de selección */}
        {products.length > 0 && selectedProductIds.size === 0 && (
          <div className="products__listHeader">
            <label className="products__selectAllLabel">
              <input
                type="checkbox"
                checked={allProductsSelected}
                onChange={toggleSelectAllProducts}
                className="products__checkbox"
              />
              <span>Seleccionar todos ({products.length})</span>
            </label>
          </div>
        )}

        {products.length === 0 ? (
          <p className="muted">Aún no tienes productos.</p>
        ) : (
          <div className="products__list">
            {products.map((p) => (
              <div key={p.id} className={`products__row ${selectedProductIds.has(p.id) ? 'products__row--selected' : ''}`}>
                {/* Checkbox de selección */}
                <div className="products__selectBox">
                  <input
                    type="checkbox"
                    checked={selectedProductIds.has(p.id)}
                    onChange={() => toggleProductSelection(p.id)}
                    className="products__checkbox"
                  />
                </div>
                
                <div className="products__rowMain">
                  <input
                    className="products__inline"
                    value={p.name}
                    onChange={(e) =>
                      dispatch(patchProduct({ tenantId, productId: p.id, patch: { name: e.target.value } }))
                    }
                  />
                  <input
                    className="products__inline products__price"
                    key={`price-${p.id}-${p.price}`}
                    defaultValue={String(p.price)}
                    inputMode="decimal"
                    autoComplete="off"
                    onBlur={(e) => {
                      const next = parsePrice(e.target.value)
                      if (next === null) {
                        setPhotoStatus('Precio inválido. Usa 9.99 o 9,99.')
                        e.target.value = String(p.price)
                        return
                      }
                      dispatch(patchProduct({ tenantId, productId: p.id, patch: { price: next } }))
                    }}
                  />
                </div>

                <div className="products__rowActions">
                  <label className="products__toggle">
                    <input
                      type="checkbox"
                      checked={Boolean(p.active)}
                      onChange={(e) =>
                        dispatch(patchProduct({ tenantId, productId: p.id, patch: { active: e.target.checked } }))
                      }
                    />
                    <span>Activo</span>
                  </label>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => dispatch(deleteProduct({ tenantId, productId: p.id }))}
                  >
                    Eliminar
                  </Button>
                </div>

                <textarea
                  className="products__desc"
                  value={p.description || ''}
                  onChange={(e) =>
                    dispatch(patchProduct({ tenantId, productId: p.id, patch: { description: e.target.value } }))
                  }
                  placeholder="Descripción"
                />

                <div className="products__rowMeta">
                  <input
                    className="products__inline products__category"
                    value={p.category || ''}
                    onChange={(e) =>
                      dispatch(patchProduct({ tenantId, productId: p.id, patch: { category: e.target.value } }))
                    }
                    placeholder="Categoría"
                  />
                  <input
                    className="products__inline products__stock"
                    type="number"
                    min="0"
                    value={p.stock ?? ''}
                    onChange={(e) => {
                      const val = e.target.value
                      const stockVal = val === '' ? null : parseInt(val, 10)
                      dispatch(patchProduct({ tenantId, productId: p.id, patch: { stock: stockVal } }))
                    }}
                    placeholder="Stock"
                  />
                </div>

                <div className="products__imageRow">
                  {p.imageUrl ? (
                    <>
                      <img className="products__thumb" src={p.imageUrl} alt="" loading="lazy" />
                      <a className="products__imageLink" href={p.imageUrl} target="_blank" rel="noreferrer">
                        Ver imagen
                      </a>
                    </>
                  ) : (
                    <span className="products__noImage">Sin foto</span>
                  )}
                </div>

                <label className="products__file">
                  <span className="products__fileLabel">Cambiar foto</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      setPhotoStatus('Selecciona el recorte y presiona “Usar recorte”.')
                      openCropper({ file, mode: 'edit', productId: p.id, productName: p.name })
                      // permite re-subir el mismo archivo
                      e.target.value = ''
                    }}
                  />
                </label>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
