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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { consignment_id, tracking_code, courier_name, courier_status, note } = body;
    const supabase = createAdminClient();

    const updatePayload: any = { updated_at: new Date().toISOString() };
    if (consignment_id !== undefined) updatePayload.consignment_id = consignment_id ? String(consignment_id) : null;
    if (tracking_code !== undefined) updatePayload.tracking_code = tracking_code ? String(tracking_code) : null;
    if (courier_name !== undefined) updatePayload.courier_name = courier_name;
    if (courier_status !== undefined) updatePayload.courier_status = courier_status;
    if (note !== undefined) updatePayload.note = note;

    let { data: updatedOrder, error: updateErr } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', id)
      .select('*, order_items(*)')
      .single();

    if (updateErr) {
      const fallbackPayload: any = { updated_at: new Date().toISOString() };
      if (consignment_id) {
        fallbackPayload.external_id = String(consignment_id);
        const tag = `[Steadfast CID: #${consignment_id}]`;
        if (note) fallbackPayload.note = `${note}\n${tag}`;
      }
      const fallbackResult = await supabase
        .from('orders')
        .update(fallbackPayload)
        .eq('id', id)
        .select('*, order_items(*)')
        .single();
      if (fallbackResult.error) {
        return NextResponse.json({ error: fallbackResult.error.message }, { status: 500 });
      }
      updatedOrder = {
        ...fallbackResult.data,
        consignment_id: consignment_id || null,
        tracking_code: tracking_code || null,
      };
    }

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}