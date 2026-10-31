import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { businessDate } from '@/lib/clock';
import { computeDerivedInvoiceStatus } from '@/lib/payments/engine';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { id } = await params;
  const today = await businessDate();

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      subscription: {
        include: { plan: true },
      },
      lines: true,
      payments: {
        orderBy: { paymentDate: 'desc' },
      },
    },
  });

  // Strict IDOR guard: return 404 (not 403) for unauthorized customer
  if (!invoice || (session.role === 'customer' && invoice.customerId !== session.customerId)) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  const derived = computeDerivedInvoiceStatus(
    invoice.status,
    invoice.total,
    invoice.amountPaid,
    invoice.dueDate,
    today
  );

  const formatted = {
    id: invoice.id,
    number: invoice.number || 'DRAFT',
    status: invoice.status,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
    subtotal: invoice.subtotal.toString(),
    discountTotal: invoice.discountTotal.toString(),
    taxTotal: invoice.taxTotal.toString(),
    total: invoice.total.toString(),
    amountPaid: invoice.amountPaid.toString(),
    balance: derived.balance.toString(),
    isOverdue: derived.isOverdue,
    isPartiallyPaid: derived.isPartiallyPaid,
    agingBucket: derived.agingBucket,
    daysPastDue: derived.daysPastDue,
    customer: {
      id: invoice.customer.id,
      name: invoice.customer.name,
      company: invoice.customer.company,
      billingAddress: invoice.customer.billingAddress,
      taxId: invoice.customer.taxId,
      phone: invoice.customer.phone,
    },
    subscription: {
      id: invoice.subscription.id,
      number: invoice.subscription.number,
      planName: invoice.subscription.plan.name,
    },
    lines: invoice.lines.map((l) => ({
      id: l.id,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice.toString(),
      discountAmount: l.discountAmount.toString(),
      taxAmount: l.taxAmount.toString(),
      amount: l.amount.toString(),
      explain: l.explainJson ? JSON.parse(l.explainJson) : null,
    })),
    payments: invoice.payments.map((p) => ({
      id: p.id,
      method: p.method,
      amount: p.amount.toString(),
      paymentDate: p.paymentDate,
      reference: p.reference,
      note: p.note,
      status: p.status,
    })),
  };

  return NextResponse.json({ invoice: formatted });
}
