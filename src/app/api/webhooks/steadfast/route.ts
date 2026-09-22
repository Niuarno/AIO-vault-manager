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

    // 2. Locate the matching order with strict, exact matching
    let matchedOrder: any = null;

    // A. Match by Consignment ID
    if (consignment_id) {
      const cidStr = String(consignment_id).trim();

      // Try exact match on external_id or consignment_id column
      const { data: byExtId } = await supabase
        .from('orders')
        .select('*')
        .eq('external_id', cidStr)
        .limit(1);

      if (byExtId && byExtId.length > 0) {
        matchedOrder = byExtId[0];
      }

      // Try exact CID match inside note if stored as note tag
      if (!matchedOrder) {
        const { data: byNote } = await supabase
          .from('orders')
          .select('*')
          .ilike('note', `%CID: #${cidStr}%`)
          .limit(1);

        if (byNote && byNote.length > 0) {
          matchedOrder = byNote[0];
        }
      }
    }

    // B. Match by Invoice strictly (exact comparison only, NEVER substring ilike)
    if (!matchedOrder && invoice && typeof invoice === 'string' && invoice.trim().length >= 2) {
      const cleanInv = invoice.replace(/^[#\s]+/, '').trim();
      const { data: byInvoice } = await supabase
        .from('orders')
        .select('*')
        .or(`order_number.eq.${invoice},order_number.eq.#${cleanInv},order_number.eq.${cleanInv},external_id.eq.${invoice}`)
        .limit(1);

      if (byInvoice && byInvoice.length > 0) {
        matchedOrder = byInvoice[0];
      }
    }

    // If no verified matching order exists in OMS, ignore safely without corrupting unrelated orders
    if (!matchedOrder) {
      console.log(`[Steadfast Webhook] Ignored: No matching OMS order found for CID: ${consignment_id}, Invoice: ${invoice}`);
      return NextResponse.json({
        status: 'ignored',
        message: 'No matching order found in OMS database.',
      });
    }

    const order = matchedOrder;

    // 3. Strict Status Guard:
    // Sales pipeline statuses ('pending', 'not_reachable') MUST NEVER be auto-modified by courier webhooks
    if (order.status === 'pending' || order.status === 'not_reachable') {
      console.log(`[Steadfast Webhook] Ignored status update for order #${order.order_number} because order is still in sales stage (${order.status}).`);
      return NextResponse.json({
        status: 'ignored',
        message: `Order #${order.order_number} is in sales status "${order.status}". Status change skipped.`,
      });
    }

    // 4. Determine New Status based on Steadfast Notification
    let targetOrderStatus: OrderStatus = order.status;
    let paymentStatus = order.payment_status;

    const normalizedStatus = String(courierStatus || '').toLowerCase().trim();

    if (notification_type === 'delivery_status') {
      if (
        normalizedStatus === 'delivered' ||
        normalizedStatus === 'partial_delivered'
      ) {
        // Stage 4: Shipped / Fulfilled (only for orders currently in fulfillment)
        if (order.status === 'ready_to_ship' || order.status === 'on_the_way') {
          targetOrderStatus = 'shipped';
          paymentStatus = 'paid';
        }
      } else if (normalizedStatus === 'cancelled') {
        // Only final confirmed cancellation transitions the order to canceled
        if (order.status === 'ready_to_ship' || order.status === 'on_the_way') {
          targetOrderStatus = 'canceled';
        }
      } else if (
        normalizedStatus === 'pending' ||
        normalizedStatus === 'in_review' ||
        normalizedStatus === 'hold' ||
        normalizedStatus === 'cancelled_approval_pending' ||
        normalizedStatus === 'delivered_approval_pending' ||
        normalizedStatus === 'partial_delivered_approval_pending'
      ) {
        // Orders in transit or approval-pending stay safely in 'on_the_way'
        if (order.status === 'ready_to_ship') {
          targetOrderStatus = 'on_the_way';
        }
      }
    } else if (notification_type === 'tracking_update') {
      // Tracking progress update - advance to With Courier only if already packed
      if (order.status === 'ready_to_ship') {
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
