import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import './StorefrontPage.css'
import { useAppSelector } from '../../app/hooks'
import { useAppDispatch } from '../../app/hooks'
import { fetchTenantBySlug, selectTenantBySlug, selectTenantFetchError, selectTenantFetchStatus } from '../../features/tenants/tenantsSlice'
import { fetchProductsForTenant, selectProductsForTenant, createProduct, patchProduct, deleteProduct } from '../../features/products/productsSlice'
import ThemeApplier from '../../components/theme/ThemeApplier'
import { fetchTenantTheme, selectThemeForTenant, saveTenantTheme, upsertTenantTheme } from '../../features/theme/themeSlice'
import { selectUser } from '../../features/auth/authSlice'
import ProductCard from '../../components/storefront/ProductCard/ProductCard'
import CartPanel from '../../components/storefront/CartPanel/CartPanel'
import { createPaidOrder } from '../../features/orders/ordersSlice'
import Button from '../../components/ui/Button/Button'
import Input from '../../components/ui/Input/Input'
import {
  SUBSCRIPTION_TIERS,
  TIER_LABELS,
  PRODUCT_CARD_LAYOUTS,
  isFeatureAvailable,
} from '../../shared/subscriptions'

export default function StorefrontPage() {
  const { slug } = useParams()
  const dispatch = useAppDispatch()
  const tenant = useAppSelector(selectTenantBySlug(slug))
  const status = useAppSelector(selectTenantFetchStatus(slug))
  const error = useAppSelector(selectTenantFetchError(slug))
  const tenantId = tenant?.id
  const user = useAppSelector(selectUser)
  const theme = useAppSelector(selectThemeForTenant(tenantId))

  // Check if current user is admin of this tenant or super_admin
  const isSuperAdmin = user?.role === 'super_admin'
  const isAdmin = (user?.tenantId === tenantId && user?.role === 'tenant_admin') || isSuperAdmin

  const products = useAppSelector(selectProductsForTenant(tenantId || 'tenant_demo'))
  const visible = useMemo(() => products.filter((p) => p.active), [products])

  const [cart, setCart] = useState({})
  const [paid, setPaid] = useState(false)
  const [lastOrderId, setLastOrderId] = useState(null)
  const checkoutRef = useRef(null)

  // Product modal state
  const [showProductModal, setShowProductModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [productForm, setProductForm] = useState({ name: '', price: '', description: '', imageUrl: '' })
  const [savingProduct, setSavingProduct] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  // Card customization panel state
  const [showCardPanel, setShowCardPanel] = useState(false)
  const [localCardTheme, setLocalCardTheme] = useState(null)
  const [savingTheme, setSavingTheme] = useState(false)

  // Get subscription tier from tenant (super_admin bypasses tier restrictions)
  const subscriptionTier = tenant?.subscription_tier || SUBSCRIPTION_TIERS.FREE
  const effectiveTier = isSuperAdmin ? SUBSCRIPTION_TIERS.PREMIUM_PRO : subscriptionTier

  // Get card layout from theme (local for preview, or saved)
  const cardTheme = localCardTheme || theme || {}
  const cardLayout = cardTheme?.productCardLayout || 'classic'
  const cardColors = {
    cardBg: cardTheme?.cardBg || '#ffffff',
    cardText: cardTheme?.cardText || '#1f2937',
    cardDesc: cardTheme?.cardDesc || '#6b7280',
    cardPrice: cardTheme?.cardPrice || '#059669',
    cardButton: cardTheme?.cardButton || theme?.accent || '#f59e0b',
  }

  // Update local card theme (for live preview)
  const updateCardTheme = (patch) => {
    setLocalCardTheme(prev => ({
      ...(prev || theme || {}),
      ...patch
    }))
  }

  // Save card theme to database
  const saveCardTheme = async () => {
    if (!localCardTheme) return
    setSavingTheme(true)
    try {
      await dispatch(saveTenantTheme({ tenantId, theme: localCardTheme }))
      setLocalCardTheme(null)
    } finally {
      setSavingTheme(false)
    }
  }

  // Discard changes
  const discardCardChanges = () => {
    setLocalCardTheme(null)
  }

  const hasCardChanges = localCardTheme !== null

  const cartCount = useMemo(
    () => Object.values(cart).reduce((acc, n) => acc + (Number(n) || 0), 0),
    [cart],
  )

  const cartTotal = useMemo(() => {
    const map = new Map(visible.map((p) => [p.id, p]))
    return Object.entries(cart).reduce((acc, [productId, qty]) => {
      const p = map.get(productId)
      if (!p) return acc
      return acc + Number(p.price) * Number(qty)
    }, 0)
  }, [cart, visible])

  const cartItems = useMemo(() => {
    const map = new Map(visible.map((p) => [p.id, p]))
    return Object.entries(cart)
      .map(([productId, qty]) => {
        const product = map.get(productId)
        if (!product) return null
        const safeQty = Number(qty) || 0
        return {
          product,
          qty: safeQty,
          lineTotal: Number(product.price) * safeQty,
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.lineTotal - a.lineTotal)
  }, [cart, visible])

  const orderItemsPayload = useMemo(() => {
    return cartItems.map((it) => ({
      productId: it.product.id,
      name: it.product.name,
      unitPrice: Number(it.product.price),
      qty: it.qty,
      lineTotal: it.lineTotal,
    }))
  }, [cartItems])

  const addOne = (productId) =>
    setCart((c) => {
      setPaid(false)
      return { ...c, [productId]: (c[productId] || 0) + 1 }
    })

  const removeOne = (productId) =>
    setCart((c) => {
      setPaid(false)
      const next = Math.max(0, (c[productId] || 0) - 1)
      if (next === 0) {
        const { [productId]: _removed, ...rest } = c
        return rest
      }
      return { ...c, [productId]: next }
    })

  // Product management functions
  const openAddProduct = () => {
    setEditingProduct(null)
    setProductForm({ name: '', price: '', description: '', imageUrl: '' })
    setShowProductModal(true)
  }

  const openEditProduct = (product) => {
    setEditingProduct(product)
    setProductForm({
      name: product.name || '',
      price: String(product.price || ''),
      description: product.description || '',
      imageUrl: product.imageUrl || '',
    })
    setShowProductModal(true)
  }

  const handleSaveProduct = async () => {
    if (!productForm.name.trim() || !productForm.price) return
    
    setSavingProduct(true)
    try {
      if (editingProduct) {
        await dispatch(patchProduct({
          tenantId,
          productId: editingProduct.id,
          patch: {
            name: productForm.name.trim(),
            price: Number(productForm.price),
            description: productForm.description.trim(),
            imageUrl: productForm.imageUrl.trim() || null,
          }
        })).unwrap()
      } else {
        await dispatch(createProduct({
          tenantId,
          name: productForm.name.trim(),
          price: Number(productForm.price),
          description: productForm.description.trim(),
          imageUrl: productForm.imageUrl.trim() || null,
        })).unwrap()
      }
      setShowProductModal(false)
      setEditingProduct(null)
    } catch (e) {
      console.error('Error saving product:', e)
    } finally {
      setSavingProduct(false)
    }
  }

  const handleDeleteProduct = async (product) => {
    if (deleteConfirm !== product.id) {
      setDeleteConfirm(product.id)
      setTimeout(() => setDeleteConfirm(null), 3000)
      return
    }
    
    try {
      await dispatch(deleteProduct({ tenantId, productId: product.id })).unwrap()
      setDeleteConfirm(null)
    } catch (e) {
      console.error('Error deleting product:', e)
    }
  }

  useEffect(() => {
    if (!slug) return
    dispatch(fetchTenantBySlug(slug))
  }, [dispatch, slug])

  useEffect(() => {
    if (!tenantId) return
    dispatch(fetchProductsForTenant(tenantId))
    dispatch(fetchTenantTheme(tenantId))
  }, [dispatch, tenantId])

  if (!tenant) {
    if (status === 'loading' || status === 'idle') {
      return (
        <div className="store">
          <h1>Cargando tienda...</h1>
          <p className="muted">Buscando el restaurante.</p>
        </div>
      )
    }

    if (status === 'error') {
      return (
        <div className="store">
          <h1>No se pudo cargar la tienda</h1>
          <p className="muted">{error || 'Error desconocido'}</p>
          <p className="muted">
            Si estás en Vercel, revisa que el deploy tenga `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
          </p>
        </div>
      )
    }

    return (
      <div className="store">
        <h1>Tienda no encontrada</h1>
        <p className="muted">No existe un restaurante con ese slug.</p>
      </div>
    )
  }

  return (
    <div className="store">
      <ThemeApplier tenantId={tenantId} />
      <header className="store__header">
        <div>
          <h1 className="store__title">{tenant.name}</h1>
          <p className="muted">Menú público</p>
        </div>

        <div className="store__summaryPill" aria-label="Resumen carrito">
          <div className="store__summaryTop">{cartCount} item{cartCount === 1 ? '' : 's'}</div>
          <div className="store__summaryBottom">${cartTotal.toFixed(2)}</div>
        </div>
      </header>

      <div className="store__layout">
        <section className="store__products" aria-label="Productos">
          {isAdmin && (
            <div className="store__adminBar">
              <span className="store__adminLabel">🔧 Modo administrador</span>
              <div className="store__adminActions">
                <Button size="sm" variant="secondary" onClick={() => setShowCardPanel(!showCardPanel)}>
                  🎨 Personalizar Cards
                </Button>
                <Button size="sm" onClick={openAddProduct}>
                  ➕ Agregar producto
                </Button>
              </div>
            </div>
          )}

          {/* Card Customization Panel */}
          {isAdmin && showCardPanel && (
            <div className="store__cardPanelWrapper">
              {/* Panel de controles */}
              <div className="store__cardPanel">
                <div className="store__cardPanelHeader">
                  <h4>🃏 Personalizar Cards</h4>
                  <button type="button" className="store__cardPanelClose" onClick={() => setShowCardPanel(false)}>✕</button>
                </div>

                {/* Layout Selector */}
                <div className="store__cardSection">
                  <label className="store__cardSectionTitle">Layout</label>
                  <div className="store__layoutGrid">
                    {Object.entries(PRODUCT_CARD_LAYOUTS).map(([layoutId, config]) => {
                      const available = isFeatureAvailable(config.tier, effectiveTier)
                      const isSelected = cardLayout === layoutId
                      
                      return (
                        <button
                          key={layoutId}
                          type="button"
                          className={`store__layoutBtn ${isSelected ? 'selected' : ''} ${!available ? 'locked' : ''}`}
                          onClick={() => available && updateCardTheme({ productCardLayout: layoutId })}
                          disabled={!available}
                          title={config.description}
                        >
                          <span className="store__layoutIcon">
                            {layoutId === 'classic' && '📐'}
                            {layoutId === 'horizontal' && '↔️'}
                            {layoutId === 'overlay' && '🖼️'}
                            {layoutId === 'compact' && '📦'}
                            {layoutId === 'magazine' && '📰'}
                            {layoutId === 'minimal' && '✨'}
                            {layoutId === 'polaroid' && '📸'}
                            {layoutId === 'banner' && '🏷️'}
                          </span>
                          <span className="store__layoutName">{config.label}</span>
                          {!available && <span className="store__layoutLock">🔒</span>}
                          {config.tier === SUBSCRIPTION_TIERS.PREMIUM && <span className="store__tierBadge premium">⭐</span>}
                          {config.tier === SUBSCRIPTION_TIERS.PREMIUM_PRO && <span className="store__tierBadge pro">👑</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Color Pickers */}
                <div className="store__cardSection">
                  <label className="store__cardSectionTitle">Colores</label>
                  <div className="store__colorGrid">
                    <div className="store__colorItem">
                      <input
                        type="color"
                        value={cardColors.cardBg}
                        onChange={(e) => updateCardTheme({ cardBg: e.target.value })}
                        className="store__colorInput"
                      />
                      <span>Fondo</span>
                    </div>
                    <div className="store__colorItem">
                      <input
                        type="color"
                        value={cardColors.cardText}
                        onChange={(e) => updateCardTheme({ cardText: e.target.value })}
                        className="store__colorInput"
                      />
                      <span>Título</span>
                    </div>
                    <div className="store__colorItem">
                      <input
                        type="color"
                        value={cardColors.cardDesc}
                        onChange={(e) => updateCardTheme({ cardDesc: e.target.value })}
                        className="store__colorInput"
                      />
                      <span>Descripción</span>
                    </div>
                    <div className="store__colorItem">
                      <input
                        type="color"
                        value={cardColors.cardPrice}
                        onChange={(e) => updateCardTheme({ cardPrice: e.target.value })}
                        className="store__colorInput"
                      />
                      <span>Precio</span>
                    </div>
                    <div className="store__colorItem">
                      <input
                        type="color"
                        value={cardColors.cardButton}
                        onChange={(e) => updateCardTheme({ cardButton: e.target.value })}
                        className="store__colorInput"
                      />
                      <span>Botón</span>
                    </div>
                  </div>
                </div>

                {/* Save/Discard buttons */}
                {hasCardChanges && (
                  <div className="store__cardPanelActions">
                    <Button size="sm" variant="secondary" onClick={discardCardChanges} disabled={savingTheme}>
                      Descartar
                    </Button>
                    <Button size="sm" onClick={saveCardTheme} disabled={savingTheme}>
                      {savingTheme ? 'Guardando...' : 'Guardar'}
                    </Button>
                  </div>
                )}
              </div>

              {/* Vista previa en vivo */}
              <div className="store__cardPreview">
                <div className="store__cardPreviewHeader">
                  <h4>👁️ Vista Previa</h4>
                  {hasCardChanges && <span className="store__previewBadge">Sin guardar</span>}
                </div>
                <div className="store__cardPreviewContent">
                  <ProductCard
                    product={{ 
                      id: 'preview', 
                      name: 'Producto de ejemplo', 
                      price: 12.99, 
                      description: 'Esta es una descripción de ejemplo para visualizar el diseño.',
                      imageUrl: null
                    }}
                    quantity={1}
                    onAdd={() => {}}
                    onRemove={() => {}}
                    layout={cardLayout}
                    colors={cardColors}
                    isEditable={false}
                  />
                </div>
              </div>
            </div>
          )}
          
          <div className="store__grid">
            {visible.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                quantity={cart[p.id] || 0}
                onAdd={() => addOne(p.id)}
                onRemove={() => removeOne(p.id)}
                layout={cardLayout}
                colors={cardColors}
                isEditable={isAdmin}
                onEdit={openEditProduct}
                onDelete={handleDeleteProduct}
              />
            ))}
            
            {/* Add product card for admin */}
            {isAdmin && (
              <button 
                className="store__addProductCard"
                onClick={openAddProduct}
                type="button"
              >
                <span className="store__addIcon">➕</span>
                <span className="store__addText">Agregar producto</span>
              </button>
            )}
          </div>
        </section>

        <CartPanel
          items={cartItems}
          total={cartTotal}
          onAdd={addOne}
          onRemove={removeOne}
          onClear={() => {
            setPaid(false)
            setCart({})
          }}
          onCheckout={() => checkoutRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        />
      </div>

      {visible.length === 0 ? <p className="muted">No hay productos activos.</p> : null}

      <section className="checkout" ref={checkoutRef} aria-label="Checkout">
        <h2 className="checkout__title">Pagar</h2>
        <p className="muted">Esto es una simulación (sin pasarela de pago). Sirve para probar el flujo.</p>

        <div className="checkout__box">
          <div className="checkout__row">
            <span>Items</span>
            <strong>{cartCount}</strong>
          </div>
          <div className="checkout__row">
            <span>Total</span>
            <strong>${cartTotal.toFixed(2)}</strong>
          </div>

          <button
            className="checkout__payBtn"
            type="button"
            disabled={cartCount === 0}
            onClick={async () => {
              if (cartCount === 0) return
              setPaid(false)
              setLastOrderId(null)

              try {
                const res = await dispatch(
                  createPaidOrder({
                    tenantId,
                    items: orderItemsPayload,
                    total: cartTotal,
                    customer: null,
                  }),
                ).unwrap()

                setPaid(true)
                setLastOrderId(res?.order?.id || null)
                setCart({})
              } catch {
                // fallback: keep cart
              }
            }}
          >
            Pagar
          </button>

          {paid ? (
            <div className="checkout__success">
              Pago registrado. Pedido creado{lastOrderId ? `: ${lastOrderId}` : ''}.
            </div>
          ) : null}
        </div>
      </section>

      {/* Product Modal */}
      {showProductModal && (
        <div className="store__modalOverlay" onClick={() => setShowProductModal(false)}>
          <div className="store__modal" onClick={(e) => e.stopPropagation()}>
            <div className="store__modalHeader">
              <h3>{editingProduct ? 'Editar producto' : 'Nuevo producto'}</h3>
              <button 
                className="store__modalClose" 
                type="button"
                onClick={() => setShowProductModal(false)}
              >
                ✕
              </button>
            </div>
            
            <div className="store__modalBody">
              <Input
                label="Nombre del producto"
                value={productForm.name}
                onChange={(v) => setProductForm(f => ({ ...f, name: v }))}
                placeholder="Ej: Hamburguesa Clásica"
              />
              
              <Input
                label="Precio"
                type="number"
                value={productForm.price}
                onChange={(v) => setProductForm(f => ({ ...f, price: v }))}
                placeholder="9.99"
              />
              
              <Input
                label="Descripción"
                value={productForm.description}
                onChange={(v) => setProductForm(f => ({ ...f, description: v }))}
                placeholder="Descripción del producto..."
              />
              
              <Input
                label="URL de imagen (opcional)"
                value={productForm.imageUrl}
                onChange={(v) => setProductForm(f => ({ ...f, imageUrl: v }))}
                placeholder="https://..."
              />
              
              {productForm.imageUrl && (
                <div className="store__imagePreview">
                  <img src={productForm.imageUrl} alt="Preview" />
                </div>
              )}
            </div>
            
            <div className="store__modalFooter">
              <Button variant="secondary" onClick={() => setShowProductModal(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSaveProduct} 
                disabled={savingProduct || !productForm.name.trim() || !productForm.price}
              >
                {savingProduct ? 'Guardando...' : (editingProduct ? 'Guardar cambios' : 'Crear producto')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation toast */}
      {deleteConfirm && (
        <div className="store__deleteToast">
          ⚠️ Haz clic de nuevo para confirmar la eliminación
        </div>
      )}
    </div>
  )
}
