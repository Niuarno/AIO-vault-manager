import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();

    // Verify authenticated user has role 'admin' or 'packing'
    let isAuthorized = false;
    try {
      const serverSupabase = await createServerClient();
      const { data: { user } } = await serverSupabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        isAuthorized = profile?.role === 'admin' || profile?.role === 'packing';
      }
    } catch {
      isAuthorized = false;
    }

    if (!isAuthorized) {
      const authHeader = req.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.split('Bearer ')[1].trim();
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
          isAuthorized = profile?.role === 'admin' || profile?.role === 'packing';
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized: Only administrators and packing personnel can view fulfillment orders.' },
        { status: 403 }
      );
    }

    // Fetch packing orders using admin client (optimized column selection excluding bloated original_items raw JSON)
    const orderCols = [
      'id',
      'order_number',
      'source',
      'customer_name',
      'customer_phone',
      'customer_email',
      'shipping_address',
      'payment_method',
      'payment_status',
      'status',
      'total_amount',
      'currency',
      'delivery_charge',
      'discount_amount',
      'advance_payment',
      'courier_name',
      'consignment_id',
      'tracking_code',
      'tracking_message',
      'courier_status',
      'courier_updated_at',
      'sales_rep_id',
      'coupon_used',
      'note',
      'external_id',
      'created_at',
      'updated_at',
      'order_items(id, order_id, product_id, variant_id, title, variant_title, quantity, price, is_upsell)',
    ].join(',');

    const { data: orders, error: ordersErr } = await supabase
      .from('orders')
      .select(orderCols)
      .in('status', ['delayed_delivery', 'confirmed', 'ready_to_ship', 'on_the_way', 'delivered', 'shipped'])
      .order('created_at', { ascending: false });

    if (ordersErr) {
      throw ordersErr;
    }

    return NextResponse.json({
      success: true,
      orders: orders || [],
    });
  } catch (err: any) {
    console.error('Fetch packing orders error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch packing orders' },
      { status: 500 }
    );
  }
}
