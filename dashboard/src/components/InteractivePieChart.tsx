'use client';

import React, { useState } from 'react';

export interface PieSliceData {
  label: string;
  value: number;
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
}

export default function InteractivePieChart({
  title,
  subtitle,
  data,
  centerLabel,
  centerValue,
  formatValue = (v) => String(v),
}: InteractivePieChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const total = data.reduce((sum, d) => sum + d.value, 0);

  // If no data, show clean empty state
  if (total === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs flex flex-col items-center justify-center min-h-[300px] text-center">
        <h4 className="text-sm font-bold text-slate-900 mb-1">{title}</h4>
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
    const percentage = item.value / total;
    const strokeDasharray = `${percentage * circumference} ${circumference}`;
    const strokeDashoffset = -cumulativeAngle * circumference;
    cumulativeAngle += percentage;

    return {
      ...item,
      percentage: Math.round(percentage * 100),
      strokeDasharray,
      strokeDashoffset,
      idx,
    };
  });

  const activeSlice = hoveredIndex !== null ? slices[hoveredIndex] : null;

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-2xs flex flex-col justify-between transition-all hover:shadow-xs">
      <div>
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-900">{title}</h4>
          <span className="text-[11px] font-semibold text-slate-400 font-mono">
            {total} Total
          </span>
        </div>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
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
            <div className="animate-in fade-in zoom-in-95 duration-100">
              <span className="text-lg font-black text-slate-900 leading-none">
                {activeSlice.percentage}%
              </span>
              <span className="text-[10px] font-bold text-slate-600 block mt-0.5 truncate max-w-[90px]">
                {activeSlice.label}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {formatValue(activeSlice.value)}
              </span>
            </div>
          ) : (
            <div>
              <span className="text-xl font-black text-slate-900 leading-none">
                {centerValue !== undefined ? centerValue : total}
              </span>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mt-0.5">
                {centerLabel || 'Total'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Legend Grid */}
      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 text-xs">
        {slices.map((slice) => {
          const isHovered = hoveredIndex === slice.idx;
          return (
            <div
              key={slice.idx}
              onMouseEnter={() => setHoveredIndex(slice.idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              className={`flex items-center space-x-2 p-1.5 rounded-lg cursor-pointer transition-colors ${
                isHovered ? 'bg-slate-100/80 font-bold' : 'hover:bg-slate-50'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: slice.color }}
              />
              <div className="min-w-0 flex-1 flex items-center justify-between">
                <span className="truncate text-slate-700 text-[11px]">{slice.label}</span>
                <span className="font-mono text-[10px] text-slate-500 font-semibold ml-1">
                  {formatValue(slice.value)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}