'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/Navbar';
import confetti from 'canvas-confetti';
import {
  ShoppingBag,
  PlusCircle,
  Boxes,
  Award,
  Phone,
  CheckCircle2,
  Clock,
  X,
  Search,
  Tag,
  PackageOpen,
  DollarSign,
  Image as ImageIcon,
  ShieldCheck,
  AlertCircle,
  Plus,
  Trash2,
  User,
  Filter,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Lock,
} from 'lucide-react';
import EditOrderItemsModal from '@/components/EditOrderItemsModal';
import StaffPerformanceGraph from '@/components/StaffPerformanceGraph';
import ScreenshotLightboxModal from '@/components/ScreenshotLightboxModal';
import ModernProductSelect from '@/components/ModernProductSelect';
import {
  WhatsAppFlatIcon,
  MessengerFlatIcon,
  PhoneCallFlatIcon,
  WalkInFlatIcon,
  WebsiteFlatIcon,
} from '@/components/SourceIcons';
import {
  Order,
  ProductVariant,
  Profile,
  UpsellReward,
  OrderStatus,
  OrderSource,
  PayoutRequest,
} from '@/types/database';
import { QuotaTier } from '@/lib/commission';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function SalesDashboard() {
  const supabase = createClient();

  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [activeTab, setActiveTab] = useState<'orders' | 'inventory' | 'rewards' | 'payouts'>('orders');

  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [editingOrderForItems, setEditingOrderForItems] = useState<Order | null>(null);

  // Live Inventory State
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [inventorySearch, setInventorySearch] = useState('');

  // Rewards State
  const [rewards, setRewards] = useState<UpsellReward[]>([]);
  const [loadingRewards, setLoadingRewards] = useState(false);
  const [quotaTiers, setQuotaTiers] = useState<QuotaTier[]>([]);
  const [showTiersModal, setShowTiersModal] = useState(false);
  const [quotaCardTab, setQuotaCardTab] = useState<'other' | 'website'>('other');
  const [tiersModalTab, setTiersModalTab] = useState<'other' | 'website'>('other');

  // Payouts State
  const [myPayouts, setMyPayouts] = useState<PayoutRequest[]>([]);
  const [loadingPayouts, setLoadingPayouts] = useState(false);
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('bKash');
  const [payoutAccount, setPayoutAccount] = useState('');
  const [payoutNote, setPayoutNote] = useState('');
  const [submittingPayout, setSubmittingPayout] = useState(false);
  const [lightboxScreenshot, setLightboxScreenshot] = useState<{ url: string; title: string } | null>(null);

  // New Order Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [source, setSource] = useState<OrderSource>('whatsapp');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash on Delivery (COD)');
  const [couponUsed, setCouponUsed] = useState('');
  const [note, setNote] = useState('');
  const [deliveryType, setDeliveryType] = useState<'inside_dhaka' | 'outside_dhaka' | 'free'>('inside_dhaka');

  // Selected Order Line Items
  const [orderItems, setOrderItems] = useState<
    Array<{
      product_id: string;
      variant_id: string;
      title: string;
      variant_title: string;
      price: number;
      quantity: number;
      is_upsell: boolean;
      is_reachout?: boolean;
    }>
  >([]);

  // Current item being selected in modal
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [itemQuantity, setItemQuantity] = useState(1);
  const [isReachoutItem, setIsReachoutItem] = useState(false);

  // Performance Graph Month/Year State
  const [graphYear, setGraphYear] = useState<number>(new Date().getFullYear());
  const [graphMonth, setGraphMonth] = useState<number>(new Date().getMonth());

  // Load User Profile & Realtime Presence
  useEffect(() => {
    let presenceChannel: ReturnType<typeof supabase.channel> | null = null;
    let isMounted = true;

    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !isMounted) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (!isMounted) return;
      if (profile) {
        setCurrentProfile(profile);
        if (profile.coupon_code) {
          setCouponUsed(profile.coupon_code);
        }
        if (profile.payment_info?.account_number) {
          setPayoutAccount(profile.payment_info.account_number);
        }
        if (profile.payment_info?.method) {
          setPayoutMethod(profile.payment_info.method);
        }
      }

      // Single presence channel
      const channel = supabase.channel('online-staff', {
        config: { presence: { key: user.id } },
      });
      presenceChannel = channel;

      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && isMounted) {
          await channel.track({
            user_id: user.id,
            full_name: profile?.full_name || 'Sales Staff',
            online_at: new Date().toISOString(),
          });
        }
      });
    }

    loadUser();

    return () => {
      isMounted = false;
      if (presenceChannel) {
        supabase.removeChannel(presenceChannel);
      }
    };
  }, []);

  // Fetch Orders
  const fetchOrders = async () => {
    setLoadingOrders(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setOrders(data as Order[]);
    }
    setLoadingOrders(false);
  };

  // Fetch Live Inventory (Excluding confidential cost_price)
  const fetchInventory = async () => {
    setLoadingInventory(true);
    const { data, error } = await supabase
      .from('product_variants')
      .select('id, product_id, title, sku, price, stock_quantity, created_at, updated_at, product:products(*)')
      .order('stock_quantity', { ascending: true });

    if (!error && data) {
      setVariants((data as unknown) as ProductVariant[]);
    }
    setLoadingInventory(false);
  };

  // Fetch My Upsell Rewards
  const fetchRewards = async () => {
    setLoadingRewards(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data, error } = await supabase
        .from('upsell_rewards')
        .select('*, order:orders(*)')
        .eq('sales_rep_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setRewards(data as UpsellReward[]);
      }
    }
    setLoadingRewards(false);
  };

  // Fetch My Payout Requests
  const fetchPayouts = async () => {
    setLoadingPayouts(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      try {
        const res = await fetch(`/api/payouts?staff_id=${user.id}`);
        const json = await res.json();
        if (json.payouts) {
          setMyPayouts(json.payouts);
        }
      } catch (err) {
        console.error('Failed to load payouts:', err);
      }
    }
    setLoadingPayouts(false);
  };

  // Fetch Active Website Upsell Quota Tiers
  const fetchQuotaTiers = async () => {
    try {
      const res = await fetch('/api/rewards/rules');
      const json = await res.json();
      if (json.rules) {
        setQuotaTiers(json.rules);
      }
    } catch (err) {
      console.error('Failed to load quota tiers:', err);
    }
  };

  // Single Stable Realtime Subscription on mount (NO reconnect loops)
  useEffect(() => {
    fetchOrders();
    fetchInventory();
    fetchRewards();
    fetchPayouts();
    fetchQuotaTiers();

    const channel = supabase
      .channel('sales-realtime-singleton')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          fetchOrders();
          fetchInventory();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'upsell_rewards' },
        () => {
          fetchRewards();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payout_requests' },
        () => {
          fetchPayouts();
          fetchRewards();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reward_rules' },
        () => {
          fetchQuotaTiers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Add Item to Current Order
  const handleAddItem = () => {
    if (!selectedVariantId) return;
    const v = variants.find((variant) => variant.id === selectedVariantId);
    if (!v) return;

    if (itemQuantity > v.stock_quantity) {
      alert(`Only ${v.stock_quantity} units available in live stock.`);
      return;
    }

    setOrderItems((prev) => [
      ...prev,
      {
        product_id: v.product_id,
        variant_id: v.id,
        title: (v.product as any)?.name || (v.product as any)?.title || 'Product',
        variant_title: v.title,
        price: Number(v.price),
        quantity: itemQuantity,
        is_upsell: false,
        is_reachout: isReachoutItem,
      },
    ]);

    // Reset picker
    setSelectedVariantId('');
    setItemQuantity(1);
    setIsReachoutItem(false);
  };

  // Remove Item
  const handleRemoveItem = (index: number) => {
    setOrderItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Delivery Charge Calculation:
  // Inside Dhaka: 80tk, Outside Dhaka: 130tk, Free Delivery: 0tk
  const deliveryCharge = useMemo(() => {
    if (deliveryType === 'inside_dhaka') return 80;
    if (deliveryType === 'outside_dhaka') return 130;
    return 0; // free delivery
  }, [deliveryType]);

  const itemsSubtotal = useMemo(() => {
    return orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  }, [orderItems]);

  const totalOrderAmount = itemsSubtotal + deliveryCharge;

  // Submit Manual Order
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (orderItems.length === 0) {
      alert('Please add at least one product item to the order.');
      return;
    }

    setSubmittingOrder(true);
    try {
      const res = await fetch('/api/orders/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source,
          customer_name: customerName,
          customer_phone: customerPhone,
          shipping_address: shippingAddress,
          payment_method: paymentMethod,
          note,
          items: orderItems,
          sales_rep_id: currentProfile?.id,
          coupon_used: couponUsed || null,
          is_reachout_order: orderItems.some((i) => i.is_reachout),
          delivery_type: deliveryType,
          delivery_charge: deliveryCharge,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit order');
      }

      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
      });

      // Reset Form & Close
      setIsModalOpen(false);
      setCustomerName('');
      setCustomerPhone('');
      setShippingAddress('');
      setNote('');
      setOrderItems([]);
      setDeliveryType('inside_dhaka');

      fetchOrders();
      fetchInventory();
      fetchRewards();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingOrder(false);
    }
  };

  // Status Change Handler
  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
        );
        fetchInventory();
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Calculations:
  // Today's Earnings (resets at 12:00 AM midnight)
  const todayStr = new Date().toISOString().split('T')[0];
  const todayEarnings = useMemo(() => {
    return rewards
      .filter((r) => r.created_at.startsWith(todayStr))
      .reduce((sum, r) => sum + Number(r.bonus_amount || 0), 0);
  }, [rewards, todayStr]);

  // Website Upsells (Extra Sales) achieved today by this staff member
  const todayWebsiteUpsells = useMemo(() => {
    if (!currentProfile?.id) return 0;
    return orders
      .filter((o) => o.sales_rep_id === currentProfile.id && o.source === 'website' && o.created_at.startsWith(todayStr))
      .reduce((sum, order) => {
        const upsellVal = (order.order_items || [])
          .filter((item) => item.is_upsell)
          .reduce((s, it) => s + Number(it.price || 0) * Number(it.quantity || 1), 0);
        return sum + upsellVal;
      }, 0);
  }, [orders, currentProfile, todayStr]);

  // Website Active Quota Tiers sorted ascending
  const websiteActiveTiers = useMemo(() => {
    return quotaTiers
      .filter((t) => t.source === 'website' && t.is_active)
      .sort((a, b) => a.min_quota - b.min_quota);
  }, [quotaTiers]);

  // Other Sources (Non-Website) Active Quota Tiers sorted ascending
  const otherActiveTiers = useMemo(() => {
    return quotaTiers
      .filter((t) => t.source !== 'website' && t.is_active)
      .sort((a, b) => a.min_quota - b.min_quota);
  }, [quotaTiers]);

  // Today's Non-Website Sales achieved by this staff member
  const todayOtherSales = useMemo(() => {
    if (!currentProfile?.id) return 0;
    return orders
      .filter(
        (o) =>
          o.sales_rep_id === currentProfile.id &&
          o.source !== 'website' &&
          o.status !== 'canceled' &&
          o.created_at.startsWith(todayStr)
      )
      .reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  }, [orders, currentProfile, todayStr]);

  // Website Quota: Highest unlocked tier reached today
  const unlockedWebsiteTier = useMemo(() => {
    const reversed = [...websiteActiveTiers].reverse();
    return reversed.find((t) => todayWebsiteUpsells >= t.min_quota) || null;
  }, [websiteActiveTiers, todayWebsiteUpsells]);

  // Website Quota: Next milestone tier to unlock
  const nextWebsiteTier = useMemo(() => {
    return websiteActiveTiers.find((t) => todayWebsiteUpsells < t.min_quota) || null;
  }, [websiteActiveTiers, todayWebsiteUpsells]);

  // Website Quota: Progress percentage to next tier
  const websiteQuotaProgress = useMemo(() => {
    if (!nextWebsiteTier) return 100;
    const baseQuota = unlockedWebsiteTier ? unlockedWebsiteTier.min_quota : 0;
    const range = nextWebsiteTier.min_quota - baseQuota;
    if (range <= 0) return 100;
    const progressVal = todayWebsiteUpsells - baseQuota;
    return Math.min(100, Math.max(0, Math.round((progressVal / range) * 100)));
  }, [todayWebsiteUpsells, unlockedWebsiteTier, nextWebsiteTier]);

  // Other Sources Quota: Highest unlocked tier reached today
  const unlockedOtherTier = useMemo(() => {
    const reversed = [...otherActiveTiers].reverse();
    return reversed.find((t) => todayOtherSales >= t.min_quota) || null;
  }, [otherActiveTiers, todayOtherSales]);

  // Other Sources Quota: Next milestone tier to unlock
  const nextOtherTier = useMemo(() => {
    return otherActiveTiers.find((t) => todayOtherSales < t.min_quota) || null;
  }, [otherActiveTiers, todayOtherSales]);

  // Other Sources Quota: Progress percentage to next tier
  const otherQuotaProgress = useMemo(() => {
    if (!nextOtherTier) return 100;
    const baseQuota = unlockedOtherTier ? unlockedOtherTier.min_quota : 0;
    const range = nextOtherTier.min_quota - baseQuota;
    if (range <= 0) return 100;
    const progressVal = todayOtherSales - baseQuota;
    return Math.min(100, Math.max(0, Math.round((progressVal / range) * 100)));
  }, [todayOtherSales, unlockedOtherTier, nextOtherTier]);

  // Total Pending Commissions from Rewards
  const totalPendingRewards = useMemo(() => {
    return rewards
      .filter((r) => r.status === 'pending')
      .reduce((sum, r) => sum + Number(r.bonus_amount || 0), 0);
  }, [rewards]);

  // Pending Payout Requests
  const totalPendingPayouts = useMemo(() => {
    return myPayouts
      .filter((p) => p.status === 'pending')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }, [myPayouts]);

  // Available Piggybank = Pending Rewards minus pending requested payouts
  const availablePiggybank = Math.max(0, totalPendingRewards - totalPendingPayouts);

  // Total Settled (Approved Payouts)
  const settledEarnings = useMemo(() => {
    return myPayouts
      .filter((p) => p.status === 'approved')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }, [myPayouts]);

  // Submit Payout Request
  const handleSubmitPayoutRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile) return;
    const amountNum = parseFloat(payoutAmount);
    if (!amountNum || amountNum <= 0) {
      alert('Please enter a valid payout amount.');
      return;
    }

    if (amountNum > availablePiggybank) {
      alert(`Requested amount (${amountNum} BDT) exceeds available balance (${availablePiggybank.toFixed(2)} BDT).`);
      return;
    }

    setSubmittingPayout(true);
    try {
      const res = await fetch('/api/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: currentProfile.id,
          amount: amountNum,
          payment_method: payoutMethod,
          account_number: payoutAccount,
          staff_note: payoutNote.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setIsPayoutModalOpen(false);
        setPayoutAmount('');
        setPayoutNote('');
        fetchPayouts();
        fetchRewards();
        alert('Payout request submitted successfully! Admin will review and process payment.');
      } else {
        alert(json.error || 'Failed to submit payout request');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingPayout(false);
    }
  };

  // My Orders
  const myOrders = useMemo(() => {
    return orders.filter((o) => o.sales_rep_id === currentProfile?.id);
  }, [orders, currentProfile]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchStatus = orderStatusFilter === 'all' || o.status === orderStatusFilter;
      const q = orderSearch.toLowerCase();
      const matchQuery =
        !q ||
        o.order_number.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.customer_phone.includes(q) ||
        (o.note && o.note.toLowerCase().includes(q));
      return matchStatus && matchQuery;
    });
  }, [orders, orderStatusFilter, orderSearch]);

  // Monthly Performance Graph Data (all days of selected month/year)
  const performanceGraphData = useMemo(() => {
    const daysInMonth = new Date(graphYear, graphMonth + 1, 0).getDate();
    const days: Record<string, { dayNumber: number; commission: number; ordersCount: number }> = {};

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = String(day).padStart(2, '0');
      const monthStr = String(graphMonth + 1).padStart(2, '0');
      const key = `${graphYear}-${monthStr}-${dayStr}`;
      days[key] = { dayNumber: day, commission: 0, ordersCount: 0 };
    }

    rewards.forEach((r) => {
      const dayKey = r.created_at.split('T')[0];
      if (days[dayKey]) {
        days[dayKey].commission += Number(r.bonus_amount || 0);
      }
    });

    myOrders.forEach((o) => {
      const dayKey = o.created_at.split('T')[0];
      if (days[dayKey]) {
        days[dayKey].ordersCount++;
      }
    });

    return Object.entries(days).map(([dateStr, metrics]) => {
      return {
        dateKey: dateStr,
        label: `${metrics.dayNumber}`,
        dayNumber: metrics.dayNumber,
        ordersCount: metrics.ordersCount,
        salesVolume: 0,
        commissionEarned: Math.round(metrics.commission),
      };
    });
  }, [rewards, myOrders, graphYear, graphMonth]);

  // Filtered variants for Inventory
  const filteredVariants = useMemo(() => {
    return variants.filter((v) => {
      const product = v.product as any;
      if (product?.is_archived) return false;
      const q = inventorySearch.toLowerCase();
      const matchName = product?.name?.toLowerCase().includes(q) || product?.title?.toLowerCase().includes(q);
      const matchSku = (v.sku?.toLowerCase() || '').includes(q);
      const matchVariant = (v.title?.toLowerCase() || '').includes(q);
      return !q || matchName || matchSku || matchVariant;
    });
  }, [variants, inventorySearch]);

  // Get Clean Status Badge Dot & Color
  const getCleanStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return { dot: 'bg-amber-400', label: 'Pending' };
      case 'not_reachable':
        return { dot: 'bg-orange-500', label: 'Not Reachable' };
      case 'confirmed':
        return { dot: 'bg-blue-500', label: 'Confirmed' };
      case 'ready_to_ship':
        return { dot: 'bg-indigo-500', label: 'Ready to Ship' };
      case 'on_the_way':
        return { dot: 'bg-purple-500', label: 'On the Way' };
      case 'delivered':
        return { dot: 'bg-emerald-500', label: 'Delivered' };
      case 'canceled':
        return { dot: 'bg-rose-500', label: 'Canceled' };
      default:
        return { dot: 'bg-slate-400', label: status };
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-emerald-100 selection:text-emerald-900">
      <Navbar
        currentProfile={currentProfile}
        activeTab={activeTab}
        onTabChange={(tab: any) => setActiveTab(tab)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* KPI Cards: Today's Earnings & Piggybank Balance */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {/* Today's Earnings (Resets at 12am) */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Today's Earnings
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                  <Clock className="w-3 h-3 text-emerald-600" /> Resets 12 AM
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2 font-mono truncate">
                {formatCurrency(todayEarnings)}
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Commissions accrued today from upsell orders
            </p>
          </div>

          {/* Piggybank (Pending Payout Balance) */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Piggybank Balance
                </span>
                {totalPendingPayouts > 0 ? (
                  <span className="inline-flex items-center text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
                    {formatCurrency(totalPendingPayouts)} in review
                  </span>
                ) : (
                  <span className="inline-flex items-center text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                    Available
                  </span>
                )}
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2 font-mono truncate">
                {formatCurrency(availablePiggybank)}
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">Withdraw pending balance</span>
              <button
                disabled={availablePiggybank <= 0}
                onClick={() => {
                  setPayoutAmount(availablePiggybank.toString());
                  setIsPayoutModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs shadow-xs transition-all"
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Request Payout</span>
              </button>
            </div>
          </div>

          {/* Settled Earnings */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between sm:col-span-2 lg:col-span-1">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Total Settled & Paid
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" /> Paid Out
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2 font-mono truncate">
                {formatCurrency(settledEarnings)}
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Verified payouts received with payment proof
            </p>
          </div>
        </div>

        {/* Daily Quota & Bonus Milestone Banner */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center shrink-0">
                {quotaCardTab === 'other' ? (
                  <ShoppingBag className="w-5 h-5 text-amber-600" />
                ) : (
                  <WebsiteFlatIcon className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-sm">
                    {quotaCardTab === 'other'
                      ? 'Daily Sales Bonus (Other Order Sources)'
                      : 'Website Upsell Quota (Daily)'}
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                    <Clock className="w-3 h-3 text-emerald-600" /> Resets 12 AM
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {quotaCardTab === 'other'
                    ? 'Earn cash bonuses by hitting cumulative daily sales targets on phone, manual & social orders'
                    : 'Unlock extra bonus commissions by upselling on website customer orders today'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setQuotaCardTab('other')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    quotaCardTab === 'other'
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Other Sources
                </button>
                <button
                  type="button"
                  onClick={() => setQuotaCardTab('website')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    quotaCardTab === 'website'
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Website
                </button>
              </div>

              <button
                onClick={() => {
                  setTiersModalTab(quotaCardTab);
                  setShowTiersModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Award className="w-3.5 h-3.5 text-emerald-600" />
                <span>View Rules</span>
              </button>
            </div>
          </div>

          {quotaCardTab === 'other' ? (
            /* Other Sources Quota Metrics */
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
              {/* Metric 1: Today's Non-Website Sales */}
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Today's Non-Website Sales
                </span>
                <div className="text-2xl font-extrabold text-slate-900 font-mono mt-1">
                  {formatCurrency(todayOtherSales)}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Across phone, whatsapp & manual orders
                </p>
              </div>

              {/* Metric 2: Current Unlocked Tier */}
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Current Unlocked Bonus
                </span>
                <div className="mt-1 flex items-center gap-2">
                  {unlockedOtherTier ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 font-bold text-xs">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>+{formatCurrency(unlockedOtherTier.bonus)} bonus ({unlockedOtherTier.name})</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-xl bg-slate-100 text-slate-600 font-medium text-xs">
                      No milestone reached yet
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {unlockedOtherTier
                    ? `Earned for reaching ৳${unlockedOtherTier.min_quota.toLocaleString()} sales today`
                    : 'Reach ৳20,000 in sales to unlock ৳200 bonus'}
                </p>
              </div>

              {/* Metric 3: Next Milestone Target */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-500 uppercase tracking-wider">
                    Next Milestone Target
                  </span>
                  <span className="font-bold text-slate-700 font-mono">
                    {nextOtherTier
                      ? `৳${Math.max(0, nextOtherTier.min_quota - todayOtherSales).toLocaleString()} needed`
                      : 'Max ৳2,000 Bonus Unlocked!'}
                  </span>
                </div>
                {/* Progress Bar */}
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200/60 mt-1.5">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${otherQuotaProgress}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {nextOtherTier
                    ? `Reach ৳${nextOtherTier.min_quota.toLocaleString()} to unlock +${formatCurrency(nextOtherTier.bonus)} bonus`
                    : 'Congratulations! You reached the ৳50,000+ top tier bonus today!'}
                </p>
              </div>
            </div>
          ) : (
            /* Website Quota Metrics */
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
              {/* Metric 1: Today's Website Upsell Extra Sales */}
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Today's Extra Sales (Website)
                </span>
                <div className="text-2xl font-extrabold text-slate-900 font-mono mt-1">
                  {formatCurrency(todayWebsiteUpsells)}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Cumulative upsells on website orders
                </p>
              </div>

              {/* Metric 2: Current Unlocked Tier */}
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Current Unlocked Tier
                </span>
                <div className="mt-1 flex items-center gap-2">
                  {unlockedWebsiteTier ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-xs">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{unlockedWebsiteTier.name} (+{formatCurrency(unlockedWebsiteTier.bonus)} bonus)</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-xl bg-slate-100 text-slate-600 font-medium text-xs">
                      No milestone reached yet
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {unlockedWebsiteTier
                    ? `Earned for reaching ৳${unlockedWebsiteTier.min_quota.toLocaleString()} extra sales`
                    : 'Reach minimum quota to unlock Tier 1'}
                </p>
              </div>

              {/* Metric 3: Next Milestone Target */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-500 uppercase tracking-wider">
                    Next Milestone
                  </span>
                  <span className="font-bold text-slate-700 font-mono">
                    {nextWebsiteTier
                      ? `৳${Math.max(0, nextWebsiteTier.min_quota - todayWebsiteUpsells).toLocaleString()} needed`
                      : 'Max Tier Unlocked!'}
                  </span>
                </div>
                {/* Progress Bar */}
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200/60 mt-1.5">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${websiteQuotaProgress}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {nextWebsiteTier
                    ? `Reach ৳${nextWebsiteTier.min_quota.toLocaleString()} to unlock ${nextWebsiteTier.name} (+${formatCurrency(nextWebsiteTier.bonus)} bonus)`
                    : 'You have unlocked the highest quota tier for today!'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Visual Monthly Performance Graph */}
        <StaffPerformanceGraph
          staffName={currentProfile?.full_name || 'My Performance'}
          dailyStats={performanceGraphData}
          selectedYear={graphYear}
          selectedMonth={graphMonth}
          onYearChange={setGraphYear}
          onMonthChange={setGraphMonth}
        />

        {/* Primary Action Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-slate-900 capitalize">
              {activeTab === 'orders' && 'Customer Orders'}
              {activeTab === 'inventory' && 'Live Stock Lookup'}
              {activeTab === 'rewards' && 'My Upsell Commissions'}
              {activeTab === 'payouts' && 'Payout History & Receipts'}
            </h2>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-sm transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create New Order</span>
          </button>
        </div>

        {/* TAB 1: ORDERS */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-white border border-slate-200/80 p-3.5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search customer, phone, order #..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="not_reachable">Not Reachable</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="ready_to_ship">Ready to Ship</option>
                  <option value="on_the_way">On the Way</option>
                  <option value="delivered">Delivered</option>
                  <option value="canceled">Canceled</option>
                </select>
              </div>
            </div>

            {/* Orders Table */}
            <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50/80 border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="p-4">Order ID & Source</th>
                      <th className="p-4">Customer Details</th>
                      <th className="p-4">Items / Total</th>
                      <th className="p-4">Assigned Staff</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingOrders ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400">
                          Loading orders...
                        </td>
                      </tr>
                    ) : filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400">
                          No orders recorded yet.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((order) => {
                        const isMyOrder = order.sales_rep_id === currentProfile?.id;
                        const isOtherStaffOrder = Boolean(order.sales_rep_id && order.sales_rep_id !== currentProfile?.id);
                        const hasUpsell = order.order_items?.some((i) => i.is_upsell);
                        const hasReachout = Boolean(
                          (order as any).is_reachout ||
                          order.note?.toLowerCase().includes('reachout') ||
                          order.order_items?.some((i: any) => i.is_reachout) ||
                          (Array.isArray((order as any).original_items) && (order as any).original_items.some((i: any) => i.is_reachout))
                        );
                        const statusBadge = getCleanStatusBadge(order.status);

                        return (
                          <tr
                            key={order.id}
                            className={`hover:bg-slate-50/70 transition-colors ${
                              isMyOrder ? 'bg-emerald-50/20' : ''
                            }`}
                          >
                            <td className="p-4">
                              <div className="font-mono font-bold text-slate-900">
                                {order.order_number}
                              </div>
                              <div className="flex items-center gap-1.5 mt-1">
                                {order.source === 'whatsapp' && <WhatsAppFlatIcon className="w-4 h-4" />}
                                {order.source === 'messenger' && <MessengerFlatIcon className="w-4 h-4" />}
                                {order.source === 'phone' && <PhoneCallFlatIcon className="w-4 h-4" />}
                                {order.source === 'manual' && <WalkInFlatIcon className="w-4 h-4" />}
                                <span className="text-xs text-slate-500 font-medium capitalize">
                                  {order.source}
                                </span>
                                <span className="text-slate-300">&middot;</span>
                                <span className="text-[11px] text-slate-400">
                                  {formatDate(order.created_at)}
                                </span>
                              </div>
                            </td>

                            <td className="p-4">
                              <div className="font-semibold text-slate-900">
                                {order.customer_name}
                              </div>
                              <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3 text-slate-400" />
                                {order.customer_phone}
                              </div>
                            </td>

                            <td className="p-4">
                              <div className="font-semibold text-slate-900 font-mono">
                                {formatCurrency(order.total_amount)}
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                <span>{order.order_items?.length || 0} items</span>
                                {hasUpsell && (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200/80 font-bold text-[10px]">
                                    Upsell
                                  </span>
                                )}
                                {hasReachout && (
                                  <span className="px-1.5 py-0.2 rounded bg-sky-50 text-sky-800 border border-sky-200/80 font-bold text-[10px]">
                                    Reachout
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="p-4">
                              {isMyOrder ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/70 text-xs font-semibold">
                                  Assigned to You
                                </span>
                              ) : order.sales_rep_id ? (
                                <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-medium">
                                  <span>Other Staff</span>
                                  <Lock className="w-3 h-3 text-slate-400" />
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">Unassigned</span>
                              )}
                            </td>

                            <td className="p-4">
                              {isOtherStaffOrder ? (
                                <span
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-50 text-slate-500 border border-slate-200/80 shadow-2xs"
                                  title="Assigned to another staff member. Only they or an administrator can update status."
                                >
                                  <span className={`w-2 h-2 rounded-full ${statusBadge.dot}`} />
                                  <span>{statusBadge.label}</span>
                                  <Lock className="w-3 h-3 text-slate-400 ml-0.5" />
                                </span>
                              ) : order.status === 'pending' || order.status === 'not_reachable' ? (
                                <div className="relative inline-block">
                                  <select
                                    value={order.status}
                                    onChange={(e) =>
                                      handleStatusChange(order.id, e.target.value as OrderStatus)
                                    }
                                    className="text-xs font-semibold pl-6 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer shadow-2xs"
                                  >
                                    <option value="pending">Pending</option>
                                    <option value="not_reachable">Not Reachable</option>
                                    <option value="confirmed">Confirm Order</option>
                                  </select>
                                  <span
                                    className={`w-2 h-2 rounded-full absolute left-2.5 top-1/2 -translate-y-1/2 ${statusBadge.dot}`}
                                  />
                                </div>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200/80 shadow-2xs"
                                  title="Confirmed orders are locked for sales staff. Contact an admin to adjust status."
                                >
                                  <span className={`w-2 h-2 rounded-full ${statusBadge.dot}`} />
                                  <span>{statusBadge.label}</span>
                                  <Lock className="w-3 h-3 text-slate-400 ml-0.5" />
                                </span>
                              )}
                            </td>

                            <td className="p-4 text-right">
                              <button
                                onClick={() => setEditingOrderForItems(order)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                                title={isOtherStaffOrder ? 'Assigned to another staff member (Read-only)' : 'Edit items & view history'}
                              >
                                <PackageOpen className="w-3.5 h-3.5 text-slate-600" />
                                <span>{isOtherStaffOrder ? 'View & History' : 'Edit & History'}</span>
                                {isOtherStaffOrder && <Lock className="w-3 h-3 text-slate-400" />}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: INVENTORY */}
        {activeTab === 'inventory' && (
          <div className="space-y-4">
            <div className="relative w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search products in stock..."
                value={inventorySearch}
                onChange={(e) => setInventorySearch(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs"
              />
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50/80 border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="p-4">Product & Variant</th>
                      <th className="p-4">SKU</th>
                      <th className="p-4">Price</th>
                      <th className="p-4 text-right">Live Stock Available</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingInventory ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-slate-400">
                          Loading inventory...
                        </td>
                      </tr>
                    ) : filteredVariants.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-slate-400">
                          No matching inventory items found.
                        </td>
                      </tr>
                    ) : (
                      filteredVariants.map((v) => (
                        <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-4">
                            <div className="font-semibold text-slate-900">
                              {(v.product as any)?.name || (v.product as any)?.title || 'Product'}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              Variant: {v.title}
                            </div>
                          </td>
                          <td className="p-4 font-mono text-xs text-slate-500">{v.sku}</td>
                          <td className="p-4 font-semibold text-slate-900 font-mono">
                            {formatCurrency(v.price)}
                          </td>
                          <td className="p-4 text-right">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                                v.stock_quantity === 0
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : v.stock_quantity <= 5
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              {v.stock_quantity} available
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: COMMISSIONS & REWARDS */}
        {activeTab === 'rewards' && (
          <div className="space-y-6">
            {/* Real-time Today's Bonus Progress Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: Daily Sales Bonus (Other Sources) */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center">
                      <ShoppingBag className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">
                        Daily Sales Bonus (Other Sources)
                      </h4>
                      <p className="text-[11px] text-slate-400">Phone, WhatsApp, Manual Orders</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    Resets 12 AM
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Today's Sales
                    </span>
                    <div className="text-xl font-extrabold text-slate-900 font-mono mt-0.5">
                      {formatCurrency(todayOtherSales)}
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Bonus Unlocked
                    </span>
                    <div className="text-xl font-extrabold text-amber-600 font-mono mt-0.5">
                      {unlockedOtherTier ? `+${formatCurrency(unlockedOtherTier.bonus)}` : '৳0'}
                    </div>
                  </div>
                </div>

                <div className="pt-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                    <span>
                      {nextOtherTier
                        ? `Next Tier: ${nextOtherTier.name} (+${formatCurrency(nextOtherTier.bonus)})`
                        : 'Top Tier Reached (৳2,000)'}
                    </span>
                    <span className="font-mono font-bold text-slate-700">
                      {nextOtherTier
                        ? `৳${Math.max(0, nextOtherTier.min_quota - todayOtherSales).toLocaleString()} away`
                        : 'Max Achieved'}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${otherQuotaProgress}%` }}
                    />
                  </div>
                </div>

                {/* Quick Tier Milestones Badges */}
                <div className="pt-3 flex flex-wrap gap-1.5 border-t border-slate-100 mt-3">
                  {otherActiveTiers.map((tier) => {
                    const isReached = todayOtherSales >= tier.min_quota;
                    return (
                      <span
                        key={tier.id}
                        className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-semibold border ${
                          isReached
                            ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
                            : 'bg-slate-50 text-slate-400 border-slate-200'
                        }`}
                        title={`Target: ৳${tier.min_quota.toLocaleString()} -> Bonus: ৳${tier.bonus.toLocaleString()}`}
                      >
                        ৳{tier.min_quota / 1000}k : ৳{tier.bonus}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Card 2: Website Upsell Quota */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center">
                      <WebsiteFlatIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">
                        Website Upsell Quota (Daily)
                      </h4>
                      <p className="text-[11px] text-slate-400">Added Upsell Items on Website Orders</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Resets 12 AM
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Extra Sales Today
                    </span>
                    <div className="text-xl font-extrabold text-slate-900 font-mono mt-0.5">
                      {formatCurrency(todayWebsiteUpsells)}
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Bonus Unlocked
                    </span>
                    <div className="text-xl font-extrabold text-emerald-600 font-mono mt-0.5">
                      {unlockedWebsiteTier ? `+${formatCurrency(unlockedWebsiteTier.bonus)}` : '৳0'}
                    </div>
                  </div>
                </div>

                <div className="pt-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                    <span>
                      {nextWebsiteTier
                        ? `Next Tier: ${nextWebsiteTier.name} (+${formatCurrency(nextWebsiteTier.bonus)})`
                        : 'Highest Tier Unlocked'}
                    </span>
                    <span className="font-mono font-bold text-slate-700">
                      {nextWebsiteTier
                        ? `৳${Math.max(0, nextWebsiteTier.min_quota - todayWebsiteUpsells).toLocaleString()} away`
                        : 'Max Achieved'}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${websiteQuotaProgress}%` }}
                    />
                  </div>
                </div>

                {/* Quick Website Quota Badges */}
                <div className="pt-3 flex flex-wrap gap-1.5 border-t border-slate-100 mt-3">
                  {websiteActiveTiers.map((tier) => {
                    const isReached = todayWebsiteUpsells >= tier.min_quota;
                    return (
                      <span
                        key={tier.id}
                        className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-semibold border ${
                          isReached
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold'
                            : 'bg-slate-50 text-slate-400 border-slate-200'
                        }`}
                        title={`Target: ৳${tier.min_quota.toLocaleString()} -> Bonus: ৳${tier.bonus.toLocaleString()}`}
                      >
                        ৳{tier.min_quota / 1000}k : ৳{tier.bonus}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Commissions & Bonus History Ledger */}
            <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                    <Award className="w-4 h-4 text-emerald-600" />
                    <span>Commissions & Bonus History</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Itemized record of daily sales bonuses and website upsell commissions earned
                  </p>
                </div>
                <button
                  onClick={() => {
                    setTiersModalTab('other');
                    setShowTiersModal(true);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  View Full Rules
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50/80 border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="p-4">Type & Order / Milestone</th>
                      <th className="p-4">Commission Amount</th>
                      <th className="p-4">Earned Date</th>
                      <th className="p-4 text-right">Payout Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingRewards ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-slate-400">
                          Loading rewards...
                        </td>
                      </tr>
                    ) : rewards.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-slate-400">
                          No rewards earned yet. Hit daily sales targets or upsell products to earn bonuses!
                        </td>
                      </tr>
                    ) : (
                      rewards.map((reward) => {
                        const isDailyBonus = reward.note?.toLowerCase().includes('daily sales');
                        return (
                          <tr key={reward.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-slate-900">
                                  {(reward.order as any)?.order_number || (isDailyBonus ? 'Daily Sales Target' : 'Order')}
                                </span>
                                {isDailyBonus ? (
                                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 font-bold text-[10px]">
                                    Daily Bonus
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200 font-bold text-[10px]">
                                    Upsell
                                  </span>
                                )}
                              </div>
                              {reward.note && (
                                <div className="text-xs text-slate-600 font-medium mt-1 flex items-center gap-1">
                                  <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                                  <span className="truncate">{reward.note}</span>
                                </div>
                              )}
                            </td>
                            <td className="p-4 font-bold text-emerald-700 font-mono text-base">
                              {formatCurrency(reward.bonus_amount)}
                            </td>
                            <td className="p-4 text-xs text-slate-500">
                              {formatDate(reward.created_at)}
                            </td>
                            <td className="p-4 text-right">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                                  reward.status === 'paid'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : reward.status === 'approved'
                                    ? 'bg-blue-50 text-blue-800 border-blue-200'
                                    : 'bg-amber-50 text-amber-800 border-amber-200'
                                }`}
                              >
                                {reward.status.toUpperCase()}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PAYOUTS & RECEIPTS */}
        {activeTab === 'payouts' && (
          <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <span>Withdrawal Requests & Admin Payment Receipts</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Track payout request approvals and view uploaded payment proof screenshots
                </p>
              </div>

              <button
                disabled={availablePiggybank <= 0}
                onClick={() => {
                  setPayoutAmount(availablePiggybank.toString());
                  setIsPayoutModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs shadow-xs transition-all"
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>New Payout Request</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50/80 border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Method & Account</th>
                    <th className="p-4">Requested Date</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Admin Receipt Proof</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingPayouts ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400">
                        Loading payout requests...
                      </td>
                    </tr>
                  ) : myPayouts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400">
                        No payout requests submitted yet.
                      </td>
                    </tr>
                  ) : (
                    myPayouts.map((payout) => (
                      <tr key={payout.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-4 font-bold text-slate-900 font-mono text-base">
                          {formatCurrency(payout.amount)}
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-slate-800 capitalize">
                            {payout.payment_method}
                          </div>
                          <div className="font-mono text-xs text-slate-500 mt-0.5">
                            {payout.account_number}
                          </div>
                        </td>
                        <td className="p-4 text-xs text-slate-500">
                          {formatDate(payout.created_at)}
                        </td>
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                              payout.status === 'approved'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : payout.status === 'rejected'
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {payout.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-4">
                          {payout.admin_screenshot_url ? (
                            <button
                              onClick={() =>
                                setLightboxScreenshot({
                                  url: payout.admin_screenshot_url!,
                                  title: `Payment Proof: ${formatCurrency(payout.amount)} to ${payout.account_number}`,
                                })
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors"
                            >
                              <ImageIcon className="w-3.5 h-3.5 text-slate-600" />
                              <span>View Receipt</span>
                            </button>
                          ) : payout.status === 'approved' ? (
                            <span className="text-xs text-slate-400">Paid (no screenshot)</span>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Pending payment</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* REQUEST PAYOUT MODAL */}
      {isPayoutModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs animate-in fade-in p-2.5 sm:p-4">
          <div className="min-h-full flex items-center justify-center py-4 sm:py-8">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative my-auto">
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  <span>Request Commission Payout</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsPayoutModalOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitPayoutRequest} className="p-4 sm:p-5 space-y-4">
                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
                  <span className="text-xs text-slate-600 font-medium">Available to Withdraw:</span>
                  <span className="font-bold font-mono text-emerald-700 text-base">
                    {formatCurrency(availablePiggybank)}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Withdrawal Amount (BDT) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={availablePiggybank}
                    step="any"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payment Method *
                  </label>
                  <select
                    value={payoutMethod}
                    onChange={(e) => setPayoutMethod(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="bKash">bKash (Personal)</option>
                    <option value="Nagad">Nagad (Personal)</option>
                    <option value="Rocket">Rocket (Personal)</option>
                    <option value="Bank">Bank Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Account Number / Details *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 017XXXXXXXX"
                    value={payoutAccount}
                    onChange={(e) => setPayoutAccount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Note to Admin (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Payout for this week"
                    value={payoutNote}
                    onChange={(e) => setPayoutNote(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div className="pt-3 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsPayoutModalOpen(false)}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-colors text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingPayout}
                    className="w-full sm:w-auto px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-xs transition-all disabled:opacity-50 text-center"
                  >
                    {submittingPayout ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* CREATE ORDER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs animate-in fade-in p-2.5 sm:p-4">
          <div className="min-h-full flex items-center justify-center py-4 sm:py-8">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl relative my-auto">
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Create New Order
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Enter customer information, attribution & select items
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitOrder} className="p-4 sm:p-5 space-y-4">
                {/* ORDER SOURCE */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Order Source
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                    <button
                      type="button"
                      onClick={() => setSource('whatsapp')}
                      className={`flex items-center sm:flex-col justify-center gap-2 sm:gap-1 p-2 sm:p-2.5 rounded-xl border transition-all ${
                        source === 'whatsapp'
                          ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/10'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <WhatsAppFlatIcon className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                      <span className={`text-xs sm:text-[11px] font-semibold ${
                        source === 'whatsapp' ? 'text-emerald-800' : 'text-slate-600'
                      }`}>
                        WhatsApp
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSource('messenger')}
                      className={`flex items-center sm:flex-col justify-center gap-2 sm:gap-1 p-2 sm:p-2.5 rounded-xl border transition-all ${
                        source === 'messenger'
                          ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/10'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <MessengerFlatIcon className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                      <span className={`text-xs sm:text-[11px] font-semibold ${
                        source === 'messenger' ? 'text-blue-800' : 'text-slate-600'
                      }`}>
                        Messenger
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSource('phone')}
                      className={`flex items-center sm:flex-col justify-center gap-2 sm:gap-1 p-2 sm:p-2.5 rounded-xl border transition-all ${
                        source === 'phone'
                          ? 'border-amber-500 bg-amber-50/60 ring-2 ring-amber-500/10'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <PhoneCallFlatIcon className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                      <span className={`text-xs sm:text-[11px] font-semibold ${
                        source === 'phone' ? 'text-amber-800' : 'text-slate-600'
                      }`}>
                        Phone Call
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSource('manual')}
                      className={`flex items-center sm:flex-col justify-center gap-2 sm:gap-1 p-2 sm:p-2.5 rounded-xl border transition-all ${
                        source === 'manual'
                          ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-500/10'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <WalkInFlatIcon className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                      <span className={`text-xs sm:text-[11px] font-semibold ${
                        source === 'manual' ? 'text-indigo-800' : 'text-slate-600'
                      }`}>
                        Walk-in
                      </span>
                    </button>
                  </div>
                </div>

                {/* Customer Full Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Customer Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Shahajadi Farjana"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                {/* Customer Phone Number */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Customer Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 01726640689"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                {/* Full Delivery Address */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Delivery Address *
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="House #, Road #, Area, City (e.g. 264/6, Block C, Banasree, Dhaka)"
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
                  />
                </div>

                {/* ADD PRODUCTS TO ORDER */}
                <div className="p-3.5 sm:p-4 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Add Products to Order
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 tracking-wide uppercase">
                      Live Stock Protected
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-[11px] text-slate-500 font-medium mb-1">
                        Select Product / Variant
                      </label>
                      <ModernProductSelect
                        variants={variants}
                        selectedVariantId={selectedVariantId}
                        onSelect={(variantId) => setSelectedVariantId(variantId)}
                      />
                    </div>

                    <div className="flex flex-wrap sm:flex-nowrap items-end gap-2.5 sm:gap-3">
                      <div className="w-24 sm:w-28 shrink-0">
                        <label className="block text-[11px] text-slate-500 font-medium mb-1">Quantity</label>
                        <input
                          type="number"
                          min="1"
                          value={itemQuantity}
                          onChange={(e) => setItemQuantity(parseInt(e.target.value) || 1)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      <div className="flex-1 min-w-[140px]">
                        <label className="flex items-center justify-center gap-2 text-xs text-amber-800 font-semibold cursor-pointer select-none bg-amber-50 border border-amber-200/80 px-3 py-2 rounded-xl hover:bg-amber-100/70 transition-colors h-[38px]">
                          <input
                            type="checkbox"
                            checked={isReachoutItem}
                            onChange={(e) => setIsReachoutItem(e.target.checked)}
                            className="rounded border-amber-300 text-amber-600 focus:ring-amber-500 w-4 h-4"
                          />
                          <span>Reachout sell?</span>
                        </label>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Add Item</span>
                    </button>
                  </div>

                  {/* Items List */}
                  {orderItems.length > 0 ? (
                    <div className="divide-y divide-slate-200/80 pt-2">
                      {orderItems.map((item, idx) => (
                        <div key={idx} className="py-2.5 flex items-center justify-between text-xs gap-2">
                          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                            <span className="font-semibold text-slate-900 truncate max-w-[130px] sm:max-w-xs">{item.title}</span>
                            {item.variant_title && (
                              <span className="text-slate-500 text-[11px]">({item.variant_title})</span>
                            )}
                            <span className="text-emerald-700 font-mono font-bold">x{item.quantity}</span>
                            {item.is_reachout && (
                              <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 font-bold text-[9px]">
                                Reachout
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                            <span className="font-mono font-bold text-slate-900">
                              {formatCurrency(item.price * item.quantity)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}

                      <div className="pt-3 border-t border-slate-200/80 space-y-1.5 text-xs">
                        <div className="flex justify-between text-slate-500">
                          <span>Items Subtotal:</span>
                          <span className="font-mono font-bold text-slate-800">
                            {formatCurrency(itemsSubtotal)}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-500">
                          <span>Delivery Charge:</span>
                          <span className="font-mono font-bold text-slate-800">
                            {deliveryCharge === 0 ? (
                              <span className="text-emerald-700 font-bold">FREE (৳0)</span>
                            ) : (
                              formatCurrency(deliveryCharge)
                            )}
                          </span>
                        </div>
                        <div className="pt-2 border-t border-dashed border-slate-200 flex justify-between font-bold text-sm text-slate-900">
                          <span>Grand Total:</span>
                          <span className="font-mono text-emerald-700 text-base">
                            {formatCurrency(totalOrderAmount)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-xs text-slate-400 italic pt-1">
                      No items added yet. Pick an item above to add to cart.
                    </p>
                  )}
                </div>

                {/* Delivery Charge Selection: 3 Dynamic Responsive Cards */}
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-0.5 sm:gap-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Delivery Option
                    </label>
                    <span className="text-[11px] text-slate-400 font-medium">
                      Choose zone or offer customer free delivery
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
                    {/* 1. Inside Dhaka: 80tk */}
                    <button
                      type="button"
                      onClick={() => setDeliveryType('inside_dhaka')}
                      className={`p-3 rounded-xl sm:rounded-2xl border text-left transition-all cursor-pointer relative ${
                        deliveryType === 'inside_dhaka'
                          ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20 text-emerald-950 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className="flex sm:flex-col justify-between sm:justify-start items-center sm:items-start gap-1">
                        <div className="flex items-center gap-2 sm:w-full sm:justify-between">
                          <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border shrink-0 transition-all ${
                            deliveryType === 'inside_dhaka'
                              ? 'border-emerald-600 bg-emerald-600'
                              : 'border-slate-300 bg-white'
                          }`}>
                            {deliveryType === 'inside_dhaka' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <span className="text-xs font-bold text-slate-900">Inside Dhaka</span>
                        </div>
                        <div className="text-right sm:text-left sm:mt-1">
                          <div className="text-sm sm:text-base font-black font-mono text-slate-900">৳80</div>
                          <p className="text-[10px] text-slate-500 leading-tight">Dhaka metro delivery</p>
                        </div>
                      </div>
                    </button>

                    {/* 2. Outside Dhaka: 130tk */}
                    <button
                      type="button"
                      onClick={() => setDeliveryType('outside_dhaka')}
                      className={`p-3 rounded-xl sm:rounded-2xl border text-left transition-all cursor-pointer relative ${
                        deliveryType === 'outside_dhaka'
                          ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20 text-emerald-950 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className="flex sm:flex-col justify-between sm:justify-start items-center sm:items-start gap-1">
                        <div className="flex items-center gap-2 sm:w-full sm:justify-between">
                          <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border shrink-0 transition-all ${
                            deliveryType === 'outside_dhaka'
                              ? 'border-emerald-600 bg-emerald-600'
                              : 'border-slate-300 bg-white'
                          }`}>
                            {deliveryType === 'outside_dhaka' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <span className="text-xs font-bold text-slate-900">Outside Dhaka</span>
                        </div>
                        <div className="text-right sm:text-left sm:mt-1">
                          <div className="text-sm sm:text-base font-black font-mono text-slate-900">৳130</div>
                          <p className="text-[10px] text-slate-500 leading-tight">Nationwide delivery</p>
                        </div>
                      </div>
                    </button>

                    {/* 3. Free Delivery: 0tk */}
                    <button
                      type="button"
                      onClick={() => setDeliveryType('free')}
                      className={`p-3 rounded-xl sm:rounded-2xl border text-left transition-all cursor-pointer relative ${
                        deliveryType === 'free'
                          ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20 text-emerald-950 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className="flex sm:flex-col justify-between sm:justify-start items-center sm:items-start gap-1">
                        <div className="flex items-center gap-2 sm:w-full sm:justify-between">
                          <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border shrink-0 transition-all ${
                            deliveryType === 'free'
                              ? 'border-emerald-600 bg-emerald-600'
                              : 'border-slate-300 bg-white'
                          }`}>
                            {deliveryType === 'free' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <span className="text-xs font-bold text-emerald-700">Free Delivery</span>
                        </div>
                        <div className="text-right sm:text-left sm:mt-1">
                          <div className="text-sm sm:text-base font-black font-mono text-emerald-700">৳0 FREE</div>
                          <p className="text-[10px] text-emerald-600 font-medium leading-tight">Staff special offer</p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Salesperson Coupon Code */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Salesperson Coupon Code (For Commission)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. NUR10"
                    value={couponUsed}
                    onChange={(e) => setCouponUsed(e.target.value.toUpperCase())}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 uppercase font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="Cash on Delivery (COD)">Cash on Delivery (COD)</option>
                    <option value="bKash (Prepaid)">bKash (Prepaid)</option>
                    <option value="Nagad (Prepaid)">Nagad (Prepaid)</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>

                {/* Order Notes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Order Notes (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Customer requested evening delivery"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div className="pt-3 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-colors text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingOrder}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-xs transition-all disabled:opacity-50 text-center"
                  >
                    {submittingOrder ? 'Placing Order...' : 'Confirm & Create Order'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* EDIT ORDER ITEMS MODAL (TIMELINE & ORIGINAL ORDER AT BOTTOM) */}
      {editingOrderForItems && (
        <EditOrderItemsModal
          order={editingOrderForItems}
          isOpen={true}
          onClose={() => setEditingOrderForItems(null)}
          onUpdated={() => {
            setEditingOrderForItems(null);
            fetchOrders();
            fetchRewards();
          }}
        />
      )}

      {/* RECEIPT SCREENSHOT LIGHTBOX */}
      {lightboxScreenshot && (
        <ScreenshotLightboxModal
          imageUrl={lightboxScreenshot.url}
          title={lightboxScreenshot.title}
          isOpen={true}
          onClose={() => setLightboxScreenshot(null)}
        />
      )}

      {/* QUOTA & BONUS MILESTONES MODAL */}
      {showTiersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center shrink-0">
                  {tiersModalTab === 'other' ? (
                    <ShoppingBag className="w-5 h-5 text-amber-600" />
                  ) : (
                    <WebsiteFlatIcon className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    {tiersModalTab === 'other'
                      ? 'Daily Sales Bonus Rules (Other Sources)'
                      : 'Website Upsell Quota Rules'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {tiersModalTab === 'other'
                      ? 'Cash bonuses earned on phone, social media & manual orders (resets daily at 12:00 AM)'
                      : 'Extra sales commission rates for website orders (resets daily at 12:00 AM)'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTiersModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scope Selector */}
            <div className="px-5 pt-4 pb-2 border-b border-slate-100 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTiersModalTab('other')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                  tiersModalTab === 'other'
                    ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Other Sources (Daily Sales Target)
              </button>
              <button
                type="button"
                onClick={() => setTiersModalTab('website')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                  tiersModalTab === 'website'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Website Only (Upsell Quota)
              </button>
            </div>

            <div className="p-5">
              {tiersModalTab === 'other' ? (
                <>
                  <div className="mb-4 bg-amber-50/60 border border-amber-200/60 rounded-xl p-3.5 flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-950">
                      <span className="font-bold">How it works:</span> Reaching cumulative daily sales targets across all your non-website customer orders (WhatsApp, Phone, Manual) automatically unlocks the milestone cash bonus into your wallet.
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                    <table className="w-full text-left text-sm text-slate-700">
                      <thead className="bg-slate-50 border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <tr>
                          <th className="p-3">Milestone Tier</th>
                          <th className="p-3">Daily Sales Required</th>
                          <th className="p-3">Bonus Earned</th>
                          <th className="p-3">Effective %</th>
                          <th className="p-3 text-right">Your Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {otherActiveTiers.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-6 text-center text-xs text-slate-400">
                              No active other source tiers configured.
                            </td>
                          </tr>
                        ) : (
                          otherActiveTiers.map((tier) => {
                            const isUnlocked = todayOtherSales >= tier.min_quota;
                            const isCurrentHighest = unlockedOtherTier?.id === tier.id;
                            const effectiveRate = tier.min_quota > 0 ? ((tier.bonus / tier.min_quota) * 100).toFixed(1) : '0';
                            const deficit = tier.min_quota - todayOtherSales;

                            return (
                              <tr
                                key={tier.id}
                                className={`transition-colors ${
                                  isCurrentHighest
                                    ? 'bg-amber-50/60 font-semibold'
                                    : isUnlocked
                                    ? 'bg-slate-50/40 text-slate-600'
                                    : 'hover:bg-slate-50/60'
                                }`}
                              >
                                <td className="p-3">
                                  <span className="font-bold text-slate-900">{tier.name}</span>
                                </td>
                                <td className="p-3 font-mono font-semibold text-slate-900">
                                  {formatCurrency(tier.min_quota)}
                                </td>
                                <td className="p-3 font-mono font-bold text-amber-700">
                                  +{formatCurrency(tier.bonus)}
                                </td>
                                <td className="p-3 font-mono text-xs text-slate-500">
                                  {effectiveRate}%
                                </td>
                                <td className="p-3 text-right">
                                  {isUnlocked ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Unlocked
                                    </span>
                                  ) : (
                                    <span className="text-xs text-slate-400 font-mono">
                                      ৳{deficit.toLocaleString()} away
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-4 bg-emerald-50/60 border border-emerald-200/60 rounded-xl p-3.5 flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-emerald-900">
                      <span className="font-bold">How it works:</span> When you upsell on website orders, your extra sales value accumulates across all website orders today. Crossing each quota milestone unlocks that tier's cash bonus in your earnings.
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                    <table className="w-full text-left text-sm text-slate-700">
                      <thead className="bg-slate-50 border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <tr>
                          <th className="p-3">Milestone Tier</th>
                          <th className="p-3">Extra Sales Required</th>
                          <th className="p-3">Bonus Earned</th>
                          <th className="p-3">Effective %</th>
                          <th className="p-3 text-right">Your Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {websiteActiveTiers.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-6 text-center text-xs text-slate-400">
                              No active website quota milestones configured.
                            </td>
                          </tr>
                        ) : (
                          websiteActiveTiers.map((tier) => {
                            const isUnlocked = todayWebsiteUpsells >= tier.min_quota;
                            const isCurrentHighest = unlockedWebsiteTier?.id === tier.id;
                            const effectiveRate = tier.min_quota > 0 ? ((tier.bonus / tier.min_quota) * 100).toFixed(1) : '0';
                            const deficit = tier.min_quota - todayWebsiteUpsells;

                            return (
                              <tr
                                key={tier.id}
                                className={`transition-colors ${
                                  isCurrentHighest
                                    ? 'bg-emerald-50/50 font-semibold'
                                    : isUnlocked
                                    ? 'bg-slate-50/40 text-slate-600'
                                    : 'hover:bg-slate-50/60'
                                }`}
                              >
                                <td className="p-3">
                                  <span className="font-bold text-slate-900">{tier.name}</span>
                                </td>
                                <td className="p-3 font-mono font-semibold text-slate-900">
                                  {formatCurrency(tier.min_quota)}
                                </td>
                                <td className="p-3 font-mono font-bold text-emerald-700">
                                  +{formatCurrency(tier.bonus)}
                                </td>
                                <td className="p-3 font-mono text-xs text-slate-500">
                                  {effectiveRate}%
                                </td>
                                <td className="p-3 text-right">
                                  {isUnlocked ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Unlocked
                                    </span>
                                  ) : (
                                    <span className="text-xs text-slate-400 font-mono">
                                      ৳{deficit.toLocaleString()} away
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {tiersModalTab === 'other' ? (
                  <>Today's Non-Website Sales: <strong className="text-slate-900 font-mono">{formatCurrency(todayOtherSales)}</strong></>
                ) : (
                  <>Today's Website Extra Sales: <strong className="text-slate-900 font-mono">{formatCurrency(todayWebsiteUpsells)}</strong></>
                )}
              </span>
              <button
                type="button"
                onClick={() => setShowTiersModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
