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
  XCircle,
  Clock,
  Truck,
  ArrowUpRight,
  TrendingUp,
  Tag,
  AlertCircle,
  Sparkles,
  PackageOpen,
  Phone,
  History,
  Trash2,
  UploadCloud,
  DollarSign,
  Eye,
  ShieldCheck,
  Check,
  ArrowRight,
  Archive,
  ArchiveRestore,
  CreditCard,
  Image as ImageIcon,
  Activity,
  Layers
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
  Order,
  ProductVariant,
  Profile,
  RewardRule,
  OrderStatus,
  OrderSource,
  PayoutRequest,
  UpsellReward,
} from '@/types/database';
import { formatCurrency, formatDate, getStatusBadgeInfo, getSourceBadge } from '@/lib/utils';

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

        // Track presence on online-staff channel
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

  // Load data according to active tab & Supabase Realtime listeners (NO 12s POLLING INTERVAL)
  useEffect(() => {
    if (activeTab === 'orders') fetchOrders();
    if (activeTab === 'inventory') fetchInventory();
    if (activeTab === 'team') fetchTeamAndRewards();
    if (activeTab === 'payouts') fetchPayouts();
    if (activeTab === 'rewards') fetchRules();

    // Instant Realtime sync across all relevant tables
    const channel = supabase
      .channel('admin-realtime-events')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          if (activeTab === 'orders') fetchOrders();
          if (activeTab === 'team') fetchTeamAndRewards();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'product_variants' },
        () => {
          if (activeTab === 'inventory') fetchInventory();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payout_requests' },
        () => {
          if (activeTab === 'payouts') fetchPayouts();
          if (activeTab === 'team') fetchTeamAndRewards();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'upsell_rewards' },
        () => {
          if (activeTab === 'team') fetchTeamAndRewards();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab, statusFilter, sourceFilter]);

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
      const matchName = product?.name?.toLowerCase().includes(q);
      const matchSku = (v.sku?.toLowerCase() || '').includes(q);
      const matchVariant = (v.title?.toLowerCase() || '').includes(q);
      return !q || matchName || matchSku || matchVariant;
    });
  }, [variants, inventorySearch, showArchived]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200">
      <Navbar currentProfile={currentProfile} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        {/* Navigation Tabs */}
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
              <span>Orders Management</span>
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
              <span>Inventory & Products</span>
              <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/50">
                {variants.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('team')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${
                activeTab === 'team'
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Staff Performance</span>
              <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/50">
                {onlineUserIds.size} Online
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
              <span>Payout Requests</span>
              {payoutRequests.filter((p) => p.status === 'pending').length > 0 && (
                <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-700/50 font-bold animate-pulse">
                  {payoutRequests.filter((p) => p.status === 'pending').length}
                </span>
              )}
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
              <span>Commission Rules</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Realtime Supabase Sync
            </span>
          </div>
        </div>

        {/* TAB 1: ORDERS */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            {/* Interactive Donut Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                centerLabel="Active Channels"
                centerValue={orderSourceChartData.length}
              />
            </div>

            {/* Filter Bar & Search */}
            <div className="bg-slate-900/80 border border-slate-800/80 p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search customer, phone, order #..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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

            {/* Orders Table */}
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
                    ) : filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500">
                          No orders found matching your criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((order) => {
                        const statusBadge = getStatusBadgeInfo(order.status);
                        const sourceBadge = getSourceBadge(order.source);
                        const hasUpsell = order.order_items?.some((i) => i.is_upsell);

                        return (
                          <tr key={order.id} className="hover:bg-slate-800/40 transition-colors">
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
                              {order.shipping_address && (
                                <div className="text-xs text-slate-500 truncate max-w-xs mt-0.5">
                                  {order.shipping_address}
                                </div>
                              )}
                            </td>

                            <td className="p-4">
                              <div className="font-semibold text-slate-100">
                                {formatCurrency(order.total_amount)}
                              </div>
                              <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                                <span>{order.order_items?.length || 0} line items</span>
                                {hasUpsell && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/60 font-semibold text-[10px]">
                                    Upsell
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="p-4">
                              {order.sales_rep ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                                    {order.sales_rep.avatar_url ? (
                                      <img src={order.sales_rep.avatar_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      order.sales_rep.full_name?.charAt(0) || 'U'
                                    )}
                                  </div>
                                  <span className="text-xs text-slate-300 font-medium">
                                    {order.sales_rep.full_name}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-500 italic">Unassigned</span>
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
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => setEditingOrderForItems(order)}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                                  title="Edit items & view history timeline"
                                >
                                  <PackageOpen className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setDeletingOrder(order)}
                                  className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 hover:text-rose-100 border border-rose-800/50 transition-colors"
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
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800/80 p-4 rounded-xl">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative w-72">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search product, SKU, variant..."
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(e) => setShowArchived(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Show Archived Products</span>
                </label>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowCsvModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-semibold transition-all shadow-sm"
                >
                  <UploadCloud className="w-4 h-4 text-indigo-400" />
                  <span>Import CSV</span>
                </button>

                <button
                  onClick={() => setShowManualModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-md shadow-indigo-600/30"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Product</span>
                </button>
              </div>
            </div>

            {/* Inventory Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl shadow-black/40">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950/70 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="p-4">Product & Variant</th>
                      <th className="p-4">SKU</th>
                      <th className="p-4">Price</th>
                      <th className="p-4">Current Stock</th>
                      <th className="p-4 text-center">Quick Stock Adjust</th>
                      <th className="p-4 text-right">Product Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {loadingInventory ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500">
                          Loading inventory...
                        </td>
                      </tr>
                    ) : filteredVariants.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500">
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
                            className={`hover:bg-slate-800/40 transition-colors ${
                              isArchived ? 'opacity-60 bg-slate-950/40' : ''
                            }`}
                          >
                            <td className="p-4">
                              <div className="font-semibold text-slate-200">
                                {product?.name || 'Unnamed Product'}
                              </div>
                              <div className="text-xs text-indigo-400 font-medium mt-0.5">
                                Variant: {variant.title}
                              </div>
                            </td>

                            <td className="p-4 font-mono text-xs text-slate-400">
                              {variant.sku}
                            </td>

                            <td className="p-4 font-semibold text-slate-200">
                              {formatCurrency(variant.price)}
                            </td>

                            <td className="p-4">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                                  variant.stock_quantity === 0
                                    ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                                    : isLowStock
                                    ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                                    : 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                                }`}
                              >
                                {variant.stock_quantity} in stock
                              </span>
                            </td>

                            <td className="p-4">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  disabled={isAdjusting || variant.stock_quantity <= 0}
                                  onClick={() => handleStockAdjust(variant.id, -1)}
                                  className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center border border-slate-700 disabled:opacity-40 transition-colors"
                                  title="Deduct 1"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  disabled={isAdjusting}
                                  onClick={() => handleStockAdjust(variant.id, 1)}
                                  className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center border border-slate-700 disabled:opacity-40 transition-colors"
                                  title="Add 1"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  disabled={isAdjusting}
                                  onClick={() => handleStockAdjust(variant.id, 10)}
                                  className="px-2 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center border border-slate-700 disabled:opacity-40 transition-colors"
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
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                    isArchived
                                      ? 'bg-emerald-950/60 hover:bg-emerald-900/70 text-emerald-300 border-emerald-800'
                                      : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border-slate-700'
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
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl shadow-black/40">
              <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-400" />
                    <span>Staff Team & Performance Metrics</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Real-time presence tracking, daily earnings (resets 12am), pending piggybanks & coupon attribution
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950/70 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="p-4">Staff Member & Status</th>
                      <th className="p-4">Role</th>
                      <th className="p-4">Coupon Code</th>
                      <th className="p-4">Today's Earnings</th>
                      <th className="p-4">Piggybank (Pending)</th>
                      <th className="p-4">Settled Total</th>
                      <th className="p-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {loadingTeam ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500">
                          Loading sales team...
                        </td>
                      </tr>
                    ) : salesTeam.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500">
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
                            className={`hover:bg-slate-800/40 transition-colors ${
                              isSelected ? 'bg-indigo-950/30 border-l-4 border-indigo-500' : ''
                            }`}
                          >
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                  <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-200">
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
                                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-950 ${
                                      isOnline ? 'bg-emerald-500' : 'bg-slate-600'
                                    }`}
                                    title={isOnline ? 'Online now' : 'Offline'}
                                  />
                                </div>
                                <div>
                                  <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                                    <span>{member.full_name || 'Anonymous Staff'}</span>
                                    {isOnline && (
                                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                                        Online
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-slate-400">{member.email}</div>
                                </div>
                              </div>
                            </td>

                            <td className="p-4">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700 capitalize">
                                {member.role}
                              </span>
                            </td>

                            <td className="p-4">
                              {member.coupon_code ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/70 font-mono text-xs font-bold">
                                  <Tag className="w-3 h-3" />
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
                                    className="w-24 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 uppercase"
                                  />
                                  <button
                                    onClick={() => handleAssignCoupon(member.id)}
                                    className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold"
                                  >
                                    Assign
                                  </button>
                                </div>
                              )}
                            </td>

                            <td className="p-4 font-bold text-emerald-400">
                              {formatCurrency(stats.todayEarnings)}
                            </td>

                            <td className="p-4 font-bold text-amber-400">
                              {formatCurrency(stats.piggybank)}
                            </td>

                            <td className="p-4 font-semibold text-slate-300">
                              {formatCurrency(stats.totalSettled)}
                            </td>

                            <td className="p-4 text-right">
                              <button
                                onClick={() => setSelectedStaffForGraph(member)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
                              >
                                <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
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
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl shadow-black/40">
              <div className="p-4 border-b border-slate-800">
                <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <span>Staff Payout Requests & Payment Verification</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Review withdrawal requests against piggybank balances and upload transaction screenshot receipts
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950/70 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="p-4">Staff Member</th>
                      <th className="p-4">Amount</th>
                      <th className="p-4">Payment Method & Account</th>
                      <th className="p-4">Requested Date</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Proof of Payment</th>
                      <th className="p-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {loadingPayouts ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500">
                          Loading payout requests...
                        </td>
                      </tr>
                    ) : payoutRequests.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500">
                          No payout requests found.
                        </td>
                      </tr>
                    ) : (
                      payoutRequests.map((payout) => {
                        const staff = payout.staff as any;

                        return (
                          <tr key={payout.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="p-4">
                              <div className="font-semibold text-slate-200">
                                {staff?.full_name || 'Staff Member'}
                              </div>
                              <div className="text-xs text-slate-400">{staff?.email}</div>
                              {payout.staff_note && (
                                <div className="text-xs text-slate-500 italic mt-0.5">
                                  Note: "{payout.staff_note}"
                                </div>
                              )}
                            </td>

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
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-semibold border border-slate-700 transition-colors"
                                >
                                  <ImageIcon className="w-3.5 h-3.5" />
                                  <span>View Receipt</span>
                                </button>
                              ) : (
                                <span className="text-xs text-slate-500 italic">No receipt attached</span>
                              )}
                            </td>

                            <td className="p-4 text-right">
                              {payout.status === 'pending' ? (
                                <button
                                  onClick={() => setProcessingPayout(payout)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition-all"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  <span>Pay & Upload Proof</span>
                                </button>
                              ) : (
                                <span className="text-xs text-slate-500">Processed</span>
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

        {/* TAB 5: COMMISSION RULES */}
        {activeTab === 'rewards' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-xl">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2 mb-4">
                <Award className="w-4 h-4 text-amber-400" />
                <span>Create Upsell Reward Rule</span>
              </h3>

              <form onSubmit={handleCreateRule} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Rule Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 50 BDT Bonus per Upsell Item"
                    value={newRuleName}
                    onChange={(e) => setNewRuleName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Rule Type
                  </label>
                  <select
                    value={newRuleType}
                    onChange={(e) => setNewRuleType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="fixed_per_item">Fixed BDT per Upsell Item</option>
                    <option value="percentage">Percentage of Upsell Value</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Reward Value ({newRuleType === 'percentage' ? '%' : 'BDT'})
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    value={newRuleValue}
                    onChange={(e) => setNewRuleValue(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Save Reward Rule</span>
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              <div className="p-4 border-b border-slate-800">
                <h3 className="font-bold text-base text-slate-100">
                  Active Commission Calculation Rules
                </h3>
              </div>

              <div className="divide-y divide-slate-800">
                {loadingRules ? (
                  <div className="p-8 text-center text-slate-500">Loading rules...</div>
                ) : rewardRules.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">No reward rules created.</div>
                ) : (
                  rewardRules.map((rule) => (
                    <div key={rule.id} className="p-4 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-200">{rule.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          Type: {rule.rule_type} · Value:{' '}
                          {rule.rule_type === 'percentage'
                            ? `${rule.value}%`
                            : formatCurrency(rule.value)}
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
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
