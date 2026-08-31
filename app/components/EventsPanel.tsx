'use client';

import { format } from 'date-fns';
import type { CasinoEvent } from '@/lib/types';

export function EventsPanel({ events }: { events: CasinoEvent[] }) {
  return (
    <div className="card">
      <h2 className="mb-4 text-lg font-semibold text-white">Recent events</h2>
      <ul className="max-h-64 space-y-1 overflow-y-auto text-xs">
        {events.length === 0 && (
          <li className="text-zinc-500">
            No events yet. POST to /api/ingest — see docs/INGEST.md or run <code className="text-emerald-400">npm run seed</code>.
          </li>
        )}
        {events.slice(0, 50).map((e, i) => (
          <li key={e.eventId ?? i} className="flex justify-between gap-2 rounded bg-zinc-800/50 px-2 py-1">
            <span className="text-zinc-300">{e.type}</span>
            {e.casinoId && <span className="truncate text-zinc-600">{e.casinoId}</span>}
            {e.playerId && <span className="truncate text-zinc-500">{e.playerId}</span>}
            {e.statusCode != null && <span className={e.statusCode >= 400 ? 'text-red-400' : 'text-zinc-400'}>{e.statusCode}</span>}
            <span className="text-zinc-500">{format(new Date(e.timestamp), 'HH:mm:ss')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
