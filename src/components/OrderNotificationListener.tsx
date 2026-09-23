'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function OrderNotificationListener() {
  useEffect(() => {
    const supabase = createClient();

    // Global order realtime listener
    const channel = supabase
      .channel('global-orders-push-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          const newOrder = payload.new as any;
          const orderNum = newOrder?.order_number || (newOrder?.id ? newOrder.id.slice(0, 8) : 'New');
          const title = `📦 New Order #${orderNum}!`;
          const customer = newOrder?.customer_name || 'Customer';
          const amount = newOrder?.total_amount ? ` • ৳${newOrder.total_amount}` : '';
          const message = `${customer}${amount} is waiting for fulfillment.`;

          // Trigger native Android Push Notification
          if (typeof window !== 'undefined' && (window as any).Android) {
            (window as any).Android.showPushNotification(title, message, '/packing');
            (window as any).Android.triggerHaptic('heavy');
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          const oldOrder = payload.old as any;
          const newOrder = payload.new as any;

          // Only notify if status changed to meaningful state
          if (oldOrder?.status !== newOrder?.status && newOrder?.status) {
            const orderNum = newOrder?.order_number || (newOrder?.id ? newOrder.id.slice(0, 8) : '');
            let statusEmoji = '🚚';
            if (newOrder.status === 'shipped' || newOrder.status === 'delivered') statusEmoji = '🎉';
            if (newOrder.status === 'canceled') statusEmoji = '⚠️';

            const title = `${statusEmoji} Order #${orderNum} Status Updated`;
            const message = `Order is now ${newOrder.status.replace(/_/g, ' ').toUpperCase()}`;

            if (typeof window !== 'undefined' && (window as any).Android) {
              (window as any).Android.showPushNotification(title, message, '/packing');
              (window as any).Android.triggerHaptic('click');
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
