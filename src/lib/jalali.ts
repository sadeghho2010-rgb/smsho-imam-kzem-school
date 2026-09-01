import * as jalaali from 'jalaali-js';

export interface ShamsiDateParts {
  year: number;
  month: number;
  day: number;
}

export const SHAMSI_MONTH_NAMES = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

export const SHAMSI_WEEKDAY_NAMES = [
  'شنبه',
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنج‌شنبه',
  'جمعه',
];

export const SHAMSI_WEEKDAY_NAMES_SHORT = [
  'ش',
  'ی',
  'د',
  'س',
  'چ',
  'پ',
  'ج',
];

// Convert digits to English
export function toEnglishDigits(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
}

// Convert digits to Persian
export function toPersianDigits(n: number | string): string {
  if (n === undefined || n === null) return '';
  return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d, 10)]);
}

// Parse "1405/06/15" or "1405-06-15"
export function parseShamsiDate(shamsiStr: string): ShamsiDateParts {
  const cleaned = toEnglishDigits(shamsiStr).trim().replace(/-/g, '/');
  const parts = cleaned.split('/');
  if (parts.length !== 3) {
    return { year: 1405, month: 1, day: 1 };
  }
  const year = parseInt(parts[0], 10) || 1405;
  const month = parseInt(parts[1], 10) || 1;
  const day = parseInt(parts[2], 10) || 1;
  return { year, month, day };
}

// Format parts into "1405/06/15"
export function formatShamsiDate(year: number, month: number, day: number): string {
  const yStr = String(year).padStart(4, '0');
  const mStr = String(month).padStart(2, '0');
  const dStr = String(day).padStart(2, '0');
  return `${yStr}/${mStr}/${dStr}`;
}

// Convert Shamsi string "1405/06/15" to JS Date
export function shamsiToDate(shamsiStr: string): Date {
  const { year, month, day } = parseShamsiDate(shamsiStr);
  const { gy, gm, gd } = jalaali.toGregorian(year, month, day);
  return new Date(gy, gm - 1, gd, 12, 0, 0); // Noon to avoid timezone boundary shifts
}

// Convert JS Date to Shamsi string "1405/06/15"
export function dateToShamsi(date: Date): string {
  const gy = date.getFullYear();
  const gm = date.getMonth() + 1;
  const gd = date.getDate();
  const { jy, jm, jd } = jalaali.toJalaali(gy, gm, gd);
  return formatShamsiDate(jy, jm, jd);
}

// Get today in Shamsi
export function getTodayShamsi(): string {
  return dateToShamsi(new Date());
}

// Get day of week: 0 = شنبه, 1 = یکشنبه, ..., 5 = پنج‌شنبه, 6 = جمعه
export function getShamsiDayOfWeek(shamsiStr: string): number {
  const date = shamsiToDate(shamsiStr);
  const jsDay = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  // Map JS day (0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat) to Persian (0=Sat, 1=Sun, 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri)
  const map: Record<number, number> = {
    6: 0, // Saturday -> 0 (شنبه)
    0: 1, // Sunday -> 1 (یکشنبه)
    1: 2, // Monday -> 2 (دوشنبه)
    2: 3, // Tuesday -> 3 (سه‌شنبه)
    3: 4, // Wednesday -> 4 (چهارشنبه)
    4: 5, // Thursday -> 5 (پنج‌شنبه)
    5: 6, // Friday -> 6 (جمعه)
  };
  return map[jsDay] ?? 0;
}

// Get weekday name
export function getShamsiDayOfWeekName(shamsiStr: string): string {
  const idx = getShamsiDayOfWeek(shamsiStr);
  return SHAMSI_WEEKDAY_NAMES[idx] || 'شنبه';
}

// Get month name
export function getShamsiMonthName(monthNumber: number): string {
  return SHAMSI_MONTH_NAMES[monthNumber - 1] || '';
}

// Days in a Shamsi month
export function getDaysInShamsiMonth(year: number, month: number): number {
  return jalaali.jalaaliMonthLength(year, month);
}

// Compare two Shamsi date strings ("1405/06/15" vs "1406/01/01")
export function compareShamsi(a: string, b: string): number {
  const pA = parseShamsiDate(a);
  const pB = parseShamsiDate(b);
  if (pA.year !== pB.year) return pA.year - pB.year;
  if (pA.month !== pB.month) return pA.month - pB.month;
  return pA.day - pB.day;
}

// Check if target date is between start and end (inclusive)
export function isDateBetween(target: string, start: string, end: string): boolean {
  return compareShamsi(target, start) >= 0 && compareShamsi(target, end) <= 0;
}

// Generate all Shamsi date strings between start and end inclusive
export function generateShamsiDateRange(startShamsi: string, endShamsi: string): string[] {
  if (compareShamsi(startShamsi, endShamsi) > 0) return [];
  
  const results: string[] = [];
  let current = shamsiToDate(startShamsi);
  const end = shamsiToDate(endShamsi);

  while (current.getTime() <= end.getTime()) {
    results.push(dateToShamsi(current));
    current.setDate(current.getDate() + 1);
  }

  return results;
}

// Calculate total days between start and end inclusive
export function calculateDaysBetween(startShamsi: string, endShamsi: string): number {
  const dates = generateShamsiDateRange(startShamsi, endShamsi);
  return dates.length;
}
