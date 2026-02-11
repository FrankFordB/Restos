import { useState, useRef, useEffect, useMemo } from 'react'
import { 
  X, 
  Upload, 
  Link2, 
  Package, 
  DollarSign, 
  Layers, 
  Image as ImageIcon,
  AlertTriangle,
  Check,
  Loader2,
  Infinity as InfinityIcon,
  Percent,
  Tag,
  Ruler,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  Sparkles,
} from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../../app/hooks'
import { 
  createProduct, 
  patchProduct,
} from '../../../features/products/productsSlice'
import { 
  selectCategoriesForTenant,
  selectLeafCategories,
} from '../../../features/categories/categoriesSlice'
import { uploadProductImage } from '../../../lib/supabaseStorage'
import { isSupabaseConfigured } from '../../../lib/supabaseClient'
import { fetchSizePresets } from '../../../lib/supabaseApi'
import Button from '../../ui/Button/Button'
import Input from '../../ui/Input/Input'
import { CategoryTreeSelect } from '../../dashboard/CategoryTreeManager/CategoryTreeManager'
import './ProductModal.css'

/**
 * ProductModal - Modal completo para crear/editar productos
 * 
 * Incluye:
 * - Nombre (obligatorio)
 * - Precio (obligatorio)
 * - Descripción
 * - Categoría/Subcategoría (select jerárquico)
 * - Precio de costo (opcional, para estadísticas)
 * - Stock (ilimitado o numérico)
 * - Imagen (subir o URL)
 */
export default function ProductModal({
  isOpen,
  onClose,
  tenantId,
  product = null, // Si existe, estamos editando
  defaultCategoryId = null, // Categoría preseleccionada (si venimos de una)
  defaultCategoryName = null,
}) {
  const dispatch = useAppDispatch()
  const allCategories = useAppSelector(selectCategoriesForTenant(tenantId))
  const leafCategories = useAppSelector(selectLeafCategories(tenantId))
  
  const fileInputRef = useRef(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    description: '',
    category: '',
    categoryId: null,
    subcategoryId: null,
    costPrice: '',
    stock: '',
    unlimitedStock: true,
    imageUrl: '',
    discount: '', // Porcentaje de descuento (0-100)
    hasSizes: false, // Si el producto tiene talles
    sizeRequired: true, // Si el cliente debe elegir un talle
    sizes: [], // Array de talles: [{id, name, priceModifier, active}]
  })

  const [imageMode, setImageMode] = useState('upload') // 'upload' | 'url'
  const [imagePreview, setImagePreview] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  
  // Size presets state
  const [sizePresets, setSizePresets] = useState([])
  const [loadingPresets, setLoadingPresets] = useState(false)
  const [showPresetDropdown, setShowPresetDropdown] = useState(false)

  // Load size presets
  useEffect(() => {
    if (!isOpen) return
    
    const loadPresets = async () => {
      setLoadingPresets(true)
      try {
        const presets = await fetchSizePresets(tenantId)
        setSizePresets(presets)
      } catch (err) {
        console.warn('Error loading size presets:', err)
      } finally {
        setLoadingPresets(false)
      }
    }
    
    loadPresets()
  }, [isOpen, tenantId])

  // Apply a preset to the sizes
  const applyPreset = (preset) => {
    const newSizes = preset.sizes.map((s, idx) => ({
      id: `size_${Date.now()}_${idx}`,
      name: s.name,
      priceModifier: s.priceModifier || 0,
      active: true,
    }))
    handleChange('sizes', newSizes)
    handleChange('hasSizes', true)
    setShowPresetDropdown(false)
  }

  // Determinar categoría preseleccionada
  const preselectedCategory = useMemo(() => {
    if (defaultCategoryId) {
      const cat = allCategories.find(c => c.id === defaultCategoryId)
      return cat || null
    }
    return null
  }, [defaultCategoryId, allCategories])

  // Inicializar form cuando se abre el modal
  useEffect(() => {
    if (!isOpen) return

    if (product) {
      // Modo edición
      setFormData({
        name: product.name || '',
        price: product.price?.toString() || '',
        description: product.description || '',
        category: product.category || '',
        categoryId: product.categoryId || null,
        subcategoryId: product.subcategoryId || null,
        costPrice: product.costPrice?.toString() || '',
        stock: product.stock?.toString() || '',
        unlimitedStock: product.stock === null || product.stock === undefined,
        imageUrl: product.imageUrl || '',
        discount: product.discount?.toString() || '',
        hasSizes: product.hasSizes || false,
        sizeRequired: product.sizeRequired !== false, // default true
        sizes: product.sizes || [],
      })
      setImagePreview(product.imageUrl || null)
    } else {
      // Modo creación
      let categoryName = defaultCategoryName || ''
      
      // Si hay categoría preseleccionada, usar su nombre
      if (preselectedCategory) {
        categoryName = preselectedCategory.name
      }

      setFormData({
        name: '',
        price: '',
        description: '',
        category: categoryName,
        categoryId: preselectedCategory?.parentId || defaultCategoryId || null,
        subcategoryId: preselectedCategory?.parentId ? defaultCategoryId : null,
        costPrice: '',
        stock: '',
        unlimitedStock: true,
        imageUrl: '',
        discount: '',
        hasSizes: false,
        sizeRequired: true,
        sizes: [],
      })
      setImagePreview(null)
    }

    setImageFile(null)
    setError(null)
  }, [isOpen, product, defaultCategoryId, defaultCategoryName, preselectedCategory])

  // Manejar cambio de input genérico
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // Manejar cambio de categoría desde el tree select
  const handleCategoryChange = (categoryName) => {
    // Encontrar la categoría por nombre
    const category = allCategories.find(c => c.name === categoryName)
    
    if (category) {
      // Determinar si es categoría padre o subcategoría
      if (category.parentId) {
        // Es subcategoría
        setFormData(prev => ({
          ...prev,
          category: categoryName,
          categoryId: category.parentId,
          subcategoryId: category.id,
        }))
      } else {
        // Es categoría raíz
        setFormData(prev => ({
          ...prev,
          category: categoryName,
          categoryId: category.id,
          subcategoryId: null,
        }))
      }
    } else {
      // Sin categoría
      setFormData(prev => ({
        ...prev,
        category: categoryName || '',
        categoryId: null,
        subcategoryId: null,
      }))
    }
  }

  // Manejar selección de archivo
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      setError('Solo se permiten archivos de imagen')
      return
    }

    // Validar tamaño (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen no puede superar 5MB')
      return
    }

    setImageFile(file)
    setError(null)

    // Preview
    const reader = new FileReader()
    reader.onload = (e) => setImagePreview(e.target?.result)
    reader.readAsDataURL(file)
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

    const price = parseFloat(formData.price)
    if (isNaN(price) || price < 0) {
      setError('El precio debe ser un número válido')
      return false
    }

    if (!formData.unlimitedStock) {
      const stock = parseInt(formData.stock)
      if (isNaN(stock) || stock < 0) {
        setError('El stock debe ser un número válido')
        return false
      }
    }

    if (formData.costPrice) {
      const cost = parseFloat(formData.costPrice)
      if (isNaN(cost) || cost < 0) {
        setError('El precio de costo debe ser un número válido')
        return false
      }
    }

    return true
  }

  // Guardar producto
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
          finalImageUrl = await uploadProductImage({ 
            tenantId, 
            productId: product?.id || `new_${Date.now()}`, 
            file: imageFile 
          })
        } catch (uploadError) {
          console.error('Error uploading image:', uploadError)
          setError('Error al subir la imagen. El producto se guardará sin imagen.')
          finalImageUrl = ''
        }
        setUploading(false)
      }

      const productData = {
        name: formData.name.trim(),
        price: parseFloat(formData.price),
        description: formData.description.trim() || null,
        category: formData.category || null,
        categoryId: formData.categoryId || null,
        subcategoryId: formData.subcategoryId || null,
        costPrice: formData.costPrice ? parseFloat(formData.costPrice) : null,
        stock: formData.unlimitedStock ? null : parseInt(formData.stock),
        imageUrl: finalImageUrl || null,
        active: true,
        discount: formData.discount ? parseFloat(formData.discount) : null,
        hasSizes: formData.hasSizes || false,
        sizeRequired: formData.sizeRequired !== false,
        sizes: formData.hasSizes ? formData.sizes : [],
      }

      if (product) {
        // Editar producto existente
        await dispatch(patchProduct({
          tenantId,
          productId: product.id,
          patch: productData,
        })).unwrap()
      } else {
        // Crear nuevo producto
        await dispatch(createProduct({
          tenantId,
          product: productData,
        })).unwrap()
      }

      onClose()
    } catch (err) {
      setError(err?.message || 'Error al guardar el producto')
    } finally {
      setSaving(false)
    }
  }

  // Verificar si la categoría está bloqueada (viene preseleccionada)
  const isCategoryLocked = preselectedCategory && !product

  if (!isOpen) return null

  return (
    <div className="productModal__overlay">
      <div className="productModal">
        {/* Header */}
        <div className="productModal__header">
          <h2 className="productModal__title">
            <Package size={20} />
            {product ? 'Editar producto' : 'Nuevo producto'}
          </h2>
          <button 
            className="productModal__close" 
            onClick={onClose}
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="productModal__content">
          {/* Nombre */}
          <div className="productModal__field">
            <label className="productModal__label">
              Nombre <span className="productModal__required">*</span>
            </label>
            <Input
              value={formData.name}
              onChange={(v) => handleChange('name', v)}
              placeholder="Ej: Hamburguesa doble"
              autoFocus
            />
          </div>

          {/* Precio */}
          <div className="productModal__row">
            <div className="productModal__field">
              <label className="productModal__label">
                Precio <span className="productModal__required">*</span>
              </label>
              <div className="productModal__priceInput">
                <DollarSign size={16} className="productModal__priceIcon" />
                <Input
                  type="number"
                  value={formData.price}
                  onChange={(v) => handleChange('price', v)}
                  placeholder="9.99"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="productModal__field">
              <label className="productModal__label">
                Precio de costo
                <span className="productModal__hint">(opcional, para estadísticas)</span>
              </label>
              <div className="productModal__priceInput">
                <DollarSign size={16} className="productModal__priceIcon productModal__priceIcon--cost" />
                <Input
                  type="number"
                  value={formData.costPrice}
                  onChange={(v) => handleChange('costPrice', v)}
                  placeholder="5.50"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          </div>

          {/* Descuento */}
          <div className="productModal__field">
            <label className="productModal__label">
              <Tag size={14} />
              Descuento
              <span className="productModal__hint">(porcentaje opcional)</span>
            </label>
            <div className="productModal__discountRow">
              <div className="productModal__discountInput">
                <Input
                  type="number"
                  value={formData.discount}
                  onChange={(v) => {
                    const val = parseInt(v) || 0
                    if (val >= 0 && val <= 100) {
                      handleChange('discount', v)
                    }
                  }}
                  placeholder="0"
                  min="0"
                  max="100"
                />
                <Percent size={16} className="productModal__discountIcon" />
              </div>
              {formData.discount && parseFloat(formData.price) > 0 && (
                <div className="productModal__discountPreview">
                  <span className="productModal__originalPrice">
                    ${parseFloat(formData.price).toFixed(2)}
                  </span>
                  <span className="productModal__discountedPrice">
                    ${(parseFloat(formData.price) * (1 - parseInt(formData.discount) / 100)).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Talles / Sizes */}
          <div className="productModal__field productModal__sizesSection">
            <label className="productModal__label">
              <Ruler size={14} />
              Talles / Variantes
              <span className="productModal__hint">(opcional)</span>
            </label>
            
            <label className="productModal__checkbox productModal__sizesToggle">
              <input
                type="checkbox"
                checked={formData.hasSizes}
                onChange={(e) => handleChange('hasSizes', e.target.checked)}
              />
              <span>Este producto tiene talles o variantes</span>
            </label>

            {formData.hasSizes && (
              <div className="productModal__sizesContainer">
                {/* Selector de presets */}
                <div className="productModal__sizePresetsWrapper">
                  <button
                    type="button"
                    className="productModal__presetBtn"
                    onClick={() => setShowPresetDropdown(!showPresetDropdown)}
                    disabled={loadingPresets}
                  >
                    <Sparkles size={14} />
                    {loadingPresets ? 'Cargando presets...' : 'Usar preset de talles'}
                    <ChevronDown size={14} className={showPresetDropdown ? 'rotated' : ''} />
                  </button>
                  
                  {showPresetDropdown && (
                    <div className="productModal__presetDropdown">
                      {sizePresets.length === 0 ? (
                        <div className="productModal__presetEmpty">
                          No hay presets disponibles
                        </div>
                      ) : (
                        <>
                          {/* Adultos */}
                          {sizePresets.filter(p => p.audience === 'adult' || p.audience === 'all').length > 0 && (
                            <div className="productModal__presetGroup">
                              <div className="productModal__presetGroupTitle">
                                👔 Adultos
                              </div>
                              {sizePresets
                                .filter(p => p.audience === 'adult' || p.audience === 'all')
                                .map(preset => (
                                  <button
                                    key={preset.id}
                                    type="button"
                                    className="productModal__presetItem"
                                    onClick={() => applyPreset(preset)}
                                  >
                                    <span className="productModal__presetName">{preset.name}</span>
                                    <span className="productModal__presetCount">
                                      {preset.sizes?.length || 0} talles
                                    </span>
                                  </button>
                                ))}
                            </div>
                          )}
                          
                          {/* Niños */}
                          {sizePresets.filter(p => p.audience === 'kids').length > 0 && (
                            <div className="productModal__presetGroup">
                              <div className="productModal__presetGroupTitle">
                                👶 Niños
                              </div>
                              {sizePresets
                                .filter(p => p.audience === 'kids')
                                .map(preset => (
                                  <button
                                    key={preset.id}
                                    type="button"
                                    className="productModal__presetItem"
                                    onClick={() => applyPreset(preset)}
                                  >
                                    <span className="productModal__presetName">{preset.name}</span>
                                    <span className="productModal__presetCount">
                                      {preset.sizes?.length || 0} talles
                                    </span>
                                  </button>
                                ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Lista de talles */}
                <div className="productModal__sizesList">
                  {formData.sizes.length === 0 && (
                    <div className="productModal__sizesEmpty">
                      <p>No hay talles configurados</p>
                      <p className="muted">Selecciona un preset arriba o agrega talles manualmente</p>
                    </div>
                  )}
                  
                  {formData.sizes.map((size, index) => (
                    <div key={size.id} className="productModal__sizeItem">
                      <GripVertical size={14} className="productModal__sizeDrag" />
                      <input
                        type="text"
                        className="productModal__sizeNameInput"
                        value={size.name}
                        onChange={(e) => {
                          const newSizes = [...formData.sizes]
                          newSizes[index] = { ...size, name: e.target.value }
                          handleChange('sizes', newSizes)
                        }}
                        placeholder="Nombre (ej: M, Grande)"
                      />
                      <div className="productModal__sizePriceInput">
                        <span className="productModal__sizePriceLabel">+/-</span>
                        <input
                          type="number"
                          value={size.priceModifier || 0}
                          onChange={(e) => {
                            const newSizes = [...formData.sizes]
                            newSizes[index] = { ...size, priceModifier: parseFloat(e.target.value) || 0 }
                            handleChange('sizes', newSizes)
                          }}
                          placeholder="0"
                        />
                      </div>
                      <button
                        type="button"
                        className="productModal__sizeDeleteBtn"
                        onClick={() => {
                          const newSizes = formData.sizes.filter((_, i) => i !== index)
                          handleChange('sizes', newSizes)
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Botón agregar talle */}
                <button
                  type="button"
                  className="productModal__addSizeBtn"
                  onClick={() => {
                    const newSize = {
                      id: `size_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                      name: '',
                      priceModifier: 0,
                      active: true,
                    }
                    handleChange('sizes', [...formData.sizes, newSize])
                  }}
                >
                  <Plus size={14} /> Agregar talle
                </button>

                {/* Opción: talle requerido */}
                <label className="productModal__checkbox productModal__sizeRequired">
                  <input
                    type="checkbox"
                    checked={formData.sizeRequired}
                    onChange={(e) => handleChange('sizeRequired', e.target.checked)}
                  />
                  <span>El cliente debe elegir un talle</span>
                </label>

                {/* Preview de precios por talle */}
                {formData.sizes.length > 0 && parseFloat(formData.price) > 0 && (
                  <div className="productModal__sizesPreview">
                    <span className="productModal__sizesPreviewTitle">Vista previa:</span>
                    {formData.sizes.map(size => {
                      const basePrice = parseFloat(formData.price)
                      const sizePrice = basePrice + (size.priceModifier || 0)
                      const finalPrice = formData.discount 
                        ? sizePrice * (1 - parseInt(formData.discount) / 100)
                        : sizePrice
                      return (
                        <span key={size.id} className="productModal__sizePreviewItem">
                          {size.name || '?'}: ${finalPrice.toFixed(2)}
                        </span>
                      )
                    })}
                  </div>
                )}

                {/* Advertencia para admin */}
                <div className="productModal__sizesWarning">
                  <AlertTriangle size={14} />
                  <span>Los talles aparecerán en el configurador de Extras/Toppings del producto para ajustes adicionales.</span>
                </div>
              </div>
            )}
          </div>

          {/* Descripción */}
          <div className="productModal__field">
            <label className="productModal__label">Descripción</label>
            <textarea
              className="productModal__textarea"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Ingredientes, detalles del producto..."
              rows={3}
            />
          </div>

          {/* Categoría */}
          <div className="productModal__field">
            <label className="productModal__label">
              <Layers size={14} />
              Categoría
              {isCategoryLocked && <span className="productModal__locked">🔒 Bloqueada</span>}
            </label>
            {isCategoryLocked ? (
              <div className="productModal__lockedCategory">
                {preselectedCategory?.icon && <span>{preselectedCategory.icon}</span>}
                {formData.category}
              </div>
            ) : (
              <CategoryTreeSelect
                tenantId={tenantId}
                value={formData.category}
                onChange={handleCategoryChange}
                label=""
                placeholder="Seleccionar categoría..."
                showOnlyLeaves={true}
              />
            )}
          </div>

          {/* Stock */}
          <div className="productModal__field">
            <label className="productModal__label">Stock</label>
            <div className="productModal__stockRow">
              <label className="productModal__checkbox">
                <input
                  type="checkbox"
                  checked={formData.unlimitedStock}
                  onChange={(e) => handleChange('unlimitedStock', e.target.checked)}
                />
                <InfinityIcon size={16} />
                <span>Stock ilimitado</span>
              </label>
              
              {!formData.unlimitedStock && (
                <Input
                  type="number"
                  value={formData.stock}
                  onChange={(v) => handleChange('stock', v)}
                  placeholder="Cantidad disponible"
                  min="0"
                  className="productModal__stockInput"
                />
              )}
            </div>
          </div>

          {/* Imagen */}
          <div className="productModal__field">
            <label className="productModal__label">
              <ImageIcon size={14} />
              Foto del producto
            </label>
            
            {/* Tabs para tipo de imagen */}
            <div className="productModal__imageTabs">
              <button
                className={`productModal__imageTab ${imageMode === 'upload' ? 'productModal__imageTab--active' : ''}`}
                onClick={() => setImageMode('upload')}
                type="button"
              >
                <Upload size={14} />
                Subir archivo
              </button>
              <button
                className={`productModal__imageTab ${imageMode === 'url' ? 'productModal__imageTab--active' : ''}`}
                onClick={() => setImageMode('url')}
                type="button"
              >
                <Link2 size={14} />
                Pegar URL
              </button>
            </div>

            {imageMode === 'upload' ? (
              <div className="productModal__uploadArea">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                
                {imagePreview ? (
                  <div className="productModal__imagePreview">
                    <img src={imagePreview} alt="Preview" />
                    <button 
                      className="productModal__removeImage"
                      onClick={() => {
                        setImagePreview(null)
                        setImageFile(null)
                        handleChange('imageUrl', '')
                      }}
                      type="button"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <button 
                    className="productModal__uploadButton"
                    onClick={() => fileInputRef.current?.click()}
                    type="button"
                  >
                    <Upload size={24} />
                    <span>Click para subir imagen</span>
                    <span className="productModal__uploadHint">PNG, JPG hasta 5MB</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="productModal__urlInput">
                <Input
                  value={formData.imageUrl}
                  onChange={handleImageUrlChange}
                  placeholder="https://ejemplo.com/imagen.jpg"
                />
                {imagePreview && formData.imageUrl && (
                  <div className="productModal__urlPreview">
                    <img src={imagePreview} alt="Preview" onError={() => setImagePreview(null)} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="productModal__error">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="productModal__footer">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 size={16} className="productModal__spinner" />
                {uploading ? 'Subiendo imagen...' : 'Guardando...'}
              </>
            ) : (
              <>
                <Check size={16} />
                {product ? 'Guardar cambios' : 'Crear producto'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
