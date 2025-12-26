-- =============================================
-- EXTRAS SYSTEM - Groups and Extras Tables
-- Run this migration to add extras/toppings support
-- =============================================

-- Table: extra_groups
-- Stores groups like "Salsas", "Toppings", "Tipo de carne"
CREATE TABLE IF NOT EXISTS extra_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    min_selections INT DEFAULT 0,
    max_selections INT DEFAULT NULL,
    is_required BOOLEAN DEFAULT FALSE,
    sort_order INT DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: extras
-- Stores individual extras like "Salsa BBQ", "Cheddar extra", etc.
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_extra_groups_tenant ON extra_groups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_extra_groups_active ON extra_groups(tenant_id, active);
CREATE INDEX IF NOT EXISTS idx_extras_tenant ON extras(tenant_id);
CREATE INDEX IF NOT EXISTS idx_extras_group ON extras(group_id);
CREATE INDEX IF NOT EXISTS idx_extras_active ON extras(tenant_id, active);

-- RLS Policies
ALTER TABLE extra_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE extras ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see extra_groups for their tenant
CREATE POLICY "extra_groups_select_policy" ON extra_groups
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM users WHERE id = auth.uid()
        )
        OR 
        tenant_id IN (
            SELECT id FROM tenants WHERE owner_id = auth.uid()
        )
    );

-- Policy: Tenant admins can insert extra_groups
CREATE POLICY "extra_groups_insert_policy" ON extra_groups
    FOR INSERT WITH CHECK (
        tenant_id IN (
            SELECT id FROM tenants WHERE owner_id = auth.uid()
        )
    );

-- Policy: Tenant admins can update their extra_groups
CREATE POLICY "extra_groups_update_policy" ON extra_groups
    FOR UPDATE USING (
        tenant_id IN (
            SELECT id FROM tenants WHERE owner_id = auth.uid()
        )
    );

-- Policy: Tenant admins can delete their extra_groups
CREATE POLICY "extra_groups_delete_policy" ON extra_groups
    FOR DELETE USING (
        tenant_id IN (
            SELECT id FROM tenants WHERE owner_id = auth.uid()
        )
    );

-- Policy: Users can only see extras for their tenant
CREATE POLICY "extras_select_policy" ON extras
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM users WHERE id = auth.uid()
        )
        OR 
        tenant_id IN (
            SELECT id FROM tenants WHERE owner_id = auth.uid()
        )
    );

-- Policy: Tenant admins can insert extras
CREATE POLICY "extras_insert_policy" ON extras
    FOR INSERT WITH CHECK (
        tenant_id IN (
            SELECT id FROM tenants WHERE owner_id = auth.uid()
        )
    );

-- Policy: Tenant admins can update their extras
CREATE POLICY "extras_update_policy" ON extras
    FOR UPDATE USING (
        tenant_id IN (
            SELECT id FROM tenants WHERE owner_id = auth.uid()
        )
    );

-- Policy: Tenant admins can delete their extras
CREATE POLICY "extras_delete_policy" ON extras
    FOR DELETE USING (
        tenant_id IN (
            SELECT id FROM tenants WHERE owner_id = auth.uid()
        )
    );

-- Public read access for storefront (customers viewing menu)
CREATE POLICY "extra_groups_public_read" ON extra_groups
    FOR SELECT USING (active = true);

CREATE POLICY "extras_public_read" ON extras
    FOR SELECT USING (active = true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_extras_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_extra_groups_updated_at
    BEFORE UPDATE ON extra_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_extras_updated_at();

CREATE TRIGGER trigger_extras_updated_at
    BEFORE UPDATE ON extras
    FOR EACH ROW
    EXECUTE FUNCTION update_extras_updated_at();

-- =============================================
-- Optional: Seed data for testing
-- Uncomment and modify tenant_id as needed
-- =============================================
/*
INSERT INTO extra_groups (tenant_id, name, description, min_selections, max_selections, is_required, sort_order) VALUES
    ('YOUR-TENANT-UUID', 'Salsas', 'Elegí tu salsa favorita', 0, 2, false, 1),
    ('YOUR-TENANT-UUID', 'Toppings', 'Agregá ingredientes extra', 0, 5, false, 2),
    ('YOUR-TENANT-UUID', 'Tipo de carne', 'Seleccioná cómo querés tu carne', 1, 1, true, 3);

INSERT INTO extras (tenant_id, group_id, name, price, sort_order) VALUES
    ('YOUR-TENANT-UUID', 'SALSAS-GROUP-UUID', 'Salsa BBQ', 0, 1),
    ('YOUR-TENANT-UUID', 'SALSAS-GROUP-UUID', 'Mayonesa', 0, 2),
    ('YOUR-TENANT-UUID', 'SALSAS-GROUP-UUID', 'Ketchup', 0, 3),
    ('YOUR-TENANT-UUID', 'TOPPINGS-GROUP-UUID', 'Queso extra', 150, 1),
    ('YOUR-TENANT-UUID', 'TOPPINGS-GROUP-UUID', 'Bacon', 200, 2),
    ('YOUR-TENANT-UUID', 'CARNE-GROUP-UUID', 'Jugosa', 0, 1),
    ('YOUR-TENANT-UUID', 'CARNE-GROUP-UUID', 'A punto', 0, 2),
    ('YOUR-TENANT-UUID', 'CARNE-GROUP-UUID', 'Bien cocida', 0, 3);
*/
