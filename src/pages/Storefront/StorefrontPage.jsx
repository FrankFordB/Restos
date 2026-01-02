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
import MobileStylesProvider from '../../components/theme/MobileStylesProvider'
import { fetchTenantTheme, selectThemeForTenant, saveTenantTheme, upsertTenantTheme } from '../../features/theme/themeSlice'
import { selectUser } from '../../features/auth/authSlice'
import ProductCard from '../../components/storefront/ProductCard/ProductCard'
import ProductDetailModal from '../../components/storefront/ProductDetailModal/ProductDetailModal'
import ProductExtrasConfigModal from '../../components/storefront/ProductExtrasConfigModal/ProductExtrasConfigModal'
import ExtrasManager from '../../components/dashboard/ExtrasManager/ExtrasManager'
import CartPanel from '../../components/storefront/CartPanel/CartPanel'
import StoreHeader from '../../components/storefront/StoreHeader/StoreHeader'
import { createPaidOrder, fetchOrdersForTenant, selectOrdersForTenant } from '../../features/orders/ordersSlice'
import Button from '../../components/ui/Button/Button'
import Input from '../../components/ui/Input/Input'
import WelcomeModal from '../../components/storefront/WelcomeModal/WelcomeModal'
import SuccessModal from '../../components/storefront/SuccessModal/SuccessModal'
import StoreClosedModal from '../../components/storefront/StoreClosedModal/StoreClosedModal'
import FloatingCart from '../../components/storefront/FloatingCart/FloatingCart'
import { loadJson, saveJson } from '../../shared/storage'
import { fetchDeliveryConfig, fetchTenantBySlugFull, fetchTenantPauseStatusBySlug } from '../../lib/supabaseApi'
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient'
import { checkIsStoreOpen } from '../../shared/openingHours'
import {
  SUBSCRIPTION_TIERS,
  TIER_LABELS,
  PRODUCT_CARD_LAYOUTS,
  STORE_HERO_STYLES,
  CAROUSEL_BUTTON_STYLES,
  isFeatureAvailable,
} from '../../shared/subscriptions'
import { uploadHeroImage, uploadProductImage } from '../../lib/supabaseStorage'
import ImageCropperModal from '../../components/ui/ImageCropperModal/ImageCropperModal'
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
  Focus,
  Link2,
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
  const orders = useAppSelector(selectOrdersForTenant(tenantId || 'tenant_demo'))
  const visible = useMemo(() => products.filter((p) => p.active), [products])

  // Calcular los 3 productos más vendidos basado en pedidos completados
  const top3ProductIds = useMemo(() => {
    const salesByProduct = {}
    
    orders
      .filter(o => o.status === 'completed')
      .forEach(order => {
        const items = order.items || order.order_items || []
        items.forEach(item => {
          const productId = item.productId || item.product_id
          if (productId) {
            salesByProduct[productId] = (salesByProduct[productId] || 0) + (item.quantity || item.qty || 1)
          }
        })
      })
    
    // Ordenar por cantidad vendida y tomar los 3 primeros
    const sortedProducts = Object.entries(salesByProduct)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => id)
    
    return new Set(sortedProducts)
  }, [orders])

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

  // Helper: Calcular cuántas unidades de una categoría hay en el carrito
  const getCategoryCartQuantity = (categoryName) => {
    return Object.values(cart).reduce((sum, item) => {
      if (typeof item === 'object' && item.product?.category === categoryName) {
        return sum + (item.quantity || 0)
      }
      return sum
    }, 0)
  }

  // Helper: Obtener info del stock global de una categoría
  const getCategoryStockInfo = (categoryName) => {
    const category = sortedCategories.find(c => c.name === categoryName)
    if (!category || category.maxStock === null || category.maxStock === undefined) {
      return null // No tiene stock global
    }
    const inCart = getCategoryCartQuantity(categoryName)
    const availableStock = Math.max(0, (category.currentStock || 0) - inCart)
    return {
      maxStock: category.maxStock,
      currentStock: category.currentStock || 0,
      inCart,
      availableStock,
      isEmpty: availableStock === 0,
    }
  }

  // Verificar si el stock global de alguna categoría llegó a 0
  // Si TODAS las categorías con stock global están en 0, la tienda se cierra
  const globalStockStatus = useMemo(() => {
    const categoriesWithGlobalStock = sortedCategories.filter(c => c.maxStock !== null && c.maxStock !== undefined)
    
    if (categoriesWithGlobalStock.length === 0) {
      return { hasGlobalStock: false, allEmpty: false, emptyCategories: [], stockByCategory: {} }
    }
    
    const emptyCategories = categoriesWithGlobalStock.filter(c => c.currentStock === 0)
    const allEmpty = emptyCategories.length === categoriesWithGlobalStock.length
    
    // Crear mapa de stock por categoría
    const stockByCategory = {}
    categoriesWithGlobalStock.forEach(c => {
      stockByCategory[c.name] = {
        maxStock: c.maxStock,
        currentStock: c.currentStock || 0,
      }
    })
    
    return { 
      hasGlobalStock: true, 
      allEmpty,
      emptyCategories: emptyCategories.map(c => c.name),
      totalWithStock: categoriesWithGlobalStock.length,
      totalEmpty: emptyCategories.length,
      stockByCategory,
    }
  }, [sortedCategories])

  // Efecto: Ajustar automáticamente las cantidades del carrito cuando el stock global cambia
  useEffect(() => {
    if (!globalStockStatus.hasGlobalStock) return
    if (Object.keys(cart).length === 0) return
    
    let needsUpdate = false
    const adjustedCart = { ...cart }
    
    // Agrupar items del carrito por categoría
    const cartByCategory = {}
    Object.entries(cart).forEach(([cartItemId, item]) => {
      if (typeof item !== 'object' || !item.product?.category) return
      const catName = item.product.category
      if (!cartByCategory[catName]) cartByCategory[catName] = []
      cartByCategory[catName].push({ cartItemId, item })
    })
    
    // Para cada categoría con stock global, verificar si excede el stock disponible
    Object.entries(cartByCategory).forEach(([categoryName, items]) => {
      const stockInfo = globalStockStatus.stockByCategory[categoryName]
      if (!stockInfo) return // Esta categoría no tiene stock global
      
      const currentStock = stockInfo.currentStock
      const totalInCart = items.reduce((sum, { item }) => sum + (item.quantity || 0), 0)
      
      if (totalInCart > currentStock) {
        // Hay más en el carrito que el stock disponible, necesitamos reducir
        let remaining = currentStock
        
        items.forEach(({ cartItemId, item }) => {
          if (remaining <= 0) {
            // Eliminar este item completamente
            delete adjustedCart[cartItemId]
            needsUpdate = true
          } else if (item.quantity > remaining) {
            // Reducir la cantidad
            adjustedCart[cartItemId] = {
              ...item,
              quantity: remaining,
              totalPrice: item.unitPrice * remaining,
            }
            remaining = 0
            needsUpdate = true
          } else {
            // Este item cabe, restar del restante
            remaining -= item.quantity
          }
        })
      }
    })
    
    if (needsUpdate) {
      console.log('🔄 Ajustando carrito por cambio de stock global')
      setCart(adjustedCart)
    }
  }, [globalStockStatus.stockByCategory, globalStockStatus.hasGlobalStock])

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
  const [showSuccessModal, setShowSuccessModal] = useState(false) // Modal de compra exitosa
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
  
  // Product image cropper state
  const [showProductImageCropper, setShowProductImageCropper] = useState(false)
  const [productImageToCrop, setProductImageToCrop] = useState(null)
  const [uploadingProductImage, setUploadingProductImage] = useState(false)
  const productImageInputRef = useRef(null)

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
  
  // Store paused status (from admin)
  const [isPaused, setIsPaused] = useState(false)
  const [pauseMessage, setPauseMessage] = useState('')
  const [showPausedRealtimeModal, setShowPausedRealtimeModal] = useState(false)
  const wasPausedRef = useRef(false) // Track previous pause state
  
  // Out of stock modal state - now tracks which categories ran out
  const [showOutOfStockModal, setShowOutOfStockModal] = useState(false)
  const [outOfStockCategories, setOutOfStockCategories] = useState([])
  const justPurchasedRef = useRef(false) // Track if user just made a purchase
  
  // Calculate if store is closed for blocking cart (paused state only - NOT out of stock)
  // Ahora solo bloqueamos por horario o pausa, NO por stock agotado (se puede comprar en otras categorías)
  const isStoreClosed = (!storeStatus.isOpen && !storeStatus.noSchedule) || isPaused
  
  // Show out of stock modal when categories run out (but not for the buyer who just purchased)
  useEffect(() => {
    // Si el usuario acaba de comprar exitosamente, no mostrar el modal
    if (justPurchasedRef.current) {
      justPurchasedRef.current = false
      return
    }
    
    // Detectar qué categorías se quedaron sin stock
    const newEmptyCategories = globalStockStatus.emptyCategories || []
    const previousEmpty = outOfStockCategories
    
    // Ver si hay nuevas categorías que se agotaron
    const newlyEmpty = newEmptyCategories.filter(cat => !previousEmpty.includes(cat))
    
    if (newlyEmpty.length > 0) {
      setOutOfStockCategories(newEmptyCategories)
      setShowOutOfStockModal(true)
    }
  }, [globalStockStatus.emptyCategories])
  
  // Poll pause status every 10 seconds (lightweight check for realtime pause detection)
  useEffect(() => {
    if (!slug) return
    
    const checkPauseStatus = async () => {
      try {
        let pauseStatus = { isPaused: false, pauseMessage: '' }
        
        if (isSupabaseConfigured) {
          pauseStatus = await fetchTenantPauseStatusBySlug(slug)
        } else {
          // Mock mode: check localStorage
          const pauseCache = loadJson(`pauseStatus.${tenantId}`, { isPaused: false, pauseMessage: '' })
          pauseStatus = pauseCache
        }
        
        // If store just got paused (wasn't paused before, now it is)
        if (pauseStatus.isPaused && !wasPausedRef.current) {
          setIsPaused(true)
          setPauseMessage(pauseStatus.pauseMessage)
          setShowPausedRealtimeModal(true) // Show realtime notification
        } else if (!pauseStatus.isPaused && wasPausedRef.current) {
          // Store was unpaused
          setIsPaused(false)
          setPauseMessage('')
          setShowPausedRealtimeModal(false)
        }
        
        wasPausedRef.current = pauseStatus.isPaused
      } catch (err) {
        console.error('Error checking pause status:', err)
      }
    }
    
    // Initial check (but don't show modal on page load)
    const initialCheck = async () => {
      try {
        let pauseStatus = { isPaused: false, pauseMessage: '' }
        if (isSupabaseConfigured) {
          pauseStatus = await fetchTenantPauseStatusBySlug(slug)
        } else {
          const pauseCache = loadJson(`pauseStatus.${tenantId}`, { isPaused: false, pauseMessage: '' })
          pauseStatus = pauseCache
        }
        wasPausedRef.current = pauseStatus.isPaused
        setIsPaused(pauseStatus.isPaused)
        setPauseMessage(pauseStatus.pauseMessage)
      } catch (err) {
        console.error('Error initial pause check:', err)
      }
    }
    
    initialCheck()
    const interval = setInterval(checkPauseStatus, 10000) // Check every 10 seconds
    return () => clearInterval(interval)
  }, [slug, tenantId])
  
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
              welcome_modal_features: mockData[tenantId].welcomeModalFeatures,
              welcome_modal_features_design: mockData[tenantId].welcomeModalFeaturesDesign,
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

  // Update pause status when tenant data is loaded
  useEffect(() => {
    if (tenantFullData) {
      setIsPaused(tenantFullData.is_paused || false)
      setPauseMessage(tenantFullData.pause_message || '')
    }
  }, [tenantFullData])

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
  // Usar !== false: si el valor es undefined/null, por defecto mostramos el elemento
  // Si el valor es explícitamente false, lo ocultamos
  const heroShowTitle = heroTheme?.heroShowTitle !== false
  const heroShowSubtitle = heroTheme?.heroShowSubtitle !== false
  const heroShowCta = heroTheme?.heroShowCta !== false
  const heroCarouselButtonStyle = heroTheme?.heroCarouselButtonStyle || 'arrows_classic'

  // Debug: ver valores del theme
  console.log('[StorefrontPage] Hero visibility:', {
    'heroTheme.heroShowTitle': heroTheme?.heroShowTitle,
    'heroShowTitle (computed)': heroShowTitle,
    'heroTheme.heroShowSubtitle': heroTheme?.heroShowSubtitle,
    'heroShowSubtitle (computed)': heroShowSubtitle,
    'heroTheme.heroShowCta': heroTheme?.heroShowCta,
    'heroShowCta (computed)': heroShowCta,
    'localHeroTheme': localHeroTheme,
    'theme': theme,
  })

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
    console.log('[StorefrontPage] updateHeroTheme llamado con:', patch)
    setLocalHeroTheme(prev => {
      const newValue = {
        ...(prev || theme || {}),
        ...patch
      }
      console.log('[StorefrontPage] Nuevo localHeroTheme:', newValue)
      return newValue
    })
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
    console.log('[StorefrontPage] saveHeroTheme - guardando:', localHeroTheme)
    setSavingTheme(true)
    try {
      const result = await dispatch(saveTenantTheme({ tenantId, theme: localHeroTheme }))
      console.log('[StorefrontPage] saveHeroTheme - resultado del dispatch:', result)
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
    
    // Verificar stock disponible del producto
    const currentInCart = Object.values(cart).reduce((sum, item) => {
      if (typeof item === 'object' && item.productId === product.id) {
        return sum + item.quantity
      }
      return sum
    }, 0)
    
    // Si el producto tiene stock definido, verificar límite
    if (product.stock !== null && product.stock !== undefined) {
      if (currentInCart + quantity > product.stock) {
        const available = product.stock - currentInCart
        alert(`Stock insuficiente. Solo puedes agregar ${available > 0 ? available : 0} más.`)
        return
      }
    }
    
    // Verificar stock global de la categoría
    const categoryStockInfo = getCategoryStockInfo(product.category)
    if (categoryStockInfo) {
      if (quantity > categoryStockInfo.availableStock) {
        if (categoryStockInfo.availableStock === 0) {
          alert(`Stock insuficiente de ${product.category}: quedan 0, se pidieron ${quantity}`)
        } else {
          alert(`Stock insuficiente de ${product.category}: quedan ${categoryStockInfo.availableStock}, se pidieron ${quantity}`)
        }
        return
      }
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
    
    // Calcular cantidad actual en el carrito para este producto
    const currentInCart = Object.values(cart).reduce((sum, item) => {
      if (typeof item === 'object' && item.productId === productId) {
        return sum + item.quantity
      }
      return sum
    }, 0)
    
    // Calcular el stock efectivo (mínimo entre producto y categoría)
    const productStock = product.stock !== null && product.stock !== undefined ? product.stock : null
    const categoryStockInfo = getCategoryStockInfo(product.category)
    const categoryStock = categoryStockInfo ? categoryStockInfo.currentStock : null
    
    let effectiveStockLimit = null
    let limitSource = null
    
    if (productStock !== null && categoryStock !== null) {
      if (categoryStock < productStock) {
        effectiveStockLimit = categoryStock
        limitSource = product.category
      } else {
        effectiveStockLimit = productStock
        limitSource = 'producto'
      }
    } else if (productStock !== null) {
      effectiveStockLimit = productStock
      limitSource = 'producto'
    } else if (categoryStock !== null) {
      effectiveStockLimit = categoryStock
      limitSource = product.category
    }
    
    // Verificar si se puede agregar más
    if (effectiveStockLimit !== null) {
      if (currentInCart >= effectiveStockLimit) {
        // No mostrar alert, el UI ya muestra el badge y desactiva el botón
        return
      }
    }
    
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
        const newQty = existing.quantity + 1
        // Verificar límite efectivo antes de incrementar
        if (effectiveStockLimit !== null && newQty > effectiveStockLimit) {
          return c // No agregar más
        }
        // Update quantity of existing item
        return {
          ...c,
          [cartItemId]: {
            ...existing,
            quantity: newQty,
            totalPrice: existing.unitPrice * newQty,
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

  // Product image handlers
  const handleProductImageFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = () => {
      setProductImageToCrop(reader.result)
      setShowProductImageCropper(true)
    }
    reader.readAsDataURL(file)
    // Reset input
    if (productImageInputRef.current) {
      productImageInputRef.current.value = ''
    }
  }

  const handleProductImageCropComplete = async (croppedImage) => {
    setShowProductImageCropper(false)
    setProductImageToCrop(null)
    setUploadingProductImage(true)

    try {
      if (isSupabaseConfigured) {
        // Convert base64 to File for upload
        const response = await fetch(croppedImage)
        const blob = await response.blob()
        const file = new File([blob], 'product.jpg', { type: 'image/jpeg' })
        const productId = editingProduct?.id || `temp-${Date.now()}`
        const imageUrl = await uploadProductImage({ tenantId, productId, file })
        setProductForm(f => ({ ...f, imageUrl }))
      } else {
        // Mock: use base64 directly
        setProductForm(f => ({ ...f, imageUrl: croppedImage }))
      }
    } catch (err) {
      console.error('Error uploading product image:', err)
    } finally {
      setUploadingProductImage(false)
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
    dispatch(fetchOrdersForTenant(tenantId)) // Para calcular productos populares
  }, [dispatch, tenantId])

  // Suscripción realtime para stock de categorías (permite ver actualizaciones en tiempo real)
  useEffect(() => {
    if (!tenantId || !isSupabaseConfigured) return
    
    const channel = supabase
      .channel(`categories-stock-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'product_categories',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          console.log('📦 Stock de categoría actualizado:', payload.new)
          // Refrescar categorías para obtener el nuevo stock
          dispatch(fetchCategoriesForTenant(tenantId))
        }
      )
      .subscribe((status) => {
        console.log('📡 Suscripción categorías:', status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tenantId, dispatch])

  // Suscripción realtime para stock de productos (permite ver actualizaciones en tiempo real)
  useEffect(() => {
    if (!tenantId || !isSupabaseConfigured) return
    
    const channel = supabase
      .channel(`products-stock-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'products',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          console.log('📦 Stock de producto actualizado:', payload.new)
          // Refrescar productos para obtener el nuevo stock
          dispatch(fetchProductsForTenant(tenantId))
        }
      )
      .subscribe((status) => {
        console.log('📡 Suscripción productos:', status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tenantId, dispatch])

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
      <MobileStylesProvider 
        heroTheme={{
          heroShowTitle,
          heroShowSubtitle,
          heroShowCta,
          heroCarouselButtonStyle,
        }}
        tenantId={tenantId}
      />
      
      {/* Store Header with Carousel */}
      <StoreHeader
        tenant={tenantFullData || tenant}
        theme={theme}
        heroStyle={heroStyle}
        slides={heroSlides}
        titlePosition={heroTitlePosition}
        overlayOpacity={heroOverlayOpacity}
        showTitle={heroShowTitle}
        showSubtitle={heroShowSubtitle}
        showCta={heroShowCta}
        carouselButtonStyle={heroCarouselButtonStyle}
        cart={cart}
        onOpenCart={() => setShowCart(true)}
        openingHours={tenantFullData?.opening_hours || []}
      />

      <div className={`store__layout ${showHeroPanel ? 'store__layout--heroEditing' : ''}`} id="productos">
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
                    {(() => {
                      const stockInfo = getCategoryStockInfo(cat.name)
                      const hasGlobalStock = stockInfo !== null
                      const isOutOfStock = hasGlobalStock && stockInfo.availableStock === 0
                      const isLowStock = hasGlobalStock && stockInfo.availableStock > 0 && stockInfo.availableStock <= 3
                      
                      return (
                        <>
                          <button
                            type="button"
                            className={`store__categoryTab ${effectiveSelectedCategory === cat.name ? 'store__categoryTab--active' : ''} ${isOutOfStock ? 'store__categoryTab--outOfStock' : ''} ${isLowStock ? 'store__categoryTab--lowStock' : ''}`}
                            onClick={() => setSelectedCategory(cat.name)}
                            disabled={isOutOfStock}
                          >
                            <span className="store__categoryName">{cat.name}</span>
                            {hasGlobalStock && (
                              <span className={`store__categoryStock ${isOutOfStock ? 'store__categoryStock--empty' : ''} ${isLowStock ? 'store__categoryStock--low' : ''}`}>
                                {isOutOfStock ? '¡Agotado!' : `${stockInfo.availableStock} disp.`}
                              </span>
                            )}
                            {!hasGlobalStock && (
                              <span className="store__categoryCount">{categoryCounts[cat.name] || 0}</span>
                            )}
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
                        </>
                      )
                    })()}
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

          {/* Store Closed/Paused Banner */}
          {isStoreClosed && (
            <div className={`store__closedBanner ${isPaused ? 'store__closedBanner--paused' : ''}`}>
              <div className="store__closedBannerContent">
                <div className="store__closedBannerIcon">
                  {isPaused ? <AlertTriangle size={24} /> : <Clock size={24} />}
                </div>
                <div className="store__closedBannerText">
                  <span className="store__closedBannerTitle">
                    {isPaused ? 'Tienda en pausa' : 'Estamos cerrados'}
                  </span>
                  {isPaused && pauseMessage ? (
                    <span className="store__closedBannerNext">{pauseMessage}</span>
                  ) : storeStatus.nextOpen && !isPaused ? (
                    <span className="store__closedBannerNext">Abrimos: {storeStatus.nextOpen}</span>
                  ) : null}
                </div>
                <button 
                  className="store__closedBannerBtn"
                  onClick={() => setShowClosedModal(true)}
                >
                  {isPaused ? 'Ver info' : 'Ver horarios'}
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

                {/* Visibility Options */}
                <div className="store__heroSection">
                  <label className="store__heroSectionTitle">Elementos visibles</label>
                  <div className="store__heroToggles">
                    <label className="store__heroToggle">
                      <input
                        type="checkbox"
                        checked={heroShowTitle}
                        onChange={(e) => updateHeroTheme({ heroShowTitle: e.target.checked })}
                      />
                      <span className="store__heroToggleSlider"></span>
                      <span className="store__heroToggleLabel">Mostrar título</span>
                    </label>
                    <label className="store__heroToggle">
                      <input
                        type="checkbox"
                        checked={heroShowSubtitle}
                        onChange={(e) => updateHeroTheme({ heroShowSubtitle: e.target.checked })}
                      />
                      <span className="store__heroToggleSlider"></span>
                      <span className="store__heroToggleLabel">Mostrar subtítulo</span>
                    </label>
                    <label className="store__heroToggle">
                      <input
                        type="checkbox"
                        checked={heroShowCta}
                        onChange={(e) => updateHeroTheme({ heroShowCta: e.target.checked })}
                      />
                      <span className="store__heroToggleSlider"></span>
                      <span className="store__heroToggleLabel">Mostrar botón de acción</span>
                    </label>
                  </div>
                </div>

                {/* Carousel Button Styles */}
                <div className="store__heroSection">
                  <label className="store__heroSectionTitle">Estilo de botones del carrusel</label>
                  <div className="store__heroButtonStyleGrid">
                    {Object.entries(CAROUSEL_BUTTON_STYLES).map(([styleId, styleConfig]) => {
                      const available = isFeatureAvailable(styleConfig.tier, effectiveTier)
                      const isPro = styleConfig.tier === SUBSCRIPTION_TIERS.PREMIUM_PRO
                      return (
                        <button
                          key={styleId}
                          type="button"
                          className={`store__heroButtonStyleBtn ${heroCarouselButtonStyle === styleId ? 'store__heroButtonStyleBtn--selected' : ''} ${!available ? 'store__heroButtonStyleBtn--locked' : ''}`}
                          onClick={() => available && updateHeroTheme({ heroCarouselButtonStyle: styleId })}
                          disabled={!available}
                          title={styleConfig.description}
                        >
                          <span className="store__heroButtonStylePreview">{styleConfig.preview}</span>
                          <span className="store__heroButtonStyleLabel">{styleConfig.label}</span>
                          {!available && <Lock size={12} className="store__heroButtonStyleLock" />}
                          {isPro && available && <Crown size={10} className="store__heroButtonStylePro" />}
                        </button>
                      )
                    })}
                  </div>
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
              
              // Calcular el stock efectivo (mínimo entre stock producto y stock categoría)
              const productStock = p.stock !== null && p.stock !== undefined ? p.stock : null
              const categoryStockInfo = getCategoryStockInfo(p.category)
              const categoryStock = categoryStockInfo ? categoryStockInfo.currentStock : null
              
              // El límite es el mínimo de los dos (si ambos existen), o el que exista
              let effectiveStockLimit = null
              let isLimitedByCategory = false
              
              if (productStock !== null && categoryStock !== null) {
                // Ambos tienen stock, usar el mínimo
                if (categoryStock < productStock) {
                  effectiveStockLimit = categoryStock
                  isLimitedByCategory = true
                } else {
                  effectiveStockLimit = productStock
                  isLimitedByCategory = false
                }
              } else if (productStock !== null) {
                effectiveStockLimit = productStock
                isLimitedByCategory = false
              } else if (categoryStock !== null) {
                effectiveStockLimit = categoryStock
                isLimitedByCategory = true
              }
              
              return (
                <ProductCard
                  key={p.id}
                  product={p}
                  quantity={productQty}
                  stockLimit={effectiveStockLimit}
                  categoryName={p.category}
                  isPopular={top3ProductIds.has(p.id)}
                  isLimitedByCategory={isLimitedByCategory}
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

        {!isCheckingOut && !showHeroPanel && (
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

        {/* Carousel Live Preview - Replaces Cart when editing hero */}
        {!isCheckingOut && showHeroPanel && (
          <div className="store__carouselPreview">
            <div className="store__carouselPreviewLabel">Vista previa</div>
            <div className="store__carouselPreviewContent">
              <StoreHeader
                tenant={tenantFullData || tenant}
                theme={theme}
                heroStyle={heroStyle}
                slides={heroSlides}
                titlePosition={heroTitlePosition}
                overlayOpacity={heroOverlayOpacity}
                showTitle={heroShowTitle}
                showSubtitle={heroShowSubtitle}
                showCta={heroShowCta}
                carouselButtonStyle={heroCarouselButtonStyle}
                cart={{}}
                onOpenCart={() => {}}
                openingHours={[]}
                isPreview={true}
              />
            </div>
          </div>
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
          globalStockStatus={globalStockStatus}
          getCategoryStockInfo={getCategoryStockInfo}
          onBack={() => {
            setIsCheckingOut(false)
            setCheckoutError(null)
            // No borrar los datos - el usuario puede continuar luego
          }}
          onSuccess={(orderId) => {
            justPurchasedRef.current = true // Marcar que acaba de comprar para no mostrar modal de agotado
            setPaid(true)
            setLastOrderId(orderId)
            setCart({})
            // Solo borrar datos cuando se confirma exitosamente
            setCheckoutData({ customerName: '', customerPhone: '', deliveryType: 'mostrador', deliveryAddress: '', deliveryNotes: '', paymentMethod: 'efectivo' })
            setIsCheckingOut(false)
            setShowSuccessModal(true) // Mostrar modal de éxito
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
        <div className="store__modalOverlay">
          <div className="store__modal">
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
              
              {/* Imagen del producto */}
              <div className="store__formGroup">
                <label className="store__formLabel">Imagen del producto</label>
                <div className="store__imageUploadActions">
                  <input
                    type="file"
                    ref={productImageInputRef}
                    accept="image/*"
                    onChange={handleProductImageFileSelect}
                    style={{ display: 'none' }}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => productImageInputRef.current?.click()}
                    disabled={uploadingProductImage}
                  >
                    {uploadingProductImage ? (
                      <><Loader2 size={14} className="icon-spin" /> Subiendo...</>
                    ) : (
                      <><Upload size={14} /> Subir foto</>
                    )}
                  </Button>
                  {productForm.imageUrl && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setProductImageToCrop(productForm.imageUrl)
                        setShowProductImageCropper(true)
                      }}
                    >
                      <Focus size={14} /> Ajustar
                    </Button>
                  )}
                </div>
                <div className="store__urlInputWrapper">
                  <Link2 size={14} />
                  <input
                    type="text"
                    className="store__urlInput"
                    value={productForm.imageUrl}
                    onChange={(e) => setProductForm(f => ({ ...f, imageUrl: e.target.value }))}
                    placeholder="O pega una URL: https://..."
                  />
                  {productForm.imageUrl && (
                    <button 
                      className="store__urlClear"
                      onClick={() => setProductForm(f => ({ ...f, imageUrl: '' }))}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
              
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

      {/* Product Image Cropper Modal */}
      <ImageCropperModal
        isOpen={showProductImageCropper}
        onClose={() => {
          setShowProductImageCropper(false)
          setProductImageToCrop(null)
        }}
        onCropComplete={handleProductImageCropComplete}
        initialImage={productImageToCrop}
        aspectRatio={1}
        title="Ajustar imagen del producto"
        allowUrl={true}
        allowUpload={true}
      />

      {/* Delete confirmation toast */}
      {deleteConfirm && (
        <div className="store__deleteToast">
          <AlertTriangle size={16} /> Haz clic de nuevo para confirmar la eliminación
        </div>
      )}

      {/* Product Detail Modal (for customer to select extras) */}
      {showProductDetailModal && selectedProductForDetail && (() => {
        // Calcular stockLimit para el modal
        const productStock = selectedProductForDetail.stock !== null && selectedProductForDetail.stock !== undefined 
          ? selectedProductForDetail.stock : null
        const categoryStockInfo = getCategoryStockInfo(selectedProductForDetail.category)
        const categoryStock = categoryStockInfo ? categoryStockInfo.currentStock : null
        
        let modalStockLimit = null
        let modalIsLimitedByCategory = false
        
        if (productStock !== null && categoryStock !== null) {
          if (categoryStock < productStock) {
            modalStockLimit = categoryStock
            modalIsLimitedByCategory = true
          } else {
            modalStockLimit = productStock
          }
        } else if (productStock !== null) {
          modalStockLimit = productStock
        } else if (categoryStock !== null) {
          modalStockLimit = categoryStock
          modalIsLimitedByCategory = true
        }
        
        return (
          <ProductDetailModal
            product={selectedProductForDetail}
            groups={extraGroups}
            extras={extras}
            onClose={() => {
              setShowProductDetailModal(false)
              setSelectedProductForDetail(null)
            }}
            onAddToCart={addItemToCart}
            currentCartQuantity={Object.values(cart).reduce((sum, item) => {
              if (typeof item === 'object' && item.productId === selectedProductForDetail.id) {
                return sum + item.quantity
              }
              return sum
            }, 0)}
            stockLimit={modalStockLimit}
            categoryName={selectedProductForDetail.category}
            isLimitedByCategory={modalIsLimitedByCategory}
          />
        )
      })()}

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
        <div className="store__modalOverlay">
          <div className="store__extrasManagerModal">
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
        storeStatus={storeStatus}
        isPaused={isPaused}
        pauseMessage={pauseMessage}
      />

      {/* Floating Cart for Mobile */}
      {!isCheckingOut && !heroPreviewMode && (
        <FloatingCart
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
            // Scroll to top on mobile for checkout
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          disabled={isStoreClosed}
        />
      )}

      {/* Success Modal after purchase */}
      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        tenant={tenantFullData}
      />

      {/* Store Closed Modal with schedule */}
      <StoreClosedModal
        isOpen={showClosedModal}
        onClose={() => setShowClosedModal(false)}
        openingHours={tenantFullData?.opening_hours || []}
        nextOpen={storeStatus.nextOpen}
        theme={theme}
        tenantName={tenant?.name}
        isPaused={isPaused}
        pauseMessage={pauseMessage}
      />

      {/* Realtime Pause Modal - Shows when store is paused while customer is browsing */}
      {showPausedRealtimeModal && (
        <div className="store__pausedRealtimeOverlay">
          <div className="store__pausedRealtimeModal">
            <div className="store__pausedRealtimeIcon">
              <AlertTriangle size={48} />
            </div>
            <h2 className="store__pausedRealtimeTitle">Lo sentimos</h2>
            <p className="store__pausedRealtimeSubtitle">
              La tienda acaba de pausar temporalmente la toma de pedidos
            </p>
            {pauseMessage && (
              <div className="store__pausedRealtimeMessage">
                <p>{pauseMessage}</p>
              </div>
            )}
            <p className="store__pausedRealtimeInfo">
              Tu carrito se mantendrá guardado. Te invitamos a regresar más tarde.
            </p>
            <button 
              className="store__pausedRealtimeBtn"
              onClick={() => setShowPausedRealtimeModal(false)}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Out of Stock Modal - Shows when some categories run out of stock */}
      {showOutOfStockModal && outOfStockCategories.length > 0 && (
        <div className="store__pausedRealtimeOverlay store__outOfStockOverlay">
          <div className="store__pausedRealtimeModal store__outOfStockModal">
            <div className="store__pausedRealtimeIcon store__outOfStockIcon">
              <Package size={48} />
            </div>
            <h2 className="store__pausedRealtimeTitle">
              {globalStockStatus.allEmpty ? '¡Stock Agotado!' : '¡Categoría Agotada!'}
            </h2>
            <p className="store__pausedRealtimeSubtitle">
              {globalStockStatus.allEmpty 
                ? 'Nos quedamos sin stock por hoy'
                : `Nos quedamos sin stock de: ${outOfStockCategories.join(', ')}`}
            </p>
            {!globalStockStatus.allEmpty && (
              <p className="store__pausedRealtimeInfo">
                ¡Pero puedes ver otros de nuestros productos! 🛒
              </p>
            )}
            {globalStockStatus.allEmpty && (
              <p className="store__pausedRealtimeInfo">
                Te invitamos a regresar más tarde cuando reabastecemos.
              </p>
            )}
            <button 
              className="store__pausedRealtimeBtn"
              onClick={() => setShowOutOfStockModal(false)}
            >
              {globalStockStatus.allEmpty ? 'Entendido' : 'Ver otros productos'}
            </button>
          </div>
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
  globalStockStatus,
  getCategoryStockInfo,
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
  
  // Validar stock global - verificar si hay suficiente stock para todas las categorías
  const stockValidation = useMemo(() => {
    if (!globalStockStatus?.hasGlobalStock) {
      return { isValid: true, error: null }
    }
    
    // Agrupar items por categoría
    const cartByCategory = {}
    cartItems.forEach(item => {
      const catName = item.product?.category
      if (!catName) return
      if (!cartByCategory[catName]) cartByCategory[catName] = 0
      cartByCategory[catName] += item.quantity || 0
    })
    
    // Verificar stock de cada categoría
    for (const [categoryName, quantity] of Object.entries(cartByCategory)) {
      const stockInfo = globalStockStatus.stockByCategory[categoryName]
      if (!stockInfo) continue
      
      if (stockInfo.currentStock < quantity) {
        if (stockInfo.currentStock === 0) {
          return { 
            isValid: false, 
            error: `¡Sin stock! No hay ${categoryName} disponibles.` 
          }
        }
        return { 
          isValid: false, 
          error: `Stock insuficiente. Solo hay ${stockInfo.currentStock} ${categoryName} disponibles.` 
        }
      }
    }
    
    return { isValid: true, error: null }
  }, [globalStockStatus, cartItems])
  
  // Si el tipo de entrega actual está deshabilitado, buscar uno habilitado (en useEffect para evitar setState durante render)
  useEffect(() => {
    if (!isDeliveryTypeEnabled) {
      const enabledTypes = ['mostrador', 'domicilio', 'mesa'].filter(type => !deliveryConfig || deliveryConfig[type] !== false)
      if (enabledTypes.length > 0 && enabledTypes[0] !== checkoutData.deliveryType) {
        setCheckoutData({ ...checkoutData, deliveryType: enabledTypes[0] })
      }
    }
  }, [isDeliveryTypeEnabled, deliveryConfig, checkoutData, setCheckoutData])
  
  const isAllDataValid = isNameValid && isPhoneValid && isAddressValid && isDeliveryTypeEnabled && stockValidation.isValid
  
  // Boton procesar pago habilitado solo si todos los datos están válidos
  const canProcessPayment = isAllDataValid && !checkoutLoading

  const handleProcessPayment = async () => {
    if (!canProcessPayment) return

    // Verificar una vez más que el tipo de entrega esté habilitado
    if (!isDeliveryTypeEnabled) {
      setCheckoutError('El tipo de entrega seleccionado no está disponible. Por favor selecciona otro.')
      return
    }
    
    // Verificar stock global una vez más antes de procesar
    if (!stockValidation.isValid) {
      setCheckoutError(stockValidation.error || 'Stock insuficiente. Por favor ajusta tu carrito.')
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
    { key: 'mostrador', label: 'Retiro en Local', icon: '🍴', desc: 'Paso a buscar mi pedido' },
    { key: 'domicilio', label: 'Delivery', icon: '🚚', desc: 'Enviar a mi dirección' },
    { key: 'mesa', label: 'Comer Aquí', icon: '🪑', desc: 'Para consumir en el lugar' },
  ]

  const paymentMethods = [
    { key: 'efectivo', label: 'Efectivo', icon: '💵' },
    { key: 'tarjeta', label: 'Tarjeta', icon: '💳' },
    { key: 'qr', label: 'Mercado Pago', icon: '📱' },
  ]

  // Format price helper
  const formatPrice = (price) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  }

  return (
    <section className="checkoutPage" aria-label="Procesar Pedido">
      {/* Header compacto */}
      <div className="checkoutPage__header">
        <button 
          className="checkoutPage__backBtn"
          onClick={onBack}
          disabled={checkoutLoading}
          aria-label="Volver"
        >
          <span className="checkoutPage__backIcon">←</span>
          <span className="checkoutPage__backText">Volver</span>
        </button>
        <h2 className="checkoutPage__title">
          <span className="checkoutPage__titleIcon">🛒</span>
          Finalizar Pedido
        </h2>
      </div>

      <div className="checkoutPage__content">
        {/* Resumen del pedido - Colapsable en móvil */}
        <details className="checkoutPage__orderSummary" open>
          <summary className="checkoutPage__orderSummaryHeader">
            <span className="checkoutPage__orderSummaryTitle">
              📋 Tu Pedido ({cartItems?.length || 0} items)
            </span>
            <span className="checkoutPage__orderSummaryTotal">{formatPrice(cartTotal)}</span>
          </summary>
          <div className="checkoutPage__orderItems">
            {cartItems?.map((item, index) => (
              <div key={`${item.product?.id}-${index}`} className="checkoutPage__orderItem">
                <div className="checkoutPage__orderItemMain">
                  <span className="checkoutPage__orderItemQty">{item.qty}x</span>
                  <span className="checkoutPage__orderItemName">{item.product?.name}</span>
                </div>
                {item.extras && item.extras.length > 0 && (
                  <div className="checkoutPage__orderItemExtras">
                    {item.extras.map((extra, i) => (
                      <span key={i} className="checkoutPage__orderItemExtra">+ {extra.name}</span>
                    ))}
                  </div>
                )}
                <span className="checkoutPage__orderItemPrice">{formatPrice(item.lineTotal)}</span>
              </div>
            ))}
          </div>
        </details>

        {/* Formulario principal */}
        <div className="checkoutPage__form">
          {/* Paso 1: Datos personales */}
          <div className="checkoutPage__step">
            <div className="checkoutPage__stepHeader">
              <span className="checkoutPage__stepNumber">1</span>
              <h3 className="checkoutPage__stepTitle">Tus Datos</h3>
            </div>
            <div className="checkoutPage__stepContent">
              <div className="checkoutPage__fieldGroup">
                <div className="checkoutPage__field">
                  <label className="checkoutPage__label">
                    <span className="checkoutPage__labelIcon">👤</span>
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={checkoutData.customerName}
                    onChange={(e) => setCheckoutData({ ...checkoutData, customerName: e.target.value })}
                    placeholder="¿Cómo te llamamos?"
                    className={`checkoutPage__input ${checkoutData.customerName ? (isNameValid ? 'checkoutPage__input--valid' : '') : ''}`}
                    disabled={checkoutLoading}
                    autoFocus
                  />
                </div>

                <div className="checkoutPage__field">
                  <label className="checkoutPage__label">
                    <span className="checkoutPage__labelIcon">📱</span>
                    Teléfono / WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={checkoutData.customerPhone}
                    onChange={(e) => setCheckoutData({ ...checkoutData, customerPhone: e.target.value })}
                    placeholder="Para avisarte cuando esté listo"
                    className={`checkoutPage__input ${checkoutData.customerPhone ? (isPhoneValid ? 'checkoutPage__input--valid' : '') : ''}`}
                    disabled={checkoutLoading}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Paso 2: Tipo de entrega */}
          <div className="checkoutPage__step">
            <div className="checkoutPage__stepHeader">
              <span className="checkoutPage__stepNumber">2</span>
              <h3 className="checkoutPage__stepTitle">¿Cómo lo querés?</h3>
            </div>
            <div className="checkoutPage__stepContent">
              <div className="checkoutPage__deliveryOptions">
                {deliveryTypes.map((type) => {
                  const isEnabled = deliveryConfig ? deliveryConfig[type.key] !== false : true
                  const isSelected = checkoutData.deliveryType === type.key
                  return (
                    <button
                      key={type.key}
                      className={`checkoutPage__deliveryOption ${isSelected ? 'checkoutPage__deliveryOption--selected' : ''} ${!isEnabled ? 'checkoutPage__deliveryOption--disabled' : ''}`}
                      onClick={() => isEnabled && setCheckoutData({ ...checkoutData, deliveryType: type.key })}
                      disabled={checkoutLoading || !isEnabled}
                    >
                      <span className="checkoutPage__deliveryIcon">{type.icon}</span>
                      <span className="checkoutPage__deliveryLabel">{type.label}</span>
                      <span className="checkoutPage__deliveryDesc">{type.desc}</span>
                      {isSelected && <span className="checkoutPage__deliveryCheck">✓</span>}
                      {!isEnabled && <span className="checkoutPage__deliveryDisabled">No disponible</span>}
                    </button>
                  )
                })}
              </div>

              {/* Dirección para delivery */}
              {checkoutData.deliveryType === 'domicilio' && (
                <div className="checkoutPage__addressSection">
                  <div className="checkoutPage__field">
                    <label className="checkoutPage__label">
                      <span className="checkoutPage__labelIcon">📍</span>
                      Dirección de entrega
                    </label>
                    <input
                      type="text"
                      value={checkoutData.deliveryAddress}
                      onChange={(e) => setCheckoutData({ ...checkoutData, deliveryAddress: e.target.value })}
                      placeholder="Calle, número, piso/depto"
                      className={`checkoutPage__input ${checkoutData.deliveryAddress ? (isAddressValid ? 'checkoutPage__input--valid' : '') : ''}`}
                      disabled={checkoutLoading}
                    />
                  </div>
                  <div className="checkoutPage__field">
                    <label className="checkoutPage__label">
                      <span className="checkoutPage__labelIcon">📝</span>
                      Indicaciones (opcional)
                    </label>
                    <textarea
                      value={checkoutData.deliveryNotes}
                      onChange={(e) => setCheckoutData({ ...checkoutData, deliveryNotes: e.target.value })}
                      placeholder="Ej: Timbre no funciona, llamar al llegar"
                      className="checkoutPage__textarea"
                      disabled={checkoutLoading}
                      rows="2"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Paso 3: Forma de pago */}
          <div className="checkoutPage__step">
            <div className="checkoutPage__stepHeader">
              <span className="checkoutPage__stepNumber">3</span>
              <h3 className="checkoutPage__stepTitle">¿Cómo pagás?</h3>
            </div>
            <div className="checkoutPage__stepContent">
              <div className="checkoutPage__paymentOptions">
                {paymentMethods.map((method) => {
                  const isSelected = checkoutData.paymentMethod === method.key
                  return (
                    <button
                      key={method.key}
                      className={`checkoutPage__paymentOption ${isSelected ? 'checkoutPage__paymentOption--selected' : ''}`}
                      onClick={() => setCheckoutData({ ...checkoutData, paymentMethod: method.key })}
                      disabled={checkoutLoading}
                    >
                      <span className="checkoutPage__paymentIcon">{method.icon}</span>
                      <span className="checkoutPage__paymentLabel">{method.label}</span>
                      {isSelected && <span className="checkoutPage__paymentCheck">✓</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Errores */}
        {checkoutError && (
          <div className="checkoutPage__error">
            <span className="checkoutPage__errorIcon">⚠️</span>
            <span>{checkoutError}</span>
          </div>
        )}

        {!stockValidation.isValid && (
          <div className="checkoutPage__stockError">
            <span className="checkoutPage__stockErrorIcon">📦</span>
            <div>
              <strong>Stock insuficiente</strong>
              <p>{stockValidation.error}</p>
            </div>
          </div>
        )}

        {/* Botón de pago fijo en móvil */}
        <div className="checkoutPage__footer">
          <div className="checkoutPage__footerTotal">
            <span>Total a pagar</span>
            <strong>{formatPrice(cartTotal)}</strong>
          </div>
          <button
            className={`checkoutPage__submitBtn ${canProcessPayment ? '' : 'checkoutPage__submitBtn--disabled'}`}
            onClick={handleProcessPayment}
            disabled={!canProcessPayment}
          >
            {checkoutLoading ? (
              <>
                <span className="checkoutPage__spinner"></span>
                Procesando...
              </>
            ) : canProcessPayment ? (
              <>
                Confirmar Pedido
                <span className="checkoutPage__submitIcon">→</span>
              </>
            ) : (
              'Completá los datos para continuar'
            )}
          </button>
        </div>
      </div>
    </section>
  )
}

