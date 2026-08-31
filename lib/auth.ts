/**
 * API authentication, RBAC, and rate limiting helpers.
 */
import type { UserRole } from './types';

const INGEST_KEY = process.env.INGEST_API_KEY || '';
const DASHBOARD_KEY = process.env.DASHBOARD_API_KEY || '';
const REQUIRE_AUTH = process.env.REQUIRE_AUTH === 'true';

const ROLE_RANK: Record<UserRole, number> = { viewer: 1, triage: 2, admin: 3 };

export interface AuthContext {
  authenticated: boolean;
  role: UserRole;
  actor: string;
  casinoId?: string;
}

export function parseAuth(request: Request): AuthContext {
  const auth = request.headers.get('authorization') || '';
  const roleHeader = (request.headers.get('x-role') || 'admin') as UserRole;
  const casinoHeader = request.headers.get('x-casino-id') || undefined;
  const role = ROLE_RANK[roleHeader] ? roleHeader : 'viewer';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  if (!REQUIRE_AUTH && !INGEST_KEY && !DASHBOARD_KEY) {
    return { authenticated: true, role: 'admin', actor: 'dev', casinoId: casinoHeader };
  }

  if (token && (token === DASHBOARD_KEY || token === INGEST_KEY)) {
    return { authenticated: true, role, actor: token === INGEST_KEY ? 'ingest' : role, casinoId: casinoHeader };
  }

  return { authenticated: false, role: 'viewer', actor: 'anonymous', casinoId: casinoHeader };
}

export function requireIngestAuth(request: Request): AuthContext | Response {
  const ctx = parseAuth(request);
  if (!REQUIRE_AUTH && !INGEST_KEY) return ctx;
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token !== INGEST_KEY && token !== DASHBOARD_KEY) {
    return new Response(JSON.stringify({ error: 'Unauthorized ingest' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  return ctx;
}

export function requireRole(request: Request, minRole: UserRole): AuthContext | Response {
  const ctx = parseAuth(request);
  if (!REQUIRE_AUTH && !DASHBOARD_KEY) return ctx;
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token !== DASHBOARD_KEY && token !== INGEST_KEY) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  if (ROLE_RANK[ctx.role] < ROLE_RANK[minRole]) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }
  return ctx;
}

const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = Number(process.env.INGEST_RATE_LIMIT_PER_MIN) || 600;

export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (bucket.count >= RATE_LIMIT) return false;
  bucket.count++;
  return true;
}

export function isAuthResponse(v: AuthContext | Response): v is Response {
  return v instanceof Response;
}
