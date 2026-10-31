import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { businessDate } from '@/lib/clock';

export async function GET() {
  const session = await getSession();
  if (!session || session.role === 'customer') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const today = await businessDate();

  // Find active subscriptions with expiryDate within 60 days
  const future60 = new Date(today);
  future60.setDate(future60.getDate() + 60);

  const expiringSubs = await prisma.subscription.findMany({
    where: {
      status: 'active',
      expiryDate: {
        gte: today,
        lte: future60,
      },
    },
    include: {
      customer: true,
      plan: true,
      lines: true,
    },
    orderBy: { expiryDate: 'asc' },
  });

  const formatted = expiringSubs.map((sub) => {
    const expiryTime = new Date(sub.expiryDate!).setHours(0, 0, 0, 0);
    const todayTime = new Date(today).setHours(0, 0, 0, 0);
    const daysUntilExpiry = Math.ceil((expiryTime - todayTime) / (1000 * 60 * 60 * 24));

    let windowBucket: '7' | '30' | '60' = '60';
    if (daysUntilExpiry <= 7) windowBucket = '7';
    else if (daysUntilExpiry <= 30) windowBucket = '30';

    return {
      id: sub.id,
      number: sub.number,
      customerName: sub.customer.company || sub.customer.name,
      planName: sub.plan.name,
      expiryDate: sub.expiryDate,
      daysUntilExpiry,
      windowBucket,
      allowRenew: sub.plan.allowRenew,
      autoRenew: sub.autoRenew,
      totalAmount: sub.lines.reduce((s, l) => s + l.unitPrice * BigInt(l.quantity), 0n).toString(),
    };
  });

  return NextResponse.json({ renewals: formatted });
}
