import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(process.env.SESSION_COOKIE_NAME || 'loopbook_session');
  return NextResponse.json({ success: true });
}
