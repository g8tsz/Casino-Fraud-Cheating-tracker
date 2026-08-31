export type GameType = 'slots' | 'blackjack' | 'roulette' | 'poker' | 'craps' | 'baccarat';

export type UserRole = 'viewer' | 'triage' | 'admin';

export type ThresholdPreset = 'strict' | 'normal' | 'lenient';

export interface Thresholds {
  rtpMin: number;
  rtpMax: number;
  winRateSuspiciousPct: number;
  rateAbusePerMin: number;
  alertCooldownMs: number;
  repeatedBetCountThreshold: number;
  sessionLengthMaxHours: number;
  playersPerIpThreshold: number;
  playersPerDeviceThreshold: number;
}

/** Ingested event from a casino website or system */
export interface CasinoEvent {
  eventId?: string;
  casinoId?: string;
  type: 'bet' | 'win' | 'request' | 'session_start' | 'session_end' | 'chip_move';
  playerId?: string;
  sessionId?: string;
  gameId?: string;
  tableId?: string;
  gameType?: GameType;
  roundId?: string;
  amount?: number;
  currency?: string;
  timestamp: string;
  statusCode?: number;
  path?: string;
  method?: string;
  responseTimeMs?: number;
  /** Observed RTP % on win events (legacy alias: expectedRtp) */
  observedRtp?: number;
  /** @deprecated Use observedRtp */
  expectedRtp?: number;
  fromPlayerId?: string;
  toPlayerId?: string;
  ip?: string;
  deviceId?: string;
  /** Blackjack: bets placed this shoe (for card-counting heuristics) */
  shoeBetCount?: number;
  /** Session geo / device metadata */
  geo?: string;
  deviceFingerprint?: string;
}

export type FraudType =
  | 'collusion'
  | 'card_counting'
  | 'slot_tampering'
  | 'meter_anomaly'
  | 'capping'
  | 'chip_passing'
  | 'bad_request'
  | 'odd_percentage'
  | 'rate_abuse'
  | 'session_anomaly'
  | 'ml_anomaly';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export type CaseStatus = 'open' | 'investigating' | 'resolved' | 'closed';

export interface FraudAlert {
  id: string;
  casinoId?: string;
  type: FraudType;
  severity: Severity;
  title: string;
  description: string;
  timestamp: string;
  playerId?: string;
  sessionId?: string;
  gameId?: string;
  tableId?: string;
  metric?: number;
  expectedRange?: string;
  suggestedAction?: string;
  acknowledged: boolean;
  sourceId?: string;
  caseId?: string;
  dedupeKey?: string;
}

export interface WatchListEntry {
  id: string;
  casinoId?: string;
  kind: 'player' | 'table' | 'session' | 'ip';
  value: string;
  reason: string;
  addedAt: string;
  expiresAt?: string;
  active: boolean;
}

export interface FraudStats {
  casinoId?: string;
  alertsLast24h: number;
  byType: Record<FraudType, number>;
  badRequestRate: number;
  oddPercentageCount: number;
  watchListCount: number;
  openCases: number;
  mlAnomalyCount: number;
}

export interface DetectionRule {
  id: string;
  casinoId?: string;
  ruleKey: string;
  label: string;
  enabled: boolean;
  threshold?: number;
  thresholdMax?: number;
  config?: Record<string, unknown>;
  updatedAt: string;
}

export interface InvestigationCase {
  id: string;
  casinoId?: string;
  title: string;
  status: CaseStatus;
  alertIds: string[];
  notes: CaseNote[];
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface CaseNote {
  id: string;
  author: string;
  body: string;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  casinoId?: string;
  action: string;
  actor: string;
  target?: string;
  details?: string;
  timestamp: string;
}

export interface PlayerProfile {
  playerId: string;
  casinoId?: string;
  events: CasinoEvent[];
  alerts: FraudAlert[];
  onWatchList: boolean;
  stats: {
    totalBets: number;
    totalWins: number;
    winRatePct: number;
    requestCount: number;
    badRequestCount: number;
  };
}

export interface TableSession {
  tableId: string;
  casinoId?: string;
  gameType?: GameType;
  players: string[];
  eventCount: number;
  chipMoves: number;
  alerts: FraudAlert[];
  lastActivity: string;
  cameras?: CctvCamera[];
}

/** CCTV stream types casinos can register */
export type CameraStreamType = 'hls' | 'mjpeg' | 'iframe' | 'snapshot';

/** Registered CCTV camera – link to tables for pit boss view */
export interface CctvCamera {
  id: string;
  casinoId?: string;
  name: string;
  /** Optional pit table id (e.g. BJ-12) – camera appears on that table card */
  tableId?: string;
  location?: string;
  streamType: CameraStreamType;
  /** HLS .m3u8, MJPEG URL, iframe embed URL, or JPEG snapshot URL */
  streamUrl: string;
  active: boolean;
  /** Optional HTTP basic auth for server-side proxy (not returned to clients) */
  authUser?: string;
  authPass?: string;
  addedAt: string;
  notes?: string;
}

export interface CctvCameraPublic extends Omit<CctvCamera, 'authUser' | 'authPass'> {
  /** Browser-safe playback URL (proxy when needed) */
  playbackUrl: string;
}

export interface MlBaseline {
  key: string;
  casinoId?: string;
  gameId?: string;
  playerId?: string;
  metric: string;
  mean: number;
  stdDev: number;
  sampleCount: number;
  updatedAt: string;
}

export interface SarExportRow {
  reportId: string;
  generatedAt: string;
  casinoId?: string;
  alertId: string;
  alertType: FraudType;
  severity: Severity;
  playerId?: string;
  description: string;
  suggestedAction?: string;
  caseId?: string;
  caseStatus?: CaseStatus;
}

export const FRAUD_TYPES: FraudType[] = [
  'collusion', 'card_counting', 'slot_tampering', 'meter_anomaly', 'capping',
  'chip_passing', 'bad_request', 'odd_percentage', 'rate_abuse', 'session_anomaly', 'ml_anomaly',
];

export const DEFAULT_RULES: Omit<DetectionRule, 'id' | 'updatedAt'>[] = [
  { ruleKey: 'bad_request', label: 'Bad request (per event)', enabled: true },
  { ruleKey: 'bad_request_rate', label: 'Bad request rate threshold', enabled: true, threshold: 0.15 },
  { ruleKey: 'bad_request_path', label: 'Repeated bad requests per path', enabled: true, threshold: 5 },
  { ruleKey: 'rtp_anomaly', label: 'RTP out of range', enabled: true, threshold: 85, thresholdMax: 102 },
  { ruleKey: 'meter_anomaly', label: 'Meter / hold drift', enabled: true, threshold: 5 },
  { ruleKey: 'odd_percentage', label: 'Suspicious win rate', enabled: true, threshold: 65 },
  { ruleKey: 'rate_abuse', label: 'Request rate abuse', enabled: true, threshold: 120 },
  { ruleKey: 'chip_passing', label: 'Large chip move', enabled: true, threshold: 5000 },
  { ruleKey: 'capping', label: 'Capping / max-bet evasion', enabled: true, threshold: 0.95 },
  { ruleKey: 'collusion', label: 'Collusion signals', enabled: true },
  { ruleKey: 'card_counting', label: 'Card counting heuristics', enabled: true, threshold: 3 },
  { ruleKey: 'session_anomaly', label: 'Session anomalies', enabled: true },
  { ruleKey: 'ml_anomaly', label: 'ML statistical outlier', enabled: true, threshold: 2.5 },
];
