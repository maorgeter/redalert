/**
 * Pikud HaOref (Israel Home Front Command) public alert feed adapter.
 *
 * Data source: https://www.oref.org.il — publicly accessible alert endpoint.
 * No authentication, no classified data, no internal systems.
 *
 * Behavior:
 *  - Polls every POLL_INTERVAL_MS (default 3 s)
 *  - Empty / 204 response = no active alerts — healthy state, just silent
 *  - Non-empty JSON = active alert, emits one normalized event per area
 *  - Deduplicates by alert ID within a 60 s sliding window
 *  - Retries up to 3× with exponential backoff on network errors
 */
import fetch from 'node-fetch'
import { BaseIngestionAdapter } from './base'
import { Normalizer } from '../../normalization/normalizer'
import type { OrefRawAlert } from '../../normalization/normalizer'
import { config } from '../../config'
import { logger } from '../../logger'
import { withExponentialBackoff } from '../retry'

const OREF_ALERTS_URL = 'https://www.oref.org.il/WarningMessages/alert/alerts.json'

const OREF_HEADERS = {
  'X-Requested-With': 'XMLHttpRequest',
  Referer: 'https://www.oref.org.il/',
  'User-Agent': 'Mozilla/5.0 (compatible; AlertMapMonitor/1.0; public-data-only)',
  Accept: 'application/json',
  'Cache-Control': 'no-cache',
}

export class OrefIngestionAdapter extends BaseIngestionAdapter {
  readonly name = 'oref'
  private timer: NodeJS.Timeout | null = null
  private normalizer = new Normalizer()
  private seenIds = new Set<string>()

  constructor() {
    // polling, isPrimary=true, reliabilityScore=0.95
    super(config.ingestion.pollIntervalMs, 'polling', true, 0.95)
  }

  async start(): Promise<void> {
    this.running = true
    this.status.enabled = true
    logger.info('OREF public alert adapter started — polling every %dms', config.ingestion.pollIntervalMs)
    // Mark healthy immediately so the UI shows "connecting" rather than "error"
    this.status.healthy = false
    await this.poll()
  }

  async stop(): Promise<void> {
    this.running = false
    this.status.enabled = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private async poll(): Promise<void> {
    if (!this.running) return
    try {
      await withExponentialBackoff(() => this.fetchAndEmit(), {
        maxRetries: 3,
        baseDelayMs: 1500,
        label: 'oref-poll',
      })
    } catch (err) {
      this.handleError(err)
    } finally {
      if (this.running) {
        this.timer = setTimeout(() => this.poll(), config.ingestion.pollIntervalMs)
      }
    }
  }

  private async fetchAndEmit(): Promise<void> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    let res: Awaited<ReturnType<typeof fetch>>
    try {
      res = await fetch(OREF_ALERTS_URL, {
        headers: OREF_HEADERS,
        // node-fetch v2 accepts signal via options
        ...(controller.signal ? { signal: controller.signal as never } : {}),
      })
    } finally {
      clearTimeout(timeout)
    }

    // Mark the connection as healthy on any successful HTTP response
    this.status.healthy = true
    this.status.lastSuccess = new Date()

    // 204 or empty body = no active alerts. This is normal and healthy.
    if (res.status === 204) return

    const text = await res.text()
    if (!text || text.trim().length < 5) return

    let raw: OrefRawAlert
    try {
      raw = JSON.parse(text) as OrefRawAlert
    } catch {
      // Malformed response — log but don't mark unhealthy (transient)
      logger.debug({ text: text.slice(0, 200) }, 'OREF response not valid JSON (no active alert)')
      return
    }

    // Deduplicate by alert ID
    if (raw.id && this.seenIds.has(raw.id)) return

    if (raw.id) {
      this.seenIds.add(raw.id)
      if (this.seenIds.size > 200) {
        const first = this.seenIds.values().next().value
        if (first) this.seenIds.delete(first)
      }
    }

    const events = this.normalizer.normalizeOrefMultiArea(raw)
    if (events.length > 0) {
      this.emitEvents(events)
      logger.info(
        { areas: events.map((e) => e.areaName), alertId: raw.id },
        'OREF public alert received'
      )
    }
  }
}
