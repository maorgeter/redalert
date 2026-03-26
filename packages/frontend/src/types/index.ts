import type { FeatureCollection, Feature, Polygon, MultiPolygon, GeoJsonProperties } from 'geojson'

export enum AlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum AlertStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export enum AlertCategory {
  ROCKETS = 'rockets',
  MISSILE = 'missile',
  HOSTILE_AIRCRAFT = 'hostile_aircraft',
  INFILTRATION = 'infiltration',
  EARTHQUAKE = 'earthquake',
  RADIATION = 'radiation',
  TSUNAMI = 'tsunami',
  CHEMICAL = 'chemical',
  EVENT_ENDED = 'event_ended',
  UNKNOWN = 'unknown',
}

/**
 * Israeli alert type taxonomy (Pikud HaOref):
 *  - RED_ALERT  = "צבע אדום"          – immediate threat, rockets/missiles/aircraft
 *  - WARNING    = "התרעה"             – other threats
 *  - ALL_CLEAR  = "יציאה מהמקלט"     – threat ended, safe to exit shelter
 */
export enum AlertType {
  RED_ALERT = 'red_alert',
  WARNING = 'warning',
  ALL_CLEAR = 'all_clear',
}

export interface AlertEvent {
  id: string
  source: string
  /** Sources that have reported this alert (cross-source provenance) */
  provenance: string[]
  timestamp: string
  areaName: string
  areaType: string
  cityNames: string[]
  geofenceId?: string
  receivedAt: string
  updatedAt: string
  severity: AlertSeverity
  confidence: number
  status: AlertStatus
  category: AlertCategory
  alertType?: AlertType
  ttlSeconds: number
  title?: string
  description?: string
}

export interface ZoneExplanation {
  method: 'buffered_union' | 'single_buffered' | 'trend_weighted'
  activeEventCount: number
  bufferKm: number
  unionedAreaCount: number
  trendDetected: boolean
  notes: string[]
}

export interface MovementTrend {
  bearing: number
  speedKmPerMin: number
  evidenceCount: number
  confidence: number
}

export interface EstimatedZone {
  id: string
  geometry: Feature<Polygon | MultiPolygon>
  uncertaintyGeometry: Feature<Polygon | MultiPolygon> | null
  sourceGeofenceIds: string[]
  affectedAreas: string[]
  confidence: number
  lastEventAt: string
  computedAt: string
  explanation: ZoneExplanation
  trend: MovementTrend | null
}

export type AdapterType = 'polling' | 'websocket' | 'webhook' | 'manual'

export interface AdapterStatus {
  name: string
  type: AdapterType
  healthy: boolean
  enabled: boolean
  isPrimary: boolean
  reliabilityScore: number
  lastSuccess: string | null
  lastError: string | null
  eventCount: number
  errorCount: number
  /** Expected polling interval in ms — used for stale detection */
  updateIntervalMs?: number
}

export interface HealthStatus {
  status: 'ok' | 'degraded'
  uptime: number
  clientCount: number
  activeEventCount: number
  adapterStatuses: AdapterStatus[]
  lastZoneComputedAt: string | null
}

// WebSocket message types (replay removed)
export type ServerMessage =
  | { type: 'init'; ts: string; data: { events: AlertEvent[]; zones: EstimatedZone[]; geofences: FeatureCollection } }
  | { type: 'event'; ts: string; data: AlertEvent }
  | { type: 'event:expired'; ts: string; data: AlertEvent }
  | { type: 'zones_update'; ts: string; data: EstimatedZone[] }
  | { type: 'health'; ts: string; data: HealthStatus }
  | { type: 'source_status'; ts: string; data: AdapterStatus[] }
  | { type: 'pong'; ts: string; data: null }

export type GeofenceFC = FeatureCollection<Polygon | MultiPolygon, GeoJsonProperties>

// ─── Hebrew translations ────────────────────────────────────────────────────

export const SEVERITY_HE: Record<AlertSeverity, string> = {
  [AlertSeverity.CRITICAL]: 'קריטי',
  [AlertSeverity.HIGH]: 'גבוה',
  [AlertSeverity.MEDIUM]: 'בינוני',
  [AlertSeverity.LOW]: 'נמוך',
}

export const CATEGORY_HE: Record<AlertCategory, string> = {
  [AlertCategory.ROCKETS]: 'ירי רקטות וטילים',
  [AlertCategory.MISSILE]: 'טיל בליסטי',
  [AlertCategory.HOSTILE_AIRCRAFT]: 'כלי טיס עוין',
  [AlertCategory.INFILTRATION]: 'חדירת מחבלים',
  [AlertCategory.EARTHQUAKE]: 'רעידת אדמה',
  [AlertCategory.RADIATION]: 'דליפה רדיואקטיבית',
  [AlertCategory.TSUNAMI]: 'צונאמי',
  [AlertCategory.CHEMICAL]: 'אירוע כימי',
  [AlertCategory.EVENT_ENDED]: 'האירוע הסתיים',
  [AlertCategory.UNKNOWN]: 'לא ידוע',
}

/** Hebrew label for each alert type */
export const ALERT_TYPE_HE: Record<AlertType, string> = {
  [AlertType.RED_ALERT]: 'צבע אדום',
  [AlertType.WARNING]: 'התרעה',
  [AlertType.ALL_CLEAR]: 'יציאה מהמקלט',
}

export const SOURCE_HE: Record<string, string> = {
  oref: 'פיקוד העורף',
  mock: 'סימולציה',
  simulation: 'סימולציה',
  seed: 'נתוני בדיקה',
}
