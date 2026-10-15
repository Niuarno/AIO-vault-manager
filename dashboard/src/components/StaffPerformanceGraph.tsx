'use client';

import React, { useState } from 'react';
import { TrendingUp, Calendar, ChevronDown } from 'lucide-react';
import { formatCurrency, getDhakaParts } from '@/lib/utils';

export interface DailyStaffStat {
  dateKey: string;     // e.g. '2026-09-18'
  label: string;       // e.g. 'Fri 18'
  dayNumber: number;   // 1 to 31
  ordersCount: number;
  salesVolume: number;
  commissionEarned: number;
}

interface StaffPerformanceGraphProps {
  staffName: string;
  dailyStats: DailyStaffStat[];
  currency?: string;
  selectedYear: number;
  selectedMonth: number; // 0-indexed: 0 = Jan, 11 = Dec
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
  yearOptions?: number[];
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function StaffPerformanceGraph({
  staffName,
  dailyStats,
  currency = 'BDT',
  selectedYear,
  selectedMonth,
  onYearChange,
  onMonthChange,
  yearOptions,
}: StaffPerformanceGraphProps) {
  const [metric, setMetric] = useState<'commission' | 'orders'>('commission');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const dhakaParts = getDhakaParts();
  const currentYear = dhakaParts.year;
  const currentMonth = dhakaParts.month;
  const todayDate = dhakaParts.day;

  const years = yearOptions || [currentYear, currentYear - 1, currentYear - 2];

  const maxCommission = Math.max(1, ...dailyStats.map((d) => d.commissionEarned));
  const maxOrders = Math.max(1, ...dailyStats.map((d) => d.ordersCount));

  const totalCommission = dailyStats.reduce((sum, d) => sum + d.commissionEarned, 0);
  const totalOrders = dailyStats.reduce((sum, d) => sum + d.ordersCount, 0);

  const isCurrentMonthView = selectedYear === currentYear && selectedMonth === currentMonth;

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-4 overflow-hidden w-full">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">{staffName}&rsquo;s Monthly Performance</h4>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Daily breakdown for <span className="font-semibold text-slate-700">{MONTHS[selectedMonth]} {selectedYear}</span> ({dailyStats.length} days recorded)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Year Selector */}
          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => onYearChange(Number(e.target.value))}
              aria-label="Filter by Year"
              className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl pl-3 pr-7 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Month Selector */}
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => onMonthChange(Number(e.target.value))}
              aria-label="Filter by Month"
              className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl pl-3 pr-7 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
            >
              {MONTHS.map((name, idx) => (
                <option key={idx} value={idx}>
                  {name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Metric Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60 text-xs">
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
      </div>

      {/* Monthly Bar Chart Visualization */}
      <div className="relative pt-6 overflow-x-auto pb-1">
        {/* Hover Tooltip Box */}
        {hoveredIndex !== null && dailyStats[hoveredIndex] && (
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white text-[11px] px-3 py-1.5 rounded-lg shadow-md pointer-events-none z-10 flex items-center space-x-2 animate-in fade-in zoom-in-95 duration-100 whitespace-nowrap">
            <span className="font-semibold text-slate-200">
              {MONTHS[selectedMonth]} {dailyStats[hoveredIndex].dayNumber}, {selectedYear}:
            </span>
            <span className="text-emerald-400 font-mono font-bold">
              {formatCurrency(dailyStats[hoveredIndex].commissionEarned, currency)}
            </span>
            <span className="text-slate-500">&middot;</span>
            <span className="text-slate-300 font-mono">
              {dailyStats[hoveredIndex].ordersCount} orders
            </span>
          </div>
        )}

        {/* Chart Bars - Min width 640px on mobile to guarantee smooth horizontal scrolling without squeezing */}
        <div className="min-w-[620px] sm:min-w-0">
          <div className="flex items-end justify-between h-36 sm:h-44 gap-1 px-1 border-b border-slate-200 w-full">
            {dailyStats.map((stat, idx) => {
              const isHovered = hoveredIndex === idx;
              const isToday = isCurrentMonthView && stat.dayNumber === todayDate;
              const value = metric === 'commission' ? stat.commissionEarned : stat.ordersCount;
              const maxValue = metric === 'commission' ? maxCommission : maxOrders;
              const heightPercent = value > 0 ? Math.max(12, Math.round((value / maxValue) * 100)) : 4;

              const barColor =
                metric === 'commission'
                  ? isHovered
                    ? 'bg-emerald-600'
                    : isToday
                    ? 'bg-emerald-500 ring-2 ring-emerald-500/30'
                    : value > 0
                    ? 'bg-emerald-500/80 hover:bg-emerald-600'
                    : 'bg-slate-100 hover:bg-slate-200'
                  : isHovered
                  ? 'bg-slate-900'
                  : isToday
                  ? 'bg-slate-800 ring-2 ring-slate-800/30'
                  : value > 0
                  ? 'bg-slate-700 hover:bg-slate-900'
                  : 'bg-slate-100 hover:bg-slate-200';

              return (
                <div
                  key={stat.dateKey || idx}
                  className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer min-w-0"
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onClick={() => setHoveredIndex(hoveredIndex === idx ? null : idx)}
                >
                  <div
                    className={`w-full max-w-[18px] rounded-t-sm transition-all duration-200 ${barColor}`}
                    style={{ height: `${heightPercent}%` }}
                  />
                  <span className={`text-[10px] font-mono mt-2 truncate w-full text-center ${
                    isToday ? 'font-bold text-emerald-800 underline' : 'text-slate-400 group-hover:text-slate-800'
                  }`}>
                    {stat.dayNumber}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1.5 px-1 font-medium">
            <span>Day 1 ({MONTHS[selectedMonth]} 1)</span>
            {isCurrentMonthView && (
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Today (Day {todayDate})
              </span>
            )}
            <span>Day {dailyStats.length} ({MONTHS[selectedMonth]} {dailyStats.length})</span>
          </div>
        </div>
      </div>
    </div>
  );
}