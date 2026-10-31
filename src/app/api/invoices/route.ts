import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { businessDate } from '@/lib/clock';
import { computeDerivedInvoiceStatus } from '@/lib/payments/engine';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status');
  const search = searchParams.get('search');
  const customerId = searchParams.get('customerId');

  const today = await businessDate();
  const where: any = {};

  if (session.role === 'customer') {
    if (!session.customerId) return NextResponse.json({ invoices: [] });
    where.customerId = session.customerId;
  } else if (customerId) {
    where.customerId = customerId;
  }

  if (statusFilter && statusFilter !== 'all') {
    if (statusFilter === 'overdue') {
      where.status = 'confirmed';
      where.dueDate = { lt: today };
    } else {
      where.status = statusFilter;
    }
  }

  if (search) {
    where.OR = [
      { number: { contains: search, mode: 'insensitive' } },
      { customer: { name: { contains: search, mode: 'insensitive' } } },
      { customer: { company: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      customer: true,
      subscription: {
        select: { number: true },
      },
    },
    orderBy: { invoiceDate: 'desc' },
    take: 100,
  });

  const formatted = invoices.map((inv) => {
    const derived = computeDerivedInvoiceStatus(
      inv.status,
      inv.total,
      inv.amountPaid,
      inv.dueDate,
      today
    );

    return {
      id: inv.id,
      number: inv.number || 'DRAFT',
      subscriptionId: inv.subscriptionId,
      subscriptionNumber: inv.subscription?.number,
      customerName: inv.customer.company || inv.customer.name,
      status: inv.status,
      invoiceDate: inv.invoiceDate,
      dueDate: inv.dueDate,
      periodStart: inv.periodStart,
      periodEnd: inv.periodEnd,
      total: inv.total.toString(),
      amountPaid: inv.amountPaid.toString(),
      balance: derived.balance.toString(),
      isOverdue: derived.isOverdue,
      isPartiallyPaid: derived.isPartiallyPaid,
      agingBucket: derived.agingBucket,
      daysPastDue: derived.daysPastDue,
    };
  });

  return NextResponse.json({ invoices: formatted });
}
