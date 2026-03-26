import { z } from 'zod'

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

/**
 * Hebrew alert type taxonomy used by Pikud HaOref (Home Front Command):
 *  - RED_ALERT  → "צבע אדום"   – immediate shelter required (rockets, missiles, hostile aircraft)
 *  - WARNING    → "התרעה"      – other threats (infiltration, chemical, etc.)
 *  - ALL_CLEAR  → "יציאה מהמקלט" – threat ended, can exit shelter
 */
export enum AlertType {
  RED_ALERT = 'red_alert',
  WARNING = 'warning',
  ALL_CLEAR = 'all_clear',
}

export enum AreaType {
  CITY = 'CITY',
  REGION = 'REGION',
  DISTRICT = 'DISTRICT',
  ZONE = 'ZONE',
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

export const NormalizedEventSchema = z.object({
  id: z.string(),
  source: z.string(),
  /** All sources that have reported this alert (cross-source provenance tracking) */
  provenance: z.array(z.string()).default([]),
  timestamp: z.date(),
  areaName: z.string(),
  areaType: z.nativeEnum(AreaType),
  cityNames: z.array(z.string()),
  geofenceId: z.string().optional(),
  rawPayload: z.unknown(),
  receivedAt: z.date(),
  updatedAt: z.date(),
  severity: z.nativeEnum(AlertSeverity),
  confidence: z.number().min(0).max(1),
  status: z.nativeEnum(AlertStatus),
  category: z.nativeEnum(AlertCategory),
  alertType: z.nativeEnum(AlertType).default(AlertType.WARNING),
  ttlSeconds: z.number().default(300),
  title: z.string().default(''),
  description: z.string().default(''),
})

export type NormalizedEvent = z.infer<typeof NormalizedEventSchema>

/** Wire format sent over WebSocket and REST */
export interface NormalizedEventDTO {
  id: string
  source: string
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
  alertType: AlertType
  ttlSeconds: number
  title: string
  description: string
}

export function toDTO(event: NormalizedEvent): NormalizedEventDTO {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { rawPayload, ...rest } = event
  return {
    ...rest,
    timestamp: event.timestamp.toISOString(),
    receivedAt: event.receivedAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
    provenance: event.provenance ?? [event.source],
    alertType: event.alertType ?? AlertType.WARNING,
    title: event.title ?? '',
    description: event.description ?? '',
  }
}

// Alert category mapping from OREF category codes
// Source: Pikud HaOref public documentation
export const OREF_CATEGORY_MAP: Record<number, AlertCategory> = {
  1: AlertCategory.ROCKETS,         // ירי רקטות וטילים
  2: AlertCategory.RADIATION,       // רדיולוגי / גרעיני
  3: AlertCategory.EARTHQUAKE,      // רעידת אדמה
  4: AlertCategory.EVENT_ENDED,     // האירוע הסתיים
  5: AlertCategory.TSUNAMI,         // צונאמי
  6: AlertCategory.HOSTILE_AIRCRAFT, // כלי טיס עוין
  7: AlertCategory.INFILTRATION,    // חדירת מחבלים
  13: AlertCategory.EVENT_ENDED,       // האירוע הסתיים
  14: AlertCategory.UNKNOWN,           // צפויות התרעות (pre-alert)
  101: AlertCategory.CHEMICAL,      // אירוע כימי
}

export const CATEGORY_SEVERITY: Record<AlertCategory, AlertSeverity> = {
  [AlertCategory.ROCKETS]: AlertSeverity.HIGH,
  [AlertCategory.MISSILE]: AlertSeverity.CRITICAL,
  [AlertCategory.HOSTILE_AIRCRAFT]: AlertSeverity.CRITICAL,
  [AlertCategory.INFILTRATION]: AlertSeverity.CRITICAL,
  [AlertCategory.EARTHQUAKE]: AlertSeverity.HIGH,
  [AlertCategory.RADIATION]: AlertSeverity.HIGH,
  [AlertCategory.TSUNAMI]: AlertSeverity.CRITICAL,
  [AlertCategory.CHEMICAL]: AlertSeverity.HIGH,
  [AlertCategory.EVENT_ENDED]: AlertSeverity.LOW,
  [AlertCategory.UNKNOWN]: AlertSeverity.MEDIUM,
}

/** Map alert category to the UI-visible alert type */
export const CATEGORY_ALERT_TYPE: Record<AlertCategory, AlertType> = {
  [AlertCategory.ROCKETS]: AlertType.RED_ALERT,
  [AlertCategory.MISSILE]: AlertType.RED_ALERT,
  [AlertCategory.HOSTILE_AIRCRAFT]: AlertType.RED_ALERT,
  [AlertCategory.INFILTRATION]: AlertType.WARNING,
  [AlertCategory.EARTHQUAKE]: AlertType.WARNING,
  [AlertCategory.RADIATION]: AlertType.WARNING,
  [AlertCategory.TSUNAMI]: AlertType.WARNING,
  [AlertCategory.CHEMICAL]: AlertType.WARNING,
  [AlertCategory.EVENT_ENDED]: AlertType.ALL_CLEAR,
  [AlertCategory.UNKNOWN]: AlertType.WARNING,
}

/**
 * Derive AlertType from the OREF raw title and category.
 * The title field contains the Hebrew alert name sent by Pikud HaOref.
 */
export function alertTypeFromOrefTitle(title: string, category: AlertCategory): AlertType {
  // EVENT_ENDED (cat 4) is always an all-clear signal
  if (category === AlertCategory.EVENT_ENDED) {
    return AlertType.ALL_CLEAR
  }
  // All-clear messages contain these phrases
  if (
    title.includes('יציאה מהמקלט') ||
    title.includes('ביטול התרעה') ||
    title.includes('ניתן לצאת') ||
    title.includes('האירוע הסתיים') ||
    title.includes('all clear')
  ) {
    return AlertType.ALL_CLEAR
  }
  return CATEGORY_ALERT_TYPE[category] ?? AlertType.WARNING
}
