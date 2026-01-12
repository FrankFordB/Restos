-- =============================================
-- ADD CATEGORY CARD LAYOUT TO THEMES
-- =============================================

-- Add category_card_layout column to tenant themes
ALTER TABLE tenant_themes 
ADD COLUMN IF NOT EXISTS category_card_layout VARCHAR(50) DEFAULT 'grid';

-- Add comment explaining the column
COMMENT ON COLUMN tenant_themes.category_card_layout IS 'Layout style for category cards: grid, horizontal, circle, chips, overlay, magazine, minimal, polaroid, banner';
