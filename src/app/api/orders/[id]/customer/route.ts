import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { isHandedOverToSteadfast } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const body = await req.json();
    const {
      customer_name,
      customer_phone,
      shipping_address,
      customer_email,
      note,
      reason,
      edited_by,
    } = body;

    const cleanName = (customer_name || '').trim();
    const cleanPhone = (customer_phone || '').trim();
    const cleanAddress = (shipping_address || '').trim();
    const cleanEmail = customer_email !== undefined && customer_email !== null ? String(customer_email).trim() || null : null;
    const cleanNote = note !== undefined && note !== null ? String(note).trim() || null : null;

    if (!cleanName || cleanName.length < 2) {
      return NextResponse.json(
        { error: 'Customer name is required (at least 2 characters).' },
        { status: 400 }
      );
    }

    if (!cleanPhone || cleanPhone.length < 6) {
      return NextResponse.json(
        { error: 'Valid customer phone number is required (at least 6 digits).' },
        { status: 400 }
      );
    }

    if (!cleanAddress || cleanAddress.length < 3) {
      return NextResponse.json(
        { error: 'Shipping/Delivery address is required (at least 3 characters).' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 1. Fetch current order
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, order_number, customer_name, customer_phone, customer_email, shipping_address, note, status, consignment_id, tracking_code, sales_rep_id, edit_history')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    // 2. Strict Handover Check:
    // Once an order has been handed over to Steadfast Courier (CID created, tracking issued, or status on_the_way/shipped/delivered),
    // customer details CANNOT be edited.
    if (isHandedOverToSteadfast(order)) {
      const cidInfo = order.consignment_id ? ` (Steadfast CID: #${order.consignment_id})` : '';
      return NextResponse.json(
        {
          error: `LOCKED: Order #${order.order_number} has already been handed over to Steadfast Courier (Status: ${order.status}${cidInfo}). Customer details cannot be modified after handover.`,
        },
        { status: 403 }
      );
    }

    // 3. User Authentication & Authorization Check
    let currentUserId: string | null = null;
    let isAdmin = false;
    let currentUserProfile: any = null;

    try {
      const serverSupabase = await createServerClient();
      const {
        data: { user },
      } = await serverSupabase.auth.getUser();
      if (user) {
        currentUserId = user.id;
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, role, full_name, email')
          .eq('id', user.id)
          .single();
        currentUserProfile = profile;
        isAdmin = profile?.role === 'admin';
      }
    } catch {
      // ignore
    }

    // Fallback: Authorization Bearer Header
    if (!currentUserId) {
      const authHeader = req.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.split('Bearer ')[1].trim();
        const {
          data: { user },
        } = await supabase.auth.getUser(token);
        if (user) {
          currentUserId = user.id;
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, role, full_name, email')
            .eq('id', user.id)
            .single();
          currentUserProfile = profile;
          isAdmin = profile?.role === 'admin';
        }
      }
    }

    if (!currentUserId) {
      return NextResponse.json(
        { error: 'Unauthorized: Please log in to update customer details.' },
        { status: 401 }
      );
    }

    // Rule: Orders can only be edited by the specific order creator and admins.
    // Other staff cannot edit other staff orders.
    // Only an unassigned order can be edited by any staff (e.g. website orders).
    const isCreator = Boolean(order.sales_rep_id && order.sales_rep_id === currentUserId);
    const isUnassigned = !order.sales_rep_id;
    if (!isAdmin && !isCreator && !isUnassigned) {
      return NextResponse.json(
        {
          error: 'Permission denied: This order was created by another staff member and can only be edited by them or an administrator.',
        },
        { status: 403 }
      );
    }

    // 4. Construct Audit Trail History Entry
    const nowIso = new Date().toISOString();
    const editorName =
      (edited_by || '').trim() ||
      currentUserProfile?.full_name ||
      currentUserProfile?.email ||
      'Sales Staff';

    const editLogEntry = {
      id: crypto.randomUUID(),
      timestamp: nowIso,
      action: 'customer_details_updated',
      edited_by: editorName,
      reason: (reason || '').trim() || 'Updated customer details',
      previous_customer: {
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        shipping_address: order.shipping_address,
        customer_email: order.customer_email,
        note: order.note,
      },
      new_customer: {
        customer_name: cleanName,
        customer_phone: cleanPhone,
        shipping_address: cleanAddress,
        customer_email: cleanEmail,
        note: cleanNote,
      },
    };

    const existingHistory = Array.isArray(order.edit_history) ? order.edit_history : [];
    const updatedHistory = [...existingHistory, editLogEntry];

    // 5. Update Order Record
    const updatePayload: Record<string, any> = {
      customer_name: cleanName,
      customer_phone: cleanPhone,
      shipping_address: cleanAddress,
      customer_email: cleanEmail,
      note: cleanNote,
      edit_history: updatedHistory,
      updated_at: nowIso,
    };

    // When an unassigned order is edited by a staff member, attribute the order to them!
    if (isUnassigned && currentUserId) {
      updatePayload.sales_rep_id = currentUserId;
    }

    const { data: updatedOrder, error: updateErr } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', orderId)
      .select('*, order_items(*), sales_rep:profiles(*)')
      .single();

    if (updateErr) {
      console.error('Failed to update customer details:', updateErr);
      return NextResponse.json(
        { error: updateErr.message || 'Failed to update customer details in database.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Customer details updated successfully.',
      order: updatedOrder,
    });
  } catch (err: any) {
    console.error('Update customer details error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error while updating customer details.' },
      { status: 500 }
    );
  }
}
