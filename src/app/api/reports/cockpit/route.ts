import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getFinanceCockpitMetrics } from '@/lib/reports/metrics';

export async function GET() {
  const session = await getSession();
  if (!session || session.role === 'customer') {
    return NextResponse.json({ error: 'FORBIDDEN: Internal staff/admin access required' }, { status: 403 });
  }

  const metrics = await getFinanceCockpitMetrics();

  return NextResponse.json({
    asOfDate: metrics.asOfDate,
    activeSubscriptionsCount: metrics.activeSubscriptionsCount,
    pausedSubscriptionsCount: metrics.pausedSubscriptionsCount,
    mrr: metrics.mrr.toString(),
    arr: metrics.arr.toString(),
    totalInvoiced: metrics.totalInvoiced.toString(),
    cashCollected: metrics.cashCollected.toString(),
    outstandingAr: metrics.outstandingAr.toString(),
    overdueAr: metrics.overdueAr.toString(),
    overdueCount: metrics.overdueCount,
    agingBuckets: {
      '1-7': { count: metrics.agingBuckets['1-7'].count, amount: metrics.agingBuckets['1-7'].amount.toString() },
      '8-30': { count: metrics.agingBuckets['8-30'].count, amount: metrics.agingBuckets['8-30'].amount.toString() },
      '31-60': { count: metrics.agingBuckets['31-60'].count, amount: metrics.agingBuckets['31-60'].amount.toString() },
      '60+': { count: metrics.agingBuckets['60+'].count, amount: metrics.agingBuckets['60+'].amount.toString() },
    },
  });
}
