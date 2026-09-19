import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';
import {
  checkSteadfastStatusByInvoice,
  checkSteadfastStatusByCid,
} from '@/lib/steadfast';
import { OrderStatus } from '@/types/database';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Authenticate user
    let isAuthorized = false;
    try {
      const serverSupabase = await createServerClient();
      const {
        data: { user },
      } = await serverSupabase.auth.getUser();
      if (user) isAuthorized = true;
    } catch {
      // ignore
    }

    if (!isAuthorized) {
      const authHeader = req.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.split('Bearer ')[1].trim();
        const {
          data: { user },
        } = await supabase.auth.getUser(token);
        if (user) isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // 3. Query Steadfast
    let steadfastData = null;
    if (order.consignment_id) {
      steadfastData = await checkSteadfastStatusByCid(order.consignment_id);
    } else {
      steadfastData = await checkSteadfastStatusByInvoice(order.order_number);
    }

    if (!steadfastData || steadfastData.status !== 200) {
      return NextResponse.json({
        success: false,
        message:
          steadfastData?.message ||
          'Could not retrieve live status from Steadfast. Ensure order is registered in Steadfast.',
      });
    }

    const rawStatus = String(steadfastData.delivery_status || '').toLowerCase().trim();
    let targetOrderStatus: OrderStatus = order.status;
    let paymentStatus = order.payment_status;

    if (rawStatus === 'delivered' || rawStatus === 'partial_delivered') {
      targetOrderStatus = 'shipped';
      paymentStatus = 'paid';
    } else if (rawStatus === 'cancelled' || rawStatus === 'cancelled_approval_pending') {
      targetOrderStatus = 'canceled';
    } else if (
      rawStatus === 'pending' ||
      rawStatus === 'in_review' ||
      rawStatus === 'hold'
    ) {
      if (order.status === 'confirmed' || order.status === 'ready_to_ship') {
        targetOrderStatus = 'on_the_way';
      }
    }

    // 4. Update order if anything changed
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({
        status: targetOrderStatus,
        payment_status: paymentStatus,
        courier_status: rawStatus || order.courier_status,
        courier_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .select('*, order_items(*)')
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      courierStatus: rawStatus,
      order: updatedOrder,
      message: `Steadfast status synced: ${rawStatus || 'No status change'}`,
    });
  } catch (err: any) {
    console.error('[Steadfast Sync] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal error checking Steadfast status' },
      { status: 500 }
    );
  }
}
