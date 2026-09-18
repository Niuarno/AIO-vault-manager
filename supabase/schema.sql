-- ==============================================================================
-- ALL-IN-ONE ORDER MANAGEMENT SYSTEM (OMS) & DASHBOARDS
-- Supabase PostgreSQL Schema & Security Policies
-- ==============================================================================

-- 1. Create Enums
CREATE TYPE user_role AS ENUM ('admin', 'sales', 'packing');
CREATE TYPE order_source AS ENUM ('website', 'messenger', 'whatsapp', 'phone', 'manual');
CREATE TYPE order_status AS ENUM (
  'pending',
  'confirmed',
  'ready_to_ship',
  'on_the_way',
  'shipped',
  'delivered',
  'canceled'
);
CREATE TYPE reward_rule_type AS ENUM ('percentage', 'fixed_per_order', 'fixed_per_item');
CREATE TYPE reward_status AS ENUM ('pending', 'approved', 'paid');
CREATE TYPE inventory_reason AS ENUM ('order_created', 'order_confirmed', 'order_canceled', 'manual_adjustment', 'restock');

-- 2. Profiles Table (Linked to Supabase auth.users)
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Products & Product Variants (Live Stock)
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  handle TEXT,
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
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

-- 4. Orders Table
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
  sales_rep_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  coupon_used TEXT,
  note TEXT,
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Order Items Table
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  variant_title TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  is_upsell BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Global Upsell Reward Rules Table
CREATE TABLE IF NOT EXISTS public.reward_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  rule_type reward_rule_type NOT NULL DEFAULT 'fixed_per_item',
  value NUMERIC(10, 2) NOT NULL DEFAULT 50.00, -- e.g. 50 BDT per upsell item, or 10% commission
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Upsell Rewards Table (Individual Salesperson Earnings)
CREATE TABLE IF NOT EXISTS public.upsell_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_rep_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES public.order_items(id) ON DELETE SET NULL,
  bonus_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  status reward_status NOT NULL DEFAULT 'pending',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Inventory Logs Table (Audit Trail)
CREATE TABLE IF NOT EXISTS public.inventory_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  previous_stock INTEGER NOT NULL,
  change_amount INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  reason inventory_reason NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  adjusted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- DATABASE AUTOMATION & TRIGGERS
-- ==============================================================================

-- A. Auto create profile when new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE((new.raw_user_meta_data->>'role')::public.user_role, 'sales'::public.user_role)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- B. Atomic Stock Deduction Trigger (When order item is inserted or order confirmed)
CREATE OR REPLACE FUNCTION public.deduct_inventory_for_order_item()
RETURNS TRIGGER AS $$
DECLARE
  current_qty INTEGER;
BEGIN
  IF NEW.variant_id IS NOT NULL THEN
    SELECT stock_quantity INTO current_qty FROM public.product_variants WHERE id = NEW.variant_id FOR UPDATE;
    
    IF current_qty IS NOT NULL THEN
      UPDATE public.product_variants
      SET stock_quantity = stock_quantity - NEW.quantity,
          updated_at = now()
      WHERE id = NEW.variant_id;

      INSERT INTO public.inventory_logs (variant_id, previous_stock, change_amount, new_stock, reason, order_id)
      VALUES (NEW.variant_id, current_qty, -NEW.quantity, current_qty - NEW.quantity, 'order_created', NEW.order_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_deduct_inventory_item ON public.order_items;
CREATE TRIGGER trg_deduct_inventory_item
  AFTER INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.deduct_inventory_for_order_item();

-- C. Automatic Stock Replenishment upon Order Cancellation
CREATE OR REPLACE FUNCTION public.handle_order_cancellation_restock()
RETURNS TRIGGER AS $$
DECLARE
  item RECORD;
  current_qty INTEGER;
BEGIN
  -- If status transitioned to 'canceled' from any non-canceled status
  IF NEW.status = 'canceled' AND OLD.status != 'canceled' THEN
    FOR item IN SELECT variant_id, quantity FROM public.order_items WHERE order_id = NEW.id AND variant_id IS NOT NULL LOOP
      SELECT stock_quantity INTO current_qty FROM public.product_variants WHERE id = item.variant_id FOR UPDATE;
      
      IF current_qty IS NOT NULL THEN
        UPDATE public.product_variants
        SET stock_quantity = stock_quantity + item.quantity,
            updated_at = now()
        WHERE id = item.variant_id;

        INSERT INTO public.inventory_logs (variant_id, previous_stock, change_amount, new_stock, reason, order_id)
        VALUES (item.variant_id, current_qty, item.quantity, current_qty + item.quantity, 'order_canceled', NEW.id);
      END IF;
    END LOOP;

    -- Also mark any pending upsell rewards as canceled/revoked
    UPDATE public.upsell_rewards
    SET status = 'pending', note = 'Order canceled - bonus revoked'
    WHERE order_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_order_cancellation_restock ON public.orders;
CREATE TRIGGER trg_order_cancellation_restock
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_order_cancellation_restock();

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upsell_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Profiles Policies
CREATE POLICY "Public profiles are readable by authenticated users"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "Admins have full access to profiles"
  ON public.profiles FOR ALL TO authenticated
  USING (public.get_current_user_role() = 'admin');

-- Products & Variants Policies
CREATE POLICY "All authenticated users can view active products and stock"
  ON public.products FOR SELECT TO authenticated USING (true);

CREATE POLICY "All authenticated users can view product variants"
  ON public.product_variants FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage products and adjust stock"
  ON public.products FOR ALL TO authenticated USING (public.get_current_user_role() = 'admin');

CREATE POLICY "Admins can manage product variants"
  ON public.product_variants FOR ALL TO authenticated USING (public.get_current_user_role() = 'admin');

-- Orders Policies
-- 1. Admins have complete access to all orders
CREATE POLICY "Admins can manage all orders"
  ON public.orders FOR ALL TO authenticated
  USING (public.get_current_user_role() = 'admin');

-- 2. Sales team can view all orders (or their own) and create new orders
CREATE POLICY "Sales team can view all orders"
  ON public.orders FOR SELECT TO authenticated
  USING (public.get_current_user_role() = 'sales');

CREATE POLICY "Sales team can insert new orders"
  ON public.orders FOR INSERT TO authenticated
  WITH CHECK (public.get_current_user_role() = 'sales' OR public.get_current_user_role() = 'admin');

CREATE POLICY "Sales team can update order status"
  ON public.orders FOR UPDATE TO authenticated
  USING (public.get_current_user_role() = 'sales');

-- 3. PACKING TEAM STRICT POLICY: ONLY SEE CONFIRMED, READY_TO_SHIP, ON_THE_WAY, SHIPPED
CREATE POLICY "Packing team can only see confirmed and in-progress orders"
  ON public.orders FOR SELECT TO authenticated
  USING (
    public.get_current_user_role() = 'packing'
    AND status IN ('confirmed', 'ready_to_ship', 'on_the_way', 'shipped')
  );

CREATE POLICY "Packing team can update order fulfillment status"
  ON public.orders FOR UPDATE TO authenticated
  USING (
    public.get_current_user_role() = 'packing'
    AND status IN ('confirmed', 'ready_to_ship', 'on_the_way', 'shipped')
  );

-- Order Items Policies
CREATE POLICY "Authenticated users can view order items"
  ON public.order_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Sales and Admin can insert order items"
  ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (public.get_current_user_role() IN ('admin', 'sales'));

-- Reward Rules Policies
CREATE POLICY "All authenticated users can view reward rules"
  ON public.reward_rules FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage reward rules"
  ON public.reward_rules FOR ALL TO authenticated USING (public.get_current_user_role() = 'admin');

-- Upsell Rewards Policies
CREATE POLICY "Sales reps can view their own rewards"
  ON public.upsell_rewards FOR SELECT TO authenticated
  USING (sales_rep_id = auth.uid() OR public.get_current_user_role() = 'admin');

CREATE POLICY "Admins can manage all upsell rewards"
  ON public.upsell_rewards FOR ALL TO authenticated USING (public.get_current_user_role() = 'admin');

-- Inventory Logs Policies
CREATE POLICY "Authenticated users can view inventory logs"
  ON public.inventory_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can create inventory logs"
  ON public.inventory_logs FOR INSERT TO authenticated
  WITH CHECK (public.get_current_user_role() = 'admin');

-- ==============================================================================
-- DEFAULT SEED DATA (Default Reward Rule & Sample Catalog)
-- ==============================================================================

INSERT INTO public.reward_rules (name, rule_type, value, is_active)
VALUES 
  ('Standard Upsell Bonus (50 BDT / item)', 'fixed_per_item', 50.00, true),
  ('High Ticket Commission (10%)', 'percentage', 10.00, false)
ON CONFLICT DO NOTHING;

-- Insert sample initial products for immediate live testing
DO $$
DECLARE
  p1_id UUID;
  p2_id UUID;
  p3_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.products LIMIT 1) THEN
    INSERT INTO public.products (title, handle, description, is_active)
    VALUES ('European Vintage Rose Artificial Flower Stem', 'vintage-rose', '21 Inch Triple Bloom decorative artificial flower.', true)
    RETURNING id INTO p1_id;

    INSERT INTO public.product_variants (product_id, title, sku, price, stock_quantity)
    VALUES 
      (p1_id, 'Light Pink / 21 Inch', 'ROSE-LP-21', 370.00, 45),
      (p1_id, 'Cream White / 21 Inch', 'ROSE-CW-21', 370.00, 30);

    INSERT INTO public.products (title, handle, description, is_active)
    VALUES ('Butterfly Peony Artificial Flower Stem', 'butterfly-peony', '65cm Dual-Tone Decorative Flower.', true)
    RETURNING id INTO p2_id;

    INSERT INTO public.product_variants (product_id, title, sku, price, stock_quantity)
    VALUES 
      (p2_id, 'White & Pink / 65cm', 'PEONY-WP-65', 370.00, 60);

    INSERT INTO public.products (title, handle, description, is_active)
    VALUES ('Ceramic Vase Minimalist Collection', 'ceramic-vase', 'Nordic matte ceramic flower vase for home decor.', true)
    RETURNING id INTO p3_id;

    INSERT INTO public.product_variants (product_id, title, sku, price, stock_quantity)
    VALUES 
      (p3_id, 'Matte White', 'VASE-WHT-01', 490.00, 25),
      (p3_id, 'Terracotta', 'VASE-TER-01', 490.00, 15);
  END IF;
END $$;
