-- =============================================
-- ADD CATEGORY_IDS TO EXTRA_GROUPS
-- Permite asignar grupos de extras a categorías específicas
-- =============================================

-- Agregar columna category_ids (array de UUIDs)
-- NULL o vacío = aplica a todas las categorías
ALTER TABLE extra_groups 
ADD COLUMN IF NOT EXISTS category_ids UUID[] DEFAULT NULL;

-- Crear índice GIN para búsquedas eficientes en el array
CREATE INDEX IF NOT EXISTS idx_extra_groups_category_ids 
ON extra_groups USING GIN (category_ids);

-- Comentario para documentación
COMMENT ON COLUMN extra_groups.category_ids IS 
'Array de IDs de categorías donde este grupo de extras está disponible. NULL o vacío significa que aplica a todas las categorías.';
