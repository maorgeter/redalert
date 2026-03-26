import { EventEmitter } from 'events'
import { BaseIngestionAdapter, AdapterStatus } from './adapters/base'
import { MockIngestionAdapter } from './adapters/mock'
import { OrefIngestionAdapter } from './adapters/oref'
import { DeduplicationCache } from './deduplication'
import { NormalizedEvent, AlertStatus } from '../normalization/schema'
import { geofenceIndex } from '../geospatial'
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

    logger.info({ id: event.id, area: event.areaName, src: event.source }, 'New alert event')
    this.emit('event', event)
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
}
