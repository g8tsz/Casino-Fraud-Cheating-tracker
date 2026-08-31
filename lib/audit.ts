import { addAudit } from './db';
import type { AuditEntry } from './types';

export function logAudit(action: string, actor: string, opts?: { casinoId?: string; target?: string; details?: string }): void {
  const entry: AuditEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    casinoId: opts?.casinoId,
    action,
    actor,
    target: opts?.target,
    details: opts?.details,
    timestamp: new Date().toISOString(),
  };
  addAudit(entry);
}
