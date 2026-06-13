import { format, addMonths as dfnsAddMonths, startOfDay, differenceInMonths } from 'date-fns'

/**
 * Formats a date using a format string.
 * Supports "MMM-yyyy", "MMM yyyy", and other date-fns compatible formats.
 */
export function formatDate(date: Date, formatStr: string): string {
  return format(date, formatStr)
}

/**
 * Returns today's date at midnight.
 */
export function today(): Date {
  return startOfDay(new Date())
}

/**
 * Returns the 1st of next month at midnight.
 */
export function startOfNextMonth(): Date {
  const now = new Date()
  return startOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 1))
}

/**
 * Adds (or subtracts) months to a date. Handles end-of-month overflow
 * (e.g. Jan 31 + 1 month = Feb 28/29).
 * Returns a new Date.
 */
export function addMonths(date: Date, months: number): Date {
  return dfnsAddMonths(date, months)
}

/**
 * Returns a NEW date with the time portion zeroed out (midnight).
 * Does not mutate the input.
 */
export function clearTime(date: Date): Date {
  return startOfDay(date)
}

/**
 * Returns true if `date` is strictly after `other`.
 */
export function isAfter(date: Date, other: Date): boolean {
  return date.getTime() > other.getTime()
}

/**
 * Returns true if `date` is strictly before `other`.
 */
export function isBefore(date: Date, other: Date): boolean {
  return date.getTime() < other.getTime()
}

/**
 * Returns the number of full months between two dates.
 * Always returns a non-negative value.
 */
export function monthsBetween(a: Date, b: Date): number {
  return Math.abs(differenceInMonths(a, b))
}
