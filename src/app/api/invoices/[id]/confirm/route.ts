import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getNextSequenceNumber } from '@/lib/numbering';

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
    });

    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    if (invoice.status !== 'draft') {
      return NextResponse.json({ error: 'Only draft invoices can be confirmed' }, { status: 400 });
    }

    const number = await getNextSequenceNumber('INV');
    const newStatus = invoice.total === 0n ? 'paid' : 'confirmed';

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        number,
        status: newStatus,
      },
    });

    return NextResponse.json({ success: true, invoice: { ...updated, total: updated.total.toString() } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
