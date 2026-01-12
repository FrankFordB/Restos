-- =============================================
-- SIZE PRESETS SYSTEM
-- Sistema de talles predeterminados para productos
-- =============================================

-- 1) Tabla de presets de talles globales (disponibles para todos los usuarios)
CREATE TABLE IF NOT EXISTS public.size_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL, -- 'footwear', 'clothing', 'kids_footwear', 'kids_clothing', 'custom'
  region VARCHAR(50) DEFAULT 'latam', -- 'latam', 'us', 'eu', 'global'
  audience VARCHAR(20) DEFAULT 'adult', -- 'adult', 'kids', 'all'
  sizes JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{name: "S", priceModifier: 0}, ...]
  is_default BOOLEAN DEFAULT false, -- Si viene por defecto para nuevos usuarios
  is_global BOOLEAN DEFAULT true, -- Si está disponible para todos los tenants
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE, -- NULL = global
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_size_presets_tenant ON size_presets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_size_presets_category ON size_presets(category);
CREATE INDEX IF NOT EXISTS idx_size_presets_global ON size_presets(is_global) WHERE is_global = true;

-- Comentarios
COMMENT ON TABLE size_presets IS 'Presets de talles predefinidos para productos';
COMMENT ON COLUMN size_presets.category IS 'Tipo: footwear, clothing, kids_footwear, kids_clothing, custom';
COMMENT ON COLUMN size_presets.audience IS 'Público objetivo: adult, kids, all';
COMMENT ON COLUMN size_presets.sizes IS 'Array de talles: [{name, priceModifier}]';

-- 2) Trigger para updated_at
CREATE OR REPLACE FUNCTION update_size_presets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS size_presets_updated_at ON size_presets;
CREATE TRIGGER size_presets_updated_at
  BEFORE UPDATE ON size_presets
  FOR EACH ROW
  EXECUTE FUNCTION update_size_presets_updated_at();

-- 3) Insertar presets globales predeterminados

-- ===== CALZADO ADULTOS - LATINOAMÉRICA =====
INSERT INTO size_presets (name, category, region, audience, sizes, is_default, is_global, sort_order)
VALUES (
  'Zapatillas Adulto (AR/LATAM)',
  'footwear',
  'latam',
  'adult',
  '[
    {"name": "35", "priceModifier": 0},
    {"name": "36", "priceModifier": 0},
    {"name": "37", "priceModifier": 0},
    {"name": "38", "priceModifier": 0},
    {"name": "39", "priceModifier": 0},
    {"name": "40", "priceModifier": 0},
    {"name": "41", "priceModifier": 0},
    {"name": "42", "priceModifier": 0},
    {"name": "43", "priceModifier": 0},
    {"name": "44", "priceModifier": 0},
    {"name": "45", "priceModifier": 0}
  ]'::jsonb,
  true,
  true,
  1
) ON CONFLICT DO NOTHING;

-- ===== CALZADO NIÑOS - LATINOAMÉRICA =====
INSERT INTO size_presets (name, category, region, audience, sizes, is_default, is_global, sort_order)
VALUES (
  'Zapatillas Niños (AR/LATAM)',
  'kids_footwear',
  'latam',
  'kids',
  '[
    {"name": "17", "priceModifier": 0},
    {"name": "18", "priceModifier": 0},
    {"name": "19", "priceModifier": 0},
    {"name": "20", "priceModifier": 0},
    {"name": "21", "priceModifier": 0},
    {"name": "22", "priceModifier": 0},
    {"name": "23", "priceModifier": 0},
    {"name": "24", "priceModifier": 0},
    {"name": "25", "priceModifier": 0},
    {"name": "26", "priceModifier": 0},
    {"name": "27", "priceModifier": 0},
    {"name": "28", "priceModifier": 0},
    {"name": "29", "priceModifier": 0},
    {"name": "30", "priceModifier": 0},
    {"name": "31", "priceModifier": 0},
    {"name": "32", "priceModifier": 0},
    {"name": "33", "priceModifier": 0},
    {"name": "34", "priceModifier": 0}
  ]'::jsonb,
  true,
  true,
  2
) ON CONFLICT DO NOTHING;

-- ===== ROPA ADULTOS =====
INSERT INTO size_presets (name, category, region, audience, sizes, is_default, is_global, sort_order)
VALUES (
  'Ropa Adulto (S-XXL)',
  'clothing',
  'global',
  'adult',
  '[
    {"name": "XS", "priceModifier": 0},
    {"name": "S", "priceModifier": 0},
    {"name": "M", "priceModifier": 0},
    {"name": "L", "priceModifier": 0},
    {"name": "XL", "priceModifier": 0},
    {"name": "XXL", "priceModifier": 0},
    {"name": "XXXL", "priceModifier": 0}
  ]'::jsonb,
  true,
  true,
  3
) ON CONFLICT DO NOTHING;

-- ===== ROPA NIÑOS =====
INSERT INTO size_presets (name, category, region, audience, sizes, is_default, is_global, sort_order)
VALUES (
  'Ropa Niños (2-16 años)',
  'kids_clothing',
  'global',
  'kids',
  '[
    {"name": "2", "priceModifier": 0},
    {"name": "4", "priceModifier": 0},
    {"name": "6", "priceModifier": 0},
    {"name": "8", "priceModifier": 0},
    {"name": "10", "priceModifier": 0},
    {"name": "12", "priceModifier": 0},
    {"name": "14", "priceModifier": 0},
    {"name": "16", "priceModifier": 0}
  ]'::jsonb,
  true,
  true,
  4
) ON CONFLICT DO NOTHING;

-- ===== ROPA BEBÉS =====
INSERT INTO size_presets (name, category, region, audience, sizes, is_default, is_global, sort_order)
VALUES (
  'Ropa Bebés (0-24 meses)',
  'kids_clothing',
  'global',
  'kids',
  '[
    {"name": "0-3m", "priceModifier": 0},
    {"name": "3-6m", "priceModifier": 0},
    {"name": "6-9m", "priceModifier": 0},
    {"name": "9-12m", "priceModifier": 0},
    {"name": "12-18m", "priceModifier": 0},
    {"name": "18-24m", "priceModifier": 0}
  ]'::jsonb,
  true,
  true,
  5
) ON CONFLICT DO NOTHING;

-- ===== CALZADO US/EU =====
INSERT INTO size_presets (name, category, region, audience, sizes, is_default, is_global, sort_order)
VALUES (
  'Zapatillas US (Hombre)',
  'footwear',
  'us',
  'adult',
  '[
    {"name": "US 7", "priceModifier": 0},
    {"name": "US 7.5", "priceModifier": 0},
    {"name": "US 8", "priceModifier": 0},
    {"name": "US 8.5", "priceModifier": 0},
    {"name": "US 9", "priceModifier": 0},
    {"name": "US 9.5", "priceModifier": 0},
    {"name": "US 10", "priceModifier": 0},
    {"name": "US 10.5", "priceModifier": 0},
    {"name": "US 11", "priceModifier": 0},
    {"name": "US 11.5", "priceModifier": 0},
    {"name": "US 12", "priceModifier": 0},
    {"name": "US 13", "priceModifier": 0}
  ]'::jsonb,
  false,
  true,
  6
) ON CONFLICT DO NOTHING;

-- ===== PANTALONES ADULTOS =====
INSERT INTO size_presets (name, category, region, audience, sizes, is_default, is_global, sort_order)
VALUES (
  'Pantalones/Jeans (Talle numérico)',
  'clothing',
  'global',
  'adult',
  '[
    {"name": "28", "priceModifier": 0},
    {"name": "30", "priceModifier": 0},
    {"name": "32", "priceModifier": 0},
    {"name": "34", "priceModifier": 0},
    {"name": "36", "priceModifier": 0},
    {"name": "38", "priceModifier": 0},
    {"name": "40", "priceModifier": 0},
    {"name": "42", "priceModifier": 0},
    {"name": "44", "priceModifier": 0}
  ]'::jsonb,
  false,
  true,
  7
) ON CONFLICT DO NOTHING;

-- 4) Vista para obtener presets disponibles para un tenant
CREATE OR REPLACE VIEW available_size_presets AS
SELECT 
  sp.*,
  CASE 
    WHEN sp.is_global THEN 'Predeterminado'
    ELSE 'Personalizado'
  END as preset_type
FROM size_presets sp
WHERE sp.is_global = true
   OR sp.tenant_id IS NOT NULL
ORDER BY sp.is_global DESC, sp.sort_order;

-- 5) Función para obtener presets de un tenant
CREATE OR REPLACE FUNCTION get_size_presets_for_tenant(p_tenant_id UUID)
RETURNS TABLE (
  id UUID,
  name VARCHAR,
  category VARCHAR,
  region VARCHAR,
  audience VARCHAR,
  sizes JSONB,
  is_default BOOLEAN,
  is_global BOOLEAN,
  preset_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sp.id,
    sp.name,
    sp.category,
    sp.region,
    sp.audience,
    sp.sizes,
    sp.is_default,
    sp.is_global,
    CASE 
      WHEN sp.is_global THEN 'Predeterminado'
      ELSE 'Personalizado'
    END as preset_type
  FROM size_presets sp
  WHERE sp.is_global = true
     OR sp.tenant_id = p_tenant_id
  ORDER BY sp.is_global DESC, sp.sort_order;
END;
$$ LANGUAGE plpgsql;

-- 6) Función para duplicar preset global a tenant (personalizar)
CREATE OR REPLACE FUNCTION duplicate_size_preset_for_tenant(
  p_preset_id UUID,
  p_tenant_id UUID,
  p_new_name VARCHAR DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_new_id UUID;
  v_original size_presets%ROWTYPE;
BEGIN
  -- Obtener preset original
  SELECT * INTO v_original FROM size_presets WHERE id = p_preset_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Preset no encontrado';
  END IF;
  
  -- Crear copia para el tenant
  INSERT INTO size_presets (
    name, category, region, audience, sizes, 
    is_default, is_global, tenant_id, sort_order
  ) VALUES (
    COALESCE(p_new_name, v_original.name || ' (Personalizado)'),
    v_original.category,
    v_original.region,
    v_original.audience,
    v_original.sizes,
    false,
    false,
    p_tenant_id,
    (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM size_presets WHERE tenant_id = p_tenant_id)
  ) RETURNING id INTO v_new_id;
  
  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql;

-- 7) RLS Policies
ALTER TABLE size_presets ENABLE ROW LEVEL SECURITY;

-- Todos pueden ver presets globales
CREATE POLICY "Anyone can view global size presets"
  ON size_presets FOR SELECT
  USING (is_global = true);

-- Tenants pueden ver sus propios presets
CREATE POLICY "Tenants can view own size presets"
  ON size_presets FOR SELECT
  USING (tenant_id IN (
    SELECT p.tenant_id FROM profiles p WHERE p.user_id = auth.uid()
  ));

-- Tenants pueden crear sus propios presets
CREATE POLICY "Tenants can create own size presets"
  ON size_presets FOR INSERT
  WITH CHECK (
    is_global = false AND
    tenant_id IN (
      SELECT p.tenant_id FROM profiles p WHERE p.user_id = auth.uid()
    )
  );

-- Tenants pueden actualizar sus propios presets
CREATE POLICY "Tenants can update own size presets"
  ON size_presets FOR UPDATE
  USING (
    is_global = false AND
    tenant_id IN (
      SELECT p.tenant_id FROM profiles p WHERE p.user_id = auth.uid()
    )
  );

-- Tenants pueden eliminar sus propios presets
CREATE POLICY "Tenants can delete own size presets"
  ON size_presets FOR DELETE
  USING (
    is_global = false AND
    tenant_id IN (
      SELECT p.tenant_id FROM profiles p WHERE p.user_id = auth.uid()
    )
  );

-- Super admins pueden hacer todo
CREATE POLICY "Super admins can manage all size presets"
  ON size_presets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.user_id = auth.uid() AND p.role = 'super_admin'
    )
  );

SELECT 'Size presets system created successfully!' as result;
