'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/Navbar';
import {
  ShoppingBag,
  Boxes,
  Users,
  Award,
  Plus,
  Minus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Truck,
  TrendingUp,
  Tag,
  AlertCircle,
  PackageOpen,
  Phone,
  Trash2,
  UploadCloud,
  DollarSign,
  Eye,
  ShieldCheck,
  Check,
  Archive,
  ArchiveRestore,
  Image as ImageIcon,
  User,
  X
} from 'lucide-react';
import EditOrderItemsModal from '@/components/EditOrderItemsModal';
import DeleteOrderModal from '@/components/DeleteOrderModal';
import CsvUploadModal from '@/components/CsvUploadModal';
import ManualProductModal from '@/components/ManualProductModal';
import InteractivePieChart from '@/components/InteractivePieChart';
import StaffPerformanceGraph from '@/components/StaffPerformanceGraph';
import ProcessPayoutModal from '@/components/ProcessPayoutModal';
import ScreenshotLightboxModal from '@/components/ScreenshotLightboxModal';
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
  RewardRule,
  OrderStatus,
  OrderSource,
  PayoutRequest,
  UpsellReward,
} from '@/types/database';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function AdminDashboard() {
  const supabase = createClient();

  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [activeTab, setActiveTab] = useState<'orders' | 'inventory' | 'team' | 'payouts' | 'rewards'>('orders');

  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [editingOrderForItems, setEditingOrderForItems] = useState<Order | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingOrders, setLoadingOrders] = useState(true);

  // Inventory State
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [inventorySearch, setInventorySearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  // Sales Team & Performance State
  const [salesTeam, setSalesTeam] = useState<Profile[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [newCouponCode, setNewCouponCode] = useState<{ [id: string]: string }>({});
  const [teamRewards, setTeamRewards] = useState<UpsellReward[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [selectedStaffForGraph, setSelectedStaffForGraph] = useState<Profile | null>(null);

  // Payouts State
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
  const [loadingPayouts, setLoadingPayouts] = useState(false);
  const [processingPayout, setProcessingPayout] = useState<PayoutRequest | null>(null);
  const [lightboxScreenshot, setLightboxScreenshot] = useState<{ url: string; title: string } | null>(null);

  // Reward Rules State
  const [rewardRules, setRewardRules] = useState<RewardRule[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleType, setNewRuleType] = useState<'fixed_per_item' | 'percentage'>('fixed_per_item');
  const [newRuleValue, setNewRuleValue] = useState('50');

  // Load current user profile & Presence
  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (profile) setCurrentProfile(profile);

        const presenceChannel = supabase.channel('online-staff', {
          config: { presence: { key: user.id } },
        });

        presenceChannel
          .on('presence', { event: 'sync' }, () => {
            const state = presenceChannel.presenceState();
            const activeIds = new Set<string>();
            Object.keys(state).forEach((key) => {
              activeIds.add(key);
            });
            setOnlineUserIds(activeIds);
          })
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              await presenceChannel.track({
                user_id: user.id,
                full_name: profile?.full_name || 'Admin',
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
    let query = supabase
      .from('orders')
      .select('*, order_items(*), sales_rep:profiles(*)')
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }
    if (sourceFilter !== 'all') {
      query = query.eq('source', sourceFilter);
    }

    const { data, error } = await query;
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

  // Fetch Sales Team & Rewards for calculation
  const fetchTeamAndRewards = async () => {
    setLoadingTeam(true);
    const { data: teamData } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (teamData) {
      setSalesTeam(teamData as Profile[]);
      if (!selectedStaffForGraph && teamData.length > 0) {
        setSelectedStaffForGraph(teamData[0]);
      }
    }

    const { data: rewardsData } = await supabase
      .from('upsell_rewards')
      .select('*')
      .order('created_at', { ascending: false });

    if (rewardsData) {
      setTeamRewards(rewardsData as UpsellReward[]);
    }

    setLoadingTeam(false);
  };

  // Fetch Payout Requests
  const fetchPayouts = async () => {
    setLoadingPayouts(true);
    try {
      const res = await fetch('/api/payouts');
      const json = await res.json();
      if (json.payouts) {
        setPayoutRequests(json.payouts);
      }
    } catch (e) {
      console.error('Failed to load payouts:', e);
    }
    setLoadingPayouts(false);
  };

  // Fetch Reward Rules
  const fetchRules = async () => {
    setLoadingRules(true);
    try {
      const res = await fetch('/api/rewards/rules');
      const json = await res.json();
      if (json.rules) {
        setRewardRules(json.rules);
      }
    } catch (e) {
      console.error('Failed to load rules:', e);
    }
    setLoadingRules(false);
  };

  // Fetch data on active tab change
  useEffect(() => {
    if (activeTab === 'orders') fetchOrders();
    if (activeTab === 'inventory') fetchInventory();
    if (activeTab === 'team') fetchTeamAndRewards();
    if (activeTab === 'payouts') fetchPayouts();
    if (activeTab === 'rewards') fetchRules();
  }, [activeTab, statusFilter, sourceFilter]);

  // Single Stable Realtime Subscription on Mount (NO reconnect loops)
  useEffect(() => {
    const channel = supabase
      .channel('admin-realtime-singleton')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          fetchOrders();
          fetchTeamAndRewards();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'product_variants' },
        () => {
          fetchInventory();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payout_requests' },
        () => {
          fetchPayouts();
          fetchTeamAndRewards();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'upsell_rewards' },
        () => {
          fetchTeamAndRewards();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Order Status Change Handler
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
      } else {
        alert(data.error || 'Failed to update status');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Stock Adjustment Handler
  const handleStockAdjust = async (variantId: string, amount: number) => {
    setAdjustingId(variantId);
    try {
      const res = await fetch('/api/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variant_id: variantId,
          change_amount: amount,
          reason: 'manual_adjustment',
          adjusted_by: currentProfile?.id,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setVariants((prev) =>
          prev.map((v) =>
            v.id === variantId ? { ...v, stock_quantity: json.new_stock } : v
          )
        );
      } else {
        alert(json.error || 'Failed to adjust stock');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAdjustingId(null);
    }
  };

  // Toggle Archive Status for Product
  const handleToggleArchiveProduct = async (productId: string, currentArchived: boolean) => {
    try {
      const res = await fetch('/api/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          is_archived: !currentArchived,
        }),
      });
      const json = await res.json();
      if (json.success) {
        fetchInventory();
      } else {
        alert(json.error || 'Failed to update product');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Assign Coupon Code Handler
  const handleAssignCoupon = async (profileId: string) => {
    const code = newCouponCode[profileId]?.trim().toUpperCase();
    if (!code) return;

    const { error } = await supabase
      .from('profiles')
      .update({ coupon_code: code })
      .eq('id', profileId);

    if (error) {
      alert('Failed to update coupon code: ' + error.message);
    } else {
      setSalesTeam((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, coupon_code: code } : p))
      );
      setNewCouponCode((prev) => ({ ...prev, [profileId]: '' }));
    }
  };

  // Create Reward Rule Handler
  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName.trim() || !newRuleValue) return;

    try {
      const res = await fetch('/api/rewards/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRuleName.trim(),
          rule_type: newRuleType,
          value: parseFloat(newRuleValue),
          created_by: currentProfile?.id,
        }),
      });
      const json = await res.json();
      if (json.rule) {
        setRewardRules([json.rule, ...rewardRules]);
        setNewRuleName('');
        setNewRuleValue('50');
      } else {
        alert(json.error || 'Failed to create rule');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchSearch =
        o.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.customer_phone.includes(searchQuery) ||
        o.order_number.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSearch;
    });
  }, [orders, searchQuery]);

  // Order Status Pie Chart Data
  const orderStatusChartData = useMemo(() => {
    const counts: Record<string, number> = {
      pending: 0,
      confirmed: 0,
      ready_to_ship: 0,
      on_the_way: 0,
      delivered: 0,
      canceled: 0,
    };
    orders.forEach((o) => {
      if (counts[o.status] !== undefined) {
        counts[o.status]++;
      } else {
        counts.pending++;
      }
    });

    const colors: Record<string, string> = {
      pending: '#f59e0b',
      confirmed: '#3b82f6',
      ready_to_ship: '#6366f1',
      on_the_way: '#8b5cf6',
      delivered: '#10b981',
      canceled: '#ef4444',
    };

    return Object.entries(counts)
      .filter(([_, count]) => count > 0)
      .map(([status, count]) => ({
        label: status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        value: count,
        color: colors[status] || '#64748b',
      }));
  }, [orders]);

  // Order Source Pie Chart Data
  const orderSourceChartData = useMemo(() => {
    const counts: Record<string, number> = {
      website: 0,
      whatsapp: 0,
      messenger: 0,
      phone: 0,
      manual: 0,
    };
    orders.forEach((o) => {
      if (counts[o.source] !== undefined) {
        counts[o.source]++;
      } else {
        counts.manual++;
      }
    });

    const colors: Record<string, string> = {
      website: '#3b82f6',
      whatsapp: '#22c55e',
      messenger: '#06b6d4',
      phone: '#eab308',
      manual: '#64748b',
    };

    return Object.entries(counts)
      .filter(([_, count]) => count > 0)
      .map(([src, count]) => ({
        label: src.charAt(0).toUpperCase() + src.slice(1),
        value: count,
        color: colors[src] || '#64748b',
      }));
  }, [orders]);

  // Team Commission & Piggybank Statistics
  const teamStats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const stats: Record<
      string,
      { todayEarnings: number; piggybank: number; totalSettled: number; orderCount: number }
    > = {};

    salesTeam.forEach((member) => {
      stats[member.id] = { todayEarnings: 0, piggybank: 0, totalSettled: 0, orderCount: 0 };
    });

    teamRewards.forEach((r) => {
      const repId = r.sales_rep_id;
      if (!stats[repId]) {
        stats[repId] = { todayEarnings: 0, piggybank: 0, totalSettled: 0, orderCount: 0 };
      }
      const amount = Number(r.bonus_amount || 0);
      if (r.created_at.startsWith(today)) {
        stats[repId].todayEarnings += amount;
      }
      if (r.status === 'pending') {
        stats[repId].piggybank += amount;
      } else if (r.status === 'paid') {
        stats[repId].totalSettled += amount;
      }
    });

    orders.forEach((o) => {
      if (o.sales_rep_id && stats[o.sales_rep_id]) {
        stats[o.sales_rep_id].orderCount++;
      }
    });

    return stats;
  }, [salesTeam, teamRewards, orders]);

  // Performance Graph Data for selected staff member
  const selectedStaffGraphData = useMemo(() => {
    if (!selectedStaffForGraph) return [];
    const staffId = selectedStaffForGraph.id;
    const days: Record<string, { commission: number; ordersCount: number }> = {};

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      days[key] = { commission: 0, ordersCount: 0 };
    }

    teamRewards.forEach((r) => {
      if (r.sales_rep_id === staffId) {
        const day = r.created_at.split('T')[0];
        if (days[day]) {
          days[day].commission += Number(r.bonus_amount || 0);
        }
      }
    });

    orders.forEach((o) => {
      if (o.sales_rep_id === staffId) {
        const day = o.created_at.split('T')[0];
        if (days[day]) {
          days[day].ordersCount++;
        }
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
  }, [selectedStaffForGraph, teamRewards, orders]);

  // Filtered variants for Inventory
  const filteredVariants = useMemo(() => {
    return variants.filter((v) => {
      const product = v.product as any;
      const isArchived = product?.is_archived ?? false;
      if (!showArchived && isArchived) return false;

      const q = inventorySearch.toLowerCase();
      const matchName = product?.name?.toLowerCase().includes(q) || product?.title?.toLowerCase().includes(q);
      const matchSku = (v.sku?.toLowerCase() || '').includes(q);
      const matchVariant = (v.title?.toLowerCase() || '').includes(q);
      return !q || matchName || matchSku || matchVariant;
    });
  }, [variants, inventorySearch, showArchived]);

  // Get Clean Status Badge Dot
  const getCleanStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return { dot: 'bg-amber-400', label: 'Pending' };
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
        tabBadges={{
          orders: orders.length,
          inventory: variants.length,
          payouts: payoutRequests.filter((p) => p.status === 'pending').length || undefined,
        }}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* TAB 1: ORDERS */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            {/* Interactive Donut Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <InteractivePieChart
                title="Order Status Distribution"
                subtitle="Live status proportion across all customer orders"
                data={orderStatusChartData}
                centerLabel="Total Orders"
                centerValue={orders.length}
              />
              <InteractivePieChart
                title="Orders by Acquisition Channel"
                subtitle="Distribution of website, WhatsApp, Messenger & phone sales"
                data={orderSourceChartData}
                centerLabel="Channels"
                centerValue={orderSourceChartData.length}
              />
            </div>

            {/* Filter Bar & Search */}
            <div className="bg-white border border-slate-200/80 p-3.5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search customer, phone, order #..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="ready_to_ship">Ready to Ship</option>
                    <option value="on_the_way">On the Way</option>
                    <option value="delivered">Delivered</option>
                    <option value="canceled">Canceled</option>
                  </select>
                </div>

                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="all">All Sources</option>
                  <option value="website">Website</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="messenger">Messenger</option>
                  <option value="phone">Phone Call</option>
                  <option value="manual">Manual Entry</option>
                </select>
              </div>
            </div>

            {/* Orders Table (Fixing Picture 4: restrained colors, clean dropdown) */}
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
                          No orders found matching your criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((order) => {
                        const hasUpsell = order.order_items?.some((i) => i.is_upsell);
                        const statusBadge = getCleanStatusBadge(order.status);

                        return (
                          <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="p-4">
                              <div className="font-mono font-bold text-slate-900">
                                {order.order_number}
                              </div>
                              <div className="flex items-center gap-1.5 mt-1">
                                {order.source === 'whatsapp' && <WhatsAppFlatIcon className="w-4 h-4" />}
                                {order.source === 'messenger' && <MessengerFlatIcon className="w-4 h-4" />}
                                {order.source === 'phone' && <PhoneCallFlatIcon className="w-4 h-4" />}
                                {order.source === 'manual' && <WalkInFlatIcon className="w-4 h-4" />}
                                {order.source === 'website' && <WebsiteFlatIcon className="w-4 h-4" />}
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
                              {order.shipping_address && (
                                <div className="text-xs text-slate-400 truncate max-w-xs mt-0.5">
                                  {order.shipping_address}
                                </div>
                              )}
                            </td>

                            <td className="p-4">
                              <div className="font-semibold text-slate-900 font-mono">
                                {formatCurrency(order.total_amount)}
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                                <span>{order.order_items?.length || 0} line items</span>
                                {hasUpsell && (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200/80 font-bold text-[10px]">
                                    Upsell
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="p-4">
                              {order.sales_rep ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-700">
                                    {order.sales_rep.avatar_url ? (
                                      <img src={order.sales_rep.avatar_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      order.sales_rep.full_name?.charAt(0) || 'U'
                                    )}
                                  </div>
                                  <span className="text-xs text-slate-700 font-medium">
                                    {order.sales_rep.full_name}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400 italic">Unassigned</span>
                              )}
                            </td>

                            <td className="p-4">
                              <div className="relative inline-block">
                                <select
                                  value={order.status}
                                  onChange={(e) =>
                                    handleStatusChange(order.id, e.target.value as OrderStatus)
                                  }
                                  className="text-xs font-medium pl-6 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer shadow-2xs"
                                >
                                  <option value="pending">Pending</option>
                                  <option value="confirmed">Confirmed</option>
                                  <option value="ready_to_ship">Ready to Ship</option>
                                  <option value="on_the_way">On the Way</option>
                                  <option value="delivered">Delivered</option>
                                  <option value="canceled">Canceled</option>
                                </select>
                                <span
                                  className={`w-2 h-2 rounded-full absolute left-2.5 top-1/2 -translate-y-1/2 ${statusBadge.dot}`}
                                />
                              </div>
                            </td>

                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setEditingOrderForItems(order)}
                                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
                                  title="Edit items & view history timeline"
                                >
                                  <PackageOpen className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setDeletingOrder(order)}
                                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                                  title="Delete order"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
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
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white border border-slate-200/80 p-3.5 rounded-2xl shadow-2xs">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative w-72">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search product, SKU, variant..."
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(e) => setShowArchived(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Show Archived</span>
                </label>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setShowCsvModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all shadow-2xs"
                >
                  <UploadCloud className="w-4 h-4 text-slate-500" />
                  <span>Import CSV</span>
                </button>

                <button
                  onClick={() => setShowManualModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all shadow-2xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Product</span>
                </button>
              </div>
            </div>

            {/* Inventory Table */}
            <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50/80 border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="p-4">Product & Variant</th>
                      <th className="p-4">SKU</th>
                      <th className="p-4">Price</th>
                      <th className="p-4">Current Stock</th>
                      <th className="p-4 text-center">Quick Stock Adjust</th>
                      <th className="p-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingInventory ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400">
                          Loading inventory...
                        </td>
                      </tr>
                    ) : filteredVariants.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400">
                          No product variants found.
                        </td>
                      </tr>
                    ) : (
                      filteredVariants.map((variant) => {
                        const product = variant.product as any;
                        const isArchived = product?.is_archived ?? false;
                        const isLowStock = variant.stock_quantity <= 5;
                        const isAdjusting = adjustingId === variant.id;

                        return (
                          <tr
                            key={variant.id}
                            className={`hover:bg-slate-50/70 transition-colors ${
                              isArchived ? 'opacity-60 bg-slate-50/40' : ''
                            }`}
                          >
                            <td className="p-4">
                              <div className="font-semibold text-slate-900">
                                {product?.name || product?.title || 'Product'}
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5">
                                Variant: {variant.title}
                              </div>
                            </td>

                            <td className="p-4 font-mono text-xs text-slate-500">
                              {variant.sku}
                            </td>

                            <td className="p-4 font-semibold text-slate-900 font-mono">
                              {formatCurrency(variant.price)}
                            </td>

                            <td className="p-4">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                                  variant.stock_quantity === 0
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : isLowStock
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}
                              >
                                {variant.stock_quantity} in stock
                              </span>
                            </td>

                            <td className="p-4">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  disabled={isAdjusting || variant.stock_quantity <= 0}
                                  onClick={() => handleStockAdjust(variant.id, -1)}
                                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center border border-slate-200/80 disabled:opacity-40 transition-colors"
                                  title="Deduct 1"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  disabled={isAdjusting}
                                  onClick={() => handleStockAdjust(variant.id, 1)}
                                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center border border-slate-200/80 disabled:opacity-40 transition-colors"
                                  title="Add 1"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  disabled={isAdjusting}
                                  onClick={() => handleStockAdjust(variant.id, 10)}
                                  className="px-2 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center border border-slate-200/80 disabled:opacity-40 transition-colors"
                                  title="Add 10"
                                >
                                  +10
                                </button>
                              </div>
                            </td>

                            <td className="p-4 text-right">
                              {product && (
                                <button
                                  onClick={() =>
                                    handleToggleArchiveProduct(product.id, isArchived)
                                  }
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                                    isArchived
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                      : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                                  }`}
                                >
                                  {isArchived ? (
                                    <>
                                      <ArchiveRestore className="w-3.5 h-3.5" />
                                      <span>Unarchive</span>
                                    </>
                                  ) : (
                                    <>
                                      <Archive className="w-3.5 h-3.5" />
                                      <span>Archive</span>
                                    </>
                                  )}
                                </button>
                              )}
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

        {/* TAB 3: TEAM & PERFORMANCE */}
        {activeTab === 'team' && (
          <div className="space-y-6">
            {/* Visual Performance Graph */}
            {selectedStaffForGraph && (
              <StaffPerformanceGraph
                staffName={selectedStaffForGraph.full_name || selectedStaffForGraph.email}
                dailyStats={selectedStaffGraphData}
              />
            )}

            {/* Staff Members Table */}
            <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-100">
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-600" />
                  <span>Staff Team & Performance</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Real-time presence, daily commissions (resets 12am), pending piggybanks & coupon codes
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50/80 border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="p-4">Staff Member</th>
                      <th className="p-4">Role</th>
                      <th className="p-4">Coupon Code</th>
                      <th className="p-4">Today's Earnings</th>
                      <th className="p-4">Piggybank (Pending)</th>
                      <th className="p-4">Settled Total</th>
                      <th className="p-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingTeam ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">
                          Loading sales team...
                        </td>
                      </tr>
                    ) : salesTeam.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">
                          No staff accounts registered.
                        </td>
                      </tr>
                    ) : (
                      salesTeam.map((member) => {
                        const isOnline = onlineUserIds.has(member.id);
                        const stats = teamStats[member.id] || {
                          todayEarnings: 0,
                          piggybank: 0,
                          totalSettled: 0,
                          orderCount: 0,
                        };
                        const isSelected = selectedStaffForGraph?.id === member.id;

                        return (
                          <tr
                            key={member.id}
                            className={`hover:bg-slate-50/70 transition-colors ${
                              isSelected ? 'bg-slate-50/80 font-medium' : ''
                            }`}
                          >
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                  <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700">
                                    {member.avatar_url ? (
                                      <img
                                        src={member.avatar_url}
                                        alt=""
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      member.full_name?.charAt(0) || 'U'
                                    )}
                                  </div>
                                  <span
                                    className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                                      isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                                    }`}
                                    title={isOnline ? 'Online now' : 'Offline'}
                                  />
                                </div>
                                <div>
                                  <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                    <span>{member.full_name || 'Anonymous Staff'}</span>
                                    {isOnline && (
                                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                                        Online
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-slate-400">{member.email}</div>
                                </div>
                              </div>
                            </td>

                            <td className="p-4">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 capitalize">
                                {member.role}
                              </span>
                            </td>

                            <td className="p-4">
                              {member.coupon_code ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-200 font-mono text-xs font-bold">
                                  <Tag className="w-3 h-3 text-slate-500" />
                                  {member.coupon_code}
                                </span>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    placeholder="Set CODE"
                                    value={newCouponCode[member.id] || ''}
                                    onChange={(e) =>
                                      setNewCouponCode({
                                        ...newCouponCode,
                                        [member.id]: e.target.value,
                                      })
                                    }
                                    className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 uppercase focus:bg-white"
                                  />
                                  <button
                                    onClick={() => handleAssignCoupon(member.id)}
                                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-2xs"
                                  >
                                    Assign
                                  </button>
                                </div>
                              )}
                            </td>

                            <td className="p-4 font-bold text-slate-900 font-mono">
                              {formatCurrency(stats.todayEarnings)}
                            </td>

                            <td className="p-4 font-bold text-amber-700 font-mono">
                              {formatCurrency(stats.piggybank)}
                            </td>

                            <td className="p-4 font-semibold text-slate-600 font-mono">
                              {formatCurrency(stats.totalSettled)}
                            </td>

                            <td className="p-4 text-right">
                              <button
                                onClick={() => setSelectedStaffForGraph(member)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                              >
                                <TrendingUp className="w-3.5 h-3.5 text-slate-600" />
                                <span>View Graph</span>
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

        {/* TAB 4: PAYOUT REQUESTS */}
        {activeTab === 'payouts' && (
          <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <span>Staff Payout Requests</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Review withdrawal requests against piggybank balances and upload transaction screenshot receipts
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50/80 border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Staff Member</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Payment Method & Account</th>
                    <th className="p-4">Requested Date</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Proof Receipt</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingPayouts ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        Loading payout requests...
                      </td>
                    </tr>
                  ) : payoutRequests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        No payout requests found.
                      </td>
                    </tr>
                  ) : (
                    payoutRequests.map((payout) => {
                      const staff = payout.staff as any;

                      return (
                        <tr key={payout.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-4">
                            <div className="font-semibold text-slate-900">
                              {staff?.full_name || 'Staff Member'}
                            </div>
                            <div className="text-xs text-slate-400">{staff?.email}</div>
                            {payout.staff_note && (
                              <div className="text-xs text-slate-500 italic mt-0.5">
                                Note: "{payout.staff_note}"
                              </div>
                            )}
                          </td>

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
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors"
                              >
                                <ImageIcon className="w-3.5 h-3.5 text-slate-600" />
                                <span>View Receipt</span>
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400 italic">No receipt</span>
                            )}
                          </td>

                          <td className="p-4 text-right">
                            {payout.status === 'pending' ? (
                              <button
                                onClick={() => setProcessingPayout(payout)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-2xs transition-all"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Pay & Upload Proof</span>
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">Processed</span>
                            )}
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

        {/* TAB 5: COMMISSION RULES */}
        {activeTab === 'rewards' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2 mb-4">
                <Award className="w-4 h-4 text-slate-600" />
                <span>Create Upsell Reward Rule</span>
              </h3>

              <form onSubmit={handleCreateRule} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Rule Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 50 BDT Bonus per Upsell Item"
                    value={newRuleName}
                    onChange={(e) => setNewRuleName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Rule Type
                  </label>
                  <select
                    value={newRuleType}
                    onChange={(e) => setNewRuleType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="fixed_per_item">Fixed BDT per Upsell Item</option>
                    <option value="percentage">Percentage of Upsell Value</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Reward Value ({newRuleType === 'percentage' ? '%' : 'BDT'}) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    value={newRuleValue}
                    onChange={(e) => setNewRuleValue(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm transition-all shadow-xs flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Save Reward Rule</span>
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-100">
                <h3 className="font-bold text-base text-slate-900">
                  Active Commission Calculation Rules
                </h3>
              </div>

              <div className="divide-y divide-slate-100">
                {loadingRules ? (
                  <div className="p-8 text-center text-slate-400">Loading rules...</div>
                ) : rewardRules.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">No reward rules created.</div>
                ) : (
                  rewardRules.map((rule) => (
                    <div key={rule.id} className="p-4 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-900">{rule.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Type: {rule.rule_type} &middot; Value:{' '}
                          {rule.rule_type === 'percentage'
                            ? `${rule.value}%`
                            : formatCurrency(rule.value)}
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        Active
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODALS */}
      {editingOrderForItems && (
        <EditOrderItemsModal
          order={editingOrderForItems}
          isOpen={true}
          onClose={() => setEditingOrderForItems(null)}
          onUpdated={() => {
            setEditingOrderForItems(null);
            fetchOrders();
          }}
        />
      )}

      {deletingOrder && (
        <DeleteOrderModal
          order={deletingOrder}
          isOpen={true}
          onClose={() => setDeletingOrder(null)}
          onDeleted={() => {
            setDeletingOrder(null);
            fetchOrders();
          }}
        />
      )}

      {showCsvModal && (
        <CsvUploadModal
          isOpen={true}
          onClose={() => setShowCsvModal(false)}
          onImported={() => {
            fetchInventory();
          }}
        />
      )}

      {showManualModal && (
        <ManualProductModal
          isOpen={true}
          onClose={() => setShowManualModal(false)}
          onCreated={() => {
            fetchInventory();
          }}
        />
      )}

      {processingPayout && (
        <ProcessPayoutModal
          payout={processingPayout}
          isOpen={true}
          onClose={() => setProcessingPayout(null)}
          onProcessed={() => {
            setProcessingPayout(null);
            fetchPayouts();
            fetchTeamAndRewards();
          }}
        />
      )}

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
