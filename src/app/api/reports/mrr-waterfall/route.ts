import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getMrrWaterfall } from '@/lib/reports/metrics';

export async function GET() {
  const session = await getSession();
  if (!session || session.role === 'customer') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const waterfall = await getMrrWaterfall();

  return NextResponse.json({
    startMrr: waterfall.startMrr.toString(),
    newMrr: waterfall.newMrr.toString(),
    expansionMrr: waterfall.expansionMrr.toString(),
    contractionMrr: waterfall.contractionMrr.toString(),
    churnMrr: waterfall.churnMrr.toString(),
    endMrr: waterfall.endMrr.toString(),
  });
}
