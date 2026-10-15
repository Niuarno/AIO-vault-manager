'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Globe,
  Clock,
  Check,
  RotateCcw,
} from 'lucide-react';
import {
  META_DATE_PRESETS,
  MetaPresetKey,
  MetaDateRangeResult,
  getMetaPresetDateRange,
  formatDhakaDisplayDate,
  parseDhakaDateInput,
  addDhakaDays,
  diffDhakaDays,
  getDhakaParts,
  getDhakaDateString,
} from '@/lib/dateUtils';

export interface MetaDateRangeValue {
  preset: MetaPresetKey;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  compare: boolean;
  compareStartDate?: string;
  compareEndDate?: string;
}

interface MetaDateRangePickerProps {
  value: MetaDateRangeValue;
  onChange: (newValue: MetaDateRangeValue & { label: string }) => void;
  align?: 'left' | 'right';
  className?: string;
}

export default function MetaDateRangePicker({
  value,
  onChange,
  align = 'right',
  className = '',
}: MetaDateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Draft state while popover is open
  const [draftPreset, setDraftPreset] = useState<MetaPresetKey>(value.preset);
  const [draftStart, setDraftStart] = useState<string>(value.startDate);
  const [draftEnd, setDraftEnd] = useState<string>(value.endDate);
  const [draftCompare, setDraftCompare] = useState<boolean>(value.compare);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [isSelectingEnd, setIsSelectingEnd] = useState<boolean>(false);

  // Input text drafts
  const [inputStartText, setInputStartText] = useState<string>(
    formatDhakaDisplayDate(value.startDate)
  );
  const [inputEndText, setInputEndText] = useState<string>(
    formatDhakaDisplayDate(value.endDate)
  );

  // Current Dhaka today for reference ring
  const dhakaToday = useMemo(() => getDhakaDateString(), []);

  // Left month of dual calendar (right month is left month + 1)
  const [viewYear, setViewYear] = useState<number>(() => {
    const [y] = value.endDate.split('-').map(Number);
    return y || 2026;
  });
  const [viewMonth, setViewMonth] = useState<number>(() => {
    const [, m] = value.endDate.split('-').map(Number);
    // Show the month prior on left so endDate is in right month if possible
    return Math.max(0, (m || 8) - 2);
  });

  // Sync draft with incoming value when opened
  useEffect(() => {
    if (isOpen) {
      setDraftPreset(value.preset);
      setDraftStart(value.startDate);
      setDraftEnd(value.endDate);
      setDraftCompare(value.compare);
      setInputStartText(formatDhakaDisplayDate(value.startDate));
      setInputEndText(formatDhakaDisplayDate(value.endDate));
      setIsSelectingEnd(false);
      setHoverDate(null);

      // Center view around endDate
      const [ey, em] = value.endDate.split('-').map(Number);
      if (ey && em) {
        setViewYear(em === 1 ? ey - 1 : ey);
        setViewMonth(em === 1 ? 11 : em - 2);
      }
    }
  }, [isOpen, value]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle Preset Selection
  const handleSelectPreset = (key: MetaPresetKey) => {
    setDraftPreset(key);
    setIsSelectingEnd(false);
    setHoverDate(null);

    if (key === 'custom') {
      return;
    }

    const computed = getMetaPresetDateRange(key, new Date(), draftCompare);
    setDraftStart(computed.startDate);
    setDraftEnd(computed.endDate);
    setInputStartText(formatDhakaDisplayDate(computed.startDate));
    setInputEndText(formatDhakaDisplayDate(computed.endDate));

    // Shift view to display the end month
    const [ey, em] = computed.endDate.split('-').map(Number);
    if (ey && em) {
      setViewYear(em === 1 ? ey - 1 : ey);
      setViewMonth(em === 1 ? 11 : em - 2);
    }
  };

  // Dual Month Navigation
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((prev) => prev - 1);
      setViewMonth(11);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((prev) => prev + 1);
      setViewMonth(0);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  // Calculate Month 1 & Month 2
  const month1 = useMemo(() => {
    return { year: viewYear, month: viewMonth };
  }, [viewYear, viewMonth]);

  const month2 = useMemo(() => {
    if (viewMonth === 11) {
      return { year: viewYear + 1, month: 0 };
    }
    return { year: viewYear, month: viewMonth + 1 };
  }, [viewYear, viewMonth]);

  // Handle Calendar Day Click
  const handleDayClick = (dateStr: string) => {
    setDraftPreset('custom');

    if (!isSelectingEnd) {
      // First click: sets start date, start listening for end date
      setDraftStart(dateStr);
      setDraftEnd(dateStr);
      setInputStartText(formatDhakaDisplayDate(dateStr));
      setInputEndText(formatDhakaDisplayDate(dateStr));
      setIsSelectingEnd(true);
    } else {
      // Second click: completes range
      if (dateStr < draftStart) {
        setDraftEnd(draftStart);
        setDraftStart(dateStr);
        setInputStartText(formatDhakaDisplayDate(dateStr));
        setInputEndText(formatDhakaDisplayDate(draftStart));
      } else {
        setDraftEnd(dateStr);
        setInputEndText(formatDhakaDisplayDate(dateStr));
      }
      setIsSelectingEnd(false);
      setHoverDate(null);
    }
  };

  // Compare Range Calculation
  const compareRange = useMemo(() => {
    if (!draftCompare) return null;
    const daysCount = diffDhakaDays(draftStart, draftEnd);
    const cEnd = addDhakaDays(draftStart, -1);
    const cStart = addDhakaDays(cEnd, -(daysCount - 1));
    return { startDate: cStart, endDate: cEnd };
  }, [draftCompare, draftStart, draftEnd]);

  // Handle Update / Apply
  const handleApply = () => {
    let finalStart = draftStart;
    let finalEnd = draftEnd;
    if (finalStart > finalEnd) {
      const temp = finalStart;
      finalStart = finalEnd;
      finalEnd = temp;
    }

    const presetObj = META_DATE_PRESETS.find((p) => p.key === draftPreset);
    let label = presetObj ? presetObj.label : 'Custom';
    if (draftPreset === 'custom') {
      label = `${formatDhakaDisplayDate(finalStart)} – ${formatDhakaDisplayDate(finalEnd)}`;
    }

    let compareStartDate: string | undefined;
    let compareEndDate: string | undefined;

    if (draftCompare && compareRange) {
      compareStartDate = compareRange.startDate;
      compareEndDate = compareRange.endDate;
    }

    onChange({
      preset: draftPreset,
      startDate: finalStart,
      endDate: finalEnd,
      compare: draftCompare,
      compareStartDate,
      compareEndDate,
      label,
    });

    setIsOpen(false);
  };

  // Format trigger label
  const triggerLabel = useMemo(() => {
    const presetObj = META_DATE_PRESETS.find((p) => p.key === value.preset);
    const rangeText = `${formatDhakaDisplayDate(value.startDate)} – ${formatDhakaDisplayDate(value.endDate)}`;
    if (value.preset === 'custom' || !presetObj) {
      return rangeText;
    }
    return `${presetObj.label}: ${rangeText}`;
  }, [value]);

  // Render a Single Month Calendar
  const renderCalendarMonth = (
    year: number,
    month: number,
    showLeftNav: boolean,
    showRightNav: boolean
  ) => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = monthNames[month];

    // First day of month day-of-week (0 = Sun, 6 = Sat)
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Active range boundaries taking hover into account
    let effectiveStart = draftStart;
    let effectiveEnd = draftEnd;

    if (isSelectingEnd && hoverDate) {
      if (hoverDate < draftStart) {
        effectiveStart = hoverDate;
        effectiveEnd = draftStart;
      } else {
        effectiveStart = draftStart;
        effectiveEnd = hoverDate;
      }
    }

    const days = [];
    // Blank padding slots
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(<div key={`blank-${i}`} className="w-8 h-8 sm:w-9 sm:h-9" />);
    }

    // Month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = String(d).padStart(2, '0');
      const mStr = String(month + 1).padStart(2, '0');
      const fullDateStr = `${year}-${mStr}-${dayStr}`;

      const isStart = fullDateStr === effectiveStart;
      const isEnd = fullDateStr === effectiveEnd;
      const isInRange = fullDateStr > effectiveStart && fullDateStr < effectiveEnd;
      const isToday = fullDateStr === dhakaToday;

      // Comparison highlight
      const isInCompare =
        draftCompare &&
        compareRange &&
        fullDateStr >= compareRange.startDate &&
        fullDateStr <= compareRange.endDate;

      let cellBg = '';
      let textStyle = 'text-slate-800 hover:bg-slate-100';

      if (isStart && isEnd) {
        cellBg = 'bg-blue-600 text-white font-bold rounded-full';
        textStyle = 'text-white';
      } else if (isStart) {
        cellBg = 'bg-blue-600 text-white font-bold rounded-l-full';
        textStyle = 'text-white';
      } else if (isEnd) {
        cellBg = 'bg-blue-600 text-white font-bold rounded-r-full';
        textStyle = 'text-white';
      } else if (isInRange) {
        cellBg = 'bg-blue-50 text-blue-900 font-medium';
        textStyle = 'text-blue-900';
      } else if (isInCompare) {
        cellBg = 'bg-amber-50/80 text-amber-900 border-b border-dashed border-amber-300';
        textStyle = 'text-amber-900';
      }

      days.push(
        <div
          key={fullDateStr}
          className={`relative w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center p-0.5 cursor-pointer ${
            isInRange ? 'bg-blue-50' : ''
          }`}
          onClick={() => handleDayClick(fullDateStr)}
          onMouseEnter={() => {
            if (isSelectingEnd) setHoverDate(fullDateStr);
          }}
        >
          <button
            type="button"
            className={`w-full h-full flex items-center justify-center text-xs transition-colors relative ${cellBg} ${textStyle} ${
              isToday && !isStart && !isEnd
                ? 'ring-1 ring-slate-900 font-bold'
                : ''
            }`}
          >
            {d}
          </button>
        </div>
      );
    }

    return (
      <div className="w-[240px] sm:w-[264px] flex-shrink-0">
        {/* Header */}
        <div className="flex items-center justify-between h-9 mb-2">
          {showLeftNav ? (
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          ) : (
            <div className="w-6" />
          )}

          <div className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight">
            {monthName} {year}
          </div>

          {showRightNav ? (
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <div className="w-6" />
          )}
        </div>

        {/* Days of Week */}
        <div className="grid grid-cols-7 text-center mb-1 text-[11px] font-semibold text-slate-400">
          <div>S</div>
          <div>M</div>
          <div>T</div>
          <div>W</div>
          <div>T</div>
          <div>F</div>
          <div>S</div>
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 text-center">{days}</div>
      </div>
    );
  };

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-semibold shadow-2xs transition-all hover:border-slate-400"
      >
        <CalendarIcon className="w-4 h-4 text-blue-600 flex-shrink-0" />
        <span className="truncate max-w-[220px] sm:max-w-[320px]">
          {triggerLabel}
        </span>
        {value.compare && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
            vs Prior
          </span>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Meta Ads Manager Style Popover */}
      {isOpen && (
        <div
          className={`absolute top-full mt-1.5 z-50 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-100 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
          style={{ width: 'min(92vw, 760px)' }}
        >
          <div className="flex flex-col md:flex-row">
            {/* Left Sidebar Presets */}
            <div className="w-full md:w-48 border-b md:border-b-0 md:border-r border-slate-200 p-2 sm:p-3 bg-slate-50/50 flex-shrink-0 max-h-48 md:max-h-[380px] overflow-y-auto">
              <div className="space-y-0.5">
                {META_DATE_PRESETS.map((p) => {
                  const isSelected = draftPreset === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => handleSelectPreset(p.key)}
                      className={`w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors flex items-center justify-between ${
                        isSelected
                          ? 'bg-blue-50 text-blue-700 font-bold'
                          : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 font-medium'
                      }`}
                    >
                      <span>{p.label}</span>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-blue-600 ml-1 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Calendar Area */}
            <div className="flex-1 flex flex-col p-4">
              {/* Top Controls Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 mb-3">
                {/* Compare Checkbox */}
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-700 hover:text-slate-900">
                    <input
                      type="checkbox"
                      checked={draftCompare}
                      onChange={(e) => setDraftCompare(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                    />
                    <span>Compare</span>
                  </label>
                  {draftCompare && compareRange && (
                    <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
                      Previous: {formatDhakaDisplayDate(compareRange.startDate)} –{' '}
                      {formatDhakaDisplayDate(compareRange.endDate)}
                    </span>
                  )}
                </div>

                {/* Preset & Date Inputs */}
                <div className="flex items-center gap-1.5 ml-auto">
                  <input
                    type="text"
                    value={inputStartText}
                    onChange={(e) => {
                      setInputStartText(e.target.value);
                      const parsed = parseDhakaDateInput(e.target.value);
                      if (parsed) {
                        setDraftStart(parsed);
                        setDraftPreset('custom');
                      }
                    }}
                    placeholder="Aug 24, 2026"
                    className="w-28 sm:w-32 px-2.5 py-1 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-md shadow-2xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="text-slate-400 font-bold text-xs">–</span>
                  <input
                    type="text"
                    value={inputEndText}
                    onChange={(e) => {
                      setInputEndText(e.target.value);
                      const parsed = parseDhakaDateInput(e.target.value);
                      if (parsed) {
                        setDraftEnd(parsed);
                        setDraftPreset('custom');
                      }
                    }}
                    placeholder="Aug 30, 2026"
                    className="w-28 sm:w-32 px-2.5 py-1 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-md shadow-2xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Dual Month Calendar View */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 py-2 overflow-x-auto">
                {renderCalendarMonth(month1.year, month1.month, true, false)}
                {renderCalendarMonth(month2.year, month2.month, false, true)}
              </div>
            </div>
          </div>

          {/* Bottom Footer Bar */}
          <div className="border-t border-slate-200 bg-slate-50/80 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
            {/* Dhaka Timezone Notice (Meta-style: "Dates are shown in Dhaka Time") */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <span>Dates are shown in Dhaka Time (GMT+6)</span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="px-5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-sm transition-all"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
