import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

export async function GET() {
  const taxes = await prisma.tax.findMany({
    where: { isActive: true },
    orderBy: { rateBp: 'asc' },
  });

  return NextResponse.json({ taxes });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !hasPermission(session.role, 'taxes', 'create')) {
    return NextResponse.json({ error: 'FORBIDDEN: Admin role required' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, rateBp, type, priceIncluded, scope, gstComponent } = body;

    const tax = await prisma.tax.create({
      data: {
        name,
        rateBp: Number(rateBp || 0),
        type: type || 'percent',
        priceIncluded: !!priceIncluded,
        scope: scope || 'all',
        gstComponent: gstComponent || null,
      },
    });

    return NextResponse.json({ success: true, tax });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
