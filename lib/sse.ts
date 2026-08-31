/**
 * Server-sent events broadcaster for live dashboard updates.
 */
type Listener = (data: string) => void;
const listeners = new Set<Listener>();

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function broadcast(event: string, payload: unknown): void {
  const msg = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const l of listeners) {
    try { l(msg); } catch { listeners.delete(l); }
  }
}

export function broadcastAlert(alert: unknown): void {
  broadcast('alert', alert);
}

export function broadcastStats(stats: unknown): void {
  broadcast('stats', stats);
}
