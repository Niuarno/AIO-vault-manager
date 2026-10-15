-- Migration: Unify 'shipped' status into 'delivered'
-- 1. Updates any existing orders that currently have status = 'shipped' to 'delivered'
-- 2. Updates RLS policies for packing personnel to include 'delivered' status

-- 1. Migrate existing orders with status 'shipped' to 'delivered'
UPDATE public.orders
SET status = 'delivered',
    updated_at = NOW()
WHERE status = 'shipped';

-- 2. Update packing team RLS policies to allow access to 'delivered' orders
DROP POLICY IF EXISTS "Packing team can only see confirmed and in-progress orders" ON public.orders;
CREATE POLICY "Packing team can only see confirmed and in-progress orders"
  ON public.orders FOR SELECT TO authenticated
  USING (
    public.get_current_user_role() = 'packing'
    AND status IN ('delayed_delivery', 'confirmed', 'ready_to_ship', 'on_the_way', 'delivered', 'shipped')
  );

DROP POLICY IF EXISTS "Packing team can update order fulfillment status" ON public.orders;
CREATE POLICY "Packing team can update order fulfillment status"
  ON public.orders FOR UPDATE TO authenticated
  USING (
    public.get_current_user_role() = 'packing'
    AND status IN ('delayed_delivery', 'confirmed', 'ready_to_ship', 'on_the_way', 'delivered', 'shipped')
  );
