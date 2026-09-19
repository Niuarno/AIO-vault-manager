import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { syncWebsiteUpsellQuotaRewards } from '@/lib/commission';

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

    // Rule: "make the upsell functionality only valid for website orders, any other source are count as regular sells"
    const isWebsite = order.source === 'website';
    const itemsToInsert = newItems.map((item) => ({
      order_id: orderId,
      product_id: item.product_id || null,
      variant_id: item.variant_id || null,
      title: item.title,
      variant_title: item.variant_title || null,
      quantity: Number(item.quantity) || 1,
      price: Number(item.price) || 0,
      is_upsell: isWebsite ? Boolean(item.is_upsell) : false,
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

    // 7. Determine requester role & staff assignment rules
    let isAdmin = false;
    let requesterUserId: string | null = null;
    try {
      const serverSupabase = await createServerClient();
      const { data: { user } } = await serverSupabase.auth.getUser();
      if (user) {
        requesterUserId = user.id;
        const { data: prof } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        isAdmin = prof?.role === 'admin';
      }
    } catch {
      // ignore
    }

    // Fallback: Check Authorization Bearer Token
    if (!requesterUserId) {
      const authHeader = req.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.split('Bearer ')[1].trim();
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          requesterUserId = user.id;
          const { data: prof } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
          isAdmin = prof?.role === 'admin';
        }
      }
    }

    // Rule: "when any order has already been assigned to a staff member it will only editable for that specifc staff member and admins no one else"
    if (!isAdmin && order.sales_rep_id && order.sales_rep_id !== requesterUserId) {
      return NextResponse.json(
        {
          error: 'Permission denied: This order is assigned to another staff member and can only be edited by them or an administrator.',
        },
        { status: 403 }
      );
    }

    let resolvedSalesRepId = order.sales_rep_id;
    const hasUpsellItem = itemsToInsert.some((i) => i.is_upsell);

    if (isAdmin) {
      // Admin has full power to assign or reassign
      if (body.sales_rep_id !== undefined) {
        resolvedSalesRepId = body.sales_rep_id || null;
      }
    } else {
      // Non-admin sales staff:
      if (order.sales_rep_id) {
        // PERMANENTLY LOCKED: Staff cannot change or steal already assigned orders
        resolvedSalesRepId = order.sales_rep_id;
      } else if (isWebsite && hasUpsellItem) {
        // Staff who upsells on an unassigned website order is auto-assigned
        resolvedSalesRepId = requesterUserId || body.sales_rep_id || null;
      }
    }

    // 8. Prepare Edit History Entry and preserve Original Order snapshot
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
      new_items: itemsToInsert.map((i: any) => ({
        title: i.title,
        variant_title: i.variant_title,
        quantity: i.quantity,
        price: i.price,
        is_upsell: i.is_upsell,
        is_reachout: Boolean(i.is_reachout || body.is_reachout),
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
    const reachoutNoteTag = body.is_reachout && !order.note?.toLowerCase().includes('reachout')
      ? ` [Reachout Sale by ${editedBy}]`
      : '';
    const noteLog = `\n[EDIT ${formattedDate} by ${editedBy}]: Reason: "${reason.trim()}". Items adjusted. Total: ${order.total_amount} -> ${recalculatedTotal} BDT.${reachoutNoteTag}`;
    const updatedNote = (order.note || '').trim() + noteLog;

    let updatedOrder: any = null;

    // Try updating with JSONB history columns
    const updatePayload: Record<string, any> = {
      total_amount: recalculatedTotal,
      updated_at: nowIso,
      note: updatedNote,
      edit_history: updatedHistory,
      original_items: originalItems,
      sales_rep_id: resolvedSalesRepId,
    };

    const { data: fullUpdateData, error: fullUpdateErr } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', orderId)
      .select('*, order_items(*)')
      .single();

    if (fullUpdateErr) {
      // Graceful fallback without JSONB columns if not yet created in Supabase schema
      const fallbackPayload: Record<string, any> = {
        total_amount: recalculatedTotal,
        updated_at: nowIso,
        note: updatedNote,
        sales_rep_id: resolvedSalesRepId,
      };

      const { data: fallbackData, error: fallbackErr } = await supabase
        .from('orders')
        .update(fallbackPayload)
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

    // 9. If this order is from website and attributed to a staff member, synchronize quota rewards
    if (isWebsite && resolvedSalesRepId) {
      await syncWebsiteUpsellQuotaRewards(supabase, resolvedSalesRepId, orderId);
    }

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (err: any) {
    console.error('❌ [Order Items Update Error]:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
