import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { OrderStatus } from '@/types/database';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { status, note } = body;

    const allowedStatuses: OrderStatus[] = [
      'pending',
      'not_reachable',
      'confirmed',
      'ready_to_ship',
      'on_the_way',
      'shipped',
      'delivered',
      'canceled',
    ];

    if (!allowedStatuses.includes(status)) {
      return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Identify user and check role
    let isAdmin = false;
    let currentUserId: string | null = null;
    try {
      const serverSupabase = await createServerClient();
      const { data: { user } } = await serverSupabase.auth.getUser();
      if (user) {
        currentUserId = user.id;
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('id', user.id)
          .single();
        isAdmin = profile?.role === 'admin';
      }
    } catch {
      // ignore
    }

    // Fallback: Authorization Bearer Token
    if (!currentUserId) {
      const authHeader = req.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.split('Bearer ')[1].trim();
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          currentUserId = user.id;
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, role')
            .eq('id', user.id)
            .single();
          isAdmin = profile?.role === 'admin';
        }
      }
    }

    // 2. Check existing order
    const { data: order, error: fetchErr } = await supabase
      .from('orders')
      .select('id, status, order_number, sales_rep_id')
      .eq('id', id)
      .single();

    if (fetchErr || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // 3. Strict Permission Enforcement for Non-Admin Staff
    if (!isAdmin) {
      // Sales staff can only act if current status is 'pending' or 'not_reachable'
      if (order.status !== 'pending' && order.status !== 'not_reachable') {
        return NextResponse.json(
          {
            error: `Order is already '${order.status}' and locked. Only administrators can change confirmed or processed orders.`,
          },
          { status: 403 }
        );
      }

      // Sales staff can only transition to 'confirmed', 'not_reachable', or 'pending'
      const salesAllowedTargets: OrderStatus[] = ['pending', 'not_reachable', 'confirmed'];
      if (!salesAllowedTargets.includes(status)) {
        return NextResponse.json(
          {
            error: `Permission denied: Sales staff can only set status to 'Confirmed' or 'Not-Reachable'.`,
          },
          { status: 403 }
        );
      }
    }

    // 4. Update status (trigger automatically handles restock if status is set to 'canceled')
    const updateData: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (note) updateData.note = note;

    const { data: updatedOrder, error: updateErr } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      throw updateErr;
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      message: `Order ${order.order_number} status changed from ${order.status} to ${status}`,
    });
  } catch (err: any) {
    console.error('Order status update error:', err);
    return NextResponse.json({ error: err.message || 'Failed to update order status' }, { status: 500 });
  }
}
