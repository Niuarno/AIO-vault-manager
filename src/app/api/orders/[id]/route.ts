import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const supabase = createAdminClient();

    const { data: order, error } = await supabase
      .from('orders')
      .select('*, order_items(*), sales_rep:profiles(*)')
      .eq('id', id)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, order });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const supabase = createAdminClient();

    // Verify order exists
    const { data: order, error: fetchErr } = await supabase
      .from('orders')
      .select('id, order_number')
      .eq('id', id)
      .single();

    if (fetchErr || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Clean up dependencies
    await supabase.from('upsell_rewards').delete().eq('order_id', id);
    await supabase.from('inventory_logs').delete().eq('order_id', id);
    await supabase.from('order_items').delete().eq('order_id', id);

    // Delete the order itself
    const { error: deleteErr } = await supabase
      .from('orders')
      .delete()
      .eq('id', id);

    if (deleteErr) {
      throw deleteErr;
    }

    return NextResponse.json({
      success: true,
      message: `Order ${order.order_number} successfully deleted.`,
    });
  } catch (err: any) {
    console.error('Failed to delete order:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}