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
import StoreHeader from '../../components/storefront/StoreHeader/StoreHeader'
import { createPaidOrder } from '../../features/orders/ordersSlice'
import Button from '../../components/ui/Button/Button'
import Input from '../../components/ui/Input/Input'
import { loadJson, saveJson } from '../../shared/storage'
import { fetchDeliveryConfig } from '../../lib/supabaseApi'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import {
  SUBSCRIPTION_TIERS,
  TIER_LABELS,
  PRODUCT_CARD_LAYOUTS,
  STORE_HERO_STYLES,
  isFeatureAvailable,
} from '../../shared/subscriptions'
import { uploadHeroImage } from '../../lib/supabaseStorage'
import {
  Wrench,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Palette,
  LayoutGrid,
  Image,
  Save,
  Trash2,
  X,
  Lock,
  Star,
  Crown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Upload,
  Loader2,
  PartyPopper,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Grid3X3,
  Rows3,
  Layers,
  Package,
  Newspaper,
  Camera,
  Tag,
  FolderUp,
  ChevronRight,
  Settings,
} from 'lucide-react'

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

  // Cart panel state
  const [showCart, setShowCart] = useState(false)
  
  // Checkout page state - replaces the cards view
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [checkoutData, setCheckoutData] = useState({
    customerName: '',
    customerPhone: '',
    deliveryType: 'mostrador',
    deliveryAddress: '',
    deliveryNotes: '',
    paymentMethod: 'efectivo',
  })
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState(null)
  
  // Configuración de tipos de envío (cargada desde Supabase, con localStorage como cache)
  const deliveryConfigKey = `deliveryConfig.${tenantId}`
  const [deliveryConfig, setDeliveryConfig] = useState({
    mostrador: true,
    domicilio: true,
    mesa: true,
  })
  const [loadingDeliveryConfig, setLoadingDeliveryConfig] = useState(true)

  // Cargar deliveryConfig desde Supabase cuando cambia el tenantId
  useEffect(() => {
    const loadConfig = async () => {
      if (!tenantId) return
      setLoadingDeliveryConfig(true)
      try {
        if (isSupabaseConfigured) {
          const config = await fetchDeliveryConfig(tenantId)
          setDeliveryConfig(config)
          // Guardar en localStorage como cache
          saveJson(deliveryConfigKey, config)
        } else {
          // Fallback a localStorage si no hay Supabase
          const cached = loadJson(deliveryConfigKey, { mostrador: true, domicilio: true, mesa: true })
          setDeliveryConfig(cached)
        }
      } catch (err) {
        console.error('Error loading delivery config:', err)
        // Fallback a localStorage
        const cached = loadJson(deliveryConfigKey, { mostrador: true, domicilio: true, mesa: true })
        setDeliveryConfig(cached)
      } finally {
        setLoadingDeliveryConfig(false)
      }
    }
    loadConfig()
  }, [tenantId, deliveryConfigKey])

  // Hero customization panel state
  const [showHeroPanel, setShowHeroPanel] = useState(false)
  const [localHeroTheme, setLocalHeroTheme] = useState(null)
  const [heroPreviewMode, setHeroPreviewMode] = useState(false)
  const [uploadingHeroImage, setUploadingHeroImage] = useState(null) // slide index being uploaded
  const heroFileInputRef = useRef(null)
  const heroPanelRef = useRef(null)
  const cardPanelRef = useRef(null)

  // Hero/carousel state (local for preview, or saved)
  const heroTheme = localHeroTheme || theme || {}
  const heroStyle = heroTheme?.heroStyle || 'simple'
  const heroSlides = heroTheme?.heroSlides || [
    { title: tenant?.name || 'Bienvenido', subtitle: 'Explora nuestros productos', imageUrl: '', ctaText: 'Ver menú', ctaLink: '#productos' }
  ]
  const heroTitlePosition = heroTheme?.heroTitlePosition || 'center'
  const heroOverlayOpacity = heroTheme?.heroOverlayOpacity ?? 50

  // Get subscription tier from tenant (super_admin bypasses tier restrictions)
  // Check if premium is still active (not expired)
  const subscriptionTier = (() => {
    const tier = tenant?.subscription_tier || SUBSCRIPTION_TIERS.FREE
    const premiumUntil = tenant?.premium_until
    
    if (tier !== SUBSCRIPTION_TIERS.FREE && premiumUntil) {
      try {
        const expiryDate = new Date(premiumUntil)
        const now = new Date()
        if (!isNaN(expiryDate.getTime()) && expiryDate > now) {
          return tier
        }
      } catch (e) {
        console.warn('Error calculando premium_until:', e)
      }
    }
    return SUBSCRIPTION_TIERS.FREE
  })()
  
  const effectiveTier = isSuperAdmin ? SUBSCRIPTION_TIERS.PREMIUM_PRO : subscriptionTier

  // Hero limits by tier
  const canUploadHeroImage = effectiveTier !== SUBSCRIPTION_TIERS.FREE
  const maxHeroSlides = effectiveTier === SUBSCRIPTION_TIERS.PREMIUM_PRO ? 3 : 
                        effectiveTier === SUBSCRIPTION_TIERS.PREMIUM ? 1 : 1
  const canAddMoreSlides = heroSlides.length < maxHeroSlides

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

  // Update local hero theme (for live preview)
  const updateHeroTheme = (patch) => {
    setLocalHeroTheme(prev => ({
      ...(prev || theme || {}),
      ...patch
    }))
  }

  // Update a specific slide
  const updateHeroSlide = (index, field, value) => {
    const updatedSlides = [...heroSlides]
    updatedSlides[index] = { ...updatedSlides[index], [field]: value }
    updateHeroTheme({ heroSlides: updatedSlides })
  }

  // Add new slide
  const addHeroSlide = () => {
    updateHeroTheme({
      heroSlides: [...heroSlides, {
        title: 'Nuevo slide',
        subtitle: 'Descripción del slide',
        imageUrl: '',
        ctaText: 'Ver más',
        ctaLink: '#productos',
      }]
    })
  }

  // Delete slide
  const deleteHeroSlide = (index) => {
    updateHeroTheme({
      heroSlides: heroSlides.filter((_, i) => i !== index)
    })
  }

  // Handle hero image file upload
  const handleHeroImageUpload = async (index, file) => {
    if (!file || !canUploadHeroImage) return
    setUploadingHeroImage(index)
    try {
      const publicUrl = await uploadHeroImage({ tenantId, file })
      updateHeroSlide(index, 'imageUrl', publicUrl)
    } catch (err) {
      console.error('Error subiendo imagen del hero:', err)
      alert('Error al subir la imagen: ' + (err.message || 'Error desconocido'))
    } finally {
      setUploadingHeroImage(null)
    }
  }

  // Save hero theme
  const saveHeroTheme = async () => {
    if (!localHeroTheme) return
    setSavingTheme(true)
    try {
      await dispatch(saveTenantTheme({ tenantId, theme: localHeroTheme }))
      setLocalHeroTheme(null)
      setShowHeroPanel(false) // Cerrar panel al guardar
      setHeroPreviewMode(false)
    } finally {
      setSavingTheme(false)
    }
  }

  // Discard hero changes
  const discardHeroChanges = () => {
    setLocalHeroTheme(null)
  }

  const hasHeroChanges = localHeroTheme !== null

  // Save all changes (hero + cards)
  const saveAllChanges = async () => {
    setSavingTheme(true)
    try {
      const mergedTheme = {
        ...(theme || {}),
        ...(localCardTheme || {}),
        ...(localHeroTheme || {}),
      }
      await dispatch(saveTenantTheme({ tenantId, theme: mergedTheme }))
      setLocalCardTheme(null)
      setLocalHeroTheme(null)
    } finally {
      setSavingTheme(false)
    }
  }

  const hasAnyChanges = hasCardChanges || hasHeroChanges

  const cartCount = useMemo(
    () => Object.values(cart).reduce((acc, n) => acc + (Number(n) || 0), 0),
    [cart],
  )

  const cartTotal = useMemo(() => {
    const map = new Map(visible.map((p) => [p.id, p]))
    const total = Object.entries(cart).reduce((acc, [productId, qty]) => {
      const p = map.get(productId)
      if (!p) return acc
      const price = parseFloat(p.price) || 0
      const quantity = parseInt(qty, 10) || 0
      return acc + (price * quantity)
    }, 0)
    // Redondear a 2 decimales para evitar overflow numérico
    return Math.round(total * 100) / 100
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

  // Add/remove body class for preview mode (to hide global header)
  useEffect(() => {
    if (heroPreviewMode) {
      document.body.classList.add('store-preview-mode')
    } else {
      document.body.classList.remove('store-preview-mode')
    }
    return () => {
      document.body.classList.remove('store-preview-mode')
    }
  }, [heroPreviewMode])

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
    <div className={`store ${heroPreviewMode ? 'store--previewMode' : ''}`}>
      {/* Preview Mode Bar - appears at top when in preview */}
      {isAdmin && heroPreviewMode && (
        <div className="store__previewBar">
          <span className="store__previewBarText"><Eye size={16} /> Vista previa — Así ven tu tienda los clientes</span>
          <div className="store__previewBarActions">
            {hasAnyChanges && (
              <Button size="sm" variant="primary" onClick={saveAllChanges} disabled={savingTheme}>
                {savingTheme ? <><Loader2 size={14} className="icon-spin" /> Guardando...</> : <><Save size={14} /> Guardar cambios</>}
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => setHeroPreviewMode(false)}>
              <EyeOff size={14} /> Salir de vista previa
            </Button>
          </div>
        </div>
      )}

      <ThemeApplier tenantId={tenantId} />
      
      {/* Store Header with Carousel */}
      <StoreHeader
        tenant={tenant}
        theme={theme}
        heroStyle={heroStyle}
        slides={heroSlides}
        titlePosition={heroTitlePosition}
        overlayOpacity={heroOverlayOpacity}
        cart={cart}
        onOpenCart={() => setShowCart(true)}
      />

      <div className="store__layout" id="productos">
        <section className="store__products" aria-label="Productos">
          {isAdmin && (
            <div className="store__adminBar">
              <span className="store__adminLabel"><Wrench size={14} /> Modo administrador</span>
              <div className="store__adminActions">
                <Button 
                  size="sm" 
                  variant={heroPreviewMode ? 'primary' : 'secondary'}
                  onClick={() => setHeroPreviewMode(!heroPreviewMode)}
                >
                  {heroPreviewMode ? <><Pencil size={14} /> Salir de vista previa</> : <><Eye size={14} /> Ver como cliente</>}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => {
                  const willShow = !showHeroPanel
                  setShowHeroPanel(willShow)
                  if (willShow) {
                    setShowCardPanel(false)
                    setTimeout(() => heroPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
                  }
                }}>
                  <Image size={14} /> Header / Carrusel
                </Button>
                <Button size="sm" variant="secondary" onClick={() => {
                  const willShow = !showCardPanel
                  setShowCardPanel(willShow)
                  if (willShow) {
                    setShowHeroPanel(false)
                    setTimeout(() => cardPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
                  }
                }}>
                  <LayoutGrid size={14} /> Personalizar Cards
                </Button>
                <Button size="sm" onClick={openAddProduct}>
                  <Plus size={14} /> Agregar producto
                </Button>
              </div>
            </div>
          )}

          {/* Hero Customization Panel */}
          {isAdmin && showHeroPanel && (
            <div className="store__heroPanelWrapper" ref={heroPanelRef}>
              {/* Preview Toggle Button - at the top - hidden in preview mode */}
              {!heroPreviewMode && (
                <div className="store__heroPreviewToggle">
                  <button type="button" className="store__heroPanelClose" onClick={() => {
                    setShowHeroPanel(false)
                    setHeroPreviewMode(false)
                  }}><X size={16} /></button>
                  <span className="store__heroPreviewHint"><Eye size={14} /> Activa la vista previa para ver los cambios</span>
                </div>
              )}

              {/* Floating button to exit preview mode */}
              {heroPreviewMode && (
                <div className="store__heroPreviewExit">
                  <Button size="sm" onClick={() => setHeroPreviewMode(false)}>
                    <Pencil size={14} /> Volver a editar
                  </Button>
                </div>
              )}

              {!heroPreviewMode && (
              <div className="store__heroPanel">
                
                {/* Editing controls - hidden in preview mode */}
                {!heroPreviewMode && (
                  <>
                    {/* Style Selector */}
                    <div className="store__heroSection">
                      <label className="store__heroSectionTitle">Estilo del Carrusel</label>
                      <div className="store__heroStylesGrid">
                        {Object.entries(STORE_HERO_STYLES).map(([styleId, config]) => {
                          const available = isFeatureAvailable(config.tier, effectiveTier)
                      const isSelected = heroStyle === styleId
                      return (
                        <button
                          key={styleId}
                          type="button"
                          className={`store__heroStyleOption ${isSelected ? 'store__heroStyleOption--selected' : ''} ${!available ? 'store__heroStyleOption--locked' : ''}`}
                          onClick={() => available && updateHeroTheme({ heroStyle: styleId })}
                          disabled={!available}
                          title={available ? config.description : `Requiere ${TIER_LABELS[config.tier]}`}
                        >
                          <span className="store__heroStyleIcon">{config.icon || ''}</span>
                          <span className="store__heroStyleLabel">{config.label}</span>
                          {!available && (
                            <span className="store__heroStyleTier">
                              {config.tier === SUBSCRIPTION_TIERS.PREMIUM ? <Star size={12} /> : <Crown size={12} />}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Title Position */}
                <div className="store__heroSection">
                  <label className="store__heroSectionTitle">Posición del Título</label>
                  <div className="store__heroPositionGrid">
                    {['left', 'center', 'right'].map((pos) => (
                      <button
                        key={pos}
                        type="button"
                        className={`store__heroPositionBtn ${heroTitlePosition === pos ? 'store__heroPositionBtn--selected' : ''}`}
                        onClick={() => updateHeroTheme({ heroTitlePosition: pos })}
                      >
                        {pos === 'left' ? <><AlignLeft size={14} /> Izquierda</> : pos === 'center' ? <><AlignCenter size={14} /> Centro</> : <><AlignRight size={14} /> Derecha</>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Overlay Opacity */}
                <div className="store__heroSection">
                  <label className="store__heroSectionTitle">Opacidad del Overlay: {heroOverlayOpacity}%</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={heroOverlayOpacity}
                    onChange={(e) => updateHeroTheme({ heroOverlayOpacity: Number(e.target.value) })}
                    className="store__heroRangeInput"
                  />
                </div>

                {/* Slides Editor */}
                <div className="store__heroSection">
                  <div className="store__heroSlidesHeader">
                    <label className="store__heroSectionTitle">
                      Slides del Carrusel ({heroSlides.length}/{maxHeroSlides})
                      {effectiveTier === SUBSCRIPTION_TIERS.FREE && (
                        <span className="store__heroTierNote"> - <Star size={12} /> Premium para imágenes</span>
                      )}
                    </label>
                    {canAddMoreSlides ? (
                      <Button size="sm" variant="secondary" onClick={addHeroSlide}>
                        <Plus size={14} /> Añadir Slide
                      </Button>
                    ) : (
                      <span className="store__heroLimitNote">
                        {effectiveTier === SUBSCRIPTION_TIERS.PREMIUM 
                          ? <><Crown size={12} /> Pro para más slides</> 
                          : 'Máximo alcanzado'}
                      </span>
                    )}
                  </div>
                  
                  <div className="store__heroSlidesList">
                    {heroSlides.map((slide, index) => (
                      <div key={index} className="store__heroSlideItem">
                        <div className="store__heroSlideNumber">{index + 1}</div>
                        <div className="store__heroSlideFields">
                          <input
                            type="text"
                            placeholder="Título"
                            value={slide.title || ''}
                            onChange={(e) => updateHeroSlide(index, 'title', e.target.value)}
                            className="store__heroSlideInput"
                          />
                          <input
                            type="text"
                            placeholder="Subtítulo"
                            value={slide.subtitle || ''}
                            onChange={(e) => updateHeroSlide(index, 'subtitle', e.target.value)}
                            className="store__heroSlideInput"
                          />
                          {canUploadHeroImage ? (
                            <div className="store__heroImageUpload">
                              <input
                                type="text"
                                placeholder="URL de imagen o sube un archivo"
                                value={slide.imageUrl || ''}
                                onChange={(e) => updateHeroSlide(index, 'imageUrl', e.target.value)}
                                className="store__heroSlideInput"
                              />
                              <label className="store__heroUploadBtn">
                                {uploadingHeroImage === index ? <Loader2 size={16} className="icon-spin" /> : <FolderUp size={16} />}
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file) handleHeroImageUpload(index, file)
                                    e.target.value = ''
                                  }}
                                  disabled={uploadingHeroImage !== null}
                                  hidden
                                />
                              </label>
                            </div>
                          ) : (
                            <div className="store__heroLockedField">
                              <Lock size={14} /> Imagen de fondo disponible con <Star size={12} /> Premium
                            </div>
                          )}
                          <div className="store__heroSlideRow">
                            <input
                              type="text"
                              placeholder="Texto del botón"
                              value={slide.ctaText || ''}
                              onChange={(e) => updateHeroSlide(index, 'ctaText', e.target.value)}
                              className="store__heroSlideInput"
                            />
                            <input
                              type="text"
                              placeholder="Enlace"
                              value={slide.ctaLink || ''}
                              onChange={(e) => updateHeroSlide(index, 'ctaLink', e.target.value)}
                              className="store__heroSlideInput"
                            />
                          </div>
                        </div>
                        {heroSlides.length > 1 && (
                          <button
                            type="button"
                            className="store__heroSlideDelete"
                            onClick={() => deleteHeroSlide(index)}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                  </>
                )}

                {/* Preview mode message */}
                {heroPreviewMode && (
                  <div className="store__heroPreviewMessage">
                    <p><PartyPopper size={16} /> ¡Perfecto! Así verán los clientes tu tienda</p>
                    <p className="muted">Los cambios se aplican en tiempo real</p>
                  </div>
                )}

                {/* Action buttons */}
                <div className="store__heroPanelFooter">
                  {/* Save/Discard buttons */}
                  <div className="store__heroPanelActions">
                    <Button size="sm" variant="secondary" onClick={discardHeroChanges} disabled={savingTheme || !hasHeroChanges}>
                      Descartar
                    </Button>
                    <Button size="sm" onClick={saveHeroTheme} disabled={savingTheme || !hasHeroChanges}>
                      {savingTheme ? 'Guardando...' : <><Save size={14} /> Guardar</>}
                    </Button>
                  </div>
                </div>

                {/* Exit to cards button */}
                <div className="store__heroPanelExit">
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    onClick={() => {
                      setShowHeroPanel(false)
                      setHeroPreviewMode(false)
                      setShowCardPanel(true)
                    }}
                  >
                    <Palette size={14} /> Ir a personalizar Cards
                  </Button>
                </div>
              </div>
              )}
            </div>
          )}

          {/* Card Customization Panel */}
          {isAdmin && showCardPanel && (
            <div className="store__cardPanelWrapper" ref={cardPanelRef}>
              {/* Panel de controles */}
              <div className="store__cardPanel">
                <div className="store__cardPanelHeader">
                  <h4><LayoutGrid size={16} /> Personalizar Cards</h4>
                  <button type="button" className="store__cardPanelClose" onClick={() => setShowCardPanel(false)}><X size={16} /></button>
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
                            {layoutId === 'classic' && <Grid3X3 size={18} />}
                            {layoutId === 'horizontal' && <Rows3 size={18} />}
                            {layoutId === 'overlay' && <Layers size={18} />}
                            {layoutId === 'compact' && <Package size={18} />}
                            {layoutId === 'magazine' && <Newspaper size={18} />}
                            {layoutId === 'minimal' && <Sparkles size={18} />}
                            {layoutId === 'polaroid' && <Camera size={18} />}
                            {layoutId === 'banner' && <Tag size={18} />}
                          </span>
                          <span className="store__layoutName">{config.label}</span>
                          {!available && <span className="store__layoutLock"><Lock size={12} /></span>}
                          {config.tier === SUBSCRIPTION_TIERS.PREMIUM && <span className="store__tierBadge premium"><Star size={10} /></span>}
                          {config.tier === SUBSCRIPTION_TIERS.PREMIUM_PRO && <span className="store__tierBadge pro"><Crown size={10} /></span>}
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
                  <h4><Eye size={16} /> Vista Previa</h4>
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
                <span className="store__addIcon"><Plus size={24} /></span>
                <span className="store__addText">Agregar producto</span>
              </button>
            )}
          </div>
        </section>

        {!isCheckingOut && (
          <CartPanel
            items={cartItems}
            total={cartTotal}
            onAdd={addOne}
            onRemove={removeOne}
            onClear={() => {
              setPaid(false)
              setCart({})
            }}
            onCheckout={() => {
              setIsCheckingOut(true)
              setCheckoutError(null)
              checkoutRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
          />
        )}
      </div>

      {visible.length === 0 ? <p className="muted">No hay productos activos.</p> : null}

      {/* Checkout Page - Single Page Checkout */}
      {isCheckingOut && (
        <CheckoutPage
          cartItems={cartItems}
          cartTotal={cartTotal}
          tenantId={tenantId}
          orderItemsPayload={orderItemsPayload}
          checkoutData={checkoutData}
          setCheckoutData={setCheckoutData}
          checkoutLoading={checkoutLoading}
          checkoutError={checkoutError}
          deliveryConfig={deliveryConfig}
          onBack={() => {
            setIsCheckingOut(false)
            setCheckoutError(null)
            // No borrar los datos - el usuario puede continuar luego
          }}
          onSuccess={(orderId) => {
            setPaid(true)
            setLastOrderId(orderId)
            setCart({})
            // Solo borrar datos cuando se confirma exitosamente
            setCheckoutData({ customerName: '', customerPhone: '', deliveryType: 'mostrador', deliveryAddress: '', deliveryNotes: '', paymentMethod: 'efectivo' })
            setIsCheckingOut(false)
          }}
          dispatch={dispatch}
          setCheckoutLoading={setCheckoutLoading}
          setCheckoutError={setCheckoutError}
        />
      )}

      {/* Cart Checkout View - Only when NOT checking out */}
      {!isCheckingOut && (
        <section className="checkout" ref={checkoutRef} aria-label="Checkout">
          <h2 className="checkout__title">Pagar</h2>
          <p className="muted">Ingresa tus datos para procesar el pedido.</p>

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
              onClick={() => setIsCheckingOut(true)}
            >
              Procesar Pedido
            </button>

            {paid ? (
              <div className="checkout__success">
                ✓ Pedido creado exitosamente{lastOrderId ? `: ${lastOrderId}` : ''}.
              </div>
            ) : null}
          </div>
        </section>
      )}

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
          <AlertTriangle size={16} /> Haz clic de nuevo para confirmar la eliminación
        </div>
      )}
    </div>
  )
}

// Modal de checkout con datos del cliente
function CheckoutPage({ 
  cartItems, 
  cartTotal, 
  tenantId, 
  orderItemsPayload, 
  checkoutData, 
  setCheckoutData,
  checkoutLoading,
  checkoutError,
  deliveryConfig,
  onBack,
  onSuccess,
  dispatch,
  setCheckoutLoading,
  setCheckoutError,
}) {
  // Validación de datos completados
  const isNameValid = checkoutData.customerName.trim().length > 0
  const isPhoneValid = checkoutData.customerPhone.trim().length > 0
  const isAddressValid = checkoutData.deliveryType === 'domicilio' ? checkoutData.deliveryAddress.trim().length > 0 : true
  
  // Validar que el tipo de entrega seleccionado esté habilitado
  const isDeliveryTypeEnabled = deliveryConfig ? deliveryConfig[checkoutData.deliveryType] !== false : true
  
  // Si el tipo de entrega actual está deshabilitado, buscar uno habilitado
  if (!isDeliveryTypeEnabled) {
    const enabledTypes = ['mostrador', 'domicilio', 'mesa'].filter(type => !deliveryConfig || deliveryConfig[type] !== false)
    if (enabledTypes.length > 0 && enabledTypes[0] !== checkoutData.deliveryType) {
      setCheckoutData({ ...checkoutData, deliveryType: enabledTypes[0] })
    }
  }
  
  const isAllDataValid = isNameValid && isPhoneValid && isAddressValid && isDeliveryTypeEnabled
  
  // Boton procesar pago habilitado solo si todos los datos están válidos
  const canProcessPayment = isAllDataValid && !checkoutLoading

  const handleProcessPayment = async () => {
    if (!canProcessPayment) return

    // Verificar una vez más que el tipo de entrega esté habilitado
    if (!isDeliveryTypeEnabled) {
      setCheckoutError('El tipo de entrega seleccionado no está disponible. Por favor selecciona otro.')
      return
    }

    setCheckoutLoading(true)
    setCheckoutError(null)

    try {
      const res = await dispatch(
        createPaidOrder({
          tenantId,
          items: orderItemsPayload,
          total: Math.round(cartTotal * 100) / 100,
          customer: {
            name: checkoutData.customerName,
            phone: checkoutData.customerPhone,
          },
          deliveryType: checkoutData.deliveryType,
          deliveryAddress: checkoutData.deliveryType === 'domicilio' ? checkoutData.deliveryAddress : null,
          deliveryNotes: checkoutData.deliveryNotes,
          paymentMethod: checkoutData.paymentMethod,
        }),
      ).unwrap()

      onSuccess(res?.order?.id || null)
    } catch (e) {
      setCheckoutError(e?.message || 'Error al procesar el pedido')
    } finally {
      setCheckoutLoading(false)
    }
  }

  const deliveryTypes = [
    { key: 'mostrador', label: 'Retira en Mostrador', icon: '🍴' },
    { key: 'domicilio', label: 'A Domicilio', icon: '🚚' },
    { key: 'mesa', label: 'Para Comer en Mesa', icon: '🏠' },
  ]

  const paymentMethods = [
    { key: 'efectivo', label: 'Efectivo', icon: '💵' },
    { key: 'tarjeta', label: 'Tarjeta', icon: '💳' },
    { key: 'qr', label: 'QR (Mercado Pago)', icon: '📱' },
  ]

  return (
    <section className="checkoutPage" aria-label="Procesar Pedido">
      {/* Header */}
      <div className="checkoutPage__header">
        <button 
          className="checkoutPage__backBtn"
          onClick={onBack}
          disabled={checkoutLoading}
          title="Volver al carrito"
        >
          ← Volver
        </button>
        <h2 className="checkoutPage__title">Procesar Pedido</h2>
        <div className="checkoutPage__spacer"></div>
      </div>

      {/* Main Content */}
      <div className="checkoutPage__container">
        {/* Left: Form */}
        <div className="checkoutPage__form">
          {/* Resumen del Carrito */}
          <div className="checkoutPage__summary">
            <h3>Resumen del Pedido</h3>
            <div className="checkoutPage__summaryBox">
              <div className="checkoutPage__summaryRow">
                <span>Items:</span>
                <strong>{cartItems?.length || 0}</strong>
              </div>
              <div className="checkoutPage__summaryRow">
                <span>Total:</span>
                <strong className="checkoutPage__totalPrice">${cartTotal.toFixed(2)}</strong>
              </div>
            </div>

            {/* Detalle de items */}
            <div className="checkoutPage__items">
              {cartItems?.map((item) => (
                <div key={item.product?.id} className="checkoutPage__item">
                  <span className="checkoutPage__itemName">{item.product?.name}</span>
                  <span className="checkoutPage__itemQty">x{item.qty}</span>
                  <span className="checkoutPage__itemPrice">${item.lineTotal?.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Datos del Cliente */}
          <div className="checkoutPage__section">
            <h4 className="checkoutPage__sectionTitle">Datos del Cliente</h4>
            
            <div className="checkoutPage__field">
              <label className="checkoutPage__label">Nombre *</label>
              <input
                type="text"
                value={checkoutData.customerName}
                onChange={(e) => setCheckoutData({ ...checkoutData, customerName: e.target.value })}
                placeholder="Nombre completo"
                className={`checkoutPage__input ${isNameValid ? 'checkoutPage__input--valid' : 'checkoutPage__input--invalid'}`}
                disabled={checkoutLoading}
              />
              {isNameValid && <span className="checkoutPage__fieldOk">✓</span>}
            </div>

            <div className="checkoutPage__field">
              <label className="checkoutPage__label">Teléfono *</label>
              <input
                type="tel"
                value={checkoutData.customerPhone}
                onChange={(e) => setCheckoutData({ ...checkoutData, customerPhone: e.target.value })}
                placeholder="+54 9 11 2000-0000"
                className={`checkoutPage__input ${isPhoneValid ? 'checkoutPage__input--valid' : 'checkoutPage__input--invalid'}`}
                disabled={checkoutLoading}
              />
              {isPhoneValid && <span className="checkoutPage__fieldOk">✓</span>}
            </div>
          </div>

          {/* Tipo de Entrega */}
          <div className="checkoutPage__section">
            <h4 className="checkoutPage__sectionTitle">Tipo de Entrega</h4>
            <div className="checkoutPage__deliveryTypes">
              {deliveryTypes.map((type) => {
                const isEnabled = deliveryConfig ? deliveryConfig[type.key] !== false : true
                return (
                  <button
                    key={type.key}
                    className={`checkoutPage__deliveryType ${checkoutData.deliveryType === type.key ? 'checkoutPage__deliveryType--active' : ''} ${!isEnabled ? 'checkoutPage__deliveryType--disabled' : ''}`}
                    onClick={() => setCheckoutData({ ...checkoutData, deliveryType: type.key })}
                    disabled={checkoutLoading || !isEnabled}
                    title={!isEnabled ? `${type.label} está deshabilitado en el dashboard` : ''}
                  >
                    <span>{type.icon}</span>
                    <span>{type.label}</span>
                    {!isEnabled && <span className="checkoutPage__disabledBadge">No disponible</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Dirección si es Domicilio */}
          {checkoutData.deliveryType === 'domicilio' && (
            <div className="checkoutPage__section">
              <div className="checkoutPage__field">
                <label className="checkoutPage__label">Dirección de Entrega *</label>
                <input
                  type="text"
                  value={checkoutData.deliveryAddress}
                  onChange={(e) => setCheckoutData({ ...checkoutData, deliveryAddress: e.target.value })}
                  placeholder="Calle, número, apartamento"
                  className={`checkoutPage__input ${isAddressValid ? 'checkoutPage__input--valid' : 'checkoutPage__input--invalid'}`}
                  disabled={checkoutLoading}
                />
                {isAddressValid && <span className="checkoutPage__fieldOk">✓</span>}
              </div>

              <div className="checkoutPage__field">
                <label className="checkoutPage__label">Notas (opcional)</label>
                <textarea
                  value={checkoutData.deliveryNotes}
                  onChange={(e) => setCheckoutData({ ...checkoutData, deliveryNotes: e.target.value })}
                  placeholder="Timbre roto, portón naranja, etc."
                  className="checkoutPage__textarea"
                  disabled={checkoutLoading}
                  rows="3"
                />
              </div>
            </div>
          )}

          {/* Forma de Pago */}
          <div className="checkoutPage__section">
            <h4 className="checkoutPage__sectionTitle">Forma de Pago</h4>
            <div className="checkoutPage__paymentMethods">
              {paymentMethods.map((method) => (
                <button
                  key={method.key}
                  className={`checkoutPage__paymentMethod ${checkoutData.paymentMethod === method.key ? 'checkoutPage__paymentMethod--active' : ''}`}
                  onClick={() => setCheckoutData({ ...checkoutData, paymentMethod: method.key })}
                  disabled={checkoutLoading}
                >
                  <span>{method.icon}</span>
                  <span>{method.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {checkoutError && (
            <div className="checkoutPage__error">
              ⚠️ {checkoutError}
            </div>
          )}

          {/* Validación de campos */}
          {!isAllDataValid && (
            <div className="checkoutPage__validation">
              <p className="checkoutPage__validationText">
                Completa todos los campos requeridos (*) para procesar el pago
              </p>
              {!isNameValid && <div className="checkoutPage__validationItem">• Nombre del cliente</div>}
              {!isPhoneValid && <div className="checkoutPage__validationItem">• Teléfono del cliente</div>}
              {!isAddressValid && <div className="checkoutPage__validationItem">• Dirección de entrega</div>}
              {!isDeliveryTypeEnabled && <div className="checkoutPage__validationItem">• Tipo de entrega (está deshabilitado en el dashboard)</div>}
            </div>
          )}
        </div>

        {/* Right: Sticky Action Buttons */}
        <div className="checkoutPage__actions">
          <button
            className="checkoutPage__btnBack"
            onClick={onBack}
            disabled={checkoutLoading}
          >
            ← Volver al Carrito
          </button>

          <button
            className={`checkoutPage__btnProcess ${canProcessPayment ? 'checkoutPage__btnProcess--enabled' : 'checkoutPage__btnProcess--disabled'}`}
            onClick={handleProcessPayment}
            disabled={!canProcessPayment}
          >
            {checkoutLoading ? (
              <>⏳ Procesando...</>
            ) : canProcessPayment ? (
              <>✓ Procesar Pago</>
            ) : (
              <>Completa los datos (deshabilitado)</>
            )}
          </button>
        </div>
      </div>
    </section>
  )
}

