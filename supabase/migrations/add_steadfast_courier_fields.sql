-- ==============================================================================
-- ADD STEADFAST COURIER TRACKING FIELDS TO ORDERS TABLE
-- ==============================================================================

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS courier_name TEXT DEFAULT 'steadfast';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS consignment_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_code TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_message TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS courier_status TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS courier_updated_at TIMESTAMPTZ;
