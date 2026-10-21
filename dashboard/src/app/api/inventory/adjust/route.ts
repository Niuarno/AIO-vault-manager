import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { variant_id, change_amount, target_stock, reason, adjusted_by } = body;

    const hasTargetStock = typeof target_stock === 'number' || typeof body.new_stock === 'number';
    const targetStockVal = typeof target_stock === 'number' ? target_stock : body.new_stock;

    if (!variant_id || (typeof change_amount !== 'number' && !hasTargetStock)) {
      return NextResponse.json(
        { error: 'variant_id and either change_amount or target_stock are required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 1. Fetch current variant stock
    const { data: variant, error: fetchErr } = await supabase
      .from('product_variants')
      .select('id, product_id, stock_quantity, title')
      .eq('id', variant_id)
      .single();

    if (fetchErr || !variant) {
      return NextResponse.json({ error: 'Variant not found' }, { status: 404 });
    }

    const prevStock = Number(variant.stock_quantity ?? 0);
    const finalChangeAmount = hasTargetStock ? targetStockVal - prevStock : change_amount;
    const newStock = hasTargetStock ? targetStockVal : prevStock + change_amount;

    // 2. Update stock quantity
    const { error: updateErr } = await supabase
      .from('product_variants')
      .update({
        stock_quantity: newStock,
        updated_at: new Date().toISOString(),
      })
      .eq('id', variant_id);

    if (updateErr) throw updateErr;

    // 3. Log to inventory_logs
    await supabase.from('inventory_logs').insert({
      variant_id,
      previous_stock: prevStock,
      change_amount: finalChangeAmount,
      new_stock: newStock,
      reason: reason || (finalChangeAmount > 0 ? 'restock' : 'manual_adjustment'),
      adjusted_by: adjusted_by || null,
    });

    // 4. Auto-disable product if cumulative stock of all variants is 0 or below, or re-enable if stock added
    let isProductDisabled = false;
    let isProductReenabled = false;
    if (variant.product_id) {
      const { data: siblings } = await supabase
        .from('product_variants')
        .select('stock_quantity')
        .eq('product_id', variant.product_id);

      const totalStock = (siblings || []).reduce((acc, s) => acc + (s.stock_quantity || 0), 0);
      if (totalStock <= 0) {
        await supabase
          .from('products')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', variant.product_id);
        isProductDisabled = true;
      } else {
        // Re-enable if stock was added and net totalStock is positive
        await supabase
          .from('products')
          .update({ is_active: true, updated_at: new Date().toISOString() })
          .eq('id', variant.product_id);
        isProductReenabled = true;
      }
    }

    // 5. Fully Automatic: Release delayed delivery orders in FIFO order up to the restocked quantity
    let releasedCount = 0;
    if (finalChangeAmount > 0) {
      try {
        const { autoReleaseDelayedOrders } = await import('@/lib/delayedOrders');
        const releaseResult = await autoReleaseDelayedOrders(supabase, variant_id, finalChangeAmount);
        releasedCount = releaseResult.releasedCount;
      } catch (releaseErr) {
        console.error('Auto release error after stock adjustment:', releaseErr);
      }
    }

    return NextResponse.json({
      success: true,
      variant_id,
      previous_stock: prevStock,
      new_stock: newStock,
      product_disabled: isProductDisabled,
      product_reenabled: isProductReenabled,
      released_delayed_orders: releasedCount,
      message: `Stock for ${variant.title} updated from ${prevStock} to ${newStock}${
        isProductDisabled ? ' (Product disabled on storefront due to non-positive stock)' : ''
      }${isProductReenabled ? ' (Product re-enabled)' : ''}${
        releasedCount > 0 ? ` (${releasedCount} delayed order(s) auto-released to packing!)` : ''
      }`,
    });
  } catch (err: any) {
    console.error('Inventory adjustment error:', err);
    return NextResponse.json({ error: err.message || 'Failed to adjust inventory' }, { status: 500 });
  }
}
