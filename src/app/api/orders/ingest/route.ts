import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const internalSecret = process.env.DASHBOARD_INTERNAL_SECRET;
    const headerSecret = req.headers.get('x-internal-secret');

    if (internalSecret && headerSecret !== internalSecret) {
      return NextResponse.json({ error: 'Unauthorized internal request' }, { status: 401 });
    }

    const payload = await req.json();
    const orderData = payload.order || payload;

    if (!orderData || !orderData.id) {
      return NextResponse.json({ error: 'Invalid order payload' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Format Order Fields
    const orderNumber = String(orderData.name || `#${orderData.order_number || orderData.id}`);
    
    // Check for duplicate
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('order_number', orderNumber)
      .maybeSingle();

    if (existingOrder) {
      return NextResponse.json({ message: 'Order already ingested', id: existingOrder.id }, { status: 200 });
    }

    // Customer Name extraction
    const cleanStr = (s: any) => (s && typeof s === 'string' && s.trim() !== '-' ? s.trim() : '');
    const noteName = orderData.note_attributes?.find((a: any) => /name/i.test(a.name))?.value;
    const firstName = cleanStr(orderData.customer?.first_name || orderData.shipping_address?.first_name);
    const lastName = cleanStr(orderData.customer?.last_name || orderData.shipping_address?.last_name);
    const customerName = [firstName, lastName].filter(Boolean).join(' ') ||
      cleanStr(orderData.shipping_address?.name) ||
      cleanStr(noteName) ||
      'Guest';

    // Phone
    const notePhone = orderData.note_attributes?.find((a: any) => /phone/i.test(a.name))?.value;
    const customerPhone = orderData.phone ||
      orderData.shipping_address?.phone ||
      orderData.customer?.phone ||
      notePhone ||
      'N/A';

    // Address
    const addr = orderData.shipping_address || orderData.billing_address || {};
    const noteAddress = orderData.note_attributes?.find((a: any) => /address/i.test(a.name))?.value;
    const addressParts = [];
    if (cleanStr(addr.address1) || cleanStr(noteAddress)) addressParts.push(cleanStr(addr.address1) || cleanStr(noteAddress));
    if (cleanStr(addr.address2)) addressParts.push(cleanStr(addr.address2));
    const city = cleanStr(addr.city);
    const country = cleanStr(addr.country);
    if (city || country) addressParts.push([city, country].filter(Boolean).join(', '));
    const shippingAddress = addressParts.join(', ') || 'No address provided';

    // Payment
    const paymentMethod = orderData.payment_gateway_names?.length > 0
      ? orderData.payment_gateway_names.join(', ')
      : (orderData.gateway || 'Cash on Delivery (COD)');
    const paymentStatus = orderData.financial_status || 'pending';

    // Total
    const totalAmount = parseFloat(orderData.total_price || orderData.current_total_price || '0');
    const currency = orderData.currency || orderData.presentment_currency || 'BDT';

    // Coupons & Sales Rep Attribution
    // Check multiple potential Shopify coupon locations:
    // 1. discount_codes array
    // 2. discount_applications array
    // 3. note_attributes (Releasit COD forms, custom checkout attributes)
    const extractedCodes: string[] = [];
    if (Array.isArray(orderData.discount_codes)) {
      orderData.discount_codes.forEach((d: any) => {
        if (d?.code && typeof d.code === 'string') extractedCodes.push(d.code.trim());
      });
    }
    if (Array.isArray(orderData.discount_applications)) {
      orderData.discount_applications.forEach((d: any) => {
        if (d?.code && typeof d.code === 'string') extractedCodes.push(d.code.trim());
      });
    }
    if (Array.isArray(orderData.note_attributes)) {
      orderData.note_attributes.forEach((attr: any) => {
        if (/coupon|discount|promo|referral|sales_rep|rep_code/i.test(attr?.name || '') && attr?.value) {
          extractedCodes.push(String(attr.value).trim());
        }
      });
    }

    let salesRepId: string | null = null;
    let matchedCoupon: string | null = null;

    for (const code of extractedCodes) {
      if (!code) continue;
      const { data: rep } = await supabase
        .from('profiles')
        .select('id, coupon_code')
        .ilike('coupon_code', code)
        .maybeSingle();

      if (rep) {
        salesRepId = rep.id;
        matchedCoupon = rep.coupon_code || code;
        break;
      }
    }

    const finalCouponUsed = matchedCoupon || extractedCodes[0] || null;

    // 2. Insert Order
    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        source: 'website',
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: orderData.email || orderData.customer?.email || null,
        shipping_address: shippingAddress,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        status: 'pending', // Default incoming website orders are pending confirmation
        total_amount: totalAmount,
        currency: currency,
        sales_rep_id: salesRepId,
        coupon_used: finalCouponUsed,
        note: orderData.note || null,
        external_id: String(orderData.id),
      })
      .select()
      .single();

    if (orderError || !newOrder) {
      throw orderError || new Error('Failed to insert order into database');
    }

    // 3. Insert Order Items & Match Product Variants
    const lineItems = orderData.line_items || [];
    const itemsToInsert = [];

    for (const item of lineItems) {
      // Try to find matching variant by SKU or title
      let matchedVariantId: string | null = null;
      let matchedProductId: string | null = null;

      if (item.sku) {
        const { data: v } = await supabase
          .from('product_variants')
          .select('id, product_id')
          .eq('sku', item.sku)
          .maybeSingle();
        if (v) {
          matchedVariantId = v.id;
          matchedProductId = v.product_id;
        }
      }

      if (!matchedVariantId) {
        const { data: v } = await supabase
          .from('product_variants')
          .select('id, product_id')
          .ilike('title', `%${item.variant_title || item.title}%`)
          .maybeSingle();
        if (v) {
          matchedVariantId = v.id;
          matchedProductId = v.product_id;
        }
      }

      itemsToInsert.push({
        order_id: newOrder.id,
        product_id: matchedProductId,
        variant_id: matchedVariantId,
        title: item.title || item.name || 'Item',
        variant_title: item.variant_title || null,
        quantity: parseInt(item.quantity, 10) || 1,
        price: parseFloat(item.price || '0'),
        is_upsell: false,
      });
    }

    if (itemsToInsert.length > 0) {
      await supabase.from('order_items').insert(itemsToInsert);
    }

    // 4. Calculate Salesperson Upsell Reward if attributed
    if (salesRepId) {
      const { data: activeRule } = await supabase
        .from('reward_rules')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (activeRule) {
        let bonusAmount = 0;
        if (activeRule.rule_type === 'percentage') {
          bonusAmount = (totalAmount * (activeRule.value / 100));
        } else if (activeRule.rule_type === 'fixed_per_order') {
          bonusAmount = activeRule.value;
        } else if (activeRule.rule_type === 'fixed_per_item') {
          const totalQty = itemsToInsert.reduce((sum, it) => sum + (it.quantity || 1), 0);
          bonusAmount = activeRule.value * totalQty;
        }

        if (bonusAmount > 0) {
          await supabase.from('upsell_rewards').insert({
            sales_rep_id: salesRepId,
            order_id: newOrder.id,
            bonus_amount: bonusAmount,
            status: 'pending',
            note: `Reward via coupon ${finalCouponUsed || 'matched'} (${activeRule.name})`,
          });
        }
      }
    }

    console.log(`✅ [Dashboard API] Order ${orderNumber} ingested and stored in Supabase!`);
    return NextResponse.json({ success: true, orderId: newOrder.id, orderNumber });
  } catch (err: any) {
    console.error('❌ [Dashboard API Ingest Error]:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
