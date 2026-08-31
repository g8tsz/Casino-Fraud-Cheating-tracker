import { NextResponse } from 'next/server';
import { getWatchListEntries, addToWatchList, removeFromWatchList } from '@/lib/store';
import { requireRole, isAuthResponse } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(request: Request) {
  const auth = requireRole(request, 'viewer');
  if (isAuthResponse(auth)) return auth;
  const { searchParams } = new URL(request.url);
  const casinoId = searchParams.get('casinoId') || auth.casinoId;
  try {
    return NextResponse.json(getWatchListEntries(casinoId));
  } catch (e) {
    return NextResponse.json({ error: 'Failed to load watch list' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = requireRole(request, 'triage');
  if (isAuthResponse(auth)) return auth;
  try {
    const body = await request.json();
    const kind = (body.kind as 'player' | 'table' | 'session' | 'ip') || 'player';
    const value = String(body.value ?? '').trim();
    const reason = String(body.reason ?? 'Manual add').trim();
    if (!value) return NextResponse.json({ error: 'value required' }, { status: 400 });
    const entry = addToWatchList({
      kind,
      value,
      reason,
      active: true,
      expiresAt: body.expiresAt,
      casinoId: body.casinoId || auth.casinoId,
    });
    logAudit('watchlist_add', auth.actor, { target: value, casinoId: entry.casinoId });
    return NextResponse.json(entry);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to add to watch list' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = requireRole(request, 'triage');
  if (isAuthResponse(auth)) return auth;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const ok = removeFromWatchList(id);
  if (ok) logAudit('watchlist_remove', auth.actor, { target: id });
  return NextResponse.json({ ok });
}
