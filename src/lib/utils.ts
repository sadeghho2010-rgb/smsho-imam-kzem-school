import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const WEEK_DAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه'];

export function getProgramDays(p: { day?: string; days?: string[] }): string[] {
  if (p.days && Array.isArray(p.days) && p.days.length > 0) {
    return p.days;
  }
  if (!p.day) return [];
  if (p.day.includes('هر روز') || p.day.includes('شنبه تا چهارشنبه')) {
    return ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه'];
  }
  const matched = WEEK_DAYS.filter(d => p.day?.includes(d));
  if (matched.length > 0) return matched;
  return [p.day];
}

