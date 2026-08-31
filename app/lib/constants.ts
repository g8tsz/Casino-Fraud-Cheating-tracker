export const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#eab308',
  low: '#6b7280',
};

export const TYPE_LABELS: Record<string, string> = {
  collusion: 'Collusion',
  card_counting: 'Card counting',
  slot_tampering: 'Slot tampering',
  meter_anomaly: 'Meter anomaly',
  capping: 'Capping',
  chip_passing: 'Chip passing',
  bad_request: 'Bad request',
  odd_percentage: 'Odd %',
  rate_abuse: 'Rate abuse',
  session_anomaly: 'Session anomaly',
  ml_anomaly: 'ML anomaly',
};

export const API_HEADERS: Record<string, string> = {};

export function setApiKey(key: string, role = 'admin', casinoId?: string) {
  if (key) API_HEADERS['Authorization'] = `Bearer ${key}`;
  if (role) API_HEADERS['X-Role'] = role;
  if (casinoId) API_HEADERS['X-Casino-Id'] = casinoId;
}

export async function apiFetch(path: string, init?: RequestInit) {
  return fetch(path, {
    ...init,
    headers: { ...API_HEADERS, ...(init?.headers as Record<string, string>) },
  });
}
