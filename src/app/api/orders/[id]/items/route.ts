import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const body = await req.json();
    const newItems: Array<{
      id?: string;
      product_id: string | null;
      variant_id: string | null;
      title: string;
      variant_title: string | null;
      quantity: number;
      price: number;
      is_upsell?: boolean;
    }> = body.items;

    if (!Array.isArray(newItems) || newItems.length === 0) {
      return NextResponse.json(
        { error: 'An order must have at least one line item.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 1. Fetch existing order
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // 2. Fetch existing order items
    const { data: oldItems, error: oldItemsErr } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);

    if (oldItemsErr) {
      return NextResponse.json({ error: 'Failed to retrieve current order items' }, { status: 500 });
    }

    // 3. Calculate stock adjustments per variant
    // Sum old quantities by variant_id
    const oldVariantQty: Record<string, number> = {};
    (oldItems || []).forEach((item) => {
      if (item.variant_id) {
        oldVariantQty[item.variant_id] = (oldVariantQty[item.variant_id] || 0) + Number(item.quantity);
      }
    });

    // Sum new quantities by variant_id
    const newVariantQty: Record<string, number> = {};
    newItems.forEach((item) => {
      if (item.variant_id) {
        newVariantQty[item.variant_id] = (newVariantQty[item.variant_id] || 0) + Number(item.quantity);
      }
    });

    const allVariantIds = Array.from(
      new Set([...Object.keys(oldVariantQty), ...Object.keys(newVariantQty)])
    );

    // 4. Validate and apply inventory deltas
    for (const variantId of allVariantIds) {
      const oldQty = oldVariantQty[variantId] || 0;
      const newQty = newVariantQty[variantId] || 0;
      const delta = newQty - oldQty; // positive = added items, negative = deducted items

      if (delta === 0) continue;

      // Get current variant
      const { data: variant, error: varErr } = await supabase
        .from('product_variants')
        .select('*')
        .eq('id', variantId)
        .single();

      if (varErr || !variant) {
        return NextResponse.json(
          { error: `Product variant ${variantId} not found in inventory.` },
          { status: 400 }
        );
      }

      const prevStock = variant.stock_quantity;
      const nextStock = prevStock - delta;

      // Only block if deducting and stock goes below 0
      if (delta > 0 && nextStock < 0) {
        return NextResponse.json(
          {
            error: `Insufficient stock for "${variant.title}". Available: ${prevStock}, requested additional: ${delta}`,
          },
          { status: 400 }
        );
      }

      // Update variant stock
      await supabase
        .from('product_variants')
        .update({
          stock_quantity: nextStock,
          updated_at: new Date().toISOString(),
        })
        .eq('id', variantId);

      // Audit log
      await supabase.from('inventory_logs').insert({
        variant_id: variantId,
        previous_stock: prevStock,
        change_amount: -delta,
        new_stock: nextStock,
        reason: delta > 0 ? 'order_created' : 'restock',
        order_id: orderId,
      });
    }

    // 5. Replace line items in order_items table
    // Delete old items
    await supabase.from('order_items').delete().eq('order_id', orderId);

    // Insert new items
    const itemsToInsert = newItems.map((item) => ({
      order_id: orderId,
      product_id: item.product_id || null,
      variant_id: item.variant_id || null,
      title: item.title,
      variant_title: item.variant_title || null,
      quantity: Number(item.quantity) || 1,
      price: Number(item.price) || 0,
      is_upsell: Boolean(item.is_upsell),
    }));

    const { error: insertErr } = await supabase.from('order_items').insert(itemsToInsert);
    if (insertErr) {
      return NextResponse.json({ error: 'Failed to update order items: ' + insertErr.message }, { status: 500 });
    }

    // 6. Recalculate total amount
    const recalculatedTotal = newItems.reduce(
      (sum, item) => sum + (Number(item.quantity) || 1) * (Number(item.price) || 0),
      0
    );

    // 7. Update order record
    const { data: updatedOrder, error: updateOrderErr } = await supabase
      .from('orders')
      .update({
        total_amount: recalculatedTotal,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select('*, order_items(*)')
      .single();

    if (updateOrderErr) {
      return NextResponse.json({ error: 'Failed to update order total' }, { status: 500 });
    }

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (err: any) {
    console.error('❌ [Order Items Update Error]:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
