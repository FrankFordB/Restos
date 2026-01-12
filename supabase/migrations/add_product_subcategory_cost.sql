-- =============================================
-- MIGRACIÓN: Sistema de Categorías Jerárquico (Tipo Carpetas)
-- Categoría > Subcategoría > Producto
-- =============================================

-- =============================================
-- REGLAS DE NEGOCIO (CRÍTICAS):
-- =============================================
-- 1. Una categoría puede tener PRODUCTOS o SUBCATEGORÍAS, pero NO ambas
-- 2. Si una categoría tiene subcategorías, NO se pueden agregar productos
-- 3. Los productos solo pueden vivir en el "último nivel" (hoja)
-- 4. Esto es como carpetas: una carpeta tiene archivos O subcarpetas
-- =============================================

-- 1. Agregar campos a product_categories para jerarquía y reglas tipo carpetas
ALTER TABLE product_categories
ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS short_description TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS has_products BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_children BOOLEAN DEFAULT FALSE;

-- 2. Agregar category_id para relación directa con categorías (padre)
ALTER TABLE products
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL;

-- 3. Agregar subcategory_id para relación con subcategorías
-- Este es el campo que indica "dónde vive" el producto en la jerarquía
ALTER TABLE products
ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES product_categories(id) ON DELETE SET NULL;

-- 4. Agregar cost_price (precio de costo) para estadísticas
-- Solo visible para admin, usado en dashboard de ganancias
ALTER TABLE products
ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10,2) DEFAULT NULL;

-- 5. Índices para performance
CREATE INDEX IF NOT EXISTS idx_products_category_id 
ON products(category_id);

CREATE INDEX IF NOT EXISTS idx_products_subcategory_id 
ON products(subcategory_id);

CREATE INDEX IF NOT EXISTS idx_products_tenant_category
ON products(tenant_id, category_id);

CREATE INDEX IF NOT EXISTS idx_products_tenant_subcategory
ON products(tenant_id, subcategory_id);

CREATE INDEX IF NOT EXISTS idx_categories_parent_id
ON product_categories(parent_id);

CREATE INDEX IF NOT EXISTS idx_categories_tenant_parent
ON product_categories(tenant_id, parent_id);

CREATE INDEX IF NOT EXISTS idx_categories_has_children
ON product_categories(tenant_id, has_children);

CREATE INDEX IF NOT EXISTS idx_categories_has_products
ON product_categories(tenant_id, has_products);

-- 6. Función para verificar regla de "carpetas"
-- Una categoría NO puede tener productos si tiene subcategorías
CREATE OR REPLACE FUNCTION check_category_folder_rules()
RETURNS TRIGGER AS $$
DECLARE
  parent_has_children BOOLEAN;
  parent_has_products BOOLEAN;
  target_category_id UUID;
BEGIN
  -- Determinar cuál categoría estamos verificando
  target_category_id := COALESCE(NEW.subcategory_id, NEW.category_id);
  
  IF target_category_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Verificar si la categoría destino tiene subcategorías (hijos)
  SELECT has_children INTO parent_has_children
  FROM product_categories
  WHERE id = target_category_id;
  
  -- Si la categoría tiene hijos, no se puede agregar producto aquí
  IF parent_has_children = TRUE THEN
    RAISE EXCEPTION 'No puedes agregar productos a una categoría que tiene subcategorías. Los productos solo pueden estar en el último nivel.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Trigger para validar regla antes de insertar/actualizar producto
DROP TRIGGER IF EXISTS trg_check_product_category_rules ON products;
CREATE TRIGGER trg_check_product_category_rules
BEFORE INSERT OR UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION check_category_folder_rules();

-- 8. Función para actualizar has_products cuando se agrega/elimina producto
CREATE OR REPLACE FUNCTION update_category_has_products()
RETURNS TRIGGER AS $$
DECLARE
  old_cat_id UUID;
  new_cat_id UUID;
BEGIN
  -- Determinar categorías afectadas
  IF TG_OP = 'DELETE' THEN
    old_cat_id := COALESCE(OLD.subcategory_id, OLD.category_id);
    new_cat_id := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    old_cat_id := NULL;
    new_cat_id := COALESCE(NEW.subcategory_id, NEW.category_id);
  ELSE -- UPDATE
    old_cat_id := COALESCE(OLD.subcategory_id, OLD.category_id);
    new_cat_id := COALESCE(NEW.subcategory_id, NEW.category_id);
  END IF;
  
  -- Actualizar categoría antigua (ya no tiene este producto)
  IF old_cat_id IS NOT NULL AND (new_cat_id IS NULL OR old_cat_id != new_cat_id) THEN
    UPDATE product_categories
    SET has_products = EXISTS (
      SELECT 1 FROM products 
      WHERE (category_id = old_cat_id OR subcategory_id = old_cat_id)
        AND id != COALESCE(OLD.id, '00000000-0000-0000-0000-000000000000'::uuid)
    )
    WHERE id = old_cat_id;
  END IF;
  
  -- Actualizar categoría nueva (ahora tiene este producto)
  IF new_cat_id IS NOT NULL THEN
    UPDATE product_categories
    SET has_products = TRUE
    WHERE id = new_cat_id;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. Trigger para mantener has_products actualizado
DROP TRIGGER IF EXISTS trg_update_category_has_products ON products;
CREATE TRIGGER trg_update_category_has_products
AFTER INSERT OR UPDATE OR DELETE ON products
FOR EACH ROW
EXECUTE FUNCTION update_category_has_products();

-- 10. Función para actualizar has_children cuando se agrega/elimina subcategoría
CREATE OR REPLACE FUNCTION update_category_has_children()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Actualizar padre antiguo
    IF OLD.parent_id IS NOT NULL THEN
      UPDATE product_categories
      SET has_children = EXISTS (
        SELECT 1 FROM product_categories 
        WHERE parent_id = OLD.parent_id 
          AND id != OLD.id
      )
      WHERE id = OLD.parent_id;
    END IF;
    RETURN OLD;
  END IF;
  
  IF TG_OP = 'INSERT' THEN
    -- Actualizar nuevo padre
    IF NEW.parent_id IS NOT NULL THEN
      UPDATE product_categories
      SET has_children = TRUE
      WHERE id = NEW.parent_id;
    END IF;
    RETURN NEW;
  END IF;
  
  -- UPDATE: verificar si cambió el parent_id
  IF TG_OP = 'UPDATE' AND OLD.parent_id IS DISTINCT FROM NEW.parent_id THEN
    -- Actualizar padre antiguo
    IF OLD.parent_id IS NOT NULL THEN
      UPDATE product_categories
      SET has_children = EXISTS (
        SELECT 1 FROM product_categories 
        WHERE parent_id = OLD.parent_id 
          AND id != OLD.id
      )
      WHERE id = OLD.parent_id;
    END IF;
    
    -- Actualizar nuevo padre
    IF NEW.parent_id IS NOT NULL THEN
      UPDATE product_categories
      SET has_children = TRUE
      WHERE id = NEW.parent_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. Trigger para mantener has_children actualizado
DROP TRIGGER IF EXISTS trg_update_category_has_children ON product_categories;
CREATE TRIGGER trg_update_category_has_children
AFTER INSERT OR UPDATE OR DELETE ON product_categories
FOR EACH ROW
EXECUTE FUNCTION update_category_has_children();

-- 12. Función para prevenir crear subcategoría en categoría con productos
CREATE OR REPLACE FUNCTION check_subcategory_rules()
RETURNS TRIGGER AS $$
DECLARE
  parent_has_products BOOLEAN;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Verificar si el padre tiene productos
  SELECT has_products INTO parent_has_products
  FROM product_categories
  WHERE id = NEW.parent_id;
  
  IF parent_has_products = TRUE THEN
    RAISE EXCEPTION 'No puedes crear subcategorías en una categoría que ya tiene productos. Mueve los productos primero.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 13. Trigger para validar regla antes de crear subcategoría
DROP TRIGGER IF EXISTS trg_check_subcategory_rules ON product_categories;
CREATE TRIGGER trg_check_subcategory_rules
BEFORE INSERT ON product_categories
FOR EACH ROW
EXECUTE FUNCTION check_subcategory_rules();

-- 14. Migrar productos existentes: asignar category_id basado en el nombre
UPDATE products p
SET category_id = (
  SELECT c.id 
  FROM product_categories c 
  WHERE c.tenant_id = p.tenant_id 
    AND c.name = p.category 
    AND c.parent_id IS NULL
  LIMIT 1
)
WHERE p.category IS NOT NULL 
  AND p.category_id IS NULL;

-- 15. Actualizar has_products en categorías existentes
UPDATE product_categories c
SET has_products = EXISTS (
  SELECT 1 FROM products p 
  WHERE p.category_id = c.id OR p.subcategory_id = c.id
);

-- 16. Actualizar has_children en categorías existentes
UPDATE product_categories c
SET has_children = EXISTS (
  SELECT 1 FROM product_categories child 
  WHERE child.parent_id = c.id
);

-- 17. Comentarios de documentación
COMMENT ON COLUMN products.category_id IS 
'UUID de la categoría padre del producto. Para navegación y compatibilidad.';

COMMENT ON COLUMN products.subcategory_id IS 
'UUID de la subcategoría del producto. Si existe, el producto "vive" aquí.';

COMMENT ON COLUMN products.cost_price IS 
'Precio de costo del producto. Solo visible para admin en estadísticas y dashboard de ganancias.';

COMMENT ON COLUMN product_categories.image_url IS 
'URL de imagen para mostrar como card visual en Store y Dashboard.';

COMMENT ON COLUMN product_categories.short_description IS 
'Descripción corta para mostrar en tooltips o debajo del nombre.';

COMMENT ON COLUMN product_categories.has_products IS 
'TRUE si esta categoría contiene al menos un producto. Usado para regla de carpetas.';

COMMENT ON COLUMN product_categories.has_children IS 
'TRUE si esta categoría tiene subcategorías. Usado para regla de carpetas.';

-- 18. Vista para productos con info completa de categoría/subcategoría
-- Primero eliminar la vista existente para evitar conflictos de columnas
DROP VIEW IF EXISTS products_with_categories;
CREATE OR REPLACE VIEW products_with_categories AS
SELECT 
  p.*,
  c.name as category_name,
  c.image_url as category_image,
  c.short_description as category_description,
  s.name as subcategory_name,
  s.image_url as subcategory_image,
  s.short_description as subcategory_description,
  -- Ruta completa: Categoría > Subcategoría
  CASE 
    WHEN s.id IS NOT NULL THEN c.name || ' > ' || s.name
    WHEN c.id IS NOT NULL THEN c.name
    ELSE 'Sin categoría'
  END as full_category_path,
  -- Margen de ganancia
  CASE 
    WHEN p.cost_price IS NOT NULL AND p.cost_price > 0 
    THEN p.price - p.cost_price 
    ELSE NULL 
  END as profit_margin,
  -- Porcentaje de ganancia
  CASE 
    WHEN p.cost_price IS NOT NULL AND p.cost_price > 0 
    THEN ROUND(((p.price - p.cost_price) / p.cost_price * 100)::numeric, 2)
    ELSE NULL 
  END as profit_percentage
FROM products p
LEFT JOIN product_categories c ON p.category_id = c.id
LEFT JOIN product_categories s ON p.subcategory_id = s.id;

-- 19. Vista para árbol de categorías con conteo de productos
DROP VIEW IF EXISTS category_tree_with_counts;
CREATE OR REPLACE VIEW category_tree_with_counts AS
SELECT 
  c.*,
  COALESCE(parent.name, NULL) as parent_name,
  (
    SELECT COUNT(*) 
    FROM products p 
    WHERE p.category_id = c.id OR p.subcategory_id = c.id
  ) as product_count,
  (
    SELECT COUNT(*) 
    FROM product_categories child 
    WHERE child.parent_id = c.id
  ) as children_count,
  -- Puede recibir productos: solo si no tiene hijos
  (NOT c.has_children) as can_have_products,
  -- Puede tener subcategorías: solo si no tiene productos
  (NOT c.has_products) as can_have_children
FROM product_categories c
LEFT JOIN product_categories parent ON c.parent_id = parent.id;

-- 20. Función helper para obtener breadcrumb de una categoría
DROP FUNCTION IF EXISTS get_category_breadcrumb(UUID);
CREATE OR REPLACE FUNCTION get_category_breadcrumb(category_id UUID)
RETURNS TEXT AS $$
DECLARE
  result TEXT := '';
  current_id UUID := category_id;
  current_name TEXT;
  current_parent UUID;
BEGIN
  WHILE current_id IS NOT NULL LOOP
    SELECT name, parent_id INTO current_name, current_parent
    FROM product_categories
    WHERE id = current_id;
    
    IF current_name IS NOT NULL THEN
      IF result = '' THEN
        result := current_name;
      ELSE
        result := current_name || ' > ' || result;
      END IF;
    END IF;
    
    current_id := current_parent;
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;
