-- ==============================================================================
-- BOYON OMS: ORDER DISCOUNT, ADVANCE PRE-PAYMENT, REACHOUT COMMISSION & NOTICEBOARD
-- ==============================================================================

-- 1. Add discount_amount and advance_payment columns to public.orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS advance_payment NUMERIC(10, 2) DEFAULT 0.00;

-- 2. System Settings table for global noticeboard and configs
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Seed default noticeboard headline
INSERT INTO public.system_settings (key, value)
VALUES (
  'noticeboard_headline',
  'Welcome to BOYON Order Management System. Please ensure all customer numbers and delivery addresses are verified before shipping.'
)
ON CONFLICT (key) DO NOTHING;

-- 3. Seed default Reachout Sales Commission rule (10% flat percentage)
INSERT INTO public.reward_rules (name, rule_type, value, is_active)
SELECT '{"name":"Reachout Sales Commission","rule_type":"reachout_percentage","source":"reachout"}', 'percentage', 10, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.reward_rules 
  WHERE name LIKE '%Reachout Sales Commission%' OR name LIKE '%reachout_percentage%'
);
