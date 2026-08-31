import { NextResponse } from 'next/server';
import { getRecentEvents } from '@/lib/store';
import { requireRole, isAuthResponse } from '@/lib/auth';

export async function GET(request: Request) {
  const auth = requireRole(request, 'viewer');
  if (isAuthResponse(auth)) return auth;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);
  const casinoId = searchParams.get('casinoId') || auth.casinoId;
  try {
    return NextResponse.json(getRecentEvents(limit, casinoId));
  } catch (e) {
    return NextResponse.json({ error: 'Failed to load events' }, { status: 500 });
  }
}
