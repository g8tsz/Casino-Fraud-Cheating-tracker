'use client';

import { useMemo, useState } from 'react';
import type { CctvCameraPublic, TableSession } from '@/lib/types';
import { format } from 'date-fns';
import { CctvPlayer } from '@/app/components/CctvPlayer';
import { CameraSetupPanel } from '@/app/components/CameraSetupPanel';

export function PitBossView({
  tables,
  cameras,
  onCamerasChange,
}: {
  tables: TableSession[];
  cameras: CctvCameraPublic[];
  onCamerasChange: () => void;
}) {
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [wallMode, setWallMode] = useState(false);

  const byTable = useMemo(() => {
    const map = new Map<string, CctvCameraPublic[]>();
    for (const c of cameras) {
      if (!c.tableId) continue;
      if (!map.has(c.tableId)) map.set(c.tableId, []);
      map.get(c.tableId)!.push(c);
    }
    return map;
  }, [cameras]);

  const unassigned = useMemo(() => cameras.filter((c) => !c.tableId), [cameras]);

  return (
    <div>
      <CameraSetupPanel cameras={cameras} onUpdated={onCamerasChange} />

      <div className="card mb-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-white">CCTV wall</h2>
            <p className="text-xs text-zinc-500">All active feeds — click a table card below for table-linked cameras.</p>
          </div>
          <button
            type="button"
            onClick={() => setWallMode((v) => !v)}
            className="rounded border border-zinc-600 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            {wallMode ? 'Compact wall' : 'Large wall'}
          </button>
        </div>
        {cameras.length === 0 ? (
          <p className="text-sm text-zinc-500">No cameras yet. Add one above, or drop a file at <code className="text-zinc-400">data/cameras.json</code> and restart.</p>
        ) : (
          <div className={`grid gap-3 ${wallMode ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>
            {cameras.map((cam) => (
              <div key={cam.id} className="rounded-lg border border-zinc-700 bg-zinc-900 p-2">
                <p className="mb-1 truncate text-xs font-medium text-white">{cam.name}</p>
                <p className="mb-2 truncate text-[10px] text-zinc-500">{cam.tableId ? `Table ${cam.tableId}` : cam.location || 'Unassigned'}</p>
                <CctvPlayer camera={cam} compact={!wallMode} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="mb-2 text-lg font-semibold text-white">Pit boss — live tables</h2>
        <p className="mb-4 text-xs text-zinc-500">Land-based table sessions with linked CCTV and active alerts.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {tables.length === 0 && <p className="text-sm text-zinc-500">No table activity. Ingest events with tableId and chip_move.</p>}
          {tables.map((t) => {
            const tableCams = byTable.get(t.tableId) ?? [];
            const showCams = expandedTable === t.tableId && tableCams.length > 0;
            return (
              <div key={t.tableId} className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-white">Table {t.tableId}</h3>
                  {t.gameType && <span className="text-xs text-zinc-500">{t.gameType}</span>}
                </div>
                <p className="mt-1 text-xs text-zinc-400">{t.players.length} players · {t.eventCount} events · {t.chipMoves} chip moves</p>
                <p className="text-xs text-zinc-500">Last: {t.lastActivity ? format(new Date(t.lastActivity), 'PPp') : '—'}</p>
                {tableCams.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setExpandedTable(showCams ? null : t.tableId)}
                    className="mt-2 text-xs text-sky-400 hover:underline"
                  >
                    {showCams ? 'Hide' : 'Show'} {tableCams.length} camera{tableCams.length > 1 ? 's' : ''}
                  </button>
                )}
                {showCams && (
                  <div className="mt-2 space-y-2">
                    {tableCams.map((cam) => (
                      <div key={cam.id}>
                        <p className="mb-1 text-[10px] text-zinc-500">{cam.name}</p>
                        <CctvPlayer camera={cam} compact />
                      </div>
                    ))}
                  </div>
                )}
                {t.alerts.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {t.alerts.slice(0, 3).map((a) => (
                      <li key={a.id} className="rounded bg-red-950/30 px-2 py-1 text-xs text-red-300">{a.title}</li>
                    ))}
                  </ul>
                )}
                <button onClick={() => window.open(`/api/export?type=sar&format=csv&casinoId=${t.casinoId ?? ''}`, '_blank')} className="mt-2 text-xs text-sky-400 hover:underline">
                  Export surveillance ticket (SAR CSV)
                </button>
              </div>
            );
          })}
        </div>
        {unassigned.length > 0 && tables.length > 0 && (
          <p className="mt-4 text-xs text-zinc-500">{unassigned.length} camera(s) not linked to a table — assign tableId when adding cameras to show them on table cards.</p>
        )}
      </div>
    </div>
  );
}
