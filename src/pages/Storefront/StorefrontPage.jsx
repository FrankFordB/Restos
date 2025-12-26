import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import './StorefrontPage.css'
import { useAppSelector } from '../../app/hooks'
import { useAppDispatch } from '../../app/hooks'
import { fetchTenantBySlug, selectTenantBySlug, selectTenantFetchError, selectTenantFetchStatus } from '../../features/tenants/tenantsSlice'
import { fetchProductsForTenant, selectProductsForTenant, createProduct, patchProduct, deleteProduct } from '../../features/products/productsSlice'
import { fetchCategoriesForTenant, selectCategoriesForTenant, createCategory, patchCategory, deleteCategory } from '../../features/categories/categoriesSlice'
import { fetchExtrasForTenant, fetchExtraGroupsForTenant, selectExtrasForTenant, selectExtraGroupsForTenant } from '../../features/extras/extrasSlice'
import ThemeApplier from '../../components/theme/ThemeApplier'
import { fetchTenantTheme, selectThemeForTenant, saveTenantTheme, upsertTenantTheme } from '../../features/theme/themeSlice'
import { selectUser } from '../../features/auth/authSlice'
import ProductCard from '../../components/storefront/ProductCard/ProductCard'
import ProductDetailModal from '../../components/storefront/ProductDetailModal/ProductDetailModal'
import ProductExtrasConfigModal from '../../components/storefront/ProductExtrasConfigModal/ProductExtrasConfigModal'
import ExtrasManager from '../../components/dashboard/ExtrasManager/ExtrasManager'
import CartPanel from '../../components/storefront/CartPanel/CartPanel'
import StoreHeader from '../../components/storefront/StoreHeader/StoreHeader'
import { createPaidOrder } from '../../features/orders/ordersSlice'
import Button from '../../components/ui/Button/Button'
import Input from '../../components/ui/Input/Input'
import WelcomeModal from '../../components/storefront/WelcomeModal/WelcomeModal'
import StoreClosedModal from '../../components/storefront/StoreClosedModal/StoreClosedModal'
import { loadJson, saveJson } from '../../shared/storage'
import { fetchDeliveryConfig, fetchTenantBySlugFull } from '../../lib/supabaseApi'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import { checkIsStoreOpen } from '../../shared/openingHours'
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
  Clock,
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
  // tenant_admin can manage:
  // 1. Their own tenant (user.tenantId === tenantId)
  // 2. Demo tenant if they don't have a tenant assigned yet (for testing)
  const isTenantAdmin = user?.role === 'tenant_admin' && (
    user?.tenantId === tenantId || 
    (tenantId === 'tenant_demo' && !user?.tenantId) ||
    user?.tenantId === tenantId
  )
  const isAdmin = isTenantAdmin || isSuperAdmin

  const products = useAppSelector(selectProductsForTenant(tenantId || 'tenant_demo'))
  const categories = useAppSelector(selectCategoriesForTenant(tenantId || 'tenant_demo'))
  const extras = useAppSelector(selectExtrasForTenant(tenantId || 'tenant_demo'))
  const extraGroups = useAppSelector(selectExtraGroupsForTenant(tenantId || 'tenant_demo'))
  const visible = useMemo(() => products.filter((p) => p.active), [products])

  // Category navigation state
  const [selectedCategory, setSelectedCategory] = useState(null) // null = first category or "Sin asignar"
  const [editingCategoryId, setEditingCategoryId] = useState(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')

  // Get unique categories from products (for showing product count)
  const categoryCounts = useMemo(() => {
    const counts = { __unassigned__: 0 }
    visible.forEach((p) => {
      if (p.category) {
        counts[p.category] = (counts[p.category] || 0) + 1
      } else {
        counts.__unassigned__ = (counts.__unassigned__ || 0) + 1
      }
    })
    return counts
  }, [visible])

  // Check if there are unassigned products
  const hasUnassignedProducts = categoryCounts.__unassigned__ > 0

  // Sorted active categories
  const sortedCategories = useMemo(() => {
    return categories.filter(c => c.active).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
  }, [categories])

  // Default selected category to first one if null
  const effectiveSelectedCategory = useMemo(() => {
    if (selectedCategory !== null) return selectedCategory
    if (sortedCategories.length > 0) return sortedCategories[0].name
    if (hasUnassignedProducts) return '__unassigned__'
    return null
  }, [selectedCategory, sortedCategories, hasUnassignedProducts])

  // Filter products by selected category
  const filteredProducts = useMemo(() => {
    if (effectiveSelectedCategory === '__unassigned__') {
      return visible.filter((p) => !p.category)
    }
    if (!effectiveSelectedCategory) return visible
    return visible.filter((p) => p.category === effectiveSelectedCategory)
  }, [visible, effectiveSelectedCategory])

  const [cart, setCart] = useState({}) // { cartItemId: { product, quantity, extras, extrasTotal, comment } }
  const [paid, setPaid] = useState(false)
  const [lastOrderId, setLastOrderId] = useState(null)
  const checkoutRef = useRef(null)

  // Product detail modal state (for customer)
  const [showProductDetailModal, setShowProductDetailModal] = useState(false)
  const [selectedProductForDetail, setSelectedProductForDetail] = useState(null)

  // Product extras config modal state (for admin)
  const [showProductExtrasConfigModal, setShowProductExtrasConfigModal] = useState(false)
  const [productToConfigExtras, setProductToConfigExtras] = useState(null)

  // Extras manager modal state (for admin - global extras)
  const [showExtrasManagerModal, setShowExtrasManagerModal] = useState(false)

  // Product modal state (for admin)
  const [showProductModal, setShowProductModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [productForm, setProductForm] = useState({ name: '', price: '', description: '', imageUrl: '', category: '' })
  const [savingProduct, setSavingProduct] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  // Card customization panel state
  const [showCardPanel, setShowCardPanel] = useState(false)
  const [localCardTheme, setLocalCardTheme] = useState(null)
  const [savingTheme, setSavingTheme] = useState(false)

  // Cart panel state
  const [showCart, setShowCart] = useState(false)

  // Welcome modal state
  const [showWelcomeModal, setShowWelcomeModal] = useState(false)
  const [tenantFullData, setTenantFullData] = useState(null)
  const welcomeModalShownKey = `welcomeModal.shown.${slug}`
  
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

  // Hero customization panel state - declared early for use in effects
  const [showHeroPanel, setShowHeroPanel] = useState(false)
  const [localHeroTheme, setLocalHeroTheme] = useState(null)
  const [heroPreviewMode, setHeroPreviewMode] = useState(false)
  const [uploadingHeroImage, setUploadingHeroImage] = useState(null) // slide index being uploaded
  const heroFileInputRef = useRef(null)
  const heroPanelRef = useRef(null)
  const cardPanelRef = useRef(null)

  // Store open/closed status based on opening hours
  const [storeStatus, setStoreStatus] = useState({ isOpen: true, noSchedule: true, nextOpen: null })
  const [showClosedModal, setShowClosedModal] = useState(false)
  
  // Calculate if store is closed for blocking cart
  const isStoreClosed = !storeStatus.isOpen && !storeStatus.noSchedule
  
  // Check store status periodically
  useEffect(() => {
    const checkStatus = () => {
      const openingHours = tenantFullData?.opening_hours || []
      const status = checkIsStoreOpen(openingHours)
      console.log('[Store Status]', { 
        openingHours, 
        isOpen: status.isOpen, 
        noSchedule: status.noSchedule,
        nextOpen: status.nextOpen 
      })
      setStoreStatus(status)
    }
    checkStatus()
    const interval = setInterval(checkStatus, 60000) // Check every minute
    return () => clearInterval(interval)
  }, [tenantFullData?.opening_hours])

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

  // Load full tenant data for welcome modal
  useEffect(() => {
    const loadTenantFull = async () => {
      if (!slug) return
      try {
        if (isSupabaseConfigured) {
          const fullTenant = await fetchTenantBySlugFull(slug)
          setTenantFullData(fullTenant)
        } else {
          // In mock mode, load from localStorage
          const mockTenantKey = 'mock.tenantCustomization'
          const mockData = loadJson(mockTenantKey, {})
          if (tenantId && mockData[tenantId]) {
            setTenantFullData({
              ...tenant,
              ...mockData[tenantId],
              logo: mockData[tenantId].logo || tenant?.logo || '',
              slogan: mockData[tenantId].slogan || tenant?.slogan || '',
              description: mockData[tenantId].description || tenant?.description || '',
              welcome_modal_enabled: mockData[tenantId].welcomeModalEnabled,
              welcome_modal_title: mockData[tenantId].welcomeModalTitle,
              welcome_modal_message: mockData[tenantId].welcomeModalMessage,
              welcome_modal_image: mockData[tenantId].welcomeModalImage,
              opening_hours: mockData[tenantId].openingHours || [],
            })
          } else if (tenant) {
            setTenantFullData(tenant)
          }
        }
      } catch (err) {
        console.error('Error loading full tenant data:', err)
        setTenantFullData(tenant)
      }
    }
    loadTenantFull()
  }, [slug, tenant, tenantId])

  // Show welcome modal for non-logged users or preview mode
  useEffect(() => {
    if (!tenantFullData) return
    
    // Check if modal is enabled
    const modalEnabled = tenantFullData.welcome_modal_enabled !== false
    if (!modalEnabled) return
    
    // Check if already shown in this session
    const alreadyShown = sessionStorage.getItem(welcomeModalShownKey)
    if (alreadyShown && !heroPreviewMode) return
    
    // Show modal only for non-logged users or in preview mode
    const shouldShow = !user || heroPreviewMode
    if (shouldShow) {
      // Small delay to let the page load
      const timer = setTimeout(() => {
        setShowWelcomeModal(true)
        if (!heroPreviewMode) {
          sessionStorage.setItem(welcomeModalShownKey, 'true')
        }
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [tenantFullData, user, heroPreviewMode, welcomeModalShownKey])

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

  // Cart now stores complex items: { cartItemId: { productId, product, quantity, extras, extrasTotal, unitPrice, totalPrice, comment } }
  // For simple adds (no extras modal), we use productId as cartItemId
  // For adds with extras, we generate a unique ID
  
  const cartCount = useMemo(
    () => Object.values(cart).reduce((acc, item) => acc + (Number(item?.quantity || item) || 0), 0),
    [cart],
  )

  const cartTotal = useMemo(() => {
    const total = Object.values(cart).reduce((acc, item) => {
      // Support both old format (just quantity) and new format (object with extras)
      if (typeof item === 'number') {
        // Old format: just quantity, find product by key
        return acc // This shouldn't happen with new format
      }
      // New format: item with product, quantity, extras
      return acc + (Number(item.totalPrice) || 0)
    }, 0)
    return Math.round(total * 100) / 100
  }, [cart])

  const cartItems = useMemo(() => {
    return Object.entries(cart)
      .map(([cartItemId, item]) => {
        if (typeof item === 'number') return null // Skip old format
        return {
          ...item,
          cartItemId,
          qty: item.quantity,
          lineTotal: item.totalPrice,
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.lineTotal - a.lineTotal)
  }, [cart])

  const orderItemsPayload = useMemo(() => {
    return cartItems.map((it) => ({
      productId: it.product.id,
      product_name: it.product.name,
      name: it.product.name,
      unitPrice: Number(it.unitPrice),
      qty: it.quantity,
      quantity: it.quantity,
      lineTotal: it.totalPrice,
      price: it.unitPrice,
      extras: it.extras?.map((e) => ({ 
        id: e.id, 
        name: e.name, 
        price: e.price,
        quantity: e.quantity || 1,
        selectedOption: e.selectedOption || null,
      })) || [],
      extrasTotal: it.extrasTotal || 0,
      comment: it.comment || null,
    }))
  }, [cartItems])

  // Open product detail modal (for customer to select extras)
  const openProductDetail = (product) => {
    setSelectedProductForDetail(product)
    setShowProductDetailModal(true)
  }

  // Add item to cart (with extras support)
  const addItemToCart = ({ product, quantity, selectedExtras, extrasTotal, unitPrice, totalPrice, comment }) => {
    // Block if store is closed
    if (isStoreClosed) {
      setShowClosedModal(true)
      return
    }
    
    const cartItemId = `${product.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    setCart((c) => ({
      ...c,
      [cartItemId]: {
        productId: product.id,
        product,
        quantity,
        extras: selectedExtras,
        extrasTotal,
        unitPrice,
        totalPrice,
        comment,
      },
    }))
    setPaid(false)
  }

  // Simple add (no extras, for quick add or when no extras configured)
  const addOne = (productId) => {
    // Block if store is closed
    if (isStoreClosed) {
      setShowClosedModal(true)
      return
    }
    
    const product = visible.find((p) => p.id === productId)
    if (!product) return
    
    // If there are extras configured, open the modal instead
    if (extraGroups.length > 0) {
      openProductDetail(product)
      return
    }
    
    // No extras, add directly
    const cartItemId = productId // Use productId as cartItemId for simple items
    setCart((c) => {
      const existing = c[cartItemId]
      if (existing && typeof existing === 'object') {
        // Update quantity of existing item
        return {
          ...c,
          [cartItemId]: {
            ...existing,
            quantity: existing.quantity + 1,
            totalPrice: existing.unitPrice * (existing.quantity + 1),
          },
        }
      }
      // New simple item
      return {
        ...c,
        [cartItemId]: {
          productId: product.id,
          product,
          quantity: 1,
          extras: [],
          extrasTotal: 0,
          unitPrice: Number(product.price),
          totalPrice: Number(product.price),
          comment: null,
        },
      }
    })
    setPaid(false)
  }

  const removeOne = (cartItemId) =>
    setCart((c) => {
      setPaid(false)
      const item = c[cartItemId]
      if (!item) return c
      
      if (typeof item === 'object') {
        const newQty = Math.max(0, item.quantity - 1)
        if (newQty === 0) {
          const { [cartItemId]: _removed, ...rest } = c
          return rest
        }
        return {
          ...c,
          [cartItemId]: {
            ...item,
            quantity: newQty,
            totalPrice: item.unitPrice * newQty,
          },
        }
      }
      
      // Old format
      const next = Math.max(0, (item || 0) - 1)
      if (next === 0) {
        const { [cartItemId]: _removed, ...rest } = c
        return rest
      }
      return { ...c, [cartItemId]: next }
    })

  // Product management functions
  const openAddProduct = () => {
    setEditingProduct(null)
    setProductForm({ name: '', price: '', description: '', imageUrl: '', category: '' })
    setShowProductModal(true)
  }

  const openEditProduct = (product) => {
    setEditingProduct(product)
    setProductForm({
      name: product.name || '',
      price: String(product.price || ''),
      description: product.description || '',
      imageUrl: product.imageUrl || '',
      category: product.category || '',
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
            category: productForm.category.trim() || null,
          }
        })).unwrap()
      } else {
        await dispatch(createProduct({
          tenantId,
          product: {
            name: productForm.name.trim(),
            price: Number(productForm.price),
            description: productForm.description.trim(),
            imageUrl: productForm.imageUrl.trim() || null,
            category: productForm.category.trim() || null,
          }
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

  // Open extras config modal for admin
  const openProductExtrasConfig = (product) => {
    setProductToConfigExtras(product)
    setShowProductExtrasConfigModal(true)
  }

  // Save product extras (updates productExtras field on the product)
  const handleSaveProductExtras = async (productId, productExtras) => {
    try {
      await dispatch(patchProduct({
        tenantId,
        productId,
        patch: { productExtras },
      })).unwrap()
    } catch (e) {
      console.error('Error saving product extras:', e)
      throw e
    }
  }

  useEffect(() => {
    if (!slug) return
    dispatch(fetchTenantBySlug(slug))
  }, [dispatch, slug])

  useEffect(() => {
    if (!tenantId) return
    dispatch(fetchProductsForTenant(tenantId))
    dispatch(fetchCategoriesForTenant(tenantId))
    dispatch(fetchTenantTheme(tenantId))
    dispatch(fetchExtraGroupsForTenant(tenantId))
    dispatch(fetchExtrasForTenant(tenantId))
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
            {tenantFullData?.welcome_modal_enabled !== false && (
              <Button size="sm" variant="secondary" onClick={() => setShowWelcomeModal(true)}>
                <PartyPopper size={14} /> Ver Bienvenida
              </Button>
            )}
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
        tenant={tenantFullData || tenant}
        theme={theme}
        heroStyle={heroStyle}
        slides={heroSlides}
        titlePosition={heroTitlePosition}
        overlayOpacity={heroOverlayOpacity}
        cart={cart}
        onOpenCart={() => setShowCart(true)}
        openingHours={tenantFullData?.opening_hours || []}
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
                <Button size="sm" variant="secondary" onClick={() => setShowExtrasManagerModal(true)}>
                  <Layers size={14} /> Extras / Toppings
                </Button>
                <Button size="sm" onClick={openAddProduct}>
                  <Plus size={14} /> Agregar producto
                </Button>
              </div>
            </div>
          )}

          {/* Category Navigation Tabs */}
          <div className="store__categoryTabs">
            {sortedCategories.map((cat) => (
              <div key={cat.id} className="store__categoryTabWrapper">
                {editingCategoryId === cat.id && isAdmin ? (
                  <div className="store__categoryEdit">
                    <input
                      type="text"
                      className="store__categoryInput"
                      value={editingCategoryName}
                      onChange={(e) => setEditingCategoryName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && editingCategoryName.trim()) {
                          dispatch(patchCategory({ tenantId, categoryId: cat.id, patch: { name: editingCategoryName.trim() } }))
                          setEditingCategoryId(null)
                        }
                        if (e.key === 'Escape') {
                          setEditingCategoryId(null)
                        }
                      }}
                      onBlur={() => {
                        if (editingCategoryName.trim() && editingCategoryName !== cat.name) {
                          dispatch(patchCategory({ tenantId, categoryId: cat.id, patch: { name: editingCategoryName.trim() } }))
                        }
                        setEditingCategoryId(null)
                      }}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="store__categoryDeleteBtn"
                      onClick={() => {
                        if (confirm('¿Eliminar esta categoría?')) {
                          dispatch(deleteCategory({ tenantId, categoryId: cat.id }))
                          if (selectedCategory === cat.name) setSelectedCategory(null)
                        }
                        setEditingCategoryId(null)
                      }}
                      title="Eliminar categoría"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="store__categoryTabGroup">
                    <button
                      type="button"
                      className={`store__categoryTab ${effectiveSelectedCategory === cat.name ? 'store__categoryTab--active' : ''}`}
                      onClick={() => setSelectedCategory(cat.name)}
                    >
                      {cat.name}
                      <span className="store__categoryCount">{categoryCounts[cat.name] || 0}</span>
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        className="store__categoryEditBtn"
                        onClick={() => {
                          setEditingCategoryId(cat.id)
                          setEditingCategoryName(cat.name)
                        }}
                        title="Editar categoría"
                      >
                        <Pencil size={12} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            
            {/* Sin asignar - only shows if there are unassigned products */}
            {hasUnassignedProducts && (
              <button
                type="button"
                className={`store__categoryTab store__categoryTab--unassigned ${effectiveSelectedCategory === '__unassigned__' ? 'store__categoryTab--active' : ''}`}
                onClick={() => setSelectedCategory('__unassigned__')}
              >
                Sin asignar
                <span className="store__categoryCount">{categoryCounts.__unassigned__}</span>
              </button>
            )}
            
            {/* Add category button (only for admin) */}
            {isAdmin && (
              creatingCategory ? (
                <div className="store__categoryEdit">
                  <input
                    type="text"
                    className="store__categoryInput"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Nueva categoría"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newCategoryName.trim()) {
                        dispatch(createCategory({ 
                          tenantId, 
                          category: { 
                            name: newCategoryName.trim(),
                            sortOrder: categories.length 
                          } 
                        }))
                        setNewCategoryName('')
                        setCreatingCategory(false)
                      }
                      if (e.key === 'Escape') {
                        setNewCategoryName('')
                        setCreatingCategory(false)
                      }
                    }}
                    onBlur={() => {
                      if (newCategoryName.trim()) {
                        dispatch(createCategory({ 
                          tenantId, 
                          category: { 
                            name: newCategoryName.trim(),
                            sortOrder: categories.length 
                          } 
                        }))
                      }
                      setNewCategoryName('')
                      setCreatingCategory(false)
                    }}
                    autoFocus
                  />
                </div>
              ) : (
                <button
                  type="button"
                  className="store__categoryTab store__categoryTab--add"
                  onClick={() => setCreatingCategory(true)}
                  title="Agregar categoría"
                >
                  <Plus size={16} />
                </button>
              )
            )}
          </div>

          {/* Store Closed Banner */}
          {isStoreClosed && (
            <div className="store__closedBanner">
              <div className="store__closedBannerContent">
                <div className="store__closedBannerIcon">
                  <Clock size={24} />
                </div>
                <div className="store__closedBannerText">
                  <span className="store__closedBannerTitle">Estamos cerrados</span>
                  {storeStatus.nextOpen && (
                    <span className="store__closedBannerNext">Abrimos: {storeStatus.nextOpen}</span>
                  )}
                </div>
                <button 
                  className="store__closedBannerBtn"
                  onClick={() => setShowClosedModal(true)}
                >
                  Ver horarios
                </button>
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
            {filteredProducts.map((p) => {
              // Calculate quantity for this product across all cart items
              const productQty = Object.values(cart).reduce((sum, item) => {
                if (typeof item === 'object' && item.productId === p.id) {
                  return sum + item.quantity
                }
                return sum
              }, 0)
              
              return (
                <ProductCard
                  key={p.id}
                  product={p}
                  quantity={productQty}
                  onAdd={() => addOne(p.id)}
                  onRemove={() => {
                    // Find the first cart item for this product and remove from it
                    const cartItemId = Object.keys(cart).find((id) => {
                      const item = cart[id]
                      return typeof item === 'object' && item.productId === p.id
                    })
                    if (cartItemId) removeOne(cartItemId)
                  }}
                  onClick={() => openProductDetail(p)}
                  onConfigExtras={() => openProductExtrasConfig(p)}
                  layout={cardLayout}
                  colors={cardColors}
                  isEditable={isAdmin}
                  onEdit={openEditProduct}
                  onDelete={handleDeleteProduct}
                  hasExtras={extraGroups.length > 0 || (p.productExtras?.length > 0)}
                  hasProductExtras={p.productExtras?.length > 0}
                  isPremium={effectiveTier !== SUBSCRIPTION_TIERS.FREE}
                  disabled={isStoreClosed && !isAdmin}
                />
              )
            })}
            
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
            
            {/* Empty state for category */}
            {filteredProducts.length === 0 && selectedCategory && (
              <div className="store__emptyCategory">
                <p>No hay productos en esta categoría.</p>
              </div>
            )}
          </div>
        </section>

        {!isCheckingOut && (
          <CartPanel
            items={cartItems}
            total={cartTotal}
            onAdd={addOne}
            onRemove={removeOne}
            storeStatus={storeStatus}
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

              <div className="store__formGroup">
                <label className="store__formLabel">Categoría</label>
                <select
                  className="store__formSelect"
                  value={productForm.category}
                  onChange={(e) => setProductForm(f => ({ ...f, category: e.target.value }))}
                >
                  <option value="">Sin asignar</option>
                  {sortedCategories.map((cat) => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>
              
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

      {/* Product Detail Modal (for customer to select extras) */}
      {showProductDetailModal && selectedProductForDetail && (
        <ProductDetailModal
          product={selectedProductForDetail}
          groups={extraGroups}
          extras={extras}
          onClose={() => {
            setShowProductDetailModal(false)
            setSelectedProductForDetail(null)
          }}
          onAddToCart={addItemToCart}
        />
      )}

      {/* Product Extras Config Modal (for admin to configure product-specific extras) */}
      {showProductExtrasConfigModal && productToConfigExtras && (
        <ProductExtrasConfigModal
          product={productToConfigExtras}
          onClose={() => {
            setShowProductExtrasConfigModal(false)
            setProductToConfigExtras(null)
          }}
          onSave={handleSaveProductExtras}
          isPremium={effectiveTier !== SUBSCRIPTION_TIERS.FREE}
        />
      )}

      {/* Extras Manager Modal (for admin to manage global extras/toppings) */}
      {showExtrasManagerModal && (
        <div className="store__modalOverlay" onClick={() => setShowExtrasManagerModal(false)}>
          <div className="store__extrasManagerModal" onClick={(e) => e.stopPropagation()}>
            <div className="store__modalHeader">
              <h3><Layers size={18} /> Extras y Toppings</h3>
              <button 
                className="store__modalClose" 
                type="button"
                onClick={() => setShowExtrasManagerModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="store__extrasManagerBody">
              <ExtrasManager tenantId={tenantId || 'tenant_demo'} />
            </div>
          </div>
        </div>
      )}

      {/* Welcome Modal for non-logged users and preview mode */}
      <WelcomeModal
        isOpen={showWelcomeModal}
        onClose={() => setShowWelcomeModal(false)}
        tenant={tenantFullData}
        isPreviewMode={heroPreviewMode}
      />

      {/* Store Closed Modal with schedule */}
      <StoreClosedModal
        isOpen={showClosedModal}
        onClose={() => setShowClosedModal(false)}
        openingHours={tenantFullData?.opening_hours || []}
        nextOpen={storeStatus.nextOpen}
        theme={theme}
        tenantName={tenant?.name}
      />
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
              {cartItems?.map((item, index) => (
                <div key={`${item.product?.id}-${index}`} className="checkoutPage__item">
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

