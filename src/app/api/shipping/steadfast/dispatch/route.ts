import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createSteadfastConsignment } from '@/lib/steadfast';
import { getOrderAdvance } from '@/lib/utils';

export const dynamic = 'force-dynamic';

async function dispatchSingleOrder(orderId: string, supabase: any, overrideItemDescription?: string) {
  // 1. Fetch order with order_items
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    return { success: false, error: 'Order not found', orderId };
  }

  // 2. Calculate COD amount deducting advance
  const advanceDeduction = getOrderAdvance(order);
  const codAmount =
    order.payment_status === 'paid'
      ? 0
      : Math.max(0, Math.round(Number(order.total_amount) - advanceDeduction));

  // 3. Resolve items from order_items, original_items, or direct query fallback
  let items = Array.isArray(order.order_items) && order.order_items.length > 0
    ? order.order_items
    : (Array.isArray(order.original_items) && order.original_items.length > 0)
    ? order.original_items
    : [];

  if (items.length === 0) {
    const { data: directItems } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id);
    if (directItems && directItems.length > 0) {
      items = directItems;
    }
  }

  // 4. Construct comprehensive item description for Steadfast package details (Steadfast strictly enforces max 255 chars)
  let itemDescription = (overrideItemDescription || '').trim();
  if (!itemDescription && items.length > 0) {
    itemDescription = items
      .map((item: any) => {
        const qty = item.quantity || 1;
        const title = (item.title || item.name || 'Product').trim();
        const variant =
          item.variant_title && item.variant_title !== 'Default Title'
            ? ` (${item.variant_title.trim()})`
            : '';
        return `${qty}x ${title}${variant}`;
      })
      .join(', ');
  }

  if (itemDescription.length > 255) {
    let truncated = itemDescription.slice(0, 252).trim();
    if (truncated.endsWith(',')) {
      truncated = truncated.slice(0, -1).trim();
    }
    itemDescription = truncated + '...';
  }

  // 5. Dispatch to Steadfast API
  const steadfastResult = await createSteadfastConsignment({
    invoice: order.order_number,
    recipient_name: order.customer_name,
    recipient_phone: order.customer_phone,
    recipient_address: order.shipping_address,
    cod_amount: codAmount,
    note: order.note || undefined,
    recipient_email: order.customer_email || undefined,
    item_description: itemDescription || undefined,
    total_lot: 1,
    delivery_type: 0,
  });

  if (steadfastResult.status !== 200 || !steadfastResult.consignment) {
    let errorMsg = steadfastResult.message || 'Failed to create consignment in Steadfast Courier.';
    if (steadfastResult.errors && typeof steadfastResult.errors === 'object') {
      const fieldErrors = Object.entries(steadfastResult.errors)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
        .join('; ');
      if (fieldErrors) errorMsg = `${errorMsg} (${fieldErrors})`;
    }
    return {
      success: false,
      error: errorMsg,
      details: steadfastResult.errors,
      status: steadfastResult.status,
      orderId,
    };
  }

  const consignment: any = steadfastResult.consignment || steadfastResult;
  const cid =
    consignment?.consignment_id ||
    consignment?.id ||
    (steadfastResult as any)?.consignment_id ||
    (steadfastResult as any)?.id;
  const trackingCode =
    consignment?.tracking_code ||
    (steadfastResult as any)?.tracking_code ||
    (cid ? String(cid) : null);
  const courierStatus =
    consignment?.status ||
    (steadfastResult as any)?.delivery_status ||
    'in_review';

  // 5. Update order to 'on_the_way' (Stage 3: With Courier) with Steadfast info
  const historyEntry = {
    timestamp: new Date().toISOString(),
    action: 'dispatched_to_steadfast',
    consignment_id: cid ? String(cid) : null,
    tracking_code: trackingCode ? String(trackingCode) : null,
    status: courierStatus,
    message: steadfastResult.message,
  };

  const currentHistory = Array.isArray(order.edit_history) ? order.edit_history : [];
  const updatedHistory = [...currentHistory, historyEntry];

  const noteTag = `[Dispatched via Steadfast - CID: #${cid || 'N/A'}, Tracking: ${trackingCode || 'N/A'}]`;
  const updatedNote = order.note ? `${order.note}\n${noteTag}` : noteTag;

  let { data: updatedOrder, error: updateError } = await supabase
    .from('orders')
    .update({
      status: 'on_the_way',
      courier_name: 'steadfast',
      consignment_id: cid ? String(cid) : null,
      tracking_code: trackingCode ? String(trackingCode) : null,
      courier_status: courierStatus,
      tracking_message: 'Consignment created with Steadfast Courier',
      courier_updated_at: new Date().toISOString(),
      external_id: cid ? String(cid) : trackingCode ? String(trackingCode) : null,
      edit_history: updatedHistory,
      note: updatedNote,
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)
    .select('*, order_items(*)')
    .single();

  // Fallback: If courier columns have not yet been created in Supabase via migration, update core existing schema
  if (updateError) {
    console.warn(
      '[Steadfast Dispatch] Courier columns fallback triggered:',
      updateError.message
    );
    const fallbackResult = await supabase
      .from('orders')
      .update({
        status: 'on_the_way',
        external_id: cid ? String(cid) : trackingCode ? String(trackingCode) : null,
        edit_history: updatedHistory,
        note: updatedNote,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .select('*, order_items(*)')
      .single();

    if (!fallbackResult.error) {
      updatedOrder = fallbackResult.data;
    }
  }

  // Merge courier properties onto response order object even if fallback ran
  const responseOrder = {
    ...(updatedOrder || order),
    status: 'on_the_way',
    courier_name: 'steadfast',
    consignment_id: cid ? String(cid) : (updatedOrder?.consignment_id || null),
    tracking_code: trackingCode ? String(trackingCode) : (updatedOrder?.tracking_code || null),
    courier_status: courierStatus,
    external_id: cid ? String(cid) : (updatedOrder?.external_id || null),
  };

  return {
    success: true,
    message: steadfastResult.message,
    consignment: {
      id: cid,
      consignment_id: cid,
      tracking_code: trackingCode,
      status: courierStatus,
    },
    order: responseOrder,
    orderId,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, orderIds, itemDescription, customItemDescription } = body;
    const finalItemDesc = itemDescription || customItemDescription;

    if (!orderId && (!Array.isArray(orderIds) || orderIds.length === 0)) {
      return NextResponse.json(
        { error: 'Order ID or array of orderIds is required.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 1. Authenticate requester (admin or packing)
    let isAuthorized = false;
    try {
      const serverSupabase = await createServerClient();
      const {
        data: { user },
      } = await serverSupabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profile?.role === 'admin' || profile?.role === 'packing') {
          isAuthorized = true;
        }
      }
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
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

          if (profile?.role === 'admin' || profile?.role === 'packing') {
            isAuthorized = true;
          }
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized: Only packing and admin team can dispatch to Steadfast.' },
        { status: 403 }
      );
    }

    // 2. Handle Bulk Dispatch
    if (Array.isArray(orderIds) && orderIds.length > 0) {
      const results = [];
      let successCount = 0;
      let failureCount = 0;

      for (const id of orderIds) {
        const res = await dispatchSingleOrder(id, supabase);
        results.push(res);
        if (res.success) {
          successCount++;
        } else {
          failureCount++;
        }
      }

      return NextResponse.json({
        success: true,
        bulk: true,
        total: orderIds.length,
        successCount,
        failureCount,
        results,
      });
    }

    // 3. Handle Single Dispatch
    const singleResult = await dispatchSingleOrder(orderId, supabase, finalItemDesc);
    if (!singleResult.success) {
      return NextResponse.json(
        { error: singleResult.error, details: singleResult.details },
        { status: singleResult.status || 400 }
      );
    }

    return NextResponse.json(singleResult);
  } catch (err: any) {
    console.error('[Steadfast Dispatch] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error while dispatching to Steadfast.' },
      { status: 500 }
    );
  }
}
