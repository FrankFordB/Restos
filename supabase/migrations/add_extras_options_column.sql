-- =============================================
-- ADD OPTIONS COLUMNS TO EXTRAS TABLE
-- Run this if the extras table already exists
-- =============================================

-- Add has_options column if not exists
ALTER TABLE extras 
ADD COLUMN IF NOT EXISTS has_options BOOLEAN DEFAULT FALSE;

-- Add options column if not exists (JSONB array of {id, label, price})
ALTER TABLE extras 
ADD COLUMN IF NOT EXISTS options JSONB DEFAULT '[]'::jsonb;

-- Example of options structure:
-- [
--   {"id": "opt_1", "label": "Coca-Cola", "price": 2500},
--   {"id": "opt_2", "label": "Sprite", "price": 2500},
--   {"id": "opt_3", "label": "Fanta", "price": 2800}
-- ]
