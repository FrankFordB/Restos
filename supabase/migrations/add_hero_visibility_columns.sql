-- Add visibility and button style columns for hero/carousel customization

ALTER TABLE tenant_themes
ADD COLUMN IF NOT EXISTS hero_show_title boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS hero_show_subtitle boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS hero_show_cta boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS hero_carousel_button_style text DEFAULT 'arrows_classic';

-- Comment on columns
COMMENT ON COLUMN tenant_themes.hero_show_title IS 'Whether to show the title on hero carousel slides';
COMMENT ON COLUMN tenant_themes.hero_show_subtitle IS 'Whether to show the subtitle on hero carousel slides';
COMMENT ON COLUMN tenant_themes.hero_show_cta IS 'Whether to show the CTA button on hero carousel slides';
COMMENT ON COLUMN tenant_themes.hero_carousel_button_style IS 'Style for carousel navigation buttons (arrows_classic, arrows_circle, etc.)';
