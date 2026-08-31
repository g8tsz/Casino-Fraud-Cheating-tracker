import type { CameraStreamType, CctvCamera, CctvCameraPublic } from './types';

const VALID_STREAM_TYPES: CameraStreamType[] = ['hls', 'mjpeg', 'iframe', 'snapshot'];

export function stripCameraSecrets(cam: CctvCamera): Omit<CctvCamera, 'authUser' | 'authPass'> {
  const { authUser: _u, authPass: _p, ...rest } = cam;
  return rest;
}

/** Browser-facing playback URL (proxy for snapshot/mjpeg when credentials or proxy mode). */
export function toPublicCamera(cam: CctvCamera, origin = ''): CctvCameraPublic {
  const safe = stripCameraSecrets(cam);
  const base = origin.replace(/\/$/, '');
  const useProxy =
    cam.streamType === 'snapshot' ||
    cam.streamType === 'mjpeg' ||
    Boolean(cam.authUser) ||
    process.env.CCTV_PROXY_ALL === 'true';

  let playbackUrl = cam.streamUrl;
  if (useProxy && (cam.streamType === 'snapshot' || cam.streamType === 'mjpeg')) {
    playbackUrl = `${base}/api/cameras/${encodeURIComponent(cam.id)}/proxy`;
  }

  return { ...safe, playbackUrl };
}

export function normalizeCameraInput(raw: Record<string, unknown>, id?: string): CctvCamera | null {
  const name = String(raw.name ?? '').trim();
  const streamUrl = String(raw.streamUrl ?? '').trim();
  const streamType = String(raw.streamType ?? 'snapshot').toLowerCase() as CameraStreamType;
  if (!name || !streamUrl) return null;
  if (!VALID_STREAM_TYPES.includes(streamType)) return null;

  const now = new Date().toISOString();
  return {
    id: id ?? String(raw.id ?? `cam-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    casinoId: raw.casinoId ? String(raw.casinoId) : undefined,
    name,
    tableId: raw.tableId ? String(raw.tableId) : undefined,
    location: raw.location ? String(raw.location) : undefined,
    streamType,
    streamUrl,
    active: raw.active !== false,
    authUser: raw.authUser ? String(raw.authUser) : undefined,
    authPass: raw.authPass ? String(raw.authPass) : undefined,
    addedAt: raw.addedAt ? String(raw.addedAt) : now,
    notes: raw.notes ? String(raw.notes) : undefined,
  };
}

export function parseCameraList(body: unknown): CctvCamera[] {
  const list = Array.isArray(body)
    ? body
    : Array.isArray((body as { cameras?: unknown })?.cameras)
      ? (body as { cameras: unknown[] }).cameras
      : [];
  const out: CctvCamera[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const cam = normalizeCameraInput(item as Record<string, unknown>);
    if (cam) out.push(cam);
  }
  return out;
}
