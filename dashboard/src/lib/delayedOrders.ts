import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Automatically checks and releases orders in 'delayed_delivery' status to 'confirmed'
 * when stock becomes available.
 * Follows strict FIFO (First-In, First-Out): Oldest delayed orders are prioritized.
 *
 * @param supabase Supabase client (usually admin client)
 * @param variantId Optional: If restock occurred for a specific variant
 * @param restockedQuantity Optional: The exact physical quantity restocked.
 *        If provided, only up to this many units of the variant will be released from delayed queue.
 *        If omitted, checks against unallocated positive physical stock (stock_quantity > 0).
 */
export async function autoReleaseDelayedOrders(
  supabase: SupabaseClient,
  variantId?: string,
  restockedQuantity?: number
): Promise<{ releasedCount: number; orderIds: string[] }> {
  try {
    // 1. Fetch delayed delivery orders sorted strictly by created_at ascending (FIFO)
    const { data: delayedOrders, error: fetchErr } = await supabase
      .from('orders')
      .select('id, order_number, note, created_at, order_items(id, variant_id, quantity)')
      .eq('status', 'delayed_delivery')
      .order('created_at', { ascending: true });

    if (fetchErr || !delayedOrders || delayedOrders.length === 0) {
      return { releasedCount: 0, orderIds: [] };
    }

    // Filter to orders that contain this variant if variantId is provided
    const candidateOrders = variantId
      ? delayedOrders.filter((o) =>
          (o.order_items || []).some((item: any) => item.variant_id === variantId)
        )
      : delayedOrders;

    if (candidateOrders.length === 0) {
      return { releasedCount: 0, orderIds: [] };
    }

    // 2. Fetch current stock for all relevant variants across candidate orders
    const allVariantIds = Array.from(
      new Set(
        candidateOrders.flatMap((o) =>
          (o.order_items || []).map((item: any) => item.variant_id).filter(Boolean)
        )
      )
    );

    const { data: variantsData, error: varErr } = await supabase
      .from('product_variants')
      .select('id, stock_quantity')
      .in('id', allVariantIds);

    if (varErr || !variantsData) {
      return { releasedCount: 0, orderIds: [] };
    }

    // 3. Construct available fulfillment budget map
    const availableBudget = new Map<string, number>();

    for (const v of variantsData) {
      if (variantId && v.id === variantId && typeof restockedQuantity === 'number') {
        // For the specific variant being restocked, the budget is exactly the restocked physical quantity
        availableBudget.set(v.id, Math.max(0, restockedQuantity));
      } else {
        // For other variants or general check, only unallocated positive stock can fulfill delayed orders
        availableBudget.set(v.id, Math.max(0, Number(v.stock_quantity || 0)));
      }
    }

    const releasedOrderIds: string[] = [];

    // 4. Evaluate each candidate order in chronological FIFO order
    for (const order of candidateOrders) {
      const items = order.order_items || [];
      if (items.length === 0) continue;

      // If restocked for a specific variant and its restock budget is completely exhausted, stop early
      if (variantId && typeof restockedQuantity === 'number') {
        const remainingRestock = availableBudget.get(variantId) ?? 0;
        if (remainingRestock <= 0) {
          break;
        }
      }

      // Check if all items in order have available budget >= required quantity
      const canFulfill = items.every((item: any) => {
        if (!item.variant_id) return true;
        const available = availableBudget.get(item.variant_id) ?? 0;
        const required = Number(item.quantity || 1);
        return available >= required;
      });

      if (!canFulfill) {
        continue;
      }

      // Allocate / deduct from the restock budget in memory so subsequent orders don't exceed the restocked quantity
      for (const item of items) {
        if (item.variant_id) {
          const available = availableBudget.get(item.variant_id) ?? 0;
          const required = Number(item.quantity || 1);
          availableBudget.set(item.variant_id, Math.max(0, available - required));
        }
      }

      const releaseNote = '[Auto-Released to Confirmed on Restock]';
      const newNote = order.note ? `${order.note} | ${releaseNote}` : releaseNote;

      const { error: updateErr } = await supabase
        .from('orders')
        .update({
          status: 'confirmed',
          note: newNote,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (!updateErr) {
        releasedOrderIds.push(order.id);
      }
    }

    return { releasedCount: releasedOrderIds.length, orderIds: releasedOrderIds };
  } catch (err) {
    console.error('Failed to auto-release delayed orders:', err);
    return { releasedCount: 0, orderIds: [] };
  }
}
