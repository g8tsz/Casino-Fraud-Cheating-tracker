/**
 * Data access layer – SQLite with optional external API sync.
 */
import type { CasinoEvent, FraudAlert, WatchListEntry, InvestigationCase, DetectionRule, PlayerProfile, TableSession, CctvCamera } from './types';
import {
  insertEvent,
  getEvents,
  insertAlert,
  getAlerts,
  acknowledgeAlerts,
  findOpenAlertByDedupe,
  markDedupeRaised,
  getWatchList,
  addWatchListEntry,
  removeWatchListEntry,
  getCases,
  saveCase,
  getRules,
  saveRule,
  upsertSession,
  getSession,
  linkAlertToCase,
  getCameras,
  saveCamera,
  removeCamera,
  importCameras,
  getAuditLog as getAuditLogFromDb,
  getDb,
} from './db';
import { retentionCutoffIso } from './regulatory';
import { broadcastAlert } from './sse';
import { dispatchAlertWebhook } from './webhooks';

const DATA_SOURCE = process.env.DATA_SOURCE || 'memory';
const LIVE_API_BASE = (process.env.LIVE_API_BASE_URL || '').replace(/\/$/, '');
const ALERT_COOLDOWN_MS = Number(process.env.ALERT_COOLDOWN_MS) || 5 * 60 * 1000;

async function syncToExternal(path: string, body: unknown, method = 'POST'): Promise<void> {
  if (DATA_SOURCE !== 'api' || !LIVE_API_BASE) return;
  await fetch(`${LIVE_API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.LIVE_API_KEY ? { Authorization: `Bearer ${process.env.LIVE_API_KEY}` } : {}),
    },
    body: JSON.stringify(body),
  }).catch(() => {});
}

async function fetchExternal<T>(path: string): Promise<T | null> {
  if (DATA_SOURCE !== 'api' || !LIVE_API_BASE) return null;
  try {
    const res = await fetch(`${LIVE_API_BASE}${path}`, {
      headers: process.env.LIVE_API_KEY ? { Authorization: `Bearer ${process.env.LIVE_API_KEY}` } : {},
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export function getRecentEvents(limit = 200, casinoId?: string): CasinoEvent[] {
  return getEvents({ limit, casinoId });
}

export async function persistEvents(events: CasinoEvent[]): Promise<number> {
  let inserted = 0;
  for (const evt of events) {
    if (insertEvent(evt)) inserted++;
    if (evt.type === 'session_start' && evt.sessionId) {
      upsertSession(evt.sessionId, {
        casinoId: evt.casinoId,
        playerId: evt.playerId,
        startedAt: evt.timestamp,
        geo: evt.geo,
        deviceFingerprint: evt.deviceFingerprint ?? evt.deviceId,
      });
    }
    if (evt.type === 'session_end' && evt.sessionId) {
      const existing = getSession(evt.sessionId) ?? {};
      upsertSession(evt.sessionId, { ...existing, endedAt: evt.timestamp });
    }
  }
  if (inserted > 0) await syncToExternal('/api/fraud/ingest', { events });
  return inserted;
}

export function getAlertsList(opts: Parameters<typeof getAlerts>[0] = {}): FraudAlert[] {
  return getAlerts(opts);
}

export async function persistAlert(alert: Omit<FraudAlert, 'id'>): Promise<FraudAlert | null> {
  if (alert.dedupeKey) {
    const existing = findOpenAlertByDedupe(alert.dedupeKey, ALERT_COOLDOWN_MS);
    if (existing) return null;
  }
  const full: FraudAlert = {
    ...alert,
    id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  };
  insertAlert(full);
  if (full.dedupeKey) markDedupeRaised(full.dedupeKey);
  broadcastAlert(full);
  await syncToExternal('/api/fraud/alerts', full);
  void dispatchAlertWebhook([full]);
  return full;
}

export function acknowledgeAlert(id: string): void {
  acknowledgeAlerts([id]);
}

export function acknowledgeAlertBulk(ids: string[]): number {
  return acknowledgeAlerts(ids);
}

export function isOnWatchList(playerId?: string, sessionId?: string, tableId?: string, ip?: string, casinoId?: string): boolean {
  const list = getWatchList(true, casinoId);
  if (playerId && list.some((w) => w.kind === 'player' && w.value === playerId)) return true;
  if (sessionId && list.some((w) => w.kind === 'session' && w.value === sessionId)) return true;
  if (tableId && list.some((w) => w.kind === 'table' && w.value === tableId)) return true;
  if (ip && list.some((w) => w.kind === 'ip' && w.value === ip)) return true;
  return false;
}

export function getWatchListEntries(casinoId?: string): WatchListEntry[] {
  return getWatchList(true, casinoId);
}

export function addToWatchList(entry: Omit<WatchListEntry, 'id' | 'addedAt'>): WatchListEntry {
  const full: WatchListEntry = {
    ...entry,
    id: `wl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    addedAt: new Date().toISOString(),
  };
  addWatchListEntry(full);
  return full;
}

export function removeFromWatchList(id: string): boolean {
  return removeWatchListEntry(id);
}

export function getInvestigationCases(casinoId?: string): InvestigationCase[] {
  return getCases(casinoId);
}

export function createCase(data: Omit<InvestigationCase, 'id' | 'createdAt' | 'updatedAt' | 'notes'> & { notes?: InvestigationCase['notes'] }): InvestigationCase {
  const now = new Date().toISOString();
  const c: InvestigationCase = {
    ...data,
    id: `case-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    notes: data.notes ?? [],
    createdAt: now,
    updatedAt: now,
  };
  saveCase(c);
  for (const alertId of c.alertIds) linkAlertToCase(alertId, c.id);
  return c;
}

export function updateCase(c: InvestigationCase): InvestigationCase {
  c.updatedAt = new Date().toISOString();
  if (c.status === 'resolved' || c.status === 'closed') c.resolvedAt = c.resolvedAt ?? new Date().toISOString();
  saveCase(c);
  return c;
}

export function getDetectionRules(casinoId?: string): DetectionRule[] {
  return getRules(casinoId);
}

export function updateDetectionRule(rule: DetectionRule): DetectionRule {
  rule.updatedAt = new Date().toISOString();
  saveRule(rule);
  return rule;
}

export function getPlayerProfile(playerId: string, casinoId?: string): PlayerProfile {
  const events = getEvents({ limit: 500, casinoId }).filter((e) => e.playerId === playerId);
  const alerts = getAlerts({ limit: 100, casinoId, playerId });
  const bets = events.filter((e) => e.type === 'bet');
  const wins = events.filter((e) => e.type === 'win');
  const requests = events.filter((e) => e.type === 'request');
  const totalBet = bets.reduce((s, e) => s + (e.amount ?? 0), 0);
  const totalWin = wins.reduce((s, e) => s + (e.amount ?? 0), 0);
  return {
    playerId,
    casinoId,
    events: events.slice(0, 100),
    alerts,
    onWatchList: isOnWatchList(playerId, undefined, undefined, undefined, casinoId),
    stats: {
      totalBets: bets.length,
      totalWins: wins.length,
      winRatePct: totalBet > 0 ? Math.round((totalWin / totalBet) * 1000) / 10 : 0,
      requestCount: requests.length,
      badRequestCount: requests.filter((e) => (e.statusCode ?? 0) >= 400).length,
    },
  };
}

export function getTableSessions(casinoId?: string): TableSession[] {
  const events = getEvents({ limit: 1000, casinoId }).filter((e) => e.tableId);
  const byTable = new Map<string, CasinoEvent[]>();
  for (const e of events) {
    const t = e.tableId!;
    if (!byTable.has(t)) byTable.set(t, []);
    byTable.get(t)!.push(e);
  }
  const alerts = getAlerts({ limit: 200, casinoId });
  const tableCameras = getCameras({ casinoId });
  return Array.from(byTable.entries()).map(([tableId, evts]) => ({
    tableId,
    casinoId,
    gameType: evts.find((e) => e.gameType)?.gameType,
    players: [...new Set(evts.map((e) => e.playerId).filter(Boolean))] as string[],
    eventCount: evts.length,
    chipMoves: evts.filter((e) => e.type === 'chip_move').length,
    alerts: alerts.filter((a) => a.tableId === tableId),
    lastActivity: evts[0]?.timestamp ?? '',
    cameras: tableCameras.filter((c) => c.tableId === tableId),
  }));
}

export function getCamerasList(opts: { casinoId?: string; tableId?: string } = {}): CctvCamera[] {
  return getCameras(opts);
}

export function registerCamera(camera: CctvCamera): CctvCamera {
  return saveCamera(camera);
}

export function unregisterCamera(id: string): boolean {
  return removeCamera(id);
}

export function importCameraList(cameras: CctvCamera[]): number {
  return importCameras(cameras);
}

export function getAuditLog(limit = 100, casinoId?: string) {
  return getAuditLogFromDb(limit, casinoId);
}

export function runRetentionCleanup(): void {
  const cutoff = retentionCutoffIso();
  const database = getDb();
  database.prepare('DELETE FROM events WHERE timestamp < ?').run(cutoff);
  database.prepare('DELETE FROM alerts WHERE timestamp < ? AND acknowledged = 1').run(cutoff);
}

export async function fetchExternalAlerts(): Promise<FraudAlert[] | null> {
  return fetchExternal<FraudAlert[]>('/api/fraud/alerts');
}
