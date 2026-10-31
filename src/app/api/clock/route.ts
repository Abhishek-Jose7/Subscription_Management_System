import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getClockStatus, advanceDays, pinDate, resetClock } from '@/lib/clock';
import { executeBillingRun } from '@/lib/billing/engine';

export async function GET() {
  const status = await getClockStatus();
  return NextResponse.json(status);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'FORBIDDEN: Admin access required for virtual clock' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { action, days, date } = body;

    if (action === 'advance') {
      const advanceBy = Number(days || 1);
      await advanceDays(advanceBy);
      // Auto-trigger daily billing run on virtual time-travel as specified in PRD Section 11 & 19
      await executeBillingRun({
        triggeredBy: `virtual_clock_advance_+${advanceBy}d`,
      });
    } else if (action === 'pin' && date) {
      await pinDate(new Date(date));
    } else if (action === 'reset') {
      await resetClock();
    }

    const updatedStatus = await getClockStatus();
    return NextResponse.json({ success: true, ...updatedStatus });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
