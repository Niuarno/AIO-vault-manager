'use client';

import React, { useState } from 'react';
import { TrendingUp, ShoppingBag, Award, Calendar } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export interface DailyStaffStat {
  dateKey: string;     // e.g. '2026-09-18'
  label: string;       // e.g. 'Today' or 'Fri 18'
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

  return (
    <div className="bg-slate-900 rounded-xl p-5 border border-slate-800 shadow-xl shadow-black/40 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-indigo-400" />
            <h4 className="text-sm font-bold text-slate-100">{staffName}&rsquo;s Performance Trend</h4>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Daily commission earnings and orders closed over the last {dailyStats.length} days
          </p>
        </div>

        {/* Metric Switcher */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setMetric('commission')}
            className={`px-3 py-1 rounded-lg font-bold transition-all ${
              metric === 'commission'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/80 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Commission ({formatCurrency(totalCommission, currency)})
          </button>
          <button
            type="button"
            onClick={() => setMetric('orders')}
            className={`px-3 py-1 rounded-lg font-bold transition-all ${
              metric === 'orders'
                ? 'bg-indigo-950 text-indigo-300 border border-indigo-800/80 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Orders ({totalOrders})
          </button>
        </div>
      </div>

      {/* Bar Chart Visualization */}
      <div className="relative pt-6">
        {/* Hover Tooltip Box */}
        {hoveredIndex !== null && dailyStats[hoveredIndex] && (
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white text-[11px] px-3 py-1.5 rounded-lg shadow-md pointer-events-none z-10 flex items-center space-x-2 animate-in fade-in zoom-in-95 duration-100">
            <span className="font-bold text-slate-200">{dailyStats[hoveredIndex].label}:</span>
            <span className="text-emerald-400 font-mono font-bold">
              {formatCurrency(dailyStats[hoveredIndex].commissionEarned, currency)}
            </span>
            <span className="text-slate-400">&middot;</span>
            <span className="text-slate-300 font-mono">
              {dailyStats[hoveredIndex].ordersCount} order(s)
            </span>
          </div>
        )}

        <div className="flex items-end justify-between h-40 gap-1.5 sm:gap-3 px-2 border-b border-slate-800">
          {dailyStats.map((stat, idx) => {
            const isHovered = hoveredIndex === idx;
            const value = metric === 'commission' ? stat.commissionEarned : stat.ordersCount;
            const maxValue = metric === 'commission' ? maxCommission : maxOrders;
            const heightPercent = Math.max(8, Math.round((value / maxValue) * 100));

            const barColor =
              metric === 'commission'
                ? isHovered
                  ? 'bg-emerald-400 shadow-md shadow-emerald-500/30'
                  : 'bg-emerald-600/70 hover:bg-emerald-500'
                : isHovered
                ? 'bg-indigo-400 shadow-md shadow-indigo-500/30'
                : 'bg-indigo-600/70 hover:bg-indigo-500';

            return (
              <div
                key={stat.dateKey || idx}
                className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div
                  className={`w-full max-w-[28px] rounded-t-md transition-all duration-200 ${barColor}`}
                  style={{ height: `${heightPercent}%` }}
                />
                <span className="text-[10px] text-slate-500 font-mono mt-2 truncate w-full text-center group-hover:text-slate-200">
                  {stat.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}