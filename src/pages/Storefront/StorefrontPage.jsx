import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react'
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
import ProductModal from '../../components/dashboard/ProductModal/ProductModal'
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
import CartToast, { useCartToast } from '../../components/storefront/CartToast/CartToast'
import { loadJson, saveJson } from '../../shared/storage'
import { fetchDeliveryConfig, fetchTenantBySlugFull, fetchTenantPauseStatusBySlug, fetchOrderLimitsStatusBySlug, subscribeToOrderLimits, fetchPaymentMethodsConfig, fetchDeliveryPricing } from '../../lib/supabaseApi'
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient'
import { checkIsStoreOpen } from '../../shared/openingHours'
import {
  SUBSCRIPTION_TIERS,
  TIER_LABELS,
  PRODUCT_CARD_LAYOUTS,
  CATEGORY_CARD_LAYOUTS,
  STORE_HERO_STYLES,
  CAROUSEL_BUTTON_STYLES,
  isFeatureAvailable,
  ORDER_LIMITS,
  hasUnlimitedOrders,
} from '../../shared/subscriptions'
import { uploadHeroImage, uploadProductImage } from '../../lib/supabaseStorage'
import ImageUploaderWithEditor from '../../components/ui/ImageUploaderWithEditor/ImageUploaderWithEditor'
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
  Folder,
  FolderUp,
  ChevronRight,
  Settings,
  Clock,
  Focus,
  Link2,
  ChevronDown,
  Menu,
  Smartphone,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  Minus,
  RotateCcw,
  ShoppingCart,
  ClipboardList,
  User,
  Phone,
  Truck,
  UtensilsCrossed,
  Armchair,
  Banknote,
  CreditCard,
  MapPin,
  FileText,
  CheckCircle,
  Circle,
  LayoutList,
  Type,
  RectangleHorizontal,
} from 'lucide-react'
import StoreFooter from '../../components/storefront/StoreFooter/StoreFooter'
import { fetchPublicStoreFooter } from '../../lib/supabaseApi'
import StoreCategoryNav from '../../components/storefront/StoreCategoryNav/StoreCategoryNav'
import CategoryModal from '../../components/dashboard/CategoryModal/CategoryModal'
import { Search, Crop } from 'lucide-react'

const LocationMapPicker = lazy(() => import('../../components/storefront/LocationMapPicker/LocationMapPicker'))

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
  
  // Hierarchical category navigation state (folder-like)
  const [currentCategoryId, setCurrentCategoryId] = useState(null) // null = root level
  
  // Category modal state (for editing in store)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [categoryModalParentId, setCategoryModalParentId] = useState(null)
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('')

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
  // Stock jerárquico: retorna el mínimo stock entre la categoría y sus ancestros
  const getCategoryStockInfo = (categoryName) => {
    // Buscar la categoría base
    const category = sortedCategories.find(c => c.name === categoryName)
    if (!category) return null

    // Recopilar todas las categorías con stock en la jerarquía
    const categoriesWithStock = []
    let current = category
    while (current) {
      if (current.maxStock !== null && current.maxStock !== undefined) {
        categoriesWithStock.push(current)
      }
      current = current.parentId ? sortedCategories.find(c => c.id === current.parentId) : null
    }
    if (categoriesWithStock.length === 0) return null

    // Calcular el stock disponible en cada nivel (restando lo que hay en el carrito)
    const inCart = getCategoryCartQuantity(categoryName)
    // El stock disponible de la categoría base
    let availableStock = Math.max(0, (category.currentStock || 0) - inCart)
    let limitingCategory = category

    // Buscar el mínimo stock entre ancestros
    for (const cat of categoriesWithStock) {
      if (cat.id !== category.id) {
        // Para ancestros, no restamos inCart porque el carrito solo afecta a la categoría base
        if ((cat.currentStock || 0) < availableStock) {
          availableStock = cat.currentStock || 0
          limitingCategory = cat
        }
      }
    }

    return {
      maxStock: category.maxStock,
      currentStock: category.currentStock || 0,
      inCart,
      availableStock,
      isEmpty: availableStock === 0,
      limitingCategory: limitingCategory.name,
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
      setCart(adjustedCart)
    }
  }, [globalStockStatus.stockByCategory, globalStockStatus.hasGlobalStock])

  // Default selected category to "all" (null = todas)
  const effectiveSelectedCategory = useMemo(() => {
    if (selectedCategory !== null) return selectedCategory
    // Por defecto mostrar "Todas"
    return '__all__'
  }, [selectedCategory, sortedCategories, hasUnassignedProducts])

  // Check if we have hierarchical categories (any category has children)
  const hasHierarchicalCategories = useMemo(() => {
    return categories.some(c => c.parentId !== null && c.parentId !== undefined)
  }, [categories])

  // Get current category for folder navigation
  const currentCategory = useMemo(() => {
    if (!currentCategoryId) return null
    return categories.find(c => c.id === currentCategoryId)
  }, [categories, currentCategoryId])

  // Get subcategories of current category
  const currentSubcategories = useMemo(() => {
    return categories
      .filter(c => c.parentId === currentCategoryId && c.active)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
  }, [categories, currentCategoryId])

  // Helper to get all descendant category IDs
  const getDescendantCategoryIds = (categoryId) => {
    const descendants = []
    const findChildren = (parentId) => {
      const children = categories.filter(c => c.parentId === parentId)
      children.forEach(child => {
        descendants.push(child.id)
        findChildren(child.id)
      })
    }
    findChildren(categoryId)
    return descendants
  }

  // Check if current category has subcategories (is a folder)
  const currentCategoryHasSubcategories = useMemo(() => {
    if (!currentCategoryId) return true // Root always has subcategories (the categories)
    return currentSubcategories.length > 0
  }, [currentCategoryId, currentSubcategories])

  // Products without category go to "Otros" virtual category
  const productsWithOtros = useMemo(() => {
    return visible.map(p => {
      if (!p.categoryId && !p.subcategoryId && !p.category) {
        return { ...p, _isOtros: true }
      }
      return p
    })
  }, [visible])

  // Check if there are "Otros" products
  const hasOtrosProducts = useMemo(() => {
    return productsWithOtros.some(p => p._isOtros)
  }, [productsWithOtros])

  // Search results - includes both categories and products
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return { categories: [], products: [] }
    
    const query = searchQuery.toLowerCase().trim()
    
    const matchingCategories = categories.filter(c => 
      c.active && (
        c.name?.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query) ||
        c.shortDescription?.toLowerCase().includes(query)
      )
    )
    
    const matchingProducts = productsWithOtros.filter(p =>
      p.name?.toLowerCase().includes(query) ||
      p.description?.toLowerCase().includes(query) ||
      p.category?.toLowerCase().includes(query)
    )
    
    return { categories: matchingCategories, products: matchingProducts }
  }, [searchQuery, categories, productsWithOtros])

  // Filter products - only show when inside a leaf category OR searching
  const filteredProducts = useMemo(() => {
    // If searching, return search results
    if (searchQuery.trim()) {
      return searchResults.products
    }

    // If using hierarchical navigation
    if (hasHierarchicalCategories) {
      // At root level - don't show products, only categories
      if (currentCategoryId === null) {
        return []
      }
      
      // Special case: "Otros" category for uncategorized products
      if (currentCategoryId === '__otros__') {
        return productsWithOtros.filter(p => p._isOtros)
      }
      
      // If current category has subcategories, don't show products
      if (currentCategoryHasSubcategories) {
        return []
      }
      
      // In a leaf category - show its products
      const descendantIds = getDescendantCategoryIds(currentCategoryId)
      const validCategoryIds = [currentCategoryId, ...descendantIds]
      
      return productsWithOtros.filter((p) => 
        validCategoryIds.includes(p.categoryId) || 
        validCategoryIds.includes(p.subcategoryId)
      )
    }
    
    // Legacy flat category filtering
    if (effectiveSelectedCategory === '__all__') {
      return productsWithOtros
    } else if (effectiveSelectedCategory === '__unassigned__' || effectiveSelectedCategory === '__otros__') {
      return productsWithOtros.filter((p) => p._isOtros)
    } else if (effectiveSelectedCategory) {
      return productsWithOtros.filter((p) => p.category === effectiveSelectedCategory)
    }

    return productsWithOtros
  }, [productsWithOtros, effectiveSelectedCategory, hasHierarchicalCategories, currentCategoryId, currentCategoryHasSubcategories, searchQuery, searchResults, categories])

  // Cart state with localStorage persistence
  const cartStorageKey = `cart.${slug}`
  const [cart, setCart] = useState(() => loadJson(cartStorageKey, {}))
  const [paid, setPaid] = useState(false)
  const [lastOrderId, setLastOrderId] = useState(null)
  const [showSuccessModal, setShowSuccessModal] = useState(false) // Modal de compra exitosa
  const [lastDeliveryType, setLastDeliveryType] = useState('mostrador')
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
    deliveryLat: null,
    deliveryLng: null,
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
  
  // Payment methods config (loaded from Supabase)
  const paymentMethodsConfigKey = `paymentMethodsConfig.${tenantId}`
  const [paymentMethodsConfig, setPaymentMethodsConfig] = useState({
    efectivo: true,
    tarjeta: true,
    qr: true,
  })
  
  // Delivery pricing config (loaded from Supabase)
  const deliveryPricingKey = `deliveryPricing.${tenantId}`
  const [deliveryPricing, setDeliveryPricing] = useState({
    type: 'free', // 'free' | 'fixed' | 'threshold'
    fixedPrice: 0,
    freeThreshold: 0,
  })

  // Hero customization panel state - declared early for use in effects
  const [showHeroPanel, setShowHeroPanel] = useState(false)
  const [localHeroTheme, setLocalHeroTheme] = useState(null)
  const [heroPreviewMode, setHeroPreviewMode] = useState(false)
  const [uploadingHeroImage, setUploadingHeroImage] = useState(null) // slide index being uploaded
  const [showAdminMenu, setShowAdminMenu] = useState(false) // Mobile admin dropdown
  // heroFileInputRef removed — replaced by ImageUploaderWithEditor
  const heroPanelRef = useRef(null)
  const cardPanelRef = useRef(null)
  const adminMenuRef = useRef(null)
  const heroUploaderRef = useRef(null)

  // Store open/closed status based on opening hours
  const [storeStatus, setStoreStatus] = useState({ isOpen: true, noSchedule: true, nextOpen: null })
  const [showClosedModal, setShowClosedModal] = useState(false)
  
  // Store paused status (from admin)
  const [isPaused, setIsPaused] = useState(false)
  const [pauseMessage, setPauseMessage] = useState('')
  const [showPausedRealtimeModal, setShowPausedRealtimeModal] = useState(false)
  const wasPausedRef = useRef(false) // Track previous pause state
  
  // Store footer data
  const [storeFooterData, setStoreFooterData] = useState(null)
  
  // Cart toast notifications
  const { toast: cartToast, dismissToast: dismissCartToast, showAddToast, showRemoveToast, showDeleteToast, showClearToast } = useCartToast()
  
  // Persist cart to localStorage
  useEffect(() => {
    if (Object.keys(cart).length > 0) {
      saveJson(cartStorageKey, cart)
    } else {
      // Clear cart from storage when empty
      saveJson(cartStorageKey, {})
    }
  }, [cart, cartStorageKey])
  
  // Out of stock modal state - now tracks which categories ran out
  const [showOutOfStockModal, setShowOutOfStockModal] = useState(false)
  const [outOfStockCategories, setOutOfStockCategories] = useState([])
  const justPurchasedRef = useRef(false) // Track if user just made a purchase
  
  // Order limits state (for subscription-based order limits)
  const [orderLimitsStatus, setOrderLimitsStatus] = useState({
    limit: 15,
    remaining: 15,
    isUnlimited: false,
    canAcceptOrders: true,
    resetDate: null,
    tier: 'free',
  })
  const wasOrderLimitReachedRef = useRef(false) // Track previous order limit state
  
  // Calculate if store is closed for blocking cart (paused state only - NOT out of stock)
  // Ahora solo bloqueamos por horario o pausa, NO por stock agotado (se puede comprar en otras categorías)
  // También bloqueamos si se alcanzó el límite de pedidos del plan
  const isStoreClosed = (!storeStatus.isOpen && !storeStatus.noSchedule) || isPaused || !orderLimitsStatus.canAcceptOrders
  
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
  
  // Close admin menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showAdminMenu && adminMenuRef.current && !adminMenuRef.current.contains(event.target)) {
        setShowAdminMenu(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showAdminMenu])
  
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
  
  // Load and subscribe to order limits in real-time
  useEffect(() => {
    if (!slug || !tenantId) return
    
    // Initial load
    const loadOrderLimits = async () => {
      try {
        if (isSupabaseConfigured) {
          const status = await fetchOrderLimitsStatusBySlug(slug)
          setOrderLimitsStatus(status)
          wasOrderLimitReachedRef.current = !status.canAcceptOrders
          
          // If limit was already reached on load, show welcome modal (which now includes limit warning)
          if (!status.canAcceptOrders && !status.isUnlimited) {
            setShowWelcomeModal(true)
          }
        } else {
          // Mock mode: use localStorage
          const mockStatus = loadJson(`orderLimits.${tenantId}`, {
            limit: 15,
            remaining: 15,
            isUnlimited: false,
            canAcceptOrders: true,
            resetDate: null,
            tier: 'free',
          })
          setOrderLimitsStatus(mockStatus)
        }
      } catch (err) {
        console.error('Error loading order limits:', err)
      }
    }
    
    loadOrderLimits()
    
    // Subscribe to real-time updates
    if (isSupabaseConfigured && tenantId) {
      const unsubscribe = subscribeToOrderLimits(tenantId, (newStatus) => {
        setOrderLimitsStatus(newStatus)
        
        // If limit was just reached (wasn't reached before, now it is), show welcome modal
        if (!newStatus.canAcceptOrders && !wasOrderLimitReachedRef.current && !newStatus.isUnlimited) {
          setShowWelcomeModal(true)
        }
        
        wasOrderLimitReachedRef.current = !newStatus.canAcceptOrders
      })
      
      return () => unsubscribe()
    }
  }, [slug, tenantId])
  
  // Check store status periodically
  useEffect(() => {
    const checkStatus = () => {
      const openingHours = tenantFullData?.opening_hours || []
      const status = checkIsStoreOpen(openingHours)
      setStoreStatus(status)
    }
    checkStatus()
    const interval = setInterval(checkStatus, 60000) // Check every minute
    return () => clearInterval(interval)
  }, [tenantFullData?.opening_hours])

  // Cargar deliveryConfig, paymentMethodsConfig y deliveryPricing desde Supabase cuando cambia el tenantId
  useEffect(() => {
    const loadConfig = async () => {
      if (!tenantId) return
      setLoadingDeliveryConfig(true)
      try {
        if (isSupabaseConfigured) {
          const [config, pmConfig, dpConfig] = await Promise.all([
            fetchDeliveryConfig(tenantId),
            fetchPaymentMethodsConfig(tenantId),
            fetchDeliveryPricing(tenantId),
          ])
          setDeliveryConfig(config)
          setPaymentMethodsConfig(pmConfig)
          setDeliveryPricing(dpConfig)
          // Guardar en localStorage como cache
          saveJson(deliveryConfigKey, config)
          saveJson(paymentMethodsConfigKey, pmConfig)
          saveJson(deliveryPricingKey, dpConfig)
        } else {
          // Fallback a localStorage si no hay Supabase
          const cached = loadJson(deliveryConfigKey, { mostrador: true, domicilio: true, mesa: true })
          setDeliveryConfig(cached)
          const cachedPM = loadJson(paymentMethodsConfigKey, { efectivo: true, tarjeta: true, qr: true })
          setPaymentMethodsConfig(cachedPM)
          const cachedDP = loadJson(deliveryPricingKey, { type: 'free', fixedPrice: 0, freeThreshold: 0 })
          setDeliveryPricing(cachedDP)
        }
      } catch (err) {
        console.error('Error loading configs:', err)
        // Fallback a localStorage
        const cached = loadJson(deliveryConfigKey, { mostrador: true, domicilio: true, mesa: true })
        setDeliveryConfig(cached)
        const cachedPM = loadJson(paymentMethodsConfigKey, { efectivo: true, tarjeta: true, qr: true })
        setPaymentMethodsConfig(cachedPM)
        const cachedDP = loadJson(deliveryPricingKey, { type: 'free', fixedPrice: 0, freeThreshold: 0 })
        setDeliveryPricing(cachedDP)
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
    
    // Recargar cuando la ventana gane foco (ej: volver de pagar)
    const handleFocus = () => {
      console.log('🔄 StorefrontPage: ventana ganó foco, recargando tenant...')
      loadTenantFull()
    }
    window.addEventListener('focus', handleFocus)
    
    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [slug, tenant, tenantId])

  // Update pause status when tenant data is loaded
  useEffect(() => {
    if (tenantFullData) {
      setIsPaused(tenantFullData.is_paused || false)
      setPauseMessage(tenantFullData.pause_message || '')
    }
  }, [tenantFullData])

  // Load store footer data
  useEffect(() => {
    const loadFooterData = async () => {
      if (!tenantId) return
      try {
        if (isSupabaseConfigured) {
          const footerData = await fetchPublicStoreFooter(tenantId)
          setStoreFooterData(footerData)
        } else {
          // Mock mode: check localStorage
          const mockFooterKey = 'mock.storeFooterSettings'
          const mockData = loadJson(mockFooterKey, {})
          if (mockData[tenantId]) {
            setStoreFooterData(mockData[tenantId])
          }
        }
      } catch (err) {
        console.error('Error loading store footer data:', err)
      }
    }
    loadFooterData()
  }, [tenantId])

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

  // Get subscription tier from tenant (super_admin bypasses tier restrictions)
  // Use tenantFullData for most up-to-date info, fallback to tenant from Redux
  // Check if premium is still active (not expired)
  const subscriptionTier = useMemo(() => {
    const tenantSource = tenantFullData || tenant
    const tier = tenantSource?.subscription_tier || SUBSCRIPTION_TIERS.FREE
    const premiumUntil = tenantSource?.premium_until
    
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
  }, [tenantFullData, tenant])
  
  const effectiveTier = isSuperAdmin ? SUBSCRIPTION_TIERS.PREMIUM_PRO : subscriptionTier

  // Hero limits - all tiers can upload
  const canUploadHeroImage = true
  const maxHeroSlides = effectiveTier === SUBSCRIPTION_TIERS.PREMIUM_PRO ? 3 : 
                        effectiveTier === SUBSCRIPTION_TIERS.PREMIUM ? 3 : 3
  const canAddMoreSlides = heroSlides.length < maxHeroSlides

  // Get card layout from theme (local for preview, or saved)
  const cardTheme = localCardTheme || theme || {}
  const cardLayout = cardTheme?.productCardLayout || 'classic'
  const categoryLayout = cardTheme?.categoryCardLayout || 'grid'
  
  // Card colors: only override CSS defaults when explicitly set by user
  // null/undefined = use CSS defaults (glass bg, theme accent, etc.)
  const cardColors = {
    cardBg: cardTheme?.cardBg || null,
    cardText: cardTheme?.cardText || null,
    cardDesc: cardTheme?.cardDesc || null,
    cardPrice: cardTheme?.cardPrice || null,
    cardButton: cardTheme?.cardButton || null,
  }
  
  // Color picker display values (show current effective color for the picker UI)
  const cardColorDefaults = {
    cardBg: '#ffffff',
    cardText: '#1f2937',
    cardDesc: '#6b7280',
    cardPrice: '#059669',
    cardButton: theme?.accent || '#f59e0b',
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
    setLocalHeroTheme(prev => {
      const newValue = {
        ...(prev || theme || {}),
        ...patch
      }
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
        mobileFocalPoint: 'center', // top, center, bottom
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
  const handleHeroImageUpload = async (index, file, focalPoint) => {
    // Si solo se ajustó el encuadre (sin archivo nuevo), no subir
    if (!file) return
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
    showAddToast(product.name, quantity)
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
    
    // If there are extras configured for this product's category, open the modal instead
    // Filtrar grupos de extras según la categoría del producto
    const productCategoryId = categories.find(c => c.name === product.category)?.id
    const applicableExtraGroups = extraGroups.filter(group => {
      const groupCategoryIds = group.categoryIds || []
      return groupCategoryIds.length === 0 || groupCategoryIds.includes(productCategoryId)
    })
    
    if (applicableExtraGroups.length > 0) {
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
    showAddToast(product.name)
  }

  const removeOne = (cartItemId) => {
    const item = cart[cartItemId]
    const productName = item?.product?.name || ''
    
    setCart((c) => {
      setPaid(false)
      const currentItem = c[cartItemId]
      if (!currentItem) return c
      
      if (typeof currentItem === 'object') {
        const newQty = Math.max(0, currentItem.quantity - 1)
        if (newQty === 0) {
          const { [cartItemId]: _removed, ...rest } = c
          return rest
        }
        return {
          ...c,
          [cartItemId]: {
            ...currentItem,
            quantity: newQty,
            totalPrice: currentItem.unitPrice * newQty,
          },
        }
      }
      
      // Old format
      const next = Math.max(0, (currentItem || 0) - 1)
      if (next === 0) {
        const { [cartItemId]: _removed, ...rest } = c
        return rest
      }
      return { ...c, [cartItemId]: next }
    })
    
    // Show toast after removing
    if (item) {
      const newQty = (item.quantity || 1) - 1
      if (newQty === 0) {
        showDeleteToast(productName)
      } else {
        showRemoveToast(productName)
      }
    }
  }

  // Increment quantity of an existing cart item (by cartItemId)
  const incrementCartItem = (cartItemId) => {
    // Block if store is closed
    if (isStoreClosed) {
      setShowClosedModal(true)
      return
    }
    
    const item = cart[cartItemId]
    if (!item || typeof item !== 'object') return
    
    const product = item.product
    const productId = item.productId
    
    // Calculate current quantity in cart for this product
    const currentInCart = Object.values(cart).reduce((sum, cartItem) => {
      if (typeof cartItem === 'object' && cartItem.productId === productId) {
        return sum + cartItem.quantity
      }
      return sum
    }, 0)
    
    // Calculate effective stock limit
    const productStock = product?.stock !== null && product?.stock !== undefined ? product.stock : null
    const categoryStockInfo = getCategoryStockInfo(product?.category)
    const categoryStock = categoryStockInfo ? categoryStockInfo.currentStock : null
    
    let effectiveStockLimit = null
    
    if (productStock !== null && categoryStock !== null) {
      effectiveStockLimit = Math.min(productStock, categoryStock)
    } else if (productStock !== null) {
      effectiveStockLimit = productStock
    } else if (categoryStock !== null) {
      effectiveStockLimit = categoryStock
    }
    
    // Check if we can add more
    if (effectiveStockLimit !== null && currentInCart >= effectiveStockLimit) {
      return // Can't add more
    }
    
    setCart((c) => {
      const existing = c[cartItemId]
      if (!existing || typeof existing !== 'object') return c
      
      const newQty = existing.quantity + 1
      
      // Verify limit before incrementing
      if (effectiveStockLimit !== null && newQty > effectiveStockLimit) {
        return c
      }
      
      return {
        ...c,
        [cartItemId]: {
          ...existing,
          quantity: newQty,
          totalPrice: existing.unitPrice * newQty,
        },
      }
    })
    setPaid(false)
    showAddToast(product?.name || '')
  }

  // Edit cart item - opens product detail modal to change extras/quantity
  const handleEditCartItem = (cartItem) => {
    if (!cartItem || !cartItem.product) return
    
    // Remove the item being edited from cart
    const cartItemId = cartItem.cartItemId
    setCart((c) => {
      const newCart = { ...c }
      delete newCart[cartItemId]
      return newCart
    })
    
    // Open product detail modal with the product
    setSelectedProductForDetail(cartItem.product)
    setShowProductDetailModal(true)
  }

  // Product management functions
  const openAddProduct = () => {
    setEditingProduct(null)
    setShowProductModal(true)
  }

  const openEditProduct = (product) => {
    setEditingProduct(product)
    setShowProductModal(true)
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
          // Refrescar categorías para obtener el nuevo stock
          dispatch(fetchCategoriesForTenant(tenantId))
        }
      )
      .subscribe()

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
          // Refrescar productos para obtener el nuevo stock
          dispatch(fetchProductsForTenant(tenantId))
        }
      )
      .subscribe()

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
        mobileSettings={tenantFullData ? {
          headerDesign: tenantFullData.mobile_header_design,
          cardDesign: tenantFullData.mobile_card_design,
          spacingOption: tenantFullData.mobile_spacing_option,
          typographyOption: tenantFullData.mobile_typography_option,
          carouselOptions: tenantFullData.mobile_carousel_options,
        } : null}
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
        orderLimitsStatus={orderLimitsStatus}
      />

      <div className={`store__layout ${showHeroPanel ? 'store__layout--heroEditing' : ''}`} id="productos">
        <section className="store__products" aria-label="Productos">
          {isAdmin && !heroPreviewMode && (
            <div className="store__adminBar" ref={adminMenuRef}>
              <div className="store__adminHeader">
                <span className="store__adminLabel"><Wrench size={14} /> Modo administrador</span>
                <button 
                  className="store__adminToggle"
                  onClick={() => setShowAdminMenu(!showAdminMenu)}
                  aria-expanded={showAdminMenu}
                >
                  <Menu size={18} />
                  <ChevronDown size={14} className={`store__adminToggleIcon ${showAdminMenu ? 'store__adminToggleIcon--open' : ''}`} />
                </button>
              </div>
              <div className={`store__adminActions ${showAdminMenu ? 'store__adminActions--open' : ''}`}>
                <Button 
                  size="sm" 
                  variant={heroPreviewMode ? 'primary' : 'secondary'}
                  onClick={() => { 
                    const entering = !heroPreviewMode
                    setHeroPreviewMode(entering)
                    setShowAdminMenu(false)
                    // Al entrar en vista previa, ocultar todos los paneles de edición
                    if (entering) {
                      setShowCardPanel(false)
                      setShowHeroPanel(false)
                    }
                  }}
                >
                  {heroPreviewMode ? <><Pencil size={14} /> Salir de vista previa</> : <><Eye size={14} /> Ver como cliente</>}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => {
                  const willShow = !showHeroPanel
                  setShowHeroPanel(willShow)
                  setShowAdminMenu(false)
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
                  setShowAdminMenu(false)
                  if (willShow) {
                    setShowHeroPanel(false)
                    setTimeout(() => cardPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
                  }
                }}>
                  <LayoutGrid size={14} /> Personalizar Cards
                </Button>
                <Button size="sm" variant="secondary" onClick={() => { setShowExtrasManagerModal(true); setShowAdminMenu(false); }}>
                  <Layers size={14} /> Extras / Toppings
                </Button>
                <Button size="sm" onClick={() => { openAddProduct(); setShowAdminMenu(false); }}>
                  <Plus size={14} /> Agregar producto
                </Button>
              </div>
            </div>
          )}

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

          {/* Search Bar */}
          <div className="store__searchBar">
            <Search size={18} className="store__searchIcon" />
            <input
              type="text"
              className="store__searchInput"
              placeholder="Buscar productos..."
              value={searchQuery || ''}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="store__searchClear"
                onClick={() => setSearchQuery('')}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Search Results - Categories found */}
          {searchQuery.trim() && searchResults.categories.length > 0 && (
            <div className="store__searchResults">
              <h3 className="store__searchResultsTitle">Categorías encontradas</h3>
              <div className="store__searchResultsCategories">
                {searchResults.categories.map(cat => (
                  <button
                    key={cat.id}
                    className="store__searchResultCategory"
                    onClick={() => {
                      setCurrentCategoryId(cat.id)
                      setSearchQuery('')
                    }}
                    type="button"
                  >
                    <Folder size={16} />
                    <span>{cat.name}</span>
                    <ChevronRight size={14} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Hierarchical Category Navigation (when categories have subcategories and NOT searching) */}
          {hasHierarchicalCategories && !searchQuery.trim() && (
            <StoreCategoryNav
              tenantId={tenantId}
              currentCategoryId={currentCategoryId}
              onNavigate={(categoryId) => {
                setCurrentCategoryId(categoryId)
                setSearchQuery('') // Clear search when navigating
              }}
              cardLayout={categoryLayout}
              isAdmin={isAdmin}
              onEditCategory={(category) => {
                setEditingCategory(category)
                setCategoryModalParentId(null)
                setShowCategoryModal(true)
              }}
              onDeleteCategory={(categoryId) => {
                dispatch(deleteCategory({ tenantId, categoryId }))
                if (currentCategoryId === categoryId) {
                  setCurrentCategoryId(null)
                }
              }}
              onCreateCategory={(parentId) => {
                setEditingCategory(null)
                setCategoryModalParentId(parentId)
                setShowCategoryModal(true)
              }}
            />
          )}

          {/* Category Navigation Tabs (for flat categories or as secondary nav) */}
          {!hasHierarchicalCategories && (
          <div className="store__categoryTabs">
            {/* Botón "Todas" fijo al inicio */}
            <button
              type="button"
              className={`store__categoryTab store__categoryTab--all ${effectiveSelectedCategory === '__all__' ? 'store__categoryTab--active' : ''}`}
              onClick={() => setSelectedCategory('__all__')}
            >
              Todas
              <span className="store__categoryCount">{visible.length}</span>
            </button>
            
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
                          {isAdmin && !heroPreviewMode && (
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
            {isAdmin && !heroPreviewMode && (
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
                      const isSelected = heroStyle === styleId
                      return (
                        <button
                          key={styleId}
                          type="button"
                          className={`store__heroStyleOption ${isSelected ? 'store__heroStyleOption--selected' : ''}`}
                          onClick={() => updateHeroTheme({ heroStyle: styleId })}
                          title={config.description}
                        >
                          <span className="store__heroStyleIcon">{config.icon || ''}</span>
                          <span className="store__heroStyleLabel">{config.label}</span>
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
                      return (
                        <button
                          key={styleId}
                          type="button"
                          className={`store__heroButtonStyleBtn ${heroCarouselButtonStyle === styleId ? 'store__heroButtonStyleBtn--selected' : ''}`}
                          onClick={() => updateHeroTheme({ heroCarouselButtonStyle: styleId })}
                          title={styleConfig.description}
                        >
                          <span className="store__heroButtonStylePreview">{styleConfig.preview}</span>
                          <span className="store__heroButtonStyleLabel">{styleConfig.label}</span>
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
                          <div className="store__heroImageUpload">
                            <input
                              type="text"
                              placeholder="URL de imagen o sube un archivo"
                              value={slide.imageUrl || ''}
                              onChange={(e) => updateHeroSlide(index, 'imageUrl', e.target.value)}
                              className="store__heroSlideInput"
                            />
                            <ImageUploaderWithEditor
                              ref={heroUploaderRef}
                              aspect={16 / 9}
                              modalTitle="Ajustar encuadre del hero"
                              disabled={uploadingHeroImage !== null}
                              onImageReady={(file, focalPoint) => handleHeroImageUpload(index, file, focalPoint)}
                            >
                              <span className="store__heroUploadBtn">
                                {uploadingHeroImage === index ? <Loader2 size={16} className="icon-spin" /> : <FolderUp size={16} />}
                              </span>
                            </ImageUploaderWithEditor>
                            {slide.imageUrl && (
                              <button
                                type="button"
                                className="store__heroUploadBtn"
                                title="Editar recorte"
                                onClick={() => heroUploaderRef.current?.openEditor(slide.imageUrl)}
                              >
                                <Crop size={16} />
                              </button>
                            )}
                          </div>
                          {/* Mobile Focal Point Selector - Draggable with Controls */}
                          {slide.imageUrl && (
                            <div className="store__heroMobileFocus">
                              <span className="store__heroMobileFocusLabel">
                                <Smartphone size={14} /> Ajuste móvil:
                              </span>
                              <div className="store__heroMobileFocusContainer">
                                {/* Arrow Controls - Left */}
                                <button
                                  type="button"
                                  className="store__heroMobileFocusArrow store__heroMobileFocusArrow--left"
                                  onClick={() => {
                                    const currentX = slide.mobileFocalPoint?.x ?? 50;
                                    updateHeroSlide(index, 'mobileFocalPoint', { 
                                      ...slide.mobileFocalPoint, 
                                      x: Math.max(0, currentX - 5),
                                      y: slide.mobileFocalPoint?.y ?? 50
                                    });
                                  }}
                                  title="Mover izquierda"
                                >
                                  <ArrowLeft size={16} />
                                </button>
                                
                                <div className="store__heroMobileFocusMiddle">
                                  {/* Arrow Up */}
                                  <button
                                    type="button"
                                    className="store__heroMobileFocusArrow store__heroMobileFocusArrow--up"
                                    onClick={() => {
                                      const currentY = slide.mobileFocalPoint?.y ?? 50;
                                      updateHeroSlide(index, 'mobileFocalPoint', { 
                                        ...slide.mobileFocalPoint,
                                        x: slide.mobileFocalPoint?.x ?? 50,
                                        y: Math.max(0, currentY - 5)
                                      });
                                    }}
                                    title="Mover arriba"
                                  >
                                    <ArrowUp size={16} />
                                  </button>
                                  
                                  {/* Phone Preview */}
                                  <div 
                                    className="store__heroMobileFocusPreview"
                                    onMouseDown={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      const updatePosition = (clientX, clientY) => {
                                        const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
                                        const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
                                        updateHeroSlide(index, 'mobileFocalPoint', { 
                                          x: Math.round(x), 
                                          y: Math.round(y),
                                          zoom: slide.mobileFocalPoint?.zoom ?? 100
                                        });
                                      };
                                      updatePosition(e.clientX, e.clientY);
                                      
                                      const handleMouseMove = (moveEvent) => {
                                        updatePosition(moveEvent.clientX, moveEvent.clientY);
                                      };
                                      const handleMouseUp = () => {
                                        document.removeEventListener('mousemove', handleMouseMove);
                                        document.removeEventListener('mouseup', handleMouseUp);
                                      };
                                      document.addEventListener('mousemove', handleMouseMove);
                                      document.addEventListener('mouseup', handleMouseUp);
                                    }}
                                    onTouchStart={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      const touch = e.touches[0];
                                      const updatePosition = (clientX, clientY) => {
                                        const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
                                        const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
                                        updateHeroSlide(index, 'mobileFocalPoint', { 
                                          x: Math.round(x), 
                                          y: Math.round(y),
                                          zoom: slide.mobileFocalPoint?.zoom ?? 100
                                        });
                                      };
                                      updatePosition(touch.clientX, touch.clientY);
                                      
                                      const handleTouchMove = (moveEvent) => {
                                        const moveTouch = moveEvent.touches[0];
                                        updatePosition(moveTouch.clientX, moveTouch.clientY);
                                      };
                                      const handleTouchEnd = () => {
                                        document.removeEventListener('touchmove', handleTouchMove);
                                        document.removeEventListener('touchend', handleTouchEnd);
                                      };
                                      document.addEventListener('touchmove', handleTouchMove);
                                      document.addEventListener('touchend', handleTouchEnd);
                                    }}
                                  >
                                    <div 
                                      className="store__heroMobileFocusImage"
                                      style={{ 
                                        backgroundImage: `url(${slide.imageUrl})`,
                                        backgroundPosition: `${slide.mobileFocalPoint?.x ?? 50}% ${slide.mobileFocalPoint?.y ?? 50}%`,
                                        backgroundSize: (() => {
                                          const zoom = slide.mobileFocalPoint?.zoom ?? 100;
                                          if (zoom <= 100) return 'cover';
                                          return `${zoom}%`;
                                        })()
                                      }}
                                    />
                                    <div className="store__heroMobileFocusMarker" style={{
                                      left: `${slide.mobileFocalPoint?.x ?? 50}%`,
                                      top: `${slide.mobileFocalPoint?.y ?? 50}%`,
                                    }} />
                                  </div>
                                  
                                  {/* Arrow Down */}
                                  <button
                                    type="button"
                                    className="store__heroMobileFocusArrow store__heroMobileFocusArrow--down"
                                    onClick={() => {
                                      const currentY = slide.mobileFocalPoint?.y ?? 50;
                                      updateHeroSlide(index, 'mobileFocalPoint', { 
                                        ...slide.mobileFocalPoint,
                                        x: slide.mobileFocalPoint?.x ?? 50,
                                        y: Math.min(100, currentY + 5)
                                      });
                                    }}
                                    title="Mover abajo"
                                  >
                                    <ArrowDown size={16} />
                                  </button>
                                </div>
                                
                                {/* Arrow Controls - Right */}
                                <button
                                  type="button"
                                  className="store__heroMobileFocusArrow store__heroMobileFocusArrow--right"
                                  onClick={() => {
                                    const currentX = slide.mobileFocalPoint?.x ?? 50;
                                    updateHeroSlide(index, 'mobileFocalPoint', { 
                                      ...slide.mobileFocalPoint, 
                                      x: Math.min(100, currentX + 5),
                                      y: slide.mobileFocalPoint?.y ?? 50
                                    });
                                  }}
                                  title="Mover derecha"
                                >
                                  <ArrowRight size={16} />
                                </button>
                              </div>
                              
                              {/* Zoom Controls */}
                              <div className="store__heroMobileFocusZoom">
                                <button
                                  type="button"
                                  className="store__heroMobileFocusZoomBtn"
                                  onClick={() => {
                                    const currentZoom = slide.mobileFocalPoint?.zoom ?? 100;
                                    updateHeroSlide(index, 'mobileFocalPoint', { 
                                      ...slide.mobileFocalPoint,
                                      x: slide.mobileFocalPoint?.x ?? 50,
                                      y: slide.mobileFocalPoint?.y ?? 50,
                                      zoom: Math.max(50, currentZoom - 10)
                                    });
                                  }}
                                  title="Alejar"
                                >
                                  <Minus size={14} />
                                </button>
                                <input
                                  type="range"
                                  min="50"
                                  max="400"
                                  step="5"
                                  value={slide.mobileFocalPoint?.zoom ?? 100}
                                  onChange={(e) => {
                                    updateHeroSlide(index, 'mobileFocalPoint', { 
                                      ...slide.mobileFocalPoint,
                                      x: slide.mobileFocalPoint?.x ?? 50,
                                      y: slide.mobileFocalPoint?.y ?? 50,
                                      zoom: parseInt(e.target.value)
                                    });
                                  }}
                                  className="store__heroMobileFocusZoomSlider"
                                />
                                <button
                                  type="button"
                                  className="store__heroMobileFocusZoomBtn"
                                  onClick={() => {
                                    const currentZoom = slide.mobileFocalPoint?.zoom ?? 100;
                                    updateHeroSlide(index, 'mobileFocalPoint', { 
                                      ...slide.mobileFocalPoint,
                                      x: slide.mobileFocalPoint?.x ?? 50,
                                      y: slide.mobileFocalPoint?.y ?? 50,
                                      zoom: Math.min(400, currentZoom + 10)
                                    });
                                  }}
                                  title="Acercar"
                                >
                                  <Plus size={14} />
                                </button>
                                <span className="store__heroMobileFocusZoomValue">
                                  {slide.mobileFocalPoint?.zoom ?? 100}%
                                </span>
                                <button
                                  type="button"
                                  className="store__heroMobileFocusResetBtn"
                                  onClick={() => {
                                    updateHeroSlide(index, 'mobileFocalPoint', { x: 50, y: 50, zoom: 100 });
                                  }}
                                  title="Restablecer"
                                >
                                  <RotateCcw size={14} />
                                </button>
                              </div>
                              
                              {/* Preset Zoom Buttons */}
                              <div className="store__heroMobileFocusPresets">
                                {[50, 100, 150, 200, 300].map(preset => (
                                  <button
                                    key={preset}
                                    type="button"
                                    className={`store__heroMobileFocusPresetBtn ${(slide.mobileFocalPoint?.zoom ?? 100) === preset ? 'store__heroMobileFocusPresetBtn--active' : ''}`}
                                    onClick={() => {
                                      updateHeroSlide(index, 'mobileFocalPoint', { 
                                        ...slide.mobileFocalPoint,
                                        x: slide.mobileFocalPoint?.x ?? 50,
                                        y: slide.mobileFocalPoint?.y ?? 50,
                                        zoom: preset
                                      });
                                    }}
                                  >
                                    {preset}%
                                  </button>
                                ))}
                              </div>
                              
                              <span className="store__heroMobileFocusHint">
                                Pos: {slide.mobileFocalPoint?.x ?? 50}%, {slide.mobileFocalPoint?.y ?? 50}% | Zoom: {slide.mobileFocalPoint?.zoom ?? 100}%
                              </span>
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
                      const isSelected = cardLayout === layoutId
                      
                      return (
                        <button
                          key={layoutId}
                          type="button"
                          className={`store__layoutBtn ${isSelected ? 'selected' : ''}`}
                          onClick={() => updateCardTheme({ productCardLayout: layoutId })}
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
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Category Layout Selector */}
                <div className="store__cardSection">
                  <label className="store__cardSectionTitle">
                    <Folder size={14} /> Layout de Categorías
                  </label>
                  <div className="store__layoutGrid">
                    {Object.entries(CATEGORY_CARD_LAYOUTS).map(([layoutId, config]) => {
                      const isSelected = categoryLayout === layoutId
                      
                      return (
                        <button
                          key={layoutId}
                          type="button"
                          className={`store__layoutBtn ${isSelected ? 'selected' : ''}`}
                          onClick={() => updateCardTheme({ categoryCardLayout: layoutId })}
                          title={config.description}
                        >
                          <span className="store__layoutIcon">
                            {layoutId === 'grid' && <Grid3X3 size={18} />}
                            {layoutId === 'horizontal' && <Rows3 size={18} />}
                            {layoutId === 'circle' && <Circle size={18} />}
                            {layoutId === 'chips' && <LayoutList size={18} />}
                            {layoutId === 'overlay' && <Layers size={18} />}
                            {layoutId === 'magazine' && <Newspaper size={18} />}
                            {layoutId === 'minimal' && <Type size={18} />}
                            {layoutId === 'polaroid' && <Camera size={18} />}
                            {layoutId === 'banner' && <RectangleHorizontal size={18} />}
                          </span>
                          <span className="store__layoutName">{config.label}</span>
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
                        value={cardColors.cardBg || cardColorDefaults.cardBg}
                        onChange={(e) => updateCardTheme({ cardBg: e.target.value })}
                        className="store__colorInput"
                      />
                      <span>Fondo</span>
                    </div>
                    <div className="store__colorItem">
                      <input
                        type="color"
                        value={cardColors.cardText || cardColorDefaults.cardText}
                        onChange={(e) => updateCardTheme({ cardText: e.target.value })}
                        className="store__colorInput"
                      />
                      <span>Título</span>
                    </div>
                    <div className="store__colorItem">
                      <input
                        type="color"
                        value={cardColors.cardDesc || cardColorDefaults.cardDesc}
                        onChange={(e) => updateCardTheme({ cardDesc: e.target.value })}
                        className="store__colorInput"
                      />
                      <span>Descripción</span>
                    </div>
                    <div className="store__colorItem">
                      <input
                        type="color"
                        value={cardColors.cardPrice || cardColorDefaults.cardPrice}
                        onChange={(e) => updateCardTheme({ cardPrice: e.target.value })}
                        className="store__colorInput"
                      />
                      <span>Precio</span>
                    </div>
                    <div className="store__colorItem">
                      <input
                        type="color"
                        value={cardColors.cardButton || cardColorDefaults.cardButton}
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
                  isEditable={isAdmin && !heroPreviewMode}
                  onEdit={openEditProduct}
                  onDelete={handleDeleteProduct}
                  hasExtras={(() => {
                    // Verificar si hay extras aplicables a la categoría de este producto
                    const pCategoryId = categories.find(c => c.name === p.category)?.id
                    const hasApplicableExtras = extraGroups.some(group => {
                      const groupCategoryIds = group.categoryIds || []
                      return groupCategoryIds.length === 0 || groupCategoryIds.includes(pCategoryId)
                    })
                    return hasApplicableExtras || (p.productExtras?.length > 0)
                  })()}
                  hasProductExtras={p.productExtras?.length > 0}
                  isPremium={effectiveTier !== SUBSCRIPTION_TIERS.FREE}
                  disabled={isStoreClosed && !isAdmin}
                />
              )
            })}
            
            {/* Add product card for admin */}
            {isAdmin && !heroPreviewMode && (
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
            onAdd={incrementCartItem}
            onRemove={removeOne}
            onEdit={handleEditCartItem}
            storeStatus={storeStatus}
            onClear={() => {
              setPaid(false)
              setCart({})
              showClearToast()
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
          tenant={tenant}
          tenantFullData={tenantFullData}
          tenantSlug={slug}
          orderItemsPayload={orderItemsPayload}
          checkoutData={checkoutData}
          setCheckoutData={setCheckoutData}
          checkoutLoading={checkoutLoading}
          checkoutError={checkoutError}
          deliveryConfig={deliveryConfig}
          paymentMethodsConfig={paymentMethodsConfig}
          deliveryPricing={deliveryPricing}
          globalStockStatus={globalStockStatus}
          getCategoryStockInfo={getCategoryStockInfo}
          onBack={() => {
            setIsCheckingOut(false)
            setCheckoutError(null)
          }}
          onSuccess={(orderId) => {
            justPurchasedRef.current = true
            setPaid(true)
            setLastOrderId(orderId)
            setLastDeliveryType(checkoutData.deliveryType)
            setCart({})
            setCheckoutData({ customerName: '', customerPhone: '', deliveryType: 'mostrador', deliveryAddress: '', deliveryNotes: '', deliveryLat: null, deliveryLng: null, paymentMethod: 'efectivo' })
            setIsCheckingOut(false)
            setShowSuccessModal(true)
          }}
          dispatch={dispatch}
          setCheckoutLoading={setCheckoutLoading}
          setCheckoutError={setCheckoutError}
        />
      )}

      {/* Product Modal - Modal completo para crear/editar productos */}
      <ProductModal
        isOpen={showProductModal}
        onClose={() => {
          setShowProductModal(false)
          setEditingProduct(null)
        }}
        tenantId={tenantId}
        product={editingProduct}
        defaultCategoryId={selectedCategory || null}
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
        
        // Filtrar grupos de extras según la categoría del producto
        // Un grupo aplica si: categoryIds está vacío/null (aplica a todas) O contiene el categoryId del producto
        const productCategoryId = categories.find(c => c.name === selectedProductForDetail.category)?.id
        const filteredExtraGroups = extraGroups.filter(group => {
          const groupCategoryIds = group.categoryIds || []
          return groupCategoryIds.length === 0 || groupCategoryIds.includes(productCategoryId)
        })
        
        return (
          <ProductDetailModal
            product={selectedProductForDetail}
            groups={filteredExtraGroups}
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
                <X size={18} />
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
        orderLimitsStatus={orderLimitsStatus}
      />

      {/* Floating Cart for Mobile */}
      {!isCheckingOut && !heroPreviewMode && (
        <FloatingCart
          items={cartItems}
          total={cartTotal}
          onAdd={incrementCartItem}
          onRemove={removeOne}
          onClear={() => {
            setPaid(false)
            setCart({})
            showClearToast()
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
        deliveryType={lastDeliveryType}
        storeLocation={{
          lat: storeFooterData?.location_lat || tenantFullData?.location_lat,
          lng: storeFooterData?.location_lng || tenantFullData?.location_lng,
          address: storeFooterData?.location_address || storeFooterData?.address || tenantFullData?.address,
        }}
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

      {/* Cart Toast Notifications */}
      <CartToast toast={cartToast} onDismiss={dismissCartToast} />

      {/* Category Modal for creating/editing categories in store */}
      <CategoryModal
        isOpen={showCategoryModal}
        onClose={() => {
          setShowCategoryModal(false)
          setEditingCategory(null)
          setCategoryModalParentId(null)
        }}
        tenantId={tenantId}
        category={editingCategory}
        parentId={categoryModalParentId}
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
                ¡Pero puedes ver otros de nuestros productos! <ShoppingCart size={16} />
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

      {/* Store Footer - Show in normal view and preview mode */}
      {!isCheckingOut && (
        <StoreFooter 
          footerData={storeFooterData}
          tenantData={tenantFullData || tenant}
          themeData={theme}
          storeSlug={slug}
        />
      )}
    </div>
  )
}

// Modal de checkout con datos del cliente
function CheckoutPage({ 
  cartItems, 
  cartTotal, 
  tenantId,
  tenant,
  tenantFullData,
  tenantSlug,
  orderItemsPayload, 
  checkoutData, 
  setCheckoutData,
  checkoutLoading,
  checkoutError,
  deliveryConfig,
  paymentMethodsConfig,
  deliveryPricing,
  globalStockStatus,
  getCategoryStockInfo,
  onBack,
  onSuccess,
  dispatch,
  setCheckoutLoading,
  setCheckoutError,
}) {
  const [mpConfigured, setMpConfigured] = useState(false)
  const [mpLoading, setMpLoading] = useState(true)
  const [gettingLocation, setGettingLocation] = useState(false)
  const [locationError, setLocationError] = useState(null)

  // Verificar si el tenant tiene MercadoPago configurado
  useEffect(() => {
    const checkMPConfig = async () => {
      try {
        const { checkTenantMPConfiguredPublic } = await import('../../lib/supabaseMercadopagoApi')
        const isConfigured = await checkTenantMPConfiguredPublic(tenantId)
        setMpConfigured(isConfigured)
      } catch (e) {
        console.warn('Error checking MP config:', e)
        setMpConfigured(false)
      } finally {
        setMpLoading(false)
      }
    }
    checkMPConfig()
  }, [tenantId])

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
  
  // Obtener ubicación GPS del cliente
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Tu navegador no soporta geolocalización')
      return
    }
    
    setGettingLocation(true)
    setLocationError(null)
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords
        console.log(`📍 GPS obtenido: ${latitude}, ${longitude} (precisión: ${Math.round(accuracy)}m)`)
        
        setCheckoutData(prev => ({
          ...prev,
          deliveryLat: latitude,
          deliveryLng: longitude,
        }))
        setGettingLocation(false)
        
        // Siempre actualizar la dirección con reverse geocoding
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1&zoom=18`)
          .then(res => res.json())
          .then(data => {
            if (data?.display_name) {
              setCheckoutData(prev => ({
                ...prev,
                deliveryAddress: data.display_name,
              }))
            }
          })
          .catch(() => {})
      },
      (error) => {
        setGettingLocation(false)
        switch(error.code) {
          case error.PERMISSION_DENIED:
            setLocationError('Permiso de ubicación denegado. Activalo en la configuración del navegador.')
            break
          case error.POSITION_UNAVAILABLE:
            setLocationError('No se pudo obtener la ubicación.')
            break
          case error.TIMEOUT:
            setLocationError('Tiempo de espera agotado. Intentá de nuevo.')
            break
          default:
            setLocationError('Error al obtener ubicación.')
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    )
  }
  
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
      // Si es pago con MercadoPago, usar Edge Function que crea la orden Y la preferencia
      // El dinero va DIRECTO al admin/tenant usando SU access_token
      // La orden se crea en el backend para mayor seguridad (recalcula total)
      if (checkoutData.paymentMethod === 'qr' && mpConfigured) {
        try {
          const { createCustomerPaymentPreference } = await import('../../lib/customerPaymentsApi')
          
          // Preparar items para la Edge Function
          const mpItems = cartItems.map(item => ({
            productId: item.productId || item.product?.id,
            name: item.product?.name || item.name,
            unitPrice: item.product?.price || item.price || item.unitPrice,
            qty: item.quantity || item.qty || 1,
            lineTotal: item.totalPrice || item.lineTotal || 
              ((item.product?.price || item.price || item.unitPrice) * (item.quantity || item.qty || 1)),
            extras: item.extras || [],
            comment: item.comment || null,
          }))

          // Crear preferencia via Edge Function (seguro - recalcula total en backend)
          // También crea la orden en la DB
          const preferenceData = await createCustomerPaymentPreference({
            tenantId,
            items: mpItems,
            customer: {
              name: checkoutData.customerName,
              phone: checkoutData.customerPhone,
            },
            deliveryType: checkoutData.deliveryType,
            deliveryAddress: checkoutData.deliveryType === 'domicilio' ? checkoutData.deliveryAddress : null,
            deliveryNotes: checkoutData.deliveryNotes,
            deliveryLat: checkoutData.deliveryLat || null,
            deliveryLng: checkoutData.deliveryLng || null,
            deliveryCost: deliveryCost || 0,
          })

          // Guardar datos en localStorage para recuperar después del pago
          localStorage.setItem('mp_pending_order', JSON.stringify({
            orderId: preferenceData.orderId,
            tenantId,
            tenantSlug,
            preferenceId: preferenceData.preferenceId,
            idempotencyKey: preferenceData.idempotencyKey,
            total: preferenceData.total,
            timestamp: Date.now(),
          }))

          // Redirigir a MercadoPago Checkout Pro
          window.location.href = preferenceData.initPoint
          return // El webhook confirmará el pago
        } catch (mpError) {
          console.error('Error creando pago MP:', mpError)
          setCheckoutError(`Error al procesar pago: ${mpError.message}`)
          setCheckoutLoading(false)
          return
        }
      }

      // Para otros métodos de pago (efectivo, tarjeta en local), crear orden normalmente
      const res = await dispatch(
        createPaidOrder({
          tenantId,
          items: orderItemsPayload,
          total: Math.round(finalTotal * 100) / 100,
          customer: {
            name: checkoutData.customerName,
            phone: checkoutData.customerPhone,
          },
          deliveryType: checkoutData.deliveryType,
          deliveryAddress: checkoutData.deliveryType === 'domicilio' ? checkoutData.deliveryAddress : null,
          deliveryNotes: checkoutData.deliveryNotes,
          deliveryLat: checkoutData.deliveryLat || null,
          deliveryLng: checkoutData.deliveryLng || null,
          paymentMethod: checkoutData.paymentMethod,
          status: 'pending',
        }),
      ).unwrap()

      const orderId = res?.order?.id || res?.id

      // Para otros métodos de pago, completar normalmente
      onSuccess(orderId)
    } catch (e) {
      setCheckoutError(e?.message || 'Error al procesar el pedido')
    } finally {
      setCheckoutLoading(false)
    }
  }

  // Format price helper
  const formatPrice = (price) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  }

  // Generar label de costo de envío para el botón de delivery
  const deliveryCostLabel = useMemo(() => {
    if (!deliveryPricing || deliveryPricing.type === 'free') return 'Envío gratis'
    if (deliveryPricing.type === 'fixed') return `Envío ${formatPrice(deliveryPricing.fixedPrice || 0)}`
    if (deliveryPricing.type === 'threshold') {
      if (cartTotal >= (deliveryPricing.freeThreshold || 0)) {
        return '¡Envío gratis!'
      }
      const remaining = (deliveryPricing.freeThreshold || 0) - cartTotal
      return `Envío ${formatPrice(deliveryPricing.fixedPrice || 0)} · Gratis desde ${formatPrice(deliveryPricing.freeThreshold || 0)}`
    }
    return null
  }, [deliveryPricing, cartTotal])

  const deliveryTypes = [
    { key: 'mostrador', label: 'Retiro en Local', icon: <UtensilsCrossed size={20} />, desc: 'Paso a buscar mi pedido' },
    { key: 'domicilio', label: 'Delivery', icon: <Truck size={20} />, desc: 'Enviar a mi dirección', costLabel: deliveryCostLabel },
    { key: 'mesa', label: 'Comer Aquí', icon: <Armchair size={20} />, desc: 'Para consumir en el lugar' },
  ]

  // Filtrar métodos de pago - respetar config del dueño + solo mostrar MP si está configurado
  const paymentMethods = useMemo(() => {
    const allMethods = [
      { key: 'efectivo', label: 'Efectivo', icon: <Banknote size={20} /> },
      { key: 'tarjeta', label: 'Tarjeta (en local)', icon: <CreditCard size={20} /> },
    ]
    
    // Solo agregar MercadoPago si está configurado
    if (mpConfigured && !mpLoading) {
      allMethods.push({ key: 'qr', label: 'Mercado Pago', icon: <Smartphone size={20} />, highlight: true })
    }
    
    // Filtrar según la configuración del dueño de la tienda
    const filtered = allMethods.filter(m => {
      if (!paymentMethodsConfig) return true
      return paymentMethodsConfig[m.key] !== false
    })
    
    return filtered
  }, [mpConfigured, mpLoading, paymentMethodsConfig])
  
  // Si el método de pago actual no está habilitado, seleccionar el primero disponible
  useEffect(() => {
    if (paymentMethods.length > 0 && !paymentMethods.find(m => m.key === checkoutData.paymentMethod)) {
      setCheckoutData(prev => ({ ...prev, paymentMethod: paymentMethods[0].key }))
    }
  }, [paymentMethods, checkoutData.paymentMethod, setCheckoutData])

  // Calcular costo de delivery
  const deliveryCost = useMemo(() => {
    if (checkoutData.deliveryType !== 'domicilio') return 0
    if (!deliveryPricing) return 0
    
    switch (deliveryPricing.type) {
      case 'free':
        return 0
      case 'fixed':
        return deliveryPricing.fixedPrice || 0
      case 'threshold':
        // Envío gratis si el total supera el umbral
        if (cartTotal >= (deliveryPricing.freeThreshold || 0)) return 0
        return deliveryPricing.fixedPrice || 0
      default:
        return 0
    }
  }, [checkoutData.deliveryType, deliveryPricing, cartTotal])

  // Total final incluyendo delivery
  const finalTotal = cartTotal + deliveryCost

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
          <span className="checkoutPage__titleIcon"><ShoppingCart size={24} /></span>
          Finalizar Pedido
        </h2>
      </div>

      <div className="checkoutPage__content">
        {/* Resumen del pedido - Colapsable en móvil */}
        <details className="checkoutPage__orderSummary" open>
          <summary className="checkoutPage__orderSummaryHeader">
            <span className="checkoutPage__orderSummaryTitle">
              <ClipboardList size={18} /> Tu Pedido ({cartItems?.length || 0} items)
            </span>
            <span className="checkoutPage__orderSummaryTotal">{formatPrice(finalTotal)}</span>
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
            
            {/* Subtotal + Envío */}
            {deliveryCost > 0 && (
              <div className="checkoutPage__deliveryCostRow">
                <span className="checkoutPage__deliveryCostLabel">
                  <Truck size={14} /> Costo de envío
                </span>
                <span className="checkoutPage__deliveryCostPrice">{formatPrice(deliveryCost)}</span>
              </div>
            )}
            {deliveryCost === 0 && checkoutData.deliveryType === 'domicilio' && (
              <div className="checkoutPage__deliveryCostRow checkoutPage__deliveryCostRow--free">
                <span className="checkoutPage__deliveryCostLabel">
                  <Truck size={14} /> Envío
                </span>
                <span className="checkoutPage__deliveryCostPrice checkoutPage__deliveryCostPrice--free">¡GRATIS!</span>
              </div>
            )}
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
                    <span className="checkoutPage__labelIcon"><User size={16} /></span>
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
                    <span className="checkoutPage__labelIcon"><Phone size={16} /></span>
                    Teléfono / WhatsApp
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={checkoutData.customerPhone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '')
                      setCheckoutData({ ...checkoutData, customerPhone: val })
                    }}
                    placeholder="Solo números, ej: 1155667788"
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
                      <span className="checkoutPage__deliveryLabel">
                        {type.label}
                        {type.costLabel && isEnabled && (
                          <span className={`checkoutPage__deliveryCostBadge ${deliveryCost === 0 && checkoutData.deliveryType === 'domicilio' && isSelected ? 'checkoutPage__deliveryCostBadge--free' : ''}`}>
                            {type.costLabel}
                          </span>
                        )}
                      </span>
                      <span className="checkoutPage__deliveryDesc">{type.desc}</span>
                      {isSelected && <span className="checkoutPage__deliveryCheck"><CheckCircle size={16} /></span>}
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
                      <span className="checkoutPage__labelIcon"><MapPin size={16} /></span>
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
                  
                  {/* Botón GPS */}
                  <button
                    type="button"
                    className={`checkoutPage__gpsBtn ${checkoutData.deliveryLat ? 'checkoutPage__gpsBtn--active' : ''}`}
                    onClick={handleGetLocation}
                    disabled={checkoutLoading || gettingLocation}
                  >
                    {gettingLocation ? (
                      <>
                        <span className="checkoutPage__spinner" style={{ width: 16, height: 16 }}></span>
                        Obteniendo ubicación...
                      </>
                    ) : checkoutData.deliveryLat ? (
                      <>
                        <CheckCircle size={16} />
                        Ubicación GPS compartida ✓
                      </>
                    ) : (
                      <>
                        <MapPin size={16} />
                        📍 Compartir mi ubicación GPS
                      </>
                    )}
                  </button>
                  {locationError && (
                    <p className="checkoutPage__locationError">{locationError}</p>
                  )}
                  {checkoutData.deliveryLat && (
                    <div className="checkoutPage__mapContainer">
                      <Suspense fallback={<div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', borderRadius: 12 }}>Cargando mapa...</div>}>
                        <LocationMapPicker
                          lat={checkoutData.deliveryLat}
                          lng={checkoutData.deliveryLng}
                          onPositionChange={(lat, lng) => {
                            setCheckoutData(prev => ({
                              ...prev,
                              deliveryLat: lat,
                              deliveryLng: lng,
                            }))
                            // Reverse geocode the new position
                            fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=18`)
                              .then(res => res.json())
                              .then(data => {
                                if (data?.display_name) {
                                  setCheckoutData(prev => ({
                                    ...prev,
                                    deliveryAddress: data.display_name,
                                  }))
                                }
                              })
                              .catch(() => {})
                          }}
                        />
                      </Suspense>
                      <p className="checkoutPage__mapHint">📍 Arrastrá el pin o tocá el mapa para ajustar tu ubicación</p>
                      <a
                        href={`https://www.google.com/maps?q=${checkoutData.deliveryLat},${checkoutData.deliveryLng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="checkoutPage__mapsLink"
                      >
                        🗺️ Ver en Google Maps
                      </a>
                    </div>
                  )}
                  
                  <div className="checkoutPage__field">
                    <label className="checkoutPage__label">
                      <span className="checkoutPage__labelIcon"><FileText size={16} /></span>
                      Referencias e indicaciones (opcional)
                    </label>
                    <textarea
                      value={checkoutData.deliveryNotes}
                      onChange={(e) => setCheckoutData({ ...checkoutData, deliveryNotes: e.target.value })}
                      placeholder="Ej: Casa azul con portón negro, timbre no funciona, llamar al llegar"
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
                      {isSelected && <span className="checkoutPage__paymentCheck"><CheckCircle size={16} /></span>}
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
            <span className="checkoutPage__errorIcon"><AlertTriangle size={18} /></span>
            <span>{checkoutError}</span>
          </div>
        )}

        {!stockValidation.isValid && (
          <div className="checkoutPage__stockError">
            <span className="checkoutPage__stockErrorIcon"><Package size={18} /></span>
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
            <strong>{formatPrice(finalTotal)}</strong>
          </div>
          {deliveryCost > 0 && (
            <div className="checkoutPage__footerDelivery">
              <span>Incluye envío: {formatPrice(deliveryCost)}</span>
            </div>
          )}
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

