import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { syncStaffCommissionRewards, syncReachoutCommissionReward } from '@/lib/commission';

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
      delivery_type,
      delivery_charge,
      discount_amount,
      advance_payment,
      advance_method,
      advance_trx_id,
    } = body;

    if (!customer_name || !customer_phone || !shipping_address || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Customer name, phone, address, and at least 1 item are required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 1. Resolve Creator (Auto-assignment for non-website orders)
    let authenticatedUserId: string | null = null;
    let staffFullName = 'Staff';
    try {
      const serverSupabase = await createServerClient();
      const {
        data: { user },
      } = await serverSupabase.auth.getUser();
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

    // Calculate product items subtotal & inspect reachout items
    let itemsSubtotal = 0;
    let reachoutSubtotal = 0;
    let hasReachoutItem = Boolean(is_reachout_order);

    items.forEach((item: any) => {
      const lineTotal = (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1);
      itemsSubtotal += lineTotal;
      if (item.is_reachout || is_reachout_order) {
        hasReachoutItem = true;
        reachoutSubtotal += lineTotal;
      }
    });

    // Determine Delivery Charge (Inside Dhaka: 80, Outside Dhaka: 130, Free Delivery: 0)
    let finalDeliveryFee = 80;
    let deliveryLabel = 'Inside Dhaka (80 BDT)';

    if (delivery_type === 'free' || delivery_charge === 0) {
      finalDeliveryFee = 0;
      deliveryLabel = `Free Delivery (Offered by ${staffFullName})`;
    } else if (delivery_type === 'outside_dhaka' || delivery_charge === 130) {
      finalDeliveryFee = 130;
      deliveryLabel = 'Outside Dhaka (130 BDT)';
    } else if (delivery_type === 'inside_dhaka' || delivery_charge === 80) {
      finalDeliveryFee = 80;
      deliveryLabel = 'Inside Dhaka (80 BDT)';
    } else if (typeof delivery_charge === 'number') {
      finalDeliveryFee = Math.max(0, delivery_charge);
      deliveryLabel = `${finalDeliveryFee} BDT`;
    }

    // Custom Discount and Advance Pre-Payment calculations
    const finalDiscount = Math.max(0, parseFloat(discount_amount) || 0);
    const finalAdvance = Math.max(0, parseFloat(advance_payment) || 0);
    const grandTotal = Math.max(0, itemsSubtotal + finalDeliveryFee - finalDiscount);
    const remainingCod = Math.max(0, grandTotal - finalAdvance);

    let paymentStatus = 'pending';
    if (finalAdvance >= grandTotal && grandTotal > 0) {
      paymentStatus = 'paid';
    } else if (finalAdvance > 0) {
      paymentStatus = 'partial';
    }

    let finalNote = (note || '').trim();
    if (hasReachoutItem) {
      finalNote = (finalNote ? finalNote + '\n' : '') + `[Reachout Sale by ${staffFullName}]`;
    }
    finalNote = (finalNote ? finalNote + '\n' : '') + `[Delivery: ${deliveryLabel}]`;

    if (finalDiscount > 0) {
      finalNote = (finalNote ? finalNote + '\n' : '') + `[Discount: ৳${finalDiscount.toLocaleString()}]`;
    }

    if (finalAdvance > 0) {
      const methodLabel = advance_method ? ` via ${advance_method}` : '';
      const trxLabel = advance_trx_id ? ` (Trx: ${advance_trx_id})` : '';
      finalNote =
        (finalNote ? finalNote + '\n' : '') +
        `[Advance Paid: ৳${finalAdvance.toLocaleString()}${methodLabel}${trxLabel} | Remaining COD: ৳${remainingCod.toLocaleString()}]`;
    }

    const isWebsite = orderSource === 'website';

    // 1. Insert Order with fallback handling for newer columns
    const orderInsertPayload: Record<string, any> = {
      order_number: orderNumber,
      source: orderSource,
      customer_name,
      customer_phone,
      customer_email: customer_email || null,
      shipping_address,
      payment_method:
        finalAdvance > 0 && remainingCod === 0
          ? advance_method || 'Prepaid'
          : payment_method || 'Cash on Delivery (COD)',
      payment_status: paymentStatus,
      status: 'pending', // Pending sales confirmation
      total_amount: grandTotal,
      delivery_charge: finalDeliveryFee,
      discount_amount: finalDiscount,
      advance_payment: finalAdvance,
      currency: 'BDT',
      sales_rep_id: assignedSalesRepId,
      coupon_used: coupon_used || null,
      note: finalNote || null,
      original_items: items.map((it: any) => ({
        product_id: it.product_id || null,
        variant_id: it.variant_id || null,
        title: it.title,
        variant_title: it.variant_title || null,
        quantity: parseInt(it.quantity, 10) || 1,
        price: parseFloat(it.price || '0'),
        is_upsell: isWebsite ? Boolean(it.is_upsell) : false,
        is_reachout: Boolean(it.is_reachout || hasReachoutItem),
      })),
    };

    let { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert(orderInsertPayload)
      .select()
      .single();

    // Fallback if migration columns are missing from DB
    if (orderError) {
      let retryNeeded = false;
      if (orderError.message?.includes('delivery_charge')) {
        delete orderInsertPayload.delivery_charge;
        retryNeeded = true;
      }
      if (orderError.message?.includes('discount_amount')) {
        delete orderInsertPayload.discount_amount;
        retryNeeded = true;
      }
      if (orderError.message?.includes('advance_payment')) {
        delete orderInsertPayload.advance_payment;
        retryNeeded = true;
      }

      if (retryNeeded) {
        const res = await supabase.from('orders').insert(orderInsertPayload).select().single();
        newOrder = res.data;
        orderError = res.error;
      }
    }

    if (orderError || !newOrder) {
      throw orderError || new Error('Failed to create order');
    }

    // 2. Insert Order Items (Rule: only website orders can have is_upsell true)
    const itemsToInsert = items.map((item: any) => ({
      order_id: newOrder.id,
      product_id: item.product_id || null,
      variant_id: item.variant_id || null,
      title: item.title,
      variant_title: item.variant_title || null,
      quantity: parseInt(item.quantity, 10) || 1,
      price: parseFloat(item.price || '0'),
      is_upsell: isWebsite ? Boolean(item.is_upsell) : false,
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);

    if (itemsError) {
      throw itemsError;
    }

    // 3. Reachout Commission processing (Flat percentage on reachout items)
    let reachoutCommissionAwarded = 0;
    if (hasReachoutItem && assignedSalesRepId && reachoutSubtotal > 0) {
      const reachoutResult = await syncReachoutCommissionReward(
        supabase,
        assignedSalesRepId,
        newOrder.id,
        reachoutSubtotal
      );
      if (reachoutResult?.bonus) {
        reachoutCommissionAwarded = reachoutResult.bonus;
      }
    }

    // 4. Quota / Daily Sales Milestone synchronization
    let rewardGiven = 0;
    if (assignedSalesRepId) {
      const rewardResult = await syncStaffCommissionRewards(
        supabase,
        assignedSalesRepId,
        newOrder.id,
        newOrder.source
      );
      if (rewardResult?.targetBonus) {
        rewardGiven = rewardResult.targetBonus;
      }
    }

    return NextResponse.json({
      success: true,
      order: newOrder,
      rewardGiven,
      reachoutCommissionAwarded,
      orderNumber,
      grandTotal,
      remainingCod,
    });
  } catch (err: any) {
    console.error('Manual order entry error:', err);
    return NextResponse.json({ error: err.message || 'Failed to submit order' }, { status: 500 });
  }
}
