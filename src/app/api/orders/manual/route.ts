import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
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
    } = body;

    if (!customer_name || !customer_phone || !shipping_address || !items || items.length === 0) {
      return NextResponse.json({ error: 'Customer name, phone, address, and at least 1 item are required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Generate readable order number: e.g. WA-1025, MSG-1026, PH-1027
    const prefixMap: Record<string, string> = {
      whatsapp: 'WA',
      messenger: 'MSG',
      phone: 'PH',
      manual: 'MAN',
    };
    const prefix = prefixMap[source] || 'ORD';
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `#${prefix}-${Date.now().toString().slice(-4)}${randomSuffix}`;

    // Calculate total amount
    let totalAmount = 0;
    let hasUpsell = false;
    let upsellItemsCount = 0;

    items.forEach((item: any) => {
      const lineTotal = (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1);
      totalAmount += lineTotal;
      if (item.is_upsell) {
        hasUpsell = true;
        upsellItemsCount += parseInt(item.quantity) || 1;
      }
    });

    // 1. Insert Order
    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        source: source || 'manual',
        customer_name,
        customer_phone,
        customer_email: customer_email || null,
        shipping_address,
        payment_method: payment_method || 'Cash on Delivery (COD)',
        payment_status: 'pending',
        status: 'pending', // Pending sales confirmation
        total_amount: totalAmount,
        currency: 'BDT',
        sales_rep_id: sales_rep_id || null,
        coupon_used: coupon_used || null,
        note: note || null,
      })
      .select()
      .single();

    if (orderError || !newOrder) {
      throw orderError || new Error('Failed to create order');
    }

    // 2. Insert Order Items (Database trigger deduct_inventory_for_order_item handles live stock deduction)
    const itemsToInsert = items.map((item: any) => ({
      order_id: newOrder.id,
      product_id: item.product_id || null,
      variant_id: item.variant_id || null,
      title: item.title,
      variant_title: item.variant_title || null,
      quantity: parseInt(item.quantity, 10) || 1,
      price: parseFloat(item.price || '0'),
      is_upsell: Boolean(item.is_upsell),
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
    if (sales_rep_id && source === 'website') {
      const quotaResult = await syncWebsiteUpsellQuotaRewards(supabase, sales_rep_id, newOrder.id);
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
