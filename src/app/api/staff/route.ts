import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { normalizeEmail, hashPassword } from '@/lib/auth';
import crypto from 'crypto';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'FORBIDDEN: Admin access required' }, { status: 403 });
  }

  const staffUsers = await prisma.user.findMany({
    where: { role: 'staff' },
    select: {
      id: true,
      name: true,
      emailNorm: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ staff: staffUsers });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'FORBIDDEN: Admin access required' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, email, initialPassword } = body;

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }

    const emailNorm = normalizeEmail(email);

    const existing = await prisma.user.findUnique({
      where: { emailNorm },
    });

    if (existing) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 });
    }

    // Default password or generate token
    const passwordToUse = initialPassword || 'Staff@123!';
    const passwordHash = await hashPassword(passwordToUse);

    const newUser = await prisma.user.create({
      data: {
        name,
        emailNorm,
        passwordHash,
        role: 'staff',
      },
      select: {
        id: true,
        name: true,
        emailNorm: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Create 72-hour invite token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 72);

    await prisma.passwordToken.create({
      data: {
        userId: newUser.id,
        tokenHash,
        purpose: 'invite',
        expiresAt,
      },
    });

    return NextResponse.json({
      success: true,
      user: newUser,
      inviteToken: rawToken,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
