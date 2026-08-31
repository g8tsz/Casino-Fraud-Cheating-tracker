import { NextResponse } from 'next/server';
import { parseAuth } from '@/lib/auth';

export async function GET(request: Request) {
  const ctx = parseAuth(request);
  return NextResponse.json({ role: ctx.role, actor: ctx.actor, casinoId: ctx.casinoId, authenticated: ctx.authenticated });
}
