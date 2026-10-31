/**
 * Calendar and Anchor-Day Date Arithmetic (PRD Decision D9, Section 12 Invariants 4 & 5)
 * 
 * Rules:
 * - Anchored to the original start day (billing_anchor_day).
 * - Jan 31 + 1 month = Feb 28 (or Feb 29 leap), then next month returns to Mar 31 (no drift).
 * - Feb 29 yearly = Feb 28 non-leap, Feb 29 leap year.
 * - Pure functions with zero DB dependencies.
 */

export type BillingPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

/** Check if a year is a leap year */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/** Get number of days in a given month (1-indexed month: 1=Jan, 2=Feb, etc.) */
export function getDaysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  if ([4, 6, 9, 11].includes(month)) {
    return 30;
  }
  return 31;
}

/**
 * Add N periods to a base date anchored by original billing_anchor_day.
 * Prevents month-end drift.
 */
export function addBillingPeriod(
  currentDate: Date,
  period: BillingPeriod,
  anchorDay: number,
  count: number = 1
): Date {
  const result = new Date(currentDate);

  if (period === 'daily') {
    result.setDate(result.getDate() + count);
    return result;
  }

  if (period === 'weekly') {
    result.setDate(result.getDate() + 7 * count);
    return result;
  }

  if (period === 'monthly') {
    let year = result.getFullYear();
    let month = result.getMonth() + 1 + count; // 1-indexed

    while (month > 12) {
      year += 1;
      month -= 12;
    }
    while (month < 1) {
      year -= 1;
      month += 12;
    }

    const maxDays = getDaysInMonth(year, month);
    const day = Math.min(anchorDay, maxDays);
    return new Date(Date.UTC(year, month - 1, day));
  }

  if (period === 'yearly') {
    const year = result.getFullYear() + count;
    const month = result.getMonth() + 1;
    const maxDays = getDaysInMonth(year, month);
    const day = Math.min(anchorDay, maxDays);
    return new Date(Date.UTC(year, month - 1, day));
  }

  return result;
}

/**
 * Compute the next billing period [periodStart, periodEnd)
 * periodStart is current billing date, periodEnd is periodStart + 1 period
 */
export function getBillingPeriodRange(
  periodStart: Date,
  period: BillingPeriod,
  anchorDay: number
): { start: Date; end: Date } {
  const end = addBillingPeriod(periodStart, period, anchorDay, 1);
  return { start: new Date(periodStart), end };
}
