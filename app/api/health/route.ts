import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    getDb();
    return NextResponse.json({ ok: true, status: 'healthy', timestamp: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ ok: false, status: 'unhealthy' }, { status: 503 });
  }
}
