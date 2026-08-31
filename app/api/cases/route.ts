import { NextResponse } from 'next/server';
import { getInvestigationCases, createCase, updateCase } from '@/lib/store';
import { requireRole, isAuthResponse } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import type { CaseStatus, InvestigationCase } from '@/lib/types';

export async function GET(request: Request) {
  const auth = requireRole(request, 'viewer');
  if (isAuthResponse(auth)) return auth;
  const { searchParams } = new URL(request.url);
  const casinoId = searchParams.get('casinoId') || auth.casinoId;
  return NextResponse.json(getInvestigationCases(casinoId));
}

export async function POST(request: Request) {
  const auth = requireRole(request, 'triage');
  if (isAuthResponse(auth)) return auth;
  try {
    const body = await request.json();
    const title = String(body.title ?? '').trim();
    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });
    const c = createCase({
      title,
      status: (body.status as CaseStatus) || 'open',
      alertIds: Array.isArray(body.alertIds) ? body.alertIds : [],
      assignedTo: body.assignedTo,
      casinoId: body.casinoId || auth.casinoId,
      notes: body.note ? [{ id: `note-${Date.now()}`, author: auth.actor, body: String(body.note), createdAt: new Date().toISOString() }] : [],
    });
    logAudit('case_create', auth.actor, { target: c.id, casinoId: c.casinoId });
    return NextResponse.json(c);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create case' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = requireRole(request, 'triage');
  if (isAuthResponse(auth)) return auth;
  try {
    const body = await request.json() as Partial<InvestigationCase> & { note?: string };
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const cases = getInvestigationCases(body.casinoId);
    const existing = cases.find((c) => c.id === body.id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const updated: InvestigationCase = {
      ...existing,
      ...body,
      notes: body.note
        ? [...existing.notes, { id: `note-${Date.now()}`, author: auth.actor, body: body.note, createdAt: new Date().toISOString() }]
        : existing.notes,
    };
    updateCase(updated);
    logAudit('case_update', auth.actor, { target: updated.id, details: updated.status });
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update case' }, { status: 500 });
  }
}
