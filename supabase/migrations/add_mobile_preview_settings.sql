-- Add mobile preview customization columns to tenants table
-- These columns store the mobile-specific design preferences

-- Mobile header design variant
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS mobile_header_design VARCHAR(50) DEFAULT 'centered';

-- Mobile cards/products layout design
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS mobile_card_design VARCHAR(50) DEFAULT 'stackedFull';

-- Mobile spacing option
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS mobile_spacing_option VARCHAR(50) DEFAULT 'balanced';

-- Mobile typography option
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS mobile_typography_option VARCHAR(50) DEFAULT 'standard';

-- Add comments for documentation
COMMENT ON COLUMN tenants.mobile_header_design IS 'Mobile header design: compact, centered, minimal, fullImage, parallax, glassmorphism, gradient, split';
COMMENT ON COLUMN tenants.mobile_card_design IS 'Mobile cards layout: stackedFull, gridCompact, listView, imageFirst, masonry, carousel, magazine, polaroid';
COMMENT ON COLUMN tenants.mobile_spacing_option IS 'Mobile spacing: comfortable, compact, balanced, airy, custom, minimal, luxe, dynamic';
COMMENT ON COLUMN tenants.mobile_typography_option IS 'Mobile typography: standard, large, bold, elegant, dynamic, minimal, impact, custom';
