import { NextResponse } from 'next/server';
import { getAlertsList, acknowledgeAlert, acknowledgeAlertBulk } from '@/lib/store';
import { requireRole, isAuthResponse } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(request: Request) {
  const auth = requireRole(request, 'viewer');
  if (isAuthResponse(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);
  const casinoId = searchParams.get('casinoId') || auth.casinoId;
  const severity = searchParams.get('severity') || undefined;
  const type = searchParams.get('type') || undefined;
  const playerId = searchParams.get('playerId') || undefined;
  const since = searchParams.get('since') || undefined;
  const acknowledgedParam = searchParams.get('acknowledged');
  const acknowledged = acknowledgedParam === 'true' ? true : acknowledgedParam === 'false' ? false : undefined;

  try {
    const alerts = getAlertsList({ limit, casinoId, severity, type, playerId, since, acknowledged });
    return NextResponse.json(alerts);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to load alerts' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = requireRole(request, 'triage');
  if (isAuthResponse(auth)) return auth;

  try {
    const body = await request.json();
    if (Array.isArray(body.ids)) {
      const n = acknowledgeAlertBulk(body.ids as string[]);
      logAudit('acknowledge_bulk', auth.actor, { details: `${n} alerts` });
      return NextResponse.json({ ok: true, acknowledged: n });
    }
    const id = body.id as string;
    if (!id) return NextResponse.json({ error: 'id or ids required' }, { status: 400 });
    acknowledgeAlert(id);
    logAudit('acknowledge', auth.actor, { target: id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to acknowledge' }, { status: 500 });
  }
}
