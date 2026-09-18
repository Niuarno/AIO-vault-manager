'use client';

import React, { useState, useEffect } from 'react';
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
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Truck,
  ArrowUpRight,
  TrendingUp,
  Tag,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import {
  Order,
  ProductVariant,
  Profile,
  RewardRule,
  OrderStatus,
  OrderSource,
} from '@/types/database';
import { formatCurrency, formatDate, getStatusBadgeInfo, getSourceBadge } from '@/lib/utils';

export default function AdminDashboard() {
  const supabase = createClient();

  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [activeTab, setActiveTab] = useState<'orders' | 'inventory' | 'team' | 'rewards'>('orders');

  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingOrders, setLoadingOrders] = useState(true);

  // Inventory State
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);

  // Sales Team State
  const [salesTeam, setSalesTeam] = useState<Profile[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [newCouponCode, setNewCouponCode] = useState<{ [id: string]: string }>({});

  // Reward Rules State
  const [rewardRules, setRewardRules] = useState<RewardRule[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleType, setNewRuleType] = useState<'fixed_per_item' | 'percentage'>('fixed_per_item');
  const [newRuleValue, setNewRuleValue] = useState('50');

  // Load current user profile
  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (profile) setCurrentProfile(profile);
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

  // Fetch Sales Team
  const fetchTeam = async () => {
    setLoadingTeam(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setSalesTeam(data as Profile[]);
    }
    setLoadingTeam(false);
  };

  // Fetch Reward Rules
  const fetchRules = async () => {
    setLoadingRules(true);
    const res = await fetch('/api/rewards/rules');
    const json = await res.json();
    if (json.rules) {
      setRewardRules(json.rules);
    }
    setLoadingRules(false);
  };

  useEffect(() => {
    if (activeTab === 'orders') fetchOrders();
    if (activeTab === 'inventory') fetchInventory();
    if (activeTab === 'team') fetchTeam();
    if (activeTab === 'rewards') fetchRules();
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

  // Filter orders by search
  const filteredOrders = orders.filter((o) => {
    const q = searchQuery.toLowerCase();
    return (
      o.order_number.toLowerCase().includes(q) ||
      o.customer_name.toLowerCase().includes(q) ||
      o.customer_phone.toLowerCase().includes(q) ||
      (o.coupon_used && o.coupon_used.toLowerCase().includes(q))
    );
  });

  // Calculate Metrics
  const totalRevenue = orders.reduce((sum, o) => (o.status !== 'canceled' ? sum + Number(o.total_amount) : sum), 0);
  const confirmedCount = orders.filter((o) => o.status === 'confirmed').length;
  const pendingCount = orders.filter((o) => o.status === 'pending').length;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar currentProfile={currentProfile} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header & Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center">
              <span>Admin Director Control Center</span>
              <span className="ml-3 text-xs bg-purple-100 text-purple-800 font-bold px-2.5 py-0.5 rounded-full border border-purple-200">
                Full Authority
              </span>
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Multi-channel order storage, dynamic live stock restocking, sales team & upsell commission rules.
            </p>
          </div>

          <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'orders'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShoppingBag className="w-4 h-4 inline mr-1.5" />
              Orders ({orders.length})
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'inventory'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Boxes className="w-4 h-4 inline mr-1.5" />
              Live Stock
            </button>
            <button
              onClick={() => setActiveTab('team')}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'team'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4 inline mr-1.5" />
              Sales Team & Coupons
            </button>
            <button
              onClick={() => setActiveTab('rewards')}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'rewards'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Award className="w-4 h-4 inline mr-1.5" />
              Reward Rules
            </button>
          </div>
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Sales Volume</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(totalRevenue)}</div>
            <div className="text-xs text-emerald-600 font-medium mt-1 flex items-center">
              <TrendingUp className="w-3.5 h-3.5 mr-1" />
              Across all live channels
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Confirmation</div>
            <div className="text-2xl font-black text-amber-600 mt-1">{pendingCount} orders</div>
            <div className="text-xs text-slate-500 mt-1">Awaiting sales rep / customer verification</div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ready for Packing</div>
            <div className="text-2xl font-black text-blue-600 mt-1">{confirmedCount} confirmed</div>
            <div className="text-xs text-blue-600 font-medium mt-1">Visible on Packing Team Queue</div>
          </div>
        </div>

        {/* TAB 1: ORDERS */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Search order #, customer, phone, coupon..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="ready_to_ship">Ready to Ship</option>
                  <option value="on_the_way">On the Way</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="canceled">Canceled (Restocked)</option>
                </select>

                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
                >
                  <option value="all">All Channels</option>
                  <option value="website">Shopify Website</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="messenger">Messenger</option>
                  <option value="phone">Phone Calls</option>
                  <option value="manual">Manual / Walk-in</option>
                </select>

                <button
                  onClick={fetchOrders}
                  className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200"
                  title="Refresh Orders"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Orders Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Order #</th>
                      <th className="py-3.5 px-4">Channel</th>
                      <th className="py-3.5 px-4">Customer & Phone</th>
                      <th className="py-3.5 px-4">Address</th>
                      <th className="py-3.5 px-4">Items</th>
                      <th className="py-3.5 px-4">Total</th>
                      <th className="py-3.5 px-4">Status & Action</th>
                      <th className="py-3.5 px-4">Sales Rep / Coupon</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingOrders ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          Loading orders...
                        </td>
                      </tr>
                    ) : filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          No orders match the selected filters.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((order) => {
                        const badge = getStatusBadgeInfo(order.status);
                        const source = getSourceBadge(order.source);

                        return (
                          <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-4 font-bold text-slate-900">
                              <code>{order.order_number}</code>
                              <div className="text-[10px] text-slate-400 font-normal">
                                {formatDate(order.created_at)}
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${source.color}`}>
                                {source.label}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-slate-900">{order.customer_name}</div>
                              <code className="text-slate-500">{order.customer_phone}</code>
                            </td>
                            <td className="py-3.5 px-4 max-w-xs truncate text-slate-600" title={order.shipping_address}>
                              {order.shipping_address}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="space-y-1">
                                {order.order_items?.map((item) => (
                                  <div key={item.id} className="text-slate-700">
                                    <span className="font-bold">{item.quantity}×</span> {item.title}
                                    {item.is_upsell && (
                                      <span className="ml-1 px-1.5 py-0.2 text-[9px] bg-purple-100 text-purple-700 rounded font-bold">
                                        UPSELL
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-black text-slate-900">
                              {formatCurrency(order.total_amount, order.currency)}
                              <div className="text-[10px] font-normal text-slate-500">{order.payment_method}</div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center space-x-2">
                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold border flex items-center space-x-1 ${badge.bg}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                                  <span>{badge.label}</span>
                                </span>

                                <select
                                  value={order.status}
                                  onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                                  className="text-[11px] p-1 bg-slate-50 border border-slate-200 rounded font-semibold text-slate-700"
                                >
                                  <option value="pending">Set Pending</option>
                                  <option value="confirmed">Set Confirmed</option>
                                  <option value="ready_to_ship">Set Ready to Ship</option>
                                  <option value="on_the_way">Set On the Way</option>
                                  <option value="shipped">Set Shipped</option>
                                  <option value="delivered">Set Delivered</option>
                                  <option value="canceled">Set Canceled (Auto-Restock)</option>
                                </select>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              {order.sales_rep?.full_name ? (
                                <div className="font-semibold text-slate-800">
                                  {order.sales_rep.full_name}
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">None</span>
                              )}
                              {order.coupon_used && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 font-mono font-bold mt-0.5">
                                  <Tag className="w-2.5 h-2.5 mr-1" />
                                  {order.coupon_used}
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
            </div>
          </div>
        )}

        {/* TAB 2: LIVE INVENTORY */}
        {activeTab === 'inventory' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Live Store Inventory</h3>
                <p className="text-xs text-slate-500">
                  Stock decreases on confirmed orders, and automatically replenishes if an order is canceled.
                </p>
              </div>
              <button
                onClick={fetchInventory}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center space-x-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Stocks</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {loadingInventory ? (
                <div className="col-span-3 text-center py-12 text-slate-400">Loading catalog...</div>
              ) : (
                variants.map((v) => {
                  const isLow = v.stock_quantity <= 5;
                  const isOut = v.stock_quantity <= 0;

                  return (
                    <div
                      key={v.id}
                      className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm">{v.product?.title || 'Product'}</h4>
                            <div className="text-xs text-slate-500">{v.title}</div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isOut
                                ? 'bg-rose-100 text-rose-800'
                                : isLow
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                          </span>
                        </div>

                        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                          <span>SKU: <code>{v.sku || 'N/A'}</code></span>
                          <span className="font-bold text-slate-900">{formatCurrency(v.price)}</span>
                        </div>
                      </div>

                      {/* Stock Counter & Quick Adjustment */}
                      <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-400">Current Live Stock</div>
                          <div className={`text-2xl font-black ${isOut ? 'text-rose-600' : 'text-slate-900'}`}>
                            {v.stock_quantity} <span className="text-xs font-normal text-slate-500">units</span>
                          </div>
                        </div>

                        {/* Quick +/- Admin Adjustments */}
                        <div className="flex items-center space-x-1.5">
                          <button
                            disabled={adjustingId === v.id}
                            onClick={() => handleStockAdjust(v.id, -1)}
                            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700 disabled:opacity-50"
                            title="Decrease Stock by 1"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            disabled={adjustingId === v.id}
                            onClick={() => handleStockAdjust(v.id, 1)}
                            className="w-8 h-8 rounded-lg bg-brand-50 hover:bg-brand-100 flex items-center justify-center font-bold text-brand-700 disabled:opacity-50"
                            title="Increase Stock by 1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            disabled={adjustingId === v.id}
                            onClick={() => {
                              const qty = prompt(`Enter quantity to add to ${v.title}:`, '10');
                              if (qty && !isNaN(parseInt(qty))) {
                                handleStockAdjust(v.id, parseInt(qty));
                              }
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold"
                          >
                            +Custom
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 3: SALES TEAM & COUPONS */}
        {activeTab === 'team' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Sales Representatives & Coupons</h3>
                <p className="text-xs text-slate-500">
                  Assign unique coupon codes to sales personnel. Customers use these codes on the website or sales reps apply them on manual orders to earn upsell bonuses.
                </p>
              </div>
              <button
                onClick={fetchTeam}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center space-x-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Staff</span>
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Staff Member</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Active Coupon Code</th>
                    <th className="py-3.5 px-4">Assign / Change Coupon</th>
                    <th className="py-3.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingTeam ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">Loading team...</td>
                    </tr>
                  ) : (
                    salesTeam.map((member) => (
                      <tr key={member.id} className="hover:bg-slate-50">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{member.full_name || 'Staff User'}</div>
                          <div className="text-slate-500">{member.email}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              member.role === 'admin'
                                ? 'bg-purple-100 text-purple-800'
                                : member.role === 'packing'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {member.role.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {member.coupon_code ? (
                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 font-mono font-bold rounded-lg border border-emerald-200">
                              {member.coupon_code}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">No coupon assigned</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-2">
                            <input
                              type="text"
                              placeholder="e.g. SARAH10"
                              value={newCouponCode[member.id] || ''}
                              onChange={(e) =>
                                setNewCouponCode({ ...newCouponCode, [member.id]: e.target.value })
                              }
                              className="w-32 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs uppercase font-mono"
                            />
                            <button
                              onClick={() => handleAssignCoupon(member.id)}
                              className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold"
                            >
                              Save
                            </button>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="text-emerald-600 font-semibold flex items-center">
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            Active
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

        {/* TAB 4: REWARD RULES */}
        {activeTab === 'rewards' && (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 flex items-center">
                <Sparkles className="w-4 h-4 mr-2 text-brand-600" />
                Global Upsell & Commission Rule Configuration
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Configure the global reward rule applied across all sales representatives when they pitch upsells or their coupon is used.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
                {rewardRules.map((rule) => (
                  <div
                    key={rule.id}
                    className={`p-5 rounded-2xl border transition-all ${
                      rule.is_active
                        ? 'border-brand-500 bg-brand-50/40 shadow-sm'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-slate-900 text-sm">{rule.name}</div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          rule.is_active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {rule.is_active ? 'ACTIVE RULE' : 'INACTIVE'}
                      </span>
                    </div>

                    <div className="mt-3">
                      <div className="text-2xl font-black text-slate-900">
                        {rule.rule_type === 'percentage' ? `${rule.value}%` : `${rule.value} BDT`}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {rule.rule_type === 'fixed_per_item' && 'Fixed bonus per each upsell item added to order'}
                        {rule.rule_type === 'percentage' && 'Percentage commission of total order revenue'}
                        {rule.rule_type === 'fixed_per_order' && 'Flat bonus per completed upsell order'}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      {!rule.is_active ? (
                        <button
                          onClick={async () => {
                            await fetch('/api/rewards/rules', {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ id: rule.id, is_active: true }),
                            });
                            fetchRules();
                          }}
                          className="px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-bold"
                        >
                          Set as Active Global Rule
                        </button>
                      ) : (
                        <span className="text-xs text-brand-700 font-bold flex items-center">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Currently Applied
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Create New Rule Form */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
                Create New Global Reward Rule
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Rule Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Festival Season Bonus (100 BDT)"
                    value={newRuleName}
                    onChange={(e) => setNewRuleName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Rule Type</label>
                  <select
                    value={newRuleType}
                    onChange={(e) => setNewRuleType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  >
                    <option value="fixed_per_item">Fixed per Upsell Item (BDT)</option>
                    <option value="percentage">Percentage of Total Order (%)</option>
                    <option value="fixed_per_order">Fixed Flat Bonus per Order (BDT)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Value Amount</label>
                  <input
                    type="number"
                    value={newRuleValue}
                    onChange={(e) => setNewRuleValue(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  />
                </div>
                <div>
                  <button
                    onClick={async () => {
                      if (!newRuleName) return alert('Enter rule name');
                      await fetch('/api/rewards/rules', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          name: newRuleName,
                          rule_type: newRuleType,
                          value: newRuleValue,
                          is_active: true,
                        }),
                      });
                      setNewRuleName('');
                      fetchRules();
                    }}
                    className="w-full py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-colors"
                  >
                    Save & Activate Rule
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
