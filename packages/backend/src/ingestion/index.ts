import { EventEmitter } from 'events'
import { BaseIngestionAdapter, AdapterStatus } from './adapters/base'
import { MockIngestionAdapter } from './adapters/mock'
import { OrefIngestionAdapter } from './adapters/oref'
import { DeduplicationCache } from './deduplication'
import {
  NormalizedEvent,
  AlertStatus,
  AlertType,
  AlertCategory,
  AlertSeverity,
  AreaType,
} from '../normalization/schema'
import { geofenceIndex } from '../geospatial'
import { query, isDbAvailable } from '../persistence/db'
import { config } from '../config'
import { logger } from '../logger'

export class IngestionManager extends EventEmitter {
  private adapters: BaseIngestionAdapter[] = []
  private dedup = new DeduplicationCache(30_000)
  private eventStore: NormalizedEvent[] = []
  private expiryTimer: NodeJS.Timeout | null = null

  initialize(): void {
    if (config.ingestion.mockEnabled) {
      this.addAdapter(new MockIngestionAdapter())
    }
    if (config.ingestion.orefEnabled) {
      this.addAdapter(new OrefIngestionAdapter())
    }
    if (this.adapters.length === 0) {
      logger.warn('No ingestion adapters configured — no live data will flow')
    }

    // Expire old events periodically
    this.expiryTimer = setInterval(() => this.expireOldEvents(), 15_000)
    this.expiryTimer.unref()
  }

  private addAdapter(adapter: BaseIngestionAdapter): void {
    adapter.on('event', (event: NormalizedEvent) => this.handleEvent(event))
    adapter.on('error', (err: Error) => {
      logger.error({ adapter: adapter.name, err: err.message }, 'Ingestion adapter error')
    })
    this.adapters.push(adapter)
  }

  async startAll(): Promise<void> {
    await Promise.all(this.adapters.map((a) => a.start()))
    logger.info({ adapters: this.adapters.map((a) => a.name) }, 'All adapters started')
  }

  async stopAll(): Promise<void> {
    if (this.expiryTimer) clearInterval(this.expiryTimer)
    await Promise.all(this.adapters.map((a) => a.stop()))
  }

  async enableAdapter(name: string): Promise<boolean> {
    const adapter = this.adapters.find((a) => a.name === name)
    if (!adapter) return false
    await adapter.start()
    logger.info({ adapter: name }, 'Adapter enabled via API')
    return true
  }

  async disableAdapter(name: string): Promise<boolean> {
    const adapter = this.adapters.find((a) => a.name === name)
    if (!adapter) return false
    await adapter.stop()
    logger.info({ adapter: name }, 'Adapter disabled via API')
    return true
  }

  private handleEvent(event: NormalizedEvent): void {
    // Initialize provenance with the reporting source
    if (!event.provenance || event.provenance.length === 0) {
      event.provenance = [event.source]
    }

    // Resolve geofenceId from spatial index if not already set
    // This is critical: OREF sends Hebrew area names; the spatial index maps them to geofence IDs
    if (!event.geofenceId) {
      const resolved = geofenceIndex.resolveByName(event.areaName)
      if (resolved?.properties?.id) {
        event.geofenceId = resolved.properties.id as string
        logger.debug(
          { areaName: event.areaName, geofenceId: event.geofenceId },
          'Geofence resolved for area'
        )
      } else {
        logger.warn(
          { areaName: event.areaName, source: event.source },
          'No geofence match for area name — alert will not render as polygon on map'
        )
      }
    }

    const result = this.dedup.check(event)

    if (result.action === 'drop') {
      logger.debug({ id: event.id, area: event.areaName, src: event.source }, 'Duplicate event dropped')
      return
    }

    if (result.action === 'merge') {
      // Another source confirmed the same alert — add to provenance of canonical event
      const canonical = this.eventStore.find((e) => e.id === result.canonicalId)
      if (canonical) {
        if (!canonical.provenance.includes(event.source)) {
          canonical.provenance.push(event.source)
          // Boost confidence slightly for multi-source confirmation
          canonical.confidence = Math.min(1, canonical.confidence + 0.1)
          canonical.updatedAt = new Date()
          logger.info(
            { canonicalId: canonical.id, newSource: event.source, provenance: canonical.provenance },
            'Cross-source alert confirmation — provenance updated'
          )
          this.emit('event', canonical)
        }
      }
      return
    }

    // New event
    this.eventStore.push(event)
    if (this.eventStore.length > 200) this.eventStore.shift()

    logger.info({ id: event.id, area: event.areaName, cat: event.category, src: event.source }, 'New alert event')
    this.emit('event', event)

    // Persist to DB (fire-and-forget)
    this.persistEventToDb(event).catch((err) =>
      logger.warn({ err: (err as Error).message, id: event.id }, 'DB persist failed')
    )
  }

  private expireOldEvents(): void {
    const now = Date.now()
    let expired = 0
    for (const event of this.eventStore) {
      if (event.status === AlertStatus.ACTIVE) {
        const age = now - event.timestamp.getTime()
        if (age > event.ttlSeconds * 1000) {
          event.status = AlertStatus.EXPIRED
          event.updatedAt = new Date()
          expired++
          this.emit('event:expired', event)
        }
      }
    }
    if (expired > 0) {
      logger.debug({ expired }, 'Events expired')
      this.emit('events:changed')
    }
  }

  getActiveEvents(): NormalizedEvent[] {
    return this.eventStore.filter((e) => e.status === AlertStatus.ACTIVE)
  }

  getRecentEvents(limitMs = 300_000): NormalizedEvent[] {
    const cutoff = Date.now() - limitMs
    return this.eventStore.filter((e) => e.receivedAt.getTime() > cutoff)
  }

  getAllEvents(): NormalizedEvent[] {
    return [...this.eventStore]
  }

  getAdapterStatuses(): AdapterStatus[] {
    return this.adapters.map((a) => a.getStatus())
  }

  /**
   * Returns up to `limit` events for the WebSocket init message.
   * Merges in-memory events (authoritative, up-to-date) with recent DB history
   * so the client list is populated even after a backend restart.
   */
  async getInitEvents(limit = 50): Promise<NormalizedEvent[]> {
    const memEvents = this.getRecentEvents(300_000)
    if (!isDbAvailable()) return memEvents

    try {
      const rows = await query<Record<string, unknown>>(
        `SELECT id, source, timestamp, area_name, area_type, city_names,
                geofence_id, received_at, updated_at, severity, confidence,
                status, category, ttl_seconds,
                COALESCE(alert_type, 'warning') AS alert_type,
                COALESCE(title, '')             AS title,
                COALESCE(description, '')       AS description
         FROM alert_events
         ORDER BY timestamp DESC
         LIMIT $1`,
        [limit]
      )
      const memIds = new Set(memEvents.map((e) => e.id))
      const dbEvents: NormalizedEvent[] = rows
        .filter((r) => !memIds.has(r.id as string))
        .map((r) => ({
          id:          r.id as string,
          source:      r.source as string,
          provenance:  [r.source as string],
          timestamp:   r.timestamp as Date,
          areaName:    r.area_name as string,
          areaType:    r.area_type as AreaType,
          cityNames:   r.city_names as string[],
          geofenceId:  (r.geofence_id as string | null) ?? undefined,
          rawPayload:  null,
          receivedAt:  r.received_at as Date,
          updatedAt:   r.updated_at as Date,
          severity:    r.severity as AlertSeverity,
          confidence:  r.confidence as number,
          status:      r.status as AlertStatus,
          category:    r.category as AlertCategory,
          alertType:   (r.alert_type as AlertType) ?? AlertType.WARNING,
          ttlSeconds:  r.ttl_seconds as number,
          title:       (r.title as string) ?? '',
          description: (r.description as string) ?? '',
        }))

      return [...memEvents, ...dbEvents]
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, limit)
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'DB history fetch for WS init failed — using memory only')
      return memEvents
    }
  }

  private async persistEventToDb(event: NormalizedEvent): Promise<void> {
    if (!isDbAvailable()) return
    await query(
      `INSERT INTO alert_events (
        id, source, timestamp, area_name, area_type, city_names, geofence_id,
        raw_payload, received_at, updated_at, severity, confidence, status,
        category, ttl_seconds, alert_type, title, description
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      ON CONFLICT (id) DO UPDATE SET
        status      = EXCLUDED.status,
        updated_at  = EXCLUDED.updated_at,
        confidence  = EXCLUDED.confidence,
        geofence_id = EXCLUDED.geofence_id`,
      [
        event.id,
        event.source,
        event.timestamp,
        event.areaName,
        event.areaType,
        event.cityNames,
        event.geofenceId ?? null,
        JSON.stringify(event.rawPayload),
        event.receivedAt,
        event.updatedAt,
        event.severity,
        event.confidence,
        event.status,
        event.category,
        event.ttlSeconds,
        event.alertType ?? 'warning',
        event.title ?? '',
        event.description ?? '',
      ]
    )
  }
}
