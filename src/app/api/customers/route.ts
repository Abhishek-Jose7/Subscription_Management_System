import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  // Customer role can ONLY view own customer record (IDOR prevention)
  if (session.role === 'customer') {
    if (!session.customerId) {
      return NextResponse.json({ customers: [] });
    }
    const customer = await prisma.customer.findUnique({
      where: { id: session.customerId },
    });
    return NextResponse.json({ customers: customer ? [customer] : [] });
  }

  // Admin and staff can view all customers
  const customers = await prisma.customer.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ customers });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role === 'customer') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, company, billingAddress, state, taxId, phone } = body;

    if (!name) {
      return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });
    }

    const customer = await prisma.customer.create({
      data: {
        name,
        company,
        billingAddress,
        state,
        taxId,
        phone,
      },
    });

    return NextResponse.json({ success: true, customer });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
