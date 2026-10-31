import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { recordPayment } from '@/lib/payments/engine';
import { PaymentMethod } from '@prisma/client';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { invoiceId, amount, method, reference, note, idempotencyKey } = body;

    if (!invoiceId || !amount || !idempotencyKey) {
      return NextResponse.json(
        { error: 'invoiceId, amount (paise), and idempotencyKey are required' },
        { status: 400 }
      );
    }

    const result = await recordPayment({
      invoiceId,
      amount: BigInt(amount),
      method: (method as PaymentMethod) || 'upi',
      reference,
      note,
      idempotencyKey,
      recordedBy: session.userId,
    });

    return NextResponse.json({
      success: true,
      isDuplicate: result.isDuplicate,
      payment: {
        ...result.payment,
        amount: result.payment.amount.toString(),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
