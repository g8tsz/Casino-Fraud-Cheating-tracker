'use client';

import type { WatchListEntry } from '@/lib/types';

interface Props {
  watchList: WatchListEntry[];
  watchValue: string;
  watchReason: string;
  watchKind: 'player' | 'table' | 'session' | 'ip';
  onValueChange: (v: string) => void;
  onReasonChange: (v: string) => void;
  onKindChange: (v: 'player' | 'table' | 'session' | 'ip') => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}

export function WatchListPanel(props: Props) {
  return (
    <div className="card">
      <h2 className="mb-4 text-lg font-semibold text-white">Watch list</h2>
      <div className="mb-3 flex flex-wrap gap-2">
        <select value={props.watchKind} onChange={(e) => props.onKindChange(e.target.value as Props['watchKind'])} className="rounded border border-zinc-700 bg-zinc-800 px-2 py-2 text-sm text-white">
          <option value="player">Player</option>
          <option value="table">Table</option>
          <option value="session">Session</option>
          <option value="ip">IP</option>
        </select>
        <input type="text" placeholder="ID value" value={props.watchValue} onChange={(e) => props.onValueChange(e.target.value)} className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500" />
        <input type="text" placeholder="Reason" value={props.watchReason} onChange={(e) => props.onReasonChange(e.target.value)} className="w-28 rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500" />
        <button onClick={props.onAdd} className="rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500">Add</button>
      </div>
      <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
        {props.watchList.length === 0 && <li className="text-zinc-500">Empty</li>}
        {props.watchList.map((w) => (
          <li key={w.id} className="flex items-center justify-between rounded bg-zinc-800/50 px-2 py-1.5">
            <span className="text-white">{w.kind}: {w.value}</span>
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">{w.reason}</span>
              <button onClick={() => props.onRemove(w.id)} className="text-xs text-red-400 hover:text-red-300">Remove</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
