-- ==============================================================================
-- ADD DELIVERY CHARGE COLUMN TO ORDERS TABLE
-- ==============================================================================

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_charge NUMERIC(10, 2) DEFAULT 0.00;
