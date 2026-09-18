import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { OrderStatus } from '@/types/database';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { status, note } = body;

    const allowedStatuses: OrderStatus[] = [
      'pending',
      'confirmed',
      'ready_to_ship',
      'on_the_way',
      'shipped',
      'delivered',
      'canceled',
    ];

    if (!allowedStatuses.includes(status)) {
      return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Check existing order
    const { data: order, error: fetchErr } = await supabase
      .from('orders')
      .select('id, status, order_number')
      .eq('id', id)
      .single();

    if (fetchErr || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Update status (trigger automatically handles restock if status is set to 'canceled')
    const updateData: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (note) updateData.note = note;

    const { data: updatedOrder, error: updateErr } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      throw updateErr;
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      message: `Order ${order.order_number} status changed from ${order.status} to ${status}`,
    });
  } catch (err: any) {
    console.error('Order status update error:', err);
    return NextResponse.json({ error: err.message || 'Failed to update order status' }, { status: 500 });
  }
}
