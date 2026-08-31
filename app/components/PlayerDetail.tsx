'use client';

import type { PlayerProfile } from '@/lib/types';
import { format } from 'date-fns';

export function PlayerDetail({ profile, onClose }: { profile: PlayerProfile | null; onClose: () => void }) {
  if (!profile) return null;
  return (
    <div className="card mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Player: {profile.playerId}</h2>
        <button onClick={onClose} className="text-sm text-zinc-400 hover:text-white">Close</button>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5 text-sm">
        <div><span className="text-zinc-500">Bets</span><p className="text-white">{profile.stats.totalBets}</p></div>
        <div><span className="text-zinc-500">Wins</span><p className="text-white">{profile.stats.totalWins}</p></div>
        <div><span className="text-zinc-500">Win rate</span><p className="text-amber-400">{profile.stats.winRatePct}%</p></div>
        <div><span className="text-zinc-500">Requests</span><p className="text-white">{profile.stats.requestCount}</p></div>
        <div><span className="text-zinc-500">Watch list</span><p className={profile.onWatchList ? 'text-red-400' : 'text-zinc-400'}>{profile.onWatchList ? 'Yes' : 'No'}</p></div>
      </div>
      {profile.alerts.length > 0 && (
        <div className="mb-3">
          <h3 className="text-sm font-medium text-zinc-300">Alerts ({profile.alerts.length})</h3>
          <ul className="mt-1 max-h-32 overflow-y-auto text-xs text-zinc-400">
            {profile.alerts.map((a) => <li key={a.id}>{a.severity} · {a.title}</li>)}
          </ul>
        </div>
      )}
      <h3 className="text-sm font-medium text-zinc-300">Recent events</h3>
      <ul className="mt-1 max-h-40 overflow-y-auto text-xs">
        {profile.events.slice(0, 20).map((e, i) => (
          <li key={i} className="flex justify-between text-zinc-500 py-0.5">
            <span>{e.type} {e.amount != null && `$${e.amount}`}</span>
            <span>{format(new Date(e.timestamp), 'HH:mm:ss')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
