'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Search,
  Filter,
  Download,
  RefreshCw,
  Boxes,
  Package,
  ShoppingBag,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Eye,
  CheckCircle2,
  Clock,
  Truck,
  AlertCircle,
  FileSpreadsheet,
  Printer,
  Sparkles,
  Tag,
  DollarSign,
  Layers,
  Check,
  X,
} from 'lucide-react';
import { Order, OrderItem, Profile, OrderStatus } from '@/types/database';
import {
  getDhakaDateString,
  formatDhakaDisplayDate,
  formatDhakaWeekdayDate,
  isSameDhakaDay,
} from '@/lib/dateUtils';
import { formatCurrency } from '@/lib/utils';

interface DailyProductOrdersViewProps {
  portal: 'admin' | 'packing';
  backUrl?: string;
  currentProfile?: Profile | null;
}

type DatePreset =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_30_days'
  | 'this_month'
  | 'prev_month'
  | 'all_time'
  | 'custom';

type ViewMode = 'grouped_by_date' | 'summary_by_product';

interface ProductDayAgg {
  productKey: string;
  productId: string | null;
  variantId: string | null;
  title: string;
  variantTitle: string | null;
  sku: string | null;
  imageUrl: string | null;
  unitPrice: number;
  totalQuantity: number;
  ordersCount: number;
  totalValue: number;
  statusCounts: Record<string, number>;
  orders: {
    id: string;
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    status: OrderStatus;
    quantity: number;
    price: number;
    createdAt: string;
    note: string | null;
  }[];
}

interface DayGroup {
  dateStr: string;
  displayDate: string;
  weekdayDate: string;
  isToday: boolean;
  isYesterday: boolean;
  relativeLabel: string;
  totalUnits: number;
  totalOrders: number;
  totalValue: number;
  uniqueProductsCount: number;
  products: ProductDayAgg[];
}

export default function DailyProductOrdersView({
  portal,
  backUrl = portal === 'admin' ? '/admin' : '/packing',
  currentProfile,
}: DailyProductOrdersViewProps) {
  // Filters State
  const [datePreset, setDatePreset] = useState<DatePreset>('last_30_days');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return getDhakaDateString(d);
  });
  const [endDate, setEndDate] = useState<string>(() => getDhakaDateString(new Date()));
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('grouped_by_date');

  // Expanded Day Cards & Product Order Rows
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [expandedProductOrders, setExpandedProductOrders] = useState<Record<string, boolean>>({});

  // Data State
  const [orders, setOrders] = useState<Order[]>([]);
  const [productsCatalogMap, setProductsCatalogMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Set date preset ranges
  const applyPreset = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();
    const todayStr = getDhakaDateString(now);

    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const yStr = getDhakaDateString(y);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === 'last_7_days') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      setStartDate(getDhakaDateString(d));
      setEndDate(todayStr);
    } else if (preset === 'last_30_days') {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      setStartDate(getDhakaDateString(d));
      setEndDate(todayStr);
    } else if (preset === 'this_month') {
      const firstDay = `${todayStr.slice(0, 7)}-01`;
      setStartDate(firstDay);
      setEndDate(todayStr);
    } else if (preset === 'prev_month') {
      const curYear = parseInt(todayStr.slice(0, 4), 10);
      const curMonth = parseInt(todayStr.slice(5, 7), 10);
      const prevMonthYear = curMonth === 1 ? curYear - 1 : curYear;
      const prevMonthNum = curMonth === 1 ? 12 : curMonth - 1;
      const prevMonthStr = String(prevMonthNum).padStart(2, '0');
      const start = `${prevMonthYear}-${prevMonthStr}-01`;
      // Last day of previous month
      const lastDayNum = new Date(prevMonthYear, prevMonthNum, 0).getDate();
      const end = `${prevMonthYear}-${prevMonthStr}-${String(lastDayNum).padStart(2, '0')}`;
      setStartDate(start);
      setEndDate(end);
    } else if (preset === 'all_time') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Fetch orders data
  const fetchData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (datePreset === 'all_time') {
        params.append('allTime', 'true');
      } else {
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
      }
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const res = await fetch(`/api/orders/daily-products?${params.toString()}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to load daily product orders.');
      }

      setOrders(data.orders || []);
      setProductsCatalogMap(data.productsMap || {});
    } catch (err: any) {
      setError(err.message || 'Error loading orders.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, datePreset, statusFilter]);

  // Aggregate and group orders by Dhaka Date
  const { dayGroups, overallSummary, productSummaries } = useMemo(() => {
    const todayStr = getDhakaDateString(new Date());
    const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yesterdayStr = getDhakaDateString(yesterdayDate);

    // Filter orders if in-memory search matches
    const searchLower = searchQuery.trim().toLowerCase();

    // Map: dateStr -> Map<productKey, ProductDayAgg>
    const dateMap = new Map<string, Map<string, ProductDayAgg>>();
    // Product map for 'summary_by_product' view
    const productMap = new Map<
      string,
      {
        productKey: string;
        productId: string | null;
        variantId: string | null;
        title: string;
        variantTitle: string | null;
        sku: string | null;
        imageUrl: string | null;
        unitPrice: number;
        totalQuantity: number;
        ordersCount: number;
        totalValue: number;
        dates: Map<
          string,
          {
            dateStr: string;
            quantity: number;
            ordersCount: number;
            totalValue: number;
          }
        >;
      }
    >();

    let totalUnits = 0;
    let totalRevenue = 0;
    const uniqueOrdersSet = new Set<string>();
    const uniqueProductsSet = new Set<string>();

    orders.forEach((order) => {
      const dateStr = getDhakaDateString(order.created_at);
      const items = order.order_items || [];

      items.forEach((item: OrderItem) => {
        const title = item.title || 'Untitled Product';
        const variantTitle = item.variant_title || null;
        const qty = Number(item.quantity || 1);
        const price = Number(item.price || 0);
        const itemVal = qty * price;

        // Lookup catalog image & SKU
        let imageUrl: string | null = null;
        let sku: string | null = null;
        if (item.product_id && productsCatalogMap[item.product_id]) {
          const catalogProd = productsCatalogMap[item.product_id];
          imageUrl = catalogProd.image_url || null;
          if (item.variant_id && catalogProd.variants?.[item.variant_id]) {
            sku = catalogProd.variants[item.variant_id].sku || null;
          }
        }

        const productKey = `${item.product_id || title}_${item.variant_id || variantTitle || 'default'}`;

        // Match search query
        if (searchLower) {
          const matchesTitle = title.toLowerCase().includes(searchLower);
          const matchesVariant = variantTitle?.toLowerCase().includes(searchLower) || false;
          const matchesSku = sku?.toLowerCase().includes(searchLower) || false;
          const matchesOrderNum = order.order_number.toLowerCase().includes(searchLower);
          const matchesCustomer =
            order.customer_name.toLowerCase().includes(searchLower) ||
            order.customer_phone.includes(searchLower);

          if (!matchesTitle && !matchesVariant && !matchesSku && !matchesOrderNum && !matchesCustomer) {
            return;
          }
        }

        uniqueOrdersSet.add(order.id);
        uniqueProductsSet.add(productKey);
        totalUnits += qty;
        totalRevenue += itemVal;

        // Group by Date
        if (!dateMap.has(dateStr)) {
          dateMap.set(dateStr, new Map());
        }
        const dayProducts = dateMap.get(dateStr)!;

        if (!dayProducts.has(productKey)) {
          dayProducts.set(productKey, {
            productKey,
            productId: item.product_id,
            variantId: item.variant_id,
            title,
            variantTitle,
            sku,
            imageUrl,
            unitPrice: price,
            totalQuantity: 0,
            ordersCount: 0,
            totalValue: 0,
            statusCounts: {},
            orders: [],
          });
        }

        const agg = dayProducts.get(productKey)!;
        agg.totalQuantity += qty;
        agg.totalValue += itemVal;
        agg.ordersCount += 1;
        agg.statusCounts[order.status] = (agg.statusCounts[order.status] || 0) + qty;
        agg.orders.push({
          id: order.id,
          orderNumber: order.order_number,
          customerName: order.customer_name,
          customerPhone: order.customer_phone,
          status: order.status,
          quantity: qty,
          price,
          createdAt: order.created_at,
          note: order.note || null,
        });

        // Group by Product
        if (!productMap.has(productKey)) {
          productMap.set(productKey, {
            productKey,
            productId: item.product_id,
            variantId: item.variant_id,
            title,
            variantTitle,
            sku,
            imageUrl,
            unitPrice: price,
            totalQuantity: 0,
            ordersCount: 0,
            totalValue: 0,
            dates: new Map(),
          });
        }
        const pAgg = productMap.get(productKey)!;
        pAgg.totalQuantity += qty;
        pAgg.totalValue += itemVal;
        pAgg.ordersCount += 1;
        if (!pAgg.dates.has(dateStr)) {
          pAgg.dates.set(dateStr, {
            dateStr,
            quantity: 0,
            ordersCount: 0,
            totalValue: 0,
          });
        }
        const pDate = pAgg.dates.get(dateStr)!;
        pDate.quantity += qty;
        pDate.ordersCount += 1;
        pDate.totalValue += itemVal;
      });
    });

    // Sort dates descending (newest day first)
    const sortedDateKeys = Array.from(dateMap.keys()).sort((a, b) => b.localeCompare(a));

    const groups: DayGroup[] = sortedDateKeys.map((dateStr) => {
      const dayProdsMap = dateMap.get(dateStr)!;
      const prodsList = Array.from(dayProdsMap.values()).sort(
        (a, b) => b.totalQuantity - a.totalQuantity
      );

      const dayUnits = prodsList.reduce((s, p) => s + p.totalQuantity, 0);
      const dayValue = prodsList.reduce((s, p) => s + p.totalValue, 0);
      const dayOrders = new Set(prodsList.flatMap((p) => p.orders.map((o) => o.id))).size;

      const isToday = dateStr === todayStr;
      const isYesterday = dateStr === yesterdayStr;
      let relativeLabel = '';
      if (isToday) relativeLabel = 'Today';
      else if (isYesterday) relativeLabel = 'Yesterday';

      return {
        dateStr,
        displayDate: formatDhakaDisplayDate(dateStr),
        weekdayDate: formatDhakaWeekdayDate(dateStr),
        isToday,
        isYesterday,
        relativeLabel,
        totalUnits: dayUnits,
        totalOrders: dayOrders,
        totalValue: dayValue,
        uniqueProductsCount: prodsList.length,
        products: prodsList,
      };
    });

    // Sort product summaries by total quantity descending
    const pSummaries = Array.from(productMap.values()).sort(
      (a, b) => b.totalQuantity - a.totalQuantity
    );

    return {
      dayGroups: groups,
      overallSummary: {
        totalUnits,
        totalRevenue,
        totalOrders: uniqueOrdersSet.size,
        uniqueProducts: uniqueProductsSet.size,
        totalDates: groups.length,
      },
      productSummaries: pSummaries,
    };
  }, [orders, productsCatalogMap, searchQuery]);

  // Toggle Day Accordion
  const toggleDateExpand = (dateStr: string) => {
    setExpandedDates((prev) => ({
      ...prev,
      [dateStr]: prev[dateStr] === undefined ? false : !prev[dateStr],
    }));
  };

  // Toggle Product Orders Accordion
  const toggleProductOrders = (key: string) => {
    setExpandedProductOrders((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Expand / Collapse all dates
  const expandAllDates = () => {
    const all: Record<string, boolean> = {};
    dayGroups.forEach((g) => {
      all[g.dateStr] = true;
    });
    setExpandedDates(all);
  };

  const collapseAllDates = () => {
    const all: Record<string, boolean> = {};
    dayGroups.forEach((g) => {
      all[g.dateStr] = false;
    });
    setExpandedDates(all);
  };

  // CSV Export Functionality
  const exportCsv = () => {
    if (dayGroups.length === 0) {
      alert('No product order data available to export.');
      return;
    }

    const headers = [
      'Date (YYYY-MM-DD)',
      'Product Title',
      'Variant',
      'SKU',
      'Quantity Ordered',
      'Orders Count',
      'Unit Price (BDT)',
      'Total Value (BDT)',
      'Order Numbers',
      'Statuses',
    ];

    const rows: string[][] = [];

    dayGroups.forEach((group) => {
      group.products.forEach((p) => {
        const orderNums = Array.from(new Set(p.orders.map((o) => o.orderNumber))).join('; ');
        const statusSummary = Object.entries(p.statusCounts)
          .map(([st, c]) => `${st}: ${c}`)
          .join(', ');

        rows.push([
          group.dateStr,
          `"${p.title.replace(/"/g, '""')}"`,
          `"${(p.variantTitle || '').replace(/"/g, '""')}"`,
          `"${(p.sku || '').replace(/"/g, '""')}"`,
          String(p.totalQuantity),
          String(p.ordersCount),
          String(p.unitPrice),
          String(p.totalValue),
          `"${orderNums}"`,
          `"${statusSummary}"`,
        ]);
      });
    });

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const fileName = `daily-product-orders_${startDate || 'all-time'}_to_${endDate || 'all-time'}.csv`;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'confirmed':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'ready_to_ship':
        return 'bg-blue-100 text-blue-900 border-blue-300';
      case 'on_the_way':
        return 'bg-indigo-100 text-indigo-900 border-indigo-300';
      case 'delivered':
      case 'shipped':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'delayed_delivery':
        return 'bg-orange-100 text-orange-950 border-orange-300';
      case 'pending':
        return 'bg-slate-100 text-slate-800 border-slate-300';
      case 'canceled':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 pb-16">
      {/* Top Banner / Breadcrumb */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
                <Link
                  href={backUrl}
                  className="hover:text-slate-900 flex items-center gap-1 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>
                    {portal === 'admin' ? 'Admin Dashboard' : 'Delivery & Fulfillment Station'}
                  </span>
                </Link>
                <span>/</span>
                <span className="text-slate-800 font-bold">Daily Product Orders</span>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                  <Calendar className="w-7 h-7 text-emerald-600" />
                  <span>Daily Product Orders</span>
                </h1>
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                  Products by Date
                </span>
                <span className="text-xs font-mono font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  GMT+6 (Dhaka Standard Time)
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                View which products were ordered on each specific date, examine daily unit demand, and explore previous historical data.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => fetchData(true)}
                disabled={loading || refreshing}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                title="Refresh order data"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-600' : ''}`} />
                <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
              </button>

              <button
                type="button"
                onClick={exportCsv}
                disabled={dayGroups.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                title="Export filtered daily product data as CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer no-print"
                title="Print daily product order breakdown"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* KPI Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Total Units Ordered</span>
              <Boxes className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
              {overallSummary.totalUnits.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Sum of items demanded</p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Unique Products</span>
              <Package className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
              {overallSummary.uniqueProducts}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Active catalog items</p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Orders Placed</span>
              <ShoppingBag className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
              {overallSummary.totalOrders.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">In selected date filter</p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Dates with Orders</span>
              <Calendar className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
              {overallSummary.totalDates}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Days with recorded sales</p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Total Product Value</span>
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-700 mt-2 font-mono">
              {formatCurrency(overallSummary.totalRevenue)}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Cumulative product sum</p>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 no-print">
          {/* Preset Buttons */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-slate-600 mr-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Date Range:</span>
              </span>

              {(
                [
                  { key: 'today', label: 'Today' },
                  { key: 'yesterday', label: 'Yesterday' },
                  { key: 'last_7_days', label: 'Last 7 Days' },
                  { key: 'last_30_days', label: 'Last 30 Days' },
                  { key: 'this_month', label: 'This Month' },
                  { key: 'prev_month', label: 'Previous Month' },
                  { key: 'all_time', label: '★ All Time (Previous Data)' },
                ] as const
              ).map((preset) => {
                const isActive = datePreset === preset.key;
                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => applyPreset(preset.key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setViewMode('grouped_by_date')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'grouped_by_date'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                <span>Grouped by Date</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('summary_by_product')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'summary_by_product'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Boxes className="w-3.5 h-3.5 text-blue-600" />
                <span>Summary by Product</span>
              </button>
            </div>
          </div>

          {/* Search, Custom Dates & Status Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search product, SKU, or order #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Custom Start Date */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 shrink-0">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            {/* Custom End Date */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 shrink-0">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
              >
                <option value="all">All Order Statuses</option>
                <option value="active">Active Orders (Exclude Canceled)</option>
                <option value="confirmed,ready_to_ship,on_the_way,delivered,shipped">
                  Confirmed / Packed / In-Transit / Delivered
                </option>
                <option value="delayed_delivery">Delayed (Awaiting Restock)</option>
                <option value="confirmed">Confirmed (To Pack)</option>
                <option value="ready_to_ship">Ready to Ship (Packed)</option>
                <option value="on_the_way">With Courier</option>
                <option value="delivered,shipped">Delivered / Fulfilled</option>
                <option value="pending">Pending Unconfirmed</option>
                <option value="canceled">Canceled</option>
              </select>
            </div>
          </div>

          {/* Quick Date Control Helpers */}
          {viewMode === 'grouped_by_date' && dayGroups.length > 0 && (
            <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <span>
                  Showing <strong>{dayGroups.length} date{dayGroups.length > 1 ? 's' : ''}</strong> with orders
                </span>
                {datePreset === 'all_time' && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px]">
                    All-Time History
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={expandAllDates}
                  className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold cursor-pointer"
                >
                  Expand All Days
                </button>
                <span>&middot;</span>
                <button
                  type="button"
                  onClick={collapseAllDates}
                  className="text-xs text-slate-600 hover:text-slate-800 font-semibold cursor-pointer"
                >
                  Collapse All Days
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-xs">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-3" />
            <h3 className="text-base font-bold text-slate-900">Loading daily product orders...</h3>
            <p className="text-xs text-slate-500 mt-1">Aggregating product counts and date records</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center text-rose-800">
            <AlertCircle className="w-6 h-6 mx-auto mb-2 text-rose-600" />
            <p className="text-sm font-bold">Failed to load product order data</p>
            <p className="text-xs mt-1">{error}</p>
            <button
              type="button"
              onClick={() => fetchData()}
              className="mt-3 px-4 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors cursor-pointer"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && dayGroups.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-xs">
            <Boxes className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900">No product orders found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              No orders matched your date range ({startDate || 'Start'} to {endDate || 'End'}) or search filters.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => applyPreset('all_time')}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                View All-Time Previous Data
              </button>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                >
                  Clear Search Filter
                </button>
              )}
            </div>
          </div>
        )}

        {/* VIEW 1: GROUPED BY DATE */}
        {!loading && !error && viewMode === 'grouped_by_date' && dayGroups.length > 0 && (
          <div className="space-y-4">
            {dayGroups.map((group) => {
              const isExpanded = expandedDates[group.dateStr] ?? true;

              return (
                <div
                  key={group.dateStr}
                  className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden transition-all hover:border-slate-300"
                >
                  {/* Day Header Card */}
                  <div
                    onClick={() => toggleDateExpand(group.dateStr)}
                    className="p-4 sm:p-5 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/40 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
                        <Calendar className="w-5 h-5 text-emerald-700" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-black text-slate-900 tracking-tight">
                            {group.weekdayDate}, {group.dateStr.slice(0, 4)}
                          </h3>
                          {group.relativeLabel && (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-black tracking-wide uppercase ${
                                group.isToday
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : 'bg-amber-100 text-amber-900 border border-amber-300'
                              }`}
                            >
                              {group.relativeLabel}
                            </span>
                          )}
                          <span className="text-xs font-mono text-slate-400">
                            ({group.dateStr})
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {group.uniqueProductsCount} unique product{group.uniqueProductsCount > 1 ? 's' : ''} ordered across{' '}
                          {group.totalOrders} order{group.totalOrders > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    {/* Day Aggregate Chips */}
                    <div className="flex items-center gap-2.5 flex-wrap sm:justify-end">
                      <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-900 text-xs font-bold">
                        <span className="text-emerald-700 font-semibold mr-1">Units:</span>
                        <span className="font-mono text-sm">{group.totalUnits}</span>
                      </div>

                      <div className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200/80 text-indigo-900 text-xs font-bold">
                        <span className="text-indigo-700 font-semibold mr-1">Orders:</span>
                        <span className="font-mono text-sm">{group.totalOrders}</span>
                      </div>

                      <div className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-2xs">
                        <span className="text-slate-300 font-normal mr-1">Value:</span>
                        <span className="font-mono text-sm">{formatCurrency(group.totalValue)}</span>
                      </div>

                      <button
                        type="button"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors ml-1"
                        aria-label="Toggle Day Details"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-slate-600" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-slate-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Day Products Table */}
                  {isExpanded && (
                    <div className="divide-y divide-slate-100">
                      {group.products.map((product) => {
                        const productKey = `${group.dateStr}_${product.productKey}`;
                        const isOrdersExpanded = expandedProductOrders[productKey] || false;

                        return (
                          <div
                            key={product.productKey}
                            className="p-4 sm:p-5 hover:bg-slate-50/50 transition-colors"
                          >
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                              {/* Left: Product Info & Image */}
                              <div className="flex items-start gap-3.5 min-w-0">
                                {product.imageUrl ? (
                                  <img
                                    src={product.imageUrl}
                                    alt={product.title}
                                    className="w-12 h-12 rounded-xl object-cover border border-slate-200 bg-white shrink-0"
                                  />
                                ) : (
                                  <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0 font-bold">
                                    <Package className="w-5 h-5" />
                                  </div>
                                )}

                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-sm font-bold text-slate-900 truncate">
                                      {product.title}
                                    </h4>
                                    {product.variantTitle && (
                                      <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                        {product.variantTitle}
                                      </span>
                                    )}
                                    {product.sku && (
                                      <span className="text-[10px] font-mono font-medium text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                                        SKU: {product.sku}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                                    <span>Unit Price: {formatCurrency(product.unitPrice)}</span>
                                    <span>&middot;</span>
                                    <span>
                                      Total Value: <strong className="text-slate-800">{formatCurrency(product.totalValue)}</strong>
                                    </span>
                                  </div>

                                  {/* Status breakdown pills */}
                                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                    {Object.entries(product.statusCounts).map(([st, count]) => (
                                      <span
                                        key={st}
                                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadge(
                                          st as OrderStatus
                                        )}`}
                                      >
                                        <span>{st.replace(/_/g, ' ')}:</span>
                                        <span className="font-mono">{count}</span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {/* Right: Quantities & Toggle Orders */}
                              <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
                                <div className="text-right">
                                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200 font-bold text-sm">
                                    <span className="text-xs text-emerald-700 font-semibold">Ordered:</span>
                                    <span className="font-mono text-base font-black">
                                      {product.totalQuantity} unit{product.totalQuantity > 1 ? 's' : ''}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-400 mt-0.5">
                                    in {product.ordersCount} order{product.ordersCount > 1 ? 's' : ''} on this date
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => toggleProductOrders(productKey)}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                                  title="View orders for this product on this day"
                                >
                                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                                  <span>{isOrdersExpanded ? 'Hide Orders' : 'View Orders'}</span>
                                  {isOrdersExpanded ? (
                                    <ChevronDown className="w-3 h-3 text-slate-500" />
                                  ) : (
                                    <ChevronRight className="w-3 h-3 text-slate-400" />
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Expandable Orders List for this product on this date */}
                            {isOrdersExpanded && (
                              <div className="mt-4 pt-3 border-t border-slate-100 bg-slate-50/70 rounded-xl p-3.5">
                                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                                  <span>
                                    Orders containing this product on {group.displayDate} ({product.orders.length}):
                                  </span>
                                </div>

                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs text-left">
                                    <thead>
                                      <tr className="border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                                        <th className="py-1.5 px-2">Order #</th>
                                        <th className="py-1.5 px-2">Customer</th>
                                        <th className="py-1.5 px-2">Phone</th>
                                        <th className="py-1.5 px-2 text-center">Qty</th>
                                        <th className="py-1.5 px-2 text-right">Price</th>
                                        <th className="py-1.5 px-2">Status</th>
                                        <th className="py-1.5 px-2">Notes</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200/60 font-medium">
                                      {product.orders.map((ord) => (
                                        <tr key={ord.id} className="hover:bg-white/80 transition-colors">
                                          <td className="py-2 px-2 font-mono font-bold text-slate-900">
                                            {ord.orderNumber}
                                          </td>
                                          <td className="py-2 px-2 text-slate-800">
                                            {ord.customerName}
                                          </td>
                                          <td className="py-2 px-2 font-mono text-slate-600">
                                            {ord.customerPhone}
                                          </td>
                                          <td className="py-2 px-2 text-center font-mono font-bold text-slate-900">
                                            {ord.quantity}
                                          </td>
                                          <td className="py-2 px-2 text-right font-mono text-slate-800">
                                            {formatCurrency(ord.price)}
                                          </td>
                                          <td className="py-2 px-2">
                                            <span
                                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(
                                                ord.status
                                              )}`}
                                            >
                                              {ord.status.replace(/_/g, ' ')}
                                            </span>
                                          </td>
                                          <td className="py-2 px-2 text-[11px] text-slate-500 truncate max-w-xs">
                                            {ord.note || '-'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* VIEW 2: SUMMARY BY PRODUCT (Shows every date each product was ordered on) */}
        {!loading && !error && viewMode === 'summary_by_product' && productSummaries.length > 0 && (
          <div className="space-y-4">
            {productSummaries.map((p) => {
              const sortedDates = Array.from(p.dates.values()).sort((a, b) =>
                b.dateStr.localeCompare(a.dateStr)
              );

              return (
                <div
                  key={p.productKey}
                  className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-5 hover:border-slate-300 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3.5">
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt={p.title}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-200 bg-white shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0 font-bold">
                          <Package className="w-5 h-5" />
                        </div>
                      )}

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-slate-900">{p.title}</h3>
                          {p.variantTitle && (
                            <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                              {p.variantTitle}
                            </span>
                          )}
                          {p.sku && (
                            <span className="text-[10px] font-mono font-medium text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                              SKU: {p.sku}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Ordered on {sortedDates.length} different date{sortedDates.length > 1 ? 's' : ''} in selected period
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 sm:justify-end">
                      <div className="px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-right">
                        <span className="text-[11px] text-emerald-700 block font-semibold">Total Ordered</span>
                        <span className="text-lg font-black font-mono">{p.totalQuantity} units</span>
                      </div>

                      <div className="px-3.5 py-1.5 rounded-xl bg-slate-900 text-white text-right shadow-2xs">
                        <span className="text-[11px] text-slate-300 block font-normal">Total Value</span>
                        <span className="text-lg font-black font-mono">{formatCurrency(p.totalValue)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Dates Breakdown Table */}
                  <div className="mt-4">
                    <h5 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                      Order breakdown by date:
                    </h5>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                      {sortedDates.map((d) => (
                        <div
                          key={d.dateStr}
                          className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 text-center shadow-2xs"
                        >
                          <div className="text-[11px] font-bold text-slate-700">
                            {formatDhakaWeekdayDate(d.dateStr)}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {d.dateStr}
                          </div>
                          <div className="mt-1 text-sm font-black font-mono text-emerald-700">
                            {d.quantity} unit{d.quantity > 1 ? 's' : ''}
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium">
                            across {d.ordersCount} order{d.ordersCount > 1 ? 's' : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
