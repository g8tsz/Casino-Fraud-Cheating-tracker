'use client';

import type { FraudStats } from '@/lib/types';

export function StatsCards({ stats }: { stats: FraudStats | null }) {
  const items = [
    { label: 'Alerts (24h)', value: stats?.alertsLast24h ?? 0, cls: 'text-white' },
    { label: 'Bad request rate %', value: stats?.badRequestRate ?? 0, cls: 'text-amber-400' },
    { label: 'Odd % alerts', value: stats?.oddPercentageCount ?? 0, cls: 'text-red-400' },
    { label: 'ML anomalies', value: stats?.mlAnomalyCount ?? 0, cls: 'text-purple-400' },
    { label: 'Open cases', value: stats?.openCases ?? 0, cls: 'text-sky-400' },
    { label: 'Watch list', value: stats?.watchListCount ?? 0, cls: 'text-white' },
  ];
  return (
    <section className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => (
        <div key={item.label} className="card">
          <p className="text-sm text-zinc-400">{item.label}</p>
          <p className={`text-xl font-semibold ${item.cls}`}>{item.value}</p>
        </div>
      ))}
    </section>
  );
}
