'use client';

import React, { useState } from 'react';
import { TrendingUp, Award, Calendar, BarChart3 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export interface DailyStaffStat {
  dateKey: string;     // e.g. '2026-09-18'
  label: string;       // e.g. 'Fri 18'
  ordersCount: number;
  salesVolume: number;
  commissionEarned: number;
}

interface StaffPerformanceGraphProps {
  staffName: string;
  dailyStats: DailyStaffStat[];
  currency?: string;
}

export default function StaffPerformanceGraph({
  staffName,
  dailyStats,
  currency = 'BDT',
}: StaffPerformanceGraphProps) {
  const [metric, setMetric] = useState<'commission' | 'orders'>('commission');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const maxCommission = Math.max(1, ...dailyStats.map((d) => d.commissionEarned));
  const maxOrders = Math.max(1, ...dailyStats.map((d) => d.ordersCount));

  const totalCommission = dailyStats.reduce((sum, d) => sum + d.commissionEarned, 0);
  const totalOrders = dailyStats.reduce((sum, d) => sum + d.ordersCount, 0);

  // Helper to get compact label on mobile (e.g. "Fri" or "18")
  const getShortLabel = (label: string) => {
    // If label is "Fri, 9/18" or "Fri 18", extract short day
    const parts = label.split(/[\s,]+/);
    if (parts.length > 0) return parts[0];
    return label;
  };

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-4 overflow-hidden w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">{staffName}&rsquo;s Performance Trend</h4>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Daily commission earnings and orders closed over the last {dailyStats.length} days
          </p>
        </div>

        {/* Metric Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60 text-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setMetric('commission')}
            className={`px-3 py-1 rounded-lg font-semibold transition-all ${
              metric === 'commission'
                ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Commission ({formatCurrency(totalCommission, currency)})
          </button>
          <button
            type="button"
            onClick={() => setMetric('orders')}
            className={`px-3 py-1 rounded-lg font-semibold transition-all ${
              metric === 'orders'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Orders ({totalOrders})
          </button>
        </div>
      </div>

      {/* Bar Chart Visualization */}
      <div className="relative pt-6 overflow-hidden w-full">
        {/* Hover Tooltip Box */}
        {hoveredIndex !== null && dailyStats[hoveredIndex] && (
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white text-[11px] px-3 py-1.5 rounded-lg shadow-md pointer-events-none z-10 flex items-center space-x-2 animate-in fade-in zoom-in-95 duration-100 whitespace-nowrap">
            <span className="font-semibold text-slate-200">{dailyStats[hoveredIndex].label}:</span>
            <span className="text-emerald-400 font-mono font-bold">
              {formatCurrency(dailyStats[hoveredIndex].commissionEarned, currency)}
            </span>
            <span className="text-slate-500">&middot;</span>
            <span className="text-slate-300 font-mono">
              {dailyStats[hoveredIndex].ordersCount} orders
            </span>
          </div>
        )}

        <div className="flex items-end justify-between h-36 sm:h-44 gap-1 sm:gap-2 px-1 border-b border-slate-200 w-full overflow-hidden">
          {dailyStats.map((stat, idx) => {
            const isHovered = hoveredIndex === idx;
            const value = metric === 'commission' ? stat.commissionEarned : stat.ordersCount;
            const maxValue = metric === 'commission' ? maxCommission : maxOrders;
            const heightPercent = Math.max(10, Math.round((value / maxValue) * 100));

            const barColor =
              metric === 'commission'
                ? isHovered
                  ? 'bg-emerald-600'
                  : 'bg-emerald-500/80 hover:bg-emerald-600'
                : isHovered
                ? 'bg-slate-900'
                : 'bg-slate-700 hover:bg-slate-900';

            return (
              <div
                key={stat.dateKey || idx}
                className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer min-w-0"
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => setHoveredIndex(hoveredIndex === idx ? null : idx)}
              >
                <div
                  className={`w-full max-w-[24px] rounded-t-md transition-all duration-200 ${barColor}`}
                  style={{ height: `${heightPercent}%` }}
                />
                <span className="text-[10px] text-slate-400 font-medium mt-2 truncate w-full text-center group-hover:text-slate-800">
                  <span className="sm:hidden">{getShortLabel(stat.label)}</span>
                  <span className="hidden sm:inline">{stat.label}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}