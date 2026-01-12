-- =============================================
-- MIGRACIÓN: Sistema de Talles/Sizes y Descuentos para Productos
-- =============================================

-- =============================================
-- PARTE 1: DESCUENTOS
-- =============================================

-- 1. Agregar columna de descuento a productos
ALTER TABLE products
ADD COLUMN IF NOT EXISTS discount DECIMAL(5,2) DEFAULT NULL
CHECK (discount IS NULL OR (discount >= 0 AND discount <= 100));

COMMENT ON COLUMN products.discount IS 
'Porcentaje de descuento del producto (0-100). NULL significa sin descuento.';

-- 2. Vista para calcular precio final con descuento
CREATE OR REPLACE FUNCTION calculate_discounted_price(original_price DECIMAL, discount_percent DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
  IF discount_percent IS NULL OR discount_percent = 0 THEN
    RETURN original_price;
  END IF;
  RETURN ROUND(original_price * (1 - discount_percent / 100), 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_discounted_price IS 
'Calcula el precio final aplicando el porcentaje de descuento.';

-- =============================================
-- PARTE 2: SISTEMA DE TALLES/SIZES
-- =============================================

-- 3. Agregar columnas para talles en productos
ALTER TABLE products
ADD COLUMN IF NOT EXISTS has_sizes BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS sizes JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS size_required BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN products.has_sizes IS 
'TRUE si el producto tiene variantes de talle/tamaño.';

COMMENT ON COLUMN products.sizes IS 
'Array JSON de talles: [{id, name, priceModifier, active}]. priceModifier puede ser positivo o negativo.';

COMMENT ON COLUMN products.size_required IS 
'TRUE si el cliente debe elegir un talle al agregar el producto.';

-- 4. Función para validar estructura de talles
CREATE OR REPLACE FUNCTION validate_product_sizes()
RETURNS TRIGGER AS $$
DECLARE
  size_item JSONB;
  size_name TEXT;
BEGIN
  -- Si no tiene talles, limpiar el array
  IF NEW.has_sizes = FALSE OR NEW.has_sizes IS NULL THEN
    NEW.sizes := '[]'::jsonb;
    RETURN NEW;
  END IF;
  
  -- Validar que sizes sea un array
  IF jsonb_typeof(NEW.sizes) != 'array' THEN
    RAISE EXCEPTION 'El campo sizes debe ser un array JSON';
  END IF;
  
  -- Validar cada elemento del array
  FOR size_item IN SELECT * FROM jsonb_array_elements(NEW.sizes)
  LOOP
    -- Verificar campos requeridos
    IF NOT (size_item ? 'name') THEN
      RAISE EXCEPTION 'Cada talle debe tener un campo "name"';
    END IF;
    
    size_name := size_item->>'name';
    IF size_name IS NULL OR TRIM(size_name) = '' THEN
      RAISE EXCEPTION 'El nombre del talle no puede estar vacío';
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger para validar talles antes de guardar
DROP TRIGGER IF EXISTS trg_validate_product_sizes ON products;
CREATE TRIGGER trg_validate_product_sizes
BEFORE INSERT OR UPDATE ON products
FOR EACH ROW
WHEN (NEW.has_sizes = TRUE)
EXECUTE FUNCTION validate_product_sizes();

-- 6. Función helper para agregar un talle a un producto
CREATE OR REPLACE FUNCTION add_product_size(
  p_product_id UUID,
  p_size_name TEXT,
  p_price_modifier DECIMAL DEFAULT 0,
  p_active BOOLEAN DEFAULT TRUE
)
RETURNS JSONB AS $$
DECLARE
  new_size JSONB;
  updated_sizes JSONB;
BEGIN
  -- Crear el nuevo talle
  new_size := jsonb_build_object(
    'id', 'size_' || gen_random_uuid()::text,
    'name', p_size_name,
    'priceModifier', p_price_modifier,
    'active', p_active
  );
  
  -- Agregar al array existente
  UPDATE products
  SET 
    has_sizes = TRUE,
    sizes = COALESCE(sizes, '[]'::jsonb) || new_size
  WHERE id = p_product_id
  RETURNING sizes INTO updated_sizes;
  
  RETURN updated_sizes;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION add_product_size IS 
'Agrega un nuevo talle a un producto. Retorna el array actualizado de talles.';

-- 7. Función helper para eliminar un talle de un producto
CREATE OR REPLACE FUNCTION remove_product_size(
  p_product_id UUID,
  p_size_id TEXT
)
RETURNS JSONB AS $$
DECLARE
  updated_sizes JSONB;
  sizes_count INT;
BEGIN
  -- Filtrar el talle del array
  UPDATE products
  SET sizes = (
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    FROM jsonb_array_elements(sizes) elem
    WHERE elem->>'id' != p_size_id
  )
  WHERE id = p_product_id
  RETURNING sizes INTO updated_sizes;
  
  -- Si no quedan talles, desactivar has_sizes
  SELECT jsonb_array_length(updated_sizes) INTO sizes_count;
  IF sizes_count = 0 THEN
    UPDATE products SET has_sizes = FALSE WHERE id = p_product_id;
  END IF;
  
  RETURN updated_sizes;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION remove_product_size IS 
'Elimina un talle de un producto por su ID. Retorna el array actualizado.';

-- 8. Función para obtener precio final de un producto con talle específico
CREATE OR REPLACE FUNCTION get_product_price_with_size(
  p_product_id UUID,
  p_size_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  base_price DECIMAL,
  size_modifier DECIMAL,
  discount_percent DECIMAL,
  final_price DECIMAL,
  size_name TEXT
) AS $$
DECLARE
  product_record RECORD;
  size_record JSONB;
  modifier DECIMAL := 0;
  s_name TEXT := NULL;
BEGIN
  -- Obtener producto
  SELECT p.price, p.discount, p.sizes, p.has_sizes
  INTO product_record
  FROM products p
  WHERE p.id = p_product_id;
  
  -- Si tiene talle seleccionado, buscar modificador
  IF p_size_id IS NOT NULL AND product_record.has_sizes THEN
    SELECT elem INTO size_record
    FROM jsonb_array_elements(product_record.sizes) elem
    WHERE elem->>'id' = p_size_id
    LIMIT 1;
    
    IF size_record IS NOT NULL THEN
      modifier := COALESCE((size_record->>'priceModifier')::DECIMAL, 0);
      s_name := size_record->>'name';
    END IF;
  END IF;
  
  -- Calcular precio final
  RETURN QUERY SELECT
    product_record.price AS base_price,
    modifier AS size_modifier,
    product_record.discount AS discount_percent,
    calculate_discounted_price(product_record.price + modifier, product_record.discount) AS final_price,
    s_name AS size_name;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_product_price_with_size IS 
'Calcula el precio final de un producto considerando talle y descuento.';

-- =============================================
-- PARTE 3: ÍNDICES PARA PERFORMANCE
-- =============================================

-- 9. Índice para productos con descuento (para filtrar ofertas)
CREATE INDEX IF NOT EXISTS idx_products_with_discount 
ON products(tenant_id, discount) 
WHERE discount IS NOT NULL AND discount > 0;

-- 10. Índice para productos con talles
CREATE INDEX IF NOT EXISTS idx_products_with_sizes 
ON products(tenant_id, has_sizes) 
WHERE has_sizes = TRUE;

-- 11. Índice GIN para búsqueda en talles (JSONB)
CREATE INDEX IF NOT EXISTS idx_products_sizes_gin 
ON products USING GIN (sizes) 
WHERE has_sizes = TRUE;

-- =============================================
-- PARTE 4: VISTAS ÚTILES
-- =============================================

-- 12. Vista de productos con descuento activo
CREATE OR REPLACE VIEW products_with_active_discount AS
SELECT 
  p.*,
  calculate_discounted_price(p.price, p.discount) as discounted_price,
  ROUND(p.price - calculate_discounted_price(p.price, p.discount), 2) as savings
FROM products p
WHERE p.discount IS NOT NULL 
  AND p.discount > 0 
  AND p.active = TRUE;

COMMENT ON VIEW products_with_active_discount IS 
'Productos activos que tienen descuento aplicado.';

-- 13. Vista de productos con talles expandidos
CREATE OR REPLACE VIEW products_with_sizes_expanded AS
SELECT 
  p.id as product_id,
  p.tenant_id,
  p.name as product_name,
  p.price as base_price,
  p.discount,
  size_elem->>'id' as size_id,
  size_elem->>'name' as size_name,
  COALESCE((size_elem->>'priceModifier')::DECIMAL, 0) as price_modifier,
  COALESCE((size_elem->>'active')::BOOLEAN, TRUE) as size_active,
  p.price + COALESCE((size_elem->>'priceModifier')::DECIMAL, 0) as size_price,
  calculate_discounted_price(
    p.price + COALESCE((size_elem->>'priceModifier')::DECIMAL, 0), 
    p.discount
  ) as size_final_price
FROM products p
CROSS JOIN LATERAL jsonb_array_elements(p.sizes) as size_elem
WHERE p.has_sizes = TRUE 
  AND p.active = TRUE;

COMMENT ON VIEW products_with_sizes_expanded IS 
'Vista que expande los talles de cada producto en filas individuales.';

-- =============================================
-- PARTE 5: MIGRACIÓN DE DATOS EXISTENTES
-- =============================================

-- 14. Asegurar que productos existentes tengan valores válidos
UPDATE products 
SET 
  has_sizes = FALSE,
  sizes = '[]'::jsonb,
  size_required = TRUE
WHERE has_sizes IS NULL;

-- 15. Limpiar descuentos inválidos
UPDATE products 
SET discount = NULL 
WHERE discount IS NOT NULL AND (discount < 0 OR discount > 100);

-- =============================================
-- PARTE 6: RLS (Row Level Security) para nuevas columnas
-- =============================================

-- Las políticas RLS existentes de products ya cubren las nuevas columnas
-- No se requieren políticas adicionales

-- =============================================
-- DOCUMENTACIÓN FINAL
-- =============================================

/*
EJEMPLOS DE USO:

-- Agregar talles a un producto:
SELECT add_product_size('uuid-del-producto', 'S', -500);  -- Talle S, $500 menos
SELECT add_product_size('uuid-del-producto', 'M', 0);     -- Talle M, precio base
SELECT add_product_size('uuid-del-producto', 'L', 500);   -- Talle L, $500 más
SELECT add_product_size('uuid-del-producto', 'XL', 1000); -- Talle XL, $1000 más

-- Insertar producto con talles directamente:
INSERT INTO products (tenant_id, name, price, has_sizes, sizes, discount)
VALUES (
  'uuid-tenant',
  'Remera Básica',
  2500.00,
  TRUE,
  '[
    {"id": "size_1", "name": "S", "priceModifier": -200, "active": true},
    {"id": "size_2", "name": "M", "priceModifier": 0, "active": true},
    {"id": "size_3", "name": "L", "priceModifier": 200, "active": true},
    {"id": "size_4", "name": "XL", "priceModifier": 400, "active": true}
  ]'::jsonb,
  15  -- 15% de descuento
);

-- Obtener precio final con talle:
SELECT * FROM get_product_price_with_size('uuid-producto', 'size_3');

-- Ver todos los productos con descuento:
SELECT * FROM products_with_active_discount WHERE tenant_id = 'uuid-tenant';

-- Ver talles expandidos:
SELECT * FROM products_with_sizes_expanded WHERE tenant_id = 'uuid-tenant';
*/
