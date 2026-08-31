'use client';

import { format } from 'date-fns';
import type { InvestigationCase } from '@/lib/types';

interface Props {
  cases: InvestigationCase[];
  onCreate: (title: string, alertIds: string[]) => void;
  onUpdateStatus: (id: string, status: InvestigationCase['status'], note?: string) => void;
}

export function CasesPanel({ cases, onCreate, onUpdateStatus }: Props) {
  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Investigations</h2>
        <button onClick={() => onCreate(`Case ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, [])} className="rounded bg-sky-700 px-3 py-1 text-sm text-white hover:bg-sky-600">New case</button>
      </div>
      <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
        {cases.length === 0 && <li className="text-zinc-500">No cases. Create one from an alert or use New case.</li>}
        {cases.map((c) => (
          <li key={c.id} className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-medium text-white">{c.title}</h3>
                <p className="text-xs text-zinc-500">{c.status} · {c.alertIds.length} alerts · {format(new Date(c.updatedAt), 'PPp')}</p>
                {c.notes.slice(-1).map((n) => <p key={n.id} className="mt-1 text-xs text-zinc-400">{n.author}: {n.body}</p>)}
              </div>
              <select value={c.status} onChange={(e) => onUpdateStatus(c.id, e.target.value as InvestigationCase['status'])} className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-white">
                {['open', 'investigating', 'resolved', 'closed'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
