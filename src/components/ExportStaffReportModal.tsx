'use client';

import React, { useState, useMemo } from 'react';
import { X, Download, Calendar, FileSpreadsheet, CheckCircle2, User, Award } from 'lucide-react';
import { Profile, Order, UpsellReward } from '@/types/database';
import { exportStaffReportCsv } from '@/lib/exportCsv';
import { formatCurrency } from '@/lib/utils';

interface ExportStaffReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffMember: Profile | null;
  orders: Order[];
  rewards: UpsellReward[];
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function ExportStaffReportModal({
  isOpen,
  onClose,
  staffMember,
  orders,
  rewards,
}: ExportStaffReportModalProps) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const [periodType, setPeriodType] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [downloaded, setDownloaded] = useState(false);

  const years = [currentYear, currentYear - 1, currentYear - 2];

  // Calculate live preview metrics for the selected staff and period
  const previewMetrics = useMemo(() => {
    if (!staffMember) return { orderCount: 0, totalSales: 0, totalCommission: 0 };
    const staffId = staffMember.id;
    const staffCode = staffMember.coupon_code?.trim().toUpperCase();

    let startDate: Date;
    let endDate: Date;

    if (periodType === 'monthly') {
      startDate = new Date(selectedYear, selectedMonth, 1, 0, 0, 0, 0);
      const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      endDate = new Date(selectedYear, selectedMonth, lastDay, 23, 59, 59, 999);
    } else {
      startDate = new Date(selectedYear, 0, 1, 0, 0, 0, 0);
      endDate = new Date(selectedYear, 11, 31, 23, 59, 59, 999);
    }

    const matchedOrders = orders.filter((o) => {
      const d = new Date(o.created_at);
      if (d < startDate || d > endDate) return false;
      const isRep = o.sales_rep_id === staffId;
      const isCoupon = staffCode && o.coupon_used?.trim().toUpperCase() === staffCode;
      return Boolean(isRep || isCoupon);
    });

    const totalSales = matchedOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

    const totalCommission = rewards
      .filter((r) => {
        if (r.sales_rep_id !== staffId) return false;
        const d = new Date(r.created_at);
        return d >= startDate && d <= endDate;
      })
      .reduce((sum, r) => sum + Number(r.bonus_amount || 0), 0);

    return {
      orderCount: matchedOrders.length,
      totalSales,
      totalCommission,
    };
  }, [staffMember, periodType, selectedYear, selectedMonth, orders, rewards]);

  if (!isOpen || !staffMember) return null;

  const handleExport = () => {
    exportStaffReportCsv({
      staffMember,
      periodType,
      year: selectedYear,
      month: selectedMonth,
      orders,
      rewards,
    });
    setDownloaded(true);
    setTimeout(() => {
      setDownloaded(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs animate-in fade-in p-2.5 sm:p-4">
      <div className="min-h-full flex items-center justify-center py-4 sm:py-8">
        <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden relative my-auto animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Export Staff Record</h3>
                <p className="text-xs text-slate-500">Download formatted CSV report for accounting & audits</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-4 text-xs">
            {/* Staff Card */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center font-bold text-slate-700 text-sm">
                  {staffMember.full_name?.charAt(0) || 'U'}
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-xs sm:text-sm">{staffMember.full_name || 'Staff Member'}</div>
                  <div className="text-[11px] text-slate-500">{staffMember.email}</div>
                </div>
              </div>
              {staffMember.coupon_code && (
                <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-mono font-bold text-slate-800 text-[11px]">
                  {staffMember.coupon_code}
                </span>
              )}
            </div>

            {/* Period Type Selection: Monthly vs Yearly */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Report Period Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPeriodType('monthly')}
                  className={`py-2.5 px-3 rounded-xl border text-center font-semibold transition-all ${
                    periodType === 'monthly'
                      ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/10 text-emerald-950 font-bold'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600'
                  }`}
                >
                  Monthly Report
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodType('yearly')}
                  className={`py-2.5 px-3 rounded-xl border text-center font-semibold transition-all ${
                    periodType === 'yearly'
                      ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/10 text-emerald-950 font-bold'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600'
                  }`}
                >
                  Full Year Report
                </button>
              </div>
            </div>

            {/* Date Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Year */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Select Year</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      Year {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* Month (Only if Monthly) */}
              {periodType === 'monthly' ? (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Select Month</label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={idx} value={idx}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Months Covered</label>
                  <div className="bg-slate-100 border border-slate-200/80 rounded-xl px-3 py-2 text-xs font-medium text-slate-500">
                    All 12 Months (Jan - Dec)
                  </div>
                </div>
              )}
            </div>

            {/* Quick Live Preview of data to be exported */}
            <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Period Preview Summary:
              </span>
              <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                <div className="p-2 bg-white rounded-lg border border-slate-200/60 shadow-2xs">
                  <div className="text-[10px] text-slate-400">Total Orders</div>
                  <div className="font-mono font-bold text-slate-800 text-sm mt-0.5">
                    {previewMetrics.orderCount}
                  </div>
                </div>
                <div className="p-2 bg-white rounded-lg border border-slate-200/60 shadow-2xs">
                  <div className="text-[10px] text-slate-400">Sales Volume</div>
                  <div className="font-mono font-bold text-slate-800 text-xs sm:text-sm mt-0.5 truncate">
                    {formatCurrency(previewMetrics.totalSales)}
                  </div>
                </div>
                <div className="p-2 bg-white rounded-lg border border-slate-200/60 shadow-2xs">
                  <div className="text-[10px] text-slate-400">Commissions</div>
                  <div className="font-mono font-bold text-emerald-700 text-xs sm:text-sm mt-0.5 truncate">
                    {formatCurrency(previewMetrics.totalCommission)}
                  </div>
                </div>
              </div>
            </div>

            {downloaded && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold text-[11px]">CSV Report generated and downloaded successfully!</span>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={downloaded}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-xs transition-all disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>Download CSV Report</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
