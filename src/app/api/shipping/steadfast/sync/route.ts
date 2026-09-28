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
      // Final delivery or partial delivery confirmed by Steadfast
      targetOrderStatus = 'shipped';
      paymentStatus = rawStatus === 'partial_delivered' ? 'partially_paid' : 'paid';
    } else if (parsed.isCancelledFinal) {
      // Final cancellation/return confirmed by Steadfast
      targetOrderStatus = 'canceled';
    } else {
      // Any intermediate or approval-pending state (in_transit, hold, delivered_approval_pending, cancelled_approval_pending, partial_delivered_approval_pending, unknown) keeps order safely in "on_the_way"
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

  // 3. Update database using strictly valid schema columns (status, payment_status, external_id, note, edit_history, updated_at)
  let newNote = order.note || '';
  if (cid && !newNote.includes(`CID: #${cid}`)) {
    const cidTag = `[Steadfast CID: #${cid}${trackingCode ? `, Tracking: ${trackingCode}` : ''}]`;
    newNote = newNote ? `${newNote}\n${cidTag}` : cidTag;
  }
  if (rawStatus === 'partial_delivered' && !newNote.includes('Partially Delivered')) {
    const partialTag = `[Steadfast: Partially Delivered - Customer accepted partial shipment]`;
    newNote = newNote ? `${newNote}\n${partialTag}` : partialTag;
  } else if (rawStatus === 'cancelled' && !newNote.includes('Steadfast: Returned')) {
    const cancelTag = `[Steadfast: Returned / Cancelled by courier]`;
    newNote = newNote ? `${newNote}\n${cancelTag}` : cancelTag;
  } else if (rawStatus === 'hold' && !newNote.includes('Steadfast: On Hold')) {
    const holdTag = `[Steadfast: On Hold - Delivery delayed / rescheduled]`;
    newNote = newNote ? `${newNote}\n${holdTag}` : holdTag;
  }

  const historyEntry = {
    timestamp: new Date().toISOString(),
    action: 'steadfast_sync',
    courier_status: rawStatus,
    tracking_message: parsed.label,
    consignment_id: cid,
    tracking_code: trackingCode,
  };
  const currentHistory = Array.isArray(order.edit_history) ? order.edit_history : [];

  const updatePayload: any = {
    status: targetOrderStatus,
    payment_status: paymentStatus,
    external_id: cid ? String(cid) : (order.external_id || null),
    note: newNote,
    edit_history: [...currentHistory, historyEntry],
    updated_at: new Date().toISOString(),
  };

  let { data: updatedOrder, error: updateError } = await supabase
    .from('orders')
    .update(updatePayload)
    .eq('id', order.id)
    .select('*, order_items(*)')
    .single();

  if (updateError) {
    console.error('[Steadfast Sync] Update error:', updateError.message);
  }

  return {
    success: true,
    consignment_id: cid,
    tracking_code: trackingCode,
    delivery_status: rawStatus,
    courier_status: rawStatus,
    status_label: parsed.label,
    order: {
      ...(updatedOrder || order),
      consignment_id: cid,
      tracking_code: trackingCode,
      courier_status: rawStatus,
    },
    orderId,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { orderId, orderIds, syncAll } = body;

    if (!syncAll && !orderId && (!Array.isArray(orderIds) || orderIds.length === 0)) {
      return NextResponse.json({ error: 'Order ID, array of orderIds, or syncAll: true is required' }, { status: 400 });
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

    // Allow cron key header
    const cronKey = req.headers.get('x-cron-key') || req.nextUrl.searchParams.get('cron_key');
    if (cronKey && (cronKey === process.env.CRON_SECRET || cronKey === process.env.SUPABASE_SERVICE_ROLE_KEY)) {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Handle syncAll (Automated background sync of all active in-transit parcels)
    if (syncAll) {
      const { data: activeOrders, error: activeErr } = await supabase
        .from('orders')
        .select('id, order_number, status, external_id, note')
        .in('status', ['on_the_way', 'ready_to_ship'])
        .not('external_id', 'is', null)
        .order('updated_at', { ascending: true })
        .limit(60);

      if (activeErr) {
        return NextResponse.json({ error: activeErr.message }, { status: 500 });
      }

      const results = [];
      let successCount = 0;
      let deliveredCount = 0;
      let canceledCount = 0;

      for (const ord of (activeOrders || [])) {
        const res = await syncSingleOrder(ord.id, supabase);
        results.push(res);
        if (res.success && !res.skipped) {
          successCount++;
          if (res.order?.status === 'shipped') deliveredCount++;
          if (res.order?.status === 'canceled') canceledCount++;
        }
      }

      return NextResponse.json({
        success: true,
        autoSyncAll: true,
        total: (activeOrders || []).length,
        successCount,
        deliveredCount,
        canceledCount,
        results,
      });
    }

    // 3. Handle Bulk Sync
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

    // 4. Handle Single Sync
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

export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();

    let isAuthorized = false;
    try {
      const serverSupabase = await createServerClient();
      const {
        data: { user },
      } = await serverSupabase.auth.getUser();
      if (user) isAuthorized = true;
    } catch {}

    const authHeader = req.headers.get('authorization');
    if (!isAuthorized && authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1].trim();
      const {
        data: { user },
      } = await supabase.auth.getUser(token);
      if (user) isAuthorized = true;
    }

    const cronKey = req.headers.get('x-cron-key') || req.nextUrl.searchParams.get('cron_key');
    if (cronKey && (cronKey === process.env.CRON_SECRET || cronKey === process.env.SUPABASE_SERVICE_ROLE_KEY)) {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: activeOrders, error: activeErr } = await supabase
      .from('orders')
      .select('id, order_number, status, external_id, note')
      .in('status', ['on_the_way', 'ready_to_ship'])
      .not('external_id', 'is', null)
      .order('updated_at', { ascending: true })
      .limit(60);

    if (activeErr) {
      return NextResponse.json({ error: activeErr.message }, { status: 500 });
    }

    const results = [];
    let successCount = 0;
    let deliveredCount = 0;
    let canceledCount = 0;

    for (const ord of (activeOrders || [])) {
      const res = await syncSingleOrder(ord.id, supabase);
      results.push(res);
      if (res.success && !res.skipped) {
        successCount++;
        if (res.order?.status === 'shipped') deliveredCount++;
        if (res.order?.status === 'canceled') canceledCount++;
      }
    }

    return NextResponse.json({
      success: true,
      autoSyncAll: true,
      total: (activeOrders || []).length,
      successCount,
      deliveredCount,
      canceledCount,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
