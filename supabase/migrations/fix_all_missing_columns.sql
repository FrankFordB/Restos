-- =============================================
-- FIX ALL MISSING COLUMNS - RUN THIS FIRST
-- =============================================
-- Este script agrega todas las columnas que podrían faltar

-- ===== TENANT_THEMES =====
-- Columnas base
ALTER TABLE tenant_themes ADD COLUMN IF NOT EXISTS font_family TEXT DEFAULT 'Inter';
ALTER TABLE tenant_themes ADD COLUMN IF NOT EXISTS card_style TEXT DEFAULT 'glass';
ALTER TABLE tenant_themes ADD COLUMN IF NOT EXISTS button_style TEXT DEFAULT 'rounded';
ALTER TABLE tenant_themes ADD COLUMN IF NOT EXISTS layout_style TEXT DEFAULT 'modern';
ALTER TABLE tenant_themes ADD COLUMN IF NOT EXISTS product_card_layout TEXT DEFAULT 'classic';
ALTER TABLE tenant_themes ADD COLUMN IF NOT EXISTS category_card_layout VARCHAR(50) DEFAULT 'grid';

-- Columnas de cards
ALTER TABLE tenant_themes ADD COLUMN IF NOT EXISTS card_bg TEXT;
ALTER TABLE tenant_themes ADD COLUMN IF NOT EXISTS card_text TEXT;
ALTER TABLE tenant_themes ADD COLUMN IF NOT EXISTS card_desc TEXT;
ALTER TABLE tenant_themes ADD COLUMN IF NOT EXISTS card_price TEXT;
ALTER TABLE tenant_themes ADD COLUMN IF NOT EXISTS card_button TEXT;

-- Columnas de hero
ALTER TABLE tenant_themes ADD COLUMN IF NOT EXISTS hero_style TEXT DEFAULT 'simple';
ALTER TABLE tenant_themes ADD COLUMN IF NOT EXISTS hero_slides JSONB DEFAULT '[]'::jsonb;
ALTER TABLE tenant_themes ADD COLUMN IF NOT EXISTS hero_title_position TEXT DEFAULT 'center';
ALTER TABLE tenant_themes ADD COLUMN IF NOT EXISTS hero_overlay_opacity INTEGER DEFAULT 50;
ALTER TABLE tenant_themes ADD COLUMN IF NOT EXISTS hero_show_title BOOLEAN DEFAULT true;
ALTER TABLE tenant_themes ADD COLUMN IF NOT EXISTS hero_show_subtitle BOOLEAN DEFAULT true;
ALTER TABLE tenant_themes ADD COLUMN IF NOT EXISTS hero_show_cta BOOLEAN DEFAULT true;
ALTER TABLE tenant_themes ADD COLUMN IF NOT EXISTS hero_carousel_button_style TEXT DEFAULT 'dots';

-- ===== PRODUCT_CATEGORIES =====
-- Columnas de subcategorías
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES product_categories(id) ON DELETE SET NULL;
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 0;
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS path TEXT;
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS short_description TEXT;
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS has_products BOOLEAN DEFAULT false;
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS has_children BOOLEAN DEFAULT false;

-- ===== PRODUCTS =====
-- Columnas de descuento y talles
ALTER TABLE products ADD COLUMN IF NOT EXISTS discount INTEGER DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS has_sizes BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS size_required BOOLEAN DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sizes JSONB DEFAULT '[]'::jsonb;

-- Constraint para descuento
DO $$ BEGIN
  ALTER TABLE products ADD CONSTRAINT products_discount_range CHECK (discount IS NULL OR (discount >= 0 AND discount <= 100));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Comentarios
COMMENT ON COLUMN tenant_themes.category_card_layout IS 'Layout style: grid, horizontal, circle, chips, overlay, magazine, minimal, polaroid, banner';
COMMENT ON COLUMN product_categories.image_url IS 'URL de imagen de la categoría';
COMMENT ON COLUMN product_categories.short_description IS 'Descripción corta para cards';
COMMENT ON COLUMN product_categories.icon IS 'Emoji o icono de la categoría';
COMMENT ON COLUMN products.discount IS 'Porcentaje de descuento (0-100)';
COMMENT ON COLUMN products.has_sizes IS 'Si el producto tiene talles/variantes';
COMMENT ON COLUMN products.sizes IS 'Array de talles: [{name, priceModifier}]';

-- ===== Índices =====
CREATE INDEX IF NOT EXISTS idx_categories_parent ON product_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_level ON product_categories(level);
CREATE INDEX IF NOT EXISTS idx_products_discount ON products(discount) WHERE discount IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_has_sizes ON products(has_sizes) WHERE has_sizes = true;

SELECT 'All missing columns added successfully!' as result;
