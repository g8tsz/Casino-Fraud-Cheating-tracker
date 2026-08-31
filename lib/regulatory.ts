/**
 * SAR-style regulatory export templates and retention helpers.
 */
import { getAlerts, getCases } from './db';
import type { SarExportRow, FraudAlert, InvestigationCase } from './types';

const RETENTION_DAYS = Number(process.env.RETENTION_DAYS) || 365;

export function buildSarExport(casinoId?: string, since?: string): SarExportRow[] {
  const alerts = getAlerts({ limit: 500, casinoId, since, severity: undefined });
  const cases = getCases(casinoId);
  const caseMap = new Map(cases.map((c) => [c.id, c]));
  const reportId = `SAR-${Date.now()}`;
  const generatedAt = new Date().toISOString();

  return alerts
    .filter((a) => a.severity === 'high' || a.severity === 'critical')
    .map((a) => toSarRow(a, reportId, generatedAt, a.caseId ? caseMap.get(a.caseId) : undefined));
}

function toSarRow(alert: FraudAlert, reportId: string, generatedAt: string, c?: InvestigationCase): SarExportRow {
  return {
    reportId,
    generatedAt,
    casinoId: alert.casinoId,
    alertId: alert.id,
    alertType: alert.type,
    severity: alert.severity,
    playerId: alert.playerId,
    description: alert.description,
    suggestedAction: alert.suggestedAction,
    caseId: c?.id,
    caseStatus: c?.status,
  };
}

export function retentionCutoffIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - RETENTION_DAYS);
  return d.toISOString();
}

export function sarCsv(rows: SarExportRow[]): string {
  const headers = ['reportId', 'generatedAt', 'casinoId', 'alertId', 'alertType', 'severity', 'playerId', 'description', 'suggestedAction', 'caseId', 'caseStatus'];
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h as keyof SarExportRow])).join(','))].join('\n');
}
