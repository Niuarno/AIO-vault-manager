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
    const resolvedCid =
      order.consignment_id ||
      (order.external_id && !order.external_id.startsWith('http') && /^\d+$/.test(order.external_id) ? order.external_id : null) ||
      order.note?.match(/CID:\s*#?([A-Za-z0-9_-]+)/i)?.[1] ||
      null;

    let steadfastData = null;
    if (resolvedCid) {
      steadfastData = await checkSteadfastStatusByCid(resolvedCid);
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

    // Strict status guard: NEVER change order status for pending/sales pipeline orders
    if (order.status !== 'pending' && order.status !== 'not_reachable') {
      if (rawStatus === 'delivered' || rawStatus === 'partial_delivered') {
        if (order.status === 'ready_to_ship' || order.status === 'on_the_way') {
          targetOrderStatus = 'shipped';
          paymentStatus = 'paid';
        }
      } else if (rawStatus === 'cancelled' || rawStatus === 'cancelled_approval_pending') {
        if (order.status === 'ready_to_ship' || order.status === 'on_the_way') {
          targetOrderStatus = 'canceled';
        }
      } else if (
        rawStatus === 'pending' ||
        rawStatus === 'in_review' ||
        rawStatus === 'hold'
      ) {
        if (order.status === 'ready_to_ship') {
          targetOrderStatus = 'on_the_way';
        }
      }
    }

    const cid =
      (steadfastData as any)?.consignment_id ||
      (steadfastData as any)?.id ||
      order.consignment_id ||
      null;
    const trackingCode =
      (steadfastData as any)?.tracking_code ||
      order.tracking_code ||
      (cid ? String(cid) : null);

    // 4. Update order with status and consignment tracking information
    const updatePayload: any = {
      status: targetOrderStatus,
      payment_status: paymentStatus,
      courier_status: rawStatus || order.courier_status,
      courier_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (cid) {
      updatePayload.consignment_id = String(cid);
      updatePayload.courier_name = 'steadfast';
    }
    if (trackingCode) {
      updatePayload.tracking_code = String(trackingCode);
    }

    let { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', order.id)
      .select('*, order_items(*)')
      .single();

    // Fallback if courier columns don't exist yet
    if (updateError) {
      console.warn('[Steadfast Sync] Fallback to core columns:', updateError.message);
      const fallbackPayload: any = {
        status: targetOrderStatus,
        payment_status: paymentStatus,
        updated_at: new Date().toISOString(),
      };
      if (cid) {
        fallbackPayload.external_id = String(cid);
        const tag = `[Steadfast CID: #${cid}]`;
        if (!order.note?.includes(tag)) {
          fallbackPayload.note = order.note ? `${order.note}\n${tag}` : tag;
        }
      }
      const fallbackResult = await supabase
        .from('orders')
        .update(fallbackPayload)
        .eq('id', order.id)
        .select('*, order_items(*)')
        .single();
      if (!fallbackResult.error) {
        updatedOrder = fallbackResult.data;
      }
    }

    const responseOrder = {
      ...(updatedOrder || order),
      status: targetOrderStatus,
      payment_status: paymentStatus,
      courier_status: rawStatus || order.courier_status,
      consignment_id: cid ? String(cid) : (updatedOrder?.consignment_id || null),
      tracking_code: trackingCode ? String(trackingCode) : (updatedOrder?.tracking_code || null),
      courier_name: 'steadfast',
    };

    return NextResponse.json({
      success: true,
      courierStatus: rawStatus,
      consignment_id: cid,
      tracking_code: trackingCode,
      order: responseOrder,
      message: `Steadfast status synced: ${rawStatus || 'No status change'}${cid ? ` (CID: #${cid})` : ''}`,
    });
  } catch (err: any) {
    console.error('[Steadfast Sync] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal error checking Steadfast status' },
      { status: 500 }
    );
  }
}
