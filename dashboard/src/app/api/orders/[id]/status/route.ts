import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { OrderStatus } from '@/types/database';
import { syncStaffCommissionRewards } from '@/lib/commission';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { status, note } = body;

    const allowedStatuses: OrderStatus[] = [
      'pending',
      'not_reachable',
      'delayed_delivery',
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
    let isPacking = false;
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
        const role = profile?.role ? String(profile.role).toLowerCase().trim() : '';
        isAdmin = role === 'admin';
        isPacking = role === 'packing';
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
          const role = profile?.role ? String(profile.role).toLowerCase().trim() : '';
          isAdmin = role === 'admin';
          isPacking = role === 'packing';
        }
      }
    }

    // If not authenticated at all, reject immediately
    if (!currentUserId) {
      return NextResponse.json(
        { error: 'Unauthorized: Please log in to update order status.' },
        { status: 401 }
      );
    }

    // 2. Check existing order (only select valid database columns that exist in schema)
    const { data: order, error: fetchErr } = await supabase
      .from('orders')
      .select('id, status, order_number, sales_rep_id, source, note, external_id')
      .eq('id', id)
      .single();

    if (fetchErr || !order) {
      console.error('[Status Route] Fetch error:', fetchErr?.message);
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Hard Lock: Once an order has been registered with Steadfast Courier (has consignment ID or is on_the_way / shipped),
    // status progression is 100% automated via Steadfast tracking webhook/sync.
    // NO ONE can manually change the status - not even administrators!
    const isManagedByCourier = Boolean(
      order.note?.includes('CID: #') ||
      order.note?.toLowerCase().includes('steadfast') ||
      (order.source !== 'website' && order.external_id && !order.external_id.startsWith('http') && /^\d+$/.test(order.external_id))
    );
    const isCourierStage =
      order.status === 'on_the_way' ||
      order.status === 'shipped' ||
      order.status === 'delivered';

    if (isManagedByCourier && isCourierStage && !body.is_system_automated) {
      return NextResponse.json(
        {
          error: `LOCKED: This parcel is actively managed by Steadfast Courier (Consignment ID: #${order.external_id || 'Assigned'}). Status progression is fully automated via Steadfast Courier and cannot be manually modified by anyone (including administrators).`,
        },
        { status: 403 }
      );
    }

    // 3. Permission Enforcement:
    // - Admin: Full permissions
    // - Packing / Delivery team: Can transition fulfillment & delayed delivery statuses
    // - Sales staff: Can transition their assigned pending/not_reachable/delayed_delivery orders
    if (!isAdmin) {
      if (isPacking) {
        const packingAllowedTargets: OrderStatus[] = [
          'delayed_delivery',
          'confirmed',
          'ready_to_ship',
          'on_the_way',
          'shipped',
          'delivered',
          'canceled',
        ];
        if (!packingAllowedTargets.includes(status)) {
          return NextResponse.json(
            {
              error: `Permission denied: Delivery team cannot transition order status to '${status}'.`,
            },
            { status: 403 }
          );
        }
      } else {
        // Sales Staff:
        // Rule: Orders can only be edited by the specific order creator and admins.
        // Other staff cannot edit other staff orders.
        // Only an unassigned order can be edited by any staff (e.g. website orders).
        const isCreator = Boolean(order.sales_rep_id && order.sales_rep_id === currentUserId);
        const isUnassigned = !order.sales_rep_id;

        if (!isCreator && !isUnassigned) {
          return NextResponse.json(
            {
              error: 'Permission denied: This order was created by another staff member and can only be edited by them or an administrator.',
            },
            { status: 403 }
          );
        }

        // Sales staff can update pending, not_reachable, delayed_delivery, and pre-courier confirmed orders
        const salesAllowedCurrentStatuses: OrderStatus[] = [
          'pending',
          'not_reachable',
          'delayed_delivery',
          'confirmed',
        ];
        if (!salesAllowedCurrentStatuses.includes(order.status)) {
          return NextResponse.json(
            {
              error: `Order is already '${order.status}' and locked for sales staff. Delivery and fulfillment team will process this order.`,
            },
            { status: 403 }
          );
        }

        // Sales staff can transition to 'confirmed', 'not_reachable', 'pending', 'delayed_delivery', or 'canceled'
        const salesAllowedTargets: OrderStatus[] = [
          'pending',
          'not_reachable',
          'confirmed',
          'delayed_delivery',
          'canceled',
        ];
        if (!salesAllowedTargets.includes(status)) {
          return NextResponse.json(
            {
              error: `Permission denied: Sales staff cannot set status to '${status}'.`,
            },
            { status: 403 }
          );
        }
      }
    }

    // 4. Update status (trigger automatically handles restock if status is set to 'canceled')
    // Safety guard: Ensure all items of this order have valid variant_ids before updating status
    // (prevents DB triggers like trg_order_cancellation_restock from violating not-null constraint on inventory_logs)
    if (status === 'canceled') {
      try {
        const { data: nullItems } = await supabase
          .from('order_items')
          .select('id')
          .eq('order_id', id)
          .is('variant_id', null);

        if (nullItems && nullItems.length > 0) {
          const { data: fb } = await supabase
            .from('products')
            .select('id, product_variants(id)')
            .eq('title', 'Custom / Unlinked Items')
            .maybeSingle();
          const fallbackVarId = fb?.product_variants?.[0]?.id;
          if (fallbackVarId) {
            await supabase
              .from('order_items')
              .update({ variant_id: fallbackVarId })
              .eq('order_id', id)
              .is('variant_id', null);
          }
        }
      } catch (guardErr) {
        console.warn('[Status Route] Pre-cancel variant guard warning:', guardErr);
      }
    }

    const updateData: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (note) {
      updateData.note = (order as any).note ? `${(order as any).note} | ${note}` : note;
    }

    // When an unassigned order is updated by any staff member, attribute the sale to them!
    let effectiveSalesRepId = order.sales_rep_id;
    if (!order.sales_rep_id && currentUserId) {
      updateData.sales_rep_id = currentUserId;
      effectiveSalesRepId = currentUserId;
    }

    const { data: updatedOrder, error: updateErr } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      throw updateErr;
    }

    // 5. Synchronize staff commission rewards on status changes (e.g. confirmation, cancellation)
    if (effectiveSalesRepId) {
      try {
        await syncStaffCommissionRewards(
          supabase,
          effectiveSalesRepId,
          order.id,
          order.source
        );
      } catch (rewardErr) {
        console.error('Failed to sync rewards on status update:', rewardErr);
      }
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
