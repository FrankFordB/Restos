-- =============================================
-- SISTEMA DE REGLAS TIPO CARPETAS
-- Una categoría puede tener productos O subcategorías, NO ambas
-- =============================================

-- 1. Agregar columna para controlar si tiene productos directos
-- Esta columna se actualiza automáticamente con triggers
ALTER TABLE product_categories
ADD COLUMN IF NOT EXISTS has_products BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Agregar columna para controlar si tiene subcategorías
ALTER TABLE product_categories
ADD COLUMN IF NOT EXISTS has_children BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Agregar descripción corta para cards
ALTER TABLE product_categories
ADD COLUMN IF NOT EXISTS short_description TEXT;

-- 4. Función para verificar si una categoría puede tener productos
-- (NO puede si tiene subcategorías)
CREATE OR REPLACE FUNCTION can_have_products(category_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM product_categories 
    WHERE parent_id = category_uuid
  );
END;
$$ LANGUAGE plpgsql;

-- 5. Función para verificar si una categoría puede tener subcategorías
-- (NO puede si tiene productos directos)
CREATE OR REPLACE FUNCTION can_have_subcategories(category_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM products 
    WHERE category_id = category_uuid OR subcategory_id = category_uuid
  );
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger: Al insertar producto, verificar que la categoría no tenga subcategorías
CREATE OR REPLACE FUNCTION check_product_category_rules()
RETURNS TRIGGER AS $$
DECLARE
  target_category_id UUID;
  has_subcats BOOLEAN;
BEGIN
  -- Determinar la categoría objetivo (subcategory_id tiene prioridad)
  target_category_id := COALESCE(NEW.subcategory_id, NEW.category_id);
  
  IF target_category_id IS NOT NULL THEN
    -- Verificar si la categoría tiene subcategorías
    SELECT EXISTS (
      SELECT 1 FROM product_categories 
      WHERE parent_id = target_category_id
    ) INTO has_subcats;
    
    IF has_subcats THEN
      RAISE EXCEPTION 'No se pueden agregar productos a una categoría que tiene subcategorías. Agrega el producto a una subcategoría específica.';
    END IF;
    
    -- Marcar que la categoría ahora tiene productos
    UPDATE product_categories 
    SET has_products = TRUE 
    WHERE id = target_category_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_product_category ON products;
CREATE TRIGGER trg_check_product_category
BEFORE INSERT OR UPDATE OF category_id, subcategory_id ON products
FOR EACH ROW EXECUTE FUNCTION check_product_category_rules();

-- 7. Trigger: Al insertar subcategoría, verificar que el padre no tenga productos
CREATE OR REPLACE FUNCTION check_subcategory_rules()
RETURNS TRIGGER AS $$
DECLARE
  has_prods BOOLEAN;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    -- Verificar si el padre tiene productos directos
    SELECT EXISTS (
      SELECT 1 FROM products 
      WHERE category_id = NEW.parent_id OR subcategory_id = NEW.parent_id
    ) INTO has_prods;
    
    IF has_prods THEN
      RAISE EXCEPTION 'No se pueden crear subcategorías en una categoría que tiene productos. Mueve los productos primero.';
    END IF;
    
    -- Marcar que el padre ahora tiene hijos
    UPDATE product_categories 
    SET has_children = TRUE 
    WHERE id = NEW.parent_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_subcategory ON product_categories;
CREATE TRIGGER trg_check_subcategory
BEFORE INSERT ON product_categories
FOR EACH ROW 
WHEN (NEW.parent_id IS NOT NULL)
EXECUTE FUNCTION check_subcategory_rules();

-- 8. Trigger: Actualizar has_products cuando se elimina un producto
CREATE OR REPLACE FUNCTION update_has_products_on_delete()
RETURNS TRIGGER AS $$
DECLARE
  target_category_id UUID;
  remaining_products INTEGER;
BEGIN
  target_category_id := COALESCE(OLD.subcategory_id, OLD.category_id);
  
  IF target_category_id IS NOT NULL THEN
    SELECT COUNT(*) INTO remaining_products
    FROM products
    WHERE (category_id = target_category_id OR subcategory_id = target_category_id)
      AND id != OLD.id;
    
    IF remaining_products = 0 THEN
      UPDATE product_categories 
      SET has_products = FALSE 
      WHERE id = target_category_id;
    END IF;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_has_products_delete ON products;
CREATE TRIGGER trg_update_has_products_delete
AFTER DELETE ON products
FOR EACH ROW EXECUTE FUNCTION update_has_products_on_delete();

-- 9. Trigger: Actualizar has_children cuando se elimina una subcategoría
CREATE OR REPLACE FUNCTION update_has_children_on_delete()
RETURNS TRIGGER AS $$
DECLARE
  remaining_children INTEGER;
BEGIN
  IF OLD.parent_id IS NOT NULL THEN
    SELECT COUNT(*) INTO remaining_children
    FROM product_categories
    WHERE parent_id = OLD.parent_id AND id != OLD.id;
    
    IF remaining_children = 0 THEN
      UPDATE product_categories 
      SET has_children = FALSE 
      WHERE id = OLD.parent_id;
    END IF;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_has_children_delete ON product_categories;
CREATE TRIGGER trg_update_has_children_delete
AFTER DELETE ON product_categories
FOR EACH ROW EXECUTE FUNCTION update_has_children_on_delete();

-- 10. Actualizar valores iniciales basados en datos existentes
-- Marcar categorías que ya tienen productos
UPDATE product_categories c
SET has_products = TRUE
WHERE EXISTS (
  SELECT 1 FROM products p 
  WHERE p.category_id = c.id OR p.subcategory_id = c.id
);

-- Marcar categorías que ya tienen hijos
UPDATE product_categories c
SET has_children = TRUE
WHERE EXISTS (
  SELECT 1 FROM product_categories child 
  WHERE child.parent_id = c.id
);

-- 11. Índices para performance
CREATE INDEX IF NOT EXISTS idx_categories_has_products 
ON product_categories(tenant_id, has_products);

CREATE INDEX IF NOT EXISTS idx_categories_has_children 
ON product_categories(tenant_id, has_children);

-- 12. Vista actualizada con info de reglas
CREATE OR REPLACE VIEW category_tree_v2 AS
SELECT 
  c.id,
  c.tenant_id,
  c.name,
  c.description,
  c.short_description,
  c.parent_id,
  c.level,
  c.path,
  c.sort_order,
  c.active,
  c.image_url,
  c.icon,
  c.max_stock,
  c.current_stock,
  c.has_products,
  c.has_children,
  c.created_at,
  p.name as parent_name,
  -- Determinar qué puede contener esta categoría
  CASE 
    WHEN c.has_children THEN 'subcategories'
    WHEN c.has_products THEN 'products'
    ELSE 'empty' -- Puede tener cualquiera
  END as content_type,
  -- Puede agregar productos?
  (NOT c.has_children) as can_add_products,
  -- Puede agregar subcategorías?
  (NOT c.has_products) as can_add_subcategories,
  -- Conteos
  (SELECT COUNT(*) FROM product_categories WHERE parent_id = c.id) as children_count,
  (SELECT COUNT(*) FROM products WHERE category_id = c.id OR subcategory_id = c.id) as products_count
FROM product_categories c
LEFT JOIN product_categories p ON c.parent_id = p.id
ORDER BY c.tenant_id, c.level, c.sort_order;

-- 13. Función para obtener productos de una categoría (incluyendo subcategorías)
CREATE OR REPLACE FUNCTION get_category_products(category_uuid UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  price DECIMAL,
  image_url TEXT,
  category_id UUID,
  subcategory_id UUID
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE cat_tree AS (
    -- Categoría inicial
    SELECT c.id FROM product_categories c WHERE c.id = category_uuid
    UNION ALL
    -- Subcategorías recursivas
    SELECT c.id FROM product_categories c
    INNER JOIN cat_tree ct ON c.parent_id = ct.id
  )
  SELECT 
    p.id,
    p.name,
    p.price,
    p.image_url,
    p.category_id,
    p.subcategory_id
  FROM products p
  WHERE p.category_id IN (SELECT id FROM cat_tree)
     OR p.subcategory_id IN (SELECT id FROM cat_tree);
END;
$$ LANGUAGE plpgsql;

-- 14. Comentarios de documentación
COMMENT ON COLUMN product_categories.has_products IS 
'TRUE si la categoría contiene productos directos. Se actualiza automáticamente.';

COMMENT ON COLUMN product_categories.has_children IS 
'TRUE si la categoría contiene subcategorías. Se actualiza automáticamente.';

COMMENT ON COLUMN product_categories.short_description IS 
'Descripción corta para mostrar en las cards de categoría en la tienda.';

COMMENT ON FUNCTION can_have_products(UUID) IS 
'Retorna TRUE si la categoría puede recibir productos (no tiene subcategorías).';

COMMENT ON FUNCTION can_have_subcategories(UUID) IS 
'Retorna TRUE si la categoría puede tener subcategorías (no tiene productos directos).';

COMMENT ON FUNCTION get_category_products(UUID) IS 
'Retorna todos los productos de una categoría, incluyendo los de subcategorías.';
