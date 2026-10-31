import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getNextSequenceNumber } from '@/lib/numbering';
import { businessDate } from '@/lib/clock';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const search = searchParams.get('search');
  const customerId = searchParams.get('customerId');

  const where: any = {};

  // Customer role can ONLY view own subscriptions
  if (session.role === 'customer') {
    if (!session.customerId) {
      return NextResponse.json({ subscriptions: [] });
    }
    where.customerId = session.customerId;
  } else if (customerId) {
    where.customerId = customerId;
  }

  if (status && status !== 'all') {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { number: { contains: search, mode: 'insensitive' } },
      { customer: { name: { contains: search, mode: 'insensitive' } } },
      { customer: { company: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const subscriptions = await prisma.subscription.findMany({
    where,
    include: {
      customer: true,
      plan: true,
      lines: {
        include: {
          product: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const formatted = subscriptions.map((s) => ({
    id: s.id,
    number: s.number,
    status: s.status,
    startDate: s.startDate,
    expiryDate: s.expiryDate,
    nextInvoiceDate: s.nextInvoiceDate,
    billingAnchorDay: s.billingAnchorDay,
    autoRenew: s.autoRenew,
    pausedFrom: s.pausedFrom,
    pausedUntil: s.pausedUntil,
    customer: {
      id: s.customer.id,
      name: s.customer.name,
      company: s.customer.company,
    },
    plan: {
      id: s.plan.id,
      name: s.plan.name,
      billingPeriod: s.plan.billingPeriod,
      price: s.plan.price.toString(),
      allowPause: s.plan.allowPause,
      allowRenew: s.plan.allowRenew,
      allowEarlyClose: s.plan.allowEarlyClose,
    },
    lineCount: s.lines.length,
    totalQuantity: s.lines.reduce((sum, l) => sum + l.quantity, 0),
    totalAmount: s.lines.reduce((sum, l) => sum + l.unitPrice * BigInt(l.quantity), 0n).toString(),
  }));

  return NextResponse.json({ subscriptions: formatted });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role === 'customer') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      customerId,
      planId,
      templateId,
      startDate,
      paymentTermId,
      autoRenew,
      notes,
      lines,
    } = body;

    const today = await businessDate();
    const effectiveStartDate = startDate ? new Date(startDate) : today;

    // Check plan
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    });
    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 400 });

    // Validate minQuantity
    const lineItems = lines || [];
    const totalQty = lineItems.reduce((s: number, l: any) => s + Number(l.quantity || 1), 0);
    if (totalQty < plan.minQuantity) {
      return NextResponse.json({
        error: `QUANTITY_BELOW_PLAN_MINIMUM`,
        message: `Total line quantity (${totalQty}) is below plan minimum (${plan.minQuantity})`,
      }, { status: 400 });
    }

    const number = await getNextSequenceNumber('SUB');

    const subscription = await prisma.$transaction(async (tx) => {
      const created = await tx.subscription.create({
        data: {
          number,
          customerId,
          planId,
          templateId: templateId || null,
          status: 'draft',
          startDate: effectiveStartDate,
          billingAnchorDay: effectiveStartDate.getDate(),
          nextInvoiceDate: effectiveStartDate,
          paymentTermId: paymentTermId || null,
          autoRenew: !!autoRenew,
          notes,
          createdBy: session.userId,
          lines: {
            create: lineItems.map((l: any) => ({
              productId: l.productId,
              variantJson: l.variantJson ? JSON.stringify(l.variantJson) : null,
              quantity: Number(l.quantity || 1),
              unitPrice: BigInt(l.unitPrice || 0), // snapshot price (D15)
              taxSnapshotJson: l.taxSnapshotJson || null,
              discountId: l.discountId || null,
            })),
          },
        },
      });

      // Record created event
      await tx.subscriptionEvent.create({
        data: {
          subscriptionId: created.id,
          type: 'created',
          toStatus: 'draft',
          actor: session.userId,
          reason: 'Initial creation',
        },
      });

      return created;
    });

    return NextResponse.json({ success: true, subscription });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
