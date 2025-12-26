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
import {
  createCategory,
  deleteCategory,
  fetchCategoriesForTenant,
  patchCategory,
  selectCategoriesForTenant,
} from '../../../features/categories/categoriesSlice'

export default function ProductsManager({ tenantId }) {
  const dispatch = useAppDispatch()
  const products = useAppSelector(selectProductsForTenant(tenantId))
  let categories = useAppSelector(selectCategoriesForTenant(tenantId))

  const createFileInputRef = useRef(null)

  useEffect(() => {
    dispatch(fetchProductsForTenant(tenantId))
    dispatch(fetchCategoriesForTenant(tenantId))
  }, [dispatch, tenantId])

  // Pestaña seleccionada (id de la categoría)
  // Buscar o crear la categoría "Sin asignar"
  const unassignedCategory = categories.find(c => c.name === 'Sin asignar')
  const unassignedCategoryId = unassignedCategory?.id
  if (!unassignedCategory) {
    categories = [
      { id: 'unassigned', name: 'Sin asignar', sort_order: -1, active: true },
      ...categories
    ]
  }
  const [selectedCategory, setSelectedCategory] = useState(categories[0]?.id)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [categoryName, setCategoryName] = useState('')
  const [editingCategory, setEditingCategory] = useState(null)
  const [editingProduct, setEditingProduct] = useState(null)

  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [stock, setStock] = useState('')
  const [trackStock, setTrackStock] = useState(false)
  const [productCategoryId, setProductCategoryId] = useState('')
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

  return (
    <div className="products">
      <Card
        title="Crear producto"
        actions={
          <Button
            size="sm"
            disabled={trackStock && (parseInt(stock, 10) || 0) <= 0}
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
                      categoryId: productCategoryId || null,
                      stock: trackStock ? (parseInt(stock, 10) || 0) : null,
                      trackStock,
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
              setStock('')
              setTrackStock(false)
              setProductCategoryId('')
              setImageFile(null)
              if (createFileInputRef.current) createFileInputRef.current.value = ''
            }}
          >
            {trackStock && (parseInt(stock, 10) || 0) <= 0 ? 'Sin stock' : 'Agregar'}
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
          
          {/* Selector de categoría */}
          <div className="products__field">
            <label className="products__label">Categoría</label>
            <select
              className="products__select"
              value={productCategoryId}
              onChange={(e) => setProductCategoryId(e.target.value)}
            >
              <option value="">Sin categoría</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          
          {/* Stock */}
          <div className="products__stockRow">
            <label className="products__toggle">
              <input
                type="checkbox"
                checked={trackStock}
                onChange={(e) => setTrackStock(e.target.checked)}
              />
              <span>Controlar stock</span>
            </label>
            {trackStock && (
              <Input
                label="Stock disponible"
                value={stock}
                onChange={setStock}
                placeholder="0"
                type="number"
                min="0"
              />
            )}
          </div>
          
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

      <Card
        title="Categorías y Productos"
      >
        {/* Pestañas de categorías */}
        <div className="products__categoryTabs">
          {categories.map((cat, idx) => (
            <div key={cat.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
              <button
                className={`products__categoryTab ${selectedCategory === cat.id ? 'products__categoryTab--active' : ''}`}
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.name}
              </button>
              {/* Si es la categoría seleccionada y no es 'Sin asignar', mostrar editar/borrar */}
              {selectedCategory === cat.id && cat.name !== 'Sin asignar' && (
                <span style={{ display: 'inline-flex', gap: 4, marginLeft: 4 }}>
                  <button
                    className="products__categoryTabEdit"
                    title="Editar categoría"
                    onClick={() => {
                      setEditingCategory(cat)
                      setCategoryName(cat.name)
                      setShowCategoryModal(true)
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}
                  >
                    <span role="img" aria-label="Editar">✏️</span>
                  </button>
                  <button
                    className="products__categoryTabDelete"
                    title="Eliminar categoría"
                    onClick={async () => {
                      if (window.confirm(`¿Eliminar la categoría "${cat.name}"? Los productos no se eliminarán, solo quedarán en "Sin asignar".`)) {
                        await dispatch(deleteCategory({ tenantId, categoryId: cat.id }))
                        if (selectedCategory === cat.id) {
                          setSelectedCategory(unassignedCategoryId || 'unassigned')
                        }
                      }
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c00' }}
                  >
                    <span role="img" aria-label="Eliminar">🗑️</span>
                  </button>
                </span>
              )}
              {/* Botón + verde al final */}
              {idx === categories.length - 1 && (
                <button
                  className="products__categoryTab"
                  style={{ marginLeft: 8, color: '#16a34a', borderColor: '#16a34a' }}
                  title="Agregar categoría"
                  onClick={() => {
                    setEditingCategory(null)
                    setCategoryName('')
                    setShowCategoryModal(true)
                  }}
                >
                  <span role="img" aria-label="Agregar">➕</span>
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Lista de productos filtrada */}
        {products.filter((p) => (p.categoryId || 'unassigned') === selectedCategory).length === 0 ? (
          <p className="muted">No hay productos en esta categoría.</p>
        ) : (
          <div className="products__list">
            {products
              .filter((p) => (p.categoryId || 'unassigned') === selectedCategory)
              .map((p) => (
              <div key={p.id} className="products__row">
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

                  {/* Stock toggle + input */}
                  <label className="products__toggle">
                    <input
                      type="checkbox"
                      checked={p.track_stock === true}
                      onChange={(e) =>
                        dispatch(
                          patchProduct({
                            tenantId,
                            productId: p.id,
                            patch: { track_stock: e.target.checked, stock: e.target.checked ? (p.stock ?? 0) : null },
                          })
                        )
                      }
                    />
                    <span>Stock</span>
                  </label>
                  {p.track_stock && (
                    <input
                      type="number"
                      className="products__stockInput"
                      min="0"
                      value={p.stock ?? 0}
                      onChange={(e) =>
                        dispatch(
                          patchProduct({
                            tenantId,
                            productId: p.id,
                            patch: { stock: Math.max(0, parseInt(e.target.value, 10) || 0) },
                          })
                        )
                      }
                    />
                  )}

                  {/* Selector de categoría */}
                  <select
                    className="products__categorySelect"
                    value={p.categoryId || 'unassigned'}
                    onChange={async (e) => {
                      let value = e.target.value
                      if (value === 'unassigned') {
                        // Buscar la categoría "Sin asignar" real
                        let realUnassigned = categories.find(c => c.name === 'Sin asignar')
                        if (!realUnassigned) {
                          const res = await dispatch(createCategory({ tenantId, category: { name: 'Sin asignar' } })).unwrap()
                          value = res?.row?.id || null
                        } else {
                          value = realUnassigned.id
                        }
                      }
                      dispatch(
                        patchProduct({
                          tenantId,
                          productId: p.id,
                          patch: { categoryId: value },
                        })
                      )
                    }}
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>

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

      {/* Modal de categoría */}
      {showCategoryModal && (
        <div className="products__modal-overlay" onClick={() => setShowCategoryModal(false)}>
          <div className="products__modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}</h3>
            <Input
              label="Nombre de la categoría"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="Ej: Bebidas, Postres..."
            />
            <div className="products__modal-actions">
              {editingCategory && (
                <Button
                  variant="danger"
                  onClick={() => {
                    dispatch(deleteCategory({ tenantId, categoryId: editingCategory.id }))
                    setShowCategoryModal(false)
                    setEditingCategory(null)
                    setCategoryName('')
                    if (selectedCategory === editingCategory.id) {
                      setSelectedCategory(null)
                    }
                  }}
                >
                  Eliminar
                </Button>
              )}
              <Button variant="secondary" onClick={() => setShowCategoryModal(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  if (!categoryName.trim()) return
                  if (editingCategory) {
                    dispatch(
                      patchCategory({
                        tenantId,
                        categoryId: editingCategory.id,
                        patch: { name: categoryName.trim() },
                      })
                    )
                  } else {
                    dispatch(createCategory({ tenantId, category: { name: categoryName.trim() } }))
                  }
                  setShowCategoryModal(false)
                  setEditingCategory(null)
                  setCategoryName('')
                }}
              >
                {editingCategory ? 'Guardar' : 'Crear'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
