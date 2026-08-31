import { getRules } from './db';
import type { DetectionRule } from './types';

export function getEffectiveRules(casinoId?: string): Map<string, DetectionRule> {
  const rules = getRules(casinoId);
  const map = new Map<string, DetectionRule>();
  for (const r of rules) map.set(r.ruleKey, r);
  return map;
}

export function ruleEnabled(rules: Map<string, DetectionRule>, key: string): boolean {
  return rules.get(key)?.enabled ?? true;
}

export function ruleThreshold(rules: Map<string, DetectionRule>, key: string, fallback: number): number {
  const v = rules.get(key)?.threshold;
  return v != null ? v : fallback;
}

export function ruleThresholdMax(rules: Map<string, DetectionRule>, key: string, fallback: number): number {
  const v = rules.get(key)?.thresholdMax;
  return v != null ? v : fallback;
}
