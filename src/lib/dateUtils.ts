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
  const dateStr = getDhakaDateString(date);
  return new Date(`${dateStr}T00:00:00+06:00`).toISOString();
}

/**
 * Returns the exact UTC ISO string for 11:59:59.999 PM (end of day) in Dhaka local time.
 * For example, 11:59:59.999 PM on 2026-09-26 in Dhaka corresponds to 2026-09-26T17:59:59.999Z in UTC.
 */
export function getDhakaEndOfDayIso(date: Date | string | number = new Date()): string {
  const dateStr = getDhakaDateString(date);
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
