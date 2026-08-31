'use client';

interface Props {
  casinoId: string;
  onCasinoChange: (v: string) => void;
}

export function RegulatoryExport({ casinoId, onCasinoChange }: Props) {
  return (
    <div className="card">
      <h2 className="mb-2 text-lg font-semibold text-white">Regulatory reporting</h2>
      <p className="mb-4 text-xs text-zinc-500">SAR-style exports with retention policy. High/critical alerts included.</p>
      <div className="mb-3 flex gap-2">
        <input value={casinoId} onChange={(e) => onCasinoChange(e.target.value)} placeholder="casinoId (optional filter)" className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
      </div>
      <div className="flex flex-wrap gap-2">
        <a href={`/api/export?type=sar&format=json${casinoId ? `&casinoId=${encodeURIComponent(casinoId)}` : ''}`} className="rounded bg-zinc-700 px-3 py-2 text-sm text-white hover:bg-zinc-600">SAR JSON</a>
        <a href={`/api/export?type=sar&format=csv${casinoId ? `&casinoId=${encodeURIComponent(casinoId)}` : ''}`} className="rounded bg-zinc-700 px-3 py-2 text-sm text-white hover:bg-zinc-600">SAR CSV</a>
        <a href={`/api/export?type=alerts&format=csv${casinoId ? `&casinoId=${encodeURIComponent(casinoId)}` : ''}`} className="rounded bg-zinc-700 px-3 py-2 text-sm text-white hover:bg-zinc-600">Alerts CSV</a>
      </div>
      <p className="mt-3 text-xs text-zinc-600">Retention: events/alerts within RETENTION_DAYS (default 365).</p>
    </div>
  );
}
