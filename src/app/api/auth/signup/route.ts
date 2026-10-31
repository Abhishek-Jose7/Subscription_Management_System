import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { validatePassword, normalizeEmail, hashPassword, signToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password, company, billingAddress, phone } = body;

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }

    // Password validation (D1)
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.isValid) {
      return NextResponse.json(
        { error: 'PASSWORD_POLICY_VIOLATION', details: passwordCheck.errors },
        { status: 400 }
      );
    }

    const emailNorm = normalizeEmail(email);

    // Email unique check (D2)
    const existing = await prisma.user.findUnique({
      where: { emailNorm },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'EMAIL_ALREADY_REGISTERED', message: 'An account with this email already exists' },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);

    // Transaction to create User + Customer shell (D3, D4: public signup is always customer)
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name,
          emailNorm,
          passwordHash,
          role: 'customer',
        },
      });

      await tx.customer.create({
        data: {
          userId: newUser.id,
          name,
          company: company || null,
          billingAddress: billingAddress || null,
          phone: phone || null,
        },
      });

      return newUser;
    });

    // Auto-login: issue session cookie
    const token = signToken({
      userId: user.id,
      email: user.emailNorm,
      role: user.role,
      name: user.name,
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
      },
    });
  } catch (err: any) {
    console.error('Signup error:', err);
    return NextResponse.json({ error: err.message || 'Signup failed' }, { status: 500 });
  }
}
