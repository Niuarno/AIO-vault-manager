import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { OrderStatus } from '@/types/database';

/**
 * Health check & diagnostic endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'steadfast-webhook-receiver',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Steadfast Webhook Handler
 * Documentation source: Steadfast Dashboard Webhook Integration
 * Handles 'delivery_status' and 'tracking_update' payloads.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Verify Webhook Bearer Auth Token if configured
    const expectedToken = process.env.STEADFAST_WEBHOOK_BEARER_TOKEN;
    if (expectedToken) {
      const authHeader = req.headers.get('authorization');
      const providedToken = authHeader?.replace(/^Bearer\s+/i, '').trim();
      if (!providedToken || providedToken !== expectedToken) {
        console.warn('[Steadfast Webhook] Unauthorized request attempt');
        return NextResponse.json(
          { status: 'error', message: 'Unauthorized webhook token' },
          { status: 401 }
        );
      }
    }

    const payload = await req.json();

    const {
      notification_type,
      consignment_id,
      invoice,
      status: courierStatus,
      cod_amount,
      delivery_charge,
      tracking_message,
      updated_at,
    } = payload;

    if (!invoice && !consignment_id) {
      return NextResponse.json(
        { status: 'error', message: 'Missing invoice or consignment_id parameter.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 2. Locate the matching order
    let query = supabase.from('orders').select('*');
    if (invoice) {
      const cleanInv = invoice.replace(/^[#\s]+/, '').trim();
      query = query.or(
        `order_number.eq.${invoice},order_number.eq.#${cleanInv},order_number.eq.${cleanInv},external_id.eq.${invoice}`
      );
    } else if (consignment_id) {
      query = query.or(
        `consignment_id.eq.${consignment_id},external_id.eq.${consignment_id}`
      );
    }

    const { data: initialOrders } = await query.limit(1);
    let matchedOrder: any = initialOrders && initialOrders.length > 0 ? initialOrders[0] : null;

    if (!matchedOrder) {
      // Also try fuzzy search on order_number without leading hash/prefix if needed
      const cleanInvoice = invoice ? invoice.replace(/^[#]/, '').trim() : '';
      const { data: fallbackOrders } = await supabase
        .from('orders')
        .select('*')
        .ilike('order_number', `%${cleanInvoice}%`)
        .limit(1);

      if (!fallbackOrders || fallbackOrders.length === 0) {
        console.warn(`[Steadfast Webhook] Order not found for invoice: ${invoice}, CID: ${consignment_id}`);
        return NextResponse.json(
          { status: 'error', message: `Order not found for invoice ${invoice}` },
          { status: 404 }
        );
      }
      matchedOrder = fallbackOrders[0];
    }

    const order = matchedOrder;

    // 3. Determine New Status based on Steadfast Notification
    let targetOrderStatus: OrderStatus = order.status;
    let paymentStatus = order.payment_status;

    const normalizedStatus = String(courierStatus || '').toLowerCase().trim();

    if (notification_type === 'delivery_status') {
      if (
        normalizedStatus === 'delivered' ||
        normalizedStatus === 'partial_delivered'
      ) {
        // Stage 4: Shipped / Fulfilled
        targetOrderStatus = 'shipped';
        paymentStatus = 'paid';
      } else if (
        normalizedStatus === 'cancelled' ||
        normalizedStatus === 'cancelled_approval_pending'
      ) {
        targetOrderStatus = 'canceled';
      } else if (
        normalizedStatus === 'pending' ||
        normalizedStatus === 'in_review' ||
        normalizedStatus === 'hold'
      ) {
        // If it was confirmed or packed, moving into courier transit advances it to Stage 3
        if (order.status === 'confirmed' || order.status === 'ready_to_ship') {
          targetOrderStatus = 'on_the_way';
        }
      }
    } else if (notification_type === 'tracking_update') {
      // Tracking progress update - ensure order is marked With Courier if still in ready_to_ship
      if (order.status === 'confirmed' || order.status === 'ready_to_ship') {
        targetOrderStatus = 'on_the_way';
      }
    }

    // 4. Update Audit History & Order Notes
    const historyEntry = {
      timestamp: new Date().toISOString(),
      action: 'steadfast_webhook',
      notification_type: notification_type || 'update',
      courier_status: normalizedStatus || 'updated',
      tracking_message: tracking_message || '',
      consignment_id: consignment_id || order.consignment_id,
      cod_amount: cod_amount ?? null,
      delivery_charge: delivery_charge ?? null,
      updated_at_courier: updated_at || null,
    };

    const currentHistory = Array.isArray(order.edit_history) ? order.edit_history : [];
    const updatedHistory = [...currentHistory, historyEntry];

    const noteTag = `[Steadfast: ${normalizedStatus || 'Update'}${
      tracking_message ? ` - ${tracking_message}` : ''
    }]`;
    const updatedNote = order.note ? `${order.note}\n${noteTag}` : noteTag;

    // 5. Commit updates to Supabase
    const updatePayload: Record<string, any> = {
      status: targetOrderStatus,
      payment_status: paymentStatus,
      edit_history: updatedHistory,
      note: updatedNote,
      courier_name: 'steadfast',
      courier_status: normalizedStatus || order.courier_status,
      tracking_message: tracking_message || order.tracking_message,
      courier_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (consignment_id) {
      updatePayload.consignment_id = String(consignment_id);
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', order.id);

    if (updateError) {
      console.warn('[Steadfast Webhook] Full update failed, retrying with core columns:', updateError.message);
      const fallbackPayload: Record<string, any> = {
        status: targetOrderStatus,
        payment_status: paymentStatus,
        edit_history: updatedHistory,
        note: updatedNote,
        external_id: consignment_id ? String(consignment_id) : order.external_id,
        updated_at: new Date().toISOString(),
      };
      const { error: fallbackError } = await supabase
        .from('orders')
        .update(fallbackPayload)
        .eq('id', order.id);

      if (fallbackError) {
        console.error('[Steadfast Webhook] Database fallback update error:', fallbackError);
        return NextResponse.json(
          { status: 'error', message: 'Failed to update order in database.' },
          { status: 500 }
        );
      }
    }

    console.log(
      `[Steadfast Webhook] Successfully updated order #${order.order_number} to status "${targetOrderStatus}" (Courier: ${normalizedStatus})`
    );

    // 6. Return standard Steadfast response
    return NextResponse.json({
      status: 'success',
      message: 'Webhook received successfully.',
    });
  } catch (err: any) {
    console.error('[Steadfast Webhook] Unexpected error:', err);
    return NextResponse.json(
      { status: 'error', message: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
