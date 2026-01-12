import { useMemo } from 'react'
import { ChevronRight, Home, Folder, Package, AlertTriangle } from 'lucide-react'
import { useAppSelector } from '../../../app/hooks'
import { 
  selectCategoriesForTenant,
  selectCategoryBreadcrumb,
} from '../../../features/categories/categoriesSlice'
import { selectProductsForTenant } from '../../../features/products/productsSlice'
import CategoryCard, { AddProductCard } from '../CategoryCard/CategoryCard'
import './CategoryGrid.css'

/**
 * CategoryGrid - Grid visual de categorías con navegación jerárquica
 * 
 * Funcionalidad tipo carpetas:
 * - Muestra categorías como cards visuales
 * - Permite navegar hacia adentro (subcategorías)
 * - Breadcrumb para saber dónde estás
 * - Reglas de carpetas aplicadas visualmente
 */
export default function CategoryGrid({
  tenantId,
  currentCategoryId = null, // null = raíz
  onNavigate, // (categoryId) => void - navegar a categoría
  onAddProduct, // (category) => void - agregar producto
  onAddCategory, // (parentId) => void - agregar categoría/subcategoría
  onEditCategory, // (category) => void
  onDeleteCategory, // (category) => void
  isAdmin = false,
  showProducts = true, // Mostrar productos en el nivel actual
  cardSize = 'medium',
  emptyMessage = 'No hay categorías',
}) {
  const allCategories = useAppSelector(selectCategoriesForTenant(tenantId))
  const allProducts = useAppSelector(selectProductsForTenant(tenantId))
  const breadcrumb = useAppSelector(selectCategoryBreadcrumb(tenantId, currentCategoryId))

  // Obtener categorías del nivel actual
  const currentLevelCategories = useMemo(() => {
    return allCategories
      .filter(c => {
        if (currentCategoryId === null) {
          return c.parentId === null || c.parentId === undefined
        }
        return c.parentId === currentCategoryId
      })
      .filter(c => c.active)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
  }, [allCategories, currentCategoryId])

  // Obtener productos del nivel actual (si no hay subcategorías)
  const currentLevelProducts = useMemo(() => {
    if (!showProducts) return []
    
    // Si hay subcategorías en este nivel, no mostrar productos aquí
    if (currentLevelCategories.length > 0 && currentCategoryId) {
      // Verificar si la categoría actual tiene subcategorías
      const currentCategory = allCategories.find(c => c.id === currentCategoryId)
      if (currentCategory?.hasChildren || currentLevelCategories.length > 0) {
        return []
      }
    }

    return allProducts
      .filter(p => {
        if (currentCategoryId === null) {
          // Raíz: mostrar productos sin categoría
          return !p.categoryId && !p.subcategoryId && !p.category
        }
        // Productos que pertenecen a esta categoría/subcategoría
        return p.categoryId === currentCategoryId || 
               p.subcategoryId === currentCategoryId
      })
      .filter(p => p.active)
  }, [allProducts, currentCategoryId, currentLevelCategories, allCategories, showProducts])

  // Contar productos por categoría
  const getProductCount = (categoryId) => {
    return allProducts.filter(p => 
      p.categoryId === categoryId || 
      p.subcategoryId === categoryId
    ).length
  }

  // Contar hijos (subcategorías) por categoría
  const getChildrenCount = (categoryId) => {
    return allCategories.filter(c => c.parentId === categoryId).length
  }

  // Obtener categoría actual
  const currentCategory = currentCategoryId 
    ? allCategories.find(c => c.id === currentCategoryId) 
    : null

  // Determinar si podemos agregar productos aquí
  const canAddProductsHere = currentCategory 
    ? !currentCategory.hasChildren && getChildrenCount(currentCategoryId) === 0
    : false // En raíz no se agregan productos

  // Determinar si podemos agregar subcategorías aquí
  const canAddSubcategoriesHere = currentCategory
    ? !currentCategory.hasProducts && getProductCount(currentCategoryId) === 0
    : true // En raíz siempre se pueden agregar categorías

  return (
    <div className="categoryGrid">
      {/* Breadcrumb */}
      <nav className="categoryGrid__breadcrumb">
        <button 
          className={`categoryGrid__breadcrumbItem ${currentCategoryId === null ? 'categoryGrid__breadcrumbItem--active' : ''}`}
          onClick={() => onNavigate?.(null)}
          type="button"
        >
          <Home size={16} />
          <span>Inicio</span>
        </button>

        {breadcrumb.map((cat, index) => (
          <span key={cat.id} className="categoryGrid__breadcrumbSegment">
            <ChevronRight size={14} className="categoryGrid__breadcrumbSeparator" />
            <button
              className={`categoryGrid__breadcrumbItem ${index === breadcrumb.length - 1 ? 'categoryGrid__breadcrumbItem--active' : ''}`}
              onClick={() => onNavigate?.(cat.id)}
              type="button"
            >
              {cat.icon && <span className="categoryGrid__breadcrumbIcon">{cat.icon}</span>}
              <span>{cat.name}</span>
            </button>
          </span>
        ))}
      </nav>

      {/* Info del nivel actual (para admins) */}
      {isAdmin && currentCategory && (
        <div className="categoryGrid__levelInfo">
          <div className="categoryGrid__levelStats">
            {currentCategory.hasChildren || getChildrenCount(currentCategoryId) > 0 ? (
              <span className="categoryGrid__stat categoryGrid__stat--folder">
                <Folder size={14} />
                {getChildrenCount(currentCategoryId)} subcategorías
              </span>
            ) : null}
            {currentCategory.hasProducts || getProductCount(currentCategoryId) > 0 ? (
              <span className="categoryGrid__stat categoryGrid__stat--products">
                <Package size={14} />
                {getProductCount(currentCategoryId)} productos
              </span>
            ) : null}
          </div>
          
          {/* Advertencia de reglas */}
          {!canAddProductsHere && getChildrenCount(currentCategoryId) > 0 && (
            <div className="categoryGrid__warning">
              <AlertTriangle size={14} />
              <span>Esta categoría tiene subcategorías. Los productos deben ir dentro de ellas.</span>
            </div>
          )}
          {!canAddSubcategoriesHere && getProductCount(currentCategoryId) > 0 && (
            <div className="categoryGrid__warning">
              <AlertTriangle size={14} />
              <span>Esta categoría tiene productos. Muévelos antes de crear subcategorías.</span>
            </div>
          )}
        </div>
      )}

      {/* Grid de categorías */}
      <div className="categoryGrid__grid">
        {/* Botón volver (si estamos en subcategoría) */}
        {currentCategoryId !== null && (
          <CategoryCard
            variant="back"
            size={cardSize}
            onClick={() => {
              const parent = currentCategory?.parentId || null
              onNavigate?.(parent)
            }}
          />
        )}

        {/* Categorías del nivel actual */}
        {currentLevelCategories.map(category => (
          <CategoryCard
            key={category.id}
            category={category}
            size={cardSize}
            isAdmin={isAdmin}
            productCount={getProductCount(category.id)}
            childrenCount={getChildrenCount(category.id)}
            onClick={() => onNavigate?.(category.id)}
            onEdit={onEditCategory}
            onDelete={onDeleteCategory}
            onAddProduct={canAddProductsHere ? onAddProduct : undefined}
            onAddSubcategory={canAddSubcategoriesHere ? (cat) => onAddCategory?.(cat.id) : undefined}
          />
        ))}

        {/* Botón agregar categoría/subcategoría (solo admins) */}
        {isAdmin && canAddSubcategoriesHere && (
          <CategoryCard
            variant="add"
            size={cardSize}
            category={{ parentId: currentCategoryId }}
            onClick={() => onAddCategory?.(currentCategoryId)}
          />
        )}
      </div>

      {/* Productos del nivel actual (si no hay subcategorías) */}
      {showProducts && currentLevelProducts.length > 0 && (
        <div className="categoryGrid__products">
          <h3 className="categoryGrid__productsTitle">
            <Package size={18} />
            Productos
          </h3>
          <div className="categoryGrid__productsList">
            {/* Los productos se renderizan desde el componente padre */}
            {/* Esto es un placeholder, el componente padre debe pasar un renderProp o similar */}
          </div>
        </div>
      )}

      {/* Botón agregar producto (solo si estamos en hoja y es admin) */}
      {isAdmin && currentCategoryId && canAddProductsHere && (
        <div className="categoryGrid__addProductSection">
          <AddProductCard
            size={cardSize}
            onClick={() => onAddProduct?.(currentCategory)}
            disabled={!canAddProductsHere}
          />
        </div>
      )}

      {/* Mensaje vacío */}
      {currentLevelCategories.length === 0 && currentLevelProducts.length === 0 && !isAdmin && (
        <div className="categoryGrid__empty">
          <Folder size={48} />
          <p>{emptyMessage}</p>
        </div>
      )}
    </div>
  )
}
