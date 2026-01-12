import { useState, useMemo } from 'react'
import { ChevronRight, ChevronDown, Folder, FolderOpen, Plus, Edit2, Trash2, MoreVertical, GripVertical } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../../app/hooks'
import { 
  selectCategoriesForTenant, 
  selectRootCategories,
  createCategory, 
  patchCategory, 
  deleteCategory 
} from '../../../features/categories/categoriesSlice'
import Button from '../../ui/Button/Button'
import Input from '../../ui/Input/Input'
import Card from '../../ui/Card/Card'
import './CategoryTreeManager.css'

export default function CategoryTreeManager({ tenantId, onSelectCategory, selectedCategoryId }) {
  const dispatch = useAppDispatch()
  const allCategories = useAppSelector(selectCategoriesForTenant(tenantId))
  const rootCategories = useAppSelector(selectRootCategories(tenantId))
  
  const [expandedIds, setExpandedIds] = useState(new Set())
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [parentIdForNew, setParentIdForNew] = useState(null)
  const [editingCategory, setEditingCategory] = useState(null)
  const [formData, setFormData] = useState({ name: '', description: '', icon: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Obtener hijos de una categoría
  const getChildren = (parentId) => {
    return allCategories
      .filter(c => c.parentId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  // Toggle expandir/colapsar
  const toggleExpand = (categoryId) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  // Abrir modal para crear
  const openCreateModal = (parentId = null) => {
    setParentIdForNew(parentId)
    setFormData({ name: '', description: '', icon: '' })
    setError(null)
    setShowCreateModal(true)
  }

  // Abrir modal para editar
  const openEditModal = (category) => {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      description: category.description || '',
      icon: category.icon || ''
    })
    setError(null)
    setShowEditModal(true)
  }

  // Crear categoría
  const handleCreate = async () => {
    if (!formData.name.trim()) return
    setSaving(true)
    setError(null)
    
    try {
      await dispatch(createCategory({
        tenantId,
        category: {
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          icon: formData.icon.trim() || null,
          parentId: parentIdForNew,
          sortOrder: getChildren(parentIdForNew).length,
        }
      })).unwrap()
      
      setShowCreateModal(false)
      
      // Expandir padre si existe
      if (parentIdForNew) {
        setExpandedIds(prev => new Set([...prev, parentIdForNew]))
      }
    } catch (e) {
      setError(e?.message || 'Error al crear categoría')
    } finally {
      setSaving(false)
    }
  }

  // Editar categoría
  const handleEdit = async () => {
    if (!formData.name.trim() || !editingCategory) return
    setSaving(true)
    setError(null)
    
    try {
      await dispatch(patchCategory({
        tenantId,
        categoryId: editingCategory.id,
        patch: {
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          icon: formData.icon.trim() || null,
        }
      })).unwrap()
      
      setShowEditModal(false)
      setEditingCategory(null)
    } catch (e) {
      setError(e?.message || 'Error al editar categoría')
    } finally {
      setSaving(false)
    }
  }

  // Eliminar categoría
  const handleDelete = async (category) => {
    const hasChildren = getChildren(category.id).length > 0
    
    if (hasChildren) {
      alert('No puedes eliminar una categoría que tiene subcategorías. Elimina primero las subcategorías.')
      return
    }
    
    const confirmed = window.confirm(`¿Eliminar la categoría "${category.name}"?`)
    if (!confirmed) return
    
    try {
      await dispatch(deleteCategory({
        tenantId,
        categoryId: category.id
      })).unwrap()
    } catch (e) {
      alert(e?.message || 'Error al eliminar categoría')
    }
  }

  // Renderizar item del árbol
  const renderTreeItem = (category, depth = 0) => {
    const children = getChildren(category.id)
    const hasChildren = children.length > 0
    const isExpanded = expandedIds.has(category.id)
    const isSelected = selectedCategoryId === category.id

    return (
      <div key={category.id} className="categoryTree__item">
        <div 
          className={`categoryTree__row ${isSelected ? 'categoryTree__row--selected' : ''}`}
          style={{ paddingLeft: `${depth * 24 + 8}px` }}
        >
          {/* Expand/Collapse button */}
          <button 
            className="categoryTree__expandBtn"
            onClick={() => hasChildren && toggleExpand(category.id)}
            disabled={!hasChildren}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
            ) : (
              <span style={{ width: 16 }} />
            )}
          </button>

          {/* Icon */}
          <span className="categoryTree__icon">
            {category.icon || (isExpanded ? <FolderOpen size={18} /> : <Folder size={18} />)}
          </span>

          {/* Name - clickable */}
          <span 
            className="categoryTree__name"
            onClick={() => onSelectCategory?.(category)}
          >
            {category.name}
            {category.level > 0 && (
              <span className="categoryTree__level">Nivel {category.level}</span>
            )}
          </span>

          {/* Actions */}
          <div className="categoryTree__actions">
            <button 
              className="categoryTree__actionBtn" 
              onClick={() => openCreateModal(category.id)}
              title="Agregar subcategoría"
            >
              <Plus size={14} />
            </button>
            <button 
              className="categoryTree__actionBtn" 
              onClick={() => openEditModal(category)}
              title="Editar"
            >
              <Edit2 size={14} />
            </button>
            <button 
              className="categoryTree__actionBtn categoryTree__actionBtn--danger" 
              onClick={() => handleDelete(category)}
              title="Eliminar"
              disabled={hasChildren}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="categoryTree__children">
            {children.map(child => renderTreeItem(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  const sortedRootCategories = useMemo(() => {
    return [...rootCategories].sort((a, b) => a.sortOrder - b.sortOrder)
  }, [rootCategories])

  return (
    <div className="categoryTree">
      {/* Header */}
      <div className="categoryTree__header">
        <h4 className="categoryTree__title">
          <Folder size={18} /> Categorías
        </h4>
        <Button 
          size="sm" 
          onClick={() => openCreateModal(null)}
        >
          <Plus size={14} /> Nueva
        </Button>
      </div>

      {/* Tree */}
      <div className="categoryTree__list">
        {sortedRootCategories.length === 0 ? (
          <div className="categoryTree__empty">
            <Folder size={32} />
            <p>No hay categorías</p>
            <Button size="sm" onClick={() => openCreateModal(null)}>
              Crear primera categoría
            </Button>
          </div>
        ) : (
          sortedRootCategories.map(category => renderTreeItem(category, 0))
        )}
      </div>

      {/* Modal Crear */}
      {showCreateModal && (
        <div className="categoryTree__modal" onClick={(e) => e.target === e.currentTarget && setShowCreateModal(false)}>
          <Card 
            title={parentIdForNew ? 'Crear subcategoría' : 'Crear categoría'}
            className="categoryTree__modalCard"
          >
            {parentIdForNew && (
              <div className="categoryTree__parentInfo">
                Dentro de: <strong>{allCategories.find(c => c.id === parentIdForNew)?.name}</strong>
              </div>
            )}
            
            <div className="categoryTree__form">
              <Input
                label="Nombre *"
                value={formData.name}
                onChange={(v) => setFormData(prev => ({ ...prev, name: v }))}
                placeholder="Ej: Remeras, Hombres..."
                autoFocus
              />
              
              <Input
                label="Descripción"
                value={formData.description}
                onChange={(v) => setFormData(prev => ({ ...prev, description: v }))}
                placeholder="Descripción opcional"
              />
              
              <Input
                label="Icono (emoji)"
                value={formData.icon}
                onChange={(v) => setFormData(prev => ({ ...prev, icon: v }))}
                placeholder="Ej: 👕 🍕 🥤"
                maxLength={4}
              />
              
              {error && <div className="categoryTree__error">{error}</div>}
              
              <div className="categoryTree__formActions">
                <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreate} disabled={!formData.name.trim() || saving}>
                  {saving ? 'Guardando...' : 'Crear'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Modal Editar */}
      {showEditModal && editingCategory && (
        <div className="categoryTree__modal" onClick={(e) => e.target === e.currentTarget && setShowEditModal(false)}>
          <Card 
            title={`Editar: ${editingCategory.name}`}
            className="categoryTree__modalCard"
          >
            <div className="categoryTree__form">
              <Input
                label="Nombre *"
                value={formData.name}
                onChange={(v) => setFormData(prev => ({ ...prev, name: v }))}
                autoFocus
              />
              
              <Input
                label="Descripción"
                value={formData.description}
                onChange={(v) => setFormData(prev => ({ ...prev, description: v }))}
              />
              
              <Input
                label="Icono (emoji)"
                value={formData.icon}
                onChange={(v) => setFormData(prev => ({ ...prev, icon: v }))}
                maxLength={4}
              />
              
              {error && <div className="categoryTree__error">{error}</div>}
              
              <div className="categoryTree__formActions">
                <Button variant="ghost" onClick={() => setShowEditModal(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleEdit} disabled={!formData.name.trim() || saving}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

// Componente para selector de categoría con árbol
export function CategoryTreeSelect({ 
  tenantId, 
  value, 
  onChange, 
  label = 'Categoría',
  placeholder = 'Seleccionar categoría...',
  allowSubcategories = true,
  showOnlyLeaves = false // Solo mostrar categorías sin hijos
}) {
  const allCategories = useAppSelector(selectCategoriesForTenant(tenantId))
  const rootCategories = useAppSelector(selectRootCategories(tenantId))
  
  const [isOpen, setIsOpen] = useState(false)
  const [expandedIds, setExpandedIds] = useState(new Set())

  const selectedCategory = allCategories.find(c => c.id === value || c.name === value)

  const getChildren = (parentId) => {
    return allCategories
      .filter(c => c.parentId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  const toggleExpand = (categoryId, e) => {
    e.stopPropagation()
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  const handleSelect = (category) => {
    const hasChildren = getChildren(category.id).length > 0
    
    // Si showOnlyLeaves y tiene hijos, expandir en vez de seleccionar
    if (showOnlyLeaves && hasChildren) {
      setExpandedIds(prev => new Set([...prev, category.id]))
      return
    }
    
    // Si no permite subcategorías y tiene hijos, expandir
    if (!allowSubcategories && hasChildren) {
      setExpandedIds(prev => new Set([...prev, category.id]))
      return
    }
    
    onChange(category.name) // Usar nombre para compatibilidad con productos actuales
    setIsOpen(false)
  }

  // Obtener breadcrumb del valor seleccionado
  const getBreadcrumb = (category) => {
    if (!category) return ''
    const parts = []
    let current = category
    while (current) {
      parts.unshift(current.name)
      current = current.parentId ? allCategories.find(c => c.id === current.parentId) : null
    }
    return parts.join(' > ')
  }

  const renderOption = (category, depth = 0) => {
    const children = getChildren(category.id)
    const hasChildren = children.length > 0
    const isExpanded = expandedIds.has(category.id)
    const isSelected = selectedCategory?.id === category.id
    const isDisabled = showOnlyLeaves && hasChildren

    return (
      <div key={category.id}>
        <div 
          className={`categorySelect__option ${isSelected ? 'categorySelect__option--selected' : ''} ${isDisabled ? 'categorySelect__option--disabled' : ''}`}
          style={{ paddingLeft: `${depth * 20 + 12}px` }}
          onClick={() => handleSelect(category)}
        >
          {hasChildren && (
            <button 
              className="categorySelect__expandBtn"
              onClick={(e) => toggleExpand(category.id, e)}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          )}
          <span className="categorySelect__icon">
            {category.icon || (hasChildren ? <Folder size={14} /> : <span>📄</span>)}
          </span>
          <span className="categorySelect__name">{category.name}</span>
        </div>
        
        {hasChildren && isExpanded && (
          <div className="categorySelect__children">
            {children.map(child => renderOption(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="categorySelect">
      {label && <label className="categorySelect__label">{label}</label>}
      
      <div 
        className={`categorySelect__trigger ${isOpen ? 'categorySelect__trigger--open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedCategory ? (
          <span className="categorySelect__value">
            {selectedCategory.icon && <span>{selectedCategory.icon}</span>}
            {getBreadcrumb(selectedCategory)}
          </span>
        ) : (
          <span className="categorySelect__placeholder">{placeholder}</span>
        )}
        <ChevronDown size={16} className={`categorySelect__arrow ${isOpen ? 'categorySelect__arrow--open' : ''}`} />
      </div>

      {isOpen && (
        <>
          <div className="categorySelect__backdrop" onClick={() => setIsOpen(false)} />
          <div className="categorySelect__dropdown">
            {/* Opción para limpiar */}
            <div 
              className="categorySelect__option categorySelect__option--clear"
              onClick={() => { onChange(''); setIsOpen(false); }}
            >
              Sin categoría
            </div>
            
            {rootCategories
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map(category => renderOption(category, 0))
            }
          </div>
        </>
      )}
    </div>
  )
}
