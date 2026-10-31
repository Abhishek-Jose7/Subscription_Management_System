/**
 * Virtual Clock Module
 * 
 * All code calls businessDate() instead of new Date() / Date.now().
 * Supports pinned date and offset for demo/testing.
 * Business dates are in Asia/Kolkata timezone.
 */

import prisma from '@/lib/db';

const KOLKATA_TZ = 'Asia/Kolkata';

/** Get the current business date (Asia/Kolkata), respecting virtual clock settings */
export async function businessDate(): Promise<Date> {
  try {
    const clock = await prisma.systemClock.findUnique({
      where: { id: 'singleton' },
    });

    if (clock?.pinnedDate) {
      return new Date(clock.pinnedDate);
    }

    const now = realNowInKolkata();

    if (clock?.offsetDays && clock.offsetDays !== 0) {
      now.setDate(now.getDate() + clock.offsetDays);
    }

    return now;
  } catch {
    // If DB is not available (e.g., during build), return real date
    return realNowInKolkata();
  }
}

/** Get real current date in Kolkata timezone (date only, no time) */
function realNowInKolkata(): Date {
  const now = new Date();
  const kolkataStr = now.toLocaleDateString('en-CA', { timeZone: KOLKATA_TZ });
  return new Date(kolkataStr + 'T00:00:00.000Z');
}

/** Advance the virtual clock by N days */
export async function advanceDays(days: number): Promise<Date> {
  const clock = await prisma.systemClock.upsert({
    where: { id: 'singleton' },
    update: { offsetDays: { increment: days } },
    create: { id: 'singleton', offsetDays: days },
  });
  return businessDate();
}

/** Pin the virtual clock to a specific date */
export async function pinDate(date: Date): Promise<void> {
  await prisma.systemClock.upsert({
    where: { id: 'singleton' },
    update: { pinnedDate: date, offsetDays: 0 },
    create: { id: 'singleton', pinnedDate: date },
  });
}

/** Reset the virtual clock to real time */
export async function resetClock(): Promise<void> {
  await prisma.systemClock.upsert({
    where: { id: 'singleton' },
    update: { pinnedDate: null, offsetDays: 0 },
    create: { id: 'singleton' },
  });
}

/** Get clock status for display */
export async function getClockStatus(): Promise<{
  isSimulated: boolean;
  currentDate: Date;
  pinnedDate: Date | null;
  offsetDays: number;
}> {
  const clock = await prisma.systemClock.findUnique({
    where: { id: 'singleton' },
  });
  const current = await businessDate();
  return {
    isSimulated: !!(clock?.pinnedDate || (clock?.offsetDays && clock.offsetDays !== 0)),
    currentDate: current,
    pinnedDate: clock?.pinnedDate ?? null,
    offsetDays: clock?.offsetDays ?? 0,
  };
}

/** Format a date for display (YYYY-MM-DD) */
export function formatBusinessDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
