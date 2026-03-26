import { v4 as uuidv4 } from 'uuid'
import {
  AlertCategory,
  AlertStatus,
  AlertSeverity,
  AlertType,
  AreaType,
  NormalizedEvent,
  OREF_CATEGORY_MAP,
  CATEGORY_SEVERITY,
  CATEGORY_ALERT_TYPE,
  alertTypeFromOrefTitle,
} from './schema'

// ─── OREF public API raw format ───────────────────────────────────────────────
export interface OrefRawAlert {
  id: string
  cat: string          // category code as string
  title: string
  data: string[]       // area names
  desc: string
}

// ─── Mock / internal raw format ──────────────────────────────────────────────
export interface MockRawAlert {
  id?: string
  areaName: string
  cityNames?: string[]
  category: AlertCategory
  timestamp?: string
  geofenceId?: string
}

export class Normalizer {
  normalizeOref(raw: OrefRawAlert): NormalizedEvent {
    const catCode = parseInt(raw.cat, 10)
    const category = OREF_CATEGORY_MAP[catCode] ?? AlertCategory.ROCKETS
    const alertType = alertTypeFromOrefTitle(raw.title ?? '', category)
    const now = new Date()

    return {
      id: raw.id || uuidv4(),
      source: 'oref',
      provenance: ['oref'],
      timestamp: now,
      areaName: raw.data[0] ?? raw.title ?? 'כללי',
      areaType: AreaType.ZONE,
      cityNames: raw.data.length > 0 ? raw.data : [raw.title ?? 'כללי'],
      rawPayload: raw,
      receivedAt: now,
      updatedAt: now,
      severity: CATEGORY_SEVERITY[category],
      confidence: 1.0,
      status: AlertStatus.ACTIVE,
      category,
      alertType,
      ttlSeconds: alertType === AlertType.ALL_CLEAR ? 30 : 300,
      title: raw.title ?? '',
      description: raw.desc ?? '',
    }
  }

  /**
   * When OREF returns multiple areas in a single alert, split into individual
   * events (one per area) to allow per-polygon mapping.
   * EVENT_ENDED alerts (cat 4) may have an empty data array — we create a
   * single synthetic event so they are never silently dropped.
   */
  normalizeOrefMultiArea(raw: OrefRawAlert): NormalizedEvent[] {
    const baseId = raw.id || uuidv4()
    const catCode = parseInt(raw.cat, 10)
    const category = OREF_CATEGORY_MAP[catCode] ?? AlertCategory.ROCKETS
    const alertType = alertTypeFromOrefTitle(raw.title ?? '', category)
    const now = new Date()

    // Use the title as a fallback area name when data array is empty
    const areas: string[] = raw.data.length > 0 ? raw.data : [raw.title ?? 'כללי']

    return areas.map((areaName, i) => ({
      id: areas.length === 1 ? baseId : `${baseId}-${i}`,
      source: 'oref',
      provenance: ['oref'],
      timestamp: now,
      areaName,
      areaType: AreaType.ZONE,
      cityNames: [areaName],
      rawPayload: raw,
      receivedAt: now,
      updatedAt: now,
      severity: CATEGORY_SEVERITY[category],
      confidence: 1.0,
      status: AlertStatus.ACTIVE,
      category,
      alertType,
      ttlSeconds: alertType === AlertType.ALL_CLEAR ? 30 : 300,
      title: raw.title ?? '',
      description: raw.desc ?? '',
    }))
  }

  normalizeMock(raw: MockRawAlert): NormalizedEvent {
    const now = new Date()
    const category = raw.category ?? AlertCategory.ROCKETS
    return {
      id: raw.id ?? uuidv4(),
      source: 'mock',
      provenance: ['simulation'],
      timestamp: raw.timestamp ? new Date(raw.timestamp) : now,
      areaName: raw.areaName,
      areaType: AreaType.ZONE,
      cityNames: raw.cityNames ?? [raw.areaName],
      geofenceId: raw.geofenceId,
      rawPayload: raw,
      receivedAt: now,
      updatedAt: now,
      severity: CATEGORY_SEVERITY[category],
      confidence: 0.9,
      status: AlertStatus.ACTIVE,
      category,
      alertType: CATEGORY_ALERT_TYPE[category] ?? AlertType.WARNING,
      ttlSeconds: (CATEGORY_ALERT_TYPE[category] ?? AlertType.WARNING) === AlertType.ALL_CLEAR ? 30 : 300,
      title: '',
      description: '',
    }
  }

  /** Mark an event as expired */
  expire(event: NormalizedEvent): NormalizedEvent {
    return {
      ...event,
      status: AlertStatus.EXPIRED,
      updatedAt: new Date(),
    }
  }

  /** Raise severity based on multiple simultaneous nearby events */
  escalateSeverity(event: NormalizedEvent, activeNearbyCount: number): NormalizedEvent {
    if (activeNearbyCount < 3) return event
    const escalated: Record<AlertSeverity, AlertSeverity> = {
      [AlertSeverity.LOW]: AlertSeverity.MEDIUM,
      [AlertSeverity.MEDIUM]: AlertSeverity.HIGH,
      [AlertSeverity.HIGH]: AlertSeverity.CRITICAL,
      [AlertSeverity.CRITICAL]: AlertSeverity.CRITICAL,
    }
    return { ...event, severity: escalated[event.severity] }
  }
}
