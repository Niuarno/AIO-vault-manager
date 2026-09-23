import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { variant_id, change_amount, reason, adjusted_by } = body;

    if (!variant_id || typeof change_amount !== 'number') {
      return NextResponse.json({ error: 'variant_id and change_amount are required' }, { status: 400 });
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

    const prevStock = variant.stock_quantity;
    const newStock = Math.max(0, prevStock + change_amount);

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
      change_amount,
      new_stock: newStock,
      reason: reason || 'manual_adjustment',
      adjusted_by: adjusted_by || null,
    });

    // 4. Auto-disable product if cumulative stock of all variants is 0 or below
    let isProductDisabled = false;
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
      }
    }

    return NextResponse.json({
      success: true,
      variant_id,
      previous_stock: prevStock,
      new_stock: newStock,
      product_disabled: isProductDisabled,
      message: `Stock for ${variant.title} updated from ${prevStock} to ${newStock}${
        isProductDisabled ? ' (Product auto-disabled due to 0 stock)' : ''
      }`,
    });
  } catch (err: any) {
    console.error('Inventory adjustment error:', err);
    return NextResponse.json({ error: err.message || 'Failed to adjust inventory' }, { status: 500 });
  }
}
