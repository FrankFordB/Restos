import { useEffect, useMemo, useRef, useState } from 'react'
import './ProductsManager.css'
import Card from '../../ui/Card/Card'
import Input from '../../ui/Input/Input'
import Button from '../../ui/Button/Button'
import InfoTooltip from '../../ui/InfoTooltip/InfoTooltip'
import PageTutorialButton from '../PageTutorialButton/PageTutorialButton'
import TutorialSection from '../TutorialSection/TutorialSection'
import ProductCard from '../../storefront/ProductCard/ProductCard'
import CategoryManager from '../CategoryManager/CategoryManager'
import { useAppDispatch, useAppSelector } from '../../../app/hooks'
import { selectUser } from '../../../features/auth/authSlice'
import { isSupabaseConfigured } from '../../../lib/supabaseClient'
import { uploadProductImage } from '../../../lib/supabaseStorage'
import { fetchTutorialVideo, upsertTutorialVideo } from '../../../lib/supabaseApi'
import {
  createProduct,
  deleteProduct,
  fetchProductsForTenant,
  patchProduct,
  selectProductsForTenant,
} from '../../../features/products/productsSlice'
import {
  createCategory,
  patchCategory,
  deleteCategory,
  fetchCategoriesForTenant,
  selectCategoriesForTenant,
  selectCategoryTree,
  selectCategoryDescendants,
} from '../../../features/categories/categoriesSlice'
import { Package, AlertTriangle, List, Grid3X3, Move, ZoomIn, ZoomOut, Plus, Link2, Upload, X, ChevronRight, ChevronDown, FolderOpen, Home, Edit2, Trash2, Save, FolderPlus, Settings, Image, Tag, Layers, LayoutGrid, FolderTree } from 'lucide-react'

// Constantes de zoom
const ZOOM_MIN = 0.5
const ZOOM_MAX = 3
const ZOOM_STEP = 0.25

// Función para extraer el color dominante de una imagen
function extractDominantColor(imgSrc) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'Anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      // Usar tamaño pequeño para mejor rendimiento
      canvas.width = 50
      canvas.height = 50
      ctx.drawImage(img, 0, 0, 50, 50)
      
      try {
        const imageData = ctx.getImageData(0, 0, 50, 50).data
        let r = 0, g = 0, b = 0, count = 0
        
        // Muestrear bordes de la imagen (donde se verá el fondo)
        for (let i = 0; i < imageData.length; i += 4) {
          r += imageData[i]
          g += imageData[i + 1]
          b += imageData[i + 2]
          count++
        }
        
        r = Math.round(r / count)
        g = Math.round(g / count)
        b = Math.round(b / count)
        
        resolve(`rgb(${r}, ${g}, ${b})`)
      } catch {
        resolve('#f3f4f6') // Color fallback
      }
    }
    img.onerror = () => resolve('#f3f4f6')
    img.src = imgSrc
  })
}

// Componente recursivo para renderizar el árbol de categorías
function CategoryTreeItem({
  category,
  level,
  selectedCategoryFilter,
  expandedCategories,
  toggleCategoryExpand,
  navigateToCategory,
  getProductCountForCategory,
  showCategoryManager,
  onEdit,
  onDelete,
  onAddSubcategory,
}) {
  const hasChildren = category.children && category.children.length > 0
  const isExpanded = expandedCategories.has(category.id)
  const isActive = selectedCategoryFilter === category.name
  const productCount = getProductCountForCategory(category.id)

  return (
    <li className="products__treeItem">
      <div className="products__treeItemRow">
        <button
          className={`products__sidebarItem ${isActive ? 'products__sidebarItem--active' : ''}`}
          onClick={() => navigateToCategory(category)}
          style={{ paddingLeft: `${12 + level * 16}px` }}
        >
          {hasChildren && (
            <span
              className="products__expandToggle"
              onClick={(e) => toggleCategoryExpand(category.id, e)}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          )}
          {!hasChildren && <span className="products__expandPlaceholder" />}
          <span className="products__sidebarItemName">{category.name}</span>
          <span className="products__sidebarCount">{productCount}</span>
        </button>
        {showCategoryManager && (
          <div className="products__treeItemActions">
            <button
              className="products__treeActionBtn products__treeActionBtn--add"
              onClick={(e) => { e.stopPropagation(); onAddSubcategory(category.id); }}
              title="Agregar subcategoría"
            >
              <FolderPlus size={12} />
            </button>
            <button
              className="products__treeActionBtn products__treeActionBtn--edit"
              onClick={(e) => onEdit(category, e)}
              title="Editar"
            >
              <Edit2 size={12} />
            </button>
            <button
              className="products__treeActionBtn products__treeActionBtn--delete"
              onClick={(e) => onDelete(category, e)}
              title="Eliminar"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>
      {hasChildren && isExpanded && (
        <ul className="products__treeChildren">
          {category.children.map((child) => (
            <CategoryTreeItem
              key={child.id}
              category={child}
              level={level + 1}
              selectedCategoryFilter={selectedCategoryFilter}
              expandedCategories={expandedCategories}
              toggleCategoryExpand={toggleCategoryExpand}
              navigateToCategory={navigateToCategory}
              getProductCountForCategory={getProductCountForCategory}
              showCategoryManager={showCategoryManager}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddSubcategory={onAddSubcategory}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export default function ProductsManager({ tenantId }) {
  const dispatch = useAppDispatch()
  const user = useAppSelector(selectUser)
  const products = useAppSelector(selectProductsForTenant(tenantId))
  const categories = useAppSelector(selectCategoriesForTenant(tenantId))
  const categoryTree = useAppSelector(selectCategoryTree(tenantId))

  const createFileInputRef = useRef(null)
  
  // Tutorial video state
  const [tutorialVideo, setTutorialVideo] = useState({ url: '', type: 'youtube' })

  useEffect(() => {
    dispatch(fetchProductsForTenant(tenantId))
    dispatch(fetchCategoriesForTenant(tenantId))
  }, [dispatch, tenantId])
  
  // Load tutorial video
  useEffect(() => {
    async function loadTutorial() {
      try {
        const tutorial = await fetchTutorialVideo('products')
        if (tutorial) {
          setTutorialVideo({ url: tutorial.video_url || '', type: tutorial.video_type || 'youtube' })
        }
      } catch (e) {
        console.warn('Error loading tutorial:', e)
      }
    }
    loadTutorial()
  }, [])

  // Save tutorial video
  const handleSaveTutorial = async (sectionId, videoUrl, videoType) => {
    try {
      await upsertTutorialVideo({ sectionId, videoUrl, videoType })
      setTutorialVideo({ url: videoUrl, type: videoType })
    } catch (e) {
      console.error('Error saving tutorial:', e)
      throw e
    }
  }

  // Estado para filtrar por categoría - null = "Todas"
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState(null)
  // Estado para navegación jerárquica - categoryId de la categoría actual
  const [currentCategoryId, setCurrentCategoryId] = useState(null)
  // Estado para categorías expandidas en el árbol
  const [expandedCategories, setExpandedCategories] = useState(new Set())
  
  // Tab interno: 'products' | 'categories'
  const [internalTab, setInternalTab] = useState('products')
  
  // Estados para panel de gestión de categorías
  const [showCategoryManager, setShowCategoryManager] = useState(false)
  const [editingCategoryId, setEditingCategoryId] = useState(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [editingCategoryParent, setEditingCategoryParent] = useState(null)
  const [newSubcategoryName, setNewSubcategoryName] = useState('')
  const [addingSubcategoryTo, setAddingSubcategoryTo] = useState(null) // ID de la categoría padre

  // selección mÃºltiple de productos
  const [selectedProductIds, setSelectedProductIds] = useState(new Set())
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false)

  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [subcategory, setSubcategory] = useState('') // Subcategoría seleccionada (ID)
  const [costPrice, setCostPrice] = useState('') // Precio de costo
  const [stock, setStock] = useState('')
  const [stockUnlimited, setStockUnlimited] = useState(true)
  const [imageFile, setImageFile] = useState(null)
  const [photoStatus, setPhotoStatus] = useState(null)
  
  // Estados para crear nueva categoría
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [savingCategory, setSavingCategory] = useState(false)
  
  // Estados para imagen por URL
  const [imageMode, setImageMode] = useState('file') // 'file' | 'url'
  const [imageUrl, setImageUrl] = useState('')

  // Estados para modal de edición
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [editName, setEditName] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editSubcategory, setEditSubcategory] = useState('') // ID de subcategoría
  const [editCostPrice, setEditCostPrice] = useState('') // Precio de costo
  const [editStock, setEditStock] = useState('')
  const [editStockUnlimited, setEditStockUnlimited] = useState(true)
  const [editIsActive, setEditIsActive] = useState(true)
  const [editImageFile, setEditImageFile] = useState(null)
  const [editSaving, setEditSaving] = useState(false)
  const editFileInputRef = useRef(null)

  function parsePrice(raw) {
    const s = String(raw ?? '').trim()
    if (!s) return null

    // Permite 9.99 o 9,99 y elimina sÃ­mbolos/espacios.
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

    // Supabase schema usa numeric(10,2) => mÃ¡ximo ~ 99,999,999.99
    const rounded = Math.round(num * 100) / 100
    const MAX_PRICE = 99_999_999.99
    if (rounded > MAX_PRICE) return null
    return rounded
  }

  // Estado para mostrar input de URL por producto
  const [showUrlInputFor, setShowUrlInputFor] = useState(null)
  const [productUrlInput, setProductUrlInput] = useState('')

  // Estado para el modal de punto focal
  const [focalState, setFocalState] = useState({
    open: false,
    mode: null, // 'create' | 'edit' | 'url'
    productId: null,
    productName: null,
    file: null,
    src: null,
    focalPoint: { x: 50, y: 50, zoom: 1 }, // x, y en porcentaje, zoom factor
  })
  
  const focalAreaRef = useRef(null)
  const isDraggingRef = useRef(false)

  function formatPhotoError(err) {
    const msg = err?.message ? String(err.message) : 'Error subiendo foto'

    // Mensajes tÃ­picos cuando Storage RLS/policies no estÃ¡n aplicadas
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
        ' â€” Parece un bloqueo de RLS/Policies en Supabase Storage. Ejecuta la secciÃ³n STORAGE de supabase/rls.sql como postgres/supabase_admin, o crea policies en Dashboard para el bucket product-images.'
      )
    }

    if (lower.includes('jwt') || lower.includes('not authorized') || lower.includes('unauthorized')) {
      return msg + ' â€” Verifica que estÃ©s logueado y que VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY sean correctas.'
    }

    return msg
  }

  async function fileToDataUrl(file) {
    if (!file) return null
    // Guardrail para no inflar localStorage en modo MOCK
    const maxBytes = 1_500_000 // ~1.5MB
    if (file.size > maxBytes) {
      throw new Error('La imagen es muy pesada para modo MOCK. Usa una mÃ¡s liviana o configura Supabase Storage.')
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

  function openFocalPointEditor({ file, mode, productId = null, productName = null, existingFocalPoint = null }) {
    if (!file && mode !== 'url') return
    const src = file ? URL.createObjectURL(file) : null
    setFocalState({
      open: true,
      mode,
      productId,
      productName,
      file,
      src,
      focalPoint: existingFocalPoint || { x: 50, y: 50, zoom: 1 },
    })
  }

  // Abrir editor de punto focal desde URL
  function openFocalPointFromUrl({ url, productId, productName, existingFocalPoint = null }) {
    if (!url) return
    setFocalState({
      open: true,
      mode: 'url',
      productId,
      productName,
      file: null,
      src: url,
      focalPoint: existingFocalPoint || { x: 50, y: 50, zoom: 1 },
    })
    setShowUrlInputFor(null)
    setProductUrlInput('')
  }

  function closeFocalPointEditor() {
    setFocalState((prev) => {
      if (prev?.src && prev?.file) URL.revokeObjectURL(prev.src)
      return {
        open: false,
        mode: null,
        productId: null,
        productName: null,
        file: null,
        src: null,
        focalPoint: { x: 50, y: 50, zoom: 1 },
      }
    })
  }

  // Handlers de zoom
  function handleZoomIn() {
    setFocalState((s) => ({
      ...s,
      focalPoint: { ...s.focalPoint, zoom: Math.min(ZOOM_MAX, (s.focalPoint.zoom || 1) + ZOOM_STEP) },
    }))
  }

  function handleZoomOut() {
    setFocalState((s) => ({
      ...s,
      focalPoint: { ...s.focalPoint, zoom: Math.max(ZOOM_MIN, (s.focalPoint.zoom || 1) - ZOOM_STEP) },
    }))
  }

  // Handler para arrastrar el punto focal
  function handleFocalMouseDown(e) {
    e.preventDefault()
    isDraggingRef.current = true
    updateFocalFromMouse(e)
  }

  function handleFocalMouseMove(e) {
    if (!isDraggingRef.current) return
    updateFocalFromMouse(e)
  }

  function handleFocalMouseUp() {
    isDraggingRef.current = false
  }

  function updateFocalFromMouse(e) {
    const area = focalAreaRef.current
    if (!area) return
    const rect = area.getBoundingClientRect()
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))
    setFocalState((s) => ({ ...s, focalPoint: { ...s.focalPoint, x: Math.round(x), y: Math.round(y) } }))
  }

  // Extraer color dominante cuando se abre el editor
  useEffect(() => {
    if (focalState.open && focalState.src && !focalState.focalPoint.bgColor) {
      extractDominantColor(focalState.src).then((color) => {
        setFocalState((s) => ({
          ...s,
          focalPoint: { ...s.focalPoint, bgColor: color },
        }))
      })
    }
  }, [focalState.open, focalState.src])

  useEffect(() => {
    if (!focalState.open) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeFocalPointEditor()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [focalState.open])

  // =====================
  // FUNCIONES DE SELECCIÃ“N MÃšLTIPLE
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
    if (!confirm(`Â¿Eliminar ${selectedProductIds.size} producto(s)? Esta acciÃ³n no se puede deshacer.`)) return
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

  // =====================
  // PRODUCTOS AGRUPADOS POR CATEGORÍA (con stock global)
  // =====================
  const productsByCategory = useMemo(() => {
    const grouped = {}
    for (const product of products) {
      const cat = product.category?.trim() || 'Sin categoría'
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(product)
    }
    // Ordenar categorías alfabéticamente, "Sin categoría" al final
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      if (a === 'Sin categoría') return 1
      if (b === 'Sin categoría') return -1
      return a.localeCompare(b)
    })
    return sortedKeys.map((cat) => {
      // Buscar info de stock de la categoría
      const categoryData = categories.find(c => c.name === cat)
      return { 
        category: cat, 
        products: grouped[cat],
        categoryId: categoryData?.id || null,
        maxStock: categoryData?.maxStock ?? null,
        currentStock: categoryData?.currentStock ?? null,
      }
    })
  }, [products, categories])

  // Filtrar categorías según la selección
  const filteredProductsByCategory = useMemo(() => {
    if (selectedCategoryFilter === null) {
      return productsByCategory // Mostrar todas
    }
    return productsByCategory.filter(c => c.category === selectedCategoryFilter)
  }, [productsByCategory, selectedCategoryFilter])

  // Lista de categorías para el sidebar
  const categoryList = useMemo(() => {
    return productsByCategory.map(c => ({
      name: c.category,
      count: c.products.length,
      maxStock: c.maxStock,
      currentStock: c.currentStock,
    }))
  }, [productsByCategory])

  // Breadcrumb: ruta desde raíz hasta la categoría actual
  const currentBreadcrumb = useMemo(() => {
    if (!currentCategoryId) return []
    const breadcrumb = []
    let current = categories.find(c => c.id === currentCategoryId)
    while (current) {
      breadcrumb.unshift(current)
      current = current.parentId
        ? categories.find(c => c.id === current.parentId)
        : null
    }
    return breadcrumb
  }, [categories, currentCategoryId])

  // Obtener subcategorías de la categoría actual
  const currentSubcategories = useMemo(() => {
    return categories.filter(c => c.parentId === currentCategoryId)
  }, [categories, currentCategoryId])

  // Obtener todos los descendientes de una categoría
  const getCategoryDescendantIds = (categoryId) => {
    const descendants = []
    const findDescendants = (parentId) => {
      categories
        .filter(c => c.parentId === parentId)
        .forEach(child => {
          descendants.push(child.id)
          findDescendants(child.id)
        })
    }
    findDescendants(categoryId)
    return descendants
  }

  // Contar productos de una categoría incluyendo subcategorías
  const getProductCountForCategory = (categoryId) => {
    const category = categories.find(c => c.id === categoryId)
    if (!category) return 0
    const descendantIds = getCategoryDescendantIds(categoryId)
    const allCategoryIds = [categoryId, ...descendantIds]
    const categoryNames = allCategoryIds
      .map(id => categories.find(c => c.id === id)?.name)
      .filter(Boolean)
    return products.filter(p => categoryNames.includes(p.category)).length
  }

  // Toggle expandir/colapsar categoría
  const toggleCategoryExpand = (categoryId, e) => {
    e.stopPropagation()
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  // Navegar a una categoría
  const navigateToCategory = (category) => {
    if (category) {
      setCurrentCategoryId(category.id)
      setSelectedCategoryFilter(category.name)
      // Auto-expandir categorías padre
      let current = category
      const toExpand = new Set(expandedCategories)
      while (current.parentId) {
        toExpand.add(current.parentId)
        current = categories.find(c => c.id === current.parentId)
        if (!current) break
      }
      setExpandedCategories(toExpand)
    } else {
      setCurrentCategoryId(null)
      setSelectedCategoryFilter(null)
    }
  }

  // =====================
  // FUNCIONES DE GESTIÓN DE CATEGORÍAS
  // =====================
  
  // Iniciar edición de una categoría
  const startEditCategory = (cat, e) => {
    e?.stopPropagation()
    setEditingCategoryId(cat.id)
    setEditingCategoryName(cat.name)
    setEditingCategoryParent(cat.parentId)
  }
  
  // Guardar cambios de una categoría
  const handleSaveCategory = async () => {
    if (!editingCategoryId || !editingCategoryName.trim()) return
    
    try {
      const patch = { name: editingCategoryName.trim() }
      // Si cambió el padre, incluirlo
      const originalCat = categories.find(c => c.id === editingCategoryId)
      if (originalCat && editingCategoryParent !== originalCat.parentId) {
        patch.parentId = editingCategoryParent
      }
      
      await dispatch(patchCategory({ tenantId, categoryId: editingCategoryId, patch })).unwrap()
      setEditingCategoryId(null)
      setEditingCategoryName('')
      setEditingCategoryParent(null)
    } catch (err) {
      console.error('Error al guardar categoría:', err)
      alert('Error al guardar: ' + (err.message || err))
    }
  }
  
  // Cancelar edición
  const cancelEditCategory = () => {
    setEditingCategoryId(null)
    setEditingCategoryName('')
    setEditingCategoryParent(null)
  }
  
  // Eliminar categoría
  const handleDeleteCategory = async (cat, e) => {
    e?.stopPropagation()
    
    // Verificar si tiene subcategorías
    const hasChildren = categories.some(c => c.parentId === cat.id)
    if (hasChildren) {
      alert('No puedes eliminar una categoría que tiene subcategorías. Elimina primero las subcategorías.')
      return
    }
    
    // Verificar si tiene productos
    const hasProducts = products.some(p => p.category === cat.name)
    if (hasProducts) {
      alert('No puedes eliminar una categoría que tiene productos. Mueve o elimina los productos primero.')
      return
    }
    
    if (!confirm(`¿Seguro que quieres eliminar la categoría "${cat.name}"?`)) return
    
    try {
      await dispatch(deleteCategory({ tenantId, categoryId: cat.id })).unwrap()
      // Si estaba seleccionada, volver a "Todas"
      if (selectedCategoryFilter === cat.name) {
        navigateToCategory(null)
      }
    } catch (err) {
      console.error('Error al eliminar categoría:', err)
      alert('Error al eliminar: ' + (err.message || err))
    }
  }
  
  // Crear nueva subcategoría
  const handleCreateSubcategory = async () => {
    if (!newSubcategoryName.trim()) return
    
    try {
      await dispatch(createCategory({
        tenantId,
        category: {
          name: newSubcategoryName.trim(),
          parentId: addingSubcategoryTo, // null = categoría raíz
          sortOrder: categories.length,
        }
      })).unwrap()
      
      setNewSubcategoryName('')
      setAddingSubcategoryTo(null)
      
      // Expandir el padre si existe
      if (addingSubcategoryTo) {
        setExpandedCategories(prev => new Set([...prev, addingSubcategoryTo]))
      }
    } catch (err) {
      console.error('Error al crear subcategoría:', err)
      alert('Error al crear: ' + (err.message || err))
    }
  }
  
  // Mover categoría a otro padre
  const handleMoveCategory = async (categoryId, newParentId) => {
    try {
      await dispatch(patchCategory({ 
        tenantId, 
        categoryId, 
        patch: { parentId: newParentId }
      })).unwrap()
    } catch (err) {
      console.error('Error al mover categoría:', err)
      alert('Error al mover: ' + (err.message || err))
    }
  }

  // =====================
  // FUNCIONES MODAL DE EDICIÓN
  // =====================
  const openEditModal = (product) => {
    setEditingProduct(product)
    setEditName(product.name || '')
    setEditPrice(product.price?.toString() || '')
    setEditDescription(product.description || '')
    setEditCategory(product.categoryId || '')
    setEditSubcategory(product.subcategoryId || '')
    setEditCostPrice(product.costPrice?.toString() || '')
    setEditStock(product.stock?.toString() || '')
    setEditStockUnlimited(product.stock === null || product.stock === undefined)
    setEditIsActive(product.active !== false)
    setEditImageFile(null)
    setEditModalOpen(true)
  }

  const closeEditModal = () => {
    setEditModalOpen(false)
    setEditingProduct(null)
    setEditName('')
    setEditPrice('')
    setEditDescription('')
    setEditCategory('')
    setEditSubcategory('')
    setEditCostPrice('')
    setEditStock('')
    setEditStockUnlimited(true)
    setEditIsActive(true)
    setEditImageFile(null)
  }

  const handleSaveProduct = async () => {
    if (!editingProduct) return
    const parsedEditPrice = parsePrice(editPrice)
    const parsedCostPrice = editCostPrice.trim() ? parsePrice(editCostPrice) : null
    if (!editName.trim() || parsedEditPrice === null) {
      alert('Nombre y precio válido son requeridos')
      return
    }
    setEditSaving(true)
    try {
      // Obtener nombre de categoría desde ID
      const selectedCategory = categories.find(c => c.id === editCategory)
      const selectedSubcategory = categories.find(c => c.id === editSubcategory)
      
      const patch = {
        name: editName.trim(),
        price: parsedEditPrice,
        description: editDescription.trim(),
        category: selectedSubcategory?.name || selectedCategory?.name || null,
        categoryId: editCategory || null,
        subcategoryId: editSubcategory || null,
        costPrice: parsedCostPrice,
        stock: editStockUnlimited ? null : (editStock.trim() ? parseInt(editStock, 10) : null),
        active: editIsActive,
      }

      // Subir imagen si hay nueva
      if (editImageFile) {
        if (isSupabaseConfigured) {
          const url = await uploadProductImage({
            tenantId,
            productId: editingProduct.id,
            file: editImageFile,
          })
          patch.imageUrl = url
        } else {
          // Modo MOCK: convertir a data URL
          const dataUrl = await fileToDataUrl(editImageFile)
          patch.imageUrl = dataUrl
        }
      }

      await dispatch(patchProduct({ tenantId, productId: editingProduct.id, patch })).unwrap()
      closeEditModal()
    } catch (e) {
      console.error('Error guardando producto:', e)
      alert('Error guardando producto: ' + (e?.message || 'Error desconocido'))
    } finally {
      setEditSaving(false)
    }
  }

  const handleDeleteProduct = async (product) => {
    if (!confirm(`¿Eliminar "${product.name}"? Esta acción no se puede deshacer.`)) return
    try {
      await dispatch(deleteProduct({ tenantId, productId: product.id })).unwrap()
    } catch (e) {
      console.error('Error eliminando producto:', e)
      alert('Error eliminando producto: ' + (e?.message || 'Error desconocido'))
    }
  }

  // Crear nueva categoría
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return
    setSavingCategory(true)
    try {
      const result = await dispatch(createCategory({
        tenantId,
        category: { name: newCategoryName.trim() }
      })).unwrap()
      // Seleccionar la nueva categoría (en crear o editar producto)
      const newCatName = result.row?.name || newCategoryName.trim()
      if (editModalOpen) {
        setEditCategory(newCatName)
      } else {
        setCategory(newCatName)
      }
      setNewCategoryName('')
      setShowNewCategoryModal(false)
    } catch (e) {
      console.error('Error creando categoría:', e)
      alert('Error creando categoría: ' + (e?.message || 'Error desconocido'))
    } finally {
      setSavingCategory(false)
    }
  }

  return (
    <div className="products">
      {/* Header con título y botón de tutorial */}
      <div className="products__header">
        <div className="products__headerTop">
          <h3 className="products__title">
            <Package size={20} />
            Gestión de Productos
            <InfoTooltip 
              text="Aquí puedes crear, editar y eliminar productos de tu menú. Agrega fotos, precios, descripciones y organiza por categorías."
              position="right"
              size={16}
            />
          </h3>
          <PageTutorialButton 
            sectionId="tutorial-products" 
            label="Tutorial"
            hasVideo={Boolean(tutorialVideo.url)}
          />
        </div>
        
        {/* Tabs internos: Productos | Categorías */}
        <div className="products__internalTabs">
          <button
            type="button"
            className={`products__internalTab ${internalTab === 'products' ? 'products__internalTab--active' : ''}`}
            onClick={() => setInternalTab('products')}
          >
            <Package size={16} />
            Productos
          </button>
          <button
            type="button"
            className={`products__internalTab ${internalTab === 'categories' ? 'products__internalTab--active' : ''}`}
            onClick={() => setInternalTab('categories')}
          >
            <FolderTree size={16} />
            Categorías
          </button>
        </div>
      </div>
      
      {/* Tab de Categorías */}
      {internalTab === 'categories' && (
        <CategoryManager tenantId={tenantId} />
      )}
      
      {/* Tab de Productos */}
      {internalTab === 'products' && (
      <>
      <Card
        title="Crear producto"
        actions={
          <Button
            size="sm"
            onClick={async () => {
              setPhotoStatus(null)
              if (!name.trim() || parsedPrice === null) {
                setPhotoStatus('Nombre y precio válido son requeridos.')
                return
              }
              
              // Validar categoría y subcategoría obligatorias
              if (!category) {
                setPhotoStatus('Debes seleccionar una categoría.')
                return
              }
              
              const subcategoriesAvailable = categories.filter(c => c.parentId === category)
              if (subcategoriesAvailable.length > 0 && !subcategory) {
                setPhotoStatus('Debes seleccionar una subcategoría.')
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

              // Determinar URL de imagen final
              const finalImageUrl = imageUrl.trim() || mockImageUrl || null
              
              // Obtener nombres de categoría/subcategoría
              const selectedCategory = categories.find(c => c.id === category)
              const selectedSubcategory = categories.find(c => c.id === subcategory)
              const parsedCostPrice = costPrice.trim() ? parsePrice(costPrice) : null

              let created
              try {
                created = await dispatch(
                  createProduct({
                    tenantId,
                    product: {
                      name: name.trim(),
                      price: parsedPrice,
                      description: description.trim(),
                      category: selectedSubcategory?.name || selectedCategory?.name || null,
                      categoryId: category || null,
                      subcategoryId: subcategory || null,
                      costPrice: parsedCostPrice,
                      stock: stockUnlimited ? null : (stock.trim() ? parseInt(stock, 10) : null),
                      ...(finalImageUrl ? { imageUrl: finalImageUrl } : null),
                    },
                  }),
                ).unwrap()
              } catch (e) {
                const msg = e?.message ? String(e.message) : 'Error creando producto'
                setPhotoStatus(msg)
                return
              }

              // Si hay archivo seleccionado y Supabase está configurado, se sube y se guarda en el producto.
              // (En modo MOCK no subimos archivos. Si usó URL, ya quedó guardada.)
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
                } else if (imageUrl.trim()) {
                  setPhotoStatus('Imagen por URL guardada ✅')
                }
              } catch (e) {
                setPhotoStatus(formatPhotoError(e))
              }

              setName('')
              setPrice('')
              setDescription('')
              setCategory('')
              setSubcategory('')
              setCostPrice('')
              setStock('')
              setStockUnlimited(true)
              setImageFile(null)
              setImageUrl('')
              setImageMode('file')
              if (createFileInputRef.current) createFileInputRef.current.value = ''
            }}
          >
            Agregar
          </Button>
        }
      >
        <div className="products__form">
          <div className="products__formField">
            <div className="products__fieldHeader">
              <span className="products__label">Nombre</span>
              <InfoTooltip 
                text="El nombre del producto como aparecerá en tu menú. Usa un nombre claro y atractivo."
                position="right"
                size={14}
              />
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Hamburguesa doble"
              className="products__input"
            />
          </div>
          <div className="products__formField">
            <div className="products__fieldHeader">
              <span className="products__label">Precio</span>
              <InfoTooltip 
                text="El precio en pesos. Puedes usar coma o punto como separador decimal."
                position="right"
                size={14}
              />
            </div>
            <input
              type="text"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="9,99"
              inputMode="decimal"
              autoComplete="off"
              className="products__input"
            />
          </div>
          <div className="products__formField">
            <div className="products__fieldHeader">
              <span className="products__label">Descripción</span>
              <InfoTooltip 
                text="Describe los ingredientes o detalles del producto. Ayuda a los clientes a decidir."
                position="right"
                size={14}
              />
            </div>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ingredientes..."
              className="products__input"
            />
          </div>
          
          {/* Selector de Categoría y Subcategoría */}
          <div className="products__formField">
            <div className="products__fieldHeader">
              <span className="products__label">Categoría *</span>
              <InfoTooltip 
                text="Selecciona la categoría principal del producto."
                position="right"
                size={14}
              />
            </div>
            <div className="products__categorySelect">
              <select
                value={category}
                onChange={(e) => {
                  if (e.target.value === '__new__') {
                    setShowNewCategoryModal(true)
                  } else {
                    setCategory(e.target.value)
                    setSubcategory('') // Reset subcategoría al cambiar categoría
                  }
                }}
                className="products__select"
              >
                <option value="">Seleccionar categoría...</option>
                {categories.filter(c => !c.parentId).map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
                <option value="__new__">+ Crear nueva categoría</option>
              </select>
            </div>
          </div>
          
          {/* Subcategoría - Solo si hay categoría seleccionada */}
          {category && (
            <div className="products__formField">
              <div className="products__fieldHeader">
                <span className="products__label">Subcategoría *</span>
                <InfoTooltip 
                  text="Selecciona la subcategoría donde estará el producto."
                  position="right"
                  size={14}
                />
              </div>
              <div className="products__categorySelect">
                <select
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  className="products__select"
                >
                  <option value="">Seleccionar subcategoría...</option>
                  {categories.filter(c => c.parentId === category).map((sub) => (
                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                  ))}
                </select>
                {categories.filter(c => c.parentId === category).length === 0 && (
                  <p className="products__selectHint">
                    Esta categoría no tiene subcategorías. Créalas desde el panel de gestión (⚙️).
                  </p>
                )}
              </div>
            </div>
          )}
          
          {/* Precio de costo (opcional) */}
          <div className="products__formField">
            <div className="products__fieldHeader">
              <span className="products__label">Precio de costo</span>
              <InfoTooltip 
                text="Opcional. El costo del producto para calcular ganancias en estadísticas. No visible para clientes."
                position="right"
                size={14}
              />
            </div>
            <input
              type="text"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              placeholder="Ej: 5.50 (opcional)"
              inputMode="decimal"
              autoComplete="off"
              className="products__input"
            />
          </div>
          
          <div className="products__stockSection">
            <div className="products__formField">
              <label className="products__toggle products__toggle--stock">
                <input
                  type="checkbox"
                  checked={stockUnlimited}
                  onChange={(e) => {
                    setStockUnlimited(e.target.checked)
                    if (e.target.checked) setStock('')
                  }}
                />
                <span>Stock ilimitado</span>
              </label>
              <InfoTooltip 
                text="Activa stock ilimitado si siempre tienes disponibilidad. Si no, define la cantidad exacta."
                position="right"
                size={14}
              />
            </div>
            {!stockUnlimited && (
              <Input
                label="Cantidad disponible"
                value={stock}
                onChange={setStock}
                placeholder="Ej: 50"
                inputMode="numeric"
                autoComplete="off"
              />
            )}
          </div>
          
          <div className="products__formField products__formField--row">
            <div className="products__fieldLabel">
              <span className="products__label">Foto</span>
              <InfoTooltip 
                text="Sube una foto desde tu PC o pega un link de imagen."
                position="right"
                size={14}
              />
            </div>
            <div className="products__imageOptions">
              <div className="products__imageTabs">
                <button
                  type="button"
                  className={`products__imageTab ${imageMode === 'file' ? 'products__imageTab--active' : ''}`}
                  onClick={() => setImageMode('file')}
                >
                  <Upload size={14} />
                  Subir archivo
                </button>
                <button
                  type="button"
                  className={`products__imageTab ${imageMode === 'url' ? 'products__imageTab--active' : ''}`}
                  onClick={() => setImageMode('url')}
                >
                  <Link2 size={14} />
                  Pegar URL
                </button>
              </div>
              
              {imageMode === 'file' ? (
                <label className="products__fileBtn">
                  <Upload size={16} />
                  <span>Elegir imagen</span>
                  <input
                    ref={createFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null
                      if (!file) return
                      setImageUrl('') // Limpiar URL si había
                      setPhotoStatus('Hacé clic en la imagen para definir el punto focal.')
                      openFocalPointEditor({ file, mode: 'create' })
                      e.target.value = ''
                    }}
                  />
                </label>
              ) : (
                <div className="products__urlInput">
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => {
                      setImageUrl(e.target.value)
                      setImageFile(null) // Limpiar archivo si había
                    }}
                    placeholder="https://ejemplo.com/imagen.jpg"
                    className="products__urlField"
                  />
                  {imageUrl && (
                    <button
                      type="button"
                      className="products__urlClear"
                      onClick={() => setImageUrl('')}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {(imageFile || imageUrl) && (
            <div className="products__imageRow">
              <img className="products__thumb" src={imageUrl || previewUrl || ''} alt="" />
              <span className="products__hint">Vista previa</span>
            </div>
          )}

          {!isSupabaseConfigured ? <p className="products__hint">Modo MOCK: la foto se guarda localmente.</p> : null}
          {photoStatus ? <p className="products__hint">{photoStatus}</p> : null}
          <p className="products__hint">Tip: el precio debe ser numérico.</p>
        </div>
      </Card>
      </>
      )}
      
      {/* Modales flotantes (fuera del tab condicional) */}
      {focalState.open ? (
        <div
          className="products__modalOverlay"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeFocalPointEditor()
          }}
          onMouseUp={handleFocalMouseUp}
          onMouseLeave={handleFocalMouseUp}
        >
          <div
            className="products__modal"
            role="dialog"
            aria-modal="true"
            aria-label="Ajustar punto focal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Card title={focalState.mode === 'edit' ? `Ajustar foco: ${focalState.productName || ''}` : 'Ajustar punto focal'}>
              <div className="products__focalWrap">
                <p className="products__focalHint">
                  <Move size={16} /> Hacé clic o arrastrá para elegir qué parte de la imagen se centra en las cards.
                </p>
                
                <div 
                  className="products__focalArea"
                  ref={focalAreaRef}
                  onMouseDown={handleFocalMouseDown}
                  onMouseMove={handleFocalMouseMove}
                  onMouseUp={handleFocalMouseUp}
                >
                  <img
                    src={focalState.src}
                    alt="Imagen para ajustar foco"
                    className="products__focalImg"
                    draggable={false}
                  />
                  {/* Punto focal */}
                  <div 
                    className="products__focalPoint"
                    style={{
                      left: `${focalState.focalPoint.x}%`,
                      top: `${focalState.focalPoint.y}%`,
                    }}
                  />
                </div>

                {/* Previsualización */}
                <div className="products__focalPreviewSection">
                  <span className="products__focalPreviewLabel">Vista previa:</span>
                  <div className="products__focalPreviewBox">
                    {/* Liquid Glass effect cuando zoom < 1 */}
                    {(focalState.focalPoint.zoom || 1) < 1 && (
                      <div 
                        className="products__focalPreviewLiquid"
                        style={{
                          backgroundImage: `url(${focalState.src})`,
                        }}
                      />
                    )}
                    <div 
                      className="products__focalPreviewImg"
                      style={{
                        backgroundImage: `url(${focalState.src})`,
                        backgroundPosition: `${focalState.focalPoint.x}% ${focalState.focalPoint.y}%`,
                        backgroundSize: `${(focalState.focalPoint.zoom || 1) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Controles de zoom */}
                <div className="products__focalZoomControls">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleZoomOut}
                    disabled={(focalState.focalPoint.zoom || 1) <= ZOOM_MIN}
                    title="Alejar"
                  >
                    <ZoomOut size={18} />
                  </Button>
                  <span className="products__focalZoomLabel">
                    Zoom: {((focalState.focalPoint.zoom || 1) * 100).toFixed(0)}%
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleZoomIn}
                    disabled={(focalState.focalPoint.zoom || 1) >= ZOOM_MAX}
                    title="Acercar"
                  >
                    <ZoomIn size={18} />
                  </Button>
                </div>

                <div className="products__focalActions">
                  <Button variant="ghost" onClick={closeFocalPointEditor}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={async () => {
                      setPhotoStatus(null)
                      try {
                        const focalPoint = focalState.focalPoint
                        let fileToUpload = focalState.file

                        // Si es URL, descargar la imagen
                        if (focalState.mode === 'url' && !fileToUpload) {
                          const response = await fetch(focalState.src)
                          const blob = await response.blob()
                          fileToUpload = new File([blob], 'image.jpg', { type: blob.type || 'image/jpeg' })
                        }

                        if (focalState.mode === 'create') {
                          // Para creación, guardar el archivo y el punto focal
                          setImageFile(fileToUpload)
                          // Guardar focalPoint temporalmente (se usará al crear el producto)
                          setPhotoStatus('Imagen lista')
                          closeFocalPointEditor()
                          return
                        }

                        if ((focalState.mode === 'edit' || focalState.mode === 'url') && focalState.productId) {
                          const productId = focalState.productId
                          const tenantIdForUpload = tenantId

                          if (!isSupabaseConfigured) {
                            setPhotoStatus('Guardando imagen localmente (modo MOCK)...')
                            const dataUrl = await fileToDataUrl(fileToUpload)
                            await dispatch(
                              patchProduct({ tenantId, productId, patch: { imageUrl: dataUrl, focalPoint } }),
                            ).unwrap()
                            setPhotoStatus('Imagen actualizada (local)')
                            closeFocalPointEditor()
                            return
                          }

                          setPhotoStatus('Subiendo imagen...')
                          const url = await uploadProductImage({ tenantId: tenantIdForUpload, productId, file: fileToUpload })
                          await dispatch(patchProduct({ tenantId, productId, patch: { imageUrl: url, focalPoint } })).unwrap()
                          setPhotoStatus('Imagen actualizada')
                          closeFocalPointEditor()
                        }
                      } catch (err) {
                        setPhotoStatus(formatPhotoError(err))
                      }
                    }}
                  >
                    Guardar
                  </Button>
                </div>
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
                âœ• Limpiar
              </button>
            </div>
            <div className="products__bulkButtons">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => bulkToggleActive(true)}
                disabled={isBulkActionLoading}
              >
                âœ… Activar
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => bulkToggleActive(false)}
                disabled={isBulkActionLoading}
              >
                â¸ï¸ Desactivar
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={bulkDeleteProducts}
                disabled={isBulkActionLoading}
              >
                ðŸ—‘ï¸ Eliminar
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
          <div className="products__layout">
            {/* Sidebar de categorías */}
            <div className="products__sidebar">
              <div className="products__sidebarHeader">
                <List size={16} />
                <span>Categorías</span>
                <button
                  className={`products__sidebarToggle ${showCategoryManager ? 'products__sidebarToggle--active' : ''}`}
                  onClick={() => setShowCategoryManager(!showCategoryManager)}
                  title={showCategoryManager ? 'Ocultar gestión' : 'Gestionar categorías'}
                >
                  <Settings size={14} />
                </button>
              </div>
              
              {/* Panel de gestión de categorías */}
              {showCategoryManager && (
                <div className="products__categoryManagerPanel">
                  <div className="products__categoryManagerHeader">
                    <LayoutGrid size={16} />
                    <h4>Gestión de Categorías</h4>
                  </div>
                  
                  {/* Botones de acción principales */}
                  <div className="products__categoryActions">
                    <button
                      className={`products__categoryActionBtn ${!addingSubcategoryTo ? 'products__categoryActionBtn--active' : ''}`}
                      onClick={() => setAddingSubcategoryTo(null)}
                    >
                      <Tag size={16} />
                      <span>Categoría</span>
                    </button>
                    <button
                      className={`products__categoryActionBtn ${addingSubcategoryTo ? 'products__categoryActionBtn--active' : ''}`}
                      onClick={() => {
                        // Si no hay categoría seleccionada, elegir la primera
                        const rootCategories = categories.filter(c => !c.parentId)
                        if (rootCategories.length > 0 && !addingSubcategoryTo) {
                          setAddingSubcategoryTo(rootCategories[0].id)
                        }
                      }}
                      disabled={categories.filter(c => !c.parentId).length === 0}
                    >
                      <Layers size={16} />
                      <span>Subcategoría</span>
                    </button>
                  </div>
                  
                  {/* Formulario visual para crear */}
                  <div className="products__categoryCreateBox">
                    {addingSubcategoryTo ? (
                      <>
                        <div className="products__categoryCreateLabel">
                          <Layers size={14} />
                          <span>Nueva subcategoría en:</span>
                        </div>
                        <select
                          className="products__categoryParentSelect"
                          value={addingSubcategoryTo || ''}
                          onChange={(e) => setAddingSubcategoryTo(e.target.value || null)}
                        >
                          {categories.filter(c => !c.parentId).map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </>
                    ) : (
                      <div className="products__categoryCreateLabel">
                        <Tag size={14} />
                        <span>Nueva categoría principal</span>
                      </div>
                    )}
                    
                    <div className="products__categoryInputGroup">
                      <input
                        type="text"
                        className="products__categoryInput products__categoryInput--large"
                        placeholder={addingSubcategoryTo ? 'Ej: Hombres, Mujeres, Niños...' : 'Ej: Remeras, Pantalones, Zapatos...'}
                        value={newSubcategoryName}
                        onChange={(e) => setNewSubcategoryName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newSubcategoryName.trim()) {
                            handleCreateSubcategory()
                          }
                          if (e.key === 'Escape') {
                            setNewSubcategoryName('')
                          }
                        }}
                      />
                      <button
                        className="products__categoryCreateBtn"
                        onClick={handleCreateSubcategory}
                        disabled={!newSubcategoryName.trim()}
                      >
                        <Plus size={16} />
                        Crear
                      </button>
                    </div>
                  </div>
                  
                  {/* Lista visual de categorías existentes */}
                  <div className="products__categoryList">
                    <div className="products__categoryListHeader">
                      <span>Categorías existentes</span>
                      <span className="products__categoryListCount">{categories.filter(c => !c.parentId).length}</span>
                    </div>
                    {categories.filter(c => !c.parentId).length === 0 ? (
                      <div className="products__categoryEmpty">
                        <Tag size={24} />
                        <p>No hay categorías</p>
                        <span>Crea tu primera categoría arriba</span>
                      </div>
                    ) : (
                      <div className="products__categoryGrid">
                        {categories.filter(c => !c.parentId).map(cat => {
                          const subcats = categories.filter(c => c.parentId === cat.id)
                          return (
                            <div key={cat.id} className="products__categoryCard">
                              <div className="products__categoryCardHeader">
                                <div className="products__categoryCardIcon">
                                  <Tag size={16} />
                                </div>
                                <div className="products__categoryCardInfo">
                                  <span className="products__categoryCardName">{cat.name}</span>
                                  <span className="products__categoryCardMeta">
                                    {subcats.length} subcategorías · {getProductCountForCategory(cat.id)} productos
                                  </span>
                                </div>
                                <div className="products__categoryCardActions">
                                  <button
                                    className="products__categoryCardBtn"
                                    onClick={() => {
                                      setAddingSubcategoryTo(cat.id)
                                      setNewSubcategoryName('')
                                    }}
                                    title="Agregar subcategoría"
                                  >
                                    <Plus size={14} />
                                  </button>
                                  <button
                                    className="products__categoryCardBtn"
                                    onClick={(e) => startEditCategory(cat, e)}
                                    title="Editar"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    className="products__categoryCardBtn products__categoryCardBtn--danger"
                                    onClick={(e) => handleDeleteCategory(cat, e)}
                                    title="Eliminar"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                              {subcats.length > 0 && (
                                <div className="products__subcategoryList">
                                  {subcats.map(sub => (
                                    <div key={sub.id} className="products__subcategoryItem">
                                      <Layers size={12} />
                                      <span>{sub.name}</span>
                                      <span className="products__subcategoryCount">
                                        {getProductCountForCategory(sub.id)}
                                      </span>
                                      <div className="products__subcategoryActions">
                                        <button onClick={(e) => startEditCategory(sub, e)} title="Editar">
                                          <Edit2 size={12} />
                                        </button>
                                        <button onClick={(e) => handleDeleteCategory(sub, e)} title="Eliminar">
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  
                  {/* Modal inline de edición */}
                  {editingCategoryId && (
                    <div className="products__categoryEditPanel">
                      <div className="products__categoryEditHeader">
                        <Edit2 size={16} />
                        <h5>Editando: {categories.find(c => c.id === editingCategoryId)?.name}</h5>
                      </div>
                      <div className="products__categoryEditForm">
                        <label>
                          <span>Nombre:</span>
                          <input
                            type="text"
                            value={editingCategoryName}
                            onChange={(e) => setEditingCategoryName(e.target.value)}
                            className="products__categoryInput"
                          />
                        </label>
                        <label>
                          <span>Categoría padre:</span>
                          <select
                            value={editingCategoryParent || ''}
                            onChange={(e) => setEditingCategoryParent(e.target.value || null)}
                            className="products__categorySelect"
                          >
                            <option value="">— Ninguna (categoría raíz) —</option>
                            {categories
                              .filter(c => c.id !== editingCategoryId && !getCategoryDescendantIds(editingCategoryId).includes(c.id))
                              .map(c => (
                                <option key={c.id} value={c.id}>
                                  {'—'.repeat(c.level || 0)} {c.name}
                                </option>
                              ))
                            }
                          </select>
                        </label>
                        <div className="products__categoryEditActions">
                          <button className="products__categoryBtn products__categoryBtn--save" onClick={handleSaveCategory}>
                            <Save size={14} /> Guardar
                          </button>
                          <button className="products__categoryBtn products__categoryBtn--cancel" onClick={cancelEditCategory}>
                            <X size={14} /> Cancelar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Breadcrumb de navegación */}
              {currentBreadcrumb.length > 0 && (
                <div className="products__breadcrumb">
                  <button
                    className="products__breadcrumbItem products__breadcrumbItem--home"
                    onClick={() => navigateToCategory(null)}
                  >
                    <Home size={12} />
                  </button>
                  {currentBreadcrumb.map((cat, index) => (
                    <span key={cat.id} className="products__breadcrumbSegment">
                      <ChevronRight size={12} className="products__breadcrumbSeparator" />
                      <button
                        className={`products__breadcrumbItem ${index === currentBreadcrumb.length - 1 ? 'products__breadcrumbItem--active' : ''}`}
                        onClick={() => navigateToCategory(cat)}
                      >
                        {cat.name}
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <ul className="products__sidebarMenu">
                <li>
                  <button
                    className={`products__sidebarItem ${selectedCategoryFilter === null ? 'products__sidebarItem--active' : ''}`}
                    onClick={() => navigateToCategory(null)}
                  >
                    <Grid3X3 size={14} />
                    <span>Todas</span>
                    <span className="products__sidebarCount">{products.length}</span>
                  </button>
                </li>
                
                {/* Renderizar árbol de categorías recursivamente */}
                {categoryTree.map((cat) => (
                  <CategoryTreeItem
                    key={cat.id}
                    category={cat}
                    level={0}
                    selectedCategoryFilter={selectedCategoryFilter}
                    expandedCategories={expandedCategories}
                    toggleCategoryExpand={toggleCategoryExpand}
                    navigateToCategory={navigateToCategory}
                    getProductCountForCategory={getProductCountForCategory}
                    showCategoryManager={showCategoryManager}
                    onEdit={startEditCategory}
                    onDelete={handleDeleteCategory}
                    onAddSubcategory={(parentId) => {
                      setAddingSubcategoryTo(parentId)
                      setNewSubcategoryName('')
                    }}
                  />
                ))}
              </ul>
            </div>

            {/* Grid de productos */}
            <div className="products__content">
              <div className="products__categories">
                {filteredProductsByCategory.map(({ category: cat, products: catProducts, categoryId, maxStock, currentStock }) => (
              <div key={cat} className="products__categorySection">
                <div className="products__categoryHeader">
                  <h3 className="products__categoryTitle">{cat}</h3>
                  {maxStock !== null && (
                    <div className={`products__categoryStock ${currentStock === 0 ? 'products__categoryStock--out' : currentStock <= 5 ? 'products__categoryStock--low' : ''}`}>
                      <Package size={14} />
                      <span className="products__categoryStockLabel">Stock:</span>
                      <span className="products__categoryStockValue">
                        {currentStock} / {maxStock}
                      </span>
                      {currentStock === 0 && (
                        <span className="products__categoryStockAlert">
                          <AlertTriangle size={12} /> Sin stock
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="products__grid">
                  {catProducts.map((p) => (
                    <div key={p.id} className="products__cardWrapper">
                      <div className="products__cardSelectBox">
                        <input
                          type="checkbox"
                          checked={selectedProductIds.has(p.id)}
                          onChange={() => toggleProductSelection(p.id)}
                          className="products__checkbox"
                        />
                      </div>
                      {!p.active && <span className="products__inactiveLabel">Inactivo</span>}
                      <ProductCard
                        product={p}
                        isEditable={true}
                        onEdit={() => openEditModal(p)}
                        onDelete={() => handleDeleteProduct(p)}
                        layout="grid"
                      />
                    </div>
                  ))}
                </div>
              </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Modal de edición */}
      {editModalOpen && editingProduct && (
        <div className="products__modalOverlay" onClick={closeEditModal}>
          <div className="products__modal products__modal--edit" onClick={(e) => e.stopPropagation()}>
            <Card
              title={`Editar: ${editingProduct.name}`}
              actions={
                <div className="products__editActions">
                  <Button size="sm" variant="secondary" onClick={closeEditModal} disabled={editSaving}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleSaveProduct} disabled={editSaving}>
                    {editSaving ? 'Guardando...' : 'Guardar'}
                  </Button>
                </div>
              }
            >
              <div className="products__editForm">
                <Input label="Nombre" value={editName} onChange={setEditName} placeholder="Nombre del producto" />
                <Input
                  label="Precio"
                  value={editPrice}
                  onChange={setEditPrice}
                  placeholder="9,99"
                  inputMode="decimal"
                  autoComplete="off"
                />
                <Input
                  label="Descripción"
                  value={editDescription}
                  onChange={setEditDescription}
                  placeholder="Descripción del producto..."
                />
                <div className="products__formField">
                  <div className="products__fieldHeader">
                    <span className="products__label">Categoría</span>
                  </div>
                  <select
                    value={editCategory}
                    onChange={(e) => {
                      if (e.target.value === '__new__') {
                        setShowNewCategoryModal(true)
                      } else {
                        setEditCategory(e.target.value)
                      }
                    }}
                    className="products__select"
                  >
                    <option value="">Sin categoría</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                    <option value="__new__">+ Crear nueva categoría</option>
                  </select>
                </div>
                
                <div className="products__stockSection">
                  <label className="products__toggle products__toggle--stock">
                    <input
                      type="checkbox"
                      checked={editStockUnlimited}
                      onChange={(e) => {
                        setEditStockUnlimited(e.target.checked)
                        if (e.target.checked) setEditStock('')
                      }}
                    />
                    <span>Stock ilimitado</span>
                  </label>
                  {!editStockUnlimited && (
                    <Input
                      label="Cantidad disponible"
                      value={editStock}
                      onChange={setEditStock}
                      placeholder="Ej: 50"
                      inputMode="numeric"
                      autoComplete="off"
                    />
                  )}
                </div>

                <label className="products__toggle">
                  <input
                    type="checkbox"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                  />
                  <span>Producto activo</span>
                </label>

                <div className="products__editImageSection">
                  <span className="products__fileLabel">Imagen actual:</span>
                  {editingProduct.imageUrl ? (
                    <div className="products__editImagePreview">
                      <img 
                        className="products__editThumb" 
                        src={editingProduct.imageUrl} 
                        alt=""
                        style={editingProduct.focalPoint ? {
                          objectPosition: `${editingProduct.focalPoint.x}% ${editingProduct.focalPoint.y}%`
                        } : undefined}
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openFocalPointFromUrl({
                          url: editingProduct.imageUrl,
                          productId: editingProduct.id,
                          productName: editingProduct.name,
                          existingFocalPoint: editingProduct.focalPoint,
                        })}
                      >
                        <Move size={14} /> Ajustar foco
                      </Button>
                    </div>
                  ) : (
                    <span className="products__noImage">Sin foto</span>
                  )}
                  <label className="products__file">
                    <span className="products__fileLabel">Cambiar foto</span>
                    <input
                      ref={editFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          openFocalPointEditor({
                            file,
                            mode: 'edit',
                            productId: editingProduct.id,
                            productName: editingProduct.name,
                          })
                        }
                        e.target.value = ''
                      }}
                    />
                  </label>
                  {editImageFile && (
                    <span className="products__hint">Nueva imagen seleccionada: {editImageFile.name}</span>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Sección de Tutorial */}
      <div id="tutorial-products">
        <TutorialSection
          sectionId="products"
          title="Tutorial: Gestión de Productos"
          user={user}
          videoUrl={tutorialVideo.url}
          videoType={tutorialVideo.type}
          onSaveVideo={handleSaveTutorial}
        />
      </div>

      {/* Modal para crear nueva categoría */}
      {showNewCategoryModal && (
        <div 
          className="products__modalOverlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowNewCategoryModal(false)
          }}
        >
          <div className="products__modal products__modal--small">
            <Card 
              title="Crear nueva categoría"
              actions={
                <button 
                  className="products__modalClose" 
                  onClick={() => setShowNewCategoryModal(false)}
                >
                  <X size={18} />
                </button>
              }
            >
              <div className="products__newCategoryForm">
                <Input
                  label="Nombre de la categoría"
                  value={newCategoryName}
                  onChange={setNewCategoryName}
                  placeholder="Ej: Postres, Ensaladas..."
                  autoFocus
                />
                <div className="products__newCategoryActions">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowNewCategoryModal(false)
                      setNewCategoryName('')
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleCreateCategory}
                    disabled={!newCategoryName.trim() || savingCategory}
                  >
                    {savingCategory ? 'Guardando...' : 'Crear categoría'}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
