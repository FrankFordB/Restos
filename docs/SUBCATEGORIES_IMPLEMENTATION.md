# Sistema de Subcategorías - Plan de Implementación

## ✅ Estado Actual de Implementación

### Completado:
1. ✅ **Migración SQL** - `supabase/migrations/add_subcategories_system.sql`
   - Columnas: `parent_id`, `level`, `path`, `image_url`, `icon`
   - Índices optimizados para consultas jerárquicas
   - Triggers automáticos para actualizar `path` y `level`
   - Vista `category_tree` con info agregada
   - Funciones: `get_category_descendants()`, `get_category_breadcrumb()`

2. ✅ **API Layer** - `src/lib/supabaseApi.js`
   - `fetchCategoriesByTenantId` - con soporte de subcategorías
   - `insertCategory` - maneja `parentId`
   - `updateCategoryRow` - actualiza jerarquía
   - `deleteCategoryRow` - valida hijos y productos
   - Nuevas funciones: `fetchSubcategoriesByParentId`, `fetchRootCategories`

3. ✅ **Redux Store** - `src/features/categories/categoriesSlice.js`
   - Modelo actualizado con campos de subcategorías
   - Nuevos selectores:
     - `selectRootCategories(tenantId)` - Categorías nivel 0
     - `selectChildCategories(tenantId, parentId)` - Hijos directos
     - `selectCategoryById(tenantId, categoryId)` - Por ID
     - `selectCategoryBreadcrumb(tenantId, categoryId)` - Ruta hasta raíz
     - `selectCategoryTree(tenantId)` - Árbol completo anidado
     - `selectCategoryHasChildren(tenantId, categoryId)` - Verificar hijos
     - `selectCategoryDescendants(tenantId, categoryId)` - Todos los descendientes

4. ✅ **Componentes UI** - `src/components/dashboard/CategoryTreeManager/`
   - `CategoryTreeManager` - Gestión de categorías en árbol
   - `CategoryTreeSelect` - Selector dropdown con árbol
   - Estilos completos en `CategoryTreeManager.css`

### Pendiente:
- ⏳ Integrar `CategoryTreeManager` en Dashboard
- ⏳ Actualizar ProductsManager para usar `CategoryTreeSelect`
- ⏳ Implementar navegación jerárquica en Storefront
- ⏳ Agregar breadcrumbs en la tienda
- ⏳ Testing completo

---

## 📊 Análisis del Sistema Actual

### Estructura existente:
- **Tabla**: `product_categories` con campos básicos (id, tenant_id, name, description, sort_order, is_visible)
- **Productos**: Tienen `category` (nombre string) y `category_id` (uuid)
- **Redux**: `categoriesSlice.js` maneja CRUD de categorías planas

## 🎯 Propuesta de Arquitectura

### Opción Elegida: **Modelo Jerárquico con parent_id**

```
┌─────────────────────────────────────────────────────────────────┐
│                    CATEGORÍAS (product_categories)              │
├─────────────────────────────────────────────────────────────────┤
│ id          │ parent_id │ name       │ level │ path            │
├─────────────────────────────────────────────────────────────────┤
│ uuid-1      │ NULL      │ Remeras    │ 0     │ uuid-1          │
│ uuid-2      │ uuid-1    │ Hombres    │ 1     │ uuid-1/uuid-2   │
│ uuid-3      │ uuid-1    │ Mujeres    │ 1     │ uuid-1/uuid-3   │
│ uuid-4      │ uuid-1    │ Mixto      │ 1     │ uuid-1/uuid-4   │
│ uuid-5      │ NULL      │ Pantalones │ 0     │ uuid-5          │
│ uuid-6      │ uuid-5    │ Jeans      │ 1     │ uuid-5/uuid-6   │
└─────────────────────────────────────────────────────────────────┘
```

### Ventajas:
✅ Una sola tabla (simple)
✅ Escalable a múltiples niveles
✅ Consultas eficientes con índices
✅ Compatible con estructura actual
✅ Fácil de mantener

---

## 🗃️ Modelo de Base de Datos

### Migración SQL

```sql
-- 1. Agregar columnas para jerarquía
ALTER TABLE product_categories
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES product_categories(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS path TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS icon TEXT;

-- 2. Índices para performance
CREATE INDEX IF NOT EXISTS idx_categories_parent ON product_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_level ON product_categories(tenant_id, level);
CREATE INDEX IF NOT EXISTS idx_categories_path ON product_categories(path);

-- 3. Función para actualizar path automáticamente
CREATE OR REPLACE FUNCTION update_category_path()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.level := 0;
    NEW.path := NEW.id::TEXT;
  ELSE
    SELECT level + 1, path || '/' || NEW.id::TEXT
    INTO NEW.level, NEW.path
    FROM product_categories
    WHERE id = NEW.parent_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger
DROP TRIGGER IF EXISTS trg_category_path ON product_categories;
CREATE TRIGGER trg_category_path
BEFORE INSERT OR UPDATE OF parent_id ON product_categories
FOR EACH ROW EXECUTE FUNCTION update_category_path();

-- 5. Actualizar categorías existentes (sin parent = nivel 0)
UPDATE product_categories
SET level = 0, path = id::TEXT
WHERE parent_id IS NULL AND path IS NULL;
```

---

## 🔧 Cambios en el Frontend

### 1. Redux Slice (`categoriesSlice.js`)

```javascript
// Nuevos campos en el modelo
{
  id: 'uuid',
  parentId: null,        // NULL = categoría principal
  name: 'Remeras',
  level: 0,              // 0 = principal, 1 = sub, 2 = sub-sub...
  path: 'uuid',          // Para breadcrumbs
  imageUrl: null,
  icon: null,
  // ... campos existentes
}

// Nuevos selectores
selectRootCategories(tenantId)      // Categorías principales (level 0)
selectChildCategories(parentId)      // Hijos de una categoría
selectCategoryBreadcrumb(categoryId) // Ruta completa hasta raíz
selectCategoryTree(tenantId)         // Árbol completo anidado
```

### 2. Componentes UI

```
src/components/
├── dashboard/
│   └── CategoriesManager/
│       ├── CategoriesManager.jsx      # Manager principal (árbol)
│       ├── CategoryForm.jsx           # Form crear/editar
│       ├── CategoryTree.jsx           # Vista árbol expandible
│       └── CategoryTreeItem.jsx       # Item con hijos
│
└── storefront/
    ├── CategoryNav/
    │   ├── CategoryNav.jsx            # Navegación principal
    │   ├── SubcategoryList.jsx        # Lista de subcategorías
    │   └── CategoryBreadcrumb.jsx     # Breadcrumb de navegación
    └── ProductGrid/
        └── ProductGrid.jsx            # Grid filtrado por categoría
```

### 3. Flujo de Navegación en Tienda

```
┌──────────────────────────────────────────────────────────────┐
│  TIENDA PRINCIPAL                                            │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐         │
│  │ Remeras │  │Pantalones│ │ Zapatos │  │  Acces. │         │
│  └────┬────┘  └─────────┘  └─────────┘  └─────────┘         │
│       │                                                      │
│       ▼ (click)                                              │
├──────────────────────────────────────────────────────────────┤
│  Inicio > Remeras                                            │
│                                                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                      │
│  │ Hombres │  │ Mujeres │  │  Mixto  │                      │
│  └────┬────┘  └─────────┘  └─────────┘                      │
│       │                                                      │
│       ▼ (click)                                              │
├──────────────────────────────────────────────────────────────┤
│  Inicio > Remeras > Hombres                                  │
│                                                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐         │
│  │ Product │  │ Product │  │ Product │  │ Product │         │
│  │  Card   │  │  Card   │  │  Card   │  │  Card   │         │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 📋 Plan de Implementación

### Fase 1: Base de Datos ✅
1. Crear migración SQL
2. Ejecutar en Supabase
3. Verificar índices y triggers

### Fase 2: API Layer
1. Actualizar `supabaseApi.js`:
   - `fetchCategoriesByTenantId` - incluir parent_id, level, path
   - `insertCategory` - manejar parent_id
   - `updateCategoryRow` - actualizar jerarquía
   - `deleteCategoryRow` - cascade a hijos

### Fase 3: Redux Store
1. Actualizar `categoriesSlice.js`:
   - Nuevos campos en el modelo
   - Selectores para árbol
   - Acciones para mover categorías

### Fase 4: Dashboard
1. `CategoriesManager` con vista de árbol
2. Drag & drop para reordenar
3. Crear subcategorías inline
4. Vista preview de productos

### Fase 5: Storefront
1. Navegación jerárquica
2. Breadcrumbs
3. Filtros por subcategoría
4. Productos correctamente asignados

### Fase 6: Carrito & Pedidos
1. Mantener referencia a categoría completa
2. Manejar eliminaciones con fallback
3. Historial de pedidos intacto

---

## 🛡️ Manejo de Edge Cases

### Eliminación de categoría con productos
```javascript
// Opción A: Mover productos a categoría padre
// Opción B: Marcar productos como "sin categoría"
// Opción C: Impedir eliminación si tiene productos

// Implementamos Opción C por seguridad
if (categoryHasProducts || categoryHasChildren) {
  throw new Error('No puedes eliminar una categoría con productos o subcategorías')
}
```

### Cambio de nombre de categoría
```javascript
// Los productos referencian por ID, no por nombre
// El cambio se refleja automáticamente en toda la app
```

### Mover categoría a otro padre
```javascript
// El trigger actualiza automáticamente:
// - level
// - path
// - Todos los hijos recursivamente
```

---

## 🚀 Próximos Pasos

1. **Ejecutar migración SQL**
2. **Actualizar API**
3. **Implementar selectores Redux**
4. **Crear componentes UI**
5. **Testing completo**

¿Comenzamos con la implementación?
