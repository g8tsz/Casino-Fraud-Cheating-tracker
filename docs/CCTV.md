# CCTV integration (self-service)

Casinos register their own cameras without code changes. Feeds appear on the **Pit boss** tab (CCTV wall + per-table views).

## Three ways to add cameras

### 1. JSON file (recommended for IT)

1. Copy `config/cameras.example.json` to `data/cameras.json` (create `data/` if needed).
2. Edit URLs, names, and optional `tableId` (matches ingest `tableId`, e.g. `BJ-12`).
3. Restart the app — cameras load automatically on first run when the DB has no cameras.

Optional env: `CAMERAS_FILE=/path/to/cameras.json`

### 2. Dashboard UI

Open **Pit boss** → **Add camera** or **Bulk JSON import**. Requires admin role (API key + `X-Role: admin`).

### 3. REST API

```bash
# Single camera
curl -X POST http://localhost:3001/api/cameras \
  -H "Authorization: Bearer YOUR_DASHBOARD_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "BJ-12 overhead",
    "tableId": "BJ-12",
    "streamType": "snapshot",
    "streamUrl": "http://nvr.local/snapshot.jpg"
  }'

# Bulk import
curl -X POST http://localhost:3001/api/cameras \
  -H "Authorization: Bearer YOUR_DASHBOARD_KEY" \
  -H "Content-Type: application/json" \
  -d @config/cameras.example.json
```

List cameras: `GET /api/cameras?casinoId=...&tableId=...`

Remove: `DELETE /api/cameras?id=cam-xxx`

## Stream types

| Type | Use when | `streamUrl` |
|------|----------|-------------|
| `snapshot` | IP cam / NVR JPEG still | HTTP URL returning a JPEG (refreshed every 2s in UI) |
| `mjpeg` | Live MJPEG from cam or NVR | MJPEG stream URL |
| `hls` | Modern VMS, cloud NVR | `.m3u8` playlist URL |
| `iframe` | Vendor-hosted embed | Full embed URL (Verkada, Genetec, etc.) |

## Auth and proxy

For cameras behind HTTP basic auth, include `authUser` and `authPass` in JSON or API body. Credentials are stored server-side only and used by `/api/cameras/{id}/proxy` for `snapshot` and `mjpeg` streams.

Set `CCTV_PROXY_ALL=true` to route all snapshot/MJPEG through the proxy (helps with mixed content or hidden NVR URLs).

## Linking to pit tables

Set `tableId` on each camera to the same ID you send in ingest events (`tableId` on `chip_move`, bets, etc.). Pit boss table cards then offer **Show N cameras** for that table.

## Network notes

- The tracker server must reach your NVR/camera URLs (same VLAN or VPN).
- Browsers may block mixed HTTP cameras on HTTPS sites — use HTTPS NVR URLs or terminate TLS at a reverse proxy.
- HLS may require CORS on the VMS; if playback fails, use `iframe` or `mjpeg`/`snapshot` via proxy.
