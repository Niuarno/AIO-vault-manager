'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/Navbar';
import {
  Package,
  Truck,
  CheckCircle2,
  Printer,
  Search,
  RefreshCw,
  Phone,
  MapPin,
  Clock,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  Filter,
  CheckSquare,
  Square,
  Box,
  Boxes,
  Plus,
  Minus,
  Sparkles,
  Send,
  Radio,
} from 'lucide-react';
import { Order, OrderStatus, Profile, Product, ProductVariant } from '@/types/database';
import {
  formatCurrency,
  formatDate,
  getStatusBadgeInfo,
  getOrderDiscount,
  getOrderAdvance,
  getOrderDeliveryCharge,
  shrinkProductTitle,
} from '@/lib/utils';
import {
  getSteadfastTrackingUrl,
  parseSteadfastStatus,
} from '@/lib/steadfast';
import SteadfastWebhookModal from '@/components/SteadfastWebhookModal';

export default function PackingDashboard() {
  const router = useRouter();
  const supabase = createClient();

  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'confirmed' | 'ready_to_ship' | 'on_the_way' | 'shipped'>('confirmed');
  const [searchQuery, setSearchQuery] = useState('');
  const [syncingAll, setSyncingAll] = useState(false);

  // Steadfast Balance & Bulk Dispatch State
  const [steadfastBalance, setSteadfastBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [bulkDispatching, setBulkDispatching] = useState(false);
  const [bulkSyncing, setBulkSyncing] = useState(false);

  // Tab Switcher: Fulfillment Queue vs Live Stock Management
  const [activeMainTab, setActiveMainTab] = useState<'queue' | 'inventory'>('queue');

  // Stock Management State
  const [inventoryProducts, setInventoryProducts] = useState<Product[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [inventorySearch, setInventorySearch] = useState('');
  const [adjustingVariantId, setAdjustingVariantId] = useState<string | null>(null);

  // Selected Order for Packing Slip Modal / Print
  const [selectedOrderForSlip, setSelectedOrderForSlip] = useState<Order | null>(null);

  // Custom Steadfast Item Description per order (strictly limited to 255 chars)
  const [customItemDescs, setCustomItemDescs] = useState<Record<string, string>>({});
  const [editingDescOrderId, setEditingDescOrderId] = useState<string | null>(null);

  // Robustly resolve consignment ID across schema variations, external_id, notes, and edit history
  const getOrderConsignmentId = (order: Order): string | null => {
    if (order.consignment_id) return String(order.consignment_id);
    if (order.external_id && !order.external_id.startsWith('http')) return String(order.external_id);
    if (order.note) {
      const match = order.note.match(/CID:\s*#?([A-Za-z0-9_-]+)/i);
      if (match) return match[1];
    }
    if (Array.isArray(order.edit_history)) {
      for (const h of order.edit_history) {
        if (h?.consignment_id) return String(h.consignment_id);
      }
    }
    return null;
  };

  // Robustly resolve tracking code across schema variations, notes, and edit history
  const getOrderTrackingCode = (order: Order): string | null => {
    if (order.tracking_code) return String(order.tracking_code);
    if (order.note) {
      const match = order.note.match(/Tracking:\s*([A-Za-z0-9_-]+)/i);
      if (match) return match[1];
    }
    if (Array.isArray(order.edit_history)) {
      for (const h of order.edit_history) {
        if (h?.tracking_code) return String(h.tracking_code);
      }
    }
    return null;
  };

  // Load User & Check Auth
  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        // Only admin and packing (or sales if granted) can view packing portal
        if (profile.role !== 'admin' && profile.role !== 'packing') {
          router.push('/sales');
          return;
        }
        setCurrentProfile(profile);
      }
    }

    loadUser();
  }, [router]);

  // Fetch only fulfilled / confirmed pipeline orders (NEVER pending or canceled)
  const fetchPackingOrders = async () => {
    setLoading(true);
    // Strict query: ONLY allowed statuses
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .in('status', ['confirmed', 'ready_to_ship', 'on_the_way', 'shipped'])
      .order('created_at', { ascending: false });

    if (!error && data) {
      setOrders(data as Order[]);
    }
    setLoading(false);
  };

  // Fetch Live Inventory for Stock Management
  const fetchInventory = async () => {
    setLoadingInventory(true);
    const { data, error } = await supabase
      .from('products')
      .select('*, variants:product_variants(*)')
      .eq('is_active', true)
      .order('title', { ascending: true });

    if (!error && data) {
      setInventoryProducts(data as Product[]);
    }
    setLoadingInventory(false);
  };

  // Adjust stock quantity via /api/inventory/adjust
  const handleAdjustStock = async (variantId: string, changeAmount: number) => {
    setAdjustingVariantId(variantId);
    try {
      const res = await fetch('/api/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variant_id: variantId,
          change_amount: changeAmount,
          reason: 'manual_adjustment',
          adjusted_by: currentProfile?.full_name || 'Delivery Team',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to adjust stock');
      }

      setInventoryProducts((prev) =>
        prev.map((p) => ({
          ...p,
          variants: p.variants?.map((v) =>
            v.id === variantId ? { ...v, stock_quantity: data.new_stock } : v
          ),
        }))
      );
    } catch (err: any) {
      alert(err.message || 'Error updating stock');
    } finally {
      setAdjustingVariantId(null);
    }
  };

  // Fetch Steadfast Account Balance
  const fetchSteadfastBalance = async () => {
    setLoadingBalance(true);
    try {
      const res = await fetch('/api/shipping/steadfast/balance');
      const data = await res.json();
      if (data.success && typeof data.current_balance === 'number') {
        setSteadfastBalance(data.current_balance);
      } else {
        setSteadfastBalance(null);
      }
    } catch {
      setSteadfastBalance(null);
    } finally {
      setLoadingBalance(false);
    }
  };

  useEffect(() => {
    fetchPackingOrders();
    fetchSteadfastBalance();

    // Auto-refresh polling every 12 seconds for packing queue
    const timer = setInterval(() => {
      fetchPackingOrders();
    }, 12000);

    // Supabase Realtime channel subscription for instant dispatch on status changes
    const channel = supabase
      .channel('packing-realtime-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          fetchPackingOrders();
        }
      )
      .subscribe();

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, []);

  // Update Status Progression
  const handleStatusChange = async (orderId: string, nextStatus: OrderStatus) => {
    setUpdatingId(orderId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: nextStatus }),
      });

      if (res.ok) {
        // Update local state smoothly
        setOrders((prev) =>
          prev.map((ord) => (ord.id === orderId ? { ...ord, status: nextStatus } : ord))
        );
      } else {
        const data = await res.json();
        alert(`Status update failed: ${data.error || 'Server error'}`);
      }
    } catch (err: any) {
      alert(`Error updating status: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  // Dispatch Order to Steadfast Courier
  const handleSendToSteadfast = async (order: Order, customItemDesc?: string) => {
    setDispatchingId(order.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch('/api/shipping/steadfast/dispatch', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          orderId: order.id,
          itemDescription: customItemDesc || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const newCid =
          data.consignment?.consignment_id ||
          data.consignment?.id ||
          data.order?.consignment_id;
        const newTracking =
          data.consignment?.tracking_code ||
          data.order?.tracking_code;

        setOrders((prev) =>
          prev.map((ord) =>
            ord.id === order.id
              ? {
                  ...(data.order || ord),
                  status: 'on_the_way',
                  courier_name: 'steadfast',
                  consignment_id: newCid ? String(newCid) : (ord.consignment_id || null),
                  tracking_code: newTracking ? String(newTracking) : (ord.tracking_code || null),
                  courier_status: data.consignment?.status || 'in_review',
                }
              : ord
          )
        );
        alert(`Dispatched to Steadfast! Consignment ID: #${newCid || 'Generated'}`);
      } else {
        alert(`Steadfast Dispatch Error: ${data.error || 'Failed to dispatch'}`);
      }
    } catch (err: any) {
      alert(`Error sending to Steadfast: ${err.message}`);
    } finally {
      setDispatchingId(null);
    }
  };

  // Check live status on demand from Steadfast Courier and retrieve consignment ID
  const handleSyncSteadfast = async (order: Order) => {
    setSyncingId(order.id);
    try {
      const res = await fetch('/api/shipping/steadfast/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const newCid = data.consignment_id || data.order?.consignment_id;
        setOrders((prev) =>
          prev.map((ord) => (ord.id === order.id ? data.order || ord : ord))
        );
        alert(
          data.message ||
            (newCid ? `Retrieved Consignment ID #${newCid}!` : 'Status synced successfully!')
        );
      } else {
        alert(data.message || data.error || 'Could not fetch status from Steadfast.');
      }
    } catch (err: any) {
      alert(`Error syncing Steadfast: ${err.message}`);
    } finally {
      setSyncingId(null);
    }
  };

  // Manually link or edit a Steadfast Consignment ID
  const handleManualCidPrompt = async (order: Order) => {
    const currentCid = getOrderConsignmentId(order) || '';
    const input = window.prompt(
      `Enter Steadfast Consignment ID for order ${order.order_number}:`,
      currentCid
    );
    if (input === null) return;
    const cid = input.trim();
    if (!cid) {
      alert('Consignment ID cannot be empty.');
      return;
    }

    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consignment_id: cid,
          courier_name: 'steadfast',
          note: order.note || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setOrders((prev) =>
          prev.map((ord) =>
            ord.id === order.id
              ? { ...ord, consignment_id: cid, courier_name: 'steadfast' }
              : ord
          )
        );
        alert(`Consignment ID #${cid} linked successfully!`);
      } else {
        alert(`Failed to save Consignment ID: ${data.error || 'Server error'}`);
      }
    } catch (err: any) {
      alert(`Error saving Consignment ID: ${err.message}`);
    }
  };

  // Sync / retrieve consignment IDs for all orders in "With Courier" missing one
  const handleSyncAllMissingCid = async () => {
    const missing = orders.filter(
      (o) => o.status === 'on_the_way' && !getOrderConsignmentId(o)
    );
    if (missing.length === 0) {
      alert('All orders in "With Courier" already have Consignment IDs!');
      return;
    }
    setSyncingAll(true);
    let successCount = 0;
    for (const ord of missing) {
      try {
        const res = await fetch('/api/shipping/steadfast/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: ord.id }),
        });
        const data = await res.json();
        if (res.ok && data.success && (data.consignment_id || data.order?.consignment_id)) {
          successCount++;
          setOrders((prev) =>
            prev.map((o) => (o.id === ord.id ? data.order || o : o))
          );
        }
      } catch {}
    }
    setSyncingAll(false);
    fetchPackingOrders();
    alert(`Retrieved consignment details for ${successCount} of ${missing.length} orders.`);
  };

  // 1-Click Bulk Dispatch selected orders to Steadfast
  const handleBulkDispatch = async () => {
    if (selectedOrderIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to dispatch ${selectedOrderIds.length} order(s) to Steadfast Courier?`)) {
      return;
    }

    setBulkDispatching(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch('/api/shipping/steadfast/dispatch', {
        method: 'POST',
        headers,
        body: JSON.stringify({ orderIds: selectedOrderIds }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert(`Successfully dispatched ${data.successCount} of ${data.total} order(s) to Steadfast Courier!`);
        setSelectedOrderIds([]);
        fetchPackingOrders();
        fetchSteadfastBalance();
      } else {
        alert(data.error || 'Failed to bulk dispatch orders.');
      }
    } catch (err: any) {
      alert(`Bulk dispatch error: ${err.message}`);
    } finally {
      setBulkDispatching(false);
    }
  };

  // 1-Click Bulk Sync status for all orders in transit
  const handleBulkSyncAll = async () => {
    const onTheWayOrders = orders.filter((o) => o.status === 'on_the_way');
    if (onTheWayOrders.length === 0) {
      alert('No orders are currently in transit ("With Courier") to sync.');
      return;
    }

    setBulkSyncing(true);
    try {
      const res = await fetch('/api/shipping/steadfast/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: onTheWayOrders.map((o) => o.id) }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`Successfully updated delivery status for ${data.successCount} of ${data.total} in-transit orders!`);
        fetchPackingOrders();
        fetchSteadfastBalance();
      } else {
        alert(data.message || data.error || 'Failed to sync all orders.');
      }
    } catch (err: any) {
      alert(`Bulk sync error: ${err.message}`);
    } finally {
      setBulkSyncing(false);
    }
  };

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    const matchesFilter =
      activeFilter === 'all'
        ? true
        : order.status === activeFilter;

    const matchesSearch =
      searchQuery === '' ||
      order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.shipping_address.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  // Status counts for pipeline tabs
  const confirmedCount = orders.filter((o) => o.status === 'confirmed').length;
  const readyCount = orders.filter((o) => o.status === 'ready_to_ship').length;
  const onTheWayCount = orders.filter((o) => o.status === 'on_the_way').length;
  const shippedCount = orders.filter((o) => o.status === 'shipped').length;

  // Filtered products for stock management
  const filteredProducts = useMemo(() => {
    return inventoryProducts.filter((p) => {
      if (!inventorySearch.trim()) return true;
      const q = inventorySearch.toLowerCase();
      const titleMatch = p.title?.toLowerCase().includes(q);
      const variantMatch = p.variants?.some(
        (v) =>
          v.title?.toLowerCase().includes(q) ||
          (v.sku && v.sku.toLowerCase().includes(q))
      );
      return titleMatch || variantMatch;
    });
  }, [inventoryProducts, inventorySearch]);

  const triggerPrint = (order: Order) => {
    setSelectedOrderForSlip(order);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header / Navbar */}
      <div className="no-print">
        <Navbar currentProfile={currentProfile} />
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Main Tab Switcher: Fulfillment Queue vs Live Stock Management */}
        <div className="no-print flex items-center gap-2 mb-6 border-b border-slate-200 pb-3">
          <button
            type="button"
            onClick={() => setActiveMainTab('queue')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeMainTab === 'queue'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Fulfillment Queue</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                activeMainTab === 'queue' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {orders.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMainTab('inventory');
              if (inventoryProducts.length === 0) {
                fetchInventory();
              }
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeMainTab === 'inventory'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Live Stock & Inventory</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                activeMainTab === 'inventory'
                  ? 'bg-white/20 text-white'
                  : 'bg-emerald-50 text-emerald-800'
              }`}
            >
              Stock Control
            </span>
          </button>
        </div>

        {/* FULFILLMENT QUEUE TAB */}
        {activeMainTab === 'queue' && (
          <>
            {/* Top Notification Banner for Packing Team Security */}
        <div className="no-print mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-200 text-amber-900 flex items-center justify-center font-bold">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold">Fulfillment & Packing Station</h2>
              <p className="text-xs text-amber-800">
                Only verified, confirmed orders are loaded into this queue. Unconfirmed and canceled orders are strictly excluded.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 flex-wrap gap-2">
            {steadfastBalance !== null && (
              <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-900 text-white text-xs font-bold shadow-xs">
                <span>Steadfast:</span>
                <span className="text-emerald-300 font-mono">৳{steadfastBalance.toLocaleString()}</span>
                <button
                  type="button"
                  onClick={fetchSteadfastBalance}
                  disabled={loadingBalance}
                  className="ml-1 text-emerald-400 hover:text-emerald-200 transition-colors cursor-pointer"
                  title="Refresh Steadfast Balance"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingBalance ? 'animate-spin' : ''}`} />
                </button>
              </div>
            )}
            <button
              onClick={() => setIsWebhookModalOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-900 text-amber-50 hover:bg-amber-950 text-xs font-semibold shadow-xs transition-all cursor-pointer"
              title="View Callback URL & Bearer Token for Steadfast Webhook Integration"
            >
              <Radio className="w-3.5 h-3.5 text-amber-400" />
              <span>Steadfast Webhook Setup</span>
            </button>
            <button
              onClick={fetchPackingOrders}
              disabled={loading}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 text-xs font-semibold shadow-xs transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Queue</span>
            </button>
          </div>
        </div>

        {/* Pipeline Navigation / Metrics */}
        <div className="no-print grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <button
            onClick={() => setActiveFilter('confirmed')}
            className={`p-4 rounded-2xl border text-left transition-all ${
              activeFilter === 'confirmed'
                ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400/30'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
                1. To Pack (Confirmed)
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">{confirmedCount}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Orders awaiting boxing</p>
          </button>

          <button
            onClick={() => setActiveFilter('ready_to_ship')}
            className={`p-4 rounded-2xl border text-left transition-all ${
              activeFilter === 'ready_to_ship'
                ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-400/30'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
                2. Packed (Ready to Ship)
              </span>
              <Package className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">{readyCount}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Boxed & ready for pickup</p>
          </button>

          <button
            onClick={() => setActiveFilter('on_the_way')}
            className={`p-4 rounded-2xl border text-left transition-all ${
              activeFilter === 'on_the_way'
                ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-400/30'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                3. With Courier
              </span>
              <Truck className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">{onTheWayCount}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Handed over to delivery</p>
          </button>

          <button
            onClick={() => setActiveFilter('shipped')}
            className={`p-4 rounded-2xl border text-left transition-all ${
              activeFilter === 'shipped'
                ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400/30'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                4. Shipped / Fulfilled
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">{shippedCount}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Dispatched successfully</p>
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="no-print bg-white p-4 rounded-2xl border border-slate-200 mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between shadow-xs">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search by order #, phone, customer, or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end flex-wrap gap-2">
            {activeFilter === 'ready_to_ship' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const readyOrders = filteredOrders.filter((o) => o.status === 'ready_to_ship');
                    if (selectedOrderIds.length === readyOrders.length && readyOrders.length > 0) {
                      setSelectedOrderIds([]);
                    } else {
                      setSelectedOrderIds(readyOrders.map((o) => o.id));
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center space-x-1.5 transition-all cursor-pointer"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    {selectedOrderIds.length > 0 && selectedOrderIds.length === filteredOrders.filter((o) => o.status === 'ready_to_ship').length
                      ? 'Deselect All'
                      : `Select All Ready (${filteredOrders.filter((o) => o.status === 'ready_to_ship').length})`}
                  </span>
                </button>

                {selectedOrderIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleBulkDispatch}
                    disabled={bulkDispatching}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center space-x-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <Send className={`w-3.5 h-3.5 ${bulkDispatching ? 'animate-spin' : ''}`} />
                    <span>{bulkDispatching ? 'Dispatching...' : `Bulk Dispatch (${selectedOrderIds.length}) to Steadfast 🚀`}</span>
                  </button>
                )}
              </>
            )}

            {activeFilter === 'on_the_way' && (
              <>
                <button
                  type="button"
                  onClick={handleBulkSyncAll}
                  disabled={bulkSyncing}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center space-x-1.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs"
                  title="Sync live delivery status for all orders currently in With Courier"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${bulkSyncing ? 'animate-spin' : ''}`} />
                  <span>{bulkSyncing ? 'Syncing with Steadfast...' : 'Sync All Dispatched'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSyncAllMissingCid}
                  disabled={syncingAll}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center space-x-1.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-2xs"
                  title="Fetch consignment IDs from Steadfast for all orders currently in With Courier"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingAll ? 'animate-spin' : ''}`} />
                  <span>{syncingAll ? 'Fetching CIDs...' : 'Fetch Missing CIDs'}</span>
                </button>
              </>
            )}

            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                activeFilter === 'all'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              Show All ({orders.length})
            </button>
          </div>
        </div>

        {/* Orders Queue List */}
        {loading ? (
          <div className="no-print bg-white rounded-2xl p-12 text-center border border-slate-200">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mb-3"></div>
            <p className="text-slate-600 font-medium">Fetching verified packing orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="no-print bg-white rounded-2xl p-12 text-center border border-slate-200">
            <Box className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900">No orders in this stage</h3>
            <p className="text-sm text-slate-500 mt-1">
              {activeFilter === 'confirmed'
                ? 'All confirmed orders have been packed! Wait for new confirmations.'
                : 'No orders match your current filter criteria.'}
            </p>
          </div>
        ) : (
          <div className="no-print space-y-4">
            {filteredOrders.map((order) => {
              const badge = getStatusBadgeInfo(order.status);
              return (
                <div
                  key={order.id}
                  className={`bg-white rounded-2xl border ${
                    selectedOrderIds.includes(order.id)
                      ? 'border-blue-500 ring-2 ring-blue-100'
                      : 'border-slate-200'
                  } p-5 sm:p-6 shadow-xs hover:shadow-md transition-all`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <div className="flex items-center space-x-3">
                        {activeFilter === 'ready_to_ship' && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOrderIds((prev) =>
                                prev.includes(order.id)
                                  ? prev.filter((id) => id !== order.id)
                                  : [...prev, order.id]
                              );
                            }}
                            className="text-slate-400 hover:text-blue-600 focus:outline-none cursor-pointer"
                            title="Select order for bulk dispatch"
                          >
                            {selectedOrderIds.includes(order.id) ? (
                              <CheckSquare className="w-5 h-5 text-blue-600" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-300 hover:text-slate-400" />
                            )}
                          </button>
                        )}
                        <span className="text-lg font-black text-slate-900">
                          {order.order_number}
                        </span>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${badge.bg}`}
                        >
                          {badge.label}
                        </span>
                        <span className="text-xs text-slate-400">
                          {formatDate(order.created_at)}
                        </span>
                      </div>

                      <div className="mt-2 text-sm text-slate-700 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="font-bold text-slate-900">{order.customer_name}</span>
                        <span className="inline-flex items-center text-slate-600 font-mono">
                          <Phone className="w-3.5 h-3.5 mr-1 text-slate-400" />
                          {order.customer_phone}
                        </span>
                        <span className="inline-flex items-center text-slate-500 max-w-md truncate">
                          <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400 flex-shrink-0" />
                          {order.shipping_address}
                        </span>
                      </div>

                      {(() => {
                        const cid = getOrderConsignmentId(order);
                        const tracking = getOrderTrackingCode(order);

                        if (cid) {
                          return (
                            <div className="mt-3 flex items-center gap-2 flex-wrap text-xs">
                              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-950 font-mono text-xs font-bold shadow-2xs">
                                <Truck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                <span>Consignment ID: <span className="text-indigo-700 font-black">#{cid}</span></span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(cid);
                                    alert(`Copied Consignment ID #${cid} to clipboard`);
                                  }}
                                  className="ml-1 px-1.5 py-0.5 rounded bg-white hover:bg-indigo-100 border border-indigo-300 text-[10px] font-sans font-bold text-indigo-700 cursor-pointer transition-colors"
                                  title="Copy Consignment ID"
                                >
                                  Copy
                                </button>
                              </span>

                              {tracking && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-mono text-[11px]">
                                  <span>Tracking: {tracking}</span>
                                  <a
                                    href={getSteadfastTrackingUrl(tracking) || `https://steadfast.com.bd/t/${tracking}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="ml-1 text-indigo-600 hover:text-indigo-800 font-bold font-sans inline-flex items-center gap-0.5 cursor-pointer"
                                    title="Track live on Steadfast Courier portal"
                                  >
                                    <span>Track</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </span>
                              )}

                              {order.courier_status && (() => {
                                const parsedStatus = parseSteadfastStatus(order.courier_status);
                                return (
                                  <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider ${parsedStatus.badgeClass}`}>
                                    {parsedStatus.label}
                                  </span>
                                );
                              })()}

                              {order.tracking_message && (
                                <span className="text-slate-500 text-[11px] italic truncate max-w-sm">
                                  "{order.tracking_message}"
                                </span>
                              )}

                              <button
                                type="button"
                                onClick={() => handleSyncSteadfast(order)}
                                disabled={syncingId === order.id}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 text-[11px] font-medium transition-colors cursor-pointer"
                                title="Refresh live status from Steadfast"
                              >
                                <RefreshCw className={`w-3 h-3 ${syncingId === order.id ? 'animate-spin' : ''}`} />
                                <span>{syncingId === order.id ? 'Refreshing...' : 'Refresh Status'}</span>
                              </button>
                            </div>
                          );
                        }

                        // When order is in "With Courier" without a consignment ID linked:
                        if (order.status === 'on_the_way') {
                          return (
                            <div className="mt-3 flex items-center gap-2 flex-wrap text-xs">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-semibold text-xs">
                                <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>No Consignment ID linked</span>
                              </span>

                              <button
                                type="button"
                                onClick={() => handleSyncSteadfast(order)}
                                disabled={syncingId === order.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-2xs cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                                title="Look up consignment ID from Steadfast using order number"
                              >
                                <RefreshCw className={`w-3 h-3 ${syncingId === order.id ? 'animate-spin' : ''}`} />
                                <span>{syncingId === order.id ? 'Looking up...' : 'Get Consignment ID'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleSendToSteadfast(order)}
                                disabled={dispatchingId === order.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-2xs cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                                title="Send order to Steadfast Courier to create consignment"
                              >
                                <Send className={`w-3 h-3 ${dispatchingId === order.id ? 'animate-spin' : ''}`} />
                                <span>{dispatchingId === order.id ? 'Sending...' : 'Send to Steadfast'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleManualCidPrompt(order)}
                                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium cursor-pointer transition-colors"
                                title="Manually enter or paste Steadfast Consignment ID"
                              >
                                <span>Enter CID</span>
                              </button>
                            </div>
                          );
                        }

                        return null;
                      })()}
                    </div>

                    {/* Quick Print Button */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => triggerPrint(order)}
                        className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold transition-all active:scale-95"
                      >
                        <Printer className="w-4 h-4 text-slate-500" />
                        <span>Print Packing Slip</span>
                      </button>
                    </div>
                  </div>

                  {/* Order Line Items (Checklist Style: Partitioned Main vs Upsell) */}
                  {(() => {
                    const mainItems = (order.order_items || []).filter((i) => !i.is_upsell);
                    const upsellItems = (order.order_items || []).filter((i) => i.is_upsell);

                    return (
                      <div className="py-4 space-y-3">
                        {/* Main Products */}
                        <div>
                          <div className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2 flex items-center justify-between">
                            <span>Main Order Items ({mainItems.length})</span>
                          </div>
                          {mainItems.length === 0 ? (
                            <div className="text-xs text-slate-400 italic">No base items</div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                              {mainItems.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-start space-x-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80"
                                >
                                  <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 font-black text-sm flex items-center justify-center flex-shrink-0">
                                    {item.quantity}x
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-bold text-slate-900 truncate">
                                      {item.title}
                                    </div>
                                    {item.variant_title && (
                                      <div className="text-[11px] text-slate-500 font-medium">
                                        Variant: {item.variant_title}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Upsell Items Highlighted */}
                        {upsellItems.length > 0 && (
                          <div className="pt-2 border-t border-purple-100 bg-purple-50/40 p-3 rounded-xl">
                            <div className="text-xs font-black uppercase text-purple-700 tracking-wider mb-2 flex items-center space-x-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                              <span>Upsell Items & Add-Ons ({upsellItems.length}) - Verify Separately</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                              {upsellItems.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-start space-x-3 p-3 rounded-xl bg-white border border-purple-200 shadow-xs"
                                >
                                  <div className="w-7 h-7 rounded-lg bg-purple-600 text-white font-black text-sm flex items-center justify-center flex-shrink-0">
                                    {item.quantity}x
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center space-x-1.5">
                                      <span className="text-xs font-bold text-slate-900 truncate">
                                        {item.title}
                                      </span>
                                      <span className="px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 text-[9px] font-black shrink-0">
                                        UPSELL
                                      </span>
                                    </div>
                                    {item.variant_title && (
                                      <div className="text-[11px] text-slate-500 font-medium">
                                        Variant: {item.variant_title}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Steadfast Item Description Preview & Quick Edit */}
                        {(() => {
                          const allItems = [...mainItems, ...upsellItems];
                          if (allItems.length === 0) return null;
                          const defaultDesc = allItems
                            .map((i: any) => {
                              const qty = i.quantity || 1;
                              const rawTitle = (i.title || i.name || 'Product').trim();
                              const title = shrinkProductTitle(rawTitle, 32);
                              const variant =
                                i.variant_title && i.variant_title !== 'Default Title'
                                  ? ` (${i.variant_title.trim()})`
                                  : '';
                              return `${qty}x ${title}${variant}`;
                            })
                            .join(', ');

                          const currentDesc =
                            customItemDescs[order.id] !== undefined
                              ? customItemDescs[order.id]
                              : defaultDesc;
                          const isEditing = editingDescOrderId === order.id;
                          const displayDesc =
                            currentDesc.length > 255
                              ? currentDesc.slice(0, 252).trim() + '...'
                              : currentDesc;

                          return (
                            <div className="mt-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                  <Box className="w-4 h-4 text-emerald-600 shrink-0" />
                                  <span>Steadfast Item Description:</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-[10px] font-mono ${
                                      currentDesc.length > 255
                                        ? 'text-amber-600 font-bold'
                                        : 'text-slate-400'
                                    }`}
                                  >
                                    {Math.min(currentDesc.length, 255)}/255 chars
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (isEditing) {
                                        setEditingDescOrderId(null);
                                      } else {
                                        if (customItemDescs[order.id] === undefined) {
                                          setCustomItemDescs((prev) => ({
                                            ...prev,
                                            [order.id]: displayDesc,
                                          }));
                                        }
                                        setEditingDescOrderId(order.id);
                                      }
                                    }}
                                    className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 underline cursor-pointer"
                                  >
                                    {isEditing ? 'Save' : 'Edit'}
                                  </button>
                                </div>
                              </div>

                              {isEditing ? (
                                <div className="mt-2 space-y-1.5">
                                  <textarea
                                    maxLength={255}
                                    value={customItemDescs[order.id] || ''}
                                    onChange={(e) =>
                                      setCustomItemDescs((prev) => ({
                                        ...prev,
                                        [order.id]: e.target.value,
                                      }))
                                    }
                                    className="w-full text-xs font-mono p-2 border border-emerald-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                                    rows={2}
                                    placeholder="Enter item description for Steadfast parcel sticker (max 255 chars)..."
                                  />
                                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                                    <span>This text will appear on the Steadfast parcel sticker.</span>
                                    <span>{255 - (customItemDescs[order.id]?.length || 0)} left</span>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-600 font-mono text-[11px] block mt-1 break-words">
                                  {displayDesc}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })()}

                  {/* Actions & Next Step Progressions */}
                  <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {(() => {
                      const advance = getOrderAdvance(order);
                      const discount = getOrderDiscount(order);
                      const remainingCod = Math.max(0, Number(order.total_amount || 0) - advance);
                      const isFullyPrepaid = (advance >= order.total_amount && order.total_amount > 0) || remainingCod === 0;

                      return (
                        <div className="text-xs text-slate-600 flex items-center gap-2 flex-wrap">
                          <span>
                            <span className="font-semibold">Payment:</span> {order.payment_method}
                          </span>
                          <span className="text-slate-300">&middot;</span>
                          <span>
                            Total: <b className="text-slate-900 font-mono">{formatCurrency(order.total_amount)}</b>
                          </span>

                          {discount > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                              Disc: -৳{discount.toLocaleString()}
                            </span>
                          )}

                          {advance > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                              Adv: ৳{advance.toLocaleString()}
                            </span>
                          )}

                          <span className="text-slate-300">&middot;</span>
                          <span
                            className={`font-black px-2.5 py-1 rounded-lg text-xs font-mono inline-flex items-center gap-1 shadow-2xs ${
                              isFullyPrepaid
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : 'bg-amber-100 text-amber-950 border border-amber-300'
                            }`}
                          >
                            <span>Collect (COD):</span>
                            <span className="text-sm">{isFullyPrepaid ? '৳0 (Prepaid)' : formatCurrency(remainingCod)}</span>
                          </span>
                        </div>
                      );
                    })()}

                    <div className="flex items-center space-x-2">
                      {order.status === 'confirmed' && (
                        <button
                          onClick={() => handleStatusChange(order.id, 'ready_to_ship')}
                          disabled={updatingId === order.id}
                          className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50"
                        >
                          <Package className="w-4 h-4" />
                          <span>
                            {updatingId === order.id ? 'Updating...' : 'Mark Packed (Ready to Ship)'}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {order.status === 'ready_to_ship' && (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleSendToSteadfast(order, customItemDescs[order.id])}
                            disabled={dispatchingId === order.id}
                            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                            title="Create consignment in Steadfast Courier and advance to With Courier"
                          >
                            <Send className={`w-3.5 h-3.5 ${dispatchingId === order.id ? 'animate-spin' : ''}`} />
                            <span>
                              {dispatchingId === order.id ? 'Sending to Steadfast...' : 'Send to Steadfast'}
                            </span>
                          </button>

                          <button
                            onClick={() => handleStatusChange(order.id, 'on_the_way')}
                            disabled={updatingId === order.id}
                            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-all active:scale-95 disabled:opacity-50"
                            title="Manual handover without Steadfast API"
                          >
                            <Truck className="w-3.5 h-3.5 text-slate-500" />
                            <span>Manual Courier Handover</span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          </button>
                        </div>
                      )}

                      {order.status === 'on_the_way' && (
                        <div className="flex items-center space-x-2 flex-wrap gap-2">
                          {!getOrderConsignmentId(order) && (
                            <button
                              onClick={() => handleSendToSteadfast(order, customItemDescs[order.id])}
                              disabled={dispatchingId === order.id}
                              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-2xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                              title="Create consignment in Steadfast Courier"
                            >
                              <Send className={`w-3.5 h-3.5 ${dispatchingId === order.id ? 'animate-spin' : ''}`} />
                              <span>
                                {dispatchingId === order.id ? 'Sending...' : 'Send to Steadfast'}
                              </span>
                            </button>
                          )}

                          <button
                            onClick={() => handleSyncSteadfast(order)}
                            disabled={syncingId === order.id}
                            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 font-bold text-xs shadow-2xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                            title="Query Steadfast to update live tracking and consignment status"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${syncingId === order.id ? 'animate-spin' : ''}`} />
                            <span>{syncingId === order.id ? 'Syncing...' : 'Sync Steadfast'}</span>
                          </button>

                          <button
                            onClick={() => handleStatusChange(order.id, 'shipped')}
                            disabled={updatingId === order.id}
                            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>
                              {updatingId === order.id ? 'Updating...' : 'Mark as Shipped'}
                            </span>
                          </button>
                        </div>
                      )}

                      {order.status === 'shipped' && (
                        <div className="flex items-center space-x-2">
                          {(() => {
                            const cid = getOrderConsignmentId(order);
                            return cid ? (
                              <span className="text-[11px] font-mono font-bold text-indigo-800 bg-indigo-50 border border-indigo-200/80 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-2xs">
                                <Truck className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Steadfast CID: #{cid}</span>
                              </span>
                            ) : null;
                          })()}
                          <span className="text-xs text-emerald-700 font-semibold flex items-center">
                            <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-600" />
                            Order Shipped & Complete
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          )}
          </>
        )}

        {/* LIVE STOCK & INVENTORY MANAGEMENT VIEW */}
        {activeMainTab === 'inventory' && (
          <div className="space-y-6">
            {/* Header / Search Controls */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                    <Boxes className="w-5 h-5 text-emerald-600" />
                    <span>Live Stock & Inventory Station</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Warehouse stock management. Realtime stock lookup and quantity adjustments (+1, -1, +10).
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search product or SKU..."
                      value={inventorySearch}
                      onChange={(e) => setInventorySearch(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={fetchInventory}
                    disabled={loadingInventory}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors shrink-0 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingInventory ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Inventory List */}
            {loadingInventory ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-slate-400 mb-2" />
                <p className="text-xs text-slate-500 font-medium">Loading inventory products...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                <Boxes className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No products found</p>
                <p className="text-xs text-slate-400 mt-1">Try a different search query or click Refresh</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredProducts.map((product) => {
                  const variants = product.variants || [];
                  const totalStock = variants.reduce((sum, v) => sum + (v.stock_quantity || 0), 0);

                  return (
                    <div
                      key={product.id}
                      className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs hover:border-slate-300 transition-all"
                    >
                      <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.title}
                              className="w-10 h-10 rounded-xl object-cover border border-slate-200 bg-white"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center text-slate-500">
                              <Box className="w-5 h-5" />
                            </div>
                          )}
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">{product.title}</h4>
                            <p className="text-xs text-slate-500">
                              {variants.length} {variants.length === 1 ? 'Variant' : 'Variants'}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[11px] font-semibold text-slate-500 block">
                            Combined Stock
                          </span>
                          <span
                            className={`font-mono text-sm font-black ${
                              totalStock <= 0
                                ? 'text-rose-600'
                                : totalStock <= 5
                                ? 'text-amber-600'
                                : 'text-emerald-700'
                            }`}
                          >
                            {totalStock} units
                          </span>
                        </div>
                      </div>

                      <div className="divide-y divide-slate-100">
                        {variants.map((variant) => {
                          const isLow = variant.stock_quantity > 0 && variant.stock_quantity <= 5;
                          const isOut = variant.stock_quantity <= 0;
                          const isUpdating = adjustingVariantId === variant.id;

                          return (
                            <div
                              key={variant.id}
                              className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/40 transition-colors"
                            >
                              <div className="flex items-start sm:items-center gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-slate-800">
                                      {variant.title}
                                    </span>
                                    {variant.sku && (
                                      <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                        SKU: {variant.sku}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-xs text-slate-500 font-mono mt-0.5 inline-block">
                                    Selling Price: {formatCurrency(variant.price)}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between sm:justify-end gap-3">
                                {/* Stock Status Badge */}
                                <div className="text-right">
                                  <span
                                    className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border ${
                                      isOut
                                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                                        : isLow
                                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        isOut
                                          ? 'bg-rose-500'
                                          : isLow
                                          ? 'bg-amber-500'
                                          : 'bg-emerald-500'
                                      }`}
                                    />
                                    <span className="font-mono">{variant.stock_quantity} in stock</span>
                                  </span>
                                </div>

                                {/* Stock Adjust Actions */}
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    disabled={variant.stock_quantity <= 0 || isUpdating}
                                    onClick={() => handleAdjustStock(variant.id, -1)}
                                    className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs disabled:opacity-30 transition-colors cursor-pointer"
                                    title="Deduct 1"
                                  >
                                    -1
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isUpdating}
                                    onClick={() => handleAdjustStock(variant.id, 1)}
                                    className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 font-bold text-xs disabled:opacity-30 transition-colors cursor-pointer"
                                    title="Add 1"
                                  >
                                    +1
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isUpdating}
                                    onClick={() => handleAdjustStock(variant.id, 10)}
                                    className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 font-bold text-xs disabled:opacity-30 transition-colors cursor-pointer"
                                    title="Add 10"
                                  >
                                    +10
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isUpdating}
                                    onClick={() => {
                                      const input = prompt(
                                        `Enter stock adjustment amount for "${variant.title}" (e.g. +5 or -2):`
                                      );
                                      if (input) {
                                        const num = parseInt(input, 10);
                                        if (!isNaN(num) && num !== 0) {
                                          handleAdjustStock(variant.id, num);
                                        }
                                      }
                                    }}
                                    className="px-2 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-medium transition-colors cursor-pointer"
                                    title="Custom Adjustment"
                                  >
                                    Custom
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Printable Packing Slip View (Visible during window.print()) */}
        {selectedOrderForSlip && (
          <div className="printable-slip hidden">
            <div className="p-8 max-w-2xl mx-auto bg-white border border-slate-300 rounded-lg text-slate-900 font-sans">
              {/* Slip Header */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-4">
                <div>
                  <h1 className="text-2xl font-black uppercase tracking-wider">BOYON</h1>
                  <p className="text-xs text-slate-500">Official Packing & Delivery Slip</p>
                </div>
                <div className="text-right">
                  <h2 className="text-xl font-bold font-mono">{selectedOrderForSlip.order_number}</h2>
                  <p className="text-xs text-slate-500">{formatDate(selectedOrderForSlip.created_at)}</p>
                  {selectedOrderForSlip.consignment_id && (
                    <div className="mt-1 text-[11px] font-mono font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded inline-block">
                      Steadfast CID: #{selectedOrderForSlip.consignment_id}
                      {selectedOrderForSlip.tracking_code && ` · Trk: ${selectedOrderForSlip.tracking_code}`}
                    </div>
                  )}
                </div>
              </div>

              {/* Delivery Address */}
              <div className="grid grid-cols-2 gap-4 mb-6 text-xs">
                <div className="bg-slate-50 p-3 rounded border border-slate-200">
                  <div className="font-bold uppercase text-slate-500 mb-1">Customer Details</div>
                  <div className="font-bold text-sm text-slate-900">{selectedOrderForSlip.customer_name}</div>
                  <div className="font-mono mt-0.5">{selectedOrderForSlip.customer_phone}</div>
                  {selectedOrderForSlip.customer_email && (
                    <div className="text-[11px] text-slate-500 mt-0.5">{selectedOrderForSlip.customer_email}</div>
                  )}
                </div>

                <div className="bg-slate-50 p-3 rounded border border-slate-200">
                  <div className="font-bold uppercase text-slate-500 mb-1">Shipping Destination</div>
                  <div className="text-slate-800 leading-relaxed font-medium">
                    {selectedOrderForSlip.shipping_address}
                  </div>
                  {selectedOrderForSlip.note && (
                    <div className="mt-2 text-[11px] text-amber-900 bg-amber-50 border border-amber-200 p-1.5 rounded font-medium">
                      Note: {selectedOrderForSlip.note}
                    </div>
                  )}
                </div>
              </div>

              {/* Items Table: Partitioned Main vs Upsell */}
              {(() => {
                const mainItems = (selectedOrderForSlip.order_items || []).filter((i) => !i.is_upsell);
                const upsellItems = (selectedOrderForSlip.order_items || []).filter((i) => i.is_upsell);

                return (
                  <table className="w-full text-xs text-left mb-6 border-collapse">
                    <thead>
                      <tr className="border-b border-slate-300 bg-slate-100 text-slate-700">
                        <th className="py-2 px-3">Pack [✓]</th>
                        <th className="py-2 px-3">Item Description</th>
                        <th className="py-2 px-3">Variant / Spec</th>
                        <th className="py-2 px-3 text-center">Qty</th>
                        <th className="py-2 px-3 text-right">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Main Products Section */}
                      {mainItems.length > 0 && (
                        <>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <td colSpan={5} className="py-1 px-3 font-bold text-[10px] uppercase text-slate-500 tracking-wider">
                              Main Order Products ({mainItems.length})
                            </td>
                          </tr>
                          {mainItems.map((item, idx) => (
                            <tr key={`main-${idx}`} className="border-b border-slate-200">
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-400">[ &nbsp; ]</td>
                              <td className="py-2.5 px-3 font-bold">{item.title}</td>
                              <td className="py-2.5 px-3 text-slate-600">{item.variant_title || '-'}</td>
                              <td className="py-2.5 px-3 text-center font-bold text-sm">{item.quantity}</td>
                              <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(item.price)}</td>
                            </tr>
                          ))}
                        </>
                      )}

                      {/* Upsell Add-Ons Section */}
                      {upsellItems.length > 0 && (
                        <>
                          <tr className="bg-purple-50 border-b border-purple-200">
                            <td colSpan={5} className="py-1 px-3 font-black text-[10px] uppercase text-purple-700 tracking-wider">
                              ★ Upsell Items & Add-Ons ({upsellItems.length})
                            </td>
                          </tr>
                          {upsellItems.map((item, idx) => (
                            <tr key={`upsell-${idx}`} className="border-b border-purple-100 bg-purple-50/30">
                              <td className="py-2.5 px-3 font-mono font-bold text-purple-600">[ &nbsp; ]</td>
                              <td className="py-2.5 px-3 font-bold text-purple-950">
                                {item.title} <span className="font-normal text-[10px] text-purple-700 bg-purple-100 px-1 py-0.5 rounded ml-1">[UPSELL]</span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600">{item.variant_title || '-'}</td>
                              <td className="py-2.5 px-3 text-center font-black text-sm text-purple-900">{item.quantity}</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-purple-700">{formatCurrency(item.price)}</td>
                            </tr>
                          ))}
                        </>
                      )}
                    </tbody>
                  </table>
                );
              })()}

              {/* Summary */}
              {(() => {
                const advance = getOrderAdvance(selectedOrderForSlip);
                const discount = getOrderDiscount(selectedOrderForSlip);
                const remainingCod = Math.max(0, Number(selectedOrderForSlip.total_amount || 0) - advance);
                const isFullyPrepaid = (advance >= selectedOrderForSlip.total_amount && selectedOrderForSlip.total_amount > 0) || remainingCod === 0;

                return (
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end border-t border-slate-300 pt-4 text-xs gap-4">
                    <div>
                      <div className="text-slate-500 font-semibold">Payment Method:</div>
                      <div className="font-bold text-sm text-slate-900">{selectedOrderForSlip.payment_method}</div>
                      {selectedOrderForSlip.coupon_used && (
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Coupon: {selectedOrderForSlip.coupon_used}
                        </div>
                      )}
                      {advance > 0 && (
                        <div className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
                          Paid in Advance: {formatCurrency(advance)}
                        </div>
                      )}
                    </div>

                    <div className="w-full sm:w-auto text-right space-y-1 min-w-[240px]">
                      <div className="flex justify-between text-slate-600 gap-4">
                        <span>Order Total:</span>
                        <span className="font-mono font-bold text-slate-800">{formatCurrency(selectedOrderForSlip.total_amount)}</span>
                      </div>
                      {discount > 0 && (
                        <div className="flex justify-between text-rose-600 gap-4">
                          <span>Discount Applied:</span>
                          <span className="font-mono font-bold">-{formatCurrency(discount)}</span>
                        </div>
                      )}
                      {advance > 0 && (
                        <div className="flex justify-between text-emerald-700 gap-4 font-semibold">
                          <span>Advance Received:</span>
                          <span className="font-mono font-bold">-{formatCurrency(advance)}</span>
                        </div>
                      )}
                      <div className="border-t border-slate-300 pt-1.5 flex justify-between items-baseline gap-4">
                        <span className="text-slate-900 uppercase font-bold text-xs">
                          {isFullyPrepaid ? 'Status:' : 'Total COD To Collect:'}
                        </span>
                        <span className={`text-xl font-black font-mono ${isFullyPrepaid ? 'text-emerald-700' : 'text-slate-900'}`}>
                          {isFullyPrepaid ? 'PAID (৳0)' : formatCurrency(remainingCod)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Footer Notice */}
              <div className="mt-8 pt-4 border-t border-dashed border-slate-300 text-[10px] text-slate-400 text-center">
                Checked & Packed by Boyon Fulfillment Team • Thank you for shopping with us!
              </div>
            </div>
          </div>
        )}

        {/* Steadfast Webhook Integration & Testing Modal */}
        <SteadfastWebhookModal
          isOpen={isWebhookModalOpen}
          onClose={() => setIsWebhookModalOpen(false)}
          recentOrders={orders}
          onOrderUpdated={fetchPackingOrders}
        />
      </main>
    </div>
  );
}
