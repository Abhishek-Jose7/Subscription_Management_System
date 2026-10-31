import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  const templates = await prisma.quotationTemplate.findMany({
    include: {
      plan: true,
      lines: {
        include: {
          product: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  const formatted = templates.map((t) => ({
    id: t.id,
    name: t.name,
    validityDays: t.validityDays,
    planId: t.planId,
    planName: t.plan.name,
    lines: t.lines.map((l) => ({
      productId: l.productId,
      productName: l.product.name,
      qty: l.qty,
      variantJson: l.variantJson,
      salesPrice: l.product.salesPrice.toString(),
    })),
  }));

  return NextResponse.json({ templates: formatted });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role === 'customer') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, validityDays, planId, lines } = body;

    const template = await prisma.quotationTemplate.create({
      data: {
        name,
        validityDays: Number(validityDays || 15),
        planId,
        lines: lines && Array.isArray(lines) ? {
          create: lines.map((l: any) => ({
            productId: l.productId,
            qty: Number(l.qty || 1),
            variantJson: l.variantJson || null,
          })),
        } : undefined,
      },
      include: { lines: true },
    });

    return NextResponse.json({ success: true, template });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
