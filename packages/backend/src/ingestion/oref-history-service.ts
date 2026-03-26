/**
 * OrefHistoryService — seeds the alert_events DB table from the official
 * Pikud HaOref alert history endpoint.
 *
 * URL:  https://www.oref.org.il/warningMessages/alert/History/AlertsHistory.json
 *
 * This service runs independently of the real-time alert pipeline:
 *  - It does NOT emit events to WebSocket clients (avoids flooding active users
 *    with stale history on every page load).
 *  - It ONLY persists rows to PostgreSQL so the GET /api/alerts/history endpoint
 *    has data even after a backend restart.
 *  - Deduplication: an in-memory Set prevents re-inserting the same (date, area)
 *    pair within the lifetime of the process.
 *
 * The history JSON format differs from the live alerts.json:
 *   - It is an ARRAY of items (not a single object)
 *   - `data` is a single area-name string (not an array)
 *   - `alertDate` is the timestamp ("DD.MM.YY HH:mm" or ISO-like)
 *   - `category` is a number (not a string)
 *   - There is no `id` field — we generate a stable hash-based ID
 */

import fetch from 'node-fetch'
import { createHash } from 'crypto'
import { query, isDbAvailable } from '../persistence/db'
import { OREF_CATEGORY_MAP, AlertType, CATEGORY_ALERT_TYPE, AlertStatus, AlertSeverity, CATEGORY_SEVERITY, AlertCategory } from '../normalization/schema'
import { logger } from '../logger'

const HISTORY_URL =
  'https://www.oref.org.il/warningMessages/alert/History/AlertsHistory.json'

const HISTORY_POLL_MS = 60_000   // re-check every 60 s

const HISTORY_HEADERS = {
  'X-Requested-With': 'XMLHttpRequest',
  Referer:           'https://www.oref.org.il/',
  Origin:            'https://www.oref.org.il',
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept':          'application/json, text/plain, */*',
  'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cache-Control':   'no-cache',
  Pragma:            'no-cache',
}

export interface OrefHistoryItem {
  alertDate:     string
  title:         string
  data:          string          // single area name
  category:      number | string
  category_desc?: string
  matnat?:       string
  threat?:       string
}

/** Parse the OREF alertDate string into a JS Date.
 *  Observed formats: "DD.MM.YY HH:mm"  |  "YYYY-MM-DD HH:mm:ss"  |  ISO
 */
function parseAlertDate(raw: string): Date {
  // "07.10.23 06:29" → 2023-10-07T06:29:00
  const ddmmyy = /^(\d{2})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})/.exec(raw)
  if (ddmmyy) {
    const [, dd, mm, yy, hh, mi] = ddmmyy
    return new Date(`20${yy}-${mm}-${dd}T${hh}:${mi}:00`)
  }
  // "2023-10-07 06:29:42" / ISO
  const attempt = new Date(raw)
  return isNaN(attempt.getTime()) ? new Date() : attempt
}

/** Stable, collision-resistant ID from (alertDate, area name) */
function historyId(date: string, area: string): string {
  return 'oref-h-' + createHash('sha1')
    .update(`${date}|${area}`)
    .digest('hex')
    .slice(0, 14)
}

export class OrefHistoryService {
  private timer: NodeJS.Timeout | null = null
  private running = false
  private seenKeys = new Set<string>()

  async start(): Promise<void> {
    this.running = true
    logger.info('OREF history service started — seeding DB from AlertsHistory.json every %ds', HISTORY_POLL_MS / 1000)
    // Immediate first fetch to seed DB on startup
    await this.fetchAndPersist().catch((err) =>
      logger.warn({ err: (err as Error).message }, 'OREF history: initial fetch failed')
    )
    this.scheduleNext()
  }

  stop(): void {
    this.running = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private scheduleNext(): void {
    if (!this.running) return
    this.timer = setTimeout(() => {
      this.fetchAndPersist()
        .catch((err) => logger.warn({ err: (err as Error).message }, 'OREF history: poll failed'))
        .finally(() => this.scheduleNext())
    }, HISTORY_POLL_MS)
  }

  private async fetchAndPersist(): Promise<void> {
    if (!isDbAvailable()) return

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12_000)

    let res: Awaited<ReturnType<typeof fetch>>
    try {
      res = await fetch(HISTORY_URL, {
        headers: HISTORY_HEADERS,
        ...(controller.signal ? { signal: controller.signal as never } : {}),
      })
    } finally {
      clearTimeout(timeout)
    }

    if (res.status === 204) return
    const text = await res.text()
    if (!text || text.trim().length < 5) return

    let items: OrefHistoryItem[]
    try {
      const parsed = JSON.parse(text)
      items = Array.isArray(parsed) ? parsed : []
    } catch {
      logger.debug({ text: text.slice(0, 200) }, 'OREF history: non-JSON response')
      return
    }

    let inserted = 0
    for (const item of items) {
      if (!item.alertDate || !item.data) continue

      const key = `${item.alertDate}|${item.data}`
      if (this.seenKeys.has(key)) continue

      try {
        await this.persistItem(item)
        this.seenKeys.add(key)
        if (this.seenKeys.size > 5000) {
          const first = this.seenKeys.values().next().value
          if (first) this.seenKeys.delete(first)
        }
        inserted++
      } catch (err) {
        logger.warn({ err: (err as Error).message, item }, 'OREF history: persist failed for item')
      }
    }

    if (inserted > 0) {
      logger.info({ inserted }, 'OREF history: persisted new items to DB')
    }
  }

  private async persistItem(item: OrefHistoryItem): Promise<void> {
    const catCode = typeof item.category === 'string'
      ? parseInt(item.category, 10)
      : item.category
    const category   = OREF_CATEGORY_MAP[catCode] ?? AlertCategory.UNKNOWN
    const alertType  = CATEGORY_ALERT_TYPE[category] ?? AlertType.WARNING
    const severity   = CATEGORY_SEVERITY[category] ?? AlertSeverity.MEDIUM
    const timestamp  = parseAlertDate(item.alertDate)
    const areaName   = (item.data ?? '').trim()
    const id         = historyId(item.alertDate, areaName)
    const ttlSeconds = alertType === AlertType.ALL_CLEAR ? 30 : 300
    const status     = AlertStatus.EXPIRED   // history items are always past events

    await query(
      `INSERT INTO alert_events (
        id, source, timestamp, area_name, area_type, city_names,
        geofence_id, raw_payload, received_at, updated_at,
        severity, confidence, status, category, ttl_seconds,
        alert_type, title, description
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      ON CONFLICT (id) DO NOTHING`,
      [
        id,
        'oref-history',
        timestamp,
        areaName,
        'ZONE',
        [areaName],
        null,
        JSON.stringify(item),
        new Date(),
        new Date(),
        severity,
        0.9,
        status,
        category,
        ttlSeconds,
        alertType,
        item.title ?? '',
        item.category_desc ?? '',
      ]
    )
  }
}
