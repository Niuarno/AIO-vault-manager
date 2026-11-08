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
    setCountdown(getTimeUntilDhakaMidnight());

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
          className={`inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-sm border border-emerald-200 ${className}`}
        >
          <Clock className="w-3.5 h-3.5 text-emerald-600 animate-spin motion-reduce:animate-none motion-reduce:animate-none" aria-hidden="true" />
          <span>Resets 12 AM</span>
        </span>
      );
    }
    return (
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-ink border border-ink-rule text-xs text-paper-2 font-mono ${className}`}
      >
        <Clock className="w-3.5 h-3.5 text-paper-2" aria-hidden="true" />
        <span>--:--:--</span>
      </div>
    );
  }

  const { hours, minutes, seconds, hh, mm, ss, totalSeconds } = countdown;

  const isFinalHour = totalSeconds < 3600; // Under 1 hour
  const isWarning = totalSeconds < 14400; // Under 4 hours

  const radius = 5.5;
  const circumference = 2 * Math.PI * radius;
  const remainingFraction = totalSeconds / 86400;
  const strokeOffset = circumference - remainingFraction * circumference;

  const tooltipText = `Daily reset occurs strictly at 12:00:00 AM Bangladesh Standard Time (Asia/Dhaka, GMT+6). Today's upsell quotas and commission tiers will refresh in ${hours}h ${minutes}m ${seconds}s.`;

  // --- Variant 1: KPI Badge (for Sales & Admin Dashboard Cards) ---
  if (variant === 'kpi') {
    return (
      <span
        title={tooltipText}
        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-sm border transition-colors select-none ${
          isFinalHour
            ? 'text-rose-800 bg-rose-50 border-rose-200'
            : isWarning
            ? 'text-amber-800 bg-amber-50 border-amber-200'
            : 'text-emerald-800 bg-emerald-50 border-emerald-200'
        } ${className}`}
      >
        {isFinalHour ? (
          <Zap className="w-3.5 h-3.5 text-rose-600" aria-hidden="true" />
        ) : (
          <Clock className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
        )}
        {showLabel && <span className="text-ink-muted">Reset in</span>}
        <span className="font-mono font-semibold tabular-nums text-ink">
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
          isFinalHour ? 'text-rose-600 font-semibold' : 'text-ink-muted'
        } ${className}`}
      >
        <Clock className="w-3 h-3 text-accent" aria-hidden="true" />
        <span>{hh}:{mm}:{ss}</span>
      </span>
    );
  }

  // --- Variant 3: Header Pill (Default for Noticeboard Bar) ---
  return (
    <div
      title={tooltipText}
      className={`group relative flex items-center gap-1.5 sm:gap-2 px-2.5 py-0.5 sm:py-1 rounded-sm text-xs font-normal transition-colors select-none border ${
        isFinalHour
          ? 'bg-rose-950 border-rose-700 text-rose-200'
          : isWarning
          ? 'bg-ink border-amber-600 text-amber-200'
          : 'bg-ink border-ink-rule text-paper-2'
      } ${className}`}
    >
      {/* Animated Circular Progress Ring + Clock */}
      <div className="relative flex items-center justify-center w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0">
        <svg
          className="w-full h-full -rotate-90 transform"
          viewBox="0 0 16 16"
          aria-hidden="true"
        >
          <circle
            cx="8"
            cy="8"
            r={radius}
            className="stroke-ink-rule"
            strokeWidth="1.5"
            fill="none"
          />
          <circle
            cx="8"
            cy="8"
            r={radius}
            className={`transition-[stroke-dashoffset] duration-1000 ease-linear ${
              isFinalHour
                ? 'stroke-rose-400'
                : isWarning
                ? 'stroke-amber-400'
                : 'stroke-accent-2'
            }`}
            strokeWidth="1.5"
            strokeDasharray={circumference}
            strokeDashoffset={strokeOffset}
            strokeLinecap="round"
            fill="none"
          />
        </svg>
        <span
          className={`absolute w-1 h-1 rounded-full ${
            isFinalHour
              ? 'bg-rose-400'
              : isWarning
              ? 'bg-amber-400'
              : 'bg-accent-2'
          }`}
          aria-hidden="true"
        />
      </div>

      {/* Label: Desktop/Tablet only */}
      {showLabel && (
        <span className="hidden sm:inline-flex items-center gap-1 text-xs text-paper-2 font-normal">
          <span>Reset in</span>
        </span>
      )}

      {/* Digits Display with Tabular Monospace */}
      <div className="flex items-center font-mono font-semibold text-xs tabular-nums">
        <span
          className={
            isFinalHour
              ? 'text-rose-200'
              : isWarning
              ? 'text-amber-200'
              : 'text-paper'
          }
        >
          {hh}
        </span>
        <span className="opacity-60 text-paper-2 px-[1px]">
          :
        </span>
        <span
          className={
            isFinalHour
              ? 'text-rose-200'
              : isWarning
              ? 'text-amber-200'
              : 'text-paper'
          }
        >
          {mm}
        </span>
        <span className="opacity-60 text-paper-2 px-[1px]">
          :
        </span>
        <span
          key={ss}
          className={`transition-colors inline-block ${
            isFinalHour
              ? 'text-rose-300'
              : isWarning
              ? 'text-amber-300'
              : 'text-accent-2'
          }`}
        >
          {ss}
        </span>
      </div>

      <span className="hidden xl:inline text-xs font-normal text-paper-2 bg-ink-rule px-1 py-0.2 rounded-sm border border-ink-rule">
        BST
      </span>
    </div>
  );
}
