import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { signToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { role } = body; // 'admin' | 'staff' | 'customer'

    let targetEmail = 'admin@brightloop.in';
    if (role === 'staff') {
      targetEmail = 'rahul@brightloop.in';
    } else if (role === 'customer') {
      targetEmail = 'sunita@anandbhavan.com';
    }

    const user = await prisma.user.findUnique({
      where: { emailNorm: targetEmail },
      include: { customer: true },
    });

    if (!user) {
      return NextResponse.json({ error: `Demo user for role ${role} not found` }, { status: 404 });
    }

    const token = signToken({
      userId: user.id,
      email: user.emailNorm,
      role: user.role,
      name: user.name,
      customerId: user.customer?.id ?? null,
    });

    const cookieStore = await cookies();
    cookieStore.set(process.env.SESSION_COOKIE_NAME || 'loopbook_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.emailNorm,
        role: user.role,
        name: user.name,
        targetUrl: user.role === 'customer' ? '/portal' : '/app',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Demo switch failed' }, { status: 500 });
  }
}
