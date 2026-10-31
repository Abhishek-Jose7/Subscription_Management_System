import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { normalizeEmail, verifyPassword, signToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const emailNorm = normalizeEmail(email);

    const user = await prisma.user.findUnique({
      where: { emailNorm },
      include: { customer: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }, { status: 401 });
    }

    if (!user.isActive) {
      return NextResponse.json({ error: 'ACCOUNT_DEACTIVATED', message: 'This account has been deactivated' }, { status: 403 });
    }

    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      // Increment failed attempts
      await prisma.user.update({
        where: { id: user.id },
        data: { failedAttempts: { increment: 1 } },
      });
      return NextResponse.json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }, { status: 401 });
    }

    // Reset failed attempts
    await prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: 0 },
    });

    // Issue session token
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
        name: user.name,
        role: user.role,
        customerId: user.customer?.id ?? null,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return NextResponse.json({ error: err.message || 'Login failed' }, { status: 500 });
  }
}
