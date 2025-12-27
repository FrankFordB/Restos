-- Add welcome_modal_features columns to tenants table
-- These columns allow tenants to customize the feature badges shown in their welcome modal

-- JSONB column to store custom features
-- Format: [{ "icon": "truck", "text": "Delivery gratis" }, { "icon": "clock", "text": "30 min" }, ...]
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS welcome_modal_features JSONB DEFAULT NULL;

-- Design variant for the feature badges
-- Available designs: 'pills', 'cards', 'minimal', 'gradient' (Premium)
--                    'glassmorphism', 'neon', 'outlined', 'floating' (Premium Pro)
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS welcome_modal_features_design VARCHAR(50) DEFAULT 'pills';

-- Add comments for documentation
COMMENT ON COLUMN tenants.welcome_modal_features IS 'Custom feature badges for welcome modal. Array of {icon, text} objects. NULL uses defaults.';
COMMENT ON COLUMN tenants.welcome_modal_features_design IS 'Design variant for feature badges: pills, cards, minimal, gradient, glassmorphism, neon, outlined, floating';
