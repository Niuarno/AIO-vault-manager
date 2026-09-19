import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createSteadfastConsignment } from '@/lib/steadfast';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Authenticate requester
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

    // 2. Fetch order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // 3. Dispatch to Steadfast API
    const codAmount =
      order.payment_status === 'paid' ? 0 : Math.round(Number(order.total_amount) || 0);

    const steadfastResult = await createSteadfastConsignment({
      invoice: order.order_number,
      recipient_name: order.customer_name,
      recipient_phone: order.customer_phone,
      recipient_address: order.shipping_address,
      cod_amount: codAmount,
      note: order.note || undefined,
    });

    if (steadfastResult.status !== 200 || !steadfastResult.consignment) {
      let errorMsg = steadfastResult.message || 'Failed to create consignment in Steadfast Courier.';
      if (steadfastResult.errors && typeof steadfastResult.errors === 'object') {
        const fieldErrors = Object.entries(steadfastResult.errors)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
          .join('; ');
        if (fieldErrors) errorMsg = `${errorMsg} (${fieldErrors})`;
      }
      return NextResponse.json(
        {
          error: errorMsg,
          details: steadfastResult.errors,
        },
        { status: steadfastResult.status >= 400 && steadfastResult.status < 600 ? steadfastResult.status : 400 }
      );
    }

    const consignment = steadfastResult.consignment;

    // 4. Update order to 'on_the_way' (Stage 3: With Courier) with Steadfast info
    const historyEntry = {
      timestamp: new Date().toISOString(),
      action: 'dispatched_to_steadfast',
      consignment_id: consignment.id,
      tracking_code: consignment.tracking_code,
      status: consignment.status,
      message: steadfastResult.message,
    };

    const currentHistory = Array.isArray(order.edit_history) ? order.edit_history : [];
    const updatedHistory = [...currentHistory, historyEntry];

    const noteTag = `[Dispatched via Steadfast - CID: #${consignment.id}, Tracking: ${consignment.tracking_code}]`;
    const updatedNote = order.note ? `${order.note}\n${noteTag}` : noteTag;

    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'on_the_way',
        courier_name: 'steadfast',
        consignment_id: String(consignment.id),
        tracking_code: consignment.tracking_code,
        courier_status: consignment.status || 'in_review',
        tracking_message: 'Consignment created with Steadfast Courier',
        courier_updated_at: new Date().toISOString(),
        edit_history: updatedHistory,
        note: updatedNote,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .select('*, order_items(*)')
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update order status after dispatching.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: steadfastResult.message,
      consignment,
      order: updatedOrder,
    });
  } catch (err: any) {
    console.error('[Steadfast Dispatch] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error while dispatching to Steadfast.' },
      { status: 500 }
    );
  }
}
