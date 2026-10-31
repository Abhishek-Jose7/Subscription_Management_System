import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { voidPayment } from '@/lib/payments/engine';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role === 'customer') {
    return NextResponse.json({ error: 'FORBIDDEN: Staff/Admin access required' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { voidReason } = body;

    if (!voidReason) {
      return NextResponse.json({ error: 'voidReason is required' }, { status: 400 });
    }

    await voidPayment(id, voidReason, session.userId);

    return NextResponse.json({ success: true, message: 'Payment voided and invoice balance restored' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
