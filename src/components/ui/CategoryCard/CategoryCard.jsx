import { Folder, FolderOpen, Package, ChevronRight, Plus, Edit2, Trash2, Lock, Image as ImageIcon } from 'lucide-react'
import './CategoryCard.css'

/**
 * CategoryCard - Card visual para categorías/subcategorías
 * 
 * Diseño tipo carpetas:
 * - Muestra imagen de la categoría si existe
 * - Iconos visuales que indican si tiene productos o subcategorías
 * - Acciones de editar/eliminar para admins
 */
export default function CategoryCard({
  category,
  onClick,
  onEdit,
  onDelete,
  onAddProduct,
  onAddSubcategory,
  isAdmin = false,
  productCount = 0,
  childrenCount = 0,
  showActions = true,
  size = 'medium', // 'small' | 'medium' | 'large'
  variant = 'default', // 'default' | 'add' | 'back'
}) {
  // Determinar basándose en conteos reales
  const canHaveProducts = childrenCount === 0
  // Puede tener subcategorías: si ya tiene hijos O si no tiene productos
  const canHaveChildren = childrenCount > 0 || productCount === 0

  // Variante especial: botón "Agregar"
  if (variant === 'add') {
    return (
      <button 
        className={`categoryCard categoryCard--add categoryCard--${size}`}
        onClick={onClick}
        type="button"
      >
        <div className="categoryCard__addIcon">
          <Plus size={32} />
        </div>
        <span className="categoryCard__addText">
          {category?.parentId ? 'Nueva subcategoría' : 'Nueva categoría'}
        </span>
      </button>
    )
  }

  // Variante especial: botón "Volver"
  if (variant === 'back') {
    return (
      <button 
        className={`categoryCard categoryCard--back categoryCard--${size}`}
        onClick={onClick}
        type="button"
      >
        <div className="categoryCard__backIcon">
          <ChevronRight size={24} style={{ transform: 'rotate(180deg)' }} />
        </div>
        <span className="categoryCard__backText">Volver</span>
      </button>
    )
  }

  if (!category) return null

  const hasImage = category.imageUrl && category.imageUrl.trim() !== ''

  return (
    <div className={`categoryCard categoryCard--${size}`}>
      {/* Imagen o placeholder */}
      <button 
        className="categoryCard__imageWrapper"
        onClick={onClick}
        type="button"
      >
        {hasImage ? (
          <img 
            src={category.imageUrl} 
            alt={category.name}
            className="categoryCard__image"
            loading="lazy"
            style={category.focalPoint ? { objectPosition: `${category.focalPoint.x}% ${category.focalPoint.y}%` } : undefined}
          />
        ) : (
          <div className="categoryCard__placeholder">
            {category.icon ? (
              <span className="categoryCard__emoji">{category.icon}</span>
            ) : category.hasChildren || childrenCount > 0 ? (
              <FolderOpen size={48} />
            ) : (
              <Folder size={48} />
            )}
          </div>
        )}

        {/* Badge de conteo */}
        {(productCount > 0 || childrenCount > 0) && (
          <div className="categoryCard__badge">
            {childrenCount > 0 ? (
              <>
                <Folder size={12} />
                <span>{childrenCount}</span>
              </>
            ) : (
              <>
                <Package size={12} />
                <span>{productCount}</span>
              </>
            )}
          </div>
        )}

        {/* Indicador de tipo */}
        {!canHaveProducts && (
          <div className="categoryCard__typeIndicator categoryCard__typeIndicator--folder" title="Contiene subcategorías">
            <FolderOpen size={14} />
          </div>
        )}
        {!canHaveChildren && productCount > 0 && (
          <div className="categoryCard__typeIndicator categoryCard__typeIndicator--products" title="Contiene productos">
            <Package size={14} />
          </div>
        )}
      </button>

      {/* Info */}
      <div className="categoryCard__info">
        <h3 className="categoryCard__name">{category.name}</h3>
        {category.shortDescription && (
          <p className="categoryCard__description">{category.shortDescription}</p>
        )}
      </div>

      {/* Acciones admin */}
      {isAdmin && showActions && (
        <div className="categoryCard__actions">
          {/* Agregar producto (solo si puede) */}
          {canHaveProducts && onAddProduct && (
            <button 
              className="categoryCard__action categoryCard__action--add"
              onClick={(e) => { e.stopPropagation(); onAddProduct(category); }}
              title="Agregar producto"
              type="button"
            >
              <Plus size={14} />
              <Package size={14} />
            </button>
          )}
          
          {/* Agregar subcategoría (solo si puede) */}
          {canHaveChildren && onAddSubcategory && (
            <button 
              className="categoryCard__action categoryCard__action--folder"
              onClick={(e) => { e.stopPropagation(); onAddSubcategory(category); }}
              title="Agregar subcategoría"
              type="button"
            >
              <Plus size={14} />
              <Folder size={14} />
            </button>
          )}

          {/* No puede hacer nada (bloqueado) */}
          {!canHaveProducts && !canHaveChildren && (
            <div 
              className="categoryCard__action categoryCard__action--locked"
              title="Esta categoría tiene subcategorías y productos"
            >
              <Lock size={14} />
            </div>
          )}

          {/* Editar */}
          {onEdit && (
            <button 
              className="categoryCard__action categoryCard__action--edit"
              onClick={(e) => { e.stopPropagation(); onEdit(category); }}
              title="Editar categoría"
              type="button"
            >
              <Edit2 size={14} />
            </button>
          )}

          {/* Eliminar */}
          {onDelete && (
            <button 
              className="categoryCard__action categoryCard__action--delete"
              onClick={(e) => { e.stopPropagation(); onDelete(category); }}
              title="Eliminar categoría"
              type="button"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}

      {/* Chevron para indicar que es navegable */}
      <button 
        className="categoryCard__chevron"
        onClick={onClick}
        type="button"
        aria-label={`Ir a ${category.name}`}
      >
        <ChevronRight size={20} />
      </button>
    </div>
  )
}

/**
 * AddProductCard - Card especial para agregar producto
 */
export function AddProductCard({ onClick, disabled = false, size = 'medium' }) {
  return (
    <button 
      className={`categoryCard categoryCard--addProduct categoryCard--${size} ${disabled ? 'categoryCard--disabled' : ''}`}
      onClick={onClick}
      disabled={disabled}
      type="button"
    >
      <div className="categoryCard__addIcon">
        <Plus size={28} />
      </div>
      <span className="categoryCard__addText">Agregar producto</span>
      {disabled && (
        <span className="categoryCard__disabledText">
          <Lock size={12} /> Esta categoría tiene subcategorías
        </span>
      )}
    </button>
  )
}
