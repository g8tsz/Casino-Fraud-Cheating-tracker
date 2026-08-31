# Casino Fraud & Cheating Tracker

**Repository:** [github.com/g8tsz/Casino-Fruad-Cheating-tracker-](https://github.com/g8tsz/Casino-Fruad-Cheating-tracker-)

Track **fraud and cheating** for **online and land-based** casinos: odd win %, bad requests, RTP/slot tampering, collusion, capping, chip passing, rate abuse, ML outliers, and regulatory exports. Works with **live data** from most website casinos via a simple ingest API.

---

## Features

### Detection (all rule types implemented)
- **Odd percentage** – Per-player/session win rate (configurable threshold).
- **Bad requests** – Per-event, aggregate rate, and repeated path probes.
- **Slot tampering / meter anomaly** – RTP range + rolling hold drift.
- **Collusion** – Watch list, shared IP, correlated bet timing.
- **Card counting** – Blackjack bet-spread heuristics.
- **Capping & chip passing** – Max-bet evasion and large chip moves.
- **Rate abuse** – Per player/session request rate.
- **Session anomaly** – Geo mismatch, excessive duration.
- **ML anomaly** – Z-score outlier detection on bet/win amounts.

### Platform
- **Multi-tenant** – `casinoId` on events; filter dashboard/API by property.
- **RBAC** – `viewer` / `triage` / `admin` via `X-Role` + `DASHBOARD_API_KEY`.
- **Case management** – Investigations with notes and status workflow.
- **Rules engine UI** – Enable/disable rules and edit thresholds without redeploy.
- **SQLite persistence** – Survives restarts (`data/tracker.db`).
- **Alert deduplication** – Cooldown window prevents spam.
- **SSE live updates** – `/api/stream` pushes alerts/stats to dashboard.
- **Webhooks** – `ALERT_WEBHOOK_URL` for high/critical alerts.
- **Pit boss view** – Land-based table sessions, **CCTV wall**, and surveillance export.
- **Regulatory export** – SAR-style JSON/CSV with retention policy.
- **Player drill-down** – `/api/players/[id]` profile and stats.

---

## Quick start

```bash
npm install
npm run dev
```

Open **http://localhost:3001**, then seed demo data:

```bash
npm run seed
```

---

## Auth (production)

Set in `.env` (see `.env.example`):

| Variable | Purpose |
|----------|---------|
| `REQUIRE_AUTH=true` | Enforce API keys |
| `INGEST_API_KEY` | Bearer token for POST `/api/ingest` |
| `DASHBOARD_API_KEY` | Bearer token for dashboard APIs |
| `X-Role` header | `viewer`, `triage`, or `admin` |
| `X-Casino-Id` header | Scope to one casino property |

---

## Ingest API

**POST /api/ingest** — see [docs/INGEST.md](docs/INGEST.md) for full schema.

New optional fields: `eventId`, `casinoId`, `observedRtp`, `gameType`, `roundId`, `currency`, `ip`, `deviceId`, `geo`, `shoeBetCount`.

Response includes raised alert details:

```json
{ "ok": true, "ingested": 2, "alerts": 1, "alertDetails": [...], "rejected": [] }
```

---

## API summary

| Endpoint | Method | Role | Description |
|----------|--------|------|-------------|
| `/api/ingest` | POST | ingest key | Send events |
| `/api/alerts` | GET | viewer | List/filter alerts |
| `/api/alerts` | PATCH | triage | Ack one or bulk `{ ids: [] }` |
| `/api/watchlist` | GET/POST/DELETE | viewer/triage | Watch list CRUD |
| `/api/cases` | GET/POST/PATCH | viewer/triage | Investigations |
| `/api/rules` | GET/PATCH | viewer/admin | Rules engine |
| `/api/players/[id]` | GET | viewer | Player profile |
| `/api/tables` | GET | viewer | Pit boss table sessions |
| `/api/cameras` | GET/POST/DELETE | viewer/admin | Register CCTV feeds |
| `/api/cameras/[id]/proxy` | GET | viewer | Snapshot/MJPEG proxy (auth) |
| `/api/export` | GET | admin | SAR/alerts CSV or JSON |
| `/api/stream` | GET | — | SSE live feed |
| `/api/health` | GET | — | Health check |
| `/api/stats` | GET | viewer | Dashboard stats |
| `/api/events` | GET | viewer | Recent events |

Query filters: `?casinoId=&severity=&type=&playerId=&since=&acknowledged=`

---

## Dashboard tabs

1. **Dashboard** – Stats, chart, alerts (filter/sort/detail), watch list, events.
2. **Cases** – Open investigations, status updates.
3. **Rules** – Toggle detection rules and thresholds.
4. **Pit boss** – CCTV wall, self-service camera setup, live tables (link cameras via `tableId`).
5. **Regulatory** – SAR and alerts export.

**CCTV:** Copy `config/cameras.example.json` → `data/cameras.json`, or use the Pit boss UI / `POST /api/cameras`. See [docs/CCTV.md](docs/CCTV.md).

---

## Config

See `.env.example` for thresholds, rate limits, webhooks, retention, and external API sync (`DATA_SOURCE=api`).

---

## Tech

Next.js 14, TypeScript, Tailwind, Recharts, better-sqlite3. Run `npm test` for smoke tests.
