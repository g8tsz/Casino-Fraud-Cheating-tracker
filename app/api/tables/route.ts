import { NextResponse } from 'next/server';
import { getTableSessions } from '@/lib/store';
import { requireRole, isAuthResponse } from '@/lib/auth';

export async function GET(request: Request) {
  const auth = requireRole(request, 'viewer');
  if (isAuthResponse(auth)) return auth;
  const { searchParams } = new URL(request.url);
  const casinoId = searchParams.get('casinoId') || auth.casinoId;
  return NextResponse.json(getTableSessions(casinoId));
}
