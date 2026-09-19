import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { syncWebsiteUpsellQuotaRewards } from '@/lib/commission';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      source,
      customer_name,
      customer_phone,
      customer_email,
      shipping_address,
      payment_method,
      note,
      items,
      sales_rep_id,
      coupon_used,
      is_reachout_order,
    } = body;

    if (!customer_name || !customer_phone || !shipping_address || !items || items.length === 0) {
      return NextResponse.json({ error: 'Customer name, phone, address, and at least 1 item are required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Resolve Creator (Auto-assignment for non-website orders)
    let authenticatedUserId: string | null = null;
    let staffFullName = 'Staff';
    try {
      const serverSupabase = await createServerClient();
      const { data: { user } } = await serverSupabase.auth.getUser();
      if (user) {
        authenticatedUserId = user.id;
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
        if (prof?.full_name) staffFullName = prof.full_name;
      }
    } catch {
      // ignore
    }

    // Rule: "any order from other sources besides website orders are auto assignes to the staff who created the order"
    const orderSource = source || 'manual';
    let assignedSalesRepId = sales_rep_id || null;
    if (orderSource !== 'website') {
      assignedSalesRepId = authenticatedUserId || sales_rep_id || null;
    }

    // Generate readable order number: e.g. WA-1025, MSG-1026, PH-1027
    const prefixMap: Record<string, string> = {
      whatsapp: 'WA',
      messenger: 'MSG',
      phone: 'PH',
      manual: 'MAN',
    };
    const prefix = prefixMap[orderSource] || 'ORD';
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `#${prefix}-${Date.now().toString().slice(-4)}${randomSuffix}`;

    // Calculate total amount & inspect reachout items
    let totalAmount = 0;
    let hasReachoutItem = Boolean(is_reachout_order);

    items.forEach((item: any) => {
      const lineTotal = (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1);
      totalAmount += lineTotal;
      if (item.is_reachout) {
        hasReachoutItem = true;
      }
    });

    let finalNote = (note || '').trim();
    if (hasReachoutItem) {
      finalNote = (finalNote ? finalNote + ' ' : '') + `[Reachout Sale by ${staffFullName}]`;
    }

    // 1. Insert Order
    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        source: orderSource,
        customer_name,
        customer_phone,
        customer_email: customer_email || null,
        shipping_address,
        payment_method: payment_method || 'Cash on Delivery (COD)',
        payment_status: 'pending',
        status: 'pending', // Pending sales confirmation
        total_amount: totalAmount,
        currency: 'BDT',
        sales_rep_id: assignedSalesRepId,
        coupon_used: coupon_used || null,
        note: finalNote || null,
      })
      .select()
      .single();

    if (orderError || !newOrder) {
      throw orderError || new Error('Failed to create order');
    }

    // 2. Insert Order Items (Rule: "make the upsell functionality only valid for website orders, any other source are count as regular sells")
    const isWebsite = orderSource === 'website';
    const itemsToInsert = items.map((item: any) => ({
      order_id: newOrder.id,
      product_id: item.product_id || null,
      variant_id: item.variant_id || null,
      title: item.title,
      variant_title: item.variant_title || null,
      quantity: parseInt(item.quantity, 10) || 1,
      price: parseFloat(item.price || '0'),
      // Only website orders can have is_upsell true
      is_upsell: isWebsite ? Boolean(item.is_upsell) : false,
    }));

    const { data: insertedItems, error: itemsError } = await supabase
      .from('order_items')
      .insert(itemsToInsert)
      .select();

    if (itemsError) {
      throw itemsError;
    }

    // 3. Website Upsell Quota Reward Processing (Strictly applies to Website orders)
    let rewardGiven = 0;
    if (assignedSalesRepId && isWebsite) {
      const quotaResult = await syncWebsiteUpsellQuotaRewards(supabase, assignedSalesRepId, newOrder.id);
      if (quotaResult?.targetBonus) {
        rewardGiven = quotaResult.targetBonus;
      }
    }

    return NextResponse.json({
      success: true,
      order: newOrder,
      rewardGiven,
      orderNumber,
    });
  } catch (err: any) {
    console.error('Manual order entry error:', err);
    return NextResponse.json({ error: err.message || 'Failed to submit order' }, { status: 500 });
  }
}
