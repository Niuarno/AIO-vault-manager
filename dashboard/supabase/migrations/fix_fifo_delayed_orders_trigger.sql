-- ==============================================================================
-- Migration: Drop indiscriminate database trigger for auto-releasing delayed orders
-- FIFO release with exact restock budgeting is handled safely in the application layer (/api/inventory/adjust).
-- Run this in the Supabase SQL Editor if you previously created trg_auto_release_delayed_orders.
-- ==============================================================================

DROP TRIGGER IF EXISTS trg_auto_release_delayed_orders ON public.product_variants;
DROP FUNCTION IF EXISTS public.auto_release_delayed_orders();
