'use client';

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import {
  Order,
  ProductVariant,
  Profile,
  UpsellReward,
  OrderStatus,
  OrderSource,
} from '@/types/database';
import { formatCurrency, formatDate, getStatusBadgeInfo, getSourceBadge } from '@/lib/utils';

export default function SalesDashboard() {
  const supabase = createClient();

  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [activeTab, setActiveTab] = useState<'orders' | 'inventory' | 'rewards'>('orders');

  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  // Live Inventory State
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);

  // Rewards State
  const [rewards, setRewards] = useState<UpsellReward[]>([]);
  const [loadingRewards, setLoadingRewards] = useState(false);

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

  // Load User Profile
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
        }
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

  useEffect(() => {
    fetchOrders();
    fetchInventory();
    fetchRewards();
  }, []);

  // Add Item to Current Order
  const handleAddItem = () => {
    if (!selectedVariantId) return;
    const v = variants.find((variant) => variant.id === selectedVariantId);
    if (!v) return;

    if (itemQuantity > v.stock_quantity) {
      alert(`⚠️ Only ${v.stock_quantity} units available in live stock!`);
      return;
    }

    setOrderItems((prev) => [
      ...prev,
      {
        product_id: v.product_id,
        variant_id: v.id,
        title: v.product?.title || 'Product',
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

      // Celebrate with confetti!
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
        fetchInventory(); // Live stock restocks on cancel!
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Calculate Personal Stats
  const totalBonusEarned = rewards.reduce((sum, r) => sum + Number(r.bonus_amount), 0);
  const myOrdersCount = orders.filter((o) => o.sales_rep_id === currentProfile?.id).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar currentProfile={currentProfile} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with New Order Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center">
              <span>Sales Workspace</span>
              {currentProfile?.coupon_code && (
                <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <Tag className="w-3 h-3 mr-1" />
                  My Coupon: {currentProfile.coupon_code}
                </span>
              )}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Multi-channel order entry (WhatsApp, Messenger, Calls), live stock visibility, and personal upsell bonus tracker.
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-500/20 transition-all transform hover:-translate-y-0.5"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            <span>+ Entry New Order</span>
          </button>
        </div>

        {/* PERSONAL STATS BAR */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-700 p-5 rounded-2xl text-white shadow-md shadow-emerald-500/15">
            <div className="text-xs uppercase font-bold text-emerald-100 flex items-center">
              <Award className="w-4 h-4 mr-1.5" />
              Total Upsell Bonus Earned
            </div>
            <div className="text-3xl font-black mt-2">{formatCurrency(totalBonusEarned)}</div>
            <div className="text-xs text-emerald-100 mt-1">
              {rewards.length} rewarded upsell transaction(s)
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              My Attributed Orders
            </div>
            <div className="text-3xl font-black text-slate-900 mt-2">{myOrdersCount}</div>
            <div className="text-xs text-emerald-600 font-medium mt-1">
              Entered via calls, chat, or personal coupon
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Store Live Catalog
            </div>
            <div className="text-3xl font-black text-slate-900 mt-2">
              {variants.filter((v) => v.stock_quantity > 0).length}{' '}
              <span className="text-sm font-normal text-slate-400">active items</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">Real-time stock sync with cancellations</div>
          </div>
        </div>

        {/* TAB CONTROLS */}
        <div className="flex items-center space-x-2 border-b border-slate-200 pb-3 mb-6">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'orders'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5 inline mr-1.5" />
            Orders ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'inventory'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Boxes className="w-3.5 h-3.5 inline mr-1.5" />
            Live Stock Catalog
          </button>
          <button
            onClick={() => setActiveTab('rewards')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'rewards'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 inline mr-1.5" />
            My Upsell Bonuses ({rewards.length})
          </button>
        </div>

        {/* TAB 1: ORDERS TABLE */}
        {activeTab === 'orders' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Order #</th>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4">Customer Details</th>
                    <th className="py-3 px-4">Address</th>
                    <th className="py-3 px-4">Items</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingOrders ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">Loading orders...</td>
                    </tr>
                  ) : orders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">No orders recorded yet.</td>
                    </tr>
                  ) : (
                    orders.map((order) => {
                      const badge = getStatusBadgeInfo(order.status);
                      const sourceBadge = getSourceBadge(order.source);

                      return (
                        <tr key={order.id} className="hover:bg-slate-50/80">
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            <code>{order.order_number}</code>
                            <div className="text-[10px] text-slate-400 font-normal">{formatDate(order.created_at)}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sourceBadge.color}`}>
                              {sourceBadge.label}
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
                            {order.order_items?.map((item) => (
                              <div key={item.id} className="text-slate-700">
                                <b>{item.quantity}×</b> {item.title}
                                {item.is_upsell && (
                                  <span className="ml-1 px-1.5 py-0.2 text-[9px] bg-purple-100 text-purple-700 rounded font-bold">
                                    UPSELL
                                  </span>
                                )}
                              </div>
                            ))}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            {formatCurrency(order.total_amount, order.currency)}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center w-fit space-x-1 ${badge.bg}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                              <span>{badge.label}</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {order.status === 'pending' && (
                              <button
                                onClick={() => handleStatusChange(order.id, 'confirmed')}
                                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold mr-1.5 shadow-sm"
                              >
                                Confirm Order
                              </button>
                            )}
                            {order.status !== 'canceled' && order.status !== 'shipped' && (
                              <button
                                onClick={() => {
                                  if (confirm('Are you sure you want to cancel this order? Live stock will be restocked automatically.')) {
                                    handleStatusChange(order.id, 'canceled');
                                  }
                                }}
                                className="px-2 py-1 text-rose-600 hover:bg-rose-50 rounded-lg text-[11px] font-semibold"
                              >
                                Cancel
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
        )}

        {/* TAB 2: LIVE STOCK VIEWER */}
        {activeTab === 'inventory' && (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-emerald-800 text-xs font-medium">
              💡 <b>Live Stock Guide:</b> Check remaining quantities in real-time before pitching items on phone or WhatsApp. Stock is updated automatically when any order is confirmed or canceled.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {variants.map((v) => {
                const isLow = v.stock_quantity <= 5;
                const isOut = v.stock_quantity <= 0;

                return (
                  <div key={v.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{v.product?.title}</h4>
                        <div className="text-xs text-slate-500">{v.title}</div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isOut ? 'bg-rose-100 text-rose-800' : isLow ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                      </span>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div className="text-xs text-slate-500">
                        Price: <b className="text-slate-900">{formatCurrency(v.price)}</b>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase font-bold text-slate-400">Available Stock</div>
                        <div className={`text-xl font-black ${isOut ? 'text-rose-600' : 'text-slate-900'}`}>
                          {v.stock_quantity} units
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: MY UPSELL BONUSES */}
        {activeTab === 'rewards' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-900">My Upsell Rewards & Commission History</h3>
                <p className="text-xs text-slate-500">
                  Bonuses earned each time an upsell product is attached to an order or your personal coupon is redeemed.
                </p>
              </div>
              <span className="text-sm font-black text-brand-600">
                Total: {formatCurrency(totalBonusEarned)}
              </span>
            </div>

            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Bonus Amount</th>
                  <th className="py-3 px-4">Details</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rewards.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      No upsell bonuses earned yet. Add an upsell item when entering orders!
                    </td>
                  </tr>
                ) : (
                  rewards.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4 text-slate-500">{formatDate(r.created_at)}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <code>{r.order?.order_number || 'Order'}</code>
                      </td>
                      <td className="py-3.5 px-4 font-black text-emerald-600">
                        +{formatCurrency(r.bonus_amount)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">{r.note || 'Upsell bonus'}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {r.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* MULTI-CHANNEL ORDER ENTRY MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900">Multi-Channel Order Entry</h3>
                <p className="text-xs text-slate-500">Record customer orders from Messenger, WhatsApp, Phone Calls or Direct.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitOrder} className="mt-4 space-y-4 text-xs">
              {/* Channel Selector */}
              <div>
                <label className="block font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Order Source
                </label>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setSource('whatsapp')}
                    className={`py-2 px-3 rounded-xl border flex items-center justify-center space-x-1.5 transition-all ${
                      source === 'whatsapp'
                        ? 'border-green-500 bg-green-50 text-green-900 font-bold'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-green-600" />
                    <span>WhatsApp</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSource('messenger')}
                    className={`py-2 px-3 rounded-xl border flex items-center justify-center space-x-1.5 transition-all ${
                      source === 'messenger'
                        ? 'border-blue-500 bg-blue-50 text-blue-900 font-bold'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                    <span>Messenger</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSource('phone')}
                    className={`py-2 px-3 rounded-xl border flex items-center justify-center space-x-1.5 transition-all ${
                      source === 'phone'
                        ? 'border-orange-500 bg-orange-50 text-orange-900 font-bold'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <Phone className="w-3.5 h-3.5 text-orange-600" />
                    <span>Phone Call</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSource('manual')}
                    className={`py-2 px-3 rounded-xl border flex items-center justify-center space-x-1.5 transition-all ${
                      source === 'manual'
                        ? 'border-slate-900 bg-slate-900 text-white font-bold'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <Store className="w-3.5 h-3.5" />
                    <span>Walk-in</span>
                  </button>
                </div>
              </div>

              {/* Customer Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Customer Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Shahajadi Farjana"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Customer Phone Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 01726640689"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Full Delivery Address *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="House #, Road #, Area, City (e.g. 264/6, Block C, Banasree, Dhaka)"
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              {/* Item Selector with Live Stock */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex justify-between">
                  <span>Add Products to Order</span>
                  <span className="text-emerald-700">Live Stock Protected</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                  <div className="sm:col-span-6">
                    <label className="block text-[10px] text-slate-500 mb-0.5">Select Product / Variant</label>
                    <select
                      value={selectedVariantId}
                      onChange={(e) => setSelectedVariantId(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                    >
                      <option value="">-- Choose item from live stock --</option>
                      {variants.map((v) => (
                        <option
                          key={v.id}
                          value={v.id}
                          disabled={v.stock_quantity <= 0}
                        >
                          {v.product?.title} ({v.title}) — {formatCurrency(v.price)} [{v.stock_quantity} in stock]
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] text-slate-500 mb-0.5">Quantity</label>
                    <input
                      type="number"
                      min={1}
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(parseInt(e.target.value) || 1)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                    />
                  </div>

                  <div className="sm:col-span-2 flex items-center h-9">
                    <label className="inline-flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isUpsellItem}
                        onChange={(e) => setIsUpsellItem(e.target.checked)}
                        className="rounded text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-[11px] font-bold text-purple-700">Upsell?</span>
                    </label>
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={handleAddItem}
                      disabled={!selectedVariantId}
                      className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs disabled:opacity-40"
                    >
                      + Add Item
                    </button>
                  </div>
                </div>

                {/* Items in Current Order */}
                {orderItems.length > 0 ? (
                  <div className="mt-2 divide-y divide-slate-200 border-t border-slate-200 pt-2">
                    {orderItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-1.5 text-slate-800">
                        <div>
                          <span className="font-bold">{item.quantity}×</span> {item.title} ({item.variant_title})
                          {item.is_upsell && (
                            <span className="ml-1.5 px-1.5 py-0.5 text-[9px] bg-purple-100 text-purple-800 font-bold rounded">
                              ✨ UPSELL (+BONUS)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="font-bold">{formatCurrency(item.price * item.quantity)}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-rose-500 hover:text-rose-700"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 text-right font-black text-sm text-slate-900">
                      Total:{' '}
                      {formatCurrency(
                        orderItems.reduce((s, i) => s + i.price * i.quantity, 0)
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-2 text-slate-400 italic text-[11px]">
                    No items added yet. Pick an item above to add to cart.
                  </div>
                )}
              </div>

              {/* Coupon & Payment */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">
                    Salesperson Coupon Code (For Commission)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SARAH10"
                    value={couponUsed}
                    onChange={(e) => setCouponUsed(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="Cash on Delivery (COD)">Cash on Delivery (COD)</option>
                    <option value="bKash / Nagad Mobile Banking">bKash / Nagad Mobile Banking</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Order Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Customer requested evening delivery"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOrder || orderItems.length === 0}
                  className="px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold flex items-center space-x-1.5 shadow-md shadow-brand-500/20 disabled:opacity-50"
                >
                  <span>{submittingOrder ? 'Submitting Order...' : 'Confirm & Book Order'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
