import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';
import {
  checkSteadfastStatusByInvoice,
  checkSteadfastStatusByCid,
  checkSteadfastStatusByTrackingCode,
  parseSteadfastStatus,
} from '@/lib/steadfast';
import { OrderStatus } from '@/types/database';

export const dynamic = 'force-dynamic';

async function syncSingleOrder(orderId: string, supabase: any) {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    return { success: false, error: 'Order not found', orderId };
  }

  // Strict status guard: NEVER change order status for pending/sales pipeline orders
  if (order.status === 'pending' || order.status === 'not_reachable') {
    return {
      success: true,
      skipped: true,
      message: `Order #${order.order_number} is in sales pipeline (${order.status}). Sync skipped.`,
      order,
    };
  }

  // 1. Resolve CID, Tracking Code, or Invoice
  const resolvedCid =
    order.consignment_id ||
    (order.external_id && !order.external_id.startsWith('http') && /^\d+$/.test(order.external_id) ? order.external_id : null) ||
    order.note?.match(/CID:\s*#?([A-Za-z0-9_-]+)/i)?.[1] ||
    null;

  const resolvedTracking =
    order.tracking_code ||
    order.note?.match(/Tracking:\s*([A-Za-z0-9_-]+)/i)?.[1] ||
    null;

  let steadfastData: any = null;

  // Try by CID first
  if (resolvedCid) {
    steadfastData = await checkSteadfastStatusByCid(resolvedCid);
  }

  // If no success, try by tracking code
  if ((!steadfastData || steadfastData.status !== 200) && resolvedTracking) {
    steadfastData = await checkSteadfastStatusByTrackingCode(resolvedTracking);
  }

  // If still no success, try by invoice
  if (!steadfastData || steadfastData.status !== 200) {
    steadfastData = await checkSteadfastStatusByInvoice(order.order_number);
  }

  if (!steadfastData || steadfastData.status !== 200) {
    return {
      success: false,
      error:
        steadfastData?.message ||
        'Could not retrieve live status from Steadfast. Ensure order is registered in Steadfast.',
      orderId,
    };
  }

  const rawStatus = String(steadfastData.delivery_status || '').toLowerCase().trim();
  const parsed = parseSteadfastStatus(rawStatus);

  let targetOrderStatus: OrderStatus = order.status;
  let paymentStatus = order.payment_status;

  // 2. Map status carefully to prevent premature cancellation or completion
  if (order.status === 'ready_to_ship' || order.status === 'on_the_way') {
    if (parsed.isDeliveredFinal) {
      // Final delivery confirmed by Steadfast
      targetOrderStatus = 'shipped';
      paymentStatus = 'paid';
    } else if (parsed.isCancelledFinal) {
      // Final cancellation/return confirmed by Steadfast
      targetOrderStatus = 'canceled';
    } else {
      // Any intermediate or approval-pending state keeps order safely in "on_the_way"
      targetOrderStatus = 'on_the_way';
    }
  }

  const cid =
    (steadfastData as any)?.consignment_id ||
    (steadfastData as any)?.id ||
    resolvedCid ||
    order.consignment_id ||
    null;

  const trackingCode =
    (steadfastData as any)?.tracking_code ||
    resolvedTracking ||
    order.tracking_code ||
    (cid ? String(cid) : null);

  // 3. Update database
  const updatePayload: any = {
    status: targetOrderStatus,
    payment_status: paymentStatus,
    courier_status: rawStatus || order.courier_status,
    tracking_message: parsed.label,
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

  if (updateError) {
    console.warn('[Steadfast Sync] Fallback update:', updateError.message);
    const fallbackPayload: any = {
      status: targetOrderStatus,
      payment_status: paymentStatus,
      updated_at: new Date().toISOString(),
    };
    if (cid) {
      fallbackPayload.external_id = String(cid);
    }
    const fallbackRes = await supabase
      .from('orders')
      .update(fallbackPayload)
      .eq('id', order.id)
      .select('*, order_items(*)')
      .single();

    if (!fallbackRes.error) {
      updatedOrder = fallbackRes.data;
    }
  }

  return {
    success: true,
    consignment_id: cid,
    tracking_code: trackingCode,
    delivery_status: rawStatus,
    status_label: parsed.label,
    order: updatedOrder || order,
    orderId,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, orderIds } = body;

    if (!orderId && (!Array.isArray(orderIds) || orderIds.length === 0)) {
      return NextResponse.json({ error: 'Order ID or array of orderIds is required' }, { status: 400 });
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

    // 2. Handle Bulk Sync
    if (Array.isArray(orderIds) && orderIds.length > 0) {
      const results = [];
      let successCount = 0;

      for (const id of orderIds) {
        const res = await syncSingleOrder(id, supabase);
        results.push(res);
        if (res.success && !res.skipped) successCount++;
      }

      return NextResponse.json({
        success: true,
        bulk: true,
        total: orderIds.length,
        successCount,
        results,
      });
    }

    // 3. Handle Single Sync
    const singleResult = await syncSingleOrder(orderId, supabase);
    if (!singleResult.success) {
      return NextResponse.json({
        success: false,
        message: singleResult.error || 'Failed to sync with Steadfast',
      });
    }

    return NextResponse.json(singleResult);
  } catch (err: any) {
    console.error('[Steadfast Sync] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal error while syncing with Steadfast' },
      { status: 500 }
    );
  }
}
