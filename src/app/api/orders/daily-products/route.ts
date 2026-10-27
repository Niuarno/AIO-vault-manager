import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getDhakaStartOfDayIso, getDhakaEndOfDayIso } from '@/lib/dateUtils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();

    // Verify authenticated user has role 'admin' or 'packing'
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
        isAuthorized = profile?.role === 'admin' || profile?.role === 'packing';
      }
    } catch {
      isAuthorized = false;
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
          isAuthorized = profile?.role === 'admin' || profile?.role === 'packing';
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized: Only administrators and packing personnel can view daily product order data.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const statusParam = searchParams.get('status');
    const allTime = searchParams.get('allTime') === 'true';

    let ordersQuery = supabase
      .from('orders')
      .select(
        'id, order_number, source, customer_name, customer_phone, shipping_address, status, payment_method, payment_status, total_amount, note, created_at, order_items(*)'
      )
      .order('created_at', { ascending: false });

    if (!allTime) {
      if (startDate) {
        ordersQuery = ordersQuery.gte('created_at', getDhakaStartOfDayIso(startDate));
      }
      if (endDate) {
        ordersQuery = ordersQuery.lte('created_at', getDhakaEndOfDayIso(endDate));
      }
    }

    if (statusParam && statusParam !== 'all') {
      if (statusParam === 'active') {
        // All non-canceled orders
        ordersQuery = ordersQuery.neq('status', 'canceled');
      } else if (statusParam.includes(',')) {
        ordersQuery = ordersQuery.in('status', statusParam.split(','));
      } else {
        ordersQuery = ordersQuery.eq('status', statusParam);
      }
    }

    const { data: orders, error: ordersErr } = await ordersQuery;
    if (ordersErr) {
      throw ordersErr;
    }

    // Fetch product catalog for image, handles, and SKU references
    const { data: products } = await supabase
      .from('products')
      .select('id, title, image_url, handle, is_active, product_variants(id, title, sku, price, stock_quantity)');

    const productsMap: Record<
      string,
      {
        id: string;
        title: string;
        image_url: string | null;
        handle: string | null;
        variants: Record<string, { id: string; title: string; sku: string | null; stock_quantity: number }>;
      }
    > = {};

    (products || []).forEach((prod: any) => {
      const varMap: Record<string, any> = {};
      (prod.product_variants || []).forEach((v: any) => {
        varMap[v.id] = {
          id: v.id,
          title: v.title,
          sku: v.sku,
          stock_quantity: v.stock_quantity,
        };
      });

      productsMap[prod.id] = {
        id: prod.id,
        title: prod.title,
        image_url: prod.image_url,
        handle: prod.handle,
        variants: varMap,
      };
    });

    return NextResponse.json({
      success: true,
      orders: orders || [],
      productsMap,
      meta: {
        totalOrders: (orders || []).length,
        startDate: allTime ? null : startDate,
        endDate: allTime ? null : endDate,
        allTime,
      },
    });
  } catch (err: any) {
    console.error('Fetch daily product orders error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch daily product order data' },
      { status: 500 }
    );
  }
}
