import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role === 'customer') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        payments: {
          where: { status: 'recorded' },
        },
        redemptions: {
          where: { reversedAt: null },
        },
      },
    });

    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    if (invoice.status === 'cancelled') {
      return NextResponse.json({ error: 'Invoice is already cancelled' }, { status: 400 });
    }

    if (invoice.payments.length > 0) {
      return NextResponse.json({
        error: 'CANNOT_CANCEL_INVOICE_WITH_PAYMENTS',
        message: 'Cannot cancel invoice with recorded payments. Void all payments first.',
      }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      // Cancel invoice
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: 'cancelled' },
      });

      // Reverse discount redemptions and decrement used_count
      for (const r of invoice.redemptions) {
        await tx.discountRedemption.update({
          where: { id: r.id },
          data: { reversedAt: new Date() },
        });

        await tx.discount.update({
          where: { id: r.discountId },
          data: { usedCount: { decrement: 1 } },
        });
      }

      await recordAuditLog({
        actorId: session.userId,
        action: 'INVOICE_CANCELLED',
        entity: 'invoice',
        entityId: invoice.id,
        before: { status: invoice.status },
        after: { status: 'cancelled' },
      });
    });

    return NextResponse.json({ success: true, message: 'Invoice cancelled successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
