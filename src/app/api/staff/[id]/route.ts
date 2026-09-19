import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { error: 'Staff ID is required.' },
        { status: 400 }
      );
    }

    let deleteOrders = false;
    try {
      const body = await req.json();
      if (body && typeof body.deleteOrders === 'boolean') {
        deleteOrders = body.deleteOrders;
      }
    } catch {
      // Empty body is allowed, defaults to deleteOrders = false
    }

    const supabase = createAdminClient();

    // 1. Verify target staff profile exists
    const { data: targetProfile, error: fetchErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !targetProfile) {
      return NextResponse.json(
        { error: 'Staff member not found.' },
        { status: 404 }
      );
    }

    // 2. Cascade delete staff data
    // A. Delete all upsell rewards & commission records
    await supabase.from('upsell_rewards').delete().eq('sales_rep_id', id);

    // B. Delete all staff payout requests
    await supabase.from('payout_requests').delete().eq('staff_id', id);
    await supabase.from('payout_requests').update({ processed_by: null }).eq('processed_by', id);

    // C. Nullify inventory adjustment references
    await supabase.from('inventory_logs').update({ adjusted_by: null }).eq('adjusted_by', id);

    // D. Handle orders
    if (deleteOrders) {
      const { data: staffOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('sales_rep_id', id);

      if (staffOrders && staffOrders.length > 0) {
        const orderIds = staffOrders.map((o) => o.id);
        await supabase.from('order_items').delete().in('order_id', orderIds);
        await supabase.from('upsell_rewards').delete().in('order_id', orderIds);
        await supabase.from('inventory_logs').delete().in('order_id', orderIds);
        await supabase.from('orders').delete().in('id', orderIds);
      }
    } else {
      // Unassign staff from customer orders so customer sales records remain intact
      await supabase.from('orders').update({ sales_rep_id: null }).eq('sales_rep_id', id);
    }

    // E. Delete profile row
    const { error: profileDeleteErr } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id);

    if (profileDeleteErr) {
      throw profileDeleteErr;
    }

    // F. Permanently delete from Supabase Auth
    try {
      await supabase.auth.admin.deleteUser(id);
    } catch (authErr: any) {
      console.warn('⚠️ Could not delete auth user (may already be deleted):', authErr?.message);
    }

    return NextResponse.json({
      success: true,
      message: `Staff member ${targetProfile.full_name || targetProfile.email} and all associated data permanently deleted.`,
    });
  } catch (err: any) {
    console.error('❌ [Staff Delete Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to permanently delete staff member.' },
      { status: 500 }
    );
  }
}
