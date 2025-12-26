-- =============================================
-- PRODUCT EXTRAS - Add product_extras column to products table
-- Run this migration to add per-product extras support
-- =============================================

-- Add product_extras column (JSONB array to store product-specific extras)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS product_extras JSONB DEFAULT '[]'::jsonb;

-- Comment for documentation
COMMENT ON COLUMN products.product_extras IS 'JSON array of product-specific extras/toppings. Each extra has: id, name, price, maxPerOrder, selectorType, options[]';

-- Example structure of product_extras:
-- [
--   {
--     "id": "extra_123",
--     "name": "Queso extra",
--     "price": 150,
--     "maxPerOrder": 3,
--     "selectorType": "buttons",
--     "options": []
--   },
--   {
--     "id": "extra_456",
--     "name": "Tamaño",
--     "price": 0,
--     "maxPerOrder": 1,
--     "selectorType": "select",
--     "options": [
--       { "id": "opt_1", "label": "Pequeño", "price": 0 },
--       { "id": "opt_2", "label": "Mediano", "price": 100 },
--       { "id": "opt_3", "label": "Grande", "price": 200 }
--     ]
--   }
-- ]
