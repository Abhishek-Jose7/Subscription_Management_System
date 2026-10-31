import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { runLedgerHealthChecks } from '@/lib/reports/ledger-health';

export async function GET() {
  const session = await getSession();
  if (!session || session.role === 'customer') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const result = await runLedgerHealthChecks();
  return NextResponse.json(result);
}
