import { useState, useMemo, useEffect } from 'react'
import { 
  Folder, 
  FolderPlus, 
  Package, 
  Plus, 
  ChevronRight, 
  Home,
  AlertTriangle,
  Trash2,
  ArrowUp,
  ArrowDown,
  Edit2,
  Search,
  X,
} from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../../app/hooks'
import { 
  selectCategoriesForTenant,
  selectCategoryBreadcrumb,
  createCategory,
  patchCategory,
  deleteCategory,
  fetchCategoriesForTenant,
} from '../../../features/categories/categoriesSlice'
import { 
  selectProductsForTenant,
  fetchProductsForTenant,
  deleteProduct,
} from '../../../features/products/productsSlice'
import CategoryCard, { AddProductCard } from '../../ui/CategoryCard/CategoryCard'
import CategoryModal from '../CategoryModal/CategoryModal'
import ProductModal from '../ProductModal/ProductModal'
import ProductCard from '../../storefront/ProductCard/ProductCard'
import Button from '../../ui/Button/Button'
import './CategoryManager.css'

/**
 * CategoryManager - Gestión visual de categorías en el Dashboard
 * 
 * Interface intuitiva tipo carpetas para:
 * - Crear categorías y subcategorías
 * - Navegar entre niveles
 * - Agregar productos
 * - Aplicar reglas de carpetas automáticamente
 */
export default function CategoryManager({ tenantId }) {
  const dispatch = useAppDispatch()
  const allCategories = useAppSelector(selectCategoriesForTenant(tenantId))
  const allProducts = useAppSelector(selectProductsForTenant(tenantId))
  
  // Navigation state
  const [currentCategoryId, setCurrentCategoryId] = useState(null)
  const breadcrumb = useAppSelector(selectCategoryBreadcrumb(tenantId, currentCategoryId))

  // Modal states
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [parentIdForNew, setParentIdForNew] = useState(null)
  
  const [showProductModal, setShowProductModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [productCategoryId, setProductCategoryId] = useState(null)

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deleteProductConfirm, setDeleteProductConfirm] = useState(null)
  const [deleting, setDeleting] = useState(false)
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch data on mount
  useEffect(() => {
    dispatch(fetchCategoriesForTenant(tenantId))
    dispatch(fetchProductsForTenant(tenantId))
  }, [dispatch, tenantId])

  // Current level categories (with search filter)
  const currentLevelCategories = useMemo(() => {
    let cats = allCategories.filter(c => {
      if (currentCategoryId === null) {
        return c.parentId === null || c.parentId === undefined
      }
      return c.parentId === currentCategoryId
    })
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      cats = cats.filter(c => 
        c.name?.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query)
      )
    }
    
    return cats.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
  }, [allCategories, currentCategoryId, searchQuery])

  // Current level products (with search filter)
  const currentLevelProducts = useMemo(() => {
    let prods
    if (currentCategoryId === null) {
      // Root: show unassigned products
      prods = allProducts.filter(p => !p.categoryId && !p.subcategoryId && !p.category)
    } else {
      // Products in this category/subcategory
      prods = allProducts.filter(p => 
        p.categoryId === currentCategoryId || 
        p.subcategoryId === currentCategoryId
      )
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      prods = prods.filter(p => 
        p.name?.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query)
      )
    }
    
    return prods
  }, [allProducts, currentCategoryId, searchQuery])

  // Current category
  const currentCategory = currentCategoryId 
    ? allCategories.find(c => c.id === currentCategoryId) 
    : null

  // Helpers
  const getProductCount = (categoryId) => {
    return allProducts.filter(p => 
      p.categoryId === categoryId || 
      p.subcategoryId === categoryId
    ).length
  }

  const getChildrenCount = (categoryId) => {
    return allCategories.filter(c => c.parentId === categoryId).length
  }

  // Determinar reglas basándose en conteos reales (no en flags que pueden estar desactualizados)
  const hasChildrenInCurrentLevel = getChildrenCount(currentCategoryId) > 0
  const hasProductsInCurrentLevel = getProductCount(currentCategoryId) > 0
  
  // Puede agregar productos: solo si NO tiene subcategorías
  const canAddProductsHere = currentCategory 
    ? !hasChildrenInCurrentLevel
    : false // Root level - no products directly

  // Puede agregar subcategorías: 
  // - Si ya hay subcategorías, SIEMPRE puede agregar más
  // - Si no hay nada, puede agregar subcategorías
  // - Si hay productos, NO puede agregar subcategorías
  const canAddSubcategoriesHere = currentCategory
    ? hasChildrenInCurrentLevel || !hasProductsInCurrentLevel
    : true // Root level - always can add

  // Handlers
  const handleNavigate = (categoryId) => {
    setCurrentCategoryId(categoryId)
  }

  const handleAddCategory = (parentId = null) => {
    setEditingCategory(null)
    setParentIdForNew(parentId)
    setShowCategoryModal(true)
  }

  const handleEditCategory = (category) => {
    setEditingCategory(category)
    setParentIdForNew(null)
    setShowCategoryModal(true)
  }

  const handleDeleteCategory = async (category) => {
    const hasChildren = getChildrenCount(category.id) > 0
    const hasProducts = getProductCount(category.id) > 0

    if (hasChildren) {
      alert('No puedes eliminar una categoría que tiene subcategorías. Elimina primero las subcategorías.')
      return
    }

    if (hasProducts) {
      alert('No puedes eliminar una categoría que tiene productos. Mueve o elimina los productos primero.')
      return
    }

    setDeleteConfirm(category)
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return
    
    setDeleting(true)
    try {
      await dispatch(deleteCategory({
        tenantId,
        categoryId: deleteConfirm.id,
      })).unwrap()
      
      // If we deleted the current category, go back
      if (deleteConfirm.id === currentCategoryId) {
        setCurrentCategoryId(deleteConfirm.parentId || null)
      }
    } catch (err) {
      alert(err?.message || 'Error al eliminar')
    } finally {
      setDeleting(false)
      setDeleteConfirm(null)
    }
  }

  const handleAddProduct = (category) => {
    setEditingProduct(null)
    setProductCategoryId(category?.id || currentCategoryId)
    setShowProductModal(true)
  }

  const handleEditProduct = (product) => {
    setEditingProduct(product)
    setProductCategoryId(null)
    setShowProductModal(true)
  }

  const handleDeleteProduct = (product) => {
    setDeleteProductConfirm(product)
  }

  const confirmDeleteProduct = async () => {
    if (!deleteProductConfirm) return
    
    setDeleting(true)
    try {
      await dispatch(deleteProduct({
        tenantId,
        productId: deleteProductConfirm.id,
      })).unwrap()
    } catch (err) {
      alert(err?.message || 'Error al eliminar producto')
    } finally {
      setDeleting(false)
      setDeleteProductConfirm(null)
    }
  }

  const handleMoveCategory = async (category, direction) => {
    const siblings = currentLevelCategories
    const idx = siblings.findIndex(c => c.id === category.id)
    if (idx < 0) return

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= siblings.length) return

    // Swap sort orders
    const currentOrder = category.sortOrder ?? idx
    const targetOrder = siblings[targetIdx].sortOrder ?? targetIdx

    try {
      await dispatch(patchCategory({
        tenantId,
        categoryId: category.id,
        patch: { sort_order: targetOrder },
      })).unwrap()

      await dispatch(patchCategory({
        tenantId,
        categoryId: siblings[targetIdx].id,
        patch: { sort_order: currentOrder },
      })).unwrap()
    } catch (err) {
      console.error('Error reordering:', err)
    }
  }

  return (
    <div className="categoryManager">
      {/* Header */}
      <div className="categoryManager__header">
        <h2 className="categoryManager__title">
          <Folder size={24} />
          Gestión de Categorías
        </h2>
        
        {/* Search Bar */}
        <div className="categoryManager__search">
          <Search size={16} className="categoryManager__searchIcon" />
          <input
            type="text"
            className="categoryManager__searchInput"
            placeholder="Buscar categorías o productos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="categoryManager__searchClear"
              onClick={() => setSearchQuery('')}
            >
              <X size={14} />
            </button>
          )}
        </div>
        
        <Button 
          onClick={() => handleAddCategory(currentCategoryId)}
          disabled={currentCategoryId !== null && !canAddSubcategoriesHere}
          title={!canAddSubcategoriesHere && currentCategoryId !== null ? 'Esta categoría tiene productos' : ''}
        >
          <FolderPlus size={16} />
          {currentCategoryId ? 'Nueva subcategoría' : 'Nueva categoría'}
        </Button>
      </div>

      {/* Breadcrumb */}
      <nav className="categoryManager__breadcrumb">
        <button 
          className={`categoryManager__breadcrumbItem ${currentCategoryId === null ? 'categoryManager__breadcrumbItem--active' : ''}`}
          onClick={() => handleNavigate(null)}
          type="button"
        >
          <Home size={16} />
          <span>Raíz</span>
        </button>

        {breadcrumb.map((cat, index) => (
          <span key={cat.id} className="categoryManager__breadcrumbSegment">
            <ChevronRight size={14} className="categoryManager__breadcrumbSeparator" />
            <button
              className={`categoryManager__breadcrumbItem ${index === breadcrumb.length - 1 ? 'categoryManager__breadcrumbItem--active' : ''}`}
              onClick={() => handleNavigate(cat.id)}
              type="button"
            >
              {cat.icon && <span>{cat.icon}</span>}
              <span>{cat.name}</span>
            </button>
          </span>
        ))}
      </nav>

      {/* Level info */}
      {currentCategory && (
        <div className="categoryManager__levelInfo">
          <div className="categoryManager__levelStats">
            <span className="categoryManager__stat">
              <Folder size={14} />
              {getChildrenCount(currentCategoryId)} subcategorías
            </span>
            <span className="categoryManager__stat">
              <Package size={14} />
              {getProductCount(currentCategoryId)} productos
            </span>
          </div>

        </div>
      )}

      {/* Grid */}
      <div className="categoryManager__grid">
        {/* Back button */}
        {currentCategoryId !== null && (
          <CategoryCard
            variant="back"
            size="medium"
            onClick={() => {
              const parent = currentCategory?.parentId || null
              handleNavigate(parent)
            }}
          />
        )}

        {/* Categories */}
        {currentLevelCategories.map((category, index) => (
          <div key={category.id} className="categoryManager__cardWrapper">
            <CategoryCard
              category={category}
              size="medium"
              isAdmin={true}
              productCount={getProductCount(category.id)}
              childrenCount={getChildrenCount(category.id)}
              onClick={() => handleNavigate(category.id)}
              onEdit={handleEditCategory}
              onDelete={handleDeleteCategory}
              onAddProduct={handleAddProduct}
              onAddSubcategory={(cat) => handleAddCategory(cat.id)}
            />
            
            {/* Reorder buttons */}
            <div className="categoryManager__reorderButtons">
              <button
                className="categoryManager__reorderBtn"
                onClick={() => handleMoveCategory(category, 'up')}
                disabled={index === 0}
                title="Mover arriba"
              >
                <ArrowUp size={14} />
              </button>
              <button
                className="categoryManager__reorderBtn"
                onClick={() => handleMoveCategory(category, 'down')}
                disabled={index === currentLevelCategories.length - 1}
                title="Mover abajo"
              >
                <ArrowDown size={14} />
              </button>
            </div>
          </div>
        ))}

        {/* Add category card */}
        {(currentCategoryId === null || canAddSubcategoriesHere) && currentLevelCategories.length > 0 && (
          <CategoryCard
            variant="add"
            size="medium"
            category={{ parentId: currentCategoryId }}
            onClick={() => handleAddCategory(currentCategoryId)}
          />
        )}

        {/* Productos del nivel actual (si es categoría hoja) */}
        {currentCategoryId !== null && canAddProductsHere && currentLevelProducts.map(product => (
          <div 
            key={product.id} 
            className="categoryManager__productCard"
          >
            <ProductCard
              product={product}
              showCartButton={false}
              onClick={() => handleEditProduct(product)}
            />
            <div className="categoryManager__productActions">
              <button
                className="categoryManager__productActionBtn categoryManager__productActionBtn--edit"
                onClick={(e) => { e.stopPropagation(); handleEditProduct(product); }}
                title="Editar producto"
              >
                <Edit2 size={14} />
              </button>
              <button
                className="categoryManager__productActionBtn categoryManager__productActionBtn--delete"
                onClick={(e) => { e.stopPropagation(); handleDeleteProduct(product); }}
                title="Eliminar producto"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}

        {/* Add product card - solo si puede agregar productos */}
        {currentCategoryId !== null && canAddProductsHere && (
          <AddProductCard
            size="medium"
            onClick={() => handleAddProduct(currentCategory)}
          />
        )}
      </div>

      {/* Empty state - cuando está vacío mostrar opciones según lo que se puede agregar */}
      {currentCategoryId !== null && currentLevelCategories.length === 0 && currentLevelProducts.length === 0 && (
        <div className="categoryManager__emptyState">
          {canAddSubcategoriesHere && canAddProductsHere ? (
            // Puede agregar ambos - mostrar las dos opciones
            <div className="categoryManager__emptyOptions">
              <div className="categoryManager__emptyOption" onClick={() => handleAddCategory(currentCategoryId)}>
                <Folder size={32} />
                <span>Agregar subcategoría</span>
                <p>Organiza productos en subcategorías</p>
              </div>
              <div className="categoryManager__emptyOption" onClick={() => handleAddProduct(currentCategory)}>
                <Package size={32} />
                <span>Agregar producto</span>
                <p>Agrega productos directamente aquí</p>
              </div>
            </div>
          ) : canAddProductsHere ? (
            <div className="categoryManager__emptyProducts">
              <Package size={32} />
              <p>No hay productos en esta categoría</p>
              <Button size="sm" onClick={() => handleAddProduct(currentCategory)}>
                <Plus size={14} />
                Agregar primer producto
              </Button>
            </div>
          ) : canAddSubcategoriesHere ? (
            <div className="categoryManager__emptyProducts">
              <Folder size={32} />
              <p>No hay subcategorías</p>
              <Button size="sm" onClick={() => handleAddCategory(currentCategoryId)}>
                <Plus size={14} />
                Agregar subcategoría
              </Button>
            </div>
          ) : (
            <div className="categoryManager__emptyProducts categoryManager__emptyProducts--locked">
              <AlertTriangle size={32} />
              <p>Los productos deben agregarse en las subcategorías</p>
            </div>
          )}
        </div>
      )}

      {/* Root level products */}
      {currentCategoryId === null && currentLevelProducts.length > 0 && (
        <div className="categoryManager__productsSection">
          <div className="categoryManager__productsSectionHeader">
            <h3>
              <AlertTriangle size={18} />
              Productos sin categoría
            </h3>
          </div>
          <div className="categoryManager__productsGrid">
            {currentLevelProducts.map(product => (
              <div 
                key={product.id} 
                className="categoryManager__productCard"
              >
                <ProductCard
                  product={product}
                  showCartButton={false}
                  onClick={() => handleEditProduct(product)}
                />
                <div className="categoryManager__productActions">
                  <button
                    className="categoryManager__productActionBtn categoryManager__productActionBtn--edit"
                    onClick={(e) => { e.stopPropagation(); handleEditProduct(product); }}
                    title="Editar producto"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    className="categoryManager__productActionBtn categoryManager__productActionBtn--delete"
                    onClick={(e) => { e.stopPropagation(); handleDeleteProduct(product); }}
                    title="Eliminar producto"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <CategoryModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        tenantId={tenantId}
        category={editingCategory}
        parentId={parentIdForNew}
      />

      <ProductModal
        isOpen={showProductModal}
        onClose={() => setShowProductModal(false)}
        tenantId={tenantId}
        product={editingProduct}
        defaultCategoryId={productCategoryId}
      />

      {/* Delete category confirmation */}
      {deleteConfirm && (
        <div className="categoryManager__deleteOverlay" onClick={() => setDeleteConfirm(null)}>
          <div className="categoryManager__deleteModal" onClick={(e) => e.stopPropagation()}>
            <Trash2 size={32} className="categoryManager__deleteIcon" />
            <h3>¿Eliminar categoría?</h3>
            <p>Se eliminará "<strong>{deleteConfirm.name}</strong>" permanentemente.</p>
            <div className="categoryManager__deleteActions">
              <Button variant="ghost" onClick={() => setDeleteConfirm(null)} disabled={deleting}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={confirmDelete} disabled={deleting}>
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete product confirmation */}
      {deleteProductConfirm && (
        <div className="categoryManager__deleteOverlay" onClick={() => setDeleteProductConfirm(null)}>
          <div className="categoryManager__deleteModal" onClick={(e) => e.stopPropagation()}>
            <Trash2 size={32} className="categoryManager__deleteIcon categoryManager__deleteIcon--product" />
            <h3>¿Eliminar producto?</h3>
            <p>Se eliminará "<strong>{deleteProductConfirm.name}</strong>" permanentemente.</p>
            <div className="categoryManager__deleteActions">
              <Button variant="ghost" onClick={() => setDeleteProductConfirm(null)} disabled={deleting}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={confirmDeleteProduct} disabled={deleting}>
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
