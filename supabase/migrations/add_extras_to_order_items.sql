-- =============================================
-- ADD EXTRAS COLUMN TO ORDER_ITEMS
-- Run this in Supabase SQL Editor
-- =============================================

-- Add extras column to order_items if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'order_items' 
        AND column_name = 'extras'
    ) THEN
        ALTER TABLE order_items ADD COLUMN extras JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- The extras column will store an array of objects like:
-- [
--   { "id": "extra_1", "name": "Extra Cheddar", "price": 2200, "quantity": 1 },
--   { "id": "extra_2", "name": "Gaseosa: Coca-Cola", "price": 1000, "quantity": 1, "selectedOption": "Coca-Cola" }
-- ]

-- Done!
