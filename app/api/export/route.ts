import { NextResponse } from 'next/server';
import { getAlertsList, getRecentEvents } from '@/lib/store';
import { buildSarExport, sarCsv, retentionCutoffIso } from '@/lib/regulatory';
import { requireRole, isAuthResponse } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(request: Request) {
  const auth = requireRole(request, 'admin');
  if (isAuthResponse(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'json';
  const type = searchParams.get('type') || 'sar';
  const casinoId = searchParams.get('casinoId') || auth.casinoId;
  const since = searchParams.get('since') || retentionCutoffIso();

  logAudit('export', auth.actor, { casinoId, details: `${type}/${format}` });

  if (type === 'sar') {
    const rows = buildSarExport(casinoId, since);
    if (format === 'csv') {
      return new NextResponse(sarCsv(rows), {
        headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename=sar-export.csv' },
      });
    }
    return NextResponse.json({ report: rows, retentionSince: since });
  }

  if (type === 'alerts') {
    const data = getAlertsList({ limit: 500, casinoId, since });
    if (format === 'csv') {
      const headers = ['id', 'type', 'severity', 'title', 'playerId', 'timestamp', 'acknowledged'];
      const csv = [headers.join(','), ...data.map((a) => headers.map((h) => {
        const val = h === 'id' ? a.id : h === 'type' ? a.type : h === 'severity' ? a.severity : h === 'title' ? a.title : h === 'playerId' ? a.playerId : h === 'timestamp' ? a.timestamp : h === 'acknowledged' ? a.acknowledged : '';
        return `"${String(val ?? '').replace(/"/g, '""')}"`;
      }).join(','))].join('\n');
      return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename=alerts.csv' } });
    }
    return NextResponse.json(data);
  }

  const events = getRecentEvents(500, casinoId);
  return NextResponse.json(events);
}
