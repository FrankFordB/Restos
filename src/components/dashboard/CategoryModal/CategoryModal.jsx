import { useState, useEffect, useRef } from 'react'
import ImageUploaderWithEditor from '../../ui/ImageUploaderWithEditor/ImageUploaderWithEditor'
import { 
  X, 
  Folder, 
  FolderPlus,
  Upload, 
  Link2, 
  Image as ImageIcon,
  AlertTriangle,
  Check,
  Loader2,
  Eye,
  EyeOff,
  Crop,
} from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../../app/hooks'
import { 
  createCategory, 
  patchCategory,
  selectCategoriesForTenant,
} from '../../../features/categories/categoriesSlice'
import { selectProductsForTenant } from '../../../features/products/productsSlice'
import { uploadCategoryImage } from '../../../lib/supabaseStorage'
import { isSupabaseConfigured } from '../../../lib/supabaseClient'
import Button from '../../ui/Button/Button'
import Input from '../../ui/Input/Input'
import './CategoryModal.css'

/**
 * CategoryModal - Modal para crear/editar categorías y subcategorías
 * 
 * Incluye:
 * - Nombre (obligatorio)
 * - Imagen (subir o URL)
 * - Descripción corta
 * - Icono (emoji)
 * - Estado (visible/oculta)
 */
export default function CategoryModal({
  isOpen,
  onClose,
  tenantId,
  category = null, // Si existe, estamos editando
  parentId = null, // Si existe, estamos creando subcategoría
}) {
  const dispatch = useAppDispatch()
  const allCategories = useAppSelector(selectCategoriesForTenant(tenantId))
  const allProducts = useAppSelector(selectProductsForTenant(tenantId))
  
  const uploaderRef = useRef(null)

  // Obtener categoría padre si existe
  const parentCategory = parentId 
    ? allCategories.find(c => c.id === parentId) 
    : null

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    shortDescription: '',
    icon: '',
    active: true,
    imageUrl: '',
  })

  const [imageMode, setImageMode] = useState('upload') // 'upload' | 'url'
  const [imagePreview, setImagePreview] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [imageFocalPoint, setImageFocalPoint] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [warning, setWarning] = useState(null)

  // Verificar reglas de carpetas
  useEffect(() => {
    if (!isOpen) return
    
    // Si estamos creando subcategoría, verificar reglas
    if (parentId && !category) {
      // Obtener subcategorías existentes del padre
      const existingSubcategories = allCategories.filter(c => c.parentId === parentId)
      const hasExistingSubcategories = existingSubcategories.length > 0
      
      // REGLA: Si ya hay subcategorías, SIEMPRE permitir crear más
      if (hasExistingSubcategories) {
        setWarning(null)
      } else {
        // No hay subcategorías aún - verificar si tiene productos directos
        const parentHasDirectProducts = allProducts.some(p => {
          if (p.categoryId === parentId && !p.subcategoryId) {
            return true
          }
          if (p.category === parentCategory?.name && !p.subcategoryId && !p.categoryId) {
            return true
          }
          return false
        })
        
        if (parentHasDirectProducts) {
          setWarning('Esta categoría tiene productos directos. Deberás moverlos a una subcategoría primero.')
        } else {
          setWarning(null)
        }
      }
    } else {
      setWarning(null)
    }
  }, [isOpen, parentId, parentCategory, allProducts, allCategories, category])

  // Inicializar form cuando se abre el modal
  useEffect(() => {
    if (!isOpen) return

    if (category) {
      // Modo edición
      setFormData({
        name: category.name || '',
        shortDescription: category.shortDescription || '',
        icon: category.icon || '',
        active: category.active ?? true,
        imageUrl: category.imageUrl || '',
      })
      setImagePreview(category.imageUrl || null)
      setImageFocalPoint(category.focalPoint || null)
    } else {
      // Modo creación
      setFormData({
        name: '',
        shortDescription: '',
        icon: '',
        active: true,
        imageUrl: '',
      })
      setImagePreview(null)
    }

    setImageFile(null)
    // Solo resetear focalPoint en modo creación (en edición ya se asignó arriba)
    if (!category) {
      setImageFocalPoint(null)
    }
    setError(null)
  }, [isOpen, category])

  // Manejar cambio de input genérico
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // Manejar imagen editada desde ImageUploaderWithEditor
  const handleImageReady = (file, focalPoint) => {
    if (file) {
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
    if (focalPoint) {
      setImageFocalPoint(focalPoint)
    }
    setError(null)
  }

  // Manejar cambio de URL de imagen
  const handleImageUrlChange = (url) => {
    setFormData(prev => ({ ...prev, imageUrl: url }))
    setImagePreview(url || null)
    setImageFile(null)
  }

  // Validar formulario
  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('El nombre es obligatorio')
      return false
    }

    // Verificar nombre duplicado
    const duplicate = allCategories.find(c => 
      c.name.toLowerCase() === formData.name.trim().toLowerCase() &&
      c.id !== category?.id &&
      c.parentId === (category?.parentId ?? parentId ?? null)
    )
    
    if (duplicate) {
      setError('Ya existe una categoría con ese nombre en este nivel')
      return false
    }

    return true
  }

  // Guardar categoría
  const handleSave = async () => {
    if (!validateForm()) return

    setSaving(true)
    setError(null)

    try {
      let finalImageUrl = formData.imageUrl

      // Subir imagen si hay archivo seleccionado
      if (imageFile && isSupabaseConfigured) {
        setUploading(true)
        try {
          finalImageUrl = await uploadCategoryImage({ 
            tenantId, 
            categoryId: category?.id || null, 
            file: imageFile 
          })
        } catch (uploadError) {
          console.error('Error uploading image:', uploadError)
          setError('Error al subir la imagen. La categoría se guardará sin imagen.')
          finalImageUrl = ''
        }
        setUploading(false)
      }

      const categoryData = {
        name: formData.name.trim(),
        shortDescription: formData.shortDescription.trim() || null,
        icon: formData.icon.trim() || null,
        active: formData.active,
        imageUrl: finalImageUrl || null,
        focalPoint: imageFocalPoint || null,
      }

      if (category) {
        // Editar categoría existente
        await dispatch(patchCategory({
          tenantId,
          categoryId: category.id,
          patch: {
            name: categoryData.name,
            shortDescription: categoryData.shortDescription,
            icon: categoryData.icon,
            active: categoryData.active,
            imageUrl: categoryData.imageUrl,
            focalPoint: categoryData.focalPoint,
          },
        })).unwrap()
      } else {
        // Crear nueva categoría/subcategoría
        await dispatch(createCategory({
          tenantId,
          category: {
            ...categoryData,
            parentId: parentId || null,
          },
        })).unwrap()
      }

      onClose()
    } catch (err) {
      setError(err?.message || 'Error al guardar la categoría')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const isSubcategory = parentId != null || (category?.parentId != null)
  const title = category 
    ? `Editar ${isSubcategory ? 'subcategoría' : 'categoría'}` 
    : `Nueva ${isSubcategory ? 'subcategoría' : 'categoría'}`

  return (
    <div className="categoryModal__overlay">
      <div className="categoryModal">
        {/* Header */}
        <div className="categoryModal__header">
          <h2 className="categoryModal__title">
            {isSubcategory ? <FolderPlus size={20} /> : <Folder size={20} />}
            {title}
          </h2>
          <button 
            className="categoryModal__close" 
            onClick={onClose}
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="categoryModal__content">
          {/* Parent info */}
          {parentCategory && !category && (
            <div className="categoryModal__parentInfo">
              <span>Dentro de:</span>
              <strong>
                {parentCategory.icon && <span>{parentCategory.icon}</span>}
                {parentCategory.name}
              </strong>
            </div>
          )}

          {/* Warning */}
          {warning && (
            <div className="categoryModal__warning">
              <AlertTriangle size={16} />
              {warning}
            </div>
          )}

          {/* Nombre */}
          <div className="categoryModal__field">
            <label className="categoryModal__label">
              Nombre <span className="categoryModal__required">*</span>
            </label>
            <Input
              value={formData.name}
              onChange={(v) => handleChange('name', v)}
              placeholder={isSubcategory ? "Ej: Pollo, Vegetarianas..." : "Ej: Hamburguesas, Bebidas..."}
              autoFocus
            />
          </div>

          {/* Descripción corta */}
          <div className="categoryModal__field">
            <label className="categoryModal__label">
              Descripción corta
              <span className="categoryModal__hint">(se muestra en la card)</span>
            </label>
            <Input
              value={formData.shortDescription}
              onChange={(v) => handleChange('shortDescription', v)}
              placeholder="Breve descripción..."
              maxLength={100}
            />
          </div>

          {/* Icono (emoji) */}
          <div className="categoryModal__field">
            <label className="categoryModal__label">
              Icono
              <span className="categoryModal__hint">(emoji opcional)</span>
            </label>
            <Input
              value={formData.icon}
              onChange={(v) => handleChange('icon', v)}
              placeholder="🍔 🥤 🍕"
              maxLength={4}
              className="categoryModal__iconInput"
            />
          </div>

          {/* Estado */}
          <div className="categoryModal__field">
            <label className="categoryModal__checkbox">
              <input
                type="checkbox"
                checked={formData.active}
                onChange={(e) => handleChange('active', e.target.checked)}
              />
              {formData.active ? <Eye size={16} /> : <EyeOff size={16} />}
              <span>{formData.active ? 'Visible en la tienda' : 'Oculta (no visible)'}</span>
            </label>
          </div>

          {/* Imagen */}
          <div className="categoryModal__field">
            <label className="categoryModal__label">
              <ImageIcon size={14} />
              Imagen de la categoría
              <span className="categoryModal__hint">(recomendado)</span>
            </label>
            
            {/* Tabs para tipo de imagen */}
            <div className="categoryModal__imageTabs">
              <button
                className={`categoryModal__imageTab ${imageMode === 'upload' ? 'categoryModal__imageTab--active' : ''}`}
                onClick={() => setImageMode('upload')}
                type="button"
              >
                <Upload size={14} />
                Subir archivo
              </button>
              <button
                className={`categoryModal__imageTab ${imageMode === 'url' ? 'categoryModal__imageTab--active' : ''}`}
                onClick={() => setImageMode('url')}
                type="button"
              >
                <Link2 size={14} />
                Pegar URL
              </button>
            </div>

            {imageMode === 'upload' ? (
              <div className="categoryModal__uploadArea">
                {imagePreview ? (
                  <div className="categoryModal__imagePreview">
                    <img 
                      src={imagePreview} 
                      alt="Preview"
                      style={imageFocalPoint ? { objectFit: 'cover', objectPosition: `${imageFocalPoint.x}% ${imageFocalPoint.y}%` } : undefined}
                    />
                    <div className="categoryModal__imageActions">
                      <button
                        className="categoryModal__changeImage"
                        type="button"
                        title="Re-editar encuadre"
                        onClick={() => uploaderRef.current?.openEditor(imagePreview)}
                      >
                        <Crop size={14} />
                        Editar
                      </button>
                      <ImageUploaderWithEditor
                        ref={uploaderRef}
                        aspect={16 / 9}
                        modalTitle="Editar imagen de categoría"
                        onImageReady={handleImageReady}
                      >
                        <button 
                          className="categoryModal__changeImage"
                          type="button"
                          title="Subir nueva imagen"
                        >
                          <Upload size={14} />
                          Cambiar
                        </button>
                      </ImageUploaderWithEditor>
                      <button 
                        className="categoryModal__removeImage"
                        onClick={() => {
                          setImagePreview(null)
                          setImageFile(null)
                          handleChange('imageUrl', '')
                        }}
                        type="button"
                        title="Eliminar imagen"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <ImageUploaderWithEditor
                    ref={uploaderRef}
                    aspect={16 / 9}
                    modalTitle="Editar imagen de categoría"
                    onImageReady={handleImageReady}
                  >
                    <button 
                      className="categoryModal__uploadButton"
                      type="button"
                    >
                      <Upload size={24} />
                      <span>Click para subir imagen</span>
                      <span className="categoryModal__uploadHint">PNG, JPG hasta 5MB</span>
                    </button>
                  </ImageUploaderWithEditor>
                )}
              </div>
            ) : (
              <div className="categoryModal__urlInput">
                <Input
                  value={formData.imageUrl}
                  onChange={handleImageUrlChange}
                  placeholder="https://ejemplo.com/imagen.jpg"
                />
                {imagePreview && formData.imageUrl && (
                  <div className="categoryModal__urlPreview">
                    <img src={imagePreview} alt="Preview" onError={() => setImagePreview(null)} />
                    <button
                      type="button"
                      className="categoryModal__changeImage"
                      onClick={() => uploaderRef.current?.openEditor(formData.imageUrl)}
                    >
                      <Crop size={14} /> Ajustar encuadre
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="categoryModal__error">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="categoryModal__footer">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 size={16} className="categoryModal__spinner" />
                {uploading ? 'Subiendo imagen...' : 'Guardando...'}
              </>
            ) : (
              <>
                <Check size={16} />
                {category ? 'Guardar cambios' : 'Crear'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
