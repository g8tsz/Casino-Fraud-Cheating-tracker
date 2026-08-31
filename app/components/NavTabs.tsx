'use client';

const TABS = ['dashboard', 'cases', 'rules', 'pit', 'regulatory'] as const;
export type TabId = (typeof TABS)[number];

export function NavTabs({ active, onChange, casinoFilter, onCasinoFilter }: {
  active: TabId;
  onChange: (t: TabId) => void;
  casinoFilter: string;
  onCasinoFilter: (v: string) => void;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-zinc-800 pb-4">
      {TABS.map((t) => (
        <button key={t} onClick={() => onChange(t)} className={`rounded-lg px-3 py-1.5 text-sm capitalize ${active === t ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:bg-zinc-800'}`}>
          {t === 'pit' ? 'Pit boss' : t}
        </button>
      ))}
      <input value={casinoFilter} onChange={(e) => onCasinoFilter(e.target.value)} placeholder="Filter casinoId" className="ml-auto rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-white placeholder-zinc-500" />
    </div>
  );
}
