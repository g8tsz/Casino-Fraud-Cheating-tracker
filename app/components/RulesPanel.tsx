'use client';

import type { DetectionRule } from '@/lib/types';

interface Props {
  rules: DetectionRule[];
  onToggle: (ruleKey: string, enabled: boolean) => void;
  onThreshold: (ruleKey: string, threshold: number) => void;
}

export function RulesPanel({ rules, onToggle, onThreshold }: Props) {
  return (
    <div className="card">
      <h2 className="mb-4 text-lg font-semibold text-white">Detection rules</h2>
      <p className="mb-3 text-xs text-zinc-500">Toggle rules and adjust thresholds without redeploying. Admin role required to save.</p>
      <ul className="max-h-96 space-y-2 overflow-y-auto text-sm">
        {rules.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 rounded bg-zinc-800/50 px-3 py-2">
            <label className="flex items-center gap-2 text-white">
              <input type="checkbox" checked={r.enabled} onChange={(e) => onToggle(r.ruleKey, e.target.checked)} />
              {r.label}
            </label>
            {r.threshold != null && (
              <label className="flex items-center gap-1 text-xs text-zinc-400">
                Threshold
                <input type="number" defaultValue={r.threshold} onBlur={(e) => onThreshold(r.ruleKey, Number(e.target.value))} className="w-20 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-white" />
              </label>
            )}
            {r.thresholdMax != null && <span className="text-xs text-zinc-600">max {r.thresholdMax}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
