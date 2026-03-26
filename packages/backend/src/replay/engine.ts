import { EventEmitter } from 'events'
import { NormalizedEvent, AlertStatus } from '../normalization/schema'
import { logger } from '../logger'
import { sleep } from '../ingestion/retry'

export type ReplaySpeed = 1 | 5 | 20

export interface ReplayState {
  sessionId: string
  status: 'idle' | 'playing' | 'paused' | 'finished'
  currentIndex: number
  totalEvents: number
  speed: ReplaySpeed
  startedAt: Date | null
  currentEventTime: Date | null
}

/**
 * Replays a sorted sequence of historical alert events, emitting them
 * with time-proportional delays adjusted by speed multiplier.
 */
export class ReplayEngine extends EventEmitter {
  private state: ReplayState = {
    sessionId: '',
    status: 'idle',
    currentIndex: 0,
    totalEvents: 0,
    speed: 1,
    startedAt: null,
    currentEventTime: null,
  }

  private events: NormalizedEvent[] = []
  private pausePromise: Promise<void> | null = null
  private pauseResolve: (() => void) | null = null
  private aborted = false

  getState(): ReplayState {
    return { ...this.state }
  }

  async start(sessionId: string, events: NormalizedEvent[], speed: ReplaySpeed = 1): Promise<void> {
    if (this.state.status === 'playing') await this.stop()

    this.events = [...events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    this.aborted = false
    this.state = {
      sessionId,
      status: 'playing',
      currentIndex: 0,
      totalEvents: this.events.length,
      speed,
      startedAt: new Date(),
      currentEventTime: this.events[0]?.timestamp ?? null,
    }

    logger.info({ sessionId, count: this.events.length, speed }, 'Replay started')
    this.emit('state', this.getState())
    this.run()
  }

  pause(): void {
    if (this.state.status !== 'playing') return
    this.state.status = 'paused'
    this.pausePromise = new Promise((resolve) => {
      this.pauseResolve = resolve
    })
    this.emit('state', this.getState())
  }

  resume(): void {
    if (this.state.status !== 'paused') return
    this.state.status = 'playing'
    this.pauseResolve?.()
    this.pauseResolve = null
    this.pausePromise = null
    this.emit('state', this.getState())
  }

  seek(index: number): void {
    this.state.currentIndex = Math.max(0, Math.min(index, this.events.length - 1))
    this.state.currentEventTime = this.events[this.state.currentIndex]?.timestamp ?? null
    this.emit('state', this.getState())
  }

  setSpeed(speed: ReplaySpeed): void {
    this.state.speed = speed
    this.emit('state', this.getState())
  }

  async stop(): Promise<void> {
    this.aborted = true
    this.pauseResolve?.()
    this.state.status = 'idle'
    this.emit('state', this.getState())
  }

  private async run(): Promise<void> {
    const events = this.events

    while (this.state.currentIndex < events.length && !this.aborted) {
      if (this.state.status === 'paused' && this.pausePromise) {
        await this.pausePromise
      }
      if (this.aborted) break

      const current = events[this.state.currentIndex]
      const next = events[this.state.currentIndex + 1]

      // Emit event as active
      const replayEvent: NormalizedEvent = {
        ...current,
        source: `replay:${current.source}`,
        status: AlertStatus.ACTIVE,
        receivedAt: new Date(),
      }
      this.emit('event', replayEvent)

      this.state.currentIndex++
      this.state.currentEventTime = current.timestamp

      // Wait proportional time until next event
      if (next) {
        const realGapMs = next.timestamp.getTime() - current.timestamp.getTime()
        const scaledGap = Math.min(realGapMs / this.state.speed, 5000)
        if (scaledGap > 50) await sleep(scaledGap)
      }
    }

    if (!this.aborted) {
      this.state.status = 'finished'
      this.emit('state', this.getState())
      this.emit('finished')
      logger.info({ sessionId: this.state.sessionId }, 'Replay finished')
    }
  }
}
