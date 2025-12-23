import { useEffect, useMemo, useRef, useState } from 'react'
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

  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [photoStatus, setPhotoStatus] = useState(null)

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

  const parsedPrice = useMemo(() => {
    const num = Number(price)
    return Number.isFinite(num) ? num : null
  }, [price])

  return (
    <div className="products">
      <Card
        title="Crear producto"
        actions={
          <Button
            size="sm"
            onClick={async () => {
              setPhotoStatus(null)
              if (!name.trim() || parsedPrice === null) return

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
                const msg = e?.message ? String(e.message) : 'Error subiendo foto'
                setPhotoStatus(msg)
              }

              setName('')
              setPrice('')
              setDescription('')
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
          <Input label="Precio" value={price} onChange={setPrice} placeholder="9.99" />
          <Input label="Descripción" value={description} onChange={setDescription} placeholder="Ingredientes..." />
          <label className="products__file">
            <span className="products__fileLabel">Foto</span>
            <input
              ref={createFileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            />
          </label>
          {!isSupabaseConfigured ? <p className="products__hint">Modo MOCK: la foto se guarda localmente.</p> : null}
          {photoStatus ? <p className="products__hint">{photoStatus}</p> : null}
          <p className="products__hint">Tip: el precio debe ser numérico.</p>
        </div>
      </Card>

      <Card title="Productos">
        {products.length === 0 ? (
          <p className="muted">Aún no tienes productos.</p>
        ) : (
          <div className="products__list">
            {products.map((p) => (
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
                    value={String(p.price)}
                    onChange={(e) => {
                      const next = Number(e.target.value)
                      if (!Number.isFinite(next)) return
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
                      try {
                        if (!isSupabaseConfigured) {
                          setPhotoStatus('Guardando foto localmente (modo MOCK)...')
                          const dataUrl = await fileToDataUrl(file)
                          await dispatch(patchProduct({ tenantId, productId: p.id, patch: { imageUrl: dataUrl } })).unwrap()
                          setPhotoStatus('Foto actualizada (local) ✅')
                        } else {
                          setPhotoStatus('Subiendo foto...')
                          const url = await uploadProductImage({ tenantId, productId: p.id, file })
                          await dispatch(patchProduct({ tenantId, productId: p.id, patch: { imageUrl: url } })).unwrap()
                          setPhotoStatus('Foto actualizada ✅')
                        }
                      } catch (err) {
                        const msg = err?.message ? String(err.message) : 'Error subiendo foto'
                        setPhotoStatus(msg)
                      } finally {
                        // permite re-subir el mismo archivo
                        e.target.value = ''
                      }
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
