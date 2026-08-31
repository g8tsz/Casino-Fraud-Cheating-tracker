'use client';

import { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { FraudAlert, FraudStats, WatchListEntry, CasinoEvent, InvestigationCase, DetectionRule, TableSession, PlayerProfile, CctvCameraPublic } from '@/lib/types';
import { StatsCards } from '@/app/components/StatsCards';
import { AlertsPanel } from '@/app/components/AlertsPanel';
import { WatchListPanel } from '@/app/components/WatchListPanel';
import { EventsPanel } from '@/app/components/EventsPanel';
import { CasesPanel } from '@/app/components/CasesPanel';
import { RulesPanel } from '@/app/components/RulesPanel';
import { PitBossView } from '@/app/components/PitBossView';
import { RegulatoryExport } from '@/app/components/RegulatoryExport';
import { PlayerDetail } from '@/app/components/PlayerDetail';
import { NavTabs, type TabId } from '@/app/components/NavTabs';
import { TYPE_LABELS, apiFetch, setApiKey } from '@/app/lib/constants';

export default function Dashboard() {
  const [tab, setTab] = useState<TabId>('dashboard');
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [stats, setStats] = useState<FraudStats | null>(null);
  const [watchList, setWatchList] = useState<WatchListEntry[]>([]);
  const [events, setEvents] = useState<CasinoEvent[]>([]);
  const [cases, setCases] = useState<InvestigationCase[]>([]);
  const [rules, setRules] = useState<DetectionRule[]>([]);
  const [tables, setTables] = useState<TableSession[]>([]);
  const [cameras, setCameras] = useState<CctvCameraPublic[]>([]);
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile | null>(null);
  const [watchValue, setWatchValue] = useState('');
  const [watchReason, setWatchReason] = useState('');
  const [watchKind, setWatchKind] = useState<'player' | 'table' | 'session' | 'ip'>('player');
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showAcknowledged, setShowAcknowledged] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<FraudAlert | null>(null);
  const [casinoFilter, setCasinoFilter] = useState('');
  const [apiKey, setApiKeyState] = useState('');

  const qs = casinoFilter ? `?casinoId=${encodeURIComponent(casinoFilter)}` : '';

  const load = useCallback(() => {
    Promise.all([
      apiFetch(`/api/alerts?limit=100${casinoFilter ? `&casinoId=${encodeURIComponent(casinoFilter)}` : ''}`).then((r) => r.json()),
      apiFetch(`/api/stats${qs}`).then((r) => r.json()),
      apiFetch(`/api/watchlist${qs}`).then((r) => r.json()),
      apiFetch(`/api/events?limit=80${casinoFilter ? `&casinoId=${encodeURIComponent(casinoFilter)}` : ''}`).then((r) => r.json()),
      apiFetch(`/api/cases${qs}`).then((r) => r.json()),
      apiFetch(`/api/rules${qs}`).then((r) => r.json()),
      apiFetch(`/api/tables${qs}`).then((r) => r.json()),
      apiFetch(`/api/cameras${qs}`).then((r) => r.json()),
    ])
      .then(([a, s, w, e, c, r, t, cam]) => {
        if (Array.isArray(a)) setAlerts(a);
        if (s && !s.error) setStats(s);
        if (Array.isArray(w)) setWatchList(w);
        if (Array.isArray(e)) setEvents(e);
        if (Array.isArray(c)) setCases(c);
        if (Array.isArray(r)) setRules(r);
        if (Array.isArray(t)) setTables(t);
        if (Array.isArray(cam)) setCameras(cam);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [casinoFilter, qs]);

  useEffect(() => {
    load();
    const es = new EventSource('/api/stream');
    es.addEventListener('alert', () => load());
    es.addEventListener('stats', (ev) => {
      try { setStats(JSON.parse(ev.data)); } catch { /* ignore */ }
    });
    const t = setInterval(load, 60000);
    return () => { es.close(); clearInterval(t); };
  }, [load]);

  useEffect(() => {
    setApiKey(apiKey, 'admin', casinoFilter || undefined);
    load();
  }, [apiKey, casinoFilter, load]);

  const acknowledge = async (id: string) => {
    await apiFetch('/api/alerts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    load();
  };

  const addWatch = async () => {
    if (!watchValue.trim()) return;
    await apiFetch('/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: watchKind, value: watchValue.trim(), reason: watchReason.trim() || 'Manual', casinoId: casinoFilter || undefined }),
    });
    setWatchValue('');
    setWatchReason('');
    load();
  };

  const removeWatch = async (id: string) => {
    await apiFetch(`/api/watchlist?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    load();
  };

  const createCase = async (title: string, alertIds: string[]) => {
    await apiFetch('/api/cases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, alertIds, casinoId: casinoFilter || undefined }) });
    load();
  };

  const updateCaseStatus = async (id: string, status: InvestigationCase['status']) => {
    await apiFetch('/api/cases', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
    load();
  };

  const toggleRule = async (ruleKey: string, enabled: boolean) => {
    await apiFetch('/api/rules', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ruleKey, enabled, casinoId: casinoFilter || undefined }) });
    load();
  };

  const updateRuleThreshold = async (ruleKey: string, threshold: number) => {
    await apiFetch('/api/rules', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ruleKey, threshold, casinoId: casinoFilter || undefined }) });
    load();
  };

  const loadPlayer = async (playerId: string) => {
    const r = await apiFetch(`/api/players/${encodeURIComponent(playerId)}${qs}`);
    setPlayerProfile(await r.json());
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-zinc-400">Loading...</div>
      </div>
    );
  }

  const chartData = stats
    ? Object.entries(stats.byType).filter(([, v]) => v > 0).map(([name, value]) => ({ name: TYPE_LABELS[name] || name, value }))
    : [];

  return (
    <div className="min-h-screen p-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Casino Fraud & Cheating Tracker</h1>
          <p className="mt-1 text-sm text-zinc-400">Multi-casino · RBAC · cases · rules engine · ML baselines · regulatory export</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="password" placeholder="API key (optional)" value={apiKey} onChange={(e) => setApiKeyState(e.target.value)} className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-white w-36" />
          <div className="flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-sm text-zinc-300">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" /> Live SSE
          </div>
        </div>
      </header>

      <NavTabs active={tab} onChange={setTab} casinoFilter={casinoFilter} onCasinoFilter={setCasinoFilter} />

      {playerProfile && <PlayerDetail profile={playerProfile} onClose={() => setPlayerProfile(null)} />}

      {(tab === 'dashboard') && (
        <>
          <StatsCards stats={stats} />
          {chartData.length > 0 && (
            <div className="card mb-6">
              <h2 className="mb-4 text-lg font-semibold text-white">Alerts by type (24h)</h2>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ left: 100 }}>
                    <XAxis type="number" stroke="#71717a" fontSize={12} />
                    <YAxis type="category" dataKey="name" stroke="#71717a" fontSize={11} width={95} />
                    <Tooltip contentStyle={{ backgroundColor: '#27272a', border: '1px solid #3f3f46' }} />
                    <Bar dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]}>
                      {chartData.map((_, i) => <Cell key={i} fill={['#ef4444', '#f59e0b', '#eab308', '#8b5cf6'][i % 4]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          <div className="grid gap-6 lg:grid-cols-2">
            <AlertsPanel
              alerts={alerts}
              filterSeverity={filterSeverity}
              filterType={filterType}
              showAcknowledged={showAcknowledged}
              onFilterSeverity={setFilterSeverity}
              onFilterType={setFilterType}
              onToggleAcknowledged={() => setShowAcknowledged((v) => !v)}
              onAcknowledge={acknowledge}
              onCreateCase={(a) => createCase(`Alert: ${a.title}`, [a.id])}
              onSelectPlayer={loadPlayer}
              selectedAlert={selectedAlert}
              onSelectAlert={setSelectedAlert}
            />
            <div className="space-y-6">
              <WatchListPanel
                watchList={watchList}
                watchValue={watchValue}
                watchReason={watchReason}
                watchKind={watchKind}
                onValueChange={setWatchValue}
                onReasonChange={setWatchReason}
                onKindChange={setWatchKind}
                onAdd={addWatch}
                onRemove={removeWatch}
              />
              <EventsPanel events={events} />
            </div>
          </div>
        </>
      )}

      {tab === 'cases' && <CasesPanel cases={cases} onCreate={createCase} onUpdateStatus={updateCaseStatus} />}
      {tab === 'rules' && <RulesPanel rules={rules} onToggle={toggleRule} onThreshold={updateRuleThreshold} />}
      {tab === 'pit' && <PitBossView tables={tables} cameras={cameras} onCamerasChange={load} />}
      {tab === 'regulatory' && <RegulatoryExport casinoId={casinoFilter} onCasinoChange={setCasinoFilter} />}
    </div>
  );
}
