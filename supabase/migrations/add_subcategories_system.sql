-- =============================================
-- SISTEMA DE SUBCATEGORÍAS JERÁRQUICAS
-- Migración para agregar soporte de categorías padre/hijo
-- =============================================

-- 1. Agregar columnas para jerarquía
-- parent_id: referencia a la categoría padre (NULL = categoría principal)
-- level: profundidad en el árbol (0 = raíz, 1 = subcategoría, etc.)
-- path: ruta completa para breadcrumbs y consultas eficientes
-- image_url: imagen representativa de la categoría
-- icon: icono opcional (nombre o emoji)

ALTER TABLE product_categories
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES product_categories(id) ON DELETE CASCADE;

ALTER TABLE product_categories
ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 0;

ALTER TABLE product_categories
ADD COLUMN IF NOT EXISTS path TEXT;

ALTER TABLE product_categories
ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE product_categories
ADD COLUMN IF NOT EXISTS icon TEXT;

-- 2. Índices para performance en consultas jerárquicas
CREATE INDEX IF NOT EXISTS idx_categories_parent 
ON product_categories(parent_id);

CREATE INDEX IF NOT EXISTS idx_categories_level 
ON product_categories(tenant_id, level);

CREATE INDEX IF NOT EXISTS idx_categories_path 
ON product_categories(path);

CREATE INDEX IF NOT EXISTS idx_categories_tenant_parent 
ON product_categories(tenant_id, parent_id, sort_order);

-- 3. Función para actualizar path y level automáticamente
CREATE OR REPLACE FUNCTION update_category_path()
RETURNS TRIGGER AS $$
DECLARE
  parent_path TEXT;
  parent_level INTEGER;
BEGIN
  IF NEW.parent_id IS NULL THEN
    -- Categoría raíz
    NEW.level := 0;
    NEW.path := NEW.id::TEXT;
  ELSE
    -- Subcategoría: obtener path y level del padre
    SELECT level, path
    INTO parent_level, parent_path
    FROM product_categories
    WHERE id = NEW.parent_id;
    
    IF parent_path IS NULL THEN
      -- Padre no tiene path, usar solo su ID
      parent_path := NEW.parent_id::TEXT;
      parent_level := 0;
    END IF;
    
    NEW.level := parent_level + 1;
    NEW.path := parent_path || '/' || NEW.id::TEXT;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger para INSERT y UPDATE de parent_id
DROP TRIGGER IF EXISTS trg_category_path ON product_categories;
CREATE TRIGGER trg_category_path
BEFORE INSERT OR UPDATE OF parent_id ON product_categories
FOR EACH ROW EXECUTE FUNCTION update_category_path();

-- 5. Función para actualizar paths de todos los descendientes cuando se mueve una categoría
CREATE OR REPLACE FUNCTION update_descendant_paths()
RETURNS TRIGGER AS $$
BEGIN
  -- Si cambió el parent_id, actualizar todos los descendientes
  IF OLD.parent_id IS DISTINCT FROM NEW.parent_id OR OLD.path IS DISTINCT FROM NEW.path THEN
    -- Actualizar recursivamente todos los hijos
    WITH RECURSIVE descendants AS (
      -- Hijos directos
      SELECT id, parent_id
      FROM product_categories
      WHERE parent_id = NEW.id
      
      UNION ALL
      
      -- Descendientes recursivos
      SELECT c.id, c.parent_id
      FROM product_categories c
      INNER JOIN descendants d ON c.parent_id = d.id
    )
    UPDATE product_categories c
    SET 
      path = (
        SELECT 
          CASE 
            WHEN p.path IS NOT NULL THEN p.path || '/' || c.id::TEXT
            ELSE c.id::TEXT
          END
        FROM product_categories p
        WHERE p.id = c.parent_id
      ),
      level = (
        SELECT p.level + 1
        FROM product_categories p
        WHERE p.id = c.parent_id
      )
    FROM descendants d
    WHERE c.id = d.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar descendientes
DROP TRIGGER IF EXISTS trg_update_descendants ON product_categories;
CREATE TRIGGER trg_update_descendants
AFTER UPDATE OF parent_id, path ON product_categories
FOR EACH ROW EXECUTE FUNCTION update_descendant_paths();

-- 6. Actualizar categorías existentes (sin parent = nivel 0)
UPDATE product_categories
SET level = 0, path = id::TEXT
WHERE parent_id IS NULL AND (path IS NULL OR path = '');

-- 7. Vista útil para obtener árbol completo con info del padre
CREATE OR REPLACE VIEW category_tree AS
SELECT 
  c.id,
  c.tenant_id,
  c.name,
  c.description,
  c.parent_id,
  c.level,
  c.path,
  c.sort_order,
  c.active,
  c.image_url,
  c.icon,
  c.max_stock,
  c.current_stock,
  c.created_at,
  p.name as parent_name,
  (SELECT COUNT(*) FROM product_categories WHERE parent_id = c.id) as children_count,
  (SELECT COUNT(*) FROM products WHERE category = c.name OR category_id = c.id) as products_count
FROM product_categories c
LEFT JOIN product_categories p ON c.parent_id = p.id
ORDER BY c.tenant_id, c.level, c.sort_order;

-- 8. Función para obtener todas las subcategorías de una categoría (recursivo)
CREATE OR REPLACE FUNCTION get_category_descendants(category_uuid UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  level INTEGER,
  path TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE descendants AS (
    SELECT c.id, c.name, c.level, c.path
    FROM product_categories c
    WHERE c.id = category_uuid
    
    UNION ALL
    
    SELECT c.id, c.name, c.level, c.path
    FROM product_categories c
    INNER JOIN descendants d ON c.parent_id = d.id
  )
  SELECT * FROM descendants;
END;
$$ LANGUAGE plpgsql;

-- 9. Función para obtener el breadcrumb de una categoría (ruta hasta raíz)
CREATE OR REPLACE FUNCTION get_category_breadcrumb(category_uuid UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  level INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE ancestors AS (
    SELECT c.id, c.name, c.level, c.parent_id
    FROM product_categories c
    WHERE c.id = category_uuid
    
    UNION ALL
    
    SELECT c.id, c.name, c.level, c.parent_id
    FROM product_categories c
    INNER JOIN ancestors a ON c.id = a.parent_id
  )
  SELECT a.id, a.name, a.level
  FROM ancestors a
  ORDER BY a.level ASC;
END;
$$ LANGUAGE plpgsql;

-- 10. Comentarios de documentación
COMMENT ON COLUMN product_categories.parent_id IS 
'UUID de la categoría padre. NULL indica categoría principal/raíz.';

COMMENT ON COLUMN product_categories.level IS 
'Nivel de profundidad en la jerarquía. 0 = raíz, 1 = subcategoría, 2 = sub-subcategoría, etc.';

COMMENT ON COLUMN product_categories.path IS 
'Ruta completa de IDs separados por "/" para consultas eficientes y breadcrumbs.';

COMMENT ON FUNCTION get_category_descendants(UUID) IS 
'Retorna todas las subcategorías de una categoría, incluyendo descendientes recursivos.';

COMMENT ON FUNCTION get_category_breadcrumb(UUID) IS 
'Retorna la ruta desde la raíz hasta la categoría especificada (breadcrumb).';
