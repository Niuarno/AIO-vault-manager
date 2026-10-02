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

    // Auto-release any delayed delivery orders whose products have been restocked
    try {
      const { autoReleaseDelayedOrders } = await import('@/lib/delayedOrders');
      await autoReleaseDelayedOrders(supabase);
    } catch (e) {
      console.error('Auto-release restock check error in packing route:', e);
    }

    // Fetch packing orders using admin client (bypasses restrictive RLS on delayed_delivery)
    const { data: orders, error: ordersErr } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .in('status', ['delayed_delivery', 'confirmed', 'ready_to_ship', 'on_the_way', 'shipped'])
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
