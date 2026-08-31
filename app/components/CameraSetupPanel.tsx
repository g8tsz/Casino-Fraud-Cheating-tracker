'use client';

import { useState } from 'react';
import type { CctvCameraPublic, CameraStreamType } from '@/lib/types';
import { apiFetch } from '@/app/lib/constants';

const STREAM_TYPES: { value: CameraStreamType; label: string; hint: string }[] = [
  { value: 'snapshot', label: 'Snapshot (JPEG)', hint: 'IP camera still URL — refreshes every 2s' },
  { value: 'mjpeg', label: 'MJPEG', hint: 'Live MJPEG stream from NVR or IP cam' },
  { value: 'hls', label: 'HLS (.m3u8)', hint: 'Most VMS / cloud NVR exports' },
  { value: 'iframe', label: 'Embed (iframe)', hint: 'Verkada, Genetec, or vendor embed URL' },
];

export function CameraSetupPanel({ cameras, onUpdated }: { cameras: CctvCameraPublic[]; onUpdated: () => void }) {
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [name, setName] = useState('');
  const [tableId, setTableId] = useState('');
  const [streamType, setStreamType] = useState<CameraStreamType>('snapshot');
  const [streamUrl, setStreamUrl] = useState('');
  const [location, setLocation] = useState('');
  const [bulkJson, setBulkJson] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const addOne = async () => {
    setStatus(null);
    const r = await apiFetch('/api/cameras', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        tableId: tableId.trim() || undefined,
        streamType,
        streamUrl: streamUrl.trim(),
        location: location.trim() || undefined,
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      setStatus(data.error || 'Failed to add camera');
      return;
    }
    setName('');
    setTableId('');
    setStreamUrl('');
    setLocation('');
    setStatus(`Added ${data.name}`);
    onUpdated();
  };

  const importBulk = async () => {
    setStatus(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(bulkJson);
    } catch {
      setStatus('Invalid JSON');
      return;
    }
    const r = await apiFetch('/api/cameras', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
    });
    const data = await r.json();
    if (!r.ok) {
      setStatus(data.error || 'Import failed');
      return;
    }
    setStatus(`Imported ${data.imported} camera(s)`);
    setBulkJson('');
    onUpdated();
  };

  const remove = async (id: string) => {
    await apiFetch(`/api/cameras?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    onUpdated();
  };

  return (
    <div className="card mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-white">CCTV cameras</h2>
          <p className="text-xs text-zinc-500">{cameras.length} registered · link cameras to table IDs for pit view</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setBulkOpen((v) => !v)} className="rounded border border-zinc-600 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800">
            {bulkOpen ? 'Hide bulk import' : 'Bulk JSON import'}
          </button>
          <button type="button" onClick={() => setOpen((v) => !v)} className="rounded bg-sky-700 px-3 py-1 text-xs text-white hover:bg-sky-600">
            {open ? 'Close' : 'Add camera'}
          </button>
        </div>
      </div>

      {status && <p className="mt-2 text-xs text-amber-300">{status}</p>}

      {open && (
        <div className="mt-4 grid gap-3 rounded-lg border border-zinc-700 bg-zinc-900/50 p-3 sm:grid-cols-2">
          <label className="text-xs text-zinc-400">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-white" placeholder="BJ-12 overhead" />
          </label>
          <label className="text-xs text-zinc-400">
            Table ID (optional)
            <input value={tableId} onChange={(e) => setTableId(e.target.value)} className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-white" placeholder="BJ-12" />
          </label>
          <label className="text-xs text-zinc-400">
            Stream type
            <select value={streamType} onChange={(e) => setStreamType(e.target.value as CameraStreamType)} className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-white">
              {STREAM_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <span className="mt-1 block text-zinc-500">{STREAM_TYPES.find((t) => t.value === streamType)?.hint}</span>
          </label>
          <label className="text-xs text-zinc-400">
            Location label (optional)
            <input value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-white" placeholder="Pit 2 north" />
          </label>
          <label className="text-xs text-zinc-400 sm:col-span-2">
            Stream URL
            <input value={streamUrl} onChange={(e) => setStreamUrl(e.target.value)} className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-white" placeholder="http://nvr.local/cgi-bin/snapshot.cgi?channel=1" />
          </label>
          <button type="button" onClick={addOne} className="sm:col-span-2 rounded bg-emerald-700 px-3 py-2 text-sm text-white hover:bg-emerald-600">
            Save camera
          </button>
        </div>
      )}

      {bulkOpen && (
        <div className="mt-4 rounded-lg border border-zinc-700 bg-zinc-900/50 p-3">
          <p className="mb-2 text-xs text-zinc-400">
            Paste a JSON array or {'{ "cameras": [...] }'} — copy from <code className="text-zinc-300">config/cameras.example.json</code> or your VMS export.
          </p>
          <textarea value={bulkJson} onChange={(e) => setBulkJson(e.target.value)} rows={8} className="w-full rounded border border-zinc-700 bg-zinc-800 p-2 font-mono text-xs text-white" placeholder='[{"name":"Pit cam","tableId":"BJ-12","streamType":"snapshot","streamUrl":"http://..."}]' />
          <button type="button" onClick={importBulk} className="mt-2 rounded bg-emerald-700 px-3 py-2 text-sm text-white hover:bg-emerald-600">
            Import cameras
          </button>
        </div>
      )}

      {cameras.length > 0 && (
        <ul className="mt-4 divide-y divide-zinc-800 text-sm">
          {cameras.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="text-zinc-200">{c.name}{c.tableId ? ` · table ${c.tableId}` : ''} <span className="text-zinc-500">({c.streamType})</span></span>
              <button type="button" onClick={() => remove(c.id)} className="text-xs text-red-400 hover:underline">Remove</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
