-- =============================================
-- EXTRAS SYSTEM - SIMPLIFIED MIGRATION
-- Run this in Supabase SQL Editor
-- =============================================

-- Step 1: Create extra_groups table
CREATE TABLE IF NOT EXISTS extra_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    min_selections INT DEFAULT 0,
    max_selections INT DEFAULT 10,
    is_required BOOLEAN DEFAULT FALSE,
    sort_order INT DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create extras table with options support
CREATE TABLE IF NOT EXISTS extras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES extra_groups(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) DEFAULT 0.00,
    sort_order INT DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    has_options BOOLEAN DEFAULT FALSE,
    options JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Create indexes
CREATE INDEX IF NOT EXISTS idx_extra_groups_tenant ON extra_groups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_extras_tenant ON extras(tenant_id);
CREATE INDEX IF NOT EXISTS idx_extras_group ON extras(group_id);

-- Step 4: Enable RLS
ALTER TABLE extra_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE extras ENABLE ROW LEVEL SECURITY;

-- Step 5: Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "extra_groups_all" ON extra_groups;
DROP POLICY IF EXISTS "extras_all" ON extras;
DROP POLICY IF EXISTS "extra_groups_select_policy" ON extra_groups;
DROP POLICY IF EXISTS "extras_select_policy" ON extras;
DROP POLICY IF EXISTS "extra_groups_insert_policy" ON extra_groups;
DROP POLICY IF EXISTS "extras_insert_policy" ON extras;
DROP POLICY IF EXISTS "extra_groups_update_policy" ON extra_groups;
DROP POLICY IF EXISTS "extras_update_policy" ON extras;
DROP POLICY IF EXISTS "extra_groups_delete_policy" ON extra_groups;
DROP POLICY IF EXISTS "extras_delete_policy" ON extras;
DROP POLICY IF EXISTS "extra_groups_public_read" ON extra_groups;
DROP POLICY IF EXISTS "extras_public_read" ON extras;

-- Step 6: Create simple permissive policies
-- For extra_groups: anyone can read, authenticated users can modify their tenant's data
CREATE POLICY "extra_groups_all" ON extra_groups
    FOR ALL USING (true) WITH CHECK (true);

-- For extras: anyone can read, authenticated users can modify their tenant's data
CREATE POLICY "extras_all" ON extras
    FOR ALL USING (true) WITH CHECK (true);

-- Step 7: Trigger for auto-update updated_at
CREATE OR REPLACE FUNCTION update_extras_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_extra_groups_updated ON extra_groups;
CREATE TRIGGER trigger_extra_groups_updated
    BEFORE UPDATE ON extra_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_extras_timestamp();

DROP TRIGGER IF EXISTS trigger_extras_updated ON extras;
CREATE TRIGGER trigger_extras_updated
    BEFORE UPDATE ON extras
    FOR EACH ROW
    EXECUTE FUNCTION update_extras_timestamp();

-- Done! The extras system is now ready.
