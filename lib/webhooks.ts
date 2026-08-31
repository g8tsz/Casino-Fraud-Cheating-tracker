/**
 * Webhook delivery for critical/high alerts.
 */
import type { FraudAlert } from './types';

const WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL || '';

export async function dispatchAlertWebhook(alerts: FraudAlert[]): Promise<void> {
  if (!WEBHOOK_URL) return;
  const critical = alerts.filter((a) => a.severity === 'critical' || a.severity === 'high');
  if (critical.length === 0) return;
  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alerts: critical, sentAt: new Date().toISOString() }),
    });
  } catch (e) {
    console.error('Webhook dispatch failed', e);
  }
}
