-- ==============================================================================
-- Migration: Add 'delayed_delivery' to public.order_status Enum & Auto-Release Trigger
-- Run this query in the Supabase SQL Editor:
-- ==============================================================================

-- 1. Add 'delayed_delivery' enum value to order_status
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'delayed_delivery';

-- 2. Optional: Auto-release trigger function in PostgreSQL
-- When product_variants stock_quantity is updated to > 0, automatically release delayed orders for that variant
CREATE OR REPLACE FUNCTION public.auto_release_delayed_orders()
RETURNS TRIGGER AS $$
DECLARE
  order_rec RECORD;
BEGIN
  IF NEW.stock_quantity > 0 AND (OLD.stock_quantity IS NULL OR OLD.stock_quantity <= 0 OR NEW.stock_quantity > OLD.stock_quantity) THEN
    -- Find delayed orders containing this variant
    FOR order_rec IN
      SELECT DISTINCT o.id, o.note
      FROM public.orders o
      JOIN public.order_items oi ON oi.order_id = o.id
      WHERE o.status = 'delayed_delivery'
        AND oi.variant_id = NEW.id
      ORDER BY o.id
    LOOP
      UPDATE public.orders
      SET status = 'confirmed',
          note = CASE 
            WHEN note IS NULL OR note = '' THEN '[Auto-Released to Confirmed on Restock]'
            ELSE note || ' | [Auto-Released to Confirmed on Restock]'
          END,
          updated_at = now()
      WHERE id = order_rec.id AND status = 'delayed_delivery';
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_release_delayed_orders ON public.product_variants;
CREATE TRIGGER trg_auto_release_delayed_orders
  AFTER UPDATE OF stock_quantity ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.auto_release_delayed_orders();
