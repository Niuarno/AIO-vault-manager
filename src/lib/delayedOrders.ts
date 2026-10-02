import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Automatically checks and releases orders in 'delayed_delivery' status to 'confirmed'
 * when stock becomes available.
 * Follows FIFO (First-In, First-Out): Oldest delayed orders are prioritized.
 */
export async function autoReleaseDelayedOrders(
  supabase: SupabaseClient,
  variantId?: string
): Promise<{ releasedCount: number; orderIds: string[] }> {
  try {
    // 1. Fetch delayed delivery orders
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

    // 2. Fetch current stock for all relevant variants
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

    const stockMap = new Map<string, number>(
      variantsData.map((v) => [v.id, v.stock_quantity ?? 0])
    );

    const releasedOrderIds: string[] = [];

    // 3. Evaluate each candidate order in chronological FIFO order
    for (const order of candidateOrders) {
      const items = order.order_items || [];
      if (items.length === 0) continue;

      // Check if all items in order have available stock >= required quantity
      const canFulfill = items.every((item: any) => {
        if (!item.variant_id) return true;
        const available = stockMap.get(item.variant_id) ?? 0;
        const required = Number(item.quantity || 1);
        return available >= required;
      });

      if (canFulfill) {
        // Allocate stock in memory so subsequent candidate orders don't double-claim the same restocked units
        for (const item of items) {
          if (item.variant_id) {
            const available = stockMap.get(item.variant_id) ?? 0;
            const required = Number(item.quantity || 1);
            stockMap.set(item.variant_id, Math.max(0, available - required));
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
    }

    return { releasedCount: releasedOrderIds.length, orderIds: releasedOrderIds };
  } catch (err) {
    console.error('Failed to auto-release delayed orders:', err);
    return { releasedCount: 0, orderIds: [] };
  }
}
