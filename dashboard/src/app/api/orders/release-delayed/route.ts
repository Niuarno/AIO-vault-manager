import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { autoReleaseDelayedOrders } from '@/lib/delayedOrders';

export async function POST(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await req.json().catch(() => ({}));
    const { variant_id, order_id } = body;

    if (order_id) {
      // Manual release of a specific order
      const { data: order, error: fetchErr } = await supabase
        .from('orders')
        .select('id, status, note, order_number')
        .eq('id', order_id)
        .single();

      if (fetchErr || !order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      const releaseNote = '[Released to Packing from Delayed Queue]';
      const newNote = order.note ? `${order.note} | ${releaseNote}` : releaseNote;

      const { data: updatedOrder, error: updateErr } = await supabase
        .from('orders')
        .update({
          status: 'confirmed',
          note: newNote,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order_id)
        .select()
        .single();

      if (updateErr) throw updateErr;

      return NextResponse.json({
        success: true,
        order: updatedOrder,
        message: `Order ${order.order_number} released to packing.`,
      });
    }

    // Auto-release all eligible delayed orders
    const result = await autoReleaseDelayedOrders(supabase, variant_id);

    return NextResponse.json({
      success: true,
      released_count: result.releasedCount,
      order_ids: result.orderIds,
      message: result.releasedCount > 0
        ? `Successfully released ${result.releasedCount} delayed order(s) to packing!`
        : 'No waiting delayed orders could be fulfilled with current stock.',
    });
  } catch (err: any) {
    console.error('Release delayed orders error:', err);
    return NextResponse.json({ error: err.message || 'Failed to release delayed orders' }, { status: 500 });
  }
}
