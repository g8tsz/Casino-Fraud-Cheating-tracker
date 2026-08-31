/**
 * SQLite persistence – events, alerts, watch list, cases, rules, audit, ML baselines.
 */
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type {
  CasinoEvent,
  FraudAlert,
  WatchListEntry,
  InvestigationCase,
  CaseNote,
  DetectionRule,
  AuditEntry,
  MlBaseline,
  CctvCamera,
} from './types';
import { DEFAULT_RULES as DEFAULT_RULES_LIST } from './types';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'tracker.db');

let db: Database.Database | null = null;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function getDb(): Database.Database {
  if (!db) {
    ensureDataDir();
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema(db);
  }
  return db;
}

function initSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT UNIQUE,
      casino_id TEXT,
      payload TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_events_ts ON events(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_events_casino ON events(casino_id);
    CREATE INDEX IF NOT EXISTS idx_events_event_id ON events(event_id);

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      casino_id TEXT,
      dedupe_key TEXT,
      payload TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      acknowledged INTEGER DEFAULT 0,
      case_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_alerts_ts ON alerts(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_alerts_dedupe ON alerts(dedupe_key);
    CREATE INDEX IF NOT EXISTS idx_alerts_casino ON alerts(casino_id);

    CREATE TABLE IF NOT EXISTS watchlist (
      id TEXT PRIMARY KEY,
      casino_id TEXT,
      payload TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      added_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      casino_id TEXT,
      payload TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rules (
      id TEXT PRIMARY KEY,
      casino_id TEXT,
      rule_key TEXT NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(casino_id, rule_key)
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      casino_id TEXT,
      payload TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ml_baselines (
      key TEXT PRIMARY KEY,
      casino_id TEXT,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alert_cooldowns (
      dedupe_key TEXT PRIMARY KEY,
      last_raised_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      casino_id TEXT,
      player_id TEXT,
      started_at TEXT,
      ended_at TEXT,
      geo TEXT,
      device_fingerprint TEXT,
      payload TEXT
    );

    CREATE TABLE IF NOT EXISTS cameras (
      id TEXT PRIMARY KEY,
      casino_id TEXT,
      table_id TEXT,
      payload TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      added_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cameras_casino ON cameras(casino_id);
    CREATE INDEX IF NOT EXISTS idx_cameras_table ON cameras(table_id);
  `);

  seedDefaultRules(database);
  importCamerasFromFileIfEmpty(database);
}

function importCamerasFromFileIfEmpty(database: Database.Database): void {
  const count = (database.prepare('SELECT COUNT(*) as c FROM cameras').get() as { c: number }).c;
  if (count > 0) return;
  const filePath = process.env.CAMERAS_FILE || path.join(DATA_DIR, 'cameras.json');
  if (!fs.existsSync(filePath)) return;
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as unknown;
    const list = Array.isArray(raw) ? raw : Array.isArray((raw as { cameras?: unknown }).cameras) ? (raw as { cameras: unknown[] }).cameras : [];
    const insert = database.prepare(
      'INSERT OR IGNORE INTO cameras (id, casino_id, table_id, payload, active, added_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (const item of list) {
      const cam = item as Record<string, unknown>;
      if (!cam.name || !cam.streamUrl || !cam.streamType) continue;
      const id = String(cam.id ?? `cam-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
      const payload = JSON.stringify({ ...cam, id, active: cam.active !== false, addedAt: cam.addedAt ?? new Date().toISOString() });
      insert.run(id, cam.casinoId ?? null, cam.tableId ?? null, payload, cam.active !== false ? 1 : 0, cam.addedAt ?? new Date().toISOString());
    }
  } catch (e) {
    console.error('Failed to import cameras.json', e);
  }
}

function seedDefaultRules(database: Database.Database): void {
  const count = (database.prepare('SELECT COUNT(*) as c FROM rules').get() as { c: number }).c;
  if (count > 0) return;
  const insert = database.prepare(
    'INSERT OR IGNORE INTO rules (id, casino_id, rule_key, payload, updated_at) VALUES (?, ?, ?, ?, ?)'
  );
  const now = new Date().toISOString();
  for (const rule of DEFAULT_RULES_LIST) {
    const id = `rule-${rule.ruleKey}-global`;
    insert.run(id, null, rule.ruleKey, JSON.stringify({ ...rule, id, updatedAt: now }), now);
  }
}

export function parseEvent(row: { payload: string }): CasinoEvent {
  return JSON.parse(row.payload) as CasinoEvent;
}

export function parseAlert(row: { id: string; payload: string; acknowledged: number; case_id?: string | null }): FraudAlert {
  const alert = JSON.parse(row.payload) as FraudAlert;
  alert.id = row.id;
  alert.acknowledged = row.acknowledged === 1;
  if (row.case_id) alert.caseId = row.case_id;
  return alert;
}

export function insertEvent(evt: CasinoEvent): boolean {
  const database = getDb();
  if (evt.eventId) {
    const existing = database.prepare('SELECT 1 FROM events WHERE event_id = ?').get(evt.eventId);
    if (existing) return false;
  }
  database.prepare(
    'INSERT INTO events (event_id, casino_id, payload, timestamp) VALUES (?, ?, ?, ?)'
  ).run(evt.eventId ?? null, evt.casinoId ?? null, JSON.stringify(evt), evt.timestamp);
  return true;
}

export function getEvents(opts: { limit?: number; casinoId?: string; playerId?: string; since?: string } = {}): CasinoEvent[] {
  const { limit = 200, casinoId, playerId, since } = opts;
  let sql = 'SELECT payload FROM events WHERE 1=1';
  const params: unknown[] = [];
  if (casinoId) { sql += ' AND casino_id = ?'; params.push(casinoId); }
  if (since) { sql += ' AND timestamp >= ?'; params.push(since); }
  sql += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(limit);
  const rows = getDb().prepare(sql).all(...params) as { payload: string }[];
  let events = rows.map(parseEvent);
  if (playerId) events = events.filter((e) => e.playerId === playerId);
  return events;
}

export function insertAlert(alert: FraudAlert): FraudAlert {
  getDb().prepare(
    'INSERT INTO alerts (id, casino_id, dedupe_key, payload, timestamp, acknowledged, case_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    alert.id,
    alert.casinoId ?? null,
    alert.dedupeKey ?? null,
    JSON.stringify(alert),
    alert.timestamp,
    alert.acknowledged ? 1 : 0,
    alert.caseId ?? null
  );
  return alert;
}

export function getAlerts(opts: {
  limit?: number;
  casinoId?: string;
  severity?: string;
  type?: string;
  playerId?: string;
  acknowledged?: boolean;
  since?: string;
} = {}): FraudAlert[] {
  const { limit = 100, casinoId, severity, type, playerId, acknowledged, since } = opts;
  let sql = 'SELECT id, payload, acknowledged, case_id FROM alerts WHERE 1=1';
  const params: unknown[] = [];
  if (casinoId) { sql += ' AND casino_id = ?'; params.push(casinoId); }
  if (since) { sql += ' AND timestamp >= ?'; params.push(since); }
  if (acknowledged !== undefined) { sql += ' AND acknowledged = ?'; params.push(acknowledged ? 1 : 0); }
  sql += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(Math.min(limit, 500));
  let alerts = (getDb().prepare(sql).all(...params) as { id: string; payload: string; acknowledged: number; case_id: string | null }[])
    .map(parseAlert);
  if (severity) alerts = alerts.filter((a) => a.severity === severity);
  if (type) alerts = alerts.filter((a) => a.type === type);
  if (playerId) alerts = alerts.filter((a) => a.playerId === playerId);
  return alerts;
}

export function acknowledgeAlerts(ids: string[]): number {
  const stmt = getDb().prepare('UPDATE alerts SET acknowledged = 1 WHERE id = ?');
  let n = 0;
  for (const id of ids) {
    const r = stmt.run(id);
    if (r.changes) n++;
  }
  return n;
}

export function findOpenAlertByDedupe(dedupeKey: string, cooldownMs: number): FraudAlert | null {
  const database = getDb();
  const cooldown = database.prepare('SELECT last_raised_at FROM alert_cooldowns WHERE dedupe_key = ?').get(dedupeKey) as { last_raised_at: string } | undefined;
  if (cooldown) {
    const elapsed = Date.now() - new Date(cooldown.last_raised_at).getTime();
    if (elapsed < cooldownMs) return null;
  }
  const row = database.prepare(
    'SELECT id, payload, acknowledged, case_id FROM alerts WHERE dedupe_key = ? AND acknowledged = 0 ORDER BY timestamp DESC LIMIT 1'
  ).get(dedupeKey) as { id: string; payload: string; acknowledged: number; case_id: string | null } | undefined;
  if (row) {
    const alert = parseAlert(row);
    const age = Date.now() - new Date(alert.timestamp).getTime();
    if (age < cooldownMs) return alert;
  }
  return null;
}

export function markDedupeRaised(dedupeKey: string): void {
  getDb().prepare(
    'INSERT OR REPLACE INTO alert_cooldowns (dedupe_key, last_raised_at) VALUES (?, ?)'
  ).run(dedupeKey, new Date().toISOString());
}

export function getWatchList(activeOnly = true, casinoId?: string): WatchListEntry[] {
  let sql = 'SELECT payload, active FROM watchlist WHERE 1=1';
  const params: unknown[] = [];
  if (casinoId) { sql += ' AND casino_id = ?'; params.push(casinoId); }
  if (activeOnly) sql += ' AND active = 1';
  const rows = getDb().prepare(sql).all(...params) as { payload: string; active: number }[];
  const now = new Date().toISOString();
  return rows
    .map((r) => JSON.parse(r.payload) as WatchListEntry)
    .filter((w) => !activeOnly || (w.active && (!w.expiresAt || w.expiresAt > now)));
}

export function addWatchListEntry(entry: WatchListEntry): WatchListEntry {
  getDb().prepare('INSERT INTO watchlist (id, casino_id, payload, active, added_at) VALUES (?, ?, ?, ?, ?)').run(
    entry.id, entry.casinoId ?? null, JSON.stringify(entry), entry.active ? 1 : 0, entry.addedAt
  );
  return entry;
}

export function removeWatchListEntry(id: string): boolean {
  const r = getDb().prepare('UPDATE watchlist SET active = 0 WHERE id = ?').run(id);
  return r.changes > 0;
}

export function getCases(casinoId?: string): InvestigationCase[] {
  let sql = 'SELECT payload FROM cases ORDER BY updated_at DESC';
  const params: unknown[] = [];
  if (casinoId) { sql = 'SELECT payload FROM cases WHERE casino_id = ? ORDER BY updated_at DESC'; params.push(casinoId); }
  return (getDb().prepare(sql).all(...params) as { payload: string }[]).map((r) => JSON.parse(r.payload) as InvestigationCase);
}

export function saveCase(c: InvestigationCase): InvestigationCase {
  getDb().prepare(
    'INSERT OR REPLACE INTO cases (id, casino_id, payload, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(c.id, c.casinoId ?? null, JSON.stringify(c), c.status, c.createdAt, c.updatedAt);
  return c;
}

export function getRules(casinoId?: string): DetectionRule[] {
  const rows = getDb().prepare('SELECT payload FROM rules ORDER BY rule_key').all() as { payload: string }[];
  let rules = rows.map((r) => JSON.parse(r.payload) as DetectionRule);
  if (casinoId) {
    const overrides = rules.filter((r) => r.casinoId === casinoId);
    const global = rules.filter((r) => !r.casinoId);
    const keys = new Set(overrides.map((r) => r.ruleKey));
    rules = [...overrides, ...global.filter((r) => !keys.has(r.ruleKey))];
  } else {
    rules = rules.filter((r) => !r.casinoId);
  }
  return rules;
}

export function saveRule(rule: DetectionRule): DetectionRule {
  getDb().prepare(
    'INSERT OR REPLACE INTO rules (id, casino_id, rule_key, payload, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).run(rule.id, rule.casinoId ?? null, rule.ruleKey, JSON.stringify(rule), rule.updatedAt);
  return rule;
}

export function getRule(casinoId: string | undefined, ruleKey: string): DetectionRule | undefined {
  return getRules(casinoId).find((r) => r.ruleKey === ruleKey);
}

export function addAudit(entry: AuditEntry): void {
  getDb().prepare('INSERT INTO audit_log (id, casino_id, payload, timestamp) VALUES (?, ?, ?, ?)').run(
    entry.id, entry.casinoId ?? null, JSON.stringify(entry), entry.timestamp
  );
}

export function getAuditLog(limit = 100, casinoId?: string): AuditEntry[] {
  let sql = 'SELECT payload FROM audit_log ORDER BY timestamp DESC LIMIT ?';
  const params: unknown[] = [limit];
  if (casinoId) { sql = 'SELECT payload FROM audit_log WHERE casino_id = ? ORDER BY timestamp DESC LIMIT ?'; params.unshift(casinoId); }
  return (getDb().prepare(sql).all(...params) as { payload: string }[]).map((r) => JSON.parse(r.payload) as AuditEntry);
}

export function upsertSession(sessionId: string, data: Record<string, unknown>): void {
  getDb().prepare(
    'INSERT OR REPLACE INTO sessions (session_id, casino_id, player_id, started_at, ended_at, geo, device_fingerprint, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    sessionId,
    data.casinoId ?? null,
    data.playerId ?? null,
    data.startedAt ?? null,
    data.endedAt ?? null,
    data.geo ?? null,
    data.deviceFingerprint ?? null,
    JSON.stringify(data)
  );
}

export function getSession(sessionId: string): Record<string, unknown> | null {
  const row = getDb().prepare('SELECT payload FROM sessions WHERE session_id = ?').get(sessionId) as { payload: string } | undefined;
  return row ? JSON.parse(row.payload) : null;
}

export function getMlBaseline(key: string): MlBaseline | null {
  const row = getDb().prepare('SELECT payload FROM ml_baselines WHERE key = ?').get(key) as { payload: string } | undefined;
  return row ? JSON.parse(row.payload) as MlBaseline : null;
}

export function saveMlBaseline(baseline: MlBaseline): void {
  getDb().prepare('INSERT OR REPLACE INTO ml_baselines (key, casino_id, payload, updated_at) VALUES (?, ?, ?, ?)').run(
    baseline.key, baseline.casinoId ?? null, JSON.stringify(baseline), baseline.updatedAt
  );
}

export function linkAlertToCase(alertId: string, caseId: string): void {
  getDb().prepare('UPDATE alerts SET case_id = ? WHERE id = ?').run(caseId, alertId);
}

export function getCameras(opts: { casinoId?: string; tableId?: string; activeOnly?: boolean } = {}): CctvCamera[] {
  const { casinoId, tableId, activeOnly = true } = opts;
  let sql = 'SELECT payload, active FROM cameras WHERE 1=1';
  const params: unknown[] = [];
  if (casinoId) { sql += ' AND casino_id = ?'; params.push(casinoId); }
  if (tableId) { sql += ' AND table_id = ?'; params.push(tableId); }
  if (activeOnly) sql += ' AND active = 1';
  sql += ' ORDER BY added_at DESC';
  return (getDb().prepare(sql).all(...params) as { payload: string; active: number }[])
    .map((r) => JSON.parse(r.payload) as CctvCamera)
    .filter((c) => !activeOnly || c.active);
}

export function getCameraById(id: string): CctvCamera | null {
  const row = getDb().prepare('SELECT payload FROM cameras WHERE id = ? AND active = 1').get(id) as { payload: string } | undefined;
  return row ? JSON.parse(row.payload) as CctvCamera : null;
}

export function saveCamera(camera: CctvCamera): CctvCamera {
  getDb().prepare(
    'INSERT OR REPLACE INTO cameras (id, casino_id, table_id, payload, active, added_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(camera.id, camera.casinoId ?? null, camera.tableId ?? null, JSON.stringify(camera), camera.active ? 1 : 0, camera.addedAt);
  return camera;
}

export function removeCamera(id: string): boolean {
  const r = getDb().prepare('UPDATE cameras SET active = 0 WHERE id = ?').run(id);
  return r.changes > 0;
}

export function importCameras(cameras: CctvCamera[]): number {
  let n = 0;
  for (const c of cameras) {
    saveCamera(c);
    n++;
  }
  return n;
}
