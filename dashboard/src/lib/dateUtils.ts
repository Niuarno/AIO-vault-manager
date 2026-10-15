/**
 * Bangladesh / Dhaka Local Time (GMT+6 / Asia/Dhaka) Utilities.
 * Ensures all daily commission milestones, performance stats, graphs,
 * and reports reset strictly at 12:00:00 AM (midnight) Bangladesh Standard Time.
 */

export const DHAKA_TIMEZONE = 'Asia/Dhaka';

/**
 * Returns date formatted as "YYYY-MM-DD" in Dhaka local time (Asia/Dhaka, GMT+6).
 */
export function getDhakaDateString(date: Date | string | number = new Date()): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DHAKA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Returns the exact UTC ISO string for 12:00:00.000 AM (start of day) in Dhaka local time.
 * For example, 12:00 AM on 2026-09-26 in Dhaka corresponds to 2026-09-25T18:00:00.000Z in UTC.
 */
export function getDhakaStartOfDayIso(date: Date | string | number = new Date()): string {
  const dateStr =
    typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : getDhakaDateString(date);
  return new Date(`${dateStr}T00:00:00+06:00`).toISOString();
}

/**
 * Returns the exact UTC ISO string for 11:59:59.999 PM (end of day) in Dhaka local time.
 * For example, 11:59:59.999 PM on 2026-09-26 in Dhaka corresponds to 2026-09-26T17:59:59.999Z in UTC.
 */
export function getDhakaEndOfDayIso(date: Date | string | number = new Date()): string {
  const dateStr =
    typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : getDhakaDateString(date);
  return new Date(`${dateStr}T23:59:59.999+06:00`).toISOString();
}

/**
 * Returns true if a given timestamp occurred on the specified Dhaka day (defaults to today in Dhaka).
 */
export function isSameDhakaDay(
  dateToCheck: string | Date | null | undefined,
  targetDate: string | Date = new Date()
): boolean {
  if (!dateToCheck) return false;
  const d1 = getDhakaDateString(dateToCheck);
  const d2 =
    typeof targetDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(targetDate)
      ? targetDate
      : getDhakaDateString(targetDate);
  return d1 === d2;
}

/**
 * Returns year, month (0-11), and day (1-31) in Dhaka local time.
 */
export function getDhakaParts(date: Date | string | number = new Date()) {
  const dateStr = getDhakaDateString(date);
  const [y, m, d] = dateStr.split('-').map(Number);
  return {
    year: y,
    month: m - 1, // 0-indexed like Date.prototype.getMonth()
    day: d,
    dateString: dateStr,
  };
}

/**
 * Adds or subtracts days from a YYYY-MM-DD date string using pure UTC calendar math.
 */
export function addDhakaDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const resY = dt.getUTCFullYear();
  const resM = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const resD = String(dt.getUTCDate()).padStart(2, '0');
  return `${resY}-${resM}-${resD}`;
}

/**
 * Calculates number of days between two YYYY-MM-DD dates inclusive (end - start + 1).
 */
export function diffDhakaDays(startDateStr: string, endDateStr: string): number {
  const [y1, m1, d1] = startDateStr.split('-').map(Number);
  const [y2, m2, d2] = endDateStr.split('-').map(Number);
  const ms1 = Date.UTC(y1, m1 - 1, d1);
  const ms2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((ms2 - ms1) / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Formats "YYYY-MM-DD" into human-friendly format like "Aug 24, 2026".
 */
export function formatDhakaDisplayDate(dateStr: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr || '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  return `${monthNames[m - 1]} ${d}, ${y}`;
}

/**
 * Formats "YYYY-MM-DD" into short month & day like "Aug 24".
 */
export function formatDhakaShortDate(dateStr: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr || '';
  const [, m, d] = dateStr.split('-').map(Number);
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  return `${monthNames[m - 1]} ${d}`;
}

/**
 * Formats "YYYY-MM-DD" into "Mon, Aug 24".
 */
export function formatDhakaWeekdayDate(dateStr: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr || '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  return `${weekdays[dt.getUTCDay()]}, ${monthNames[m - 1]} ${d}`;
}

/**
 * Parses user input like "Aug 24, 2026" or "2026-08-24" back into "YYYY-MM-DD".
 */
export function parseDhakaDateInput(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // Try parsing "Aug 24, 2026" or "Aug 24 2026"
  const match = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (match) {
    const monthNames = [
      'jan', 'feb', 'mar', 'apr', 'may', 'jun',
      'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
    ];
    const monthIdx = monthNames.findIndex((m) =>
      match[1].toLowerCase().startsWith(m)
    );
    if (monthIdx !== -1) {
      const year = match[3];
      const month = String(monthIdx + 1).padStart(2, '0');
      const day = String(parseInt(match[2], 10)).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  return null;
}

export type MetaPresetKey =
  | 'maximum'
  | 'today'
  | 'yesterday'
  | 'today_yesterday'
  | 'last_7_days'
  | 'last_14_days'
  | 'last_28_days'
  | 'last_30_days'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'custom';

export interface MetaDatePreset {
  key: MetaPresetKey;
  label: string;
}

export const META_DATE_PRESETS: MetaDatePreset[] = [
  { key: 'maximum', label: 'Maximum' },
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'today_yesterday', label: 'Today and yesterday' },
  { key: 'last_7_days', label: 'Last 7 days' },
  { key: 'last_14_days', label: 'Last 14 days' },
  { key: 'last_28_days', label: 'Last 28 days' },
  { key: 'last_30_days', label: 'Last 30 days' },
  { key: 'this_week', label: 'This week' },
  { key: 'last_week', label: 'Last week' },
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'custom', label: 'Custom' },
];

export interface MetaDateRangeResult {
  preset: MetaPresetKey;
  label: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  compareStartDate?: string; // YYYY-MM-DD
  compareEndDate?: string; // YYYY-MM-DD
}

/**
 * Calculates start and end dates for any Meta Ads Manager preset in Dhaka local time.
 */
export function getMetaPresetDateRange(
  presetKey: MetaPresetKey,
  now: Date = new Date(),
  compare: boolean = false
): MetaDateRangeResult {
  const today = getDhakaDateString(now);
  const yesterday = addDhakaDays(today, -1);

  let startDate = today;
  let endDate = today;
  let label = 'Today';

  switch (presetKey) {
    case 'maximum':
      startDate = '2024-01-01';
      endDate = today;
      label = 'Maximum';
      break;
    case 'today':
      startDate = today;
      endDate = today;
      label = 'Today';
      break;
    case 'yesterday':
      startDate = yesterday;
      endDate = yesterday;
      label = 'Yesterday';
      break;
    case 'today_yesterday':
      startDate = yesterday;
      endDate = today;
      label = 'Today and yesterday';
      break;
    case 'last_7_days':
      // Meta Ads Manager convention: 7 full days ending yesterday
      startDate = addDhakaDays(today, -7);
      endDate = yesterday;
      label = 'Last 7 days';
      break;
    case 'last_14_days':
      startDate = addDhakaDays(today, -14);
      endDate = yesterday;
      label = 'Last 14 days';
      break;
    case 'last_28_days':
      startDate = addDhakaDays(today, -28);
      endDate = yesterday;
      label = 'Last 28 days';
      break;
    case 'last_30_days':
      startDate = addDhakaDays(today, -30);
      endDate = yesterday;
      label = 'Last 30 days';
      break;
    case 'this_week': {
      // Sunday of current week in Dhaka to today
      const [y, m, d] = today.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      const dayOfWeek = dt.getUTCDay(); // 0 is Sunday
      startDate = addDhakaDays(today, -dayOfWeek);
      endDate = today;
      label = 'This week';
      break;
    }
    case 'last_week': {
      // Sunday to Saturday of previous week
      const [y, m, d] = today.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      const dayOfWeek = dt.getUTCDay();
      const thisSunday = addDhakaDays(today, -dayOfWeek);
      startDate = addDhakaDays(thisSunday, -7);
      endDate = addDhakaDays(thisSunday, -1);
      label = 'Last week';
      break;
    }
    case 'this_month':
      startDate = `${today.slice(0, 7)}-01`;
      endDate = today;
      label = 'This month';
      break;
    case 'last_month': {
      const firstOfThisMonth = `${today.slice(0, 7)}-01`;
      const lastDayOfLastMonth = addDhakaDays(firstOfThisMonth, -1);
      startDate = `${lastDayOfLastMonth.slice(0, 7)}-01`;
      endDate = lastDayOfLastMonth;
      label = 'Last month';
      break;
    }
    case 'custom':
    default:
      startDate = addDhakaDays(today, -7);
      endDate = yesterday;
      label = 'Custom';
      break;
  }

  const result: MetaDateRangeResult = {
    preset: presetKey,
    label,
    startDate,
    endDate,
  };

  if (compare) {
    const daysCount = diffDhakaDays(startDate, endDate);
    const compareEndDate = addDhakaDays(startDate, -1);
    const compareStartDate = addDhakaDays(compareEndDate, -(daysCount - 1));
    result.compareStartDate = compareStartDate;
    result.compareEndDate = compareEndDate;
  }

  return result;
}

/**
 * Returns an array of YYYY-MM-DD date strings for all days between startDate and endDate inclusive.
 */
export function getAllDhakaDatesInRange(startDateStr: string, endDateStr: string): string[] {
  const dates: string[] = [];
  const daysCount = diffDhakaDays(startDateStr, endDateStr);
  if (daysCount <= 0 || daysCount > 1000) return [startDateStr];

  for (let i = 0; i < daysCount; i++) {
    dates.push(addDhakaDays(startDateStr, i));
  }
  return dates;
}

/**
 * Creates Date objects bounded to Dhaka local time for a specific month or year.
 */
export function getDhakaPeriodBounds(
  periodType: 'monthly' | 'yearly',
  year: number,
  month = 0
): { startDate: Date; endDate: Date } {
  if (periodType === 'monthly') {
    const lastDay = new Date(year, month + 1, 0).getDate();
    const monthStr = String(month + 1).padStart(2, '0');
    const lastDayStr = String(lastDay).padStart(2, '0');
    return {
      startDate: new Date(`${year}-${monthStr}-01T00:00:00+06:00`),
      endDate: new Date(`${year}-${monthStr}-${lastDayStr}T23:59:59.999+06:00`),
    };
  }
  return {
    startDate: new Date(`${year}-01-01T00:00:00+06:00`),
    endDate: new Date(`${year}-12-31T23:59:59.999+06:00`),
  };
}

export interface DhakaCountdownInfo {
  remainingMs: number;
  totalSeconds: number;
  hours: number;
  minutes: number;
  seconds: number;
  progressPercent: number; // 0 (start of day at 12am) to 100 (end of day at 11:59:59pm)
  formatted: string; // e.g. "08:07:21"
  hh: string;
  mm: string;
  ss: string;
}

/**
 * Calculates remaining time until next 12:00:00 AM midnight in Dhaka local time (GMT+6).
 */
export function getTimeUntilDhakaMidnight(now: Date = new Date()): DhakaCountdownInfo {
  const dhakaOffsetMs = 6 * 60 * 60 * 1000;
  const dhakaTimeMs = now.getTime() + dhakaOffsetMs;
  const msInDay = 24 * 60 * 60 * 1000;
  const msElapsed = ((dhakaTimeMs % msInDay) + msInDay) % msInDay;
  const remainingMs = msInDay - msElapsed;

  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600) % 24;
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  const progressPercent = Math.min(100, Math.max(0, ((msInDay - remainingMs) / msInDay) * 100));

  return {
    remainingMs,
    totalSeconds,
    hours,
    minutes,
    seconds,
    progressPercent,
    formatted: `${hh}:${mm}:${ss}`,
    hh,
    mm,
    ss,
  };
}

