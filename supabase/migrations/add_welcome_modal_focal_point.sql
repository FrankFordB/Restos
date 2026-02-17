-- Add welcome_modal_image_focal_point column to tenants table
-- Stores the focal point for welcome modal image cropping/display as JSONB {x: number, y: number}

ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS welcome_modal_image_focal_point JSONB DEFAULT NULL;

COMMENT ON COLUMN tenants.welcome_modal_image_focal_point IS 'Focal point for welcome modal image, format: {x: 0-100, y: 0-100}';
