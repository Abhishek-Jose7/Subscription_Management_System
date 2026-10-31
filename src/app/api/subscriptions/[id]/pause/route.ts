import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { businessDate } from '@/lib/clock';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { action, pausedUntil } = body; // action: 'pause' | 'resume'

    const sub = await prisma.subscription.findUnique({
      where: { id },
      include: { plan: true },
    });

    if (!sub) return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });

    if (session.role === 'customer' && sub.customerId !== session.customerId) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    const today = await businessDate();

    if (action === 'pause') {
      if (!sub.plan.allowPause) {
        return NextResponse.json(
          { error: 'PLAN_DOES_NOT_ALLOW_PAUSE', message: 'This plan does not permit pausing subscriptions' },
          { status: 403 }
        );
      }

      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          pausedFrom: today,
          pausedUntil: pausedUntil ? new Date(pausedUntil) : null,
        },
      });

      await prisma.subscriptionEvent.create({
        data: {
          subscriptionId: sub.id,
          type: 'paused',
          actor: session.userId,
          reason: `Paused until ${pausedUntil || 'indefinite'}`,
        },
      });

      return NextResponse.json({ success: true, message: 'Subscription paused' });
    } else {
      // Resume
      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          pausedFrom: null,
          pausedUntil: null,
        },
      });

      await prisma.subscriptionEvent.create({
        data: {
          subscriptionId: sub.id,
          type: 'resumed',
          actor: session.userId,
          reason: 'Resumed by user',
        },
      });

      return NextResponse.json({ success: true, message: 'Subscription resumed' });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
