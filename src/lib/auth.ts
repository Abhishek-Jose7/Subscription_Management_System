import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import prisma from '@/lib/db';
import { UserRole } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'loopbook-dev-secret-change-in-production';
const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'loopbook_session';

export interface AuthSession {
  userId: string;
  email: string;
  role: UserRole;
  name: string;
  customerId?: string | null;
}

/**
 * Password Policy (PRD Decision D1):
 * - Minimum 9 characters (> 8)
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 special character (e.g. !@#$%^&*()_+-=[]{}|;:,.<>?)
 * - Digits allowed, not required
 */
export function validatePassword(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (password.length < 9) {
    errors.push('Password must be at least 9 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?~`\\/]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Email normalization (PRD Decision D2):
 * Lowercase and trimmed
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Hash password with bcrypt cost 12
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Verify password
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate JWT token
 */
export function signToken(payload: AuthSession): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): AuthSession | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthSession;
  } catch {
    return null;
  }
}

/**
 * Get current session from cookies in Server Components / API Route Handlers
 */
export async function getSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = verifyToken(token);
  if (!session) return null;

  // Verify user is still active in DB
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { customer: true },
  });

  if (!user || !user.isActive) {
    return null;
  }

  return {
    userId: user.id,
    email: user.emailNorm,
    role: user.role,
    name: user.name,
    customerId: user.customer?.id ?? null,
  };
}
