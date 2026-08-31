/**
 * Statistical baseline / z-score anomaly detection per player and game.
 */
import { getMlBaseline, saveMlBaseline } from './db';
import type { CasinoEvent, FraudAlert, MlBaseline } from './types';

const ALPHA = 0.15;

function baselineKey(casinoId: string | undefined, playerId: string, gameId: string, metric: string): string {
  return `${casinoId ?? 'global'}:${playerId}:${gameId}:${metric}`;
}

function updateBaseline(key: string, casinoId: string | undefined, playerId: string, gameId: string, metric: string, value: number): MlBaseline {
  const existing = getMlBaseline(key);
  let mean: number;
  let stdDev: number;
  let sampleCount: number;

  if (!existing || existing.sampleCount < 2) {
    mean = value;
    stdDev = Math.max(value * 0.1, 1);
    sampleCount = (existing?.sampleCount ?? 0) + 1;
  } else {
    mean = existing.mean * (1 - ALPHA) + value * ALPHA;
    const diff = value - existing.mean;
    stdDev = Math.sqrt(existing.stdDev ** 2 * (1 - ALPHA) + diff ** 2 * ALPHA);
    sampleCount = existing.sampleCount + 1;
  }

  const baseline: MlBaseline = {
    key,
    casinoId,
    playerId,
    gameId,
    metric,
    mean,
    stdDev: Math.max(stdDev, 0.01),
    sampleCount,
    updatedAt: new Date().toISOString(),
  };
  saveMlBaseline(baseline);
  return baseline;
}

export function detectMlAnomalies(events: CasinoEvent[], zThreshold: number): Omit<FraudAlert, 'id'>[] {
  const alerts: Omit<FraudAlert, 'id'>[] = [];

  for (const evt of events) {
    if (evt.type !== 'bet' && evt.type !== 'win') continue;
    if (!evt.playerId || evt.amount == null) continue;
    const gameId = evt.gameId ?? 'unknown';
    const key = baselineKey(evt.casinoId, evt.playerId, gameId, 'amount');
    const baseline = updateBaseline(key, evt.casinoId, evt.playerId, gameId, 'amount', evt.amount);

    if (baseline.sampleCount < 10) continue;
    const z = Math.abs((evt.amount - baseline.mean) / baseline.stdDev);
    if (z >= zThreshold) {
      alerts.push({
        type: 'ml_anomaly',
        severity: z >= zThreshold * 1.5 ? 'critical' : 'high',
        title: `Statistical outlier: ${evt.type} amount z=${z.toFixed(1)}`,
        description: `Player ${evt.playerId} ${evt.type} of ${evt.amount} is ${z.toFixed(1)}σ from baseline mean ${baseline.mean.toFixed(0)} (game ${gameId}).`,
        timestamp: evt.timestamp,
        casinoId: evt.casinoId,
        playerId: evt.playerId,
        gameId: evt.gameId,
        metric: z,
        expectedRange: `±${zThreshold}σ`,
        suggestedAction: 'Review for bot behavior, bonus abuse, or account compromise.',
        acknowledged: false,
        dedupeKey: `ml:${evt.casinoId}:${evt.playerId}:${gameId}:${evt.type}`,
      });
    }
  }

  return alerts;
}
