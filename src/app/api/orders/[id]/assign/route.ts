import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Verify that requester is an Admin
    let isAdmin = false;
    let adminProfile: any = null;

    // Check A: Cookie-based server session
    try {
      const serverSupabase = await createServerClient();
      const { data: { user } } = await serverSupabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name, email, role')
          .eq('id', user.id)
          .single();
        if (profile?.role === 'admin') {
          isAdmin = true;
          adminProfile = profile;
        }
      }
    } catch {
      // ignore
    }

    // Check B: Bearer Token from Authorization Header (fallback for API/client fetch)
    if (!isAdmin) {
      const authHeader = req.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.split('Bearer ')[1].trim();
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, full_name, email, role')
            .eq('id', user.id)
            .single();
          if (profile?.role === 'admin') {
            isAdmin = true;
            adminProfile = profile;
          }
        }
      }
    }

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized: Only administrators can assign or reassign orders.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { sales_rep_id } = body;

    // 2. Fetch existing order
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, order_number, sales_rep_id, note, edit_history')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // 3. Resolve target staff member name if assigned
    let targetStaffName = 'Unassigned';
    if (sales_rep_id) {
      const { data: staff } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('id', sales_rep_id)
        .single();
      if (staff) {
        targetStaffName = staff.full_name || staff.email || sales_rep_id;
      }
    }

    const nowIso = new Date().toISOString();
    const formattedDate = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const adminName = adminProfile?.full_name || adminProfile?.email || 'Admin';
    const auditNote = `\n[STAFF ASSIGNMENT ${formattedDate} by ${adminName}]: Reassigned order to ${targetStaffName}.`;
    const updatedNote = (order.note || '').trim() + auditNote;

    const assignmentLog = {
      id: crypto.randomUUID(),
      timestamp: nowIso,
      action: 'staff_assignment',
      edited_by: adminName,
      previous_sales_rep_id: order.sales_rep_id,
      new_sales_rep_id: sales_rep_id || null,
      target_staff_name: targetStaffName,
    };

    const existingHistory = Array.isArray(order.edit_history) ? order.edit_history : [];
    const updatedHistory = [...existingHistory, assignmentLog];

    // 4. Update order with new sales_rep_id
    const { data: updatedOrder, error: updateErr } = await supabase
      .from('orders')
      .update({
        sales_rep_id: sales_rep_id || null,
        note: updatedNote,
        edit_history: updatedHistory,
        updated_at: nowIso,
      })
      .eq('id', orderId)
      .select('*, order_items(*), sales_rep:profiles(*)')
      .single();

    if (updateErr) {
      // Fallback if edit_history jsonb column is not enabled
      const { data: fallbackOrder, error: fallbackErr } = await supabase
        .from('orders')
        .update({
          sales_rep_id: sales_rep_id || null,
          note: updatedNote,
          updated_at: nowIso,
        })
        .eq('id', orderId)
        .select('*, order_items(*), sales_rep:profiles(*)')
        .single();

      if (fallbackErr) throw fallbackErr;
      return NextResponse.json({
        success: true,
        order: fallbackOrder,
        message: `Order assigned to ${targetStaffName}`,
      });
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      message: `Order assigned to ${targetStaffName}`,
    });
  } catch (err: any) {
    console.error('Order assignment error:', err);
    return NextResponse.json({ error: err.message || 'Failed to assign order' }, { status: 500 });
  }
}
