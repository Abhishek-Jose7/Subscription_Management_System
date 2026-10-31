import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { executeBillingRun } from '@/lib/billing/engine';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role === 'customer') {
    return NextResponse.json({ error: 'FORBIDDEN: Staff/Admin access required' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { dryRun, targetSubscriptionId } = body;

    const result = await executeBillingRun({
      triggeredBy: session.userId,
      dryRun: !!dryRun,
      targetSubscriptionId,
    });

    const formattedPreview = result.invoicesPreview?.map((p) => ({
      ...p,
      subtotal: p.subtotal.toString(),
      discountTotal: p.discountTotal.toString(),
      taxTotal: p.taxTotal.toString(),
      total: p.total.toString(),
    }));

    return NextResponse.json({
      success: true,
      runId: result.runId,
      businessDate: result.businessDate,
      dryRun: result.dryRun,
      createdCount: result.createdCount,
      skippedCount: result.skipped.length,
      skipped: result.skipped,
      failedCount: result.failed.length,
      failed: result.failed,
      invoicesPreview: formattedPreview,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
