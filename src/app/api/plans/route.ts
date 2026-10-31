import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

export async function GET() {
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    include: {
      defaultLines: {
        include: {
          product: true,
        },
      },
    },
    orderBy: { price: 'asc' },
  });

  const formatted = plans.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price.toString(),
    billingPeriod: p.billingPeriod,
    minQuantity: p.minQuantity,
    availableFrom: p.availableFrom,
    availableTo: p.availableTo,
    autoCloseOnEnd: p.autoCloseOnEnd,
    allowEarlyClose: p.allowEarlyClose,
    allowPause: p.allowPause,
    allowRenew: p.allowRenew,
    isActive: p.isActive,
    defaultLines: p.defaultLines.map((dl) => ({
      productId: dl.productId,
      productName: dl.product.name,
      qty: dl.qty,
      variantJson: dl.variantJson,
    })),
  }));

  return NextResponse.json({ plans: formatted });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !hasPermission(session.role, 'plans', 'create')) {
    return NextResponse.json({ error: 'FORBIDDEN: Admin role required' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      name,
      price,
      billingPeriod,
      minQuantity,
      autoCloseOnEnd,
      allowEarlyClose,
      allowPause,
      allowRenew,
      availableFrom,
      availableTo,
      defaultLines,
    } = body;

    const plan = await prisma.plan.create({
      data: {
        name,
        price: BigInt(price || 0),
        billingPeriod: billingPeriod || 'monthly',
        minQuantity: minQuantity ? Number(minQuantity) : 1,
        autoCloseOnEnd: !!autoCloseOnEnd,
        allowEarlyClose: !!allowEarlyClose,
        allowPause: !!allowPause,
        allowRenew: allowRenew !== undefined ? !!allowRenew : true,
        availableFrom: availableFrom ? new Date(availableFrom) : null,
        availableTo: availableTo ? new Date(availableTo) : null,
        defaultLines: defaultLines && Array.isArray(defaultLines) ? {
          create: defaultLines.map((dl: any) => ({
            productId: dl.productId,
            qty: Number(dl.qty || 1),
            variantJson: dl.variantJson || null,
          })),
        } : undefined,
      },
    });

    return NextResponse.json({ success: true, plan: { ...plan, price: plan.price.toString() } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
