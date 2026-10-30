'use client';

import React, { useState } from 'react';

export interface PieSliceData {
  label: string;
  value: number;
  count?: number;
  amount?: number;
  color: string;
  sublabel?: string;
}

interface InteractivePieChartProps {
  title: string;
  subtitle?: string;
  data: PieSliceData[];
  centerLabel?: string;
  centerValue?: string | number;
  formatValue?: (val: number) => string;
  metric?: 'count' | 'value';
  onMetricChange?: (metric: 'count' | 'value') => void;
  showMetricToggle?: boolean;
}

export default function InteractivePieChart({
  title,
  subtitle,
  data,
  centerLabel,
  centerValue,
  formatValue,
  metric: metricProp,
  onMetricChange,
  showMetricToggle = true,
}: InteractivePieChartProps) {
  const [internalMetric, setInternalMetric] = useState<'count' | 'value'>(metricProp || 'count');
  const activeMetric = metricProp !== undefined ? metricProp : internalMetric;
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const handleMetricToggle = (newMetric: 'count' | 'value') => {
    setInternalMetric(newMetric);
    if (onMetricChange) {
      onMetricChange(newMetric);
    }
  };

  const getItemValue = (item: PieSliceData) => {
    if (activeMetric === 'value') {
      return item.amount !== undefined ? item.amount : item.value;
    }
    return item.count !== undefined ? item.count : item.value;
  };

  const total = data.reduce((sum, d) => sum + (getItemValue(d) || 0), 0);
  const totalCount = data.reduce((sum, d) => sum + (d.count !== undefined ? d.count : (activeMetric === 'count' ? d.value : 0)), 0);
  const totalAmount = data.reduce((sum, d) => sum + (d.amount !== undefined ? d.amount : (activeMetric === 'value' ? d.value : 0)), 0);

  // If no data, show clean empty state
  if (total === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs flex flex-col items-center justify-center min-h-[300px] text-center">
        <div className="w-full flex items-center justify-between mb-2">
          <h4 className="text-sm font-bold text-slate-900">{title}</h4>
          {showMetricToggle && (
            <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200/80">
              <button
                type="button"
                onClick={() => handleMetricToggle('count')}
                className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                  activeMetric === 'count' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Orders
              </button>
              <button
                type="button"
                onClick={() => handleMetricToggle('value')}
                className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                  activeMetric === 'value' ? 'bg-emerald-600 text-white shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Value
              </button>
            </div>
          )}
        </div>
        {subtitle && <p className="text-xs text-slate-400 mb-4">{subtitle}</p>}
        <div className="w-36 h-36 rounded-full border-4 border-dashed border-slate-200 flex items-center justify-center text-xs text-slate-400 font-medium">
          No records yet
        </div>
      </div>
    );
  }

  // Calculate SVG arc paths for donut chart
  let cumulativeAngle = 0;
  const radius = 70;
  const strokeWidth = 24;
  const center = 90;
  const circumference = 2 * Math.PI * radius;

  const slices = data.map((item, idx) => {
    const sliceVal = getItemValue(item);
    const percentage = total > 0 ? sliceVal / total : 0;
    const strokeDasharray = `${percentage * circumference} ${circumference}`;
    const strokeDashoffset = -cumulativeAngle * circumference;
    cumulativeAngle += percentage;

    const pctNum = Math.round(percentage * 100);
    const pctDisplay = percentage > 0 && pctNum === 0 ? '<1%' : `${pctNum}%`;

    return {
      ...item,
      sliceVal,
      percentage,
      pctDisplay,
      strokeDasharray,
      strokeDashoffset,
      idx,
    };
  });

  const activeSlice = hoveredIndex !== null ? slices[hoveredIndex] : null;

  // Formatting helpers
  const defaultFormatValue = (val: number) => {
    if (activeMetric === 'value') {
      return `৳${Math.round(val).toLocaleString()}`;
    }
    return val.toLocaleString();
  };

  const formatter = formatValue || defaultFormatValue;

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-2xs flex flex-col justify-between transition-all hover:shadow-xs">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-slate-900">{title}</h4>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            {/* Metric Option Toggle */}
            {showMetricToggle && (
              <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => handleMetricToggle('count')}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                    activeMetric === 'count'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                  title="Show distribution by order count"
                >
                  <span>Orders</span>
                  <span className="text-[10px] text-slate-400 font-normal">#</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleMetricToggle('value')}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                    activeMetric === 'value'
                      ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                  title="Show distribution by monetary value (BDT)"
                >
                  <span>Value</span>
                  <span className={`text-[10px] ${activeMetric === 'value' ? 'text-emerald-100' : 'text-slate-400'} font-normal`}>৳</span>
                </button>
              </div>
            )}

            {/* Total Badge */}
            <span className="text-[11px] font-semibold text-slate-600 font-mono bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200/60 whitespace-nowrap">
              {activeMetric === 'value'
                ? `৳${Math.round(total).toLocaleString()} Total`
                : `${total.toLocaleString()} Total`}
            </span>
          </div>
        </div>
      </div>

      {/* SVG Donut */}
      <div className="relative my-4 flex items-center justify-center">
        <svg
          viewBox="0 0 180 180"
          className="w-44 h-44 transform -rotate-90 transition-transform duration-200"
        >
          {/* Background circle track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
          />

          {/* Slices */}
          {slices.map((slice) => {
            const isHovered = hoveredIndex === slice.idx;
            return (
              <circle
                key={slice.idx}
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke={slice.color}
                strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={slice.strokeDasharray}
                strokeDashoffset={slice.strokeDashoffset}
                strokeLinecap="butt"
                className="cursor-pointer transition-all duration-150"
                onMouseEnter={() => setHoveredIndex(slice.idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            );
          })}
        </svg>

        {/* Center Content / Tooltip Focus */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
          {activeSlice ? (
            <div className="animate-in fade-in zoom-in-95 duration-100 flex flex-col items-center">
              <span className="text-xl font-black text-slate-900 leading-none">
                {activeSlice.pctDisplay}
              </span>
              <span className="text-[11px] font-bold text-slate-700 block mt-1 truncate max-w-[110px]">
                {activeSlice.label}
              </span>
              {activeMetric === 'value' ? (
                <div className="mt-0.5">
                  <span className="text-xs font-mono font-bold text-emerald-600 block">
                    ৳{Math.round(activeSlice.amount ?? activeSlice.sliceVal).toLocaleString()}
                  </span>
                  {activeSlice.count !== undefined && (
                    <span className="text-[10px] font-mono text-slate-400 block">
                      {activeSlice.count.toLocaleString()} orders
                    </span>
                  )}
                </div>
              ) : (
                <div className="mt-0.5">
                  <span className="text-xs font-mono font-bold text-slate-800 block">
                    {(activeSlice.count ?? activeSlice.sliceVal).toLocaleString()} orders
                  </span>
                  {activeSlice.amount !== undefined && (
                    <span className="text-[10px] font-mono text-emerald-600 font-semibold block">
                      ৳{Math.round(activeSlice.amount).toLocaleString()}
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center">
              {centerValue !== undefined ? (
                <span className="text-xl font-black text-slate-900 leading-none tracking-tight">
                  {centerValue}
                </span>
              ) : activeMetric === 'value' ? (
                <span className="text-xl font-black text-slate-900 leading-none tracking-tight">
                  {total >= 1000000
                    ? `৳${(total / 1000000).toFixed(2)}M`
                    : total >= 100000
                    ? `৳${(total / 1000).toFixed(1)}k`
                    : `৳${Math.round(total).toLocaleString()}`}
                </span>
              ) : (
                <span className="text-xl font-black text-slate-900 leading-none tracking-tight">
                  {total.toLocaleString()}
                </span>
              )}
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-1">
                {centerLabel || (activeMetric === 'value' ? 'TOTAL VALUE' : 'TOTAL ORDERS')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Legend Grid */}
      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 text-xs">
        {slices.map((slice) => {
          const isHovered = hoveredIndex === slice.idx;
          const count = slice.count !== undefined ? slice.count : (activeMetric === 'count' ? slice.sliceVal : undefined);
          const amount = slice.amount !== undefined ? slice.amount : (activeMetric === 'value' ? slice.sliceVal : undefined);

          return (
            <div
              key={slice.idx}
              onMouseEnter={() => setHoveredIndex(slice.idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              className={`flex items-center space-x-2 p-1.5 rounded-lg cursor-pointer transition-colors ${
                isHovered ? 'bg-slate-100/90 font-semibold ring-1 ring-slate-200' : 'hover:bg-slate-50'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-2xs"
                style={{ backgroundColor: slice.color }}
              />
              <div className="min-w-0 flex-1 flex items-center justify-between gap-1">
                <span className="truncate text-slate-700 text-[11px]" title={slice.label}>
                  {slice.label}
                </span>
                <div className="text-right flex-shrink-0">
                  {activeMetric === 'value' ? (
                    <>
                      <span className="font-mono text-[10px] text-emerald-700 font-bold block leading-tight">
                        ৳{Math.round(amount ?? 0).toLocaleString()}
                      </span>
                      {count !== undefined && (
                        <span className="font-mono text-[9px] text-slate-400 font-medium block leading-none mt-0.5">
                          {count} {count === 1 ? 'order' : 'orders'}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="font-mono text-[10px] text-slate-800 font-bold block leading-tight">
                        {count !== undefined ? count.toLocaleString() : formatter(slice.value)}
                      </span>
                      {amount !== undefined && (
                        <span className="font-mono text-[9px] text-emerald-600 font-semibold block leading-none mt-0.5">
                          ৳{Math.round(amount).toLocaleString()}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
