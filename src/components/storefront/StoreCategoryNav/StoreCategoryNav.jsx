import { useMemo } from 'react'
import { ChevronRight, Home, Folder, Package, Pencil, Trash2, Plus } from 'lucide-react'
import { useAppSelector } from '../../../app/hooks'
import { 
  selectCategoriesForTenant,
  selectCategoryBreadcrumb,
} from '../../../features/categories/categoriesSlice'
import { selectProductsForTenant } from '../../../features/products/productsSlice'
import './StoreCategoryNav.css'

/**
 * StoreCategoryNav - Navegación visual de categorías para la Store pública
 * 
 * Muestra categorías como cards visuales con imagen.
 * Los usuarios pueden navegar entre categorías y subcategorías.
 */
export default function StoreCategoryNav({
  tenantId,
  currentCategoryId = null,
  onNavigate,
  cardLayout = 'grid', // 'grid' | 'horizontal'
  isAdmin = false,
  onEditCategory = null,
  onDeleteCategory = null,
  onCreateCategory = null,
}) {
  const allCategories = useAppSelector(selectCategoriesForTenant(tenantId))
  const allProducts = useAppSelector(selectProductsForTenant(tenantId))
  const breadcrumb = useAppSelector(selectCategoryBreadcrumb(tenantId, currentCategoryId))

  // Obtener categorías del nivel actual (activas)
  const currentLevelCategories = useMemo(() => {
    return allCategories
      .filter(c => {
        if (currentCategoryId === null) {
          return (c.parentId === null || c.parentId === undefined) && c.active
        }
        return c.parentId === currentCategoryId && c.active
      })
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
  }, [allCategories, currentCategoryId])

  // Contar productos por categoría (incluyendo hijos)
  const getProductCount = (categoryId) => {
    // Productos directos
    let count = allProducts.filter(p => 
      (p.categoryId === categoryId || p.subcategoryId === categoryId) && p.active
    ).length

    // Productos en subcategorías
    const children = allCategories.filter(c => c.parentId === categoryId)
    children.forEach(child => {
      count += allProducts.filter(p => 
        (p.categoryId === child.id || p.subcategoryId === child.id) && p.active
      ).length
    })

    return count
  }

  // Verificar si tiene subcategorías
  const hasSubcategories = (categoryId) => {
    return allCategories.some(c => c.parentId === categoryId && c.active)
  }

  // Obtener categoría actual
  const currentCategory = currentCategoryId 
    ? allCategories.find(c => c.id === currentCategoryId) 
    : null

  // Contar productos sin categoría ("Otros")
  const otrosProductCount = useMemo(() => {
    return allProducts.filter(p => 
      !p.categoryId && !p.subcategoryId && !p.category && p.active
    ).length
  }, [allProducts])

  // Si no hay categorías, no mostrar nada
  if (allCategories.filter(c => c.active).length === 0 && otrosProductCount === 0) {
    return null
  }

  return (
    <nav className={`storeCategoryNav storeCategoryNav--${cardLayout}`}>
      {/* Breadcrumb */}
      {currentCategoryId !== null && (
        <div className="storeCategoryNav__breadcrumb">
          <button 
            className="storeCategoryNav__breadcrumbItem"
            onClick={() => onNavigate(null)}
            type="button"
          >
            <Home size={14} />
            <span>Inicio</span>
          </button>

          {breadcrumb.map((cat, index) => (
            <span key={cat.id} className="storeCategoryNav__breadcrumbSegment">
              <ChevronRight size={12} className="storeCategoryNav__breadcrumbSeparator" />
              <button
                className={`storeCategoryNav__breadcrumbItem ${index === breadcrumb.length - 1 ? 'storeCategoryNav__breadcrumbItem--active' : ''}`}
                onClick={() => onNavigate(cat.id)}
                type="button"
              >
                {cat.icon && <span>{cat.icon}</span>}
                <span>{cat.name}</span>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Grid de categorías */}
      {currentLevelCategories.length > 0 && (
        <div className="storeCategoryNav__grid">
          {/* Botón Inicio (casita) - siempre visible cuando estamos en subcategoría */}
          {currentCategoryId !== null && (
            <button 
              className="storeCategoryNav__card storeCategoryNav__card--home"
              onClick={() => onNavigate(null)}
              type="button"
              title="Volver al inicio"
            >
              <div className="storeCategoryNav__cardIcon">
                <Home size={28} />
              </div>
              <span className="storeCategoryNav__cardName">Inicio</span>
            </button>
          )}
          
          {/* Botón volver al nivel anterior */}
          {currentCategoryId !== null && currentCategory?.parentId && (
            <button 
              className="storeCategoryNav__card storeCategoryNav__card--back"
              onClick={() => {
                onNavigate(currentCategory.parentId)
              }}
              type="button"
            >
              <div className="storeCategoryNav__cardIcon">
                <ChevronRight size={24} style={{ transform: 'rotate(180deg)' }} />
              </div>
              <span className="storeCategoryNav__cardName">Volver</span>
            </button>
          )}

          {/* Categorías */}
          {currentLevelCategories.map(category => {
            const productCount = getProductCount(category.id)
            const hasChildren = hasSubcategories(category.id)
            const hasImage = category.imageUrl && category.imageUrl.trim() !== ''

            return (
              <div key={category.id} className="storeCategoryNav__cardWrapper">
                <button
                  className="storeCategoryNav__card"
                  onClick={() => onNavigate(category.id)}
                  type="button"
                >
                  {/* Imagen o placeholder */}
                  <div className="storeCategoryNav__cardImage">
                    {hasImage ? (
                      <img 
                        src={category.imageUrl} 
                        alt={category.name}
                        loading="lazy"
                      />
                    ) : (
                      <div className="storeCategoryNav__cardPlaceholder">
                        {category.icon ? (
                          <span className="storeCategoryNav__cardEmoji">{category.icon}</span>
                        ) : (
                          <Folder size={36} />
                        )}
                      </div>
                    )}

                    {/* Badge */}
                    {productCount > 0 && (
                      <span className="storeCategoryNav__cardBadge">
                        {hasChildren ? <Folder size={10} /> : <Package size={10} />}
                        {productCount}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="storeCategoryNav__cardInfo">
                    <span className="storeCategoryNav__cardName">{category.name}</span>
                    {category.shortDescription && (
                      <span className="storeCategoryNav__cardDescription">
                        {category.shortDescription}
                      </span>
                    )}
                  </div>

                  {/* Indicador de navegación */}
                  <ChevronRight size={18} className="storeCategoryNav__cardChevron" />
                </button>
                
                {/* Admin actions */}
                {isAdmin && (
                  <div className="storeCategoryNav__adminActions">
                    {onEditCategory && (
                      <button
                        className="storeCategoryNav__adminBtn storeCategoryNav__adminBtn--edit"
                        onClick={(e) => {
                          e.stopPropagation()
                          onEditCategory(category)
                        }}
                        type="button"
                        title="Editar categoría"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    {onDeleteCategory && (
                      <button
                        className="storeCategoryNav__adminBtn storeCategoryNav__adminBtn--delete"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm(`¿Eliminar la categoría "${category.name}"?`)) {
                            onDeleteCategory(category.id)
                          }
                        }}
                        type="button"
                        title="Eliminar categoría"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Categoría "Otros" para productos sin categoría */}
          {currentCategoryId === null && otrosProductCount > 0 && (
            <button
              className="storeCategoryNav__card storeCategoryNav__card--otros"
              onClick={() => onNavigate('__otros__')}
              type="button"
            >
              <div className="storeCategoryNav__cardImage">
                <div className="storeCategoryNav__cardPlaceholder">
                  <Package size={36} />
                </div>
                <span className="storeCategoryNav__cardBadge">
                  <Package size={10} />
                  {otrosProductCount}
                </span>
              </div>
              <div className="storeCategoryNav__cardInfo">
                <span className="storeCategoryNav__cardName">Otros</span>
                <span className="storeCategoryNav__cardDescription">
                  Productos sin categoría
                </span>
              </div>
              <ChevronRight size={18} className="storeCategoryNav__cardChevron" />
            </button>
          )}

          {/* Botón agregar categoría (admin only) */}
          {isAdmin && onCreateCategory && (
            <button
              className="storeCategoryNav__card storeCategoryNav__card--add"
              onClick={() => onCreateCategory(currentCategoryId)}
              type="button"
            >
              <div className="storeCategoryNav__cardImage">
                <div className="storeCategoryNav__cardPlaceholder storeCategoryNav__cardPlaceholder--add">
                  <Plus size={36} />
                </div>
              </div>
              <div className="storeCategoryNav__cardInfo">
                <span className="storeCategoryNav__cardName">
                  {currentCategoryId ? 'Nueva subcategoría' : 'Nueva categoría'}
                </span>
              </div>
            </button>
          )}
        </div>
      )}

      {/* Título de sección si estamos en una categoría con productos */}
      {currentCategoryId !== null && currentLevelCategories.length === 0 && (
        <div className="storeCategoryNav__currentTitle">
          {currentCategory?.icon && <span>{currentCategory.icon}</span>}
          <h2>{currentCategory?.name || 'Productos'}</h2>
        </div>
      )}
    </nav>
  )
}

/**
 * StoreCategoryChips - Versión compacta con chips horizontales
 */
export function StoreCategoryChips({
  tenantId,
  currentCategoryId = null,
  onNavigate,
  showAll = true,
}) {
  const allCategories = useAppSelector(selectCategoriesForTenant(tenantId))
  const allProducts = useAppSelector(selectProductsForTenant(tenantId))

  // Obtener categorías del nivel actual
  const currentLevelCategories = useMemo(() => {
    return allCategories
      .filter(c => {
        if (currentCategoryId === null) {
          return (c.parentId === null || c.parentId === undefined) && c.active
        }
        return c.parentId === currentCategoryId && c.active
      })
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
  }, [allCategories, currentCategoryId])

  // Contar productos
  const getProductCount = (categoryId) => {
    if (categoryId === null) {
      return allProducts.filter(p => p.active).length
    }
    return allProducts.filter(p => 
      (p.categoryId === categoryId || p.subcategoryId === categoryId) && p.active
    ).length
  }

  if (currentLevelCategories.length === 0) return null

  return (
    <div className="storeCategoryChips">
      {/* All option */}
      {showAll && currentCategoryId !== null && (
        <button
          className="storeCategoryChips__chip storeCategoryChips__chip--back"
          onClick={() => onNavigate(null)}
          type="button"
        >
          <Home size={14} />
          <span>Todas</span>
        </button>
      )}

      {/* Categories */}
      {currentLevelCategories.map(category => (
        <button
          key={category.id}
          className={`storeCategoryChips__chip ${currentCategoryId === category.id ? 'storeCategoryChips__chip--active' : ''}`}
          onClick={() => onNavigate(category.id)}
          type="button"
        >
          {category.icon && <span className="storeCategoryChips__chipIcon">{category.icon}</span>}
          <span>{category.name}</span>
          <span className="storeCategoryChips__chipCount">{getProductCount(category.id)}</span>
        </button>
      ))}
    </div>
  )
}
