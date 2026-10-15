'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/Navbar';
import MetaDateRangePicker, {
  MetaDateRangeValue,
} from '@/components/MetaDateRangePicker';
import {
  Order,
  Profile,
  OrderStatus,
  OrderSource,
} from '@/types/database';
import {
  getDhakaDateString,
  getDhakaStartOfDayIso,
  getDhakaEndOfDayIso,
  getMetaPresetDateRange,
  getAllDhakaDatesInRange,
  formatDhakaDisplayDate,
  formatDhakaWeekdayDate,
  formatDhakaShortDate,
  getTimeUntilDhakaMidnight,
  diffDhakaDays,
  DhakaCountdownInfo,
} from '@/lib/dateUtils';
import { formatCurrency } from '@/lib/utils';
import {
  WhatsAppFlatIcon,
  MessengerFlatIcon,
  PhoneCallFlatIcon,
  WalkInFlatIcon,
  WebsiteFlatIcon,
} from '@/components/SourceIcons';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Truck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  Download,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Layers,
  BarChart2,
  Check,
  Sparkles,
  Info,
  ChevronRight,
  Moon,
} from 'lucide-react';

export default function AdminAnalyticsPage() {
  const router = useRouter();
  const supabase = createClient();

  // Auth & Profile
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Midnight Rollover & Dhaka Live Clock
  const [dhakaCountdown, setDhakaCountdown] = useState<DhakaCountdownInfo>(() =>
    getTimeUntilDhakaMidnight()
  );
  const [dhakaClockString, setDhakaClockString] = useState<string>('');
  const [midnightNotification, setMidnightNotification] = useState<string | null>(null);

  // Date Range Filter State (defaults to 'last_7_days' with comparison enabled)
  const [dateRange, setDateRange] = useState<MetaDateRangeValue>(() => {
    const defaultRange = getMetaPresetDateRange('last_7_days', new Date(), true);
    return {
      preset: defaultRange.preset,
      startDate: defaultRange.startDate,
      endDate: defaultRange.endDate,
      compare: true,
      compareStartDate: defaultRange.compareStartDate,
      compareEndDate: defaultRange.compareEndDate,
    };
  });
  const [dateRangeLabel, setDateRangeLabel] = useState<string>('Last 7 days');

  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [chartMetric, setChartMetric] = useState<'revenue' | 'orders'>('revenue');
  const [hoveredDayData, setHoveredDayData] = useState<{
    date: string;
    revenue: number;
    ordersCount: number;
    shippedCount: number;
    deliveredCount: number;
    compRevenue?: number;
    compOrdersCount?: number;
  } | null>(null);

  // Ledger Table Search & Sort
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerSortBy, setLedgerSortBy] = useState<'date' | 'revenue' | 'orders'>('date');
  const [ledgerSortDir, setLedgerSortDir] = useState<'asc' | 'desc'>('desc');

  // Load Current Profile & Validate Admin Role
  useEffect(() => {
    let isMounted = true;
    async function loadAdminUser() {
      setAuthLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!isMounted) return;

      if (error || !profile) {
        router.push('/login');
        return;
      }

      if (profile.role !== 'admin') {
        router.push('/sales');
        return;
      }

      setCurrentProfile(profile);
      setAuthLoading(false);
    }

    loadAdminUser();
    return () => {
      isMounted = false;
    };
  }, [router, supabase]);

  // Dhaka Live Clock & 12:00 AM Midnight Rollover Timer
  useEffect(() => {
    const updateClock = () => {
      const info = getTimeUntilDhakaMidnight();
      setDhakaCountdown(info);

      // Current Dhaka Time string
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Dhaka',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
      setDhakaClockString(timeStr);
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);

    return () => clearInterval(interval);
  }, []);

  // Precise 12:00 AM Midnight Rollover Listener
  useEffect(() => {
    const remainingMs = getTimeUntilDhakaMidnight().remainingMs;
    // Set a timer for exact midnight + 500ms
    const timer = setTimeout(() => {
      const newDhakaDate = getDhakaDateString();
      setMidnightNotification(
        `🌙 Dhaka Midnight Rollover! The day has ended at 12:00 AM. Daily analytics refreshed for ${formatDhakaDisplayDate(newDhakaDate)}.`
      );

      // Auto-update relative presets if active
      if (dateRange.preset !== 'custom' && dateRange.preset !== 'maximum') {
        const updated = getMetaPresetDateRange(
          dateRange.preset,
          new Date(),
          dateRange.compare
        );
        setDateRange({
          preset: updated.preset,
          startDate: updated.startDate,
          endDate: updated.endDate,
          compare: dateRange.compare,
          compareStartDate: updated.compareStartDate,
          compareEndDate: updated.compareEndDate,
        });
        setDateRangeLabel(updated.label);
      }

      // Re-fetch orders for the new day
      fetchOrdersData();

      // Dismiss notification after 8 seconds
      setTimeout(() => {
        setMidnightNotification(null);
      }, 8000);
    }, remainingMs + 500);

    return () => clearTimeout(timer);
  }, [dateRange.preset, dateRange.compare]);

  // Fetch Orders for Active Range & Comparison Window
  const fetchOrdersData = async () => {
    setLoadingOrders(true);

    // Determine query boundaries
    let queryStartStr = dateRange.startDate;
    if (dateRange.compare && dateRange.compareStartDate) {
      if (dateRange.compareStartDate < queryStartStr) {
        queryStartStr = dateRange.compareStartDate;
      }
    }

    const startIso = getDhakaStartOfDayIso(queryStartStr);
    const endIso = getDhakaEndOfDayIso(dateRange.endDate);

    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*), sales_rep:profiles(*)')
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching analytics orders:', error);
      } else if (data) {
        setOrders(data as Order[]);
      }
    } catch (err) {
      console.error('Failed to query orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  // Re-fetch when dateRange changes
  useEffect(() => {
    fetchOrdersData();
  }, [
    dateRange.startDate,
    dateRange.endDate,
    dateRange.compare,
    dateRange.compareStartDate,
    dateRange.compareEndDate,
  ]);

  // Realtime Supabase Subscription on Orders
  useEffect(() => {
    const channel = supabase
      .channel('analytics-orders-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          // Re-fetch silently when orders change
          fetchOrdersData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dateRange.startDate, dateRange.endDate]);

  // Handle Date Filter Change from MetaDateRangePicker
  const handleDateRangeChange = (
    newVal: MetaDateRangeValue & { label: string }
  ) => {
    setDateRange({
      preset: newVal.preset,
      startDate: newVal.startDate,
      endDate: newVal.endDate,
      compare: newVal.compare,
      compareStartDate: newVal.compareStartDate,
      compareEndDate: newVal.compareEndDate,
    });
    setDateRangeLabel(newVal.label);
  };

  // Separate Orders into Primary vs Comparison Periods
  const { currentOrders, comparisonOrders } = useMemo(() => {
    const curr: Order[] = [];
    const comp: Order[] = [];

    const start = dateRange.startDate;
    const end = dateRange.endDate;
    const cStart = dateRange.compareStartDate;
    const cEnd = dateRange.compareEndDate;

    orders.forEach((o) => {
      const d = getDhakaDateString(o.created_at);
      if (d >= start && d <= end) {
        curr.push(o);
      }
      if (dateRange.compare && cStart && cEnd && d >= cStart && d <= cEnd) {
        comp.push(o);
      }
    });

    return { currentOrders: curr, comparisonOrders: comp };
  }, [orders, dateRange]);

  // Aggregated Primary & Comparison Metrics
  const metrics = useMemo(() => {
    // Current Period Aggregations
    let totalRevenue = 0;
    let nonCanceledCount = 0;
    let confirmedCount = 0;
    let delayedCount = 0;
    let pendingCount = 0;
    let shippedCount = 0;
    let deliveredCount = 0;
    let canceledCount = 0;
    let advanceCollected = 0;
    let deliveryCharges = 0;
    let discountsGiven = 0;

    currentOrders.forEach((o) => {
      const amount = Number(o.total_amount) || 0;
      if (o.status !== 'canceled') {
        totalRevenue += amount;
        nonCanceledCount += 1;
      }

      if (
        o.status === 'confirmed' ||
        o.status === 'ready_to_ship' ||
        o.status === 'on_the_way' ||
        o.status === 'shipped' ||
        o.status === 'delivered'
      ) {
        confirmedCount += 1;
      }
      if (o.status === 'delayed_delivery') delayedCount += 1;
      if (o.status === 'pending' || o.status === 'not_reachable') pendingCount += 1;
      if (o.status === 'shipped' || o.status === 'delivered') shippedCount += 1;
      if (o.status === 'delivered') deliveredCount += 1;
      if (o.status === 'canceled') canceledCount += 1;

      advanceCollected += Number(o.advance_payment) || 0;
      deliveryCharges += Number(o.delivery_charge) || 0;
      discountsGiven += Number(o.discount_amount) || 0;
    });

    const totalOrdersCount = currentOrders.length;
    const aov = nonCanceledCount > 0 ? totalRevenue / nonCanceledCount : 0;
    const fulfillmentRate =
      totalOrdersCount > 0 ? (shippedCount / totalOrdersCount) * 100 : 0;
    const deliverySuccessRate =
      deliveredCount + canceledCount > 0
        ? (deliveredCount / (deliveredCount + canceledCount)) * 100
        : deliveredCount > 0
        ? 100
        : 0;

    // Comparison Period Aggregations
    let compRevenue = 0;
    let compNonCanceledCount = 0;
    let compShippedCount = 0;
    let compDeliveredCount = 0;
    let compCanceledCount = 0;

    comparisonOrders.forEach((o) => {
      const amount = Number(o.total_amount) || 0;
      if (o.status !== 'canceled') {
        compRevenue += amount;
        compNonCanceledCount += 1;
      }
      if (o.status === 'shipped' || o.status === 'delivered') compShippedCount += 1;
      if (o.status === 'delivered') compDeliveredCount += 1;
      if (o.status === 'canceled') compCanceledCount += 1;
    });

    const compTotalOrders = comparisonOrders.length;
    const compAov =
      compNonCanceledCount > 0 ? compRevenue / compNonCanceledCount : 0;

    // Delta percentages
    const calcDelta = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return ((curr - prev) / prev) * 100;
    };

    const revenueDelta = calcDelta(totalRevenue, compRevenue);
    const ordersDelta = calcDelta(totalOrdersCount, compTotalOrders);
    const shippedDelta = calcDelta(shippedCount, compShippedCount);
    const aovDelta = calcDelta(aov, compAov);

    return {
      totalRevenue,
      totalOrdersCount,
      nonCanceledCount,
      confirmedCount,
      delayedCount,
      pendingCount,
      shippedCount,
      deliveredCount,
      canceledCount,
      advanceCollected,
      deliveryCharges,
      discountsGiven,
      aov,
      fulfillmentRate,
      deliverySuccessRate,
      compRevenue,
      compTotalOrders,
      compShippedCount,
      revenueDelta,
      ordersDelta,
      shippedDelta,
      aovDelta,
    };
  }, [currentOrders, comparisonOrders]);

  // Channel Breakdown
  const channelBreakdown = useMemo(() => {
    const channels: Record<
      OrderSource,
      {
        count: number;
        revenue: number;
        label: string;
        icon: React.ComponentType<{ className?: string }>;
      }
    > = {
      website: { count: 0, revenue: 0, label: 'Website Store', icon: WebsiteFlatIcon },
      messenger: { count: 0, revenue: 0, label: 'Facebook Messenger', icon: MessengerFlatIcon },
      whatsapp: { count: 0, revenue: 0, label: 'WhatsApp Chat', icon: WhatsAppFlatIcon },
      phone: { count: 0, revenue: 0, label: 'Direct Phone', icon: PhoneCallFlatIcon },
      manual: { count: 0, revenue: 0, label: 'Walk-in / Manual', icon: WalkInFlatIcon },
    };

    currentOrders.forEach((o) => {
      const src = (o.source in channels ? o.source : 'website') as OrderSource;
      channels[src].count += 1;
      if (o.status !== 'canceled') {
        channels[src].revenue += Number(o.total_amount) || 0;
      }
    });

    return Object.entries(channels).map(([key, data]) => ({
      key,
      ...data,
      percent:
        metrics.totalOrdersCount > 0
          ? (data.count / metrics.totalOrdersCount) * 100
          : 0,
      revenuePercent:
        metrics.totalRevenue > 0
          ? (data.revenue / metrics.totalRevenue) * 100
          : 0,
    }));
  }, [currentOrders, metrics.totalOrdersCount, metrics.totalRevenue]);

  // Daily Chart Series Data
  const dailyChartData = useMemo(() => {
    const allDates = getAllDhakaDatesInRange(dateRange.startDate, dateRange.endDate);

    // Map current period by Dhaka date
    const currentByDate: Record<
      string,
      {
        revenue: number;
        ordersCount: number;
        shippedCount: number;
        deliveredCount: number;
      }
    > = {};

    allDates.forEach((d) => {
      currentByDate[d] = {
        revenue: 0,
        ordersCount: 0,
        shippedCount: 0,
        deliveredCount: 0,
      };
    });

    currentOrders.forEach((o) => {
      const d = getDhakaDateString(o.created_at);
      if (currentByDate[d]) {
        currentByDate[d].ordersCount += 1;
        if (o.status !== 'canceled') {
          currentByDate[d].revenue += Number(o.total_amount) || 0;
        }
        if (o.status === 'shipped' || o.status === 'delivered') {
          currentByDate[d].shippedCount += 1;
        }
        if (o.status === 'delivered') {
          currentByDate[d].deliveredCount += 1;
        }
      }
    });

    // Map comparison period by offset index
    let compByDate: Record<string, { revenue: number; ordersCount: number }> = {};
    if (dateRange.compare && dateRange.compareStartDate && dateRange.compareEndDate) {
      const compDates = getAllDhakaDatesInRange(
        dateRange.compareStartDate,
        dateRange.compareEndDate
      );
      compDates.forEach((cd) => {
        compByDate[cd] = { revenue: 0, ordersCount: 0 };
      });
      comparisonOrders.forEach((o) => {
        const cd = getDhakaDateString(o.created_at);
        if (compByDate[cd]) {
          compByDate[cd].ordersCount += 1;
          if (o.status !== 'canceled') {
            compByDate[cd].revenue += Number(o.total_amount) || 0;
          }
        }
      });
    }

    const compDatesList =
      dateRange.compare && dateRange.compareStartDate && dateRange.compareEndDate
        ? getAllDhakaDatesInRange(dateRange.compareStartDate, dateRange.compareEndDate)
        : [];

    return allDates.map((dateStr, index) => {
      const compDateStr = compDatesList[index];
      const compData = compDateStr ? compByDate[compDateStr] : undefined;

      return {
        date: dateStr,
        displayDate: formatDhakaShortDate(dateStr),
        fullDate: formatDhakaWeekdayDate(dateStr),
        revenue: currentByDate[dateStr]?.revenue || 0,
        ordersCount: currentByDate[dateStr]?.ordersCount || 0,
        shippedCount: currentByDate[dateStr]?.shippedCount || 0,
        deliveredCount: currentByDate[dateStr]?.deliveredCount || 0,
        compRevenue: compData?.revenue || 0,
        compOrdersCount: compData?.ordersCount || 0,
        compDate: compDateStr ? formatDhakaShortDate(compDateStr) : undefined,
      };
    });
  }, [dateRange, currentOrders, comparisonOrders]);

  // Max value for chart scaling
  const chartMax = useMemo(() => {
    let max = 0;
    dailyChartData.forEach((d) => {
      const val = chartMetric === 'revenue' ? d.revenue : d.ordersCount;
      const compVal =
        chartMetric === 'revenue' ? d.compRevenue || 0 : d.compOrdersCount || 0;
      if (val > max) max = val;
      if (dateRange.compare && compVal > max) max = compVal;
    });
    return max > 0 ? max * 1.15 : 10;
  }, [dailyChartData, chartMetric, dateRange.compare]);

  // Daily Ledger Rows
  const dailyLedgerRows = useMemo(() => {
    const rows = dailyChartData.map((d) => {
      // Find orders matching this date
      const daysOrders = currentOrders.filter(
        (o) => getDhakaDateString(o.created_at) === d.date
      );
      const confirmed = daysOrders.filter(
        (o) =>
          o.status === 'confirmed' ||
          o.status === 'ready_to_ship' ||
          o.status === 'on_the_way' ||
          o.status === 'shipped' ||
          o.status === 'delivered'
      ).length;
      const delayed = daysOrders.filter((o) => o.status === 'delayed_delivery').length;
      const canceled = daysOrders.filter((o) => o.status === 'canceled').length;
      const aov =
        daysOrders.length - canceled > 0
          ? d.revenue / (daysOrders.length - canceled)
          : 0;
      const fulfillment =
        daysOrders.length > 0 ? (d.shippedCount / daysOrders.length) * 100 : 0;

      return {
        date: d.date,
        fullDate: d.fullDate,
        totalOrders: d.ordersCount,
        confirmed,
        shipped: d.shippedCount,
        delivered: d.deliveredCount,
        delayed,
        canceled,
        revenue: d.revenue,
        aov,
        fulfillmentRate: fulfillment,
      };
    });

    // Filter by search query
    let filtered = rows;
    if (ledgerSearch.trim()) {
      const q = ledgerSearch.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.date.includes(q) ||
          r.fullDate.toLowerCase().includes(q) ||
          String(r.revenue).includes(q)
      );
    }

    // Sort rows
    return filtered.sort((a, b) => {
      let cmp = 0;
      if (ledgerSortBy === 'date') cmp = a.date.localeCompare(b.date);
      else if (ledgerSortBy === 'revenue') cmp = a.revenue - b.revenue;
      else if (ledgerSortBy === 'orders') cmp = a.totalOrders - b.totalOrders;

      return ledgerSortDir === 'desc' ? -cmp : cmp;
    });
  }, [dailyChartData, currentOrders, ledgerSearch, ledgerSortBy, ledgerSortDir]);

  // Export Daily Ledger to CSV
  const handleExportCsv = () => {
    const headers = [
      'Date (Dhaka)',
      'Total Orders',
      'Confirmed Orders',
      'Shipped Orders',
      'Delivered Orders',
      'Delayed Delivery',
      'Canceled Orders',
      'Fulfillment Rate (%)',
      'Gross Revenue (BDT)',
      'Average Order Value (BDT)',
    ];

    const rows = dailyLedgerRows.map((r) => [
      `"${r.fullDate}"`,
      r.totalOrders,
      r.confirmed,
      r.shipped,
      r.delivered,
      r.delayed,
      r.canceled,
      `${r.fulfillmentRate.toFixed(1)}%`,
      r.revenue.toFixed(2),
      r.aov.toFixed(2),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Analytics_Dhaka_${dateRange.startDate}_to_${dateRange.endDate}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-600">
            Loading Dhaka Business Analytics...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Navigation Bar */}
      <Navbar currentProfile={currentProfile} activeTab="analytics" />

      {/* Midnight Rollover Notification Toast */}
      {midnightNotification && (
        <div className="fixed top-18 right-6 z-50 max-w-md bg-slate-900 text-white p-4 rounded-xl shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-start gap-3">
            <Moon className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-xs font-bold text-amber-300">
                Dhaka Day Rollover (12:00 AM)
              </h4>
              <p className="text-xs text-slate-300 mt-0.5">
                {midnightNotification}
              </p>
            </div>
            <button
              onClick={() => setMidnightNotification(null)}
              className="text-slate-400 hover:text-white text-xs font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Top Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                Executive OMS
              </span>
              <span className="text-xs font-medium text-slate-500">
                Dhaka Timezone (GMT+6)
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <BarChart2 className="w-6 h-6 text-blue-600" />
              <span>Analytics & Business Intelligence</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Live sales performance, daily shipments, and financial ledgers strictly resetting at 12:00 AM midnight BST.
            </p>
          </div>

          {/* Dhaka Clock & Meta Date Picker */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Live Dhaka Clock Pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs shadow-2xs">
              <Clock className="w-4 h-4 text-emerald-600 animate-pulse" />
              <div>
                <span className="font-mono font-bold text-slate-800">
                  {dhakaClockString || 'Dhaka Time'}
                </span>
                <span className="text-[10px] text-slate-500 block leading-tight">
                  Day ends in: {dhakaCountdown.hh}h {dhakaCountdown.mm}m {dhakaCountdown.ss}s
                </span>
              </div>
            </div>

            {/* Meta Ads Manager Style Date Range Filter */}
            <MetaDateRangePicker
              value={dateRange}
              onChange={handleDateRangeChange}
              align="right"
            />

            {/* Refresh Button */}
            <button
              type="button"
              onClick={fetchOrdersData}
              disabled={loadingOrders}
              className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-colors shadow-2xs"
              title="Refresh Analytics Data"
            >
              <RefreshCw
                className={`w-4 h-4 ${loadingOrders ? 'animate-spin text-blue-600' : ''}`}
              />
            </button>

            {/* Export CSV Button */}
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* 4 Core Executive KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Revenue */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Total Revenue
                </span>
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-slate-900 tracking-tight">
                  {formatCurrency(metrics.totalRevenue)}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {dateRange.compare ? (
                    <span
                      className={`inline-flex items-center text-xs font-bold px-1.5 py-0.5 rounded ${
                        metrics.revenueDelta >= 0
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {metrics.revenueDelta >= 0 ? (
                        <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                      ) : (
                        <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                      )}
                      {Math.abs(metrics.revenueDelta).toFixed(1)}% vs prior
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400">
                      Non-canceled orders
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-400 block">Avg. Order Value</span>
                <span className="font-bold text-slate-700">
                  {formatCurrency(metrics.aov)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Advance Collected</span>
                <span className="font-bold text-emerald-700">
                  {formatCurrency(metrics.advanceCollected)}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Daily Sales / Order Volume */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Daily Sales Volume
                </span>
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <ShoppingBag className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-slate-900 tracking-tight">
                  {metrics.totalOrdersCount.toLocaleString()} Orders
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {dateRange.compare ? (
                    <span
                      className={`inline-flex items-center text-xs font-bold px-1.5 py-0.5 rounded ${
                        metrics.ordersDelta >= 0
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {metrics.ordersDelta >= 0 ? (
                        <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                      ) : (
                        <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                      )}
                      {Math.abs(metrics.ordersDelta).toFixed(1)}% vs prior
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400">
                      Orders placed in range
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-3 gap-1 text-[11px]">
              <div>
                <span className="text-slate-400 block">Confirmed</span>
                <span className="font-bold text-blue-700">
                  {metrics.confirmedCount}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Delayed</span>
                <span className="font-bold text-amber-700">
                  {metrics.delayedCount}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Pending</span>
                <span className="font-bold text-slate-600">
                  {metrics.pendingCount}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Total Shipped Orders */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Total Shipped Orders
                </span>
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <Truck className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-slate-900 tracking-tight">
                  {metrics.shippedCount.toLocaleString()} Parcels
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {dateRange.compare ? (
                    <span
                      className={`inline-flex items-center text-xs font-bold px-1.5 py-0.5 rounded ${
                        metrics.shippedDelta >= 0
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {metrics.shippedDelta >= 0 ? (
                        <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                      ) : (
                        <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                      )}
                      {Math.abs(metrics.shippedDelta).toFixed(1)}% vs prior
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400">
                      Shipped & Delivered
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-400 block">Fulfillment Rate</span>
                <span className="font-bold text-indigo-700">
                  {metrics.fulfillmentRate.toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Delivered</span>
                <span className="font-bold text-emerald-700">
                  {metrics.deliveredCount}
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Delivery Success & Returns */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Delivery Success Rate
                </span>
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-slate-900 tracking-tight">
                  {metrics.deliverySuccessRate.toFixed(1)}%
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] text-slate-500 font-medium">
                    {metrics.deliveredCount} Delivered / {metrics.canceledCount} Canceled
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-400 block">Delivery Charges</span>
                <span className="font-bold text-slate-700">
                  {formatCurrency(metrics.deliveryCharges)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Discounts Given</span>
                <span className="font-bold text-rose-600">
                  {formatCurrency(metrics.discountsGiven)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Daily Sales & Revenue Trend Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Daily Sales & Revenue Progression
              </h2>
              <p className="text-xs text-slate-500">
                Day-by-day Dhaka timeline from {formatDhakaDisplayDate(dateRange.startDate)} to{' '}
                {formatDhakaDisplayDate(dateRange.endDate)}
              </p>
            </div>

            {/* Metric Switcher & Legend */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Legend */}
              <div className="flex items-center gap-3 text-xs text-slate-600 font-medium mr-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-blue-600" />
                  <span>Selected Period</span>
                </div>
                {dateRange.compare && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-1 bg-amber-500 border-b border-dashed border-amber-600" />
                    <span>Prior Comparison</span>
                  </div>
                )}
              </div>

              {/* Toggle Buttons */}
              <div className="inline-flex rounded-lg p-0.5 bg-slate-100 border border-slate-200 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setChartMetric('revenue')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    chartMetric === 'revenue'
                      ? 'bg-white text-blue-700 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Revenue (BDT)
                </button>
                <button
                  type="button"
                  onClick={() => setChartMetric('orders')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    chartMetric === 'orders'
                      ? 'bg-white text-blue-700 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Orders Volume
                </button>
              </div>
            </div>
          </div>

          {/* SVG Visual Graph */}
          <div className="mt-6 relative">
            {loadingOrders ? (
              <div className="h-64 flex items-center justify-center">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : dailyChartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                No orders found in this date range.
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <div className="min-w-[650px]">
                  {/* SVG Canvas */}
                  <svg
                    viewBox="0 0 900 240"
                    className="w-full h-64 overflow-visible"
                  >
                    <defs>
                      <linearGradient
                        id="blueGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor="#2563EB" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal Grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                      const y = 200 - pct * 170;
                      const val = chartMax * pct;
                      return (
                        <g key={i}>
                          <line
                            x1="50"
                            y1={y}
                            x2="880"
                            y2={y}
                            stroke="#E2E8F0"
                            strokeDasharray="4 4"
                          />
                          <text
                            x="42"
                            y={y + 4}
                            textAnchor="end"
                            fontSize="10"
                            fill="#94A3B8"
                            fontWeight="600"
                          >
                            {chartMetric === 'revenue'
                              ? `${Math.round(val / 1000)}k`
                              : Math.round(val)}
                          </text>
                        </g>
                      );
                    })}

                    {/* Comparison Series Line (if active) */}
                    {dateRange.compare && (
                      <polyline
                        fill="none"
                        stroke="#D97706"
                        strokeWidth="2"
                        strokeDasharray="5 5"
                        points={dailyChartData
                          .map((d, idx) => {
                            const x =
                              50 +
                              (idx / Math.max(1, dailyChartData.length - 1)) *
                                830;
                            const val =
                              chartMetric === 'revenue'
                                ? d.compRevenue || 0
                                : d.compOrdersCount || 0;
                            const y = 200 - (val / chartMax) * 170;
                            return `${x},${y}`;
                          })
                          .join(' ')}
                      />
                    )}

                    {/* Area under curve */}
                    {dailyChartData.length > 1 && (
                      <polygon
                        fill="url(#blueGradient)"
                        points={`50,200 ${dailyChartData
                          .map((d, idx) => {
                            const x =
                              50 +
                              (idx / Math.max(1, dailyChartData.length - 1)) *
                                830;
                            const val =
                              chartMetric === 'revenue' ? d.revenue : d.ordersCount;
                            const y = 200 - (val / chartMax) * 170;
                            return `${x},${y}`;
                          })
                          .join(' ')} ${
                          50 +
                          ((dailyChartData.length - 1) /
                            Math.max(1, dailyChartData.length - 1)) *
                            830
                        },200`}
                      />
                    )}

                    {/* Primary Curve Line */}
                    <polyline
                      fill="none"
                      stroke="#2563EB"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={dailyChartData
                        .map((d, idx) => {
                          const x =
                            50 +
                            (idx / Math.max(1, dailyChartData.length - 1)) * 830;
                          const val =
                            chartMetric === 'revenue' ? d.revenue : d.ordersCount;
                          const y = 200 - (val / chartMax) * 170;
                          return `${x},${y}`;
                        })
                        .join(' ')}
                    />

                    {/* Data Points & Hover Targets */}
                    {dailyChartData.map((d, idx) => {
                      const x =
                        50 +
                        (idx / Math.max(1, dailyChartData.length - 1)) * 830;
                      const val =
                        chartMetric === 'revenue' ? d.revenue : d.ordersCount;
                      const y = 200 - (val / chartMax) * 170;

                      return (
                        <g
                          key={d.date}
                          className="cursor-pointer"
                          onMouseEnter={() =>
                            setHoveredDayData({
                              date: d.fullDate,
                              revenue: d.revenue,
                              ordersCount: d.ordersCount,
                              shippedCount: d.shippedCount,
                              deliveredCount: d.deliveredCount,
                              compRevenue: d.compRevenue,
                              compOrdersCount: d.compOrdersCount,
                            })
                          }
                          onMouseLeave={() => setHoveredDayData(null)}
                        >
                          {/* Invisible hover bar */}
                          <rect
                            x={x - 15}
                            y="20"
                            width="30"
                            height="180"
                            fill="transparent"
                          />
                          {/* Point Circle */}
                          <circle
                            cx={x}
                            cy={y}
                            r="4.5"
                            fill="#FFFFFF"
                            stroke="#2563EB"
                            strokeWidth="2.5"
                          />
                          {/* X-axis date label */}
                          <text
                            x={x}
                            y="222"
                            textAnchor="middle"
                            fontSize="10"
                            fill="#64748B"
                            fontWeight="600"
                          >
                            {d.displayDate}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            )}

            {/* Interactive Tooltip Card */}
            {hoveredDayData && (
              <div className="absolute top-2 right-4 bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 pointer-events-none text-xs z-20">
                <div className="font-bold text-blue-400 border-b border-slate-800 pb-1 mb-1.5 flex items-center justify-between gap-4">
                  <span>{hoveredDayData.date}</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    Dhaka Day
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Total Revenue:</span>
                    <span className="font-bold text-white">
                      {formatCurrency(hoveredDayData.revenue)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Orders Placed:</span>
                    <span className="font-bold text-blue-300">
                      {hoveredDayData.ordersCount}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Shipped Parcels:</span>
                    <span className="font-bold text-indigo-300">
                      {hoveredDayData.shippedCount}
                    </span>
                  </div>
                  {dateRange.compare && (
                    <div className="pt-1 mt-1 border-t border-slate-800 flex justify-between gap-4 text-amber-300 text-[11px]">
                      <span>Prior Period:</span>
                      <span className="font-bold">
                        {chartMetric === 'revenue'
                          ? formatCurrency(hoveredDayData.compRevenue || 0)
                          : `${hoveredDayData.compOrdersCount || 0} orders`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Breakdown Panels (Sales Channels & Order Status Distribution) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Panel 1: Order Sources & Acquisition Channels */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  Sales Channels Breakdown
                </h3>
                <p className="text-xs text-slate-500">
                  Traffic and revenue contribution by acquisition channel
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                {metrics.totalOrdersCount} Total Orders
              </span>
            </div>

            <div className="mt-4 space-y-3.5">
              {channelBreakdown.map((item) => {
                const IconComponent = item.icon;
                return (
                  <div key={item.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-semibold text-slate-800">
                        <IconComponent className="w-4 h-4" />
                        <span>{item.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-900">
                          {formatCurrency(item.revenue)}
                        </span>
                        <span className="text-slate-500 w-16 text-right">
                          {item.count} orders ({item.percent.toFixed(0)}%)
                        </span>
                      </div>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full transition-all"
                        style={{ width: `${item.percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Panel 2: Order Fulfillment Pipeline Status */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  Order Status Pipeline
                </h3>
                <p className="text-xs text-slate-500">
                  Fulfillment progression from confirmation to courier delivery
                </p>
              </div>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {metrics.fulfillmentRate.toFixed(1)}% Shipped
              </span>
            </div>

            <div className="mt-4 space-y-3.5">
              {/* Confirmed Orders */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-blue-800">
                    Confirmed Orders
                  </span>
                  <span className="font-bold text-slate-800">
                    {metrics.confirmedCount} (
                    {(
                      (metrics.confirmedCount /
                        (metrics.totalOrdersCount || 1)) *
                      100
                    ).toFixed(0)}
                    %)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full"
                    style={{
                      width: `${(metrics.confirmedCount / (metrics.totalOrdersCount || 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Shipped Orders */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-indigo-800">
                    Shipped & Out for Delivery
                  </span>
                  <span className="font-bold text-slate-800">
                    {metrics.shippedCount} (
                    {(
                      (metrics.shippedCount / (metrics.totalOrdersCount || 1)) *
                      100
                    ).toFixed(0)}
                    %)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full rounded-full"
                    style={{
                      width: `${(metrics.shippedCount / (metrics.totalOrdersCount || 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Delivered Orders */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-800">
                    Delivered to Customers
                  </span>
                  <span className="font-bold text-slate-800">
                    {metrics.deliveredCount} (
                    {(
                      (metrics.deliveredCount /
                        (metrics.totalOrdersCount || 1)) *
                      100
                    ).toFixed(0)}
                    %)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full"
                    style={{
                      width: `${(metrics.deliveredCount / (metrics.totalOrdersCount || 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Delayed Delivery / Hold */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-amber-800">
                    Delayed Delivery / Stock Hold
                  </span>
                  <span className="font-bold text-slate-800">
                    {metrics.delayedCount} (
                    {(
                      (metrics.delayedCount / (metrics.totalOrdersCount || 1)) *
                      100
                    ).toFixed(0)}
                    %)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full"
                    style={{
                      width: `${(metrics.delayedCount / (metrics.totalOrdersCount || 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Canceled Orders */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-rose-800">
                    Canceled / Returned
                  </span>
                  <span className="font-bold text-slate-800">
                    {metrics.canceledCount} (
                    {(
                      (metrics.canceledCount / (metrics.totalOrdersCount || 1)) *
                      100
                    ).toFixed(0)}
                    %)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-rose-500 h-full rounded-full"
                    style={{
                      width: `${(metrics.canceledCount / (metrics.totalOrdersCount || 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Daily Breakdown Ledger Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Daily Sales & Fulfillment Ledger
              </h3>
              <p className="text-xs text-slate-500">
                Detailed day-by-day record of order volume, delivery status, and gross revenues.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Search Filter */}
              <input
                type="text"
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
                placeholder="Search date or amount..."
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-blue-500 w-44 sm:w-56"
              />

              {/* Quick Sort Options */}
              <div className="inline-flex rounded-lg p-0.5 bg-slate-100 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    if (ledgerSortBy === 'date') {
                      setLedgerSortDir(ledgerSortDir === 'desc' ? 'asc' : 'desc');
                    } else {
                      setLedgerSortBy('date');
                      setLedgerSortDir('desc');
                    }
                  }}
                  className={`px-2.5 py-1 rounded-md ${
                    ledgerSortBy === 'date'
                      ? 'bg-white text-blue-700 shadow-2xs font-bold'
                      : 'text-slate-600'
                  }`}
                >
                  Date {ledgerSortBy === 'date' && (ledgerSortDir === 'desc' ? '↓' : '↑')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (ledgerSortBy === 'revenue') {
                      setLedgerSortDir(ledgerSortDir === 'desc' ? 'asc' : 'desc');
                    } else {
                      setLedgerSortBy('revenue');
                      setLedgerSortDir('desc');
                    }
                  }}
                  className={`px-2.5 py-1 rounded-md ${
                    ledgerSortBy === 'revenue'
                      ? 'bg-white text-blue-700 shadow-2xs font-bold'
                      : 'text-slate-600'
                  }`}
                >
                  Revenue {ledgerSortBy === 'revenue' && (ledgerSortDir === 'desc' ? '↓' : '↑')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (ledgerSortBy === 'orders') {
                      setLedgerSortDir(ledgerSortDir === 'desc' ? 'asc' : 'desc');
                    } else {
                      setLedgerSortBy('orders');
                      setLedgerSortDir('desc');
                    }
                  }}
                  className={`px-2.5 py-1 rounded-md ${
                    ledgerSortBy === 'orders'
                      ? 'bg-white text-blue-700 shadow-2xs font-bold'
                      : 'text-slate-600'
                  }`}
                >
                  Orders {ledgerSortBy === 'orders' && (ledgerSortDir === 'desc' ? '↓' : '↑')}
                </button>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Date (Dhaka Time)</th>
                  <th className="py-3 px-4 text-center">Orders</th>
                  <th className="py-3 px-4 text-center">Confirmed</th>
                  <th className="py-3 px-4 text-center">Shipped</th>
                  <th className="py-3 px-4 text-center">Delivered</th>
                  <th className="py-3 px-4 text-center">Delayed</th>
                  <th className="py-3 px-4 text-center">Canceled</th>
                  <th className="py-3 px-4 text-center">Fulfillment</th>
                  <th className="py-3 px-4 text-right">Avg Order Value</th>
                  <th className="py-3 px-4 text-right">Gross Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dailyLedgerRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="py-8 text-center text-slate-400 font-medium"
                    >
                      No ledger rows recorded for this period.
                    </td>
                  </tr>
                ) : (
                  dailyLedgerRows.map((row) => (
                    <tr
                      key={row.date}
                      className="hover:bg-slate-50/60 transition-colors font-medium text-slate-800"
                    >
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {row.fullDate}
                      </td>
                      <td className="py-3 px-4 text-center font-bold">
                        {row.totalOrders}
                      </td>
                      <td className="py-3 px-4 text-center text-blue-700 font-semibold">
                        {row.confirmed}
                      </td>
                      <td className="py-3 px-4 text-center text-indigo-700 font-semibold">
                        {row.shipped}
                      </td>
                      <td className="py-3 px-4 text-center text-emerald-700 font-semibold">
                        {row.delivered}
                      </td>
                      <td className="py-3 px-4 text-center text-amber-700">
                        {row.delayed}
                      </td>
                      <td className="py-3 px-4 text-center text-rose-600">
                        {row.canceled}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                            row.fulfillmentRate >= 70
                              ? 'bg-emerald-50 text-emerald-700'
                              : row.fulfillmentRate >= 40
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {row.fulfillmentRate.toFixed(0)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600">
                        {formatCurrency(row.aov)}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-900">
                        {formatCurrency(row.revenue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
