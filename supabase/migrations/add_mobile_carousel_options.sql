-- Add mobile carousel visibility options column
-- This stores JSON with visibility flags for carousel elements on mobile

ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS mobile_carousel_options JSONB DEFAULT '{"showTitle": true, "showSubtitle": true, "showCta": true}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN tenants.mobile_carousel_options IS 'JSON with mobile carousel visibility options: showTitle, showSubtitle, showCta (all default true)';
