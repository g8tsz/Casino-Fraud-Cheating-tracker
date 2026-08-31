/**
 * Ingest endpoint – validated events, auth, rate limit, idempotency.
 */
import { NextResponse } from 'next/server';
import { persistEvents } from '@/lib/store';
import { runDetections } from '@/lib/detection';
import { requireIngestAuth, checkRateLimit, isAuthResponse } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import type { CasinoEvent, GameType } from '@/lib/types';

const MAX_BATCH = Number(process.env.INGEST_MAX_BATCH) || 500;
const VALID_TYPES = new Set(['bet', 'win', 'request', 'session_start', 'session_end', 'chip_move']);
const VALID_GAMES = new Set(['slots', 'blackjack', 'roulette', 'poker', 'craps', 'baccarat']);

function normalizeEvent(raw: Record<string, unknown>): { event: CasinoEvent | null; error?: string } {
  const type = raw.type as string;
  if (!VALID_TYPES.has(type)) return { event: null, error: `invalid type: ${type}` };
  const timestamp = raw.timestamp as string;
  if (!timestamp || Number.isNaN(Date.parse(timestamp))) return { event: null, error: 'timestamp required (ISO 8601)' };

  const gameType = raw.gameType as string | undefined;
  if (gameType && !VALID_GAMES.has(gameType)) return { event: null, error: `invalid gameType: ${gameType}` };

  const observedRtp = typeof raw.observedRtp === 'number' ? raw.observedRtp
    : typeof raw.expectedRtp === 'number' ? raw.expectedRtp : undefined;

  return {
    event: {
      eventId: typeof raw.eventId === 'string' ? raw.eventId.slice(0, 128) : undefined,
      casinoId: typeof raw.casinoId === 'string' ? raw.casinoId.slice(0, 64) : undefined,
      type: type as CasinoEvent['type'],
      playerId: typeof raw.playerId === 'string' ? raw.playerId.slice(0, 128) : undefined,
      sessionId: typeof raw.sessionId === 'string' ? raw.sessionId.slice(0, 128) : undefined,
      gameId: typeof raw.gameId === 'string' ? raw.gameId.slice(0, 128) : undefined,
      tableId: typeof raw.tableId === 'string' ? raw.tableId.slice(0, 128) : undefined,
      gameType: gameType as GameType | undefined,
      roundId: typeof raw.roundId === 'string' ? raw.roundId.slice(0, 128) : undefined,
      amount: typeof raw.amount === 'number' ? raw.amount : undefined,
      currency: typeof raw.currency === 'string' ? raw.currency.slice(0, 8) : undefined,
      timestamp,
      statusCode: typeof raw.statusCode === 'number' ? raw.statusCode : undefined,
      path: typeof raw.path === 'string' ? raw.path.slice(0, 256) : undefined,
      method: typeof raw.method === 'string' ? raw.method.slice(0, 16) : undefined,
      responseTimeMs: typeof raw.responseTimeMs === 'number' ? raw.responseTimeMs : undefined,
      observedRtp,
      expectedRtp: observedRtp,
      fromPlayerId: typeof raw.fromPlayerId === 'string' ? raw.fromPlayerId.slice(0, 128) : undefined,
      toPlayerId: typeof raw.toPlayerId === 'string' ? raw.toPlayerId.slice(0, 128) : undefined,
      ip: typeof raw.ip === 'string' ? raw.ip.slice(0, 64) : undefined,
      deviceId: typeof raw.deviceId === 'string' ? raw.deviceId.slice(0, 128) : undefined,
      shoeBetCount: typeof raw.shoeBetCount === 'number' ? raw.shoeBetCount : undefined,
      geo: typeof raw.geo === 'string' ? raw.geo.slice(0, 64) : undefined,
      deviceFingerprint: typeof raw.deviceFingerprint === 'string' ? raw.deviceFingerprint.slice(0, 128) : undefined,
    },
  };
}

export async function POST(request: Request) {
  const auth = requireIngestAuth(request);
  if (isAuthResponse(auth)) return auth;

  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const rawList = Array.isArray(body.events) ? body.events : Array.isArray(body) ? body : [];
    if (rawList.length > MAX_BATCH) {
      return NextResponse.json({ error: `Batch exceeds max ${MAX_BATCH}` }, { status: 400 });
    }

    const events: CasinoEvent[] = [];
    const rejected: string[] = [];
    for (let i = 0; i < rawList.length; i++) {
      const { event, error } = normalizeEvent(rawList[i] as Record<string, unknown>);
      if (event) {
        if (!event.casinoId && auth.casinoId) event.casinoId = auth.casinoId;
        events.push(event);
      } else if (error) rejected.push(`[${i}] ${error}`);
    }

    if (events.length === 0) {
      return NextResponse.json({ ok: true, ingested: 0, alerts: [], alertDetails: [], rejected });
    }

    const ingested = await persistEvents(events);
    const alerts = await runDetections(events);
    logAudit('ingest', auth.actor, { casinoId: events[0]?.casinoId, details: `${ingested} events, ${alerts.length} alerts` });

    return NextResponse.json({
      ok: true,
      ingested,
      skipped: events.length - ingested,
      alerts: alerts.length,
      alertDetails: alerts,
      rejected,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Ingest failed' }, { status: 400 });
  }
}
