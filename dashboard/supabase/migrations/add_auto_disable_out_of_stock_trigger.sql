-- Migration: Auto-disable products when total inventory stock reaches 0 or below

CREATE OR REPLACE FUNCTION public.check_product_out_of_stock()
RETURNS TRIGGER AS $$
DECLARE
  target_prod_id UUID;
  total_stock INTEGER;
BEGIN
  target_prod_id := NEW.product_id;

  IF target_prod_id IS NOT NULL THEN
    -- Calculate sum of stock across all variants of this product
    SELECT COALESCE(SUM(stock_quantity), 0) INTO total_stock
    FROM public.product_variants
    WHERE product_id = target_prod_id;

    -- If total stock is 0 or negative, automatically disable the product
    IF total_stock <= 0 THEN
      UPDATE public.products
      SET is_active = false,
          updated_at = now()
      WHERE id = target_prod_id AND is_active = true;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_product_out_of_stock ON public.product_variants;
CREATE TRIGGER trg_check_product_out_of_stock
  AFTER INSERT OR UPDATE OF stock_quantity ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.check_product_out_of_stock();
