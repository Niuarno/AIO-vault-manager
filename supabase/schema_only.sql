-- ==============================================================================
-- BOYON OMS: COMPLETE DATABASE SCHEMA FOR NEW PROJECT (SINGAPORE ap-southeast-1)
-- Target: https://eipwyovlaebwvxglaooi.supabase.co
-- Paste this into your Supabase SQL Editor and click RUN.
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUMS
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin', 'sales', 'packing');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_source') THEN
    CREATE TYPE order_source AS ENUM ('website', 'messenger', 'whatsapp', 'phone', 'manual');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE order_status AS ENUM (
      'pending',
      'not_reachable',
      'delayed_delivery',
      'confirmed',
      'ready_to_ship',
      'on_the_way',
      'shipped',
      'delivered',
      'canceled'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reward_rule_type') THEN
    CREATE TYPE reward_rule_type AS ENUM ('percentage', 'fixed_per_order', 'fixed_per_item');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reward_status') THEN
    CREATE TYPE reward_status AS ENUM ('pending', 'approved', 'paid');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_reason') THEN
    CREATE TYPE inventory_reason AS ENUM ('order_created', 'order_confirmed', 'order_canceled', 'manual_adjustment', 'restock');
  END IF;
END $$;

-- 3. TABLES CREATION
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'sales',
  coupon_code TEXT UNIQUE,
  bio TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_online BOOLEAN DEFAULT false,
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  payment_info JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  handle TEXT,
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_disabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Default Title',
  sku TEXT,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  cost_price NUMERIC(10, 2) DEFAULT 0.00,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  source order_source NOT NULL DEFAULT 'manual',
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  shipping_address TEXT NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'Cash on Delivery (COD)',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  status order_status NOT NULL DEFAULT 'pending',
  total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  currency TEXT NOT NULL DEFAULT 'BDT',
  delivery_charge NUMERIC(10, 2) DEFAULT 0.00,
  discount_amount NUMERIC(10, 2) DEFAULT 0.00,
  advance_payment NUMERIC(10, 2) DEFAULT 0.00,
  courier_name TEXT DEFAULT 'Steadfast',
  consignment_id TEXT,
  tracking_code TEXT,
  tracking_message TEXT,
  courier_status TEXT,
  courier_updated_at TIMESTAMPTZ,
  sales_rep_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  coupon_used TEXT,
  note TEXT,
  external_id TEXT,
  original_items JSONB,
  edit_history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  total_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  change_quantity INTEGER NOT NULL,
  new_quantity INTEGER NOT NULL,
  reason inventory_reason NOT NULL,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reward_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  rule_type reward_rule_type NOT NULL DEFAULT 'percentage',
  value NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.upsell_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_rep_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES public.order_items(id) ON DELETE SET NULL,
  bonus_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  status reward_status NOT NULL DEFAULT 'pending',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
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

CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 4. FUNCTIONS & TRIGGERS
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'sales'::user_role)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.deduct_inventory_for_order_item()
RETURNS trigger AS $$
BEGIN
  -- Safety: Do not deduct inventory for historical records during data migration
  IF NEW.created_at IS NOT NULL AND NEW.created_at < (now() - INTERVAL '10 minutes') THEN
    RETURN NEW;
  END IF;

  UPDATE public.product_variants
  SET stock_quantity = stock_quantity - NEW.quantity,
      updated_at = now()
  WHERE id = NEW.variant_id;

  INSERT INTO public.inventory_logs (variant_id, change_quantity, new_quantity, reason, reference_id)
  VALUES (
    NEW.variant_id,
    -NEW.quantity,
    (SELECT stock_quantity FROM public.product_variants WHERE id = NEW.variant_id),
    'order_created',
    NEW.order_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_deduct_inventory_item ON public.order_items;
CREATE TRIGGER trg_deduct_inventory_item
  AFTER INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.deduct_inventory_for_order_item();

CREATE OR REPLACE FUNCTION public.handle_order_cancellation_restock()
RETURNS trigger AS $$
DECLARE
  item RECORD;
BEGIN
  IF NEW.status = 'canceled' AND OLD.status != 'canceled' THEN
    FOR item IN SELECT * FROM public.order_items WHERE order_id = NEW.id LOOP
      UPDATE public.product_variants
      SET stock_quantity = stock_quantity + item.quantity,
          updated_at = now()
      WHERE id = item.variant_id;

      INSERT INTO public.inventory_logs (variant_id, change_quantity, new_quantity, reason, reference_id)
      VALUES (
        item.variant_id,
        item.quantity,
        (SELECT stock_quantity FROM public.product_variants WHERE id = item.variant_id),
        'order_canceled',
        NEW.id
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_order_cancellation_restock ON public.orders;
CREATE TRIGGER trg_order_cancellation_restock
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_order_cancellation_restock();

CREATE OR REPLACE FUNCTION public.check_product_out_of_stock()
RETURNS TRIGGER AS $$
DECLARE
  v_product_id UUID;
  v_total_stock INT;
BEGIN
  v_product_id := NEW.product_id;
  SELECT COALESCE(SUM(stock_quantity), 0)
  INTO v_total_stock
  FROM public.product_variants
  WHERE product_id = v_product_id;

  IF v_total_stock <= 0 THEN
    UPDATE public.products
    SET is_disabled = true,
        updated_at = NOW()
    WHERE id = v_product_id
      AND is_disabled = false;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_product_out_of_stock ON public.product_variants;
CREATE TRIGGER trg_check_product_out_of_stock
  AFTER INSERT OR UPDATE OF stock_quantity ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.check_product_out_of_stock();

-- 5. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upsell_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Public read profiles" ON public.profiles;
CREATE POLICY "Public read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "Admin full profiles" ON public.profiles;
CREATE POLICY "Admin full profiles" ON public.profiles FOR ALL TO authenticated USING (public.get_current_user_role() = 'admin');

-- Products Policies
DROP POLICY IF EXISTS "Public read products" ON public.products;
CREATE POLICY "Public read products" ON public.products FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin full products" ON public.products;
CREATE POLICY "Admin full products" ON public.products FOR ALL TO authenticated USING (public.get_current_user_role() = 'admin');

-- Product Variants Policies
DROP POLICY IF EXISTS "Public read variants" ON public.product_variants;
CREATE POLICY "Public read variants" ON public.product_variants FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Staff update variants" ON public.product_variants;
CREATE POLICY "Staff update variants" ON public.product_variants FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin full variants" ON public.product_variants;
CREATE POLICY "Admin full variants" ON public.product_variants FOR ALL TO authenticated USING (public.get_current_user_role() = 'admin');

-- Orders Policies
DROP POLICY IF EXISTS "Authenticated read orders" ON public.orders;
CREATE POLICY "Authenticated read orders" ON public.orders FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated insert orders" ON public.orders;
CREATE POLICY "Authenticated insert orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated update orders" ON public.orders;
CREATE POLICY "Authenticated update orders" ON public.orders FOR UPDATE TO authenticated USING (true);

-- Order Items Policies
DROP POLICY IF EXISTS "Authenticated read order_items" ON public.order_items;
CREATE POLICY "Authenticated read order_items" ON public.order_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated insert order_items" ON public.order_items;
CREATE POLICY "Authenticated insert order_items" ON public.order_items FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated update order_items" ON public.order_items;
CREATE POLICY "Authenticated update order_items" ON public.order_items FOR UPDATE TO authenticated USING (true);

-- System Settings & Rewards Policies
DROP POLICY IF EXISTS "Authenticated read settings" ON public.system_settings;
CREATE POLICY "Authenticated read settings" ON public.system_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin update settings" ON public.system_settings;
CREATE POLICY "Admin update settings" ON public.system_settings FOR ALL TO authenticated USING (public.get_current_user_role() = 'admin');

DROP POLICY IF EXISTS "Authenticated read reward rules" ON public.reward_rules;
CREATE POLICY "Authenticated read reward rules" ON public.reward_rules FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin full reward rules" ON public.reward_rules;
CREATE POLICY "Admin full reward rules" ON public.reward_rules FOR ALL TO authenticated USING (public.get_current_user_role() = 'admin');

DROP POLICY IF EXISTS "Authenticated read rewards" ON public.upsell_rewards;
CREATE POLICY "Authenticated read rewards" ON public.upsell_rewards FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated update rewards" ON public.upsell_rewards;
CREATE POLICY "Authenticated update rewards" ON public.upsell_rewards FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated read payouts" ON public.payout_requests;
CREATE POLICY "Authenticated read payouts" ON public.payout_requests FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Staff insert payouts" ON public.payout_requests;
CREATE POLICY "Staff insert payouts" ON public.payout_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = staff_id);
DROP POLICY IF EXISTS "Admin update payouts" ON public.payout_requests;
CREATE POLICY "Admin update payouts" ON public.payout_requests FOR UPDATE TO authenticated USING (true);

-- 6. ENABLE REALTIME PUBLICATION
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.product_variants;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.payout_requests;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.upsell_rewards;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
