-- Add opening hours column to tenants
-- Format: JSONB array of { day: 'lunes', open: '09:00', close: '22:00', enabled: true }
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS opening_hours JSONB DEFAULT '[]'::jsonb;

-- Add slogan column if not exists
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS slogan TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo TEXT;

-- Welcome modal columns
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS welcome_modal_enabled BOOLEAN DEFAULT false;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS welcome_modal_title TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS welcome_modal_message TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS welcome_modal_image TEXT;

-- Comment for documentation
COMMENT ON COLUMN tenants.opening_hours IS 'JSON array of opening hours per day: [{day: string, open: string, close: string, enabled: boolean}]';
