import { NextResponse } from 'next/server';
import { getAlertsList, getWatchListEntries, getRecentEvents } from '@/lib/store';
import { getCases } from '@/lib/db';
import type { FraudStats, FraudType } from '@/lib/types';
import { FRAUD_TYPES } from '@/lib/types';
import { requireRole, isAuthResponse } from '@/lib/auth';
import { broadcastStats } from '@/lib/sse';

export async function GET(request: Request) {
  const auth = requireRole(request, 'viewer');
  if (isAuthResponse(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const casinoId = searchParams.get('casinoId') || auth.casinoId;

  try {
    const alerts = getAlertsList({ limit: 500, casinoId });
    const watchList = getWatchListEntries(casinoId);
    const events = getRecentEvents(500, casinoId);
    const cases = getCases(casinoId);
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const alerts24h = alerts.filter((a) => new Date(a.timestamp).getTime() > oneDayAgo);
    const byType = FRAUD_TYPES.reduce((acc, t) => {
      acc[t] = alerts24h.filter((a) => a.type === t).length;
      return acc;
    }, {} as Record<FraudType, number>);
    const requests = events.filter((e) => e.type === 'request');
    const badRequests = events.filter((e) => e.type === 'request' && (e.statusCode ?? 0) >= 400);
    const badRequestRate = requests.length > 0 ? badRequests.length / requests.length : 0;
    const stats: FraudStats = {
      casinoId,
      alertsLast24h: alerts24h.length,
      byType,
      badRequestRate: Math.round(badRequestRate * 1000) / 10,
      oddPercentageCount: alerts24h.filter((a) => a.type === 'odd_percentage').length,
      watchListCount: watchList.length,
      openCases: cases.filter((c) => c.status === 'open' || c.status === 'investigating').length,
      mlAnomalyCount: alerts24h.filter((a) => a.type === 'ml_anomaly').length,
    };
    broadcastStats(stats);
    return NextResponse.json(stats);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 });
  }
}
