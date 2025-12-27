-- Migration: Add store pause functionality
-- Allows tenant admins to pause their store with a custom message

-- Add columns to tenants table
ALTER TABLE IF EXISTS public.tenants
  ADD COLUMN IF NOT EXISTS is_paused boolean NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public.tenants
  ADD COLUMN IF NOT EXISTS pause_message text NULL;

-- Comment for documentation
COMMENT ON COLUMN public.tenants.is_paused IS 'When true, the storefront shows pause_message and blocks orders';
COMMENT ON COLUMN public.tenants.pause_message IS 'Custom message to display when store is paused';

-- Allow anon to read pause status (needed for storefront)
-- This is already covered by tenants_public_select policy
