-- Add logo_focal_point column to tenants table
-- Stores the focal point for logo cropping/display as JSONB {x: number, y: number}

ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS logo_focal_point JSONB DEFAULT NULL;

COMMENT ON COLUMN tenants.logo_focal_point IS 'Focal point for logo display, format: {x: 0-100, y: 0-100}';
