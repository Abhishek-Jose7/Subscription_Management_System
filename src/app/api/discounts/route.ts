import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

export async function GET() {
  const discounts = await prisma.discount.findMany({
    include: {
      discountProducts: {
        include: { product: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const formatted = discounts.map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    value: d.value.toString(),
    minPurchaseAmount: d.minPurchaseAmount.toString(),
    minQuantity: d.minQuantity,
    startDate: d.startDate,
    endDate: d.endDate,
    usageLimit: d.usageLimit,
    usedCount: d.usedCount,
    scope: d.scope,
    stackable: d.stackable,
    isActive: d.isActive,
    products: d.discountProducts.map((dp) => ({ id: dp.productId, name: dp.product.name })),
  }));

  return NextResponse.json({ discounts: formatted });
}

export async function POST(request: Request) {
  const session = await getSession();
  // PRD Hard Rule: Only admin can create discount rules! Staff gets 403!
  if (!session || !hasPermission(session.role, 'discounts', 'create')) {
    return NextResponse.json({ error: 'FORBIDDEN: Only admin can create discount rules' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      name,
      type,
      value,
      minPurchaseAmount,
      minQuantity,
      startDate,
      endDate,
      usageLimit,
      scope,
      stackable,
      productIds,
    } = body;

    const discount = await prisma.discount.create({
      data: {
        name,
        type: type || 'percent',
        value: BigInt(value || 0),
        minPurchaseAmount: BigInt(minPurchaseAmount || 0),
        minQuantity: Number(minQuantity || 0),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        usageLimit: Number(usageLimit || 1),
        scope: scope || 'subscription',
        stackable: !!stackable,
        isActive: true,
        discountProducts: productIds && Array.isArray(productIds) ? {
          create: productIds.map((pid: string) => ({ productId: pid })),
        } : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      discount: {
        ...discount,
        value: discount.value.toString(),
        minPurchaseAmount: discount.minPurchaseAmount.toString(),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
