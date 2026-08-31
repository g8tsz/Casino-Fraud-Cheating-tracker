#!/usr/bin/env node
/**
 * Seed demo data via ingest API.
 * Usage: npm run seed [-- --url http://localhost:3001]
 */
const base = process.argv.includes('--url')
  ? process.argv[process.argv.indexOf('--url') + 1]
  : 'http://localhost:3001';

const now = Date.now();
const iso = (offsetMs: number) => new Date(now + offsetMs).toISOString();

const events = [
  { eventId: 'seed-1', casinoId: 'casino-a', type: 'session_start', playerId: 'P001', sessionId: 'S001', geo: 'US-NV', timestamp: iso(-3600000) },
  { eventId: 'seed-2', casinoId: 'casino-a', type: 'bet', playerId: 'P001', sessionId: 'S001', gameId: 'slot-mega', amount: 100, timestamp: iso(-3500000) },
  { eventId: 'seed-3', casinoId: 'casino-a', type: 'win', playerId: 'P001', sessionId: 'S001', gameId: 'slot-mega', amount: 250, observedRtp: 110, timestamp: iso(-3400000) },
  { eventId: 'seed-4', casinoId: 'casino-a', type: 'request', sessionId: 'S001', path: '/api/spin', statusCode: 401, timestamp: iso(-3300000) },
  { eventId: 'seed-5', casinoId: 'casino-b', type: 'bet', playerId: 'P002', tableId: 'BJ-12', gameType: 'blackjack', amount: 500, shoeBetCount: 15, timestamp: iso(-3200000) },
  { eventId: 'seed-6', casinoId: 'casino-b', type: 'chip_move', fromPlayerId: 'P002', toPlayerId: 'P003', tableId: 'BJ-12', amount: 8000, timestamp: iso(-3100000) },
  { eventId: 'seed-7', casinoId: 'casino-a', type: 'bet', playerId: 'P004', sessionId: 'S002', gameId: 'slot-mega', amount: 50, timestamp: iso(-3000000) },
  { eventId: 'seed-8', casinoId: 'casino-a', type: 'win', playerId: 'P004', sessionId: 'S002', gameId: 'slot-mega', amount: 120, observedRtp: 96, timestamp: iso(-2900000) },
];

async function main() {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.INGEST_API_KEY) headers['Authorization'] = `Bearer ${process.env.INGEST_API_KEY}`;

  const res = await fetch(`${base}/api/ingest`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ events }),
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
  if (!res.ok) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
