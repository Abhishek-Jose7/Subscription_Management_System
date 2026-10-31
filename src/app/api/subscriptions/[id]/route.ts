import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { businessDate } from '@/lib/clock';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { id } = await params;

  const sub = await prisma.subscription.findUnique({
    where: { id },
    include: {
      customer: true,
      plan: true,
      paymentTerm: true,
      lines: {
        include: {
          product: {
            include: {
              productTaxes: {
                include: { tax: true },
              },
            },
          },
          discount: true,
        },
      },
      events: {
        orderBy: { at: 'desc' },
      },
      invoices: {
        orderBy: { invoiceDate: 'desc' },
        take: 10,
      },
    },
  });

  // PRD IDOR Requirement: Return 404 (not 403) so existence is not leaked
  if (!sub || (session.role === 'customer' && sub.customerId !== session.customerId)) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
  }

  const today = await businessDate();

  // Strip cost price for customer role
  const formattedLines = sub.lines.map((l) => ({
    id: l.id,
    productId: l.productId,
    productName: l.product.name,
    variantJson: l.variantJson,
    quantity: l.quantity,
    unitPrice: l.unitPrice.toString(),
    discountId: l.discountId,
    discountName: l.discount?.name,
    taxes: l.product.productTaxes.map((pt) => ({
      name: pt.tax.name,
      rateBp: pt.tax.rateBp,
    })),
    lineTotal: (l.unitPrice * BigInt(l.quantity)).toString(),
  }));

  const totalPaise = sub.lines.reduce((s, l) => s + l.unitPrice * BigInt(l.quantity), 0n);

  return NextResponse.json({
    subscription: {
      id: sub.id,
      number: sub.number,
      status: sub.status,
      startDate: sub.startDate,
      expiryDate: sub.expiryDate,
      nextInvoiceDate: sub.nextInvoiceDate,
      billingAnchorDay: sub.billingAnchorDay,
      autoRenew: sub.autoRenew,
      pausedFrom: sub.pausedFrom,
      pausedUntil: sub.pausedUntil,
      closeReason: sub.closeReason,
      quotationExpiresAt: sub.quotationExpiresAt,
      isQuotationExpired: sub.quotationExpiresAt ? sub.quotationExpiresAt < today : false,
      notes: sub.notes,
      customer: {
        id: sub.customer.id,
        name: sub.customer.name,
        company: sub.customer.company,
        billingAddress: sub.customer.billingAddress,
        phone: sub.customer.phone,
        taxId: sub.customer.taxId,
      },
      plan: {
        id: sub.plan.id,
        name: sub.plan.name,
        price: sub.plan.price.toString(),
        billingPeriod: sub.plan.billingPeriod,
        minQuantity: sub.plan.minQuantity,
        allowPause: sub.plan.allowPause,
        allowRenew: sub.plan.allowRenew,
        allowEarlyClose: sub.plan.allowEarlyClose,
      },
      paymentTerm: sub.paymentTerm ? { name: sub.paymentTerm.name, days: sub.paymentTerm.days } : null,
      lines: formattedLines,
      totalPaise: totalPaise.toString(),
      events: sub.events.map((e) => ({
        id: e.id,
        type: e.type,
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        actor: e.actor,
        reason: e.reason,
        at: e.at,
      })),
      recentInvoices: sub.invoices.map((inv) => ({
        id: inv.id,
        number: inv.number,
        status: inv.status,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate,
        total: inv.total.toString(),
        amountPaid: inv.amountPaid.toString(),
      })),
    },
  });
}
