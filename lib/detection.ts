/**
 * Fraud & cheating detection – all rule types with dedup, per-player/session scope, rules engine.
 */
import type { CasinoEvent, FraudAlert, Severity } from './types';
import { persistAlert, getRecentEvents, isOnWatchList } from './store';
import { getEffectiveRules, ruleEnabled, ruleThreshold, ruleThresholdMax } from './rules';
import { detectMlAnomalies } from './ml-anomaly';
import { getSession } from './db';

const ALERT_COOLDOWN_MS = Number(process.env.ALERT_COOLDOWN_MS) || 5 * 60 * 1000;

function observedRtp(evt: CasinoEvent): number | undefined {
  return evt.observedRtp ?? evt.expectedRtp;
}

async function raise(alert: Omit<FraudAlert, 'id'>): Promise<FraudAlert | null> {
  return persistAlert(alert);
}

export async function runDetections(events: CasinoEvent[]): Promise<FraudAlert[]> {
  const raised: FraudAlert[] = [];
  const casinoId = events.find((e) => e.casinoId)?.casinoId;
  const rules = getEffectiveRules(casinoId);

  for (const evt of events) {
    if (evt.type === 'request' && ruleEnabled(rules, 'bad_request')) {
      const a = detectBadRequest(evt);
      if (a) { const r = await raise(a); if (r) raised.push(r); }
    }
    if (evt.type === 'win') {
      const rtp = observedRtp(evt);
      if (rtp != null && ruleEnabled(rules, 'rtp_anomaly')) {
        const a = detectRtpAnomaly(evt, rtp, rules);
        if (a) { const r = await raise(a); if (r) raised.push(r); }
      }
      if (rtp != null && ruleEnabled(rules, 'meter_anomaly')) {
        const a = detectMeterDrift(evt, rtp, rules);
        if (a) { const r = await raise(a); if (r) raised.push(r); }
      }
    }
    if (evt.type === 'chip_move') {
      if (ruleEnabled(rules, 'chip_passing')) {
        const a = detectChipPassing(evt, rules);
        if (a) { const r = await raise(a); if (r) raised.push(r); }
      }
      if (ruleEnabled(rules, 'capping')) {
        const a = detectCapping(evt, events, rules);
        if (a) { const r = await raise(a); if (r) raised.push(r); }
      }
    }
    if (evt.type === 'bet' && evt.gameType === 'blackjack' && ruleEnabled(rules, 'card_counting')) {
      const a = detectCardCounting(evt, rules);
      if (a) { const r = await raise(a); if (r) raised.push(r); }
    }
    if ((evt.type === 'session_start' || evt.type === 'session_end') && ruleEnabled(rules, 'session_anomaly')) {
      const a = detectSessionAnomaly(evt);
      if (a) { const r = await raise(a); if (r) raised.push(r); }
    }
  }

  const recent = getRecentEvents(500, casinoId);

  if (ruleEnabled(rules, 'bad_request_rate')) {
    const a = detectBadRequestRate(recent, rules);
    if (a) { const r = await raise(a); if (r) raised.push(r); }
  }
  if (ruleEnabled(rules, 'bad_request_path')) {
    for (const a of detectRepeatedBadPaths(recent, rules)) {
      const r = await raise(a);
      if (r) raised.push(r);
    }
  }
  if (ruleEnabled(rules, 'odd_percentage')) {
    for (const a of detectOddPercentageScoped(recent, rules)) {
      const r = await raise(a);
      if (r) raised.push(r);
    }
  }
  if (ruleEnabled(rules, 'rate_abuse')) {
    for (const a of detectRateAbuseScoped(recent, rules)) {
      const r = await raise(a);
      if (r) raised.push(r);
    }
  }
  if (ruleEnabled(rules, 'collusion')) {
    for (const a of detectCollusionSignals(recent, casinoId)) {
      const r = await raise(a);
      if (r) raised.push(r);
    }
  }
  if (ruleEnabled(rules, 'ml_anomaly')) {
    const z = ruleThreshold(rules, 'ml_anomaly', 2.5);
    for (const a of detectMlAnomalies(events, z)) {
      const r = await raise(a);
      if (r) raised.push(r);
    }
  }

  return raised;
}

function detectBadRequest(evt: CasinoEvent): Omit<FraudAlert, 'id'> | null {
  const code = evt.statusCode ?? 0;
  if (code < 400) return null;
  const severity: Severity = code === 401 || code === 403 ? 'high' : code >= 500 ? 'medium' : 'medium';
  const key = evt.sessionId ?? evt.playerId ?? 'unknown';
  return {
    type: 'bad_request',
    severity,
    title: `Bad request: ${evt.path ?? 'unknown'} → ${code}`,
    description: `Client/server error ${code} on ${evt.method ?? 'GET'} ${evt.path ?? ''}.`,
    timestamp: evt.timestamp,
    casinoId: evt.casinoId,
    sourceId: evt.sessionId,
    sessionId: evt.sessionId,
    playerId: evt.playerId,
    suggestedAction: 'Check logs; rate limit or block if repeated.',
    acknowledged: false,
    dedupeKey: `badreq:${evt.casinoId}:${key}:${evt.path}:${code}`,
  };
}

function detectBadRequestRate(recent: CasinoEvent[], rules: ReturnType<typeof getEffectiveRules>): Omit<FraudAlert, 'id'> | null {
  const threshold = ruleThreshold(rules, 'bad_request_rate', 0.15);
  const requests = recent.filter((e) => e.type === 'request');
  if (requests.length < 20) return null;
  const bad = requests.filter((e) => (e.statusCode ?? 0) >= 400);
  const rate = bad.length / requests.length;
  if (rate < threshold) return null;
  return {
    type: 'bad_request',
    severity: rate > 0.5 ? 'high' : 'medium',
    title: `Elevated bad request rate: ${(rate * 100).toFixed(1)}%`,
    description: `${bad.length}/${requests.length} requests returned 4xx/5xx (threshold ${(threshold * 100).toFixed(0)}%).`,
    timestamp: new Date().toISOString(),
    casinoId: recent[0]?.casinoId,
    metric: rate,
    expectedRange: `< ${(threshold * 100).toFixed(0)}%`,
    suggestedAction: 'Investigate probing, credential stuffing, or API abuse.',
    acknowledged: false,
    dedupeKey: `badreq-rate:${recent[0]?.casinoId ?? 'global'}`,
  };
}

function detectRepeatedBadPaths(recent: CasinoEvent[], rules: ReturnType<typeof getEffectiveRules>): Omit<FraudAlert, 'id'>[] {
  const minCount = ruleThreshold(rules, 'bad_request_path', 5);
  const byPath = new Map<string, CasinoEvent[]>();
  for (const e of recent.filter((r) => r.type === 'request' && (r.statusCode ?? 0) >= 400)) {
    const k = `${e.sessionId ?? e.playerId}:${e.path}`;
    if (!byPath.has(k)) byPath.set(k, []);
    byPath.get(k)!.push(e);
  }
  const alerts: Omit<FraudAlert, 'id'>[] = [];
  for (const [key, evts] of Array.from(byPath.entries())) {
    if (evts.length < minCount) continue;
    alerts.push({
      type: 'bad_request',
      severity: 'high',
      title: `Repeated bad requests: ${evts[0].path}`,
      description: `${evts.length} failed requests to ${evts[0].path} from same session/player.`,
      timestamp: new Date().toISOString(),
      casinoId: evts[0].casinoId,
      sessionId: evts[0].sessionId,
      playerId: evts[0].playerId,
      metric: evts.length,
      suggestedAction: 'Block or challenge; possible credential probe.',
      acknowledged: false,
      dedupeKey: `badreq-path:${key}`,
    });
  }
  return alerts;
}

function detectRtpAnomaly(evt: CasinoEvent, rtp: number, rules: ReturnType<typeof getEffectiveRules>): Omit<FraudAlert, 'id'> | null {
  const min = ruleThreshold(rules, 'rtp_anomaly', 85);
  const max = ruleThresholdMax(rules, 'rtp_anomaly', 102);
  if (rtp >= min && rtp <= max) return null;
  return {
    type: 'slot_tampering',
    severity: 'high',
    title: `RTP out of range: ${rtp.toFixed(1)}%`,
    description: `Observed RTP ${rtp.toFixed(1)}% for game ${evt.gameId ?? 'unknown'}. Expected ${min}–${max}%.`,
    timestamp: evt.timestamp,
    casinoId: evt.casinoId,
    gameId: evt.gameId,
    playerId: evt.playerId,
    metric: rtp,
    expectedRange: `${min}–${max}%`,
    suggestedAction: 'Verify meter readings; lock game and schedule technical review.',
    acknowledged: false,
    dedupeKey: `rtp:${evt.casinoId}:${evt.gameId}:${rtp < min ? 'low' : 'high'}`,
  };
}

const meterHistory = new Map<string, number[]>();

function detectMeterDrift(evt: CasinoEvent, rtp: number, rules: ReturnType<typeof getEffectiveRules>): Omit<FraudAlert, 'id'> | null {
  const gameId = evt.gameId ?? 'unknown';
  const key = `${evt.casinoId}:${gameId}`;
  const hist = meterHistory.get(key) ?? [];
  hist.push(rtp);
  if (hist.length > 50) hist.shift();
  meterHistory.set(key, hist);
  if (hist.length < 10) return null;
  const avg = hist.reduce((a, b) => a + b, 0) / hist.length;
  const drift = Math.abs(rtp - avg);
  const threshold = ruleThreshold(rules, 'meter_anomaly', 5);
  if (drift < threshold) return null;
  return {
    type: 'meter_anomaly',
    severity: drift > threshold * 2 ? 'critical' : 'high',
    title: `Meter drift on ${gameId}: ${drift.toFixed(1)}%`,
    description: `RTP ${rtp.toFixed(1)}% deviates ${drift.toFixed(1)}% from rolling avg ${avg.toFixed(1)}%.`,
    timestamp: evt.timestamp,
    casinoId: evt.casinoId,
    gameId: evt.gameId,
    metric: drift,
    expectedRange: `< ${threshold}% drift`,
    suggestedAction: 'Inspect slot meter; possible tampering or calibration issue.',
    acknowledged: false,
    dedupeKey: `meter:${key}`,
  };
}

function detectChipPassing(evt: CasinoEvent, rules: ReturnType<typeof getEffectiveRules>): Omit<FraudAlert, 'id'> | null {
  if (!evt.fromPlayerId || !evt.toPlayerId || !evt.amount) return null;
  const threshold = ruleThreshold(rules, 'chip_passing', 5000);
  if (evt.amount <= threshold) return null;
  return {
    type: 'chip_passing',
    severity: 'high',
    title: 'Large chip move between players',
    description: `Chip movement of ${evt.amount} from ${evt.fromPlayerId} to ${evt.toPlayerId}.`,
    timestamp: evt.timestamp,
    casinoId: evt.casinoId,
    tableId: evt.tableId,
    playerId: evt.fromPlayerId,
    metric: evt.amount,
    suggestedAction: 'Review surveillance; confirm bet placement rules.',
    acknowledged: false,
    dedupeKey: `chip:${evt.casinoId}:${evt.fromPlayerId}:${evt.toPlayerId}:${evt.amount}`,
  };
}

function detectCapping(evt: CasinoEvent, batch: CasinoEvent[], rules: ReturnType<typeof getEffectiveRules>): Omit<FraudAlert, 'id'> | null {
  const ratio = ruleThreshold(rules, 'capping', 0.95);
  const tableBets = batch.filter((e) => e.type === 'bet' && e.tableId === evt.tableId && e.amount);
  if (tableBets.length === 0) return null;
  const maxBet = Math.max(...tableBets.map((e) => e.amount!));
  const capLimit = Number(process.env.TABLE_MAX_BET) || maxBet;
  if (maxBet < capLimit * ratio) return null;
  if (evt.amount && evt.amount >= capLimit * ratio) {
    return {
      type: 'capping',
      severity: 'high',
      title: 'Possible capping / max-bet evasion',
      description: `Bet/chip move of ${evt.amount} near table max ${capLimit} at table ${evt.tableId}.`,
      timestamp: evt.timestamp,
      casinoId: evt.casinoId,
      tableId: evt.tableId,
      metric: evt.amount,
      suggestedAction: 'Verify max-bet enforcement; review pit procedures.',
      acknowledged: false,
      dedupeKey: `capping:${evt.casinoId}:${evt.tableId}:${evt.fromPlayerId}`,
    };
  }
  return null;
}

function detectCardCounting(evt: CasinoEvent, rules: ReturnType<typeof getEffectiveRules>): Omit<FraudAlert, 'id'> | null {
  const spreadThreshold = ruleThreshold(rules, 'card_counting', 3);
  const shoeBets = evt.shoeBetCount ?? 0;
  const amount = evt.amount ?? 0;
  if (shoeBets < 10 || amount < 50) return null;
  const spreadRatio = amount / 50;
  if (spreadRatio < spreadThreshold) return null;
  return {
    type: 'card_counting',
    severity: 'high',
    title: 'Card counting pattern (bet spread)',
    description: `Player ${evt.playerId} bet spread ${spreadRatio.toFixed(1)}x at blackjack table ${evt.tableId ?? 'unknown'}.`,
    timestamp: evt.timestamp,
    casinoId: evt.casinoId,
    playerId: evt.playerId,
    tableId: evt.tableId,
    metric: spreadRatio,
    suggestedAction: 'Observe play; consider countermeasures or table change.',
    acknowledged: false,
    dedupeKey: `cc:${evt.casinoId}:${evt.playerId}:${evt.tableId}`,
  };
}

function detectSessionAnomaly(evt: CasinoEvent): Omit<FraudAlert, 'id'> | null {
  if (evt.type === 'session_start' && evt.sessionId) {
    const prior = getSession(evt.sessionId);
    if (prior?.geo && evt.geo && prior.geo !== evt.geo) {
      return {
        type: 'session_anomaly',
        severity: 'high',
        title: 'Session geo mismatch',
        description: `Session ${evt.sessionId} geo changed ${prior.geo} → ${evt.geo}.`,
        timestamp: evt.timestamp,
        casinoId: evt.casinoId,
        sessionId: evt.sessionId,
        playerId: evt.playerId,
        suggestedAction: 'Possible account sharing or VPN; verify identity.',
        acknowledged: false,
        dedupeKey: `session-geo:${evt.sessionId}`,
      };
    }
  }
  if (evt.type === 'session_end' && evt.sessionId) {
    const sess = getSession(evt.sessionId);
    if (sess?.startedAt && sess?.endedAt) {
      const durationMs = new Date(String(sess.endedAt)).getTime() - new Date(String(sess.startedAt)).getTime();
      const maxHours = Number(process.env.SESSION_MAX_HOURS) || 12;
      if (durationMs > maxHours * 3600 * 1000) {
        return {
          type: 'session_anomaly',
          severity: 'medium',
          title: 'Unusually long session',
          description: `Session ${evt.sessionId} lasted ${(durationMs / 3600000).toFixed(1)}h (max ${maxHours}h).`,
          timestamp: evt.timestamp,
          casinoId: evt.casinoId,
          sessionId: evt.sessionId,
          playerId: evt.playerId,
          suggestedAction: 'Review for bot or shared account usage.',
          acknowledged: false,
          dedupeKey: `session-long:${evt.sessionId}`,
        };
      }
    }
  }
  return null;
}

function scopeKey(e: CasinoEvent): string {
  return `${e.casinoId ?? 'global'}:${e.playerId ?? e.sessionId ?? 'aggregate'}`;
}

function detectOddPercentageScoped(recent: CasinoEvent[], rules: ReturnType<typeof getEffectiveRules>): Omit<FraudAlert, 'id'>[] {
  const threshold = ruleThreshold(rules, 'odd_percentage', 65);
  const groups = new Map<string, CasinoEvent[]>();
  for (const e of recent) {
    if (e.type !== 'bet' && e.type !== 'win') continue;
    const k = scopeKey(e);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(e);
  }
  const alerts: Omit<FraudAlert, 'id'>[] = [];
  for (const [key, evts] of Array.from(groups.entries())) {
    const bets = evts.filter((e) => e.type === 'bet' && e.amount != null);
    const wins = evts.filter((e) => e.type === 'win' && e.amount != null);
    if (bets.length < 20) continue;
    const totalBet = bets.reduce((s, e) => s + (e.amount ?? 0), 0);
    const totalWin = wins.reduce((s, e) => s + (e.amount ?? 0), 0);
    if (totalBet <= 0) continue;
    const winPct = (totalWin / totalBet) * 100;
    if (winPct < threshold) continue;
    const sample = evts[0];
    alerts.push({
      type: 'odd_percentage',
      severity: winPct > 80 ? 'critical' : 'high',
      title: `Suspicious win rate: ${winPct.toFixed(1)}%`,
      description: `Win rate ${winPct.toFixed(1)}% over ${bets.length} bets for ${sample.playerId ?? sample.sessionId ?? 'scope'}.`,
      timestamp: new Date().toISOString(),
      casinoId: sample.casinoId,
      playerId: sample.playerId,
      sessionId: sample.sessionId,
      metric: winPct,
      expectedRange: `< ${threshold}%`,
      suggestedAction: 'Review player session; check for exploit or game bug.',
      acknowledged: false,
      dedupeKey: `odd:${key}`,
    });
  }
  return alerts;
}

function detectRateAbuseScoped(recent: CasinoEvent[], rules: ReturnType<typeof getEffectiveRules>): Omit<FraudAlert, 'id'>[] {
  const limit = ruleThreshold(rules, 'rate_abuse', 120);
  const requests = recent.filter((e) => e.type === 'request');
  const byKey = new Map<string, CasinoEvent[]>();
  for (const r of requests) {
    const key = `${r.casinoId}:${r.playerId ?? r.sessionId ?? 'unknown'}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(r);
  }
  const oneMinAgo = Date.now() - 60_000;
  const alerts: Omit<FraudAlert, 'id'>[] = [];
  for (const [key, evts] of Array.from(byKey.entries())) {
    const inLastMin = evts.filter((e) => new Date(e.timestamp).getTime() > oneMinAgo).length;
    if (inLastMin < limit) continue;
    const sample = evts[0];
    alerts.push({
      type: 'rate_abuse',
      severity: 'high',
      title: `High request rate: ${inLastMin}/min`,
      description: `Exceeded ${limit} req/min for ${sample.playerId ?? sample.sessionId}.`,
      timestamp: new Date().toISOString(),
      casinoId: sample.casinoId,
      playerId: sample.playerId,
      sessionId: sample.sessionId,
      metric: inLastMin / limit,
      suggestedAction: 'Apply rate limit; consider CAPTCHA or block.',
      acknowledged: false,
      dedupeKey: `rate:${key}`,
    });
  }
  return alerts;
}

function detectCollusionSignals(recent: CasinoEvent[], casinoId?: string): Omit<FraudAlert, 'id'>[] {
  const alerts: Omit<FraudAlert, 'id'>[] = [];
  const byTable = new Map<string, CasinoEvent[]>();
  for (const e of recent) {
    const t = e.tableId ?? e.gameId;
    if (!t) continue;
    if (!byTable.has(t)) byTable.set(t, []);
    byTable.get(t)!.push(e);
  }
  for (const [tableId, evts] of Array.from(byTable.entries())) {
    const players = [...new Set(evts.map((e) => e.playerId).filter(Boolean))] as string[];
    const bets = evts.filter((e) => e.type === 'bet');
    if (players.length < 2 || bets.length < 10) continue;

    const watchHit = players.some((p) => isOnWatchList(p, undefined, tableId, undefined, casinoId));
    const sharedIp = evts.some((e) => e.ip && evts.filter((x) => x.ip === e.ip && x.playerId !== e.playerId).length > 0);
    const correlated = detectCorrelatedBets(bets);

    if (watchHit || sharedIp || correlated) {
      alerts.push({
        type: 'collusion',
        severity: 'high',
        title: 'Possible collusion at table',
        description: `Table ${tableId}: ${players.length} players${watchHit ? ', watch-list hit' : ''}${sharedIp ? ', shared IP' : ''}${correlated ? ', correlated bet timing' : ''}.`,
        timestamp: new Date().toISOString(),
        casinoId,
        tableId,
        suggestedAction: 'Review surveillance; consider table move or observation.',
        acknowledged: false,
        dedupeKey: `collusion:${casinoId}:${tableId}`,
      });
    }
  }
  return alerts;
}

function detectCorrelatedBets(bets: CasinoEvent[]): boolean {
  if (bets.length < 4) return false;
  const sorted = [...bets].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  let pairs = 0;
  for (let i = 1; i < sorted.length; i++) {
    const dt = new Date(sorted[i].timestamp).getTime() - new Date(sorted[i - 1].timestamp).getTime();
    if (dt < 2000 && sorted[i].playerId !== sorted[i - 1].playerId) pairs++;
  }
  return pairs >= 3;
}

export { ALERT_COOLDOWN_MS };
