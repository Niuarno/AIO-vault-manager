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

    // Dynamic Delivery Charge for Website Orders:
    // Inside Dhaka: 80tk, Outside Dhaka: 130tk
    // Rule: "if website order value exceeds 1000tk then delivery free or else keep regular charges"
    const lineItems = orderData.line_items || [];
    const itemsSubtotal = lineItems.reduce((acc: number, it: any) => {
      const price = parseFloat(it.price || '0');
      const qty = parseInt(it.quantity || '1', 10);
      return acc + price * qty;
    }, 0);

    const isInsideDhaka =
      /dhaka/i.test(shippingAddress) ||
      /dhaka/i.test(city || '') ||
      /dhaka/i.test(orderData.shipping_address?.city || '') ||
      /dhaka/i.test(orderData.shipping_address?.province || '');

    const isFreeDelivery = itemsSubtotal > 1000;
    let websiteDeliveryCharge = 0;
    let deliveryNote = '';

    if (isFreeDelivery) {
      websiteDeliveryCharge = 0;
      deliveryNote = `[Website Order: Free Delivery applied (Order subtotal ${itemsSubtotal} BDT > 1000 BDT)]`;
    } else {
      websiteDeliveryCharge = isInsideDhaka ? 80 : 130;
      deliveryNote = `[Website Order Delivery: ${isInsideDhaka ? 'Inside Dhaka (80 BDT)' : 'Outside Dhaka (130 BDT)'}]`;
    }

    // If Shopify/external webhook sent 0 or only items price, include delivery fee
    let finalOrderTotal = totalAmount;
    if (finalOrderTotal <= 0) {
      finalOrderTotal = itemsSubtotal + websiteDeliveryCharge;
    }

    const finalOrderNote = orderData.note
      ? `${orderData.note}\n${deliveryNote}`
      : deliveryNote;

    // 2. Insert Order (with delivery_charge fallback if column not in DB yet)
    const ingestOrderPayload: Record<string, any> = {
      order_number: orderNumber,
      source: 'website',
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: orderData.email || orderData.customer?.email || null,
      shipping_address: shippingAddress,
      payment_method: paymentMethod,
      payment_status: paymentStatus,
      status: 'pending', // Default incoming website orders are pending confirmation
      total_amount: finalOrderTotal,
      delivery_charge: websiteDeliveryCharge,
      currency: currency,
      sales_rep_id: salesRepId,
      coupon_used: finalCouponUsed,
      note: finalOrderNote,
      external_id: String(orderData.id),
      original_items: lineItems,
    };

    let { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert(ingestOrderPayload)
      .select()
      .single();

    if (orderError && orderError.message?.includes('delivery_charge')) {
      delete ingestOrderPayload.delivery_charge;
      const res = await supabase.from('orders').insert(ingestOrderPayload).select().single();
      newOrder = res.data;
      orderError = res.error;
    }

    if (orderError || !newOrder) {
      throw orderError || new Error('Failed to insert order into database');
    }

    // 3. Insert Order Items & Match Product Variants
    const itemsToInsert = [];

    for (const item of lineItems) {
      // Try to find matching variant by SKU or title
      let matchedVariantId: string | null = null;
      let matchedProductId: string | null = null;

      // 1. Match by SKU
      if (item.sku && String(item.sku).trim()) {
        const { data: v } = await supabase
          .from('product_variants')
          .select('id, product_id')
          .eq('sku', String(item.sku).trim())
          .limit(1)
          .maybeSingle();
        if (v) {
          matchedVariantId = v.id;
          matchedProductId = v.product_id;
        }
      }

      // 2. Match by Product Title -> Product Variants
      const itemTitle = (item.title || item.name || '').trim();
      if (!matchedVariantId && itemTitle) {
        const { data: pList } = await supabase
          .from('products')
          .select('id, title, product_variants(id, title, sku, stock_quantity)')
          .ilike('title', `%${itemTitle}%`)
          .limit(1);

        if (pList && pList.length > 0 && pList[0].product_variants?.length > 0) {
          const product = pList[0];
          matchedProductId = product.id;

          // If variant title is provided, try to match specific variant
          if (item.variant_title && item.variant_title !== 'Default Title') {
            const vMatch = (product.product_variants as any[]).find(
              (v: any) => v.title && v.title.toLowerCase() === item.variant_title.toLowerCase()
            );
            if (vMatch) {
              matchedVariantId = vMatch.id;
            }
          }

          // Fallback to first variant
          if (!matchedVariantId) {
            matchedVariantId = product.product_variants[0].id;
          }
        }
      }

      // 3. Fallback: match by variant title directly
      if (!matchedVariantId && item.variant_title && item.variant_title !== 'Default Title') {
        const { data: v } = await supabase
          .from('product_variants')
          .select('id, product_id')
          .ilike('title', `%${item.variant_title.trim()}%`)
          .limit(1)
          .maybeSingle();
        if (v) {
          matchedVariantId = v.id;
          matchedProductId = v.product_id;
        }
      }

      // 4. Resolve fallback variant if no catalog variant matched (prevents trigger not-null errors)
      if (!matchedVariantId) {
        try {
          const { data: fb } = await supabase
            .from('products')
            .select('id, product_variants(id)')
            .eq('title', 'Custom / Unlinked Items')
            .maybeSingle();
          matchedVariantId = fb?.product_variants?.[0]?.id || null;
          matchedProductId = fb?.id || null;
        } catch (fbErr) {
          console.warn('Failed to resolve fallback variant on ingest:', fbErr);
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
      const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
      if (itemsError) {
        console.error('❌ [Order Items Ingest Error]:', itemsError.message);
      }
    }

    // 4. Staff Attribution (Website orders have ZERO commission unless an upsell is added)
    // Rule: "website orders dont have any comission unless if its website upsell. if its a upsell then follows under the current comission rule"
    // When an order is placed on the website (even with a coupon), it has 0 commission.
    // Commission is only awarded when staff actively performs a website upsell (is_upsell: true).

    console.log(`✅ [Dashboard API] Order ${orderNumber} ingested and stored in Supabase!`);
    return NextResponse.json({ success: true, orderId: newOrder.id, orderNumber });
  } catch (err: any) {
    console.error('❌ [Dashboard API Ingest Error]:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
