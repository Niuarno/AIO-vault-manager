'use client';

import React, { useState, useEffect } from 'react';
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
  Sparkles,
  Send,
  Radio,
} from 'lucide-react';
import { Order, OrderStatus, Profile } from '@/types/database';
import { formatCurrency, formatDate, getStatusBadgeInfo } from '@/lib/utils';
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

  // Selected Order for Packing Slip Modal / Print
  const [selectedOrderForSlip, setSelectedOrderForSlip] = useState<Order | null>(null);

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

  useEffect(() => {
    fetchPackingOrders();

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
  const handleSendToSteadfast = async (order: Order) => {
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
        body: JSON.stringify({ orderId: order.id }),
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
          <div className="flex items-center space-x-2">
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
            {activeFilter === 'on_the_way' && (
              <button
                onClick={handleSyncAllMissingCid}
                disabled={syncingAll}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center space-x-1.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-2xs"
                title="Fetch consignment IDs from Steadfast for all orders currently in With Courier"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingAll ? 'animate-spin' : ''}`} />
                <span>{syncingAll ? 'Fetching all CIDs...' : 'Fetch All Missing CIDs'}</span>
              </button>
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
                  className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <div className="flex items-center space-x-3">
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

                              {tracking && tracking !== cid && (
                                <span className="inline-flex items-center px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-mono text-[11px]">
                                  Tracking: {tracking}
                                </span>
                              )}

                              {order.courier_status && (
                                <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
                                  {order.courier_status.replace(/_/g, ' ')}
                                </span>
                              )}

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
                      </div>
                    );
                  })()}

                  {/* Actions & Next Step Progressions */}
                  <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-xs text-slate-600">
                      <span className="font-semibold">Payment:</span> {order.payment_method} |{' '}
                      <span className="font-bold text-slate-900">
                        Collect: {formatCurrency(order.total_amount)}
                      </span>
                    </div>

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
                            onClick={() => handleSendToSteadfast(order)}
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
                              onClick={() => handleSendToSteadfast(order)}
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
                </div>
              </div>

              {/* Delivery Address */}
              <div className="grid grid-cols-2 gap-4 mb-6 text-xs">
                <div className="bg-slate-50 p-3 rounded border border-slate-200">
                  <div className="font-bold uppercase text-slate-500 mb-1">Customer Details</div>
                  <div className="font-bold text-sm text-slate-900">{selectedOrderForSlip.customer_name}</div>
                  <div className="font-mono mt-0.5">{selectedOrderForSlip.customer_phone}</div>
                </div>

                <div className="bg-slate-50 p-3 rounded border border-slate-200">
                  <div className="font-bold uppercase text-slate-500 mb-1">Shipping Destination</div>
                  <div className="text-slate-800 leading-relaxed font-medium">
                    {selectedOrderForSlip.shipping_address}
                  </div>
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
              <div className="flex justify-between items-end border-t border-slate-300 pt-4 text-xs">
                <div>
                  <div className="text-slate-500 font-semibold">Payment Method:</div>
                  <div className="font-bold text-sm text-slate-900">{selectedOrderForSlip.payment_method}</div>
                  {selectedOrderForSlip.coupon_used && (
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      Coupon: {selectedOrderForSlip.coupon_used}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-slate-500 uppercase font-semibold">Total Amount To Collect</div>
                  <div className="text-xl font-black text-slate-900">
                    {formatCurrency(selectedOrderForSlip.total_amount)}
                  </div>
                </div>
              </div>

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
