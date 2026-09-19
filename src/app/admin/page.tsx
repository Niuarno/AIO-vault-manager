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
  X,
  Pencil,
  Lock,
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
import { QuotaTier } from '@/lib/commission';

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
  const [editingCostId, setEditingCostId] = useState<string | null>(null);
  const [editingCostVal, setEditingCostVal] = useState<string>('');
  const [savingCostId, setSavingCostId] = useState<string | null>(null);

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

  // Website Commission Quota Tiers State
  const [quotaTiers, setQuotaTiers] = useState<QuotaTier[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [newTierName, setNewTierName] = useState('');
  const [newTierQuota, setNewTierQuota] = useState('');
  const [newTierBonus, setNewTierBonus] = useState('');
  const [editingTier, setEditingTier] = useState<QuotaTier | null>(null);
  const [deletingTierId, setDeletingTierId] = useState<string | null>(null);

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
        setQuotaTiers(json.rules);
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

  // Admin Staff Assignment Handler
  const handleAssignStaff = async (orderId: string, newStaffId: string | null) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sales_rep_id: newStaffId }),
      });
      const data = await res.json();
      if (data.success && data.order) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? { ...o, sales_rep_id: newStaffId, sales_rep: data.order.sales_rep }
              : o
          )
        );
      } else {
        alert(data.error || 'Failed to assign order');
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

  // Save / Update Buying Price (Cost Price) for Variant
  const handleSaveBuyingPrice = async (variantId: string) => {
    const costPriceNum = parseFloat(editingCostVal);
    if (isNaN(costPriceNum) || costPriceNum < 0) {
      alert('Please enter a valid non-negative buying price.');
      return;
    }

    setSavingCostId(variantId);
    try {
      const res = await fetch('/api/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variant_id: variantId,
          cost_price: costPriceNum,
        }),
      });

      const json = await res.json();
      if (json.success && json.variant) {
        setVariants((prev) =>
          prev.map((v) =>
            v.id === variantId ? { ...v, cost_price: json.variant.cost_price } : v
          )
        );
        setEditingCostId(null);
        setEditingCostVal('');
      } else {
        alert(json.error || 'Failed to update buying price');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating buying price');
    } finally {
      setSavingCostId(null);
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

  // Add new Quota Tier
  const handleCreateTier = async (e: React.FormEvent) => {
    e.preventDefault();
    const quota = parseFloat(newTierQuota);
    const bonus = parseFloat(newTierBonus);

    if (isNaN(quota) || quota <= 0) {
      alert('Please enter a valid positive quota amount (Extra Sales Added).');
      return;
    }
    if (isNaN(bonus) || bonus <= 0) {
      alert('Please enter a valid positive bonus amount.');
      return;
    }

    try {
      const res = await fetch('/api/rewards/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTierName.trim() || `Tier (৳${quota.toLocaleString()}+)`,
          min_quota: quota,
          bonus: bonus,
          is_active: true,
        }),
      });
      const json = await res.json();
      if (json.success && json.rule) {
        setQuotaTiers((prev) =>
          [...prev, json.rule].sort((a, b) => a.min_quota - b.min_quota)
        );
        setNewTierName('');
        setNewTierQuota('');
        setNewTierBonus('');
      } else {
        alert(json.error || 'Failed to create quota tier');
      }
    } catch (err: any) {
      alert(err.message || 'Error creating quota tier');
    }
  };

  // Update existing Quota Tier
  const handleUpdateTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTier) return;

    try {
      const res = await fetch('/api/rewards/rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingTier.id,
          name: editingTier.name,
          min_quota: editingTier.min_quota,
          bonus: editingTier.bonus,
          is_active: editingTier.is_active,
        }),
      });
      const json = await res.json();
      if (json.success && json.rule) {
        setQuotaTiers((prev) =>
          prev
            .map((t) => (t.id === editingTier.id ? json.rule : t))
            .sort((a, b) => a.min_quota - b.min_quota)
        );
        setEditingTier(null);
      } else {
        alert(json.error || 'Failed to update quota tier');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating quota tier');
    }
  };

  // Toggle Tier Active / Inactive
  const handleToggleTierActive = async (tier: QuotaTier) => {
    try {
      const res = await fetch('/api/rewards/rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tier.id,
          is_active: !tier.is_active,
        }),
      });
      const json = await res.json();
      if (json.success && json.rule) {
        setQuotaTiers((prev) =>
          prev.map((t) => (t.id === tier.id ? json.rule : t))
        );
      }
    } catch (err: any) {
      alert(err.message || 'Error toggling rule status');
    }
  };

  // Delete Quota Tier
  const handleDeleteTier = async (tierId: string) => {
    if (!confirm('Are you sure you want to delete this commission quota tier?')) return;
    setDeletingTierId(tierId);
    try {
      const res = await fetch(`/api/rewards/rules?id=${tierId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        setQuotaTiers((prev) => prev.filter((t) => t.id !== tierId));
      } else {
        alert(json.error || 'Failed to delete quota tier');
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting quota tier');
    } finally {
      setDeletingTierId(null);
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
      {
        todayEarnings: number;
        piggybank: number;
        totalSettled: number;
        orderCount: number;
        todayWebsiteUpsells: number;
        unlockedTier: QuotaTier | null;
      }
    > = {};

    salesTeam.forEach((member) => {
      stats[member.id] = {
        todayEarnings: 0,
        piggybank: 0,
        totalSettled: 0,
        orderCount: 0,
        todayWebsiteUpsells: 0,
        unlockedTier: null,
      };
    });

    teamRewards.forEach((r) => {
      const repId = r.sales_rep_id;
      if (!stats[repId]) {
        stats[repId] = {
          todayEarnings: 0,
          piggybank: 0,
          totalSettled: 0,
          orderCount: 0,
          todayWebsiteUpsells: 0,
          unlockedTier: null,
        };
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
      const repId = o.sales_rep_id;
      if (repId && stats[repId]) {
        stats[repId].orderCount++;
        // If order from website and created today, accumulate upsells
        if (o.source === 'website' && o.created_at?.startsWith(today) && o.status !== 'canceled') {
          (o.order_items || []).forEach((item) => {
            if (item.is_upsell) {
              stats[repId].todayWebsiteUpsells +=
                (Number(item.price) || 0) * (Number(item.quantity) || 1);
            }
          });
        }
      }
    });

    // Determine highest unlocked quota tier for each staff member
    Object.keys(stats).forEach((staffId) => {
      const upsellVal = stats[staffId].todayWebsiteUpsells;
      const matched = [...quotaTiers]
        .filter((t) => t.is_active && t.min_quota > 0)
        .sort((a, b) => b.min_quota - a.min_quota)
        .find((t) => upsellVal >= t.min_quota);
      stats[staffId].unlockedTier = matched || null;
    });

    return stats;
  }, [salesTeam, teamRewards, orders, quotaTiers]);

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

  // Inventory Analytics (Admin-Only Financial Overview)
  const inventoryAnalytics = useMemo(() => {
    let totalUnits = 0;
    let totalCostVal = 0;
    let totalRetailVal = 0;
    let variantsWithCost = 0;

    variants.forEach((v) => {
      const stock = Math.max(0, v.stock_quantity || 0);
      const cost = v.cost_price != null ? Number(v.cost_price) : 0;
      const price = Number(v.price) || 0;

      totalUnits += stock;
      totalCostVal += cost * stock;
      totalRetailVal += price * stock;
      if (cost > 0) variantsWithCost++;
    });

    const projectedProfit = totalRetailVal - totalCostVal;
    const overallMargin = totalRetailVal > 0 ? (projectedProfit / totalRetailVal) * 100 : 0;

    return {
      totalUnits,
      totalCostVal,
      totalRetailVal,
      projectedProfit,
      overallMargin: Math.round(overallMargin),
      variantsWithCost,
      totalVariants: variants.length,
    };
  }, [variants]);

  // Get Clean Status Badge Dot
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
                    <option value="not_reachable">Not Reachable</option>
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
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-700 shrink-0">
                                  {order.sales_rep?.avatar_url ? (
                                    <img src={order.sales_rep.avatar_url} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    order.sales_rep?.full_name?.charAt(0) || 'U'
                                  )}
                                </div>
                                <select
                                  value={order.sales_rep_id || ''}
                                  onChange={(e) =>
                                    handleAssignStaff(order.id, e.target.value || null)
                                  }
                                  className="text-xs font-semibold px-2 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer shadow-2xs max-w-[140px] truncate"
                                  title="Assign staff to this order (Admin only)"
                                >
                                  <option value="">Unassigned</option>
                                  {salesTeam.map((staff) => (
                                    <option key={staff.id} value={staff.id}>
                                      {staff.full_name || staff.email}
                                    </option>
                                  ))}
                                </select>
                              </div>
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
                                  <option value="not_reachable">Not Reachable</option>
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
            {/* Inventory Valuation & Financial Overview (Admin Only) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider">Total Stock</span>
                  <Boxes className="w-4 h-4 text-slate-400" />
                </div>
                <div className="text-2xl font-black text-slate-900 font-mono">
                  {inventoryAnalytics.totalUnits}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Across {inventoryAnalytics.totalVariants} variants ({filteredVariants.length} shown)
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wider">Cost Valuation</span>
                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 flex items-center gap-0.5" title="Strictly confidential to admin">
                      <Lock className="w-2.5 h-2.5" />
                      Admin
                    </span>
                  </div>
                  <DollarSign className="w-4 h-4 text-slate-400" />
                </div>
                <div className="text-2xl font-black text-slate-900 font-mono">
                  {formatCurrency(inventoryAnalytics.totalCostVal)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {inventoryAnalytics.variantsWithCost} of {inventoryAnalytics.totalVariants} items cost-priced
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider">Retail Value</span>
                  <Tag className="w-4 h-4 text-slate-400" />
                </div>
                <div className="text-2xl font-black text-slate-900 font-mono">
                  {formatCurrency(inventoryAnalytics.totalRetailVal)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Total selling inventory value
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider">Est. Gross Profit</span>
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-black text-emerald-700 font-mono">
                  +{formatCurrency(inventoryAnalytics.projectedProfit)}
                </div>
                <div className="text-[11px] text-emerald-700/80 font-medium mt-1">
                  {inventoryAnalytics.overallMargin}% projected margin
                </div>
              </div>
            </div>

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
                      <th className="p-4">
                        <div className="flex items-center gap-1.5">
                          <span>Buying Price</span>
                          <span className="text-[9px] font-bold text-slate-700 bg-slate-200/80 px-1.5 py-0.5 rounded border border-slate-300 flex items-center gap-0.5">
                            <ShieldCheck className="w-2.5 h-2.5" />
                            Admin Only
                          </span>
                        </div>
                      </th>
                      <th className="p-4">Selling Price</th>
                      <th className="p-4">Unit Margin</th>
                      <th className="p-4">Current Stock</th>
                      <th className="p-4 text-center">Quick Stock Adjust</th>
                      <th className="p-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingInventory ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400">
                          Loading inventory...
                        </td>
                      </tr>
                    ) : filteredVariants.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400">
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
                              {variant.sku || '—'}
                            </td>

                            {/* Buying Price (Cost Price) - Admin Only Editable */}
                            <td className="p-4">
                              {editingCostId === variant.id ? (
                                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                  <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">৳</span>
                                    <input
                                      type="number"
                                      min="0"
                                      step="any"
                                      autoFocus
                                      disabled={savingCostId === variant.id}
                                      value={editingCostVal}
                                      onChange={(e) => setEditingCostVal(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          handleSaveBuyingPrice(variant.id);
                                        } else if (e.key === 'Escape') {
                                          setEditingCostId(null);
                                          setEditingCostVal('');
                                        }
                                      }}
                                      className="w-24 pl-5 pr-2 py-1 text-xs font-mono font-semibold text-slate-900 bg-white border-2 border-emerald-500 rounded-lg shadow-xs focus:outline-none"
                                      placeholder="0.00"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    disabled={savingCostId === variant.id}
                                    onClick={() => handleSaveBuyingPrice(variant.id)}
                                    className="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-colors shadow-2xs disabled:opacity-50"
                                    title="Save buying price"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={savingCostId === variant.id}
                                    onClick={() => {
                                      setEditingCostId(null);
                                      setEditingCostVal('');
                                    }}
                                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
                                    title="Cancel"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="group flex items-center gap-1.5">
                                  <div className="font-mono text-xs">
                                    {variant.cost_price != null && Number(variant.cost_price) > 0 ? (
                                      <span className="font-semibold text-slate-900 bg-slate-100 px-2 py-1 rounded-md border border-slate-200/80">
                                        {formatCurrency(variant.cost_price)}
                                      </span>
                                    ) : (
                                      <span className="text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-200 text-[11px] font-semibold">
                                        Set Price
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingCostId(variant.id);
                                      setEditingCostVal(
                                        variant.cost_price != null && Number(variant.cost_price) > 0
                                          ? String(variant.cost_price)
                                          : ''
                                      );
                                    }}
                                    className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                                    title="Click to set/edit buying price"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>

                            {/* Selling Price */}
                            <td className="p-4 font-semibold text-slate-900 font-mono text-xs">
                              {formatCurrency(variant.price)}
                            </td>

                            {/* Unit Margin / Profit */}
                            <td className="p-4">
                              {variant.cost_price != null && Number(variant.cost_price) > 0 ? (
                                (() => {
                                  const cost = Number(variant.cost_price);
                                  const price = Number(variant.price);
                                  const profit = price - cost;
                                  const marginPct = price > 0 ? Math.round((profit / price) * 100) : 0;
                                  const isPositive = profit >= 0;

                                  return (
                                    <span
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                                        isPositive
                                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                          : 'bg-rose-50 text-rose-800 border-rose-200'
                                      }`}
                                    >
                                      {isPositive ? `+${formatCurrency(profit)}` : `-${formatCurrency(Math.abs(profit))}`}
                                      <span className="text-[10px] opacity-75">({marginPct}%)</span>
                                    </span>
                                  );
                                })()
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
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
                      <th className="p-4">
                        <div className="flex items-center gap-1">
                          <span>Extra Sales (Website)</span>
                          <span className="text-[9px] font-bold text-slate-600 bg-slate-200 px-1 py-0.5 rounded">Today</span>
                        </div>
                      </th>
                      <th className="p-4">Quota Milestone</th>
                      <th className="p-4">Today's Earnings</th>
                      <th className="p-4">Piggybank (Pending)</th>
                      <th className="p-4">Settled Total</th>
                      <th className="p-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingTeam ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-slate-400">
                          Loading sales team...
                        </td>
                      </tr>
                    ) : salesTeam.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-slate-400">
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
                          todayWebsiteUpsells: 0,
                          unlockedTier: null,
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

                            {/* Extra Sales Added on Website Orders Today */}
                            <td className="p-4">
                              <div className="font-bold text-slate-900 font-mono text-xs">
                                {formatCurrency(stats.todayWebsiteUpsells || 0)}
                              </div>
                              <div className="text-[10px] text-slate-400">Website Upsells</div>
                            </td>

                            {/* Unlocked Quota Tier */}
                            <td className="p-4">
                              {stats.unlockedTier ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  <span>{stats.unlockedTier.name}</span>
                                  <span className="opacity-75 font-mono">(+{formatCurrency(stats.unlockedTier.bonus)})</span>
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400 font-medium">Below Tier 1</span>
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
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Create Quota Tier Form */}
              <div className="space-y-4">
                <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs">
                  <h3 className="font-bold text-base text-slate-900 flex items-center gap-2 mb-1">
                    <Award className="w-4 h-4 text-emerald-600" />
                    <span>Create Quota Milestone Tier</span>
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Set bonus milestones for extra sales added on website orders
                  </p>

                  <form onSubmit={handleCreateTier} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tier Name / Label *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Tier 8 or High Ticket Extra"
                        value={newTierName}
                        onChange={(e) => setNewTierName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Min Extra Sales Added (Quota BDT) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">৳</span>
                        <input
                          type="number"
                          required
                          min="1"
                          step="any"
                          placeholder="3000"
                          value={newTierQuota}
                          onChange={(e) => setNewTierQuota(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3.5 py-2.5 text-sm font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Commission Bonus (BDT) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">৳</span>
                        <input
                          type="number"
                          required
                          min="1"
                          step="any"
                          placeholder="100"
                          value={newTierBonus}
                          onChange={(e) => setNewTierBonus(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3.5 py-2.5 text-sm font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    {parseFloat(newTierQuota) > 0 && parseFloat(newTierBonus) > 0 && (
                      <div className="p-3 bg-emerald-50/80 border border-emerald-200/80 rounded-xl text-xs text-emerald-900 flex items-center justify-between">
                        <span className="font-medium">Effective Bonus Rate:</span>
                        <span className="font-bold font-mono text-sm">
                          {((parseFloat(newTierBonus) / parseFloat(newTierQuota)) * 100).toFixed(2)}%
                        </span>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm transition-all shadow-xs flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Quota Tier</span>
                    </button>
                  </form>
                </div>

                {/* Scope Guidance Info Card */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 space-y-2">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Website Order Quota Rules</span>
                  </div>
                  <ul className="space-y-1 text-[11px] list-disc list-inside text-slate-500">
                    <li>Applies exclusively to <strong>Website Orders</strong> (`source = website`).</li>
                    <li>Extra sales combine across all website orders upsold today.</li>
                    <li>Passing a quota milestone unlocks that tier's fixed bonus.</li>
                    <li>Daily commissions reset at 12:00 AM midnight.</li>
                  </ul>
                </div>
              </div>

              {/* Right 2 Columns: Quota Tiers Table (From Image 2) */}
              <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs flex flex-col justify-between">
                <div>
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-base text-slate-900">
                        Website Order Upsell Commission Rules
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Extra sales milestones required to earn progressive staff commission bonuses
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      <WebsiteFlatIcon className="w-3.5 h-3.5" />
                      <span>Website Only</span>
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-700">
                      <thead className="bg-slate-50/80 border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <tr>
                          <th className="p-4">Tier & Quota</th>
                          <th className="p-4">Bonus Reward</th>
                          <th className="p-4">Effective Rate</th>
                          <th className="p-4">Scope</th>
                          <th className="p-4">Status</th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {loadingRules ? (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-400">
                              Loading commission rules...
                            </td>
                          </tr>
                        ) : quotaTiers.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-400">
                              No commission quota tiers configured.
                            </td>
                          </tr>
                        ) : (
                          quotaTiers.map((tier) => (
                            <tr
                              key={tier.id}
                              className={`hover:bg-slate-50/70 transition-colors ${
                                !tier.is_active ? 'opacity-50 bg-slate-50/30' : ''
                              }`}
                            >
                              <td className="p-4">
                                <div className="font-bold text-slate-900">{tier.name}</div>
                                <div className="text-xs text-slate-500 font-mono mt-0.5">
                                  Min Extra Sales: {formatCurrency(tier.min_quota)}+
                                </div>
                              </td>

                              <td className="p-4 font-bold text-slate-900 font-mono text-base">
                                {formatCurrency(tier.bonus)}
                              </td>

                              <td className="p-4">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono">
                                  {tier.effective_pct}%
                                </span>
                              </td>

                              <td className="p-4">
                                <span className="inline-flex items-center gap-1 text-xs text-slate-600 font-medium">
                                  <WebsiteFlatIcon className="w-3.5 h-3.5" />
                                  <span>Website Orders</span>
                                </span>
                              </td>

                              <td className="p-4">
                                <button
                                  type="button"
                                  onClick={() => handleToggleTierActive(tier)}
                                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                                    tier.is_active
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                      : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                                  }`}
                                >
                                  {tier.is_active ? 'Active' : 'Disabled'}
                                </button>
                              </td>

                              <td className="p-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setEditingTier(tier)}
                                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
                                    title="Edit Quota Tier"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={deletingTierId === tier.id}
                                    onClick={() => handleDeleteTier(tier.id)}
                                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors disabled:opacity-40"
                                    title="Delete Quota Tier"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* Edit Quota Tier Modal */}
            {editingTier && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
                <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h4 className="font-bold text-base text-slate-900 flex items-center gap-2">
                      <Pencil className="w-4 h-4 text-slate-600" />
                      <span>Edit Commission Quota Tier</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setEditingTier(null)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handleUpdateTier} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tier Name / Label
                      </label>
                      <input
                        type="text"
                        required
                        value={editingTier.name}
                        onChange={(e) =>
                          setEditingTier({ ...editingTier, name: e.target.value })
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Min Extra Sales Added (Quota BDT)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">৳</span>
                        <input
                          type="number"
                          required
                          min="1"
                          step="any"
                          value={editingTier.min_quota}
                          onChange={(e) =>
                            setEditingTier({
                              ...editingTier,
                              min_quota: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3.5 py-2 text-sm font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Commission Bonus (BDT)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">৳</span>
                        <input
                          type="number"
                          required
                          min="1"
                          step="any"
                          value={editingTier.bonus}
                          onChange={(e) =>
                            setEditingTier({
                              ...editingTier,
                              bonus: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3.5 py-2 text-sm font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    {editingTier.min_quota > 0 && editingTier.bonus > 0 && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between">
                        <span className="font-medium">Effective Rate:</span>
                        <span className="font-bold font-mono">
                          {((editingTier.bonus / editingTier.min_quota) * 100).toFixed(2)}%
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditingTier(null)}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs"
                      >
                        Save Changes
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
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
