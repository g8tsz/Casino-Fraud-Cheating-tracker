'use client';

import { format } from 'date-fns';
import type { FraudAlert } from '@/lib/types';
import { TYPE_LABELS, SEVERITY_COLORS } from '@/app/lib/constants';

interface Props {
  alerts: FraudAlert[];
  filterSeverity: string;
  filterType: string;
  showAcknowledged: boolean;
  onFilterSeverity: (v: string) => void;
  onFilterType: (v: string) => void;
  onToggleAcknowledged: () => void;
  onAcknowledge: (id: string) => void;
  onCreateCase: (alert: FraudAlert) => void;
  onSelectPlayer: (id: string) => void;
  selectedAlert: FraudAlert | null;
  onSelectAlert: (a: FraudAlert | null) => void;
}

export function AlertsPanel(props: Props) {
  const filtered = props.alerts.filter((a) => {
    if (!props.showAcknowledged && a.acknowledged) return false;
    if (props.filterSeverity && a.severity !== props.filterSeverity) return false;
    if (props.filterType && a.type !== props.filterType) return false;
    return true;
  });

  return (
    <div className="card">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-white mr-auto">Fraud alerts</h2>
        <select value={props.filterSeverity} onChange={(e) => props.onFilterSeverity(e.target.value)} className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-white">
          <option value="">All severity</option>
          {['critical', 'high', 'medium', 'low'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={props.filterType} onChange={(e) => props.onFilterType(e.target.value)} className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-white">
          <option value="">All types</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button onClick={props.onToggleAcknowledged} className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700">
          {props.showAcknowledged ? 'Hide ack' : 'Show ack'}
        </button>
      </div>
      <ul className="max-h-96 space-y-2 overflow-y-auto">
        {filtered.length === 0 && <li className="text-sm text-zinc-500">No alerts. Send events to /api/ingest or run npm run seed.</li>}
        {filtered.map((a) => (
          <li key={a.id} onClick={() => props.onSelectAlert(a)} className={`cursor-pointer rounded-lg border p-3 text-sm ${a.severity === 'critical' ? 'badge-critical' : a.severity === 'high' ? 'badge-high' : a.severity === 'medium' ? 'badge-medium' : 'badge-low'} ${a.acknowledged ? 'opacity-60' : ''} ${props.selectedAlert?.id === a.id ? 'ring-1 ring-emerald-500' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="rounded px-1.5 py-0.5 text-xs font-medium" style={{ backgroundColor: SEVERITY_COLORS[a.severity] + '40', color: SEVERITY_COLORS[a.severity] }}>{a.severity}</span>
                <span className="ml-2 text-xs text-zinc-500">{TYPE_LABELS[a.type] ?? a.type}</span>
                {a.casinoId && <span className="ml-2 text-xs text-zinc-600">{a.casinoId}</span>}
                <h3 className="mt-1 font-medium text-white">{a.title}</h3>
                <p className="mt-0.5 text-zinc-400">{a.description}</p>
                {a.playerId && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); props.onSelectPlayer(a.playerId!); }} className="mt-1 text-xs text-emerald-400 hover:underline">
                    Player: {a.playerId}
                  </button>
                )}
                <p className="mt-1 text-xs text-zinc-500">{format(new Date(a.timestamp), 'PPp')}</p>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                {!a.acknowledged && <button onClick={(e) => { e.stopPropagation(); props.onAcknowledge(a.id); }} className="rounded bg-zinc-700 px-2 py-1 text-xs hover:bg-zinc-600">Ack</button>}
                <button onClick={(e) => { e.stopPropagation(); props.onCreateCase(a); }} className="rounded bg-sky-800 px-2 py-1 text-xs hover:bg-sky-700">Case</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {props.selectedAlert && (
        <div className="mt-4 rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-sm">
          <h3 className="font-medium text-white">Alert detail</h3>
          <p className="mt-1 text-zinc-400">{props.selectedAlert.description}</p>
          {props.selectedAlert.metric != null && <p className="mt-1 text-zinc-300">Metric: {props.selectedAlert.metric} {props.selectedAlert.expectedRange && `(expected ${props.selectedAlert.expectedRange})`}</p>}
          {props.selectedAlert.suggestedAction && <p className="mt-1 text-amber-200/90">→ {props.selectedAlert.suggestedAction}</p>}
        </div>
      )}
    </div>
  );
}
