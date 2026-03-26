import { EventEmitter } from 'events'
import { NormalizedEvent } from '../../normalization/schema'

export type AdapterType = 'polling' | 'websocket' | 'webhook' | 'manual'

export interface AdapterStatus {
  name: string
  /** Transport mechanism used by this adapter */
  type: AdapterType
  healthy: boolean
  /** Whether the adapter is currently running */
  enabled: boolean
  /** Whether this is the primary/authoritative source */
  isPrimary: boolean
  /** Reliability score 0–1 (used to weight event confidence) */
  reliabilityScore: number
  lastSuccess: Date | null
  lastError: string | null
  eventCount: number
  errorCount: number
  /** Expected interval between successful polls in ms — used by UI for stale detection */
  updateIntervalMs: number
}

export abstract class BaseIngestionAdapter extends EventEmitter {
  abstract readonly name: string
  protected running = false
  protected status: AdapterStatus

  constructor(
    updateIntervalMs = 5000,
    type: AdapterType = 'polling',
    isPrimary = false,
    reliabilityScore = 0.8
  ) {
    super()
    this.status = {
      name: '',
      type,
      healthy: false,
      enabled: false,
      isPrimary,
      reliabilityScore,
      lastSuccess: null,
      lastError: null,
      eventCount: 0,
      errorCount: 0,
      updateIntervalMs,
    }
  }

  abstract start(): Promise<void>
  abstract stop(): Promise<void>

  getStatus(): AdapterStatus {
    return { ...this.status, name: this.name }
  }

  protected emitEvents(events: NormalizedEvent[]): void {
    events.forEach((e) => this.emit('event', e))
    this.status.eventCount += events.length
    this.status.lastSuccess = new Date()
    this.status.healthy = true
  }

  protected handleError(err: unknown): void {
    const message = err instanceof Error ? err.message : String(err)
    this.status.lastError = message
    this.status.errorCount++
    this.status.healthy = false
    this.emit('error', new Error(message))
  }
}
