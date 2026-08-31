import { NextResponse } from 'next/server';
import { getCamerasList, registerCamera, unregisterCamera, importCameraList } from '@/lib/store';
import { requireRole, isAuthResponse } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { normalizeCameraInput, parseCameraList, toPublicCamera } from '@/lib/cameras';

function originFrom(request: Request): string {
  try {
    return new URL(request.url).origin;
  } catch {
    return '';
  }
}

export async function GET(request: Request) {
  const auth = requireRole(request, 'viewer');
  if (isAuthResponse(auth)) return auth;
  const { searchParams } = new URL(request.url);
  const casinoId = searchParams.get('casinoId') || auth.casinoId;
  const tableId = searchParams.get('tableId') || undefined;
  try {
    const cameras = getCamerasList({ casinoId, tableId });
    const origin = originFrom(request);
    return NextResponse.json(cameras.map((c) => toPublicCamera(c, origin)));
  } catch {
    return NextResponse.json({ error: 'Failed to load cameras' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = requireRole(request, 'admin');
  if (isAuthResponse(auth)) return auth;
  try {
    const body = await request.json();
    if (body.cameras || Array.isArray(body)) {
      const list = parseCameraList(body);
      if (list.length === 0) {
        return NextResponse.json({ error: 'No valid cameras in payload' }, { status: 400 });
      }
      for (const c of list) {
        if (!c.casinoId && auth.casinoId) c.casinoId = auth.casinoId;
      }
      const count = importCameraList(list);
      logAudit('cameras_import', auth.actor, { casinoId: auth.casinoId, details: JSON.stringify({ count }) });
      const origin = originFrom(request);
      return NextResponse.json({
        imported: count,
        cameras: getCamerasList({ casinoId: auth.casinoId }).map((c) => toPublicCamera(c, origin)),
      });
    }

    const cam = normalizeCameraInput(body as Record<string, unknown>);
    if (!cam) return NextResponse.json({ error: 'name, streamUrl, and streamType required' }, { status: 400 });
    if (!cam.casinoId && auth.casinoId) cam.casinoId = auth.casinoId;
    const saved = registerCamera(cam);
    logAudit('camera_add', auth.actor, { target: saved.id, casinoId: saved.casinoId, details: saved.name });
    return NextResponse.json(toPublicCamera(saved, originFrom(request)));
  } catch {
    return NextResponse.json({ error: 'Failed to save camera' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = requireRole(request, 'admin');
  if (isAuthResponse(auth)) return auth;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const ok = unregisterCamera(id);
  if (ok) logAudit('camera_remove', auth.actor, { target: id });
  return NextResponse.json({ ok });
}
