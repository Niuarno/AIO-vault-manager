'use client';

import React, { useState, useEffect } from 'react';
import { Clock, Zap } from 'lucide-react';
import { getTimeUntilDhakaMidnight, DhakaCountdownInfo } from '@/lib/dateUtils';

interface DailyResetCountdownProps {
  variant?: 'header' | 'kpi' | 'compact';
  showLabel?: boolean;
  className?: string;
}

export default function DailyResetCountdown({
  variant = 'header',
  showLabel = true,
  className = '',
}: DailyResetCountdownProps) {
  const [mounted, setMounted] = useState(false);
  const [countdown, setCountdown] = useState<DhakaCountdownInfo | null>(null);

  useEffect(() => {
    setMounted(true);
    // Initial calculate
    setCountdown(getTimeUntilDhakaMidnight());

    // Update every second with high accuracy
    const timer = setInterval(() => {
      setCountdown(getTimeUntilDhakaMidnight());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // SSR skeleton to guarantee hydration match and zero layout shift
  if (!mounted || !countdown) {
    if (variant === 'kpi') {
      return (
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60 ${className}`}
        >
          <Clock className="w-3 h-3 text-emerald-600 animate-spin" />
          <span>Resets 12 AM</span>
        </span>
      );
    }
    return (
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] text-slate-400 font-mono ${className}`}
      >
        <Clock className="w-3 h-3 text-slate-500" />
        <span>--:--:--</span>
      </div>
    );
  }

  const { hours, minutes, seconds, hh, mm, ss, totalSeconds, progressPercent } = countdown;

  // Urgency states based on time left until Dhaka midnight (GMT+6)
  const isFinalHour = totalSeconds < 3600; // Under 1 hour
  const isWarning = totalSeconds < 14400; // Under 4 hours

  // Smooth circular SVG progress ring math (radius = 5.5, circumference ~ 34.55)
  const radius = 5.5;
  const circumference = 2 * Math.PI * radius;
  // remaining percentage of the 24-hr day
  const remainingFraction = totalSeconds / 86400;
  const strokeOffset = circumference - remainingFraction * circumference;

  const tooltipText = `Daily reset occurs strictly at 12:00:00 AM Bangladesh Standard Time (Asia/Dhaka, GMT+6). Today's upsell quotas and commission tiers will refresh in ${hours}h ${minutes}m ${seconds}s.`;

  // --- Variant 1: KPI Badge (for Sales & Admin Dashboard Cards) ---
  if (variant === 'kpi') {
    return (
      <span
        title={tooltipText}
        className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border transition-all duration-300 select-none ${
          isFinalHour
            ? 'text-rose-800 bg-rose-50 border-rose-200/80 animate-pulse'
            : isWarning
            ? 'text-amber-800 bg-amber-50 border-amber-200/80'
            : 'text-emerald-800 bg-emerald-50 border-emerald-200/60'
        } ${className}`}
      >
        {isFinalHour ? (
          <Zap className="w-3 h-3 text-rose-600 animate-bounce" />
        ) : (
          <Clock className="w-3 h-3 text-emerald-600" />
        )}
        {showLabel && <span className="opacity-90">Reset in</span>}
        <span className="font-mono font-bold tabular-nums tracking-tight">
          {hh}:{mm}:{ss}
        </span>
      </span>
    );
  }

  // --- Variant 2: Compact / Minimal ---
  if (variant === 'compact') {
    return (
      <span
        title={tooltipText}
        className={`inline-flex items-center gap-1 font-mono text-xs tabular-nums ${
          isFinalHour ? 'text-rose-400 font-bold animate-pulse' : 'text-slate-300'
        } ${className}`}
      >
        <Clock className="w-3 h-3 text-amber-400" />
        <span>{hh}:{mm}:{ss}</span>
      </span>
    );
  }

  // --- Variant 3: Header Pill (Default for Noticeboard Bar) ---
  return (
    <div
      title={tooltipText}
      className={`group relative flex items-center gap-1.5 sm:gap-2 px-2.5 py-0.5 sm:py-1 rounded-md text-[11px] sm:text-xs font-medium transition-all duration-500 select-none shadow-xs border ${
        isFinalHour
          ? 'bg-rose-950/70 border-rose-500/50 text-rose-200 shadow-[0_0_12px_rgba(244,63,94,0.3)] animate-pulse'
          : isWarning
          ? 'bg-amber-950/40 border-amber-500/40 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
          : 'bg-slate-900/90 hover:bg-slate-900 border-slate-700/60 hover:border-slate-600 text-slate-200'
      } ${className}`}
    >
      {/* Smooth Animated Circular Progress Ring + Clock */}
      <div className="relative flex items-center justify-center w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0">
        <svg
          className="w-full h-full -rotate-90 transform"
          viewBox="0 0 16 16"
        >
          {/* Background circle track */}
          <circle
            cx="8"
            cy="8"
            r={radius}
            className="stroke-slate-800"
            strokeWidth="1.5"
            fill="none"
          />
          {/* Animated active progress circle */}
          <circle
            cx="8"
            cy="8"
            r={radius}
            className={`transition-[stroke-dashoffset] duration-1000 ease-linear ${
              isFinalHour
                ? 'stroke-rose-400'
                : isWarning
                ? 'stroke-amber-400'
                : 'stroke-emerald-400'
            }`}
            strokeWidth="1.5"
            strokeDasharray={circumference}
            strokeDashoffset={strokeOffset}
            strokeLinecap="round"
            fill="none"
          />
        </svg>
        {/* Pulsing center dot */}
        <span
          className={`absolute w-1 h-1 rounded-full ${
            isFinalHour
              ? 'bg-rose-400 animate-ping'
              : isWarning
              ? 'bg-amber-400 animate-pulse'
              : 'bg-emerald-400'
          }`}
        />
      </div>

      {/* Label: Desktop/Tablet only */}
      {showLabel && (
        <span className="hidden sm:inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-slate-400">
          <span>Reset in</span>
        </span>
      )}

      {/* Digits Display with Tabular Monospace & Pulsing Separators */}
      <div className="flex items-center font-mono font-bold text-xs tracking-wider tabular-nums">
        <span
          className={
            isFinalHour
              ? 'text-rose-200 font-extrabold'
              : isWarning
              ? 'text-amber-200'
              : 'text-slate-100'
          }
        >
          {hh}
        </span>
        <span className="opacity-60 text-slate-400 animate-[pulse_1s_ease-in-out_infinite] px-[1px]">
          :
        </span>
        <span
          className={
            isFinalHour
              ? 'text-rose-200 font-extrabold'
              : isWarning
              ? 'text-amber-200'
              : 'text-slate-100'
          }
        >
          {mm}
        </span>
        <span className="opacity-60 text-slate-400 animate-[pulse_1s_ease-in-out_infinite] px-[1px]">
          :
        </span>
        <span
          key={ss}
          className={`transition-all duration-300 inline-block ${
            isFinalHour
              ? 'text-rose-300 font-extrabold scale-105'
              : isWarning
              ? 'text-amber-300'
              : 'text-amber-400'
          }`}
        >
          {ss}
        </span>
      </div>

      {/* Subtle indicator of GMT+6 */}
      <span className="hidden xl:inline text-[9px] font-semibold text-slate-400 bg-slate-800/80 px-1 py-0.2 rounded border border-slate-700/50">
        BST
      </span>
    </div>
  );
}
