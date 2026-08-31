import { NextResponse } from 'next/server';
import { getDetectionRules, updateDetectionRule } from '@/lib/store';
import { requireRole, isAuthResponse } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import type { DetectionRule } from '@/lib/types';

export async function GET(request: Request) {
  const auth = requireRole(request, 'viewer');
  if (isAuthResponse(auth)) return auth;
  const { searchParams } = new URL(request.url);
  const casinoId = searchParams.get('casinoId') || auth.casinoId;
  return NextResponse.json(getDetectionRules(casinoId));
}

export async function PATCH(request: Request) {
  const auth = requireRole(request, 'admin');
  if (isAuthResponse(auth)) return auth;
  try {
    const body = await request.json() as Partial<DetectionRule> & { ruleKey: string };
    if (!body.ruleKey) return NextResponse.json({ error: 'ruleKey required' }, { status: 400 });
    const rules = getDetectionRules(body.casinoId || auth.casinoId);
    const existing = rules.find((r) => r.ruleKey === body.ruleKey);
    if (!existing) return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    const updated = updateDetectionRule({
      ...existing,
      enabled: body.enabled ?? existing.enabled,
      threshold: body.threshold ?? existing.threshold,
      thresholdMax: body.thresholdMax ?? existing.thresholdMax,
      label: body.label ?? existing.label,
    });
    logAudit('rule_update', auth.actor, { target: body.ruleKey, details: JSON.stringify({ enabled: updated.enabled, threshold: updated.threshold }) });
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 });
  }
}
