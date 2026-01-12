# Sistema de Categorías Jerárquicas (Tipo Carpetas)

## 📁 Concepto

El sistema implementa una estructura jerárquica tipo carpetas donde:

- **Categoría** = Carpeta principal
- **Subcategoría** = Subcarpeta
- **Producto** = Archivo

## 🔒 Reglas de Negocio (CRÍTICAS)

### Regla Principal: Una categoría puede tener PRODUCTOS **o** SUBCATEGORÍAS, pero **NUNCA ambas**

| Situación | Puede agregar productos | Puede crear subcategorías |
|-----------|------------------------|---------------------------|
| Categoría vacía | ✅ | ✅ |
| Categoría con productos | ✅ | ❌ |
| Categoría con subcategorías | ❌ | ✅ |

### Implicaciones:
1. Si una categoría tiene subcategorías, los productos deben ir **dentro** de las subcategorías
2. Si una categoría tiene productos, NO se pueden crear subcategorías hasta mover los productos
3. Los productos solo "viven" en el **último nivel** (hojas del árbol)

## 🗂️ Estructura de Base de Datos

### Tabla: `product_categories`

```sql
id              UUID PRIMARY KEY
tenant_id       UUID REFERENCES tenants(id)
name            TEXT NOT NULL
description     TEXT
short_description TEXT          -- Para mostrar en cards
image_url       TEXT            -- Imagen de la categoría
icon            TEXT            -- Emoji opcional
parent_id       UUID REFERENCES product_categories(id)  -- NULL = raíz
level           INTEGER DEFAULT 0
sort_order      INTEGER DEFAULT 0
active          BOOLEAN DEFAULT TRUE
has_products    BOOLEAN DEFAULT FALSE  -- Tiene productos directos
has_children    BOOLEAN DEFAULT FALSE  -- Tiene subcategorías
```

### Tabla: `products`

```sql
id              UUID PRIMARY KEY
tenant_id       UUID REFERENCES tenants(id)
name            TEXT NOT NULL
price           DECIMAL(10,2)
description     TEXT
image_url       TEXT
category        TEXT                    -- Nombre (legacy/compatibilidad)
category_id     UUID REFERENCES product_categories(id)  -- Categoría padre
subcategory_id  UUID REFERENCES product_categories(id)  -- Subcategoría (donde "vive")
cost_price      DECIMAL(10,2)          -- Precio de costo (solo admin)
stock           INTEGER                 -- NULL = ilimitado
active          BOOLEAN DEFAULT TRUE
```

### Triggers de BD

1. **`trg_check_product_category_rules`**: Valida que no se agreguen productos a categorías con subcategorías
2. **`trg_check_subcategory_rules`**: Valida que no se creen subcategorías en categorías con productos
3. **`trg_update_category_has_products`**: Actualiza `has_products` automáticamente
4. **`trg_update_category_has_children`**: Actualiza `has_children` automáticamente

## 🎨 Componentes Creados

### UI Components

| Componente | Ubicación | Descripción |
|------------|-----------|-------------|
| `CategoryCard` | `src/components/ui/CategoryCard/` | Card visual para categoría/subcategoría |
| `CategoryGrid` | `src/components/ui/CategoryGrid/` | Grid con navegación y breadcrumb |

### Dashboard Components

| Componente | Ubicación | Descripción |
|------------|-----------|-------------|
| `CategoryManager` | `src/components/dashboard/CategoryManager/` | Gestión visual completa de categorías |
| `CategoryModal` | `src/components/dashboard/CategoryModal/` | Modal crear/editar categoría |
| `ProductModal` | `src/components/dashboard/ProductModal/` | Modal crear/editar producto (mejorado) |
| `CategoryTreeManager` | `src/components/dashboard/CategoryTreeManager/` | Vista de árbol (existente, actualizada) |

### Storefront Components

| Componente | Ubicación | Descripción |
|------------|-----------|-------------|
| `StoreCategoryNav` | `src/components/storefront/StoreCategoryNav/` | Navegación visual para la tienda |
| `StoreCategoryChips` | (en el mismo archivo) | Versión compacta con chips |

## 📦 Redux State

### Categories Slice (`src/features/categories/categoriesSlice.js`)

**Estructura de categoría:**
```javascript
{
  id: 'cat_123',
  name: 'Hamburguesas',
  description: 'Las mejores hamburguesas',
  shortDescription: 'Burgers artesanales',
  imageUrl: 'https://...',
  icon: '🍔',
  parentId: null,          // null = raíz
  level: 0,
  sortOrder: 0,
  active: true,
  maxStock: null,
  currentStock: null,
  hasProducts: true,       // Tiene productos directos
  hasChildren: false,      // Tiene subcategorías
}
```

**Selectores importantes:**
- `selectCategoriesForTenant(tenantId)` - Todas las categorías
- `selectRootCategories(tenantId)` - Solo categorías raíz
- `selectChildCategories(tenantId, parentId)` - Hijos de una categoría
- `selectCategoryTree(tenantId)` - Árbol completo anidado
- `selectLeafCategories(tenantId)` - Solo hojas (donde van productos)
- `selectCanCategoryHaveProducts(tenantId, categoryId)` - Puede recibir productos?
- `selectCanCategoryHaveChildren(tenantId, categoryId)` - Puede tener subcategorías?

### Products Slice (`src/features/products/productsSlice.js`)

**Estructura de producto:**
```javascript
{
  id: 'prod_123',
  name: 'Hamburguesa Clásica',
  price: 8.99,
  description: 'Carne, queso, lechuga...',
  imageUrl: 'https://...',
  category: 'Hamburguesas',  // Nombre (legacy)
  categoryId: 'cat_123',     // UUID de categoría padre
  subcategoryId: null,       // UUID de subcategoría (donde "vive")
  costPrice: 4.50,           // Solo visible para admin
  stock: 50,                 // null = ilimitado
  active: true,
}
```

## 🎯 Flujo de Usuario

### Admin: Crear estructura

1. Ir a **Dashboard > Categorías**
2. Click en **"Nueva categoría"**
3. Llenar: nombre, imagen (subir/URL), descripción, icono
4. Guardar → aparece en el grid

### Admin: Crear subcategoría

1. Navegar a la categoría padre
2. Click en **"Nueva subcategoría"** o en el ícono de carpeta+
3. ⚠️ Si la categoría tiene productos, se muestra error

### Admin: Agregar producto

1. Navegar a la categoría/subcategoría destino
2. Click en card **"Agregar producto"** (con +)
3. Llenar modal:
   - Nombre *
   - Precio *
   - Descripción
   - Categoría (bloqueada si venimos de una)
   - Precio de costo (opcional, para estadísticas)
   - Stock (ilimitado o numérico)
   - Imagen (subir o URL)

### Cliente: Navegar tienda

1. Ver categorías como cards con imagen
2. Click en categoría → ver subcategorías o productos
3. Breadcrumb para volver
4. Agregar productos al carrito

## 📊 Dashboard de Estadísticas

El campo `cost_price` permite calcular:
- **Margen de ganancia**: `price - cost_price`
- **Porcentaje de ganancia**: `(price - cost_price) / cost_price * 100`

Vista SQL disponible: `products_with_categories` incluye:
- `profit_margin`
- `profit_percentage`
- `full_category_path` (Categoría > Subcategoría)

## 🔧 Migración

Ejecutar: `supabase/migrations/add_product_subcategory_cost.sql`

Este archivo:
1. Agrega columnas a `product_categories` y `products`
2. Crea triggers para validar reglas
3. Migra productos existentes
4. Crea vistas útiles

## ⚠️ Casos Borde Manejados

| Caso | Comportamiento |
|------|---------------|
| Categoría con productos → crear subcategoría | ❌ Error: "Mueve los productos primero" |
| Categoría con subcategorías → agregar producto | ❌ Error: "Productos solo en último nivel" |
| Eliminar categoría con subcategorías | ❌ Error: "Elimina subcategorías primero" |
| Eliminar categoría con productos | ❌ Error: "Mueve productos primero" |
| Producto sin stock | Se muestra pero no se puede agregar al carrito |
| Editar producto en carrito | Se actualiza automáticamente |

## 🚀 Próximos Pasos Sugeridos

1. Agregar drag & drop para reordenar
2. Bulk actions (mover varios productos)
3. Import/Export de categorías
4. Estadísticas por categoría
5. Imágenes automáticas con IA
