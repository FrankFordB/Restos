-- =====================================================
-- FIX: Subcategory Rules and Hierarchical Stock System
-- =====================================================
-- 
-- Problema 1: La validación de subcategorías contaba productos en subcategorías
--             existentes como si estuvieran "en el padre"
-- 
-- Problema 2: El stock de categorías debe ser jerárquico - afectar a productos
--             en subcategorías y descontarse recursivamente
-- =====================================================

-- 1. Fix: Trigger para validar subcategorías correctamente
-- REGLA: Si ya hay subcategorías, SIEMPRE permitir agregar más
-- Solo bloquear si hay productos DIRECTOS y NO hay subcategorías existentes
CREATE OR REPLACE FUNCTION check_subcategory_rules()
RETURNS TRIGGER AS $$
DECLARE
  has_direct_products BOOLEAN;
  has_existing_subcategories BOOLEAN;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Verificar si el padre ya tiene subcategorías
  SELECT EXISTS (
    SELECT 1 FROM product_categories 
    WHERE parent_id = NEW.parent_id
  ) INTO has_existing_subcategories;
  
  -- REGLA PRINCIPAL: Si ya hay subcategorías, SIEMPRE permitir agregar más
  IF has_existing_subcategories THEN
    -- Marcar que el padre tiene hijos y permitir
    UPDATE product_categories 
    SET has_children = TRUE 
    WHERE id = NEW.parent_id;
    RETURN NEW;
  END IF;
  
  -- No hay subcategorías aún - verificar si hay productos DIRECTOS en el padre
  -- Un producto está "directamente" en el padre si:
  -- - category_id = parent_id Y subcategory_id IS NULL
  SELECT EXISTS (
    SELECT 1 FROM products 
    WHERE category_id = NEW.parent_id AND subcategory_id IS NULL
  ) INTO has_direct_products;
  
  IF has_direct_products THEN
    RAISE EXCEPTION 'Esta categoría tiene productos directos. Debes moverlos a una subcategoría primero.';
  END IF;
  
  -- Marcar que el padre ahora tiene hijos
  UPDATE product_categories 
  SET has_children = TRUE 
  WHERE id = NEW.parent_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recrear trigger
DROP TRIGGER IF EXISTS trg_check_subcategory ON product_categories;
DROP TRIGGER IF EXISTS trg_check_subcategory_rules ON product_categories;
CREATE TRIGGER trg_check_subcategory_rules
BEFORE INSERT ON product_categories
FOR EACH ROW 
WHEN (NEW.parent_id IS NOT NULL)
EXECUTE FUNCTION check_subcategory_rules();

-- 2. Función para obtener el ID de la categoría padre raíz (con stock) de un producto
CREATE OR REPLACE FUNCTION get_product_root_category_with_stock(product_uuid UUID)
RETURNS TABLE (
  category_id UUID,
  category_name TEXT,
  current_stock INTEGER,
  max_stock INTEGER,
  level INTEGER
) AS $$
DECLARE
  prod_category_id UUID;
  prod_subcategory_id UUID;
  start_category_id UUID;
BEGIN
  -- Obtener IDs de categoría del producto
  SELECT p.category_id, p.subcategory_id 
  INTO prod_category_id, prod_subcategory_id
  FROM products p
  WHERE p.id = product_uuid;
  
  -- Determinar desde dónde empezar (subcategory o category)
  start_category_id := COALESCE(prod_subcategory_id, prod_category_id);
  
  IF start_category_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Buscar hacia arriba todas las categorías con stock configurado
  RETURN QUERY
  WITH RECURSIVE category_ancestors AS (
    -- Empezar desde la categoría directa del producto
    SELECT 
      c.id,
      c.name,
      c.current_stock,
      c.max_stock,
      c.parent_id,
      c.level
    FROM product_categories c
    WHERE c.id = start_category_id
    
    UNION ALL
    
    -- Subir recursivamente a los padres
    SELECT 
      c.id,
      c.name,
      c.current_stock,
      c.max_stock,
      c.parent_id,
      c.level
    FROM product_categories c
    INNER JOIN category_ancestors ca ON c.id = ca.parent_id
  )
  SELECT 
    ca.id as category_id,
    ca.name as category_name,
    ca.current_stock::INTEGER,
    ca.max_stock::INTEGER,
    ca.level::INTEGER
  FROM category_ancestors ca
  WHERE ca.max_stock IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- 3. Función para validar stock jerárquico antes de crear orden
CREATE OR REPLACE FUNCTION validate_hierarchical_category_stock(
  tenant_uuid UUID,
  items JSONB -- Array de {productId, quantity}
)
RETURNS TABLE (
  valid BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  item_record RECORD;
  prod_id UUID;
  qty INTEGER;
  cat_record RECORD;
  category_quantities JSONB := '{}'::JSONB;
  final_quantity INTEGER;
  current_qty INTEGER;
BEGIN
  -- Acumular cantidades por categoría (todas las categorías ancestro con stock)
  FOR item_record IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    prod_id := (item_record.value->>'productId')::UUID;
    qty := COALESCE((item_record.value->>'quantity')::INTEGER, 1);
    
    -- Para cada categoría con stock en la jerarquía de este producto
    FOR cat_record IN 
      SELECT * FROM get_product_root_category_with_stock(prod_id)
    LOOP
      current_qty := COALESCE((category_quantities->>cat_record.category_id::TEXT)::INTEGER, 0);
      category_quantities := jsonb_set(
        category_quantities,
        ARRAY[cat_record.category_id::TEXT],
        to_jsonb(current_qty + qty)
      );
    END LOOP;
  END LOOP;
  
  -- Validar cada categoría
  FOR cat_record IN 
    SELECT 
      key::UUID as cat_id,
      value::INTEGER as requested_qty
    FROM jsonb_each_text(category_quantities)
  LOOP
    SELECT c.name, c.current_stock, c.max_stock
    INTO final_quantity
    FROM product_categories c
    WHERE c.id = cat_record.cat_id;
    
    -- Obtener info de la categoría
    SELECT 
      c.name,
      c.current_stock
    INTO cat_record
    FROM product_categories c
    WHERE c.id = cat_record.cat_id;
    
    IF cat_record.current_stock IS NOT NULL AND cat_record.requested_qty > cat_record.current_stock THEN
      valid := FALSE;
      error_message := format(
        'Stock insuficiente de %s: quedan %s, se pidieron %s',
        cat_record.name,
        cat_record.current_stock,
        cat_record.requested_qty
      );
      RETURN NEXT;
      RETURN;
    END IF;
  END LOOP;
  
  valid := TRUE;
  error_message := NULL;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- 4. Función para decrementar stock jerárquico
-- Decrementa el stock de la categoría directa Y de todos sus ancestros
CREATE OR REPLACE FUNCTION decrement_hierarchical_category_stock(
  category_uuid UUID,
  quantity INTEGER
)
RETURNS TABLE (
  category_id UUID,
  category_name TEXT,
  old_stock INTEGER,
  new_stock INTEGER
) AS $$
DECLARE
  cat_record RECORD;
  old_stock_val INTEGER;
  new_stock_val INTEGER;
BEGIN
  -- Obtener la categoría y todos sus ancestros
  FOR cat_record IN
    WITH RECURSIVE category_ancestors AS (
      SELECT 
        c.id,
        c.name,
        c.current_stock,
        c.max_stock,
        c.parent_id
      FROM product_categories c
      WHERE c.id = category_uuid
      
      UNION ALL
      
      SELECT 
        c.id,
        c.name,
        c.current_stock,
        c.max_stock,
        c.parent_id
      FROM product_categories c
      INNER JOIN category_ancestors ca ON c.id = ca.parent_id
    )
    SELECT * FROM category_ancestors
    WHERE max_stock IS NOT NULL  -- Solo categorías con stock configurado
  LOOP
    old_stock_val := cat_record.current_stock;
    new_stock_val := GREATEST(0, COALESCE(cat_record.current_stock, 0) - quantity);
    
    -- Actualizar stock
    UPDATE product_categories 
    SET current_stock = new_stock_val
    WHERE id = cat_record.id;
    
    -- Retornar info
    category_id := cat_record.id;
    category_name := cat_record.name;
    old_stock := old_stock_val;
    new_stock := new_stock_val;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 5. Función mejorada para decrementar stock por productos vendidos
-- Ahora considera la jerarquía completa
CREATE OR REPLACE FUNCTION decrement_category_stock_by_products(
  tenant_uuid UUID,
  items JSONB -- Array de {productId, quantity}
)
RETURNS TABLE (
  category_id UUID,
  category_name TEXT,
  old_stock INTEGER,
  new_stock INTEGER
) AS $$
DECLARE
  item_record RECORD;
  prod_id UUID;
  qty INTEGER;
  prod_category_id UUID;
  prod_subcategory_id UUID;
  target_category_id UUID;
BEGIN
  FOR item_record IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    prod_id := (item_record.value->>'productId')::UUID;
    qty := COALESCE((item_record.value->>'quantity')::INTEGER, 1);
    
    -- Obtener la categoría del producto
    SELECT p.category_id, p.subcategory_id 
    INTO prod_category_id, prod_subcategory_id
    FROM products p
    WHERE p.id = prod_id;
    
    -- Usar subcategory si existe, sino category
    target_category_id := COALESCE(prod_subcategory_id, prod_category_id);
    
    IF target_category_id IS NOT NULL THEN
      -- Decrementar stock jerárquicamente
      RETURN QUERY 
      SELECT * FROM decrement_hierarchical_category_stock(target_category_id, qty);
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 6. Función para obtener el stock efectivo de una categoría
-- Considera el mínimo entre su propio stock y el de sus ancestros
CREATE OR REPLACE FUNCTION get_effective_category_stock(category_uuid UUID)
RETURNS TABLE (
  effective_stock INTEGER,
  limiting_category_id UUID,
  limiting_category_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE category_ancestors AS (
    SELECT 
      c.id,
      c.name,
      c.current_stock,
      c.max_stock,
      c.parent_id
    FROM product_categories c
    WHERE c.id = category_uuid
    
    UNION ALL
    
    SELECT 
      c.id,
      c.name,
      c.current_stock,
      c.max_stock,
      c.parent_id
    FROM product_categories c
    INNER JOIN category_ancestors ca ON c.id = ca.parent_id
  )
  SELECT 
    ca.current_stock::INTEGER as effective_stock,
    ca.id as limiting_category_id,
    ca.name as limiting_category_name
  FROM category_ancestors ca
  WHERE ca.max_stock IS NOT NULL
  ORDER BY ca.current_stock ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- 7. Actualizar has_products para que solo cuente productos DIRECTOS
-- (no productos en subcategorías)
CREATE OR REPLACE FUNCTION update_has_products_correctly()
RETURNS TRIGGER AS $$
DECLARE
  target_category_id UUID;
  has_direct_products BOOLEAN;
BEGIN
  -- Determinar la categoría afectada
  IF TG_OP = 'DELETE' THEN
    target_category_id := COALESCE(OLD.subcategory_id, OLD.category_id);
  ELSE
    target_category_id := COALESCE(NEW.subcategory_id, NEW.category_id);
  END IF;
  
  IF target_category_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Verificar si hay productos directamente en esta categoría
  SELECT EXISTS (
    SELECT 1 FROM products
    WHERE (
      (category_id = target_category_id AND subcategory_id IS NULL)
      OR subcategory_id = target_category_id
    )
    AND CASE WHEN TG_OP = 'DELETE' THEN id != OLD.id ELSE TRUE END
  ) INTO has_direct_products;
  
  -- Actualizar flag
  UPDATE product_categories 
  SET has_products = has_direct_products
  WHERE id = target_category_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Recrear triggers para has_products
DROP TRIGGER IF EXISTS trg_update_has_products ON products;
DROP TRIGGER IF EXISTS trg_update_has_products_delete ON products;

CREATE TRIGGER trg_update_has_products
AFTER INSERT OR UPDATE OF category_id, subcategory_id ON products
FOR EACH ROW EXECUTE FUNCTION update_has_products_correctly();

CREATE TRIGGER trg_update_has_products_delete
AFTER DELETE ON products
FOR EACH ROW EXECUTE FUNCTION update_has_products_correctly();

-- 8. Corregir has_products para categorías existentes
-- Solo marcar TRUE si tienen productos DIRECTAMENTE (no en subcategorías)
UPDATE product_categories c
SET has_products = EXISTS (
  SELECT 1 FROM products p 
  WHERE (
    (p.category_id = c.id AND p.subcategory_id IS NULL)
    OR p.subcategory_id = c.id
  )
);

-- 9. Comentarios de documentación
COMMENT ON FUNCTION get_product_root_category_with_stock(UUID) IS 
'Retorna todas las categorías ancestro de un producto que tienen stock configurado.';

COMMENT ON FUNCTION validate_hierarchical_category_stock(UUID, JSONB) IS 
'Valida que haya stock suficiente en todas las categorías de la jerarquía para los items.';

COMMENT ON FUNCTION decrement_hierarchical_category_stock(UUID, INTEGER) IS 
'Decrementa el stock de una categoría Y de todos sus ancestros que tengan stock configurado.';

COMMENT ON FUNCTION get_effective_category_stock(UUID) IS 
'Retorna el stock efectivo de una categoría considerando el mínimo de toda la jerarquía.';

-- 10. Vista para obtener categorías elegibles para stock
-- Solo categorías "hoja" (sin subcategorías) que tienen productos
CREATE OR REPLACE VIEW categories_eligible_for_stock AS
SELECT 
  c.id,
  c.tenant_id,
  c.name,
  c.max_stock,
  c.current_stock,
  c.parent_id,
  c.level,
  (SELECT COUNT(*) FROM products p 
   WHERE p.category_id = c.id OR p.subcategory_id = c.id) as product_count
FROM product_categories c
WHERE 
  -- No tiene subcategorías
  NOT c.has_children
  AND NOT EXISTS (SELECT 1 FROM product_categories child WHERE child.parent_id = c.id)
  -- Tiene productos directamente
  AND EXISTS (
    SELECT 1 FROM products p 
    WHERE p.category_id = c.id OR p.subcategory_id = c.id
  );

COMMENT ON VIEW categories_eligible_for_stock IS 
'Categorías que pueden tener stock configurado: sin subcategorías y con productos directos.';
