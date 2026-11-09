'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/Navbar';
import confetti from 'canvas-confetti';
import {
  ShoppingBag,
  Copy,
  Check,
  PlusCircle,
  Boxes,
  Award,
  Phone,
  CheckCircle2,
  Clock,
  PhoneOff,
  RefreshCw,
  X,
  XCircle,
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
  Receipt,
  Truck,
  Pencil,
} from 'lucide-react';
import EditOrderItemsModal from '@/components/EditOrderItemsModal';
import EditCustomerDetailsModal from '@/components/EditCustomerDetailsModal';
import StaffPerformanceGraph from '@/components/StaffPerformanceGraph';
import ScreenshotLightboxModal from '@/components/ScreenshotLightboxModal';
import ModernProductSelect from '@/components/ModernProductSelect';
import DailyResetCountdown from '@/components/DailyResetCountdown';
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
import {
  formatCurrency,
  formatDate,
  getOrderDiscount,
  getOrderAdvance,
  getDhakaDateString,
  getDhakaParts,
  isSameDhakaDay,
  isHandedOverToSteadfast,
} from '@/lib/utils';

export default function SalesDashboard() {
  const supabase = createClient();

  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [activeTab, setActiveTab] = useState<'orders' | 'inventory' | 'rewards' | 'payouts'>('orders');

  // Orders State & Pagination
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [orderSourceFilter, setOrderSourceFilter] = useState('all');
  const [orderPage, setOrderPage] = useState(1);
  const [orderPageSize, setOrderPageSize] = useState(25);
  const [copiedOrderNumber, setCopiedOrderNumber] = useState<string | null>(null);
  const [editingOrderForItems, setEditingOrderForItems] = useState<Order | null>(null);
  const [editingCustomerOrder, setEditingCustomerOrder] = useState<Order | null>(null);

  // Live Inventory State & Pagination
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [inventorySearch, setInventorySearch] = useState('');
  const [invPage, setInvPage] = useState(1);
  const [invPageSize, setInvPageSize] = useState(30);

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

  // New Order Modal State with Apple Minimization Animation
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalClosing, setIsModalClosing] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);

  const handleCloseModal = () => {
    setIsModalClosing(true);
    setTimeout(() => {
      setIsModalOpen(false);
      setIsModalClosing(false);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('boyon:close-create-order'));
      }
    }, 240);
  };

  useEffect(() => {
    const handleOpenOrder = () => setIsModalOpen(true);
    window.addEventListener('boyon:open-create-order', handleOpenOrder);
    if (typeof window !== 'undefined' && window.location.search.includes('create=1')) {
      setIsModalOpen(true);
    }
    return () => window.removeEventListener('boyon:open-create-order', handleOpenOrder);
  }, []);
  const [source, setSource] = useState<OrderSource>('whatsapp');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash on Delivery (COD)');
  const [couponUsed, setCouponUsed] = useState('');
  const [note, setNote] = useState('');
  const [deliveryType, setDeliveryType] = useState<'inside_dhaka' | 'outside_dhaka' | 'free'>('inside_dhaka');
  const [customDiscount, setCustomDiscount] = useState<string>('');
  const [hasAdvancePayment, setHasAdvancePayment] = useState<boolean>(false);
  const [advancePayment, setAdvancePayment] = useState<string>('');
  const [advanceMethod, setAdvanceMethod] = useState<string>('bKash');
  const [advanceTrxId, setAdvanceTrxId] = useState<string>('');

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
      is_delayed_preorder?: boolean;
    }>
  >([]);

  // Current item being selected in modal
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [itemQuantity, setItemQuantity] = useState(1);
  const [isReachoutItem, setIsReachoutItem] = useState(false);

  // Performance Graph Month/Year State (Dhaka local time GMT+6)
  const dhakaParts = getDhakaParts();
  const [graphYear, setGraphYear] = useState<number>(dhakaParts.year);
  const [graphMonth, setGraphMonth] = useState<number>(dhakaParts.month);

  // Realtime Online / Away Presence State (defaults to false / Away if not toggled)
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

  // Load User Profile & Realtime Presence
  useEffect(() => {
    let presenceChannel: ReturnType<typeof supabase.channel> | null = null;
    let isMounted = true;

    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !isMounted) return;
      currentUserIdRef.current = user.id;

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

      // Check saved preference: if not explicitly toggled online, default to false (Away)
      const savedPref = typeof window !== 'undefined' ? localStorage.getItem('boyon_staff_status') : null;
      const initialOnline = savedPref !== null ? savedPref === 'online' : (profile?.is_online ?? false);
      setIsOnline(initialOnline);

      // Single presence channel
      const channel = supabase.channel('online-staff', {
        config: { presence: { key: user.id } },
      });
      presenceChannel = channel;
      presenceChannelRef.current = channel;

      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && isMounted) {
          await channel.track({
            user_id: user.id,
            full_name: profile?.full_name || 'Sales Staff',
            status: initialOnline ? 'online' : 'away',
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

  // Toggle Online / Away Status
  const handleToggleOnline = async (nextStatus: boolean) => {
    setIsOnline(nextStatus);
    if (typeof window !== 'undefined') {
      localStorage.setItem('boyon_staff_status', nextStatus ? 'online' : 'away');
    }

    // Broadcast through presence channel immediately
    if (presenceChannelRef.current && currentUserIdRef.current) {
      try {
        await presenceChannelRef.current.track({
          user_id: currentUserIdRef.current,
          full_name: currentProfile?.full_name || 'Sales Staff',
          status: nextStatus ? 'online' : 'away',
          online_at: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Presence track error:', err);
      }
    }

    // Persist to DB profile
    if (currentUserIdRef.current) {
      try {
        await supabase
          .from('profiles')
          .update({
            is_online: nextStatus,
            last_seen_at: new Date().toISOString(),
          })
          .eq('id', currentUserIdRef.current);
      } catch (err) {
        console.warn('Profile is_online update error:', err);
      }
    }
  };

  // Fetch Orders
  const fetchOrders = async (silent = false) => {
    if (!silent && orders.length === 0) setLoadingOrders(true);
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
  const fetchInventory = async (silent = false) => {
    if (!silent && variants.length === 0) setLoadingInventory(true);
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
  const fetchRewards = async (silent = false) => {
    if (!silent && rewards.length === 0) setLoadingRewards(true);
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
  const fetchPayouts = async (silent = false) => {
    if (!silent && myPayouts.length === 0) setLoadingPayouts(true);
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

  // Single Stable Realtime Subscription on mount with Debouncing
  useEffect(() => {
    fetchOrders();
    fetchInventory();
    fetchRewards();
    fetchPayouts();
    fetchQuotaTiers();

    let orderDebounceTimer: NodeJS.Timeout | null = null;
    const debouncedFetchOrders = () => {
      if (orderDebounceTimer) clearTimeout(orderDebounceTimer);
      orderDebounceTimer = setTimeout(() => {
        fetchOrders(true);
        fetchInventory(true);
      }, 400);
    };

    let rewardDebounceTimer: NodeJS.Timeout | null = null;
    const debouncedFetchRewards = () => {
      if (rewardDebounceTimer) clearTimeout(rewardDebounceTimer);
      rewardDebounceTimer = setTimeout(() => {
        fetchRewards(true);
      }, 400);
    };

    let payoutDebounceTimer: NodeJS.Timeout | null = null;
    const debouncedFetchPayouts = () => {
      if (payoutDebounceTimer) clearTimeout(payoutDebounceTimer);
      payoutDebounceTimer = setTimeout(() => {
        fetchPayouts(true);
        fetchRewards(true);
      }, 400);
    };

    const channel = supabase
      .channel('sales-realtime-singleton')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        debouncedFetchOrders
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'upsell_rewards' },
        debouncedFetchRewards
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payout_requests' },
        debouncedFetchPayouts
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
      if (orderDebounceTimer) clearTimeout(orderDebounceTimer);
      if (rewardDebounceTimer) clearTimeout(rewardDebounceTimer);
      if (payoutDebounceTimer) clearTimeout(payoutDebounceTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  // Add Item to Current Order
  const handleAddItem = () => {
    if (!selectedVariantId) return;
    const v = variants.find((variant) => variant.id === selectedVariantId);
    if (!v) return;

    const isOutOfStock = (v.stock_quantity ?? 0) <= 0;
    const isExceedingStock = itemQuantity > (v.stock_quantity ?? 0);
    const isProdDisabled = (v.product as any)?.is_active === false;

    let isPreOrder = false;

    if (isOutOfStock || isExceedingStock || isProdDisabled) {
      const prodName = (v.product as any)?.name || (v.product as any)?.title || 'This product';
      const reason = isProdDisabled || isOutOfStock ? 'is currently OUT OF STOCK' : `only has ${v.stock_quantity} units available`;
      const confirmed = window.confirm(
        `⚠️ "${prodName}" (${v.title}) ${reason}.\n\nDid the customer agree over ${source.toUpperCase()} to DELAYED DELIVERY for this pre-order?`
      );
      if (!confirmed) {
        return;
      }
      isPreOrder = true;
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
        is_delayed_preorder: isPreOrder,
      },
    ]);

    // Reset picker
    setSelectedVariantId('');
    setItemQuantity(1);
    setIsReachoutItem(false);
  };

  const hasDelayedPreOrderItems = useMemo(
    () => orderItems.some((it) => it.is_delayed_preorder),
    [orderItems]
  );

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

  const discountAmount = useMemo(() => {
    const val = parseFloat(customDiscount);
    return isNaN(val) || val < 0 ? 0 : val;
  }, [customDiscount]);

  const advanceAmount = useMemo(() => {
    if (!hasAdvancePayment) return 0;
    const val = parseFloat(advancePayment);
    return isNaN(val) || val < 0 ? 0 : val;
  }, [hasAdvancePayment, advancePayment]);

  const grandTotal = useMemo(() => {
    return Math.max(0, itemsSubtotal + deliveryCharge - discountAmount);
  }, [itemsSubtotal, deliveryCharge, discountAmount]);

  const remainingCod = useMemo(() => {
    return Math.max(0, grandTotal - advanceAmount);
  }, [grandTotal, advanceAmount]);

  const totalOrderAmount = grandTotal;

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
          payment_method:
            hasAdvancePayment && remainingCod === 0
              ? `${advanceMethod} (Prepaid)`
              : paymentMethod,
          note,
          items: orderItems,
          sales_rep_id: currentProfile?.id,
          coupon_used: couponUsed || null,
          is_reachout_order: orderItems.some((i) => i.is_reachout),
          is_delayed_delivery: hasDelayedPreOrderItems,
          delivery_type: deliveryType,
          delivery_charge: deliveryCharge,
          discount_amount: discountAmount,
          advance_payment: advanceAmount,
          advance_method: hasAdvancePayment ? advanceMethod : null,
          advance_trx_id: hasAdvancePayment && advanceTrxId.trim() ? advanceTrxId.trim() : null,
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

      // Reset Form & Close with minimization animation
      handleCloseModal();
      setCustomerName('');
      setCustomerPhone('');
      setShippingAddress('');
      setNote('');
      setOrderItems([]);
      setDeliveryType('inside_dhaka');
      setCustomDiscount('');
      setHasAdvancePayment(false);
      setAdvancePayment('');
      setAdvanceMethod('bKash');
      setAdvanceTrxId('');

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
  const handleStatusChange = async (orderId: string, newStatus: OrderStatus, customNote?: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const bodyPayload: Record<string, any> = { status: newStatus };
      if (customNote) bodyPayload.note = customNote;

      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(bodyPayload),
      });
      const data = await res.json();
      if (data.success) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  ...(data.order || {}),
                  status: newStatus,
                  note: data.order?.note || o.note,
                }
              : o
          )
        );
        fetchInventory();
        fetchRewards();
        // If this order was unassigned, refresh the orders list so server attribution is completely synced
        if (data.order?.sales_rep_id && !orders.find((o) => o.id === orderId)?.sales_rep_id) {
          fetchOrders();
        }
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Confirm Order Helper (with stockout check)
  const handleConfirmOrder = (order: Order) => {
    if (isOrderOutOfStock(order)) {
      const proceed = window.confirm(
        'Warning: This order contains out-of-stock items.\n\nIf the customer agreed to wait for the shipment, please select "Delay Agreed" instead.\n\nDo you still want to force normal confirmation to packing?'
      );
      if (!proceed) return;
    }
    handleStatusChange(order.id, 'confirmed');
  };

  // Calculations:
  // Today's Earnings (resets strictly at 12:00 AM midnight Bangladesh / Dhaka time GMT+6)
  const todayStr = getDhakaDateString();
  const todayEarnings = useMemo(() => {
    return rewards
      .filter((r) => isSameDhakaDay(r.created_at, todayStr))
      .reduce((sum, r) => sum + Number(r.bonus_amount || 0), 0);
  }, [rewards, todayStr]);

  // Website Upsells (Extra Sales) achieved today by this staff member (Dhaka 12 AM reset)
  const todayWebsiteUpsells = useMemo(() => {
    if (!currentProfile?.id) return 0;
    return orders
      .filter(
        (o) =>
          o.sales_rep_id === currentProfile.id &&
          o.source === 'website' &&
          isSameDhakaDay(o.created_at, todayStr)
      )
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

  // Today's Non-Website Sales achieved by this staff member (Dhaka 12 AM reset)
  const todayOtherSales = useMemo(() => {
    if (!currentProfile?.id) return 0;
    return orders
      .filter(
        (o) =>
          o.sales_rep_id === currentProfile.id &&
          o.source !== 'website' &&
          o.status !== 'canceled' &&
          isSameDhakaDay(o.created_at, todayStr)
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
      const matchStatus =
        orderStatusFilter === 'all'
          ? true
          : orderStatusFilter === 'delivered'
          ? o.status === 'delivered' || o.status === 'shipped'
          : o.status === orderStatusFilter;
      const matchSource =
        orderSourceFilter === 'all' ? true : o.source === orderSourceFilter;
      const q = orderSearch.toLowerCase().trim();
      const matchQuery =
        !q ||
        o.order_number.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.customer_phone.includes(q) ||
        (o.note && o.note.toLowerCase().includes(q));
      return matchStatus && matchSource && matchQuery;
    });
  }, [orders, orderStatusFilter, orderSourceFilter, orderSearch]);

  // Reset pagination on search / filter changes
  useEffect(() => {
    setOrderPage(1);
  }, [orderSearch, orderStatusFilter, orderSourceFilter]);

  const totalOrderPages = Math.max(1, Math.ceil(filteredOrders.length / orderPageSize));
  const paginatedOrders = useMemo(() => {
    const start = (orderPage - 1) * orderPageSize;
    return filteredOrders.slice(start, start + orderPageSize);
  }, [filteredOrders, orderPage, orderPageSize]);

  // Copy order number helper
  const handleCopyOrderNumber = (num: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(num);
      setCopiedOrderNumber(num);
      setTimeout(() => setCopiedOrderNumber(null), 2000);
    }
  };

  // Safe WhatsApp link generator for Bangladesh phone numbers
  const getWhatsAppUrl = (phone: string) => {
    const digits = phone.replace(/[^0-9]/g, '');
    const cleanNumber = digits.startsWith('880') ? digits : digits.startsWith('0') ? '88' + digits : '880' + digits;
    return `https://wa.me/${cleanNumber}`;
  };

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
      const dayKey = getDhakaDateString(r.created_at);
      if (days[dayKey]) {
        days[dayKey].commission += Number(r.bonus_amount || 0);
      }
    });

    myOrders.forEach((o) => {
      const dayKey = getDhakaDateString(o.created_at);
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
      const q = inventorySearch.toLowerCase().trim();
      const matchName = product?.name?.toLowerCase().includes(q) || product?.title?.toLowerCase().includes(q);
      const matchSku = (v.sku?.toLowerCase() || '').includes(q);
      const matchVariant = (v.title?.toLowerCase() || '').includes(q);
      return !q || matchName || matchSku || matchVariant;
    });
  }, [variants, inventorySearch]);

  useEffect(() => {
    setInvPage(1);
  }, [inventorySearch]);

  const totalInvPages = Math.max(1, Math.ceil(filteredVariants.length / invPageSize));
  const paginatedVariants = useMemo(() => {
    const start = (invPage - 1) * invPageSize;
    return filteredVariants.slice(start, start + invPageSize);
  }, [filteredVariants, invPage, invPageSize]);

  // Get Clean Status Badge Dot & Color
  const getCleanStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return { dot: 'bg-amber-400', label: 'Pending' };
      case 'not_reachable':
        return { dot: 'bg-orange-500', label: 'Not Reachable' };
      case 'delayed_delivery':
        return { dot: 'bg-amber-600', label: 'Delayed Delivery' };
      case 'confirmed':
        return { dot: 'bg-blue-500', label: 'Confirmed' };
      case 'ready_to_ship':
        return { dot: 'bg-indigo-500', label: 'Ready to Ship' };
      case 'shipped':
        return { dot: 'bg-sky-500', label: 'Shipped' };
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

  // Fast map to lookup live variant inventory and product active state
  const variantStockMap = useMemo(() => {
    return new Map(variants.map((v) => [v.id, v]));
  }, [variants]);

  // Check if an order contains any out-of-stock items (stock <= 0 or disabled product)
  const isOrderOutOfStock = useCallback(
    (order: Order) => {
      if (!order.order_items || order.order_items.length === 0) return false;
      return order.order_items.some((item) => {
        if (!item.variant_id) return false;
        const v = variantStockMap.get(item.variant_id);
        if (!v) return false;
        const isProductDisabled = (v.product as any)?.is_active === false;
        return (v.stock_quantity ?? 0) <= 0 || isProductDisabled;
      });
    },
    [variantStockMap]
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-orange-100 selection:text-orange-900">
      <Navbar
        currentProfile={currentProfile}
        activeTab={activeTab}
        onTabChange={(tab: any) => setActiveTab(tab)}
        isOnline={isOnline}
        isCreateOrderOpen={isModalOpen}
        onCreateOrder={() => setIsModalOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 space-y-6">
        {/* Top Presence & Staff Identity Bar */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-11 h-11 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-sm overflow-hidden shrink-0">
                {currentProfile?.avatar_url ? (
                  <img src={currentProfile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  (currentProfile?.full_name || currentProfile?.email || 'S')[0].toUpperCase()
                )}
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-white ${
                  isOnline ? 'bg-emerald-500' : 'bg-amber-400'
                }`}
              />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-extrabold text-slate-900 text-base sm:text-lg">
                  {currentProfile?.full_name || 'Sales Staff'}
                </h1>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                    isOnline
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  <span className="relative flex h-2 w-2">
                    {isOnline && (
                      <span className="animate-ping motion-reduce:animate-none absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    )}
                    <span
                      className={`relative inline-flex rounded-full h-2 w-2 ${
                        isOnline ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    />
                  </span>
                  <span>{isOnline ? 'Online' : 'Away'}</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {isOnline
                  ? 'You are active and marked as Online to the management team.'
                  : 'You are currently set as Away. Toggle on when you are ready to work.'}
              </p>
            </div>
          </div>

          {/* Set as Online Switch Toggle */}
          <div className="flex items-center gap-3 self-end sm:self-center bg-slate-50 border border-slate-200/80 px-3.5 py-2 rounded-xl">
            <span className="text-xs font-bold text-slate-700 select-none">
              Set as Online
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isOnline}
              onClick={() => handleToggleOnline(!isOnline)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                isOnline ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  isOnline ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* KPI Cards: Today's Earnings & Piggybank Balance */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {/* Today's Earnings (Resets at 12am) */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  Today's Earnings
                </span>
                <DailyResetCountdown variant="kpi" />
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
                <span className="text-xs font-medium text-slate-500">
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
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs shadow-xs transition-colors"
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
                <span className="text-xs font-medium text-slate-500">
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

        {/* Dual Realtime Sales Milestones Trackers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 1. Non-Website Sales Milestones */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-start sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center shrink-0">
                    <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-bold text-slate-900 text-sm truncate">
                        Non-Website Sales Milestones
                      </h3>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200 shrink-0">
                        <Clock className="w-2.5 h-2.5 text-amber-600" /> 12 AM
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 truncate">
                      Phone, WhatsApp, Messenger & Manual Orders
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setTiersModalTab('other');
                    setShowTiersModal(true);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer shrink-0"
                >
                  <Award className="w-3.5 h-3.5 text-amber-600" />
                  <span>Milestones</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-3">
                <div>
                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400  block truncate">
                    Today's Non-Website Sales
                  </span>
                  <div className="text-xl sm:text-2xl font-extrabold text-slate-900 font-mono mt-0.5">
                    ৳{Math.round(todayOtherSales).toLocaleString()}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400  block truncate">
                    Extra Commission
                  </span>
                  <div className="text-base sm:text-xl font-extrabold text-amber-600 font-mono mt-0.5 flex items-baseline sm:items-center gap-1 flex-wrap">
                    {unlockedOtherTier ? (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 self-center" />
                        <span>+৳{unlockedOtherTier.bonus.toLocaleString()}</span>
                        <span className="text-[11px] sm:text-xs font-semibold text-amber-800 font-sans whitespace-nowrap">
                          ({unlockedOtherTier.name})
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-400 text-xs sm:text-sm font-medium font-sans">
                        None yet
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-3">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5 gap-2">
                  <span className="font-semibold text-slate-600 truncate text-[11px] sm:text-xs">
                    {nextOtherTier
                      ? `Next: ${nextOtherTier.name} (+৳${nextOtherTier.bonus.toLocaleString()})`
                      : 'Top Milestone Reached!'}
                  </span>
                  <span className="font-mono font-bold text-slate-800 shrink-0 text-[11px] sm:text-xs whitespace-nowrap">
                    {nextOtherTier
                      ? `৳${Math.max(0, nextOtherTier.min_quota - todayOtherSales).toLocaleString()} away`
                      : 'Max'}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 sm:h-2.5 overflow-hidden border border-slate-200/60">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-colors duration-500"
                    style={{ width: `${otherQuotaProgress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Quick Milestones Preview */}
            <div className="pt-2.5 border-t border-slate-100 mt-3 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 sm:flex-wrap">
              {otherActiveTiers.map((tier) => {
                const isReached = todayOtherSales >= tier.min_quota;
                return (
                  <span
                    key={tier.id}
                    className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-semibold border shrink-0 whitespace-nowrap ${
                      isReached
                        ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
                        : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}
                    title={`Target: ৳${tier.min_quota.toLocaleString()} -> Extra Commission: ৳${tier.bonus.toLocaleString()}`}
                  >
                    ৳{tier.min_quota >= 1000 ? `${tier.min_quota / 1000}k` : tier.min_quota} : +৳{tier.bonus}
                  </span>
                );
              })}
            </div>
          </div>

          {/* 2. Website Sales Milestones */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-start sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-orange-50 border border-orange-200/60 flex items-center justify-center shrink-0">
                    <WebsiteFlatIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-bold text-slate-900 text-sm truncate">
                        Website Sales Milestones
                      </h3>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-900 bg-orange-50 px-1.5 py-0.5 rounded-full border border-orange-200/60 shrink-0">
                        <Clock className="w-2.5 h-2.5 text-emerald-600" /> 12 AM
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 truncate">
                      Upsell Extra Sales on Website Orders
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setTiersModalTab('website');
                    setShowTiersModal(true);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer shrink-0"
                >
                  <Award className="w-3.5 h-3.5 text-orange-600" />
                  <span>Milestones</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-3">
                <div>
                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400  block truncate">
                    Today's Website Sales
                  </span>
                  <div className="text-xl sm:text-2xl font-extrabold text-slate-900 font-mono mt-0.5">
                    ৳{Math.round(todayWebsiteUpsells).toLocaleString()}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400  block truncate">
                    Extra Commission
                  </span>
                  <div className="text-base sm:text-xl font-extrabold text-orange-600 font-mono mt-0.5 flex items-baseline sm:items-center gap-1 flex-wrap">
                    {unlockedWebsiteTier ? (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-orange-500 shrink-0 self-center" />
                        <span>+৳{unlockedWebsiteTier.bonus.toLocaleString()}</span>
                        <span className="text-[11px] sm:text-xs font-semibold text-orange-900 font-sans whitespace-nowrap">
                          ({unlockedWebsiteTier.name})
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-400 text-xs sm:text-sm font-medium font-sans">
                        None yet
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-3">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5 gap-2">
                  <span className="font-semibold text-slate-600 truncate text-[11px] sm:text-xs">
                    {nextWebsiteTier
                      ? `Next: ${nextWebsiteTier.name} (+৳${nextWebsiteTier.bonus.toLocaleString()})`
                      : 'Top Milestone Reached!'}
                  </span>
                  <span className="font-mono font-bold text-slate-800 shrink-0 text-[11px] sm:text-xs whitespace-nowrap">
                    {nextWebsiteTier
                      ? `৳${Math.max(0, nextWebsiteTier.min_quota - todayWebsiteUpsells).toLocaleString()} away`
                      : 'Max'}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 sm:h-2.5 overflow-hidden border border-slate-200/60">
                  <div
                    className="bg-orange-500 h-full rounded-full transition-colors duration-500"
                    style={{ width: `${websiteQuotaProgress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Quick Milestones Preview */}
            <div className="pt-2.5 border-t border-slate-100 mt-3 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 sm:flex-wrap">
              {websiteActiveTiers.map((tier) => {
                const isReached = todayWebsiteUpsells >= tier.min_quota;
                return (
                  <span
                    key={tier.id}
                    className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-semibold border shrink-0 whitespace-nowrap ${
                      isReached
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold'
                        : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}
                    title={`Target: ৳${tier.min_quota.toLocaleString()} -> Extra Commission: ৳${tier.bonus.toLocaleString()}`}
                  >
                    ৳{tier.min_quota >= 1000 ? `${tier.min_quota / 1000}k` : tier.min_quota} : +৳{tier.bonus}
                  </span>
                );
              })}
            </div>
          </div>
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
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm shadow-sm active:scale-[0.98] transition-transform motion-reduce:transition-none cursor-pointer"
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
                  placeholder="Search customer, phone, order #…"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={orderStatusFilter}
                    onChange={(e) => setOrderStatusFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="not_reachable">Not Reachable</option>
                    <option value="delayed_delivery">Delayed Delivery</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="ready_to_ship">Ready to Ship</option>
                    <option value="on_the_way">On the Way</option>
                    <option value="delivered">Delivered</option>
                    <option value="canceled">Canceled</option>
                  </select>
                </div>

                <select
                  value={orderSourceFilter}
                  onChange={(e) => setOrderSourceFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20"
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

            {/* Orders List: Dual-Mode Mobile Cards + Desktop Table */}
            {loadingOrders ? (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center shadow-xs">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mb-3" />
                <p className="text-slate-600 font-medium text-sm">Loading orders…</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center mx-auto mb-3 text-orange-600">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900">No orders found</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {orderSearch || orderStatusFilter !== 'all' || orderSourceFilter !== 'all'
                    ? 'No orders match your current search query or active filter.'
                    : 'No orders have been recorded yet. Click Create New Order to start.'}
                </p>
                {(orderSearch || orderStatusFilter !== 'all' || orderSourceFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setOrderSearch('');
                      setOrderStatusFilter('all');
                      setOrderSourceFilter('all');
                    }}
                    className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* 1. Mobile Cards View (< md) */}
                <div className="block md:hidden space-y-3.5">
                  {paginatedOrders.map((order) => {
                    const isOrderCreator = Boolean(order.sales_rep_id && order.sales_rep_id === currentProfile?.id);
                    const isUnassigned = !order.sales_rep_id;
                    const isAdmin = currentProfile?.role === 'admin';
                    const isMyOrder = isOrderCreator;
                    const isOtherStaffOrder = Boolean(order.sales_rep_id && order.sales_rep_id !== currentProfile?.id && !isAdmin);
                    const isHandedOver = isHandedOverToSteadfast(order);
                    const isCourierStage =
                      order.status === 'on_the_way' ||
                      order.status === 'shipped' ||
                      order.status === 'delivered';
                    const isManagedByCourier = isHandedOver && isCourierStage;
                    const canEditOrder = (isOrderCreator || isUnassigned || isAdmin) && !isHandedOver;
                    const canEditCustomer = canEditOrder;
                    const hasUpsell = order.order_items?.some((i) => i.is_upsell);
                    const hasReachout = Boolean(
                      (order as any).is_reachout ||
                      order.note?.toLowerCase().includes('reachout') ||
                      order.order_items?.some((i: any) => i.is_reachout) ||
                      (Array.isArray((order as any).original_items) && (order as any).original_items.some((i: any) => i.is_reachout))
                    );
                    const statusBadge = getCleanStatusBadge(order.status);
                    const disc = getOrderDiscount(order);
                    const adv = getOrderAdvance(order);
                    const cod = Math.max(0, order.total_amount - adv);

                    return (
                      <div
                        key={order.id}
                        className={`bg-white rounded-2xl border p-4 shadow-xs transition-shadow space-y-3 ${
                          isMyOrder ? 'border-orange-300/90 bg-orange-50/15' : 'border-slate-200/90'
                        }`}
                      >
                        {/* Header: Order ID, Source, Date & Status */}
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <button
                              type="button"
                              onClick={() => handleCopyOrderNumber(order.order_number)}
                              className="font-mono font-bold text-slate-900 text-sm hover:text-orange-600 transition-colors flex items-center gap-1 cursor-pointer"
                              title="Click to copy order number"
                            >
                              <span>{order.order_number}</span>
                              {copiedOrderNumber === order.order_number ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3 text-slate-400 opacity-60" />
                              )}
                            </button>
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-medium shrink-0">
                              {order.source === 'whatsapp' && <WhatsAppFlatIcon className="w-3.5 h-3.5 shrink-0" />}
                              {order.source === 'messenger' && <MessengerFlatIcon className="w-3.5 h-3.5 shrink-0" />}
                              {order.source === 'phone' && <PhoneCallFlatIcon className="w-3.5 h-3.5 shrink-0" />}
                              {order.source === 'manual' && <WalkInFlatIcon className="w-3.5 h-3.5 shrink-0" />}
                              {order.source === 'website' && <WebsiteFlatIcon className="w-3.5 h-3.5 shrink-0" />}
                              <span className="capitalize text-[11px]">{order.source}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                                order.status === 'delivered'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : order.status === 'confirmed'
                                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                                  : order.status === 'delayed_delivery'
                                  ? 'bg-amber-50 text-amber-900 border-amber-300'
                                  : order.status === 'canceled'
                                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
                              <span>{statusBadge.label}</span>
                            </span>
                          </div>
                        </div>

                        {/* Customer Information & Direct 1-Tap Contact Action Bar */}
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h4 className="font-bold text-slate-900 text-sm truncate">{order.customer_name}</h4>
                              <p className="text-xs text-slate-500 font-mono mt-0.5">{order.customer_phone}</p>
                            </div>
                            <span className="text-[11px] text-slate-400 shrink-0 font-medium">
                              {formatDate(order.created_at)}
                            </span>
                          </div>

                          {order.shipping_address && (
                            <p className="text-xs text-slate-600 bg-slate-50 rounded-xl p-2.5 border border-slate-100 leading-relaxed">
                              {order.shipping_address}
                            </p>
                          )}

                          {isOrderOutOfStock(order) && (
                            <div className="p-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs font-semibold flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>Out of stock item (Customer delay agreement required)</span>
                            </div>
                          )}

                          {Boolean(order.consignment_id || order.tracking_code) && (
                            <div className="flex items-center gap-1.5 text-xs font-mono text-indigo-700 bg-indigo-50 border border-indigo-200/70 rounded-xl px-2.5 py-1 w-fit">
                              <Truck className="w-3.5 h-3.5 text-indigo-500" />
                              <span>Steadfast: #{order.tracking_code || order.consignment_id}</span>
                            </div>
                          )}

                          {/* Direct Mobile Quick Actions (Call & WhatsApp) */}
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <a
                              href={`tel:${order.customer_phone}`}
                              className="min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold text-xs transition-colors active:scale-[0.98] motion-reduce:transition-none"
                            >
                              <Phone className="w-4 h-4 text-slate-600" />
                              <span>Call Customer</span>
                            </a>
                            <a
                              href={getWhatsAppUrl(order.customer_phone)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs transition-colors active:scale-[0.98] motion-reduce:transition-none"
                            >
                              <WhatsAppFlatIcon className="w-4 h-4" />
                              <span>WhatsApp</span>
                            </a>
                          </div>
                        </div>

                        {/* Items Breakdown */}
                        <div className="space-y-1.5 pt-1">
                          <div className="text-xs font-bold text-slate-500">
                            Ordered Items ({order.order_items?.length || 0})
                          </div>
                          <div className="space-y-1">
                            {order.order_items?.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between text-xs bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100"
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="font-bold text-orange-600 shrink-0">{item.quantity}x</span>
                                  <span className="text-slate-800 font-medium truncate">{item.title}</span>
                                  {item.variant_title && item.variant_title !== 'Default Title' && (
                                    <span className="text-slate-500 text-[11px] shrink-0">({item.variant_title})</span>
                                  )}
                                  {item.is_upsell && (
                                    <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[9px] shrink-0">
                                      Upsell
                                    </span>
                                  )}
                                </div>
                                <span className="font-mono font-semibold text-slate-700 shrink-0">
                                  {formatCurrency(item.price * item.quantity)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Financial Summary */}
                        <div className="flex items-center justify-between bg-orange-50/70 border border-orange-200/60 rounded-xl p-3">
                          <div className="space-y-0.5">
                            <div className="text-[11px] text-slate-500 font-medium">Payment Details</div>
                            {adv > 0 ? (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-emerald-700 font-medium">Adv: {formatCurrency(adv)}</span>
                                <span className="text-slate-300">&middot;</span>
                                <span className="font-bold text-slate-900 font-mono">COD: {formatCurrency(cod)}</span>
                              </div>
                            ) : (
                              <div className="text-xs text-slate-600 font-medium">Cash on Delivery</div>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-slate-400 font-semibold block">Total</span>
                            <span className="text-base font-extrabold text-orange-600 font-mono">
                              {formatCurrency(order.total_amount)}
                            </span>
                          </div>
                        </div>

                        {/* Mobile Order Status & Action Footer */}
                        <div className="pt-2 border-t border-slate-100 space-y-2.5">
                          {isOtherStaffOrder ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                                <span className="flex items-center gap-1.5 text-slate-500 font-semibold">
                                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Assigned to Other Staff (Read-Only)</span>
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusBadge.bg} ${statusBadge.color} border ${statusBadge.border}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
                                  {statusBadge.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingOrderForItems(order)}
                                  className="w-full min-h-[42px] flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors active:scale-[0.98] motion-reduce:transition-none cursor-pointer"
                                >
                                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                                  <span>View Items & History (Read-Only)</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {/* Order Status Selector */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="text-[11px] font-semibold text-slate-500">
                                    Order Status:
                                  </label>
                                  {isUnassigned ? (
                                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                      <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                                      <span>Unassigned · Claimable</span>
                                    </span>
                                  ) : isMyOrder ? (
                                    <span className="text-[10px] font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-md">
                                      Your Order
                                    </span>
                                  ) : null}
                                </div>
                                {isManagedByCourier && isCourierStage ? (
                                  <div className="text-xs font-bold text-amber-900 bg-amber-50 border border-amber-300 rounded-xl px-2.5 py-2 flex items-center justify-between">
                                    <span>Courier Managed</span>
                                    <Lock className="w-3.5 h-3.5 text-amber-700" />
                                  </div>
                                ) : (
                                  <select
                                    value={order.status}
                                    onChange={(e) => {
                                      const val = e.target.value as OrderStatus;
                                      if (val === 'confirmed') {
                                        handleConfirmOrder(order);
                                      } else {
                                        const note =
                                          val === 'delayed_delivery'
                                            ? 'Customer agreed to delayed delivery'
                                            : val === 'canceled'
                                            ? 'Customer refused delayed delivery (Stockout)'
                                            : undefined;
                                        handleStatusChange(order.id, val, note);
                                      }
                                    }}
                                    className="w-full text-xs font-bold px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer shadow-2xs"
                                  >
                                    <option value="pending">Pending</option>
                                    <option value="not_reachable">Not Reachable</option>
                                    <option value="confirmed">Confirm Order (In Stock)</option>
                                    <option value="delayed_delivery">Confirm Delayed Delivery</option>
                                    <option value="canceled">Refused Delay / Cancel</option>
                                  </select>
                                )}
                              </div>

                              {/* 1-Tap Fast Actions for Pending / Not Reachable */}
                              {(order.status === 'pending' || order.status === 'not_reachable') && !isManagedByCourier && (
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleConfirmOrder(order)}
                                    className="min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors active:scale-[0.98] motion-reduce:transition-none cursor-pointer shadow-xs"
                                  >
                                    <CheckCircle2 className="w-4 h-4 text-white" />
                                    <span>Confirm Order</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange(order.id, 'not_reachable')}
                                    className="min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-bold transition-colors active:scale-[0.98] motion-reduce:transition-none cursor-pointer"
                                  >
                                    <PhoneOff className="w-4 h-4 text-slate-600" />
                                    <span>Not Reachable</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleStatusChange(
                                        order.id,
                                        'delayed_delivery',
                                        'Customer agreed to delayed delivery'
                                      )
                                    }
                                    className="min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold transition-colors active:scale-[0.98] motion-reduce:transition-none cursor-pointer"
                                  >
                                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                                    <span>Delay Agreed</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleStatusChange(
                                        order.id,
                                        'canceled',
                                        'Customer refused delayed delivery (Stockout)'
                                      )
                                    }
                                    className="min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors active:scale-[0.98] motion-reduce:transition-none cursor-pointer"
                                  >
                                    <XCircle className="w-3.5 h-3.5 text-rose-500" />
                                    <span>Refused Delay</span>
                                  </button>
                                </div>
                              )}

                              {/* Fast Actions for Delayed Delivery */}
                              {order.status === 'delayed_delivery' && !isManagedByCourier && (
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleConfirmOrder(order)}
                                    className="min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors active:scale-[0.98] motion-reduce:transition-none cursor-pointer shadow-xs"
                                  >
                                    <CheckCircle2 className="w-4 h-4 text-white" />
                                    <span>Confirm Now</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (window.confirm('Cancel this delayed delivery order (Customer called to cancel)?')) {
                                        handleStatusChange(order.id, 'canceled', 'Customer canceled delayed delivery');
                                      }
                                    }}
                                    className="min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors active:scale-[0.98] motion-reduce:transition-none cursor-pointer"
                                  >
                                    <XCircle className="w-3.5 h-3.5 text-rose-500" />
                                    <span>Cancel Order</span>
                                  </button>
                                </div>
                              )}

                              {/* Fast Actions for Confirmed (Pre-Courier) */}
                              {order.status === 'confirmed' && !isManagedByCourier && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm('Revert this order back to Pending status?')) {
                                    handleStatusChange(order.id, 'pending', 'Reverted to pending by sales staff');
                                  }
                                }}
                                className="flex-1 min-h-[40px] flex items-center justify-center gap-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors active:scale-[0.98] motion-reduce:transition-none cursor-pointer"
                              >
                                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                                <span>Revert to Pending</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm('Cancel this confirmed order (Customer called to cancel)?')) {
                                    handleStatusChange(order.id, 'canceled', 'Customer canceled confirmed order');
                                  }
                                }}
                                className="flex-1 min-h-[40px] flex items-center justify-center gap-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition-colors active:scale-[0.98] motion-reduce:transition-none cursor-pointer"
                              >
                                <XCircle className="w-3.5 h-3.5 text-rose-500" />
                                <span>Cancel Order</span>
                              </button>
                            </div>
                          )}

                          {/* Edit Customer & Edit Items */}
                          <div className="flex items-center gap-2 pt-1">
                            {canEditCustomer && (
                              <button
                                type="button"
                                onClick={() => setEditingCustomerOrder(order)}
                                className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors active:scale-[0.98] motion-reduce:transition-none cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5 text-slate-600" />
                                <span>Edit Customer</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setEditingOrderForItems(order)}
                              className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-900 border border-orange-200 text-xs font-semibold transition-colors active:scale-[0.98] motion-reduce:transition-none cursor-pointer"
                            >
                              <PackageOpen className="w-3.5 h-3.5 text-orange-600" />
                              <span>Edit Items</span>
                            </button>
                          </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 2. Desktop High-Density Table (>= md) */}
                <div className="hidden md:block bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-700">
                      <thead className="bg-slate-50/80 border-b border-slate-200/80 text-xs font-semibold text-slate-500">
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
                        {paginatedOrders.map((order) => {
                          const isOrderCreator = Boolean(order.sales_rep_id && order.sales_rep_id === currentProfile?.id);
                          const isUnassigned = !order.sales_rep_id;
                          const isAdmin = currentProfile?.role === 'admin';
                          const isMyOrder = isOrderCreator;
                          const isOtherStaffOrder = Boolean(order.sales_rep_id && order.sales_rep_id !== currentProfile?.id && !isAdmin);
                          const isHandedOver = isHandedOverToSteadfast(order);
                          const isCourierStage =
                            order.status === 'on_the_way' ||
                            order.status === 'shipped' ||
                            order.status === 'delivered';
                          const isManagedByCourier = isHandedOver && isCourierStage;
                          const canEditOrder = (isOrderCreator || isUnassigned || isAdmin) && !isHandedOver;
                          const canEditCustomer = canEditOrder;
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
                                isMyOrder ? 'bg-orange-50/20' : ''
                              }`}
                            >
                              <td className="p-4">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-slate-900">
                                    {order.order_number}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyOrderNumber(order.order_number)}
                                    className="p-1 rounded text-slate-400 hover:text-orange-600 transition-colors cursor-pointer"
                                    title="Copy Order #"
                                  >
                                    {copiedOrderNumber === order.order_number ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
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
                                <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                  <a
                                    href={`tel:${order.customer_phone}`}
                                    className="inline-flex items-center gap-1 hover:text-orange-600 font-mono"
                                  >
                                    <Phone className="w-3 h-3 text-slate-400" />
                                    <span>{order.customer_phone}</span>
                                  </a>
                                  <a
                                    href={getWhatsAppUrl(order.customer_phone)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded px-1 py-0.2"
                                  >
                                    WA
                                  </a>
                                </div>
                                {order.shipping_address && (
                                  <div className="text-xs text-slate-400 truncate max-w-xs mt-0.5" title={order.shipping_address}>
                                    {order.shipping_address}
                                  </div>
                                )}
                                {isOrderOutOfStock(order) && (
                                  <div className="mt-1">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-300 shadow-2xs">
                                      <Clock className="w-3 h-3 text-amber-600" />
                                      Out of Stock (Delay Agreement)
                                    </span>
                                  </div>
                                )}
                                {Boolean(order.consignment_id || order.tracking_code) && (
                                  <div className="mt-1 flex items-center gap-1 text-[11px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-200/60 rounded px-1.5 py-0.5 w-fit">
                                    <Truck className="w-3 h-3 text-indigo-500" />
                                    <span>Steadfast: #{order.tracking_code || order.consignment_id}</span>
                                  </div>
                                )}

                                {/* Customer Details Edit Action or Locked Indicator */}
                                <div className="mt-1.5 flex items-center gap-1.5">
                                  {isHandedOver ? (
                                    <span
                                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-md shadow-2xs cursor-not-allowed"
                                      title={`Customer details locked: Order #${order.order_number} has already been handed over to Steadfast Courier.`}
                                    >
                                      <Lock className="w-2.5 h-2.5 text-slate-400" />
                                      <span>Locked with Courier</span>
                                    </span>
                                  ) : canEditCustomer ? (
                                    <button
                                      type="button"
                                      onClick={() => setEditingCustomerOrder(order)}
                                      className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-800 hover:text-orange-950 bg-orange-50 hover:bg-orange-100 border border-orange-200/90 px-2 py-0.5 rounded-md transition-colors cursor-pointer shadow-2xs"
                                      title="Edit customer name, phone, delivery address, or note"
                                    >
                                      <Pencil className="w-3 h-3 text-orange-600" />
                                      <span>Edit Details</span>
                                    </button>
                                  ) : isOtherStaffOrder ? (
                                    <span
                                      className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400"
                                      title="Assigned to another staff member (Read-only)"
                                    >
                                      <Lock className="w-2.5 h-2.5 text-slate-300" />
                                      <span>Other Staff</span>
                                    </span>
                                  ) : null}
                                </div>
                              </td>

                              <td className="p-4">
                                {(() => {
                                  const disc = getOrderDiscount(order);
                                  const adv = getOrderAdvance(order);
                                  const cod = Math.max(0, order.total_amount - adv);

                                  return (
                                    <>
                                      <div className="flex flex-col">
                                        {adv > 0 ? (
                                          <div className="space-y-0.5">
                                            <div className="flex items-center gap-1.5 font-mono">
                                              <span className="font-bold text-slate-900 text-sm">
                                                COD: {formatCurrency(cod)}
                                              </span>
                                            </div>
                                            <div className="text-[11px] text-slate-400 font-mono">
                                              Total: {formatCurrency(order.total_amount)}
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="font-semibold text-slate-900 font-mono">
                                            {formatCurrency(order.total_amount)}
                                          </div>
                                        )}
                                      </div>
                                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
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
                                        {disc > 0 && (
                                          <span
                                            className="px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200/80 font-bold text-[10px]"
                                            title={`Discount applied: -৳${disc.toLocaleString()}`}
                                          >
                                            Disc: -৳{disc.toLocaleString()}
                                          </span>
                                        )}
                                        {adv > 0 && (
                                          <span
                                            className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-bold text-[10px]"
                                            title={`Advance paid: ৳${adv.toLocaleString()}`}
                                          >
                                            Adv: ৳{adv.toLocaleString()}
                                          </span>
                                        )}
                                      </div>
                                    </>
                                  );
                                })()}
                              </td>

                              <td className="p-4">
                                {isMyOrder ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-50 text-orange-900 border border-orange-200/70 text-xs font-semibold">
                                    Assigned to You
                                  </span>
                                ) : isUnassigned ? (
                                  <span
                                    className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full"
                                    title="Unassigned website order: First staff to confirm or edit claims this lead"
                                  >
                                    <Sparkles className="w-3 h-3 text-emerald-600" />
                                    <span>Unassigned (Website)</span>
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-1 text-xs text-slate-500 font-medium bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full"
                                    title="Assigned to another staff member (Read-only)"
                                  >
                                    <Lock className="w-2.5 h-2.5 text-slate-400" />
                                    <span>Other Staff</span>
                                  </span>
                                )}
                              </td>

                              <td className="p-4">
                                {isManagedByCourier && isCourierStage ? (
                                  <span
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200/80 shadow-2xs"
                                    title="Actively managed by Steadfast Courier"
                                  >
                                    <span className={`w-2 h-2 rounded-full ${statusBadge.dot}`} />
                                    <span>{statusBadge.label}</span>
                                    <Lock className="w-3 h-3 text-slate-400 ml-0.5" />
                                  </span>
                                ) : isOtherStaffOrder ? (
                                  <div className="space-y-1">
                                    <span
                                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${statusBadge.bg} ${statusBadge.color} border ${statusBadge.border} shadow-2xs`}
                                      title="Created by another staff member (Read-only)"
                                    >
                                      <span className={`w-2 h-2 rounded-full ${statusBadge.dot}`} />
                                      <span>{statusBadge.label}</span>
                                      <Lock className="w-3 h-3 text-slate-400 ml-0.5" />
                                    </span>
                                    <div className="text-[10px] text-slate-400 font-medium">Read-only</div>
                                  </div>
                                ) : canEditOrder && (order.status === 'pending' || order.status === 'not_reachable') ? (
                                  <div className="space-y-1.5">
                                    <div className="relative inline-block">
                                      <select
                                        value={order.status}
                                        onChange={(e) => {
                                          const val = e.target.value as OrderStatus;
                                          if (val === 'confirmed') {
                                            handleConfirmOrder(order);
                                          } else {
                                            const note =
                                              val === 'delayed_delivery'
                                                ? 'Customer agreed to delayed delivery'
                                                : val === 'canceled'
                                                ? 'Customer refused delayed delivery (Stockout)'
                                                : undefined;
                                            handleStatusChange(order.id, val, note);
                                          }
                                        }}
                                        className="text-xs font-semibold pl-6 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer shadow-2xs"
                                      >
                                        <option value="pending">Pending</option>
                                        <option value="not_reachable">Not Reachable</option>
                                        <option value="confirmed">Confirm Order (In Stock)</option>
                                        <option value="delayed_delivery">Confirm Delayed Delivery</option>
                                        <option value="canceled">Refused Delay / Cancel</option>
                                      </select>
                                      <span
                                        className={`w-2 h-2 rounded-full absolute left-2.5 top-1/2 -translate-y-1/2 ${statusBadge.dot}`}
                                      />
                                    </div>

                                    {/* 1-Click Quick Action Buttons */}
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <button
                                        type="button"
                                        onClick={() => handleConfirmOrder(order)}
                                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-2xs cursor-pointer flex items-center gap-1"
                                        title="1-Click: Confirm order"
                                      >
                                        <CheckCircle2 className="w-3 h-3 text-white" />
                                        Confirm
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleStatusChange(order.id, 'not_reachable')}
                                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors shadow-2xs cursor-pointer flex items-center gap-1"
                                        title="1-Click: Customer not reachable"
                                      >
                                        <PhoneOff className="w-3 h-3 text-slate-500" />
                                        Not Reachable
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleStatusChange(
                                            order.id,
                                            'delayed_delivery',
                                            'Customer agreed to delayed delivery'
                                          )
                                        }
                                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition-colors shadow-2xs cursor-pointer flex items-center gap-1"
                                        title="1-Click: Customer agreed to wait for delayed delivery"
                                      >
                                        <Clock className="w-3 h-3 text-amber-600" />
                                        Delay Agreed
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleStatusChange(
                                            order.id,
                                            'canceled',
                                            'Customer refused delayed delivery (Stockout)'
                                          )
                                        }
                                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors shadow-2xs cursor-pointer flex items-center gap-1"
                                        title="1-Click: Customer refused delay due to stockout"
                                      >
                                        <XCircle className="w-3 h-3 text-rose-500" />
                                        Refused Delay
                                      </button>
                                    </div>
                                  </div>
                                ) : canEditOrder && order.status === 'delayed_delivery' ? (
                                  <div className="space-y-1.5">
                                    <span
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-300 shadow-2xs"
                                      title="Delayed delivery agreed. Order will automatically release to packing upon restock."
                                    >
                                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                      <span>Delayed Delivery</span>
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleConfirmOrder(order)}
                                        className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
                                      >
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                        Confirm
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (window.confirm('Cancel this delayed delivery order (Customer called to cancel)?')) {
                                            handleStatusChange(order.id, 'canceled', 'Customer canceled delayed delivery');
                                          }
                                        }}
                                        className="text-[10px] font-semibold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 cursor-pointer"
                                      >
                                        <XCircle className="w-3 h-3 text-rose-500" />
                                        Cancel Order
                                      </button>
                                    </div>
                                  </div>
                                ) : canEditOrder && order.status === 'confirmed' && !isManagedByCourier ? (
                                  <div className="space-y-1.5">
                                    <span
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200 shadow-2xs"
                                    >
                                      <span className={`w-2 h-2 rounded-full ${statusBadge.dot}`} />
                                      <span>Confirmed</span>
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (window.confirm('Revert this order back to Pending status?')) {
                                            handleStatusChange(order.id, 'pending', 'Reverted to pending by sales staff');
                                          }
                                        }}
                                        className="text-[10px] font-semibold text-slate-600 hover:text-slate-800 hover:underline flex items-center gap-1 cursor-pointer"
                                      >
                                        <RefreshCw className="w-3 h-3 text-slate-500" />
                                        Revert
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (window.confirm('Cancel this confirmed order (Customer called to cancel)?')) {
                                            handleStatusChange(order.id, 'canceled', 'Customer canceled confirmed order');
                                          }
                                        }}
                                        className="text-[10px] font-semibold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 cursor-pointer"
                                      >
                                        <XCircle className="w-3 h-3 text-rose-500" />
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200/80 shadow-2xs"
                                    title="Order locked for processing"
                                  >
                                    <span className={`w-2 h-2 rounded-full ${statusBadge.dot}`} />
                                    <span>{statusBadge.label}</span>
                                    <Lock className="w-3 h-3 text-slate-400 ml-0.5" />
                                  </span>
                                )}
                              </td>

                              <td className="p-4 text-right">
                                <div className="inline-flex items-center gap-1.5 justify-end">
                                  {isHandedOver ? (
                                    <button
                                      type="button"
                                      disabled
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-400 text-xs font-semibold border border-slate-200/80 cursor-not-allowed"
                                      title={`Customer details locked: Parcel #${order.order_number} has already been handed over to Steadfast Courier.`}
                                    >
                                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                                      <span className="hidden sm:inline">Locked</span>
                                    </button>
                                  ) : canEditCustomer ? (
                                    <button
                                      type="button"
                                      onClick={() => setEditingCustomerOrder(order)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-900 text-xs font-semibold border border-orange-200/80 transition-colors cursor-pointer shadow-2xs"
                                      title="Edit customer details (name, phone, address, notes)"
                                    >
                                      <Pencil className="w-3.5 h-3.5 text-orange-600" />
                                      <span className="hidden sm:inline">Customer</span>
                                    </button>
                                  ) : null}

                                  {canEditOrder ? (
                                    <button
                                      onClick={() => setEditingOrderForItems(order)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-900 border border-orange-200 text-xs font-semibold transition-colors cursor-pointer"
                                      title="Edit items & view history"
                                    >
                                      <PackageOpen className="w-3.5 h-3.5 text-orange-600" />
                                      <span>Items</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => setEditingOrderForItems(order)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                                      title="View items & order history (Read-only)"
                                    >
                                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                                      <span>View</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 3. Pagination Controls Bar */}
                <div className="bg-white border border-slate-200/80 rounded-2xl px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                    <span>
                      Showing <span className="font-bold text-slate-800">{(orderPage - 1) * orderPageSize + 1}</span> to{' '}
                      <span className="font-bold text-slate-800">
                        {Math.min(orderPage * orderPageSize, filteredOrders.length)}
                      </span>{' '}
                      of <span className="font-bold text-slate-800">{filteredOrders.length}</span> orders
                    </span>
                    <span className="text-slate-300">|</span>
                    <div className="flex items-center gap-1.5">
                      <span>Per page:</span>
                      <select
                        value={orderPageSize}
                        onChange={(e) => {
                          setOrderPageSize(Number(e.target.value));
                          setOrderPage(1);
                        }}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-orange-500"
                      >
                        <option value={15}>15</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setOrderPage((p) => Math.max(1, p - 1))}
                      disabled={orderPage === 1}
                      className="min-h-[38px] px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs active:scale-[0.98] motion-reduce:transition-none cursor-pointer"
                    >
                      Previous
                    </button>

                    <span className="text-xs font-bold text-slate-700 px-2 font-mono">
                      Page {orderPage} of {totalOrderPages}
                    </span>

                    <button
                      type="button"
                      onClick={() => setOrderPage((p) => Math.min(totalOrderPages, p + 1))}
                      disabled={orderPage >= totalOrderPages}
                      className="min-h-[38px] px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs active:scale-[0.98] motion-reduce:transition-none cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}{/* TAB 2: INVENTORY */}
        {activeTab === 'inventory' && (
          <div className="space-y-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search products in stock…"
                value={inventorySearch}
                onChange={(e) => setInventorySearch(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 shadow-2xs"
              />
            </div>

            {loadingInventory ? (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center shadow-xs">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mb-3" />
                <p className="text-slate-600 font-medium text-sm">Loading inventory…</p>
              </div>
            ) : filteredVariants.length === 0 ? (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center shadow-xs">
                <Boxes className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-900">No matching items</h3>
                <p className="text-xs text-slate-500 mt-1">No products or variants matched your search.</p>
              </div>
            ) : (
              <>
                {/* Mobile Cards View (< md) */}
                <div className="block md:hidden space-y-3">
                  {paginatedVariants.map((v) => (
                    <div
                      key={v.id}
                      className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-bold text-slate-900 text-sm truncate">
                            {(v.product as any)?.name || (v.product as any)?.title || 'Product'}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">Variant: {v.title}</p>
                          <span className="font-mono text-[11px] text-slate-400">SKU: {v.sku}</span>
                        </div>
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border shrink-0 ${
                            v.stock_quantity === 0
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : v.stock_quantity <= 5
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {v.stock_quantity} in stock
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                        <span className="text-slate-500 font-medium">Selling Price:</span>
                        <span className="font-mono font-bold text-orange-600 text-sm">
                          {formatCurrency(v.price)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View (>= md) */}
                <div className="hidden md:block bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-700">
                      <thead className="bg-slate-50/80 border-b border-slate-200/80 text-xs font-semibold text-slate-500">
                        <tr>
                          <th className="p-4">Product & Variant</th>
                          <th className="p-4">SKU</th>
                          <th className="p-4">Price</th>
                          <th className="p-4 text-right">Live Stock Available</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedVariants.map((v) => (
                          <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="p-4">
                              <div className="font-semibold text-slate-900 flex items-center gap-2">
                                <span>{(v.product as any)?.name || (v.product as any)?.title || 'Product'}</span>
                                {(v.product as any)?.is_active === false && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-300">
                                    Disabled
                                  </span>
                                )}
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
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Inventory Pagination Bar */}
                {filteredVariants.length > invPageSize && (
                  <div className="bg-white border border-slate-200/80 rounded-2xl px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                      <span>
                        Showing <span className="font-bold text-slate-800">{(invPage - 1) * invPageSize + 1}</span> to{' '}
                        <span className="font-bold text-slate-800">
                          {Math.min(invPage * invPageSize, filteredVariants.length)}
                        </span>{' '}
                        of <span className="font-bold text-slate-800">{filteredVariants.length}</span> items
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setInvPage((p) => Math.max(1, p - 1))}
                        disabled={invPage === 1}
                        className="min-h-[38px] px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs active:scale-[0.98] motion-reduce:transition-none cursor-pointer"
                      >
                        Previous
                      </button>

                      <span className="text-xs font-bold text-slate-700 px-2 font-mono">
                        Page {invPage} of {totalInvPages}
                      </span>

                      <button
                        type="button"
                        onClick={() => setInvPage((p) => Math.min(totalInvPages, p + 1))}
                        disabled={invPage >= totalInvPages}
                        className="min-h-[38px] px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs active:scale-[0.98] motion-reduce:transition-none cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* TAB 3: COMMISSIONS & REWARDS */}
        {activeTab === 'rewards' && (
          <div className="space-y-6">
            {/* Real-time Today's Bonus Progress Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: Non-Website Sales Milestones */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center">
                      <ShoppingBag className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">
                        Non-Website Sales Milestones
                      </h4>
                      <p className="text-[11px] text-slate-400">Phone, WhatsApp, Messenger & Manual Orders</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    Resets 12 AM
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 ">
                      Today's Sales
                    </span>
                    <div className="text-xl font-extrabold text-slate-900 font-mono mt-0.5">
                      {formatCurrency(todayOtherSales)}
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 ">
                      Extra Commission Tiered
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
                        ? `Next Milestone: ${nextOtherTier.name} (+${formatCurrency(nextOtherTier.bonus)} extra commission)`
                        : 'Top Milestone 5 Reached (৳2,000)'}
                    </span>
                    <span className="font-mono font-bold text-slate-700">
                      {nextOtherTier
                        ? `৳${Math.max(0, nextOtherTier.min_quota - todayOtherSales).toLocaleString()} away`
                        : 'Max Achieved'}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-colors duration-500"
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
                        title={`Target: ৳${tier.min_quota.toLocaleString()} -> Extra Commission: ৳${tier.bonus.toLocaleString()}`}
                      >
                        ৳{tier.min_quota / 1000}k : +৳{tier.bonus}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Card 2: Website Sales Milestones */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center">
                      <WebsiteFlatIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">
                        Website Sales Milestones
                      </h4>
                      <p className="text-[11px] text-slate-400">Upsell Extra Sales on Website Orders</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Resets 12 AM
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 ">
                      Extra Sales Today
                    </span>
                    <div className="text-xl font-extrabold text-slate-900 font-mono mt-0.5">
                      {formatCurrency(todayWebsiteUpsells)}
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 ">
                      Extra Commission Tiered
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
                        ? `Next Milestone: ${nextWebsiteTier.name} (+${formatCurrency(nextWebsiteTier.bonus)} extra commission)`
                        : 'Highest Milestone Tiered'}
                    </span>
                    <span className="font-mono font-bold text-slate-700">
                      {nextWebsiteTier
                        ? `৳${Math.max(0, nextWebsiteTier.min_quota - todayWebsiteUpsells).toLocaleString()} away`
                        : 'Max Achieved'}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-colors duration-500"
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
                        title={`Target: ৳${tier.min_quota.toLocaleString()} -> Extra Commission: ৳${tier.bonus.toLocaleString()}`}
                      >
                        ৳{tier.min_quota / 1000}k : +৳{tier.bonus}
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
                    <span>Sales Milestones & Extra Commission History</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Itemized record of non-website sales milestones and website upsell extra commissions earned
                  </p>
                </div>
                <button
                  onClick={() => {
                    setTiersModalTab('other');
                    setShowTiersModal(true);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  View All Milestones
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50/80 border-b border-slate-200/80 text-xs font-semibold text-slate-500 ">
                    <tr>
                      <th className="p-4">Type & Order / Milestone</th>
                      <th className="p-4">Extra Commission</th>
                      <th className="p-4">Earned Date</th>
                      <th className="p-4 text-right">Payout Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingRewards ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-slate-400">
                          Loading rewards…
                        </td>
                      </tr>
                    ) : rewards.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-slate-400">
                          No milestone rewards earned yet. Reach daily sales targets or upsell products to earn extra commission!
                        </td>
                      </tr>
                    ) : (
                      rewards.map((reward) => {
                        const noteLower = (reward.note || '').toLowerCase();
                        const isNonWebsiteMilestone =
                          noteLower.includes('non-website') || noteLower.includes('daily sales');
                        return (
                          <tr key={reward.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-slate-900">
                                  {(reward.order as any)?.order_number || (isNonWebsiteMilestone ? 'Sales Milestone' : 'Website Order')}
                                </span>
                                {isNonWebsiteMilestone ? (
                                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 font-bold text-[10px]">
                                    Non-Website Milestone
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200 font-bold text-[10px]">
                                    Website Milestone
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
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs shadow-xs transition-colors"
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>New Payout Request</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50/80 border-b border-slate-200/80 text-xs font-semibold text-slate-500 ">
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
                        Loading payout requests…
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
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50  animate-in fade-in p-2.5 sm:p-4">
          <div className="min-h-full flex items-center justify-center py-4 sm:py-8">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative my-auto">
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-orange-600" />
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
                  <span className="font-bold font-mono text-orange-600 text-base">
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payment Method *
                  </label>
                  <select
                    value={payoutMethod}
                    onChange={(e) => setPayoutMethod(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
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
                    className="w-full sm:w-auto px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm shadow-xs transition-colors disabled:opacity-50 text-center"
                  >
                    {submittingPayout ? 'Submitting…' : 'Submit Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* CREATE ORDER MODAL with Apple Minimization & Sheet Spring Animation */}
      {isModalOpen && (
        <div
          className={`fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-2.5 sm:p-4 flex items-center justify-center ${
            isModalClosing ? 'animate-apple-backdrop-out pointer-events-none' : 'animate-apple-backdrop-in'
          }`}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseModal();
          }}
        >
          <div className="min-h-full w-full flex items-center justify-center py-4 sm:py-8">
            <div
              className={`bg-white border border-slate-200/90 rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl relative my-auto ${
                isModalClosing ? 'animate-apple-sheet-close' : 'animate-apple-sheet-open'
              }`}
            >
              {/* iOS Sheet Drag Handle (Mobile only) */}
              <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mt-2.5 mb-1 md:hidden" />

              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
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
                  onClick={handleCloseModal}
                  className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/70 transition-transform active:scale-90 motion-reduce:transition-none cursor-pointer"
                  title="Close (Minimize)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitOrder} className="p-4 sm:p-6 max-h-[75vh] overflow-y-auto">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  {/* LEFT 2 COLUMNS: CUSTOMER & PRODUCTS */}
                  <div className="lg:col-span-2 space-y-4">
                    {/* ORDER SOURCE */}
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-2">
                        Order Source
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                        <button
                          type="button"
                          onClick={() => setSource('whatsapp')}
                          className={`flex items-center sm:flex-col justify-center gap-2 sm:gap-1 p-2 sm:p-2.5 rounded-xl border transition-colors ${
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
                          className={`flex items-center sm:flex-col justify-center gap-2 sm:gap-1 p-2 sm:p-2.5 rounded-xl border transition-colors ${
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
                          className={`flex items-center sm:flex-col justify-center gap-2 sm:gap-1 p-2 sm:p-2.5 rounded-xl border transition-colors ${
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
                          className={`flex items-center sm:flex-col justify-center gap-2 sm:gap-1 p-2 sm:p-2.5 rounded-xl border transition-colors ${
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
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
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
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
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
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 resize-none"
                      />
                    </div>

                    {/* ADD PRODUCTS TO ORDER */}
                    <div className="p-3.5 sm:p-4 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-700">
                          Add Products to Order
                        </span>
                        <span className="text-xs font-medium text-emerald-700">
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
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-orange-500"
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
                                <span className="text-orange-600 font-mono font-bold">x{item.quantity}</span>
                                {item.is_delayed_preorder && (
                                  <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[9px] flex items-center gap-1">
                                    Pre-Order
                                  </span>
                                )}
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
                        </div>
                      ) : (
                        <p className="text-center text-xs text-slate-400 italic pt-1">
                          No items added yet. Pick an item above to add to order.
                        </p>
                      )}
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
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
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
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
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
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                      />
                    </div>
                  </div>

                  {/* RIGHT 1 COLUMN: ORDER SUMMARY TO THE SIDE */}
                  <div className="lg:col-span-1 space-y-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4 shadow-xs sticky top-0">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                            <Receipt className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-slate-900">Order Summary</h4>
                            <p className="text-[10px] text-slate-400">Total & Payment Breakdown</p>
                          </div>
                        </div>
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700">
                          {orderItems.length} items
                        </span>
                      </div>

                      {/* Items Subtotal */}
                      <div className="flex justify-between items-center text-xs text-slate-600">
                        <span>Items Subtotal:</span>
                        <span className="font-mono font-bold text-slate-900">
                          {formatCurrency(itemsSubtotal)}
                        </span>
                      </div>

                      {/* Delivery Option Selection */}
                      <div className="pt-2 border-t border-slate-200/70 space-y-1.5">
                        <label className="text-xs font-medium text-slate-700 flex items-center gap-1">
                          <Truck className="w-3.5 h-3.5 text-slate-400" />
                          <span>Delivery Fee:</span>
                        </label>
                        <div className="grid grid-cols-3 gap-1">
                          <button
                            type="button"
                            onClick={() => setDeliveryType('inside_dhaka')}
                            className={`p-2 rounded-xl border text-center transition-colors cursor-pointer ${
                              deliveryType === 'inside_dhaka'
                                ? 'border-orange-600 bg-orange-50 text-orange-950 ring-1 ring-orange-500 font-bold shadow-2xs'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <div className="text-[10px] text-slate-500">Dhaka</div>
                            <div className="text-xs font-mono font-black">৳80</div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeliveryType('outside_dhaka')}
                            className={`p-2 rounded-xl border text-center transition-colors cursor-pointer ${
                              deliveryType === 'outside_dhaka'
                                ? 'border-orange-600 bg-orange-50 text-orange-950 ring-1 ring-orange-500 font-bold shadow-2xs'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <div className="text-[10px] text-slate-500">Outside</div>
                            <div className="text-xs font-mono font-black">৳130</div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeliveryType('free')}
                            className={`p-2 rounded-xl border text-center transition-colors cursor-pointer ${
                              deliveryType === 'free'
                                ? 'border-orange-600 bg-orange-600 text-white font-bold shadow-2xs'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <div className={`text-[10px] ${deliveryType === 'free' ? 'text-emerald-100' : 'text-slate-500'}`}>Offer</div>
                            <div className="text-xs font-mono font-black">Free</div>
                          </button>
                        </div>
                      </div>

                      {/* Custom Discount Input Box */}
                      <div className="pt-2 border-t border-slate-200/70 space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-slate-700 flex items-center gap-1">
                            <Tag className="w-3.5 h-3.5 text-rose-500" />
                            <span>Custom Discount:</span>
                          </label>
                          {discountAmount > 0 && (
                            <span className="font-mono font-bold text-rose-600 text-[11px]">
                              -{formatCurrency(discountAmount)}
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                            ৳
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="0"
                            value={customDiscount}
                            onChange={(e) => setCustomDiscount(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl pl-6 pr-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                          />
                        </div>
                      </div>

                      {/* Customer Advance / Pre-payment Box */}
                      <div className="pt-2 border-t border-slate-200/70 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-slate-700 flex items-center gap-1">
                            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Advance Paid</span>
                          </label>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={hasAdvancePayment}
                              onChange={(e) => {
                                setHasAdvancePayment(e.target.checked);
                                if (!e.target.checked) {
                                  setAdvancePayment('');
                                  setAdvanceTrxId('');
                                }
                              }}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-colors peer-checked:bg-orange-600"></div>
                          </label>
                        </div>

                        {hasAdvancePayment && (
                          <div className="space-y-2 pt-1">
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                                ৳
                              </span>
                              <input
                                type="number"
                                min="1"
                                step="any"
                                required={hasAdvancePayment}
                                placeholder="Amount (e.g. 200)"
                                value={advancePayment}
                                onChange={(e) => setAdvancePayment(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl pl-6 pr-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-1.5">
                              <select
                                value={advanceMethod}
                                onChange={(e) => setAdvanceMethod(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-[11px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                              >
                                <option value="bKash">bKash</option>
                                <option value="Nagad">Nagad</option>
                                <option value="Rocket">Rocket</option>
                                <option value="Bank Transfer">Bank</option>
                              </select>
                              <input
                                type="text"
                                placeholder="TrxID (Opt)"
                                value={advanceTrxId}
                                onChange={(e) => setAdvanceTrxId(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-[11px] font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Grand Total */}
                      <div className="pt-3 border-t-2 border-slate-200">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold text-slate-900">Grand Total:</span>
                          <span className="font-mono text-base font-black text-slate-900">
                            {formatCurrency(grandTotal)}
                          </span>
                        </div>
                      </div>

                      {/* Remaining COD Box */}
                      <div
                        className={`p-3 rounded-xl border flex flex-col gap-1 transition-colors ${
                          advanceAmount > 0
                            ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                            : 'bg-slate-100 border-slate-200 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium">Remaining COD:</span>
                          <span className="font-mono text-sm font-black">
                            {formatCurrency(remainingCod)}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-tight">
                          {remainingCod === 0
                            ? 'Fully prepaid. 0 COD collection.'
                            : 'To collect from customer via Courier.'}
                        </p>
                      </div>

                      {/* Delayed Delivery Pre-Order Notice */}
                      {hasDelayedPreOrderItems && (
                        <div className="p-3 rounded-xl border border-amber-300 bg-amber-50/90 text-amber-900 text-xs flex items-start gap-2.5">
                          <span className="text-base leading-none">•</span>
                          <div className="space-y-0.5">
                            <p className="font-bold text-[11px]">Delayed Delivery Pre-Order</p>
                            <p className="text-[10px] text-amber-800 leading-normal">
                              This order contains out-of-stock items and will be queued under <strong>Delayed Delivery</strong>. It will automatically release to Packing once stock is replenished!
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Submit Actions */}
                      <div className="pt-2 space-y-2">
                        <button
                          type="submit"
                          disabled={submittingOrder || orderItems.length === 0}
                          className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs shadow-xs transition-colors disabled:opacity-50 text-center flex items-center justify-center gap-1.5 ${
                            hasDelayedPreOrderItems
                              ? 'bg-amber-600 hover:bg-amber-500 text-white'
                              : 'bg-orange-600 hover:bg-orange-500 text-white'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>
                            {submittingOrder
                              ? 'Placing Order…'
                              : hasDelayedPreOrderItems
                              ? 'Confirm & Create Delayed Pre-Order 🕒'
                              : 'Confirm & Create Order'}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={handleCloseModal}
                          className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold transition-transform active:scale-[0.98] motion-reduce:transition-none text-center cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
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
          currentProfile={currentProfile}
          onClose={() => setEditingOrderForItems(null)}
          onUpdated={() => {
            setEditingOrderForItems(null);
            fetchOrders();
            fetchRewards();
          }}
        />
      )}

      {/* EDIT CUSTOMER DETAILS MODAL */}
      {editingCustomerOrder && (
        <EditCustomerDetailsModal
          order={editingCustomerOrder}
          isOpen={true}
          currentProfile={currentProfile}
          onClose={() => setEditingCustomerOrder(null)}
          onUpdated={(updatedOrder) => {
            setEditingCustomerOrder(null);
            setOrders((prev) =>
              prev.map((o) => (o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o))
            );
            fetchOrders();
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40  animate-in fade-in">
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
                      ? 'Non-Website Sales Milestones'
                      : 'Website Sales Milestones'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {tiersModalTab === 'other'
                      ? 'Daily sales extra commission milestones (Phone, WhatsApp, Manual - resets daily at 12 AM)'
                      : 'Upsell extra sales commission milestones on website orders (resets daily at 12 AM)'}
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
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-colors text-center cursor-pointer ${
                  tiersModalTab === 'other'
                    ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Non-Website Sales Milestones
              </button>
              <button
                type="button"
                onClick={() => setTiersModalTab('website')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-colors text-center cursor-pointer ${
                  tiersModalTab === 'website'
                    ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Website Sales Milestones
              </button>
            </div>

            <div className="p-5">
              {tiersModalTab === 'other' ? (
                <>
                  <div className="mb-4 bg-amber-50/60 border border-amber-200/60 rounded-xl p-3.5 flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-950">
                      <span className="font-bold">How it works:</span> Cumulative sales on non-website orders (WhatsApp, Phone, Manual) qualify for daily milestones. Crossing each milestone activates that tier's cash extra commission into your earnings.
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                    <table className="w-full text-left text-sm text-slate-700">
                      <thead className="bg-slate-50 border-b border-slate-200/80 text-xs font-semibold text-slate-500 ">
                        <tr>
                          <th className="p-3">Milestone Tier</th>
                          <th className="p-3">Daily Sales Required</th>
                          <th className="p-3">Extra Commission</th>
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
                            const isTiered = todayOtherSales >= tier.min_quota;
                            const isCurrentHighest = unlockedOtherTier?.id === tier.id;
                            const effectiveRate = tier.min_quota > 0 ? ((tier.bonus / tier.min_quota) * 100).toFixed(1) : '0';
                            const deficit = tier.min_quota - todayOtherSales;

                            return (
                              <tr
                                key={tier.id}
                                className={`transition-colors ${
                                  isCurrentHighest
                                    ? 'bg-amber-50/60 font-semibold'
                                    : isTiered
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
                                  {isTiered ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Tiered
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
                      <span className="font-bold">How it works:</span> When you upsell on website orders, your extra sales value accumulates across all website orders today. Crossing each quota milestone activates that tier's cash bonus in your earnings.
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                    <table className="w-full text-left text-sm text-slate-700">
                      <thead className="bg-slate-50 border-b border-slate-200/80 text-xs font-semibold text-slate-500 ">
                        <tr>
                          <th className="p-3">Milestone Tier</th>
                          <th className="p-3">Extra Sales Required</th>
                          <th className="p-3">Extra Commission</th>
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
                            const isTiered = todayWebsiteUpsells >= tier.min_quota;
                            const isCurrentHighest = unlockedWebsiteTier?.id === tier.id;
                            const effectiveRate = tier.min_quota > 0 ? ((tier.bonus / tier.min_quota) * 100).toFixed(1) : '0';
                            const deficit = tier.min_quota - todayWebsiteUpsells;

                            return (
                              <tr
                                key={tier.id}
                                className={`transition-colors ${
                                  isCurrentHighest
                                    ? 'bg-emerald-50/50 font-semibold'
                                    : isTiered
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
                                  {isTiered ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Tiered
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
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
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
