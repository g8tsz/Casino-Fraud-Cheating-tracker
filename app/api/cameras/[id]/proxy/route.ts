import { getCameraById } from '@/lib/db';
import { requireRole, isAuthResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = requireRole(request, 'viewer');
  if (isAuthResponse(auth)) return auth;

  const camera = getCameraById(params.id);
  if (!camera) {
    return new Response('Camera not found', { status: 404 });
  }
  if (auth.casinoId && camera.casinoId && auth.casinoId !== camera.casinoId) {
    return new Response('Forbidden', { status: 403 });
  }
  if (camera.streamType !== 'snapshot' && camera.streamType !== 'mjpeg') {
    return new Response('Proxy only supports snapshot and mjpeg streams', { status: 400 });
  }

  const headers: HeadersInit = {};
  if (camera.authUser) {
    const token = Buffer.from(`${camera.authUser}:${camera.authPass ?? ''}`).toString('base64');
    headers.Authorization = `Basic ${token}`;
  }

  try {
    const upstream = await fetch(camera.streamUrl, { headers, cache: 'no-store' });
    if (!upstream.ok) {
      return new Response(`Upstream ${upstream.status}`, { status: 502 });
    }
    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch {
    return new Response('Failed to reach camera', { status: 502 });
  }
}
