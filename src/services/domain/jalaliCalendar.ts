import { PERSIAN_WEEKDAY_NAMES } from '../../shared/constants/units';
import { toPersianDigits } from '../../shared/utils/cn';

function parseISODateUTC(isoDate: string): Date {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12, 0, 0));
}

function addDaysISO(isoDate: string, days: number): string {
  const dt = parseISODateUTC(isoDate);
  dt.setUTCDate(dt.getUTCDate() + days);
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Computes the current date string (YYYY-MM-DD) and hour/minute in the user's configured IANA timezone.
 */
export function getZonedDateParts(date: Date, timeZone = 'Asia/Tehran'): {
  isoDate: string;
  weekdayIndexSatStart: number; // 0 = Saturday .. 6 = Friday
  hour: number;
  minute: number;
} {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      weekday: 'short',
    });

    const parts = formatter.formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    const year = get('year');
    const month = get('month');
    const day = get('day');
    const hourRaw = Number(get('hour'));
    const hour = hourRaw === 24 ? 0 : hourRaw;
    const minute = Number(get('minute'));
    const weekdayShort = get('weekday');

    const mapWeekday: Record<string, number> = {
      Sat: 0,
      Sun: 1,
      Mon: 2,
      Tue: 3,
      Wed: 4,
      Thu: 5,
      Fri: 6,
    };

    return {
      isoDate: `${year}-${month}-${day}`,
      weekdayIndexSatStart: mapWeekday[weekdayShort] ?? 0,
      hour: Number.isNaN(hour) ? 0 : hour,
      minute: Number.isNaN(minute) ? 0 : minute,
    };
  } catch {
    const isoDate = date.toISOString().slice(0, 10);
    const jsDay = date.getUTCDay();
    const weekdayIndexSatStart = (jsDay + 1) % 7;
    return {
      isoDate,
      weekdayIndexSatStart,
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
    };
  }
}

/**
 * Returns the Saturday-to-Friday Persian week range containing the given ISO date (YYYY-MM-DD).
 */
export function getSaturdayToFridayWeekRange(referenceISO: string): {
  weekStartISO: string;
  weekEndISO: string;
  dayDatesISO: string[];
} {
  const refDate = parseISODateUTC(referenceISO);
  // getUTCDay(): 0=Sun..6=Sat -> Convert so Saturday=0 .. Friday=6
  const satIndex = (refDate.getUTCDay() + 1) % 7;
  const saturdayISO = addDaysISO(referenceISO, -satIndex);
  const dayDatesISO: string[] = [];

  for (let i = 0; i < 7; i += 1) {
    dayDatesISO.push(addDaysISO(saturdayISO, i));
  }

  return {
    weekStartISO: dayDatesISO[0],
    weekEndISO: dayDatesISO[6],
    dayDatesISO,
  };
}

/**
 * Returns the next week's Saturday-to-Friday range relative to a reference ISO date.
 */
export function getNextSaturdayToFridayWeekRange(referenceISO: string): {
  weekStartISO: string;
  weekEndISO: string;
  dayDatesISO: string[];
} {
  const current = getSaturdayToFridayWeekRange(referenceISO);
  const nextSatISO = addDaysISO(current.weekStartISO, 7);
  return getSaturdayToFridayWeekRange(nextSatISO);
}

export function formatJalaliDayMonth(isoDate: string): string {
  try {
    const dt = parseISODateUTC(isoDate);
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }).format(dt);
  } catch {
    return toPersianDigits(isoDate);
  }
}

export function formatJalaliFullDate(isoDate: string): string {
  try {
    const dt = parseISODateUTC(isoDate);
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(dt);
  } catch {
    return toPersianDigits(isoDate);
  }
}

export function formatJalaliWeekRangeLabel(weekStartISO: string, weekEndISO: string): string {
  return `${formatJalaliDayMonth(weekStartISO)} تا ${formatJalaliFullDate(weekEndISO)}`;
}

export function getPersianWeekdayName(dayIndex: number): string {
  return PERSIAN_WEEKDAY_NAMES[dayIndex] ?? 'نامشخص';
}

export function formatDayHeaderTitle(dayIndex: number, isoDate: string): string {
  const dayOrdinals = ['اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم', 'هفتم'];
  const ordinal = dayOrdinals[dayIndex] ?? '';
  return `${getPersianWeekdayName(dayIndex)} ${formatJalaliDayMonth(isoDate)} — روز ${ordinal} از ۷`;
}

export function format24HourTime(hour: number, minute: number): string {
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return toPersianDigits(`${hh}:${mm}`);
}

/**
 * Evaluates whether the weekly planning reminder window is currently active (e.g., Thursday >= 10:00 in user's timezone).
 */
export function isPlanningReminderWindowActive(
  now: Date,
  timeZone: string,
  targetDayOfWeek = 5, // 5 = Thursday
  targetTime24h = '10:00'
): {
  isTargetDay: boolean;
  isAfterTargetTime: boolean;
  currentDayName: string;
  currentTimeLabel: string;
} {
  const parts = getZonedDateParts(now, timeZone);
  const [targetHourStr, targetMinStr] = targetTime24h.split(':');
  const targetMinutes = Number(targetHourStr) * 60 + Number(targetMinStr || 0);
  const currentMinutes = parts.hour * 60 + parts.minute;
  const isTargetDay = parts.weekdayIndexSatStart === targetDayOfWeek;
  return {
    isTargetDay,
    isAfterTargetTime: isTargetDay && currentMinutes >= targetMinutes,
    currentDayName: getPersianWeekdayName(parts.weekdayIndexSatStart),
    currentTimeLabel: format24HourTime(parts.hour, parts.minute),
  };
}

export function addDaysToISO(isoDate: string, days: number): string {
  return addDaysISO(isoDate, days);
}

export function getPersianDayIndexFromISO(isoDate: string): number {
  const dt = parseISODateUTC(isoDate);
  return (dt.getUTCDay() + 1) % 7; // 0 = Saturday .. 6 = Friday
}

export function getJalaliNumericParts(isoDate: string): {
  year: number;
  month: number;
  day: number;
  monthName: string;
} {
  const dt = parseISODateUTC(isoDate);
  const numFmt = new Intl.DateTimeFormat('en-u-ca-persian', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const parts = numFmt.formatToParts(dt);
  const year = Number(parts.find((p) => p.type === 'year')?.value ?? 1405);
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? 1);
  const day = Number(parts.find((p) => p.type === 'day')?.value ?? 1);

  const monthFmt = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    month: 'long',
    timeZone: 'UTC',
  });
  const monthName = monthFmt.format(dt);

  return { year, month, day, monthName };
}

export interface JalaliCalendarCell {
  isoDate: string;
  persianDay: number;
  persianMonth: number;
  persianYear: number;
  dayIndexSatStart: number;
  isCurrentMonth: boolean;
}

export function getJalaliMonthCalendarGrid(referenceISO: string): {
  year: number;
  month: number;
  monthName: string;
  monthStartISO: string;
  monthEndISO: string;
  cells: JalaliCalendarCell[];
} {
  const { year, month, day, monthName } = getJalaliNumericParts(referenceISO);
  const monthStartISO = addDaysISO(referenceISO, -(day - 1));

  const monthDays: JalaliCalendarCell[] = [];
  let cursorISO = monthStartISO;
  for (let i = 0; i < 32; i += 1) {
    const p = getJalaliNumericParts(cursorISO);
    if (p.month !== month || p.year !== year) break;
    monthDays.push({
      isoDate: cursorISO,
      persianDay: p.day,
      persianMonth: p.month,
      persianYear: p.year,
      dayIndexSatStart: getPersianDayIndexFromISO(cursorISO),
      isCurrentMonth: true,
    });
    cursorISO = addDaysISO(cursorISO, 1);
  }

  const monthEndISO = monthDays[monthDays.length - 1]?.isoDate ?? monthStartISO;
  const leadingCount = monthDays[0]?.dayIndexSatStart ?? 0;

  const leadingCells: JalaliCalendarCell[] = [];
  for (let i = leadingCount; i >= 1; i -= 1) {
    const iso = addDaysISO(monthStartISO, -i);
    const p = getJalaliNumericParts(iso);
    leadingCells.push({
      isoDate: iso,
      persianDay: p.day,
      persianMonth: p.month,
      persianYear: p.year,
      dayIndexSatStart: getPersianDayIndexFromISO(iso),
      isCurrentMonth: false,
    });
  }

  const totalSoFar = leadingCells.length + monthDays.length;
  const trailingCount = (7 - (totalSoFar % 7)) % 7;
  const trailingCells: JalaliCalendarCell[] = [];
  for (let i = 1; i <= trailingCount; i += 1) {
    const iso = addDaysISO(monthEndISO, i);
    const p = getJalaliNumericParts(iso);
    trailingCells.push({
      isoDate: iso,
      persianDay: p.day,
      persianMonth: p.month,
      persianYear: p.year,
      dayIndexSatStart: getPersianDayIndexFromISO(iso),
      isCurrentMonth: false,
    });
  }

  return {
    year,
    month,
    monthName,
    monthStartISO,
    monthEndISO,
    cells: [...leadingCells, ...monthDays, ...trailingCells],
  };
}

export function shiftJalaliMonthISO(referenceISO: string, deltaMonths: number): string {
  let grid = getJalaliMonthCalendarGrid(referenceISO);
  const steps = Math.abs(deltaMonths);
  for (let i = 0; i < steps; i += 1) {
    if (deltaMonths > 0) {
      const nextMonthFirstDay = addDaysISO(grid.monthEndISO, 1);
      grid = getJalaliMonthCalendarGrid(nextMonthFirstDay);
    } else {
      const prevMonthLastDay = addDaysISO(grid.monthStartISO, -1);
      grid = getJalaliMonthCalendarGrid(prevMonthLastDay);
    }
  }
  return grid.monthStartISO;
}

export function shiftWeekISO(referenceISO: string, deltaWeeks: number): string {
  return addDaysISO(referenceISO, deltaWeeks * 7);
}

/**
 * Resolves the UTC offset string (e.g. "+03:30" or "+00:00") for an IANA timezone on a given date.
 */
export function getTimezoneOffsetString(dateISO: string, timeZone = 'Asia/Tehran'): string {
  try {
    const dt = parseISODateUTC(dateISO);
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'longOffset',
    });
    const tzPart = fmt.formatToParts(dt).find((p) => p.type === 'timeZoneName')?.value ?? '';
    // Format is typically "GMT+03:30" or "GMT-05:00" or "GMT"
    if (tzPart === 'GMT' || tzPart === 'UTC') return '+00:00';
    const match = tzPart.match(/GMT([+-]\d{2}:\d{2})/);
    if (match?.[1]) return match[1];
  } catch {
    // Fallback below
  }
  return timeZone === 'Asia/Tehran' ? '+03:30' : '+00:00';
}

/**
 * Formats a YYYY-MM-DD date and HH:mm time as an ISO timestamp preserving the user's configured timezone offset.
 */
export function buildZonedISOTimestamp(
  dateISO: string,
  hhmm: string,
  timeZone = 'Asia/Tehran'
): string {
  const cleanDate = dateISO.slice(0, 10);
  const cleanTime = /^\d{2}:\d{2}$/.test(hhmm) ? hhmm : '00:00';
  const offset = getTimezoneOffsetString(cleanDate, timeZone);
  return `${cleanDate}T${cleanTime}:00${offset}`;
}


