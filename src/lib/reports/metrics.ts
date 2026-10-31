import prisma from '@/lib/db';
import { businessDate } from '@/lib/clock';
import { calculateNormalizedMonthlyPaise } from '@/lib/subscriptions/state-machine';

export interface FinanceCockpitSummary {
  asOfDate: Date;
  activeSubscriptionsCount: number;
  pausedSubscriptionsCount: number;
  mrr: bigint; // paise
  arr: bigint; // paise
  totalInvoiced: bigint; // paise
  cashCollected: bigint; // paise
  outstandingAr: bigint; // paise
  overdueAr: bigint; // paise
  overdueCount: number;
  agingBuckets: {
    '1-7': { count: number; amount: bigint };
    '8-30': { count: number; amount: bigint };
    '31-60': { count: number; amount: bigint };
    '60+': { count: number; amount: bigint };
  };
}

export interface MrrWaterfallSummary {
  startMrr: bigint;
  newMrr: bigint;
  expansionMrr: bigint;
  contractionMrr: bigint;
  churnMrr: bigint;
  endMrr: bigint;
}

/**
 * Compute real-time finance cockpit KPIs (PRD Section 10)
 */
export async function getFinanceCockpitMetrics(): Promise<FinanceCockpitSummary> {
  const today = await businessDate();

  // 1. Subscriptions stats
  const activeSubs = await prisma.subscription.findMany({
    where: { status: 'active' },
    include: {
      plan: true,
      lines: true,
    },
  });

  let activeCount = 0;
  let pausedCount = 0;
  let totalMrr = 0n;

  for (const sub of activeSubs) {
    const isPaused = sub.pausedUntil && sub.pausedUntil >= today;
    if (isPaused) {
      pausedCount++;
    } else {
      activeCount++;
      const monthlyPaise = calculateNormalizedMonthlyPaise(sub.lines, sub.plan.billingPeriod);
      totalMrr += monthlyPaise;
    }
  }

  // 2. Invoices & AR stats
  const confirmedInvoices = await prisma.invoice.findMany({
    where: {
      status: 'confirmed',
    },
    select: {
      total: true,
      amountPaid: true,
      dueDate: true,
    },
  });

  let outstandingAr = 0n;
  let overdueAr = 0n;
  let overdueCount = 0;

  const agingBuckets = {
    '1-7': { count: 0, amount: 0n },
    '8-30': { count: 0, amount: 0n },
    '31-60': { count: 0, amount: 0n },
    '60+': { count: 0, amount: 0n },
  };

  const todayTime = new Date(today).setHours(0, 0, 0, 0);

  for (const inv of confirmedInvoices) {
    const balance = inv.total - inv.amountPaid;
    if (balance > 0n) {
      outstandingAr += balance;
      const dueTime = new Date(inv.dueDate).setHours(0, 0, 0, 0);
      const diffDays = Math.floor((todayTime - dueTime) / (1000 * 60 * 60 * 24));

      if (diffDays > 0) {
        overdueAr += balance;
        overdueCount++;

        if (diffDays <= 7) {
          agingBuckets['1-7'].count++;
          agingBuckets['1-7'].amount += balance;
        } else if (diffDays <= 30) {
          agingBuckets['8-30'].count++;
          agingBuckets['8-30'].amount += balance;
        } else if (diffDays <= 60) {
          agingBuckets['31-60'].count++;
          agingBuckets['31-60'].amount += balance;
        } else {
          agingBuckets['60+'].count++;
          agingBuckets['60+'].amount += balance;
        }
      }
    }
  }

  // 3. Cash collected (all non-voided payments)
  const paymentsAggregate = await prisma.payment.aggregate({
    where: { status: 'recorded' },
    _sum: { amount: true },
  });
  const cashCollected = paymentsAggregate._sum.amount ?? 0n;

  // 4. Total invoiced (confirmed + paid)
  const invoicesAggregate = await prisma.invoice.aggregate({
    where: { status: { in: ['confirmed', 'paid'] } },
    _sum: { total: true },
  });
  const totalInvoiced = invoicesAggregate._sum.total ?? 0n;

  return {
    asOfDate: today,
    activeSubscriptionsCount: activeCount,
    pausedSubscriptionsCount: pausedCount,
    mrr: totalMrr,
    arr: totalMrr * 12n,
    totalInvoiced,
    cashCollected,
    outstandingAr,
    overdueAr,
    overdueCount,
    agingBuckets,
  };
}

/**
 * Compute MRR movement waterfall from append-only mrr_events (PRD Section 10 View 2)
 */
export async function getMrrWaterfall(startDate?: Date, endDate?: Date): Promise<MrrWaterfallSummary> {
  const today = await businessDate();
  const start = startDate ?? new Date(today.getFullYear(), today.getMonth(), 1);
  const end = endDate ?? today;

  const events = await prisma.mrrEvent.findMany({
    where: {
      at: {
        gte: start,
        lte: end,
      },
    },
  });

  let newMrr = 0n;
  let expansionMrr = 0n;
  let contractionMrr = 0n;
  let churnMrr = 0n;

  for (const ev of events) {
    if (ev.type === 'new_sub' || ev.type === 'reactivation') {
      newMrr += ev.deltaMrr;
    } else if (ev.type === 'expansion') {
      expansionMrr += ev.deltaMrr;
    } else if (ev.type === 'contraction') {
      contractionMrr += -ev.deltaMrr;
    } else if (ev.type === 'churn') {
      churnMrr += -ev.deltaMrr;
    }
  }

  // Starting MRR prior to start date
  const priorEvents = await prisma.mrrEvent.findMany({
    where: { at: { lt: start } },
  });
  const startMrr = priorEvents.reduce((s, e) => s + e.deltaMrr, 0n);
  const endMrr = startMrr + newMrr + expansionMrr - contractionMrr - churnMrr;

  return {
    startMrr: startMrr < 0n ? 0n : startMrr,
    newMrr,
    expansionMrr,
    contractionMrr,
    churnMrr,
    endMrr: endMrr < 0n ? 0n : endMrr,
  };
}
