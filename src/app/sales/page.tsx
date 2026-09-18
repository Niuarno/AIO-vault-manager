'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/Navbar';
import confetti from 'canvas-confetti';
import {
  ShoppingBag,
  PlusCircle,
  Boxes,
  Award,
  Sparkles,
  Phone,
  MessageSquare,
  MessageCircle,
  Store,
  CheckCircle2,
  Clock,
  X,
  Search,
  Tag,
  TrendingUp,
  PackageOpen,
  History,
  DollarSign,
  CreditCard,
  Image as ImageIcon,
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
  Plus,
  Minus
} from 'lucide-react';
import EditOrderItemsModal from '@/components/EditOrderItemsModal';
import StaffPerformanceGraph from '@/components/StaffPerformanceGraph';
import ScreenshotLightboxModal from '@/components/ScreenshotLightboxModal';
import {
  Order,
  ProductVariant,
  Profile,
  UpsellReward,
  OrderStatus,
  OrderSource,
  PayoutRequest,
} from '@/types/database';
import { formatCurrency, formatDate, getStatusBadgeInfo, getSourceBadge } from '@/lib/utils';

export default function SalesDashboard() {
  const supabase = createClient();

  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [activeTab, setActiveTab] = useState<'orders' | 'inventory' | 'rewards' | 'payouts'>('orders');

  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [editingOrderForItems, setEditingOrderForItems] = useState<Order | null>(null);

  // Live Inventory State
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [inventorySearch, setInventorySearch] = useState('');

  // Rewards State
  const [rewards, setRewards] = useState<UpsellReward[]>([]);
  const [loadingRewards, setLoadingRewards] = useState(false);

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
    }>
  >([]);

  // Current item being selected in modal
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [itemQuantity, setItemQuantity] = useState(1);
  const [isUpsellItem, setIsUpsellItem] = useState(false);

  // Load User Profile & Realtime Presence
  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
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

        // Track presence on online-staff channel
        const presenceChannel = supabase.channel('online-staff', {
          config: { presence: { key: user.id } },
        });

        presenceChannel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await presenceChannel.track({
              user_id: user.id,
              full_name: profile?.full_name || 'Sales Staff',
              online_at: new Date().toISOString(),
            });
          }
        });

        return () => {
          supabase.removeChannel(presenceChannel);
        };
      }
    }
    loadUser();
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

  // Fetch Live Inventory
  const fetchInventory = async () => {
    setLoadingInventory(true);
    const { data, error } = await supabase
      .from('product_variants')
      .select('*, product:products(*)')
      .order('stock_quantity', { ascending: true });

    if (!error && data) {
      setVariants(data as ProductVariant[]);
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

  // Realtime Sync (NO 12s POLLING INTERVAL)
  useEffect(() => {
    fetchOrders();
    fetchInventory();
    fetchRewards();
    fetchPayouts();

    const channel = supabase
      .channel('sales-realtime-events')
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
        is_upsell: isUpsellItem,
      },
    ]);

    // Reset picker
    setSelectedVariantId('');
    setItemQuantity(1);
    setIsUpsellItem(false);
  };

  // Remove Item
  const handleRemoveItem = (index: number) => {
    setOrderItems((prev) => prev.filter((_, i) => i !== index));
  };

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
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit order');
      }

      // Celebrate with confetti
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });

      // Reset Form & Close
      setIsModalOpen(false);
      setCustomerName('');
      setCustomerPhone('');
      setShippingAddress('');
      setNote('');
      setOrderItems([]);

      // Refresh Data
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
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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

  // Submit Payout Request
  const handleSubmitPayoutRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile) return;
    const amountNum = parseFloat(payoutAmount);
    if (!amountNum || amountNum <= 0) {
      alert('Please enter a valid payout amount.');
      return;
    }

    if (amountNum > piggybankBalance) {
      alert(`Requested amount (${amountNum} BDT) exceeds pending piggybank balance (${piggybankBalance.toFixed(2)} BDT).`);
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

  // Calculations:
  // Today's Earnings (resets at 12:00 AM midnight)
  const todayStr = new Date().toISOString().split('T')[0];
  const todayEarnings = useMemo(() => {
    return rewards
      .filter((r) => r.created_at.startsWith(todayStr))
      .reduce((sum, r) => sum + Number(r.bonus_amount || 0), 0);
  }, [rewards, todayStr]);

  // Piggybank (total pending payout)
  const piggybankBalance = useMemo(() => {
    return rewards
      .filter((r) => r.status === 'pending')
      .reduce((sum, r) => sum + Number(r.bonus_amount || 0), 0);
  }, [rewards]);

  // Settled Earnings
  const settledEarnings = useMemo(() => {
    return rewards
      .filter((r) => r.status === 'paid')
      .reduce((sum, r) => sum + Number(r.bonus_amount || 0), 0);
  }, [rewards]);

  // My Orders
  const myOrders = useMemo(() => {
    return orders.filter((o) => o.sales_rep_id === currentProfile?.id);
  }, [orders, currentProfile]);

  // Performance Graph Data (Last 7 Days)
  const performanceGraphData = useMemo(() => {
    const days: Record<string, { commission: number; ordersCount: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      days[key] = { commission: 0, ordersCount: 0 };
    }

    rewards.forEach((r) => {
      const day = r.created_at.split('T')[0];
      if (days[day]) {
        days[day].commission += Number(r.bonus_amount || 0);
      }
    });

    myOrders.forEach((o) => {
      const day = o.created_at.split('T')[0];
      if (days[day]) {
        days[day].ordersCount++;
      }
    });

    return Object.entries(days).map(([dateStr, metrics]) => {
      const d = new Date(dateStr);
      const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
      return {
        dateKey: dateStr,
        label,
        ordersCount: metrics.ordersCount,
        salesVolume: 0,
        commissionEarned: Math.round(metrics.commission),
      };
    });
  }, [rewards, myOrders]);

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200">
      <Navbar currentProfile={currentProfile} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        {/* KPI Cards: Today's Earnings & Piggybank Balance */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Today's Earnings (Resets at 12am) */}
          <div className="bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-900/40 rounded-2xl p-5 relative overflow-hidden shadow-xl shadow-black/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                Today's Earnings
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400/80 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/60">
                <Clock className="w-3 h-3" /> Resets 12:00 AM
              </span>
            </div>
            <div className="text-3xl font-extrabold text-emerald-300 mt-3 font-mono">
              {formatCurrency(todayEarnings)}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Commissions accrued today from upsell orders
            </p>
          </div>

          {/* Piggybank (Pending Payouts) with Request Payout Button */}
          <div className="bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 border border-amber-900/40 rounded-2xl p-5 relative overflow-hidden shadow-xl shadow-black/40 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                  Piggybank (Pending Payout)
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400/80 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-800/60">
                  Available
                </span>
              </div>
              <div className="text-3xl font-extrabold text-amber-300 mt-3 font-mono">
                {formatCurrency(piggybankBalance)}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-xs text-slate-400">Withdraw pending balance</span>
              <button
                disabled={piggybankBalance <= 0}
                onClick={() => {
                  setPayoutAmount(piggybankBalance.toString());
                  setIsPayoutModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold text-xs shadow-md shadow-amber-600/20 transition-all"
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Request Payout</span>
              </button>
            </div>
          </div>

          {/* Settled Earnings */}
          <div className="bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-900/40 rounded-2xl p-5 relative overflow-hidden shadow-xl shadow-black/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                Total Settled & Paid
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-400/80 bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-800/60">
                <ShieldCheck className="w-3 h-3" /> Paid Out
              </span>
            </div>
            <div className="text-3xl font-extrabold text-indigo-300 mt-3 font-mono">
              {formatCurrency(settledEarnings)}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Lifetime verified payouts received with proof
            </p>
          </div>
        </div>

        {/* Visual Performance Graph */}
        <StaffPerformanceGraph
          staffName={currentProfile?.full_name || 'My Performance'}
          dailyStats={performanceGraphData}
        />

        {/* Action Header & Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 border border-slate-800 rounded-xl overflow-x-auto max-w-full">
            <button
              onClick={() => setActiveTab('orders')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${
                activeTab === 'orders'
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Orders Queue</span>
              <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/50">
                {orders.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('inventory')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${
                activeTab === 'inventory'
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Boxes className="w-4 h-4" />
              <span>Live Stock Check</span>
            </button>

            <button
              onClick={() => setActiveTab('rewards')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${
                activeTab === 'rewards'
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Award className="w-4 h-4" />
              <span>Upsell Rewards</span>
              <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/50">
                {rewards.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('payouts')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${
                activeTab === 'payouts'
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>Payout History & Receipts</span>
              <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/50">
                {myPayouts.length}
              </span>
            </button>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/30"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create New Order</span>
          </button>
        </div>

        {/* TAB 1: ORDERS */}
        {activeTab === 'orders' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl shadow-black/40">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/70 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Order ID & Source</th>
                    <th className="p-4">Customer Details</th>
                    <th className="p-4">Items / Total</th>
                    <th className="p-4">Assigned Staff</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loadingOrders ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        Loading orders...
                      </td>
                    </tr>
                  ) : orders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        No orders recorded yet.
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => {
                      const statusBadge = getStatusBadgeInfo(order.status);
                      const sourceBadge = getSourceBadge(order.source);
                      const isMyOrder = order.sales_rep_id === currentProfile?.id;
                      const hasUpsell = order.order_items?.some((i) => i.is_upsell);

                      return (
                        <tr
                          key={order.id}
                          className={`hover:bg-slate-800/40 transition-colors ${
                            isMyOrder ? 'bg-indigo-950/20' : ''
                          }`}
                        >
                          <td className="p-4">
                            <div className="font-mono font-bold text-indigo-400">
                              {order.order_number}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded font-medium border ${sourceBadge.color}`}>
                                {sourceBadge.label}
                              </span>
                              <span className="text-xs text-slate-500">
                                {formatDate(order.created_at)}
                              </span>
                            </div>
                          </td>

                          <td className="p-4">
                            <div className="font-semibold text-slate-200">
                              {order.customer_name}
                            </div>
                            <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 text-slate-500" />
                              {order.customer_phone}
                            </div>
                          </td>

                          <td className="p-4">
                            <div className="font-semibold text-slate-100">
                              {formatCurrency(order.total_amount)}
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                              <span>{order.order_items?.length || 0} line items</span>
                              {hasUpsell && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800/60 font-semibold text-[10px]">
                                  Upsell
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="p-4">
                            {isMyOrder ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs font-bold">
                                Assigned to You
                              </span>
                            ) : (
                              <span className="text-xs text-slate-500">Other Rep</span>
                            )}
                          </td>

                          <td className="p-4">
                            <select
                              value={order.status}
                              onChange={(e) =>
                                handleStatusChange(order.id, e.target.value as OrderStatus)
                              }
                              className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500 ${statusBadge.bg} bg-slate-900`}
                            >
                              <option value="pending">Pending</option>
                              <option value="confirmed">Confirmed</option>
                              <option value="ready_to_ship">Ready to Ship</option>
                              <option value="on_the_way">On the Way</option>
                              <option value="delivered">Delivered</option>
                              <option value="canceled">Canceled</option>
                            </select>
                          </td>

                          <td className="p-4 text-right">
                            <button
                              onClick={() => setEditingOrderForItems(order)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
                            >
                              <PackageOpen className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Edit & History</span>
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
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl shadow-black/40">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950/70 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="p-4">Product & Variant</th>
                      <th className="p-4">SKU</th>
                      <th className="p-4">Price</th>
                      <th className="p-4 text-right">Live Stock Available</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {loadingInventory ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-slate-500">
                          Loading inventory...
                        </td>
                      </tr>
                    ) : filteredVariants.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-slate-500">
                          No matching inventory items found.
                        </td>
                      </tr>
                    ) : (
                      filteredVariants.map((v) => (
                        <tr key={v.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-4">
                            <div className="font-semibold text-slate-200">
                              {(v.product as any)?.name || (v.product as any)?.title || 'Product'}
                            </div>
                            <div className="text-xs text-indigo-400 mt-0.5">
                              Variant: {v.title}
                            </div>
                          </td>
                          <td className="p-4 font-mono text-xs text-slate-400">{v.sku}</td>
                          <td className="p-4 font-semibold text-slate-200">
                            {formatCurrency(v.price)}
                          </td>
                          <td className="p-4 text-right">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                                v.stock_quantity === 0
                                  ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                                  : v.stock_quantity <= 5
                                  ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                                  : 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
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

        {/* TAB 3: UPSELL REWARDS */}
        {activeTab === 'rewards' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl shadow-black/40">
            <div className="p-4 border-b border-slate-800">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                <span>My Upsell Commissions</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Itemized bonuses earned when adding upsell items to customer orders
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/70 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Order Number</th>
                    <th className="p-4">Commission Amount</th>
                    <th className="p-4">Earned Date</th>
                    <th className="p-4 text-right">Payout Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loadingRewards ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500">
                        Loading rewards...
                      </td>
                    </tr>
                  ) : rewards.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500">
                        No rewards earned yet. Upsell products to customer orders to earn bonuses!
                      </td>
                    </tr>
                  ) : (
                    rewards.map((reward) => (
                      <tr key={reward.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-4 font-mono font-bold text-indigo-400">
                          {(reward.order as any)?.order_number || 'Order'}
                        </td>
                        <td className="p-4 font-bold text-emerald-400 text-base">
                          {formatCurrency(reward.bonus_amount)}
                        </td>
                        <td className="p-4 text-xs text-slate-400">
                          {formatDate(reward.created_at)}
                        </td>
                        <td className="p-4 text-right">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                              reward.status === 'paid'
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                                : reward.status === 'approved'
                                ? 'bg-indigo-950/80 text-indigo-300 border-indigo-800'
                                : 'bg-amber-950/80 text-amber-300 border-amber-800'
                            }`}
                          >
                            {reward.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: PAYOUTS & RECEIPTS */}
        {activeTab === 'payouts' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl shadow-black/40">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <span>Withdrawal Requests & Admin Payment Receipts</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Track payout request approvals and view uploaded payment proof screenshots
                </p>
              </div>

              <button
                disabled={piggybankBalance <= 0}
                onClick={() => {
                  setPayoutAmount(piggybankBalance.toString());
                  setIsPayoutModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold text-xs shadow-md shadow-amber-600/20 transition-all"
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>New Payout Request</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/70 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Method & Account</th>
                    <th className="p-4">Requested Date</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Admin Receipt Proof</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loadingPayouts ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        Loading payout requests...
                      </td>
                    </tr>
                  ) : myPayouts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        No payout requests submitted yet.
                      </td>
                    </tr>
                  ) : (
                    myPayouts.map((payout) => (
                      <tr key={payout.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-4 font-bold text-emerald-400 text-base">
                          {formatCurrency(payout.amount)}
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-slate-200">
                            {payout.payment_method}
                          </div>
                          <div className="font-mono text-xs text-indigo-400 mt-0.5">
                            {payout.account_number}
                          </div>
                        </td>
                        <td className="p-4 text-xs text-slate-400">
                          {formatDate(payout.created_at)}
                        </td>
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                              payout.status === 'approved'
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                                : payout.status === 'rejected'
                                ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                                : 'bg-amber-950/80 text-amber-300 border-amber-800'
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
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-semibold border border-slate-700 transition-colors"
                            >
                              <ImageIcon className="w-3.5 h-3.5" />
                              <span>View Payment Receipt</span>
                            </button>
                          ) : payout.status === 'approved' ? (
                            <span className="text-xs text-slate-500">Paid (no screenshot)</span>
                          ) : (
                            <span className="text-xs text-slate-500 italic">Pending payment</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-400" />
                <span>Request Commission Payout</span>
              </h3>
              <button
                onClick={() => setIsPayoutModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPayoutRequest} className="p-5 space-y-4">
              <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl flex items-center justify-between">
                <span className="text-xs text-amber-300">Pending Piggybank:</span>
                <span className="font-bold font-mono text-amber-400">
                  {formatCurrency(piggybankBalance)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Withdrawal Amount (BDT)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={piggybankBalance}
                  step="any"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Payment Method
                </label>
                <select
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="bKash">bKash (Personal)</option>
                  <option value="Nagad">Nagad (Personal)</option>
                  <option value="Rocket">Rocket (Personal)</option>
                  <option value="Bank">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Account Number / Details
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 017XXXXXXXX"
                  value={payoutAccount}
                  onChange={(e) => setPayoutAccount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Note to Admin (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Payout for this week"
                  value={payoutNote}
                  onChange={(e) => setPayoutNote(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsPayoutModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayout}
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-sm shadow-md transition-all disabled:opacity-50"
                >
                  {submittingPayout ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE ORDER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-8">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-indigo-400" />
                <span>Create New Customer Order</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitOrder} className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Order Channel Source
                  </label>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value as OrderSource)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="whatsapp">WhatsApp Order</option>
                    <option value="messenger">Messenger Order</option>
                    <option value="phone">Phone Call Order</option>
                    <option value="website">Website Order</option>
                    <option value="manual">Manual Direct</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Attribution Coupon Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. REP10"
                    value={couponUsed}
                    onChange={(e) => setCouponUsed(e.target.value.toUpperCase())}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Customer full name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="01XXXXXXXXX"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Shipping Delivery Address
                </label>
                <textarea
                  rows={2}
                  placeholder="Detailed house, road, area, city..."
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Add Order Line Item Picker */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                  Add Products to Order
                </span>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-6">
                    <label className="block text-[11px] text-slate-400 mb-1">Select Item</label>
                    <select
                      value={selectedVariantId}
                      onChange={(e) => setSelectedVariantId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">-- Choose Product & Variant --</option>
                      {variants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {(v.product as any)?.name || (v.product as any)?.title} ({v.title}) - {formatCurrency(v.price)} [Stock: {v.stock_quantity}]
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[11px] text-slate-400 mb-1">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(parseInt(e.target.value) || 1)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="md:col-span-2 flex items-center h-9">
                    <label className="flex items-center gap-2 text-xs text-amber-400 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isUpsellItem}
                        onChange={(e) => setIsUpsellItem(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500"
                      />
                      <span>Upsell Item</span>
                    </label>
                  </div>

                  <div className="md:col-span-2">
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="w-full h-9 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>

                {/* Items List */}
                {orderItems.length > 0 && (
                  <div className="divide-y divide-slate-800/80 pt-2">
                    {orderItems.map((item, idx) => (
                      <div key={idx} className="py-2 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-200">{item.title}</span>
                          <span className="text-slate-400">({item.variant_title})</span>
                          <span className="text-indigo-400 font-mono">x{item.quantity}</span>
                          {item.is_upsell && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800 font-bold text-[10px]">
                              Upsell
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-slate-300">
                            {formatCurrency(item.price * item.quantity)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1 text-slate-400 hover:text-rose-400"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}

                    <div className="pt-2 flex justify-between font-bold text-sm text-slate-100">
                      <span>Total Order Amount:</span>
                      <span className="font-mono text-indigo-400">
                        {formatCurrency(
                          orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOrder}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-md shadow-indigo-600/30 transition-all disabled:opacity-50"
                >
                  {submittingOrder ? 'Placing Order...' : 'Confirm & Create Order'}
                </button>
              </div>
            </form>
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
    </div>
  );
}
