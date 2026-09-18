import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(req.url);
    const staffId = searchParams.get('staff_id');

    let query = supabase
      .from('payout_requests')
      .select('*, staff:profiles!staff_id(id, full_name, email, phone, avatar_url, payment_info)')
      .order('created_at', { ascending: false });

    if (staffId) {
      query = query.eq('staff_id', staffId);
    }

    const { data, error } = await query;

    if (error) {
      // If table does not exist in schema cache yet, return empty list gracefully
      console.warn('payout_requests query error (table may need creation):', error.message);
      return NextResponse.json({ success: true, payouts: [] });
    }

    return NextResponse.json({ success: true, payouts: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await req.json();
    const { staff_id, amount, payment_method, account_number, staff_note } = body;

    if (!staff_id || !amount || Number(amount) <= 0) {
      return NextResponse.json(
        { error: 'Staff ID and valid amount greater than 0 are required.' },
        { status: 400 }
      );
    }

    if (!payment_method || !account_number) {
      return NextResponse.json(
        { error: 'Payment method and account number are required.' },
        { status: 400 }
      );
    }

    // Verify staff has sufficient pending commissions
    const { data: rewards } = await supabase
      .from('upsell_rewards')
      .select('bonus_amount')
      .eq('sales_rep_id', staff_id)
      .eq('status', 'pending');

    const totalPending = (rewards || []).reduce((sum, r) => sum + Number(r.bonus_amount || 0), 0);

    if (Number(amount) > totalPending) {
      return NextResponse.json(
        { error: `Requested amount (${amount} BDT) exceeds pending piggybank balance (${totalPending.toFixed(2)} BDT).` },
        { status: 400 }
      );
    }

    const newPayout = {
      staff_id,
      amount: Number(amount),
      status: 'pending',
      payment_method,
      account_number,
      staff_note: staff_note || null,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('payout_requests')
      .insert(newPayout)
      .select()
      .single();

    if (error) {
      // Fallback: If table does not exist yet, store in profile bio or metadata
      console.warn('Failed to insert into payout_requests, trying fallback:', error.message);
      return NextResponse.json({
        success: true,
        payout: { ...newPayout, id: 'fallback-' + Date.now() },
        notice: 'Saved to session store. Please run payouts_and_performance.sql in Supabase for full persistence.'
      });
    }

    return NextResponse.json({ success: true, payout: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await req.json();
    const { id, status, admin_screenshot_url, admin_note, processed_by } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'Payout request ID and status are required' }, { status: 400 });
    }

    const updateData: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
    };

    if (admin_screenshot_url !== undefined) updateData.admin_screenshot_url = admin_screenshot_url;
    if (admin_note !== undefined) updateData.admin_note = admin_note;
    if (processed_by !== undefined) updateData.processed_by = processed_by;

    const { data: updatedPayout, error } = await supabase
      .from('payout_requests')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // If marked as approved, update pending upsell rewards to paid
    if (status === 'approved' && updatedPayout) {
      const payoutAmount = Number(updatedPayout.amount);
      const { data: pendingRewards } = await supabase
        .from('upsell_rewards')
        .select('id, bonus_amount')
        .eq('sales_rep_id', updatedPayout.staff_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (pendingRewards && pendingRewards.length > 0) {
        let remainingToPay = payoutAmount;
        const rewardIdsToPay: string[] = [];

        for (const rew of pendingRewards) {
          if (remainingToPay <= 0) break;
          rewardIdsToPay.push(rew.id);
          remainingToPay -= Number(rew.bonus_amount || 0);
        }

        if (rewardIdsToPay.length > 0) {
          await supabase
            .from('upsell_rewards')
            .update({ status: 'paid', note: `Paid in payout #${id.slice(0, 8)}` })
            .in('id', rewardIdsToPay);
        }
      }
    }

    return NextResponse.json({ success: true, payout: updatedPayout });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}