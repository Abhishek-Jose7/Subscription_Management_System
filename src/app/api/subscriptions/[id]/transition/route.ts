import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { transitionSubscriptionState } from '@/lib/subscriptions/state-machine';

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
    const { targetStatus, reason } = body;

    if (!targetStatus) {
      return NextResponse.json({ error: 'targetStatus is required' }, { status: 400 });
    }

    const result = await transitionSubscriptionState(id, targetStatus, session.userId, reason);

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          fromStatus: result.fromStatus,
          targetStatus: result.toStatus,
          allowedTransitions: result.allowedTransitions,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      fromStatus: result.fromStatus,
      toStatus: result.toStatus,
      allowedTransitions: result.allowedTransitions,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
