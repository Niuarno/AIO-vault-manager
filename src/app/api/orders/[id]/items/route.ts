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

    const reason: string = body.reason || '';
    const editedBy: string = body.edited_by || 'Staff Member';

    if (!reason.trim()) {
      return NextResponse.json(
        { error: 'Please enter a reasoning note explaining why this order was edited.' },
        { status: 400 }
      );
    }

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

    // Insert new items preserving is_upsell distinction
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

    // 7. Prepare Edit History Entry and preserve Original Order snapshot
    const nowIso = new Date().toISOString();
    const formattedDate = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const editLogEntry = {
      id: crypto.randomUUID(),
      timestamp: nowIso,
      edited_by: editedBy,
      reason: reason.trim(),
      previous_total: order.total_amount,
      new_total: recalculatedTotal,
      previous_items: (oldItems || []).map((i) => ({
        title: i.title,
        variant_title: i.variant_title,
        quantity: i.quantity,
        price: i.price,
        is_upsell: i.is_upsell,
      })),
      new_items: newItems.map((i) => ({
        title: i.title,
        variant_title: i.variant_title,
        quantity: i.quantity,
        price: i.price,
        is_upsell: Boolean(i.is_upsell),
      })),
    };

    const originalItems =
      order.original_items ||
      (oldItems || []).map((i) => ({
        title: i.title,
        variant_title: i.variant_title,
        quantity: i.quantity,
        price: i.price,
        is_upsell: i.is_upsell,
      }));

    const existingHistory = Array.isArray(order.edit_history) ? order.edit_history : [];
    const updatedHistory = [...existingHistory, editLogEntry];

    // Note log fallback string
    const noteLog = `\n[EDIT ${formattedDate} by ${editedBy}]: Reason: "${reason.trim()}". Items adjusted. Total: ${order.total_amount} -> ${recalculatedTotal} BDT.`;
    const updatedNote = (order.note || '').trim() + noteLog;

    let updatedOrder: any = null;

    // Try updating with JSONB history columns
    const { data: fullUpdateData, error: fullUpdateErr } = await supabase
      .from('orders')
      .update({
        total_amount: recalculatedTotal,
        updated_at: nowIso,
        note: updatedNote,
        edit_history: updatedHistory,
        original_items: originalItems,
      })
      .eq('id', orderId)
      .select('*, order_items(*)')
      .single();

    if (fullUpdateErr) {
      // Graceful fallback without JSONB columns if not yet created in Supabase schema
      const { data: fallbackData, error: fallbackErr } = await supabase
        .from('orders')
        .update({
          total_amount: recalculatedTotal,
          updated_at: nowIso,
          note: updatedNote,
        })
        .eq('id', orderId)
        .select('*, order_items(*)')
        .single();

      if (fallbackErr) {
        return NextResponse.json({ error: 'Failed to update order: ' + fallbackErr.message }, { status: 500 });
      }
      updatedOrder = fallbackData;
    } else {
      updatedOrder = fullUpdateData;
    }

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (err: any) {
    console.error('❌ [Order Items Update Error]:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
