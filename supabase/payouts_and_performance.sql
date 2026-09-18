-- ==============================================================================
-- BOYON OMS: PAYOUTS & PERFORMANCE MIGRATION
-- ==============================================================================

-- 1. Create Payout Requests Table
CREATE TABLE IF NOT EXISTS public.payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  payment_method TEXT NOT NULL DEFAULT 'bKash',
  account_number TEXT NOT NULL,
  staff_note TEXT,
  admin_screenshot_url TEXT,
  admin_note TEXT,
  processed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Extend Profiles Table for Payment Information and Online Presence
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payment_info JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT now();

-- 3. Row Level Security Policies
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read payout requests" ON public.payout_requests;
CREATE POLICY "Allow authenticated users to read payout requests"
  ON public.payout_requests FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow staff to insert payout requests" ON public.payout_requests;
CREATE POLICY "Allow staff to insert payout requests"
  ON public.payout_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = staff_id);

DROP POLICY IF EXISTS "Allow admin to update payout requests" ON public.payout_requests;
CREATE POLICY "Allow admin to update payout requests"
  ON public.payout_requests FOR UPDATE
  TO authenticated
  USING (true);
