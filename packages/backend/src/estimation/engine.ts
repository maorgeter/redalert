/**
 * Dynamic Estimated Threat Zone Engine
 *
 * DISCLAIMER: All outputs of this engine are ESTIMATED VISUALIZATIONS derived
 * solely from the sequence and timing of publicly available alert events.
 * They do NOT represent actual trajectory predictions, military intelligence,
 * or authoritative threat assessments. Official alert areas are the sole
 * authoritative source. Never rely on this engine for life-safety decisions.
 */
import { EventEmitter } from 'events'
import * as turf from '@turf/turf'
import { v4 as uuidv4 } from 'uuid'
import type { Feature, Polygon, MultiPolygon } from 'geojson'

import { NormalizedEvent, AlertStatus } from '../normalization/schema'
import { geofenceIndex } from '../geospatial'
import { config } from '../config'
import { logger } from '../logger'

import { unionPolygons, simplifyPolygon } from './algorithms/union'
import { bufferPolygon, directionalBuffer } from './algorithms/buffer'
import { computeZoneConfidence } from './algorithms/decay'
import { detectMovementTrend } from './algorithms/trend'
import type { EstimatedZone, ZoneExplanation } from './types'

export class EstimationEngine extends EventEmitter {
  private timer: NodeJS.Timeout | null = null
  private currentZones: EstimatedZone[] = []
  private getActiveEvents: () => NormalizedEvent[]
  private getRecentEvents: () => NormalizedEvent[]

  constructor(
    getActiveEvents: () => NormalizedEvent[],
    getRecentEvents: () => NormalizedEvent[]
  ) {
    super()
    this.getActiveEvents = getActiveEvents
    this.getRecentEvents = getRecentEvents
  }

  start(): void {
    this.timer = setInterval(
      () => this.recompute(),
      config.estimation.recomputeIntervalMs
    )
    logger.info('Estimation engine started')
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  getCurrentZones(): EstimatedZone[] {
    return this.currentZones
  }

  private recompute(): void {
    try {
      const zones = this.computeZones()
      this.currentZones = zones
      this.emit('zones', zones)
    } catch (err) {
      logger.error({ err }, 'Estimation engine error during recompute')
    }
  }

  private computeZones(): EstimatedZone[] {
    const activeEvents = this.getActiveEvents()
    if (activeEvents.length === 0) return []

    // Resolve each active event to its geofence polygon
    const resolved: Array<{ event: NormalizedEvent; polygon: Feature<Polygon | MultiPolygon> }> = []

    for (const event of activeEvents) {
      let gf = event.geofenceId ? geofenceIndex.getById(event.geofenceId) : undefined
      if (!gf) gf = geofenceIndex.resolveByName(event.areaName)
      if (!gf) continue

      resolved.push({
        event,
        polygon: gf as Feature<Polygon | MultiPolygon>,
      })
    }

    if (resolved.length === 0) return []

    const polygons = resolved.map((r) => r.polygon)
    const events = resolved.map((r) => r.event)

    // ── Step 1: Union all active geofences ──────────────────────────────────
    const unioned = unionPolygons(polygons)
    if (!unioned) return []

    // ── Step 2: Detect movement trend ────────────────────────────────────────
    const recentEvents = this.getRecentEvents()
    const trend = detectMovementTrend(recentEvents, (event) => {
      const gf = event.geofenceId
        ? geofenceIndex.getById(event.geofenceId)
        : geofenceIndex.resolveByName(event.areaName)
      return gf
    })

    // ── Step 3: Buffer (directional if trend detected) ───────────────────────
    const bufferKm = config.estimation.bufferKm
    let buffered: Feature<Polygon | MultiPolygon>

    const notes: string[] = []
    let method: ZoneExplanation['method'] = 'buffered_union'

    if (trend && trend.confidence >= 0.5) {
      method = 'trend_weighted'
      buffered = directionalBuffer(unioned, trend.bearing, bufferKm, bufferKm * 1.5)
      notes.push(
        `Movement trend detected: bearing ${trend.bearing.toFixed(0)}°, ` +
        `${trend.speedKmPerMin.toFixed(1)} km/min (${trend.evidenceCount} events, ` +
        `confidence ${(trend.confidence * 100).toFixed(0)}%)`
      )
    } else {
      if (resolved.length === 1) method = 'single_buffered'
      buffered = bufferPolygon(unioned, bufferKm)
      notes.push(`Uniform ${bufferKm}km buffer applied around ${resolved.length} active area(s)`)
    }

    // ── Step 4: Simplify for performance ─────────────────────────────────────
    const simplified = simplifyPolygon(buffered)

    // ── Step 5: Uncertainty envelope (larger outer buffer) ───────────────────
    let uncertaintyGeometry: Feature<Polygon | MultiPolygon> | null = null
    try {
      uncertaintyGeometry = simplifyPolygon(
        bufferPolygon(simplified, bufferKm * config.estimation.uncertaintyMultiplier)
      )
    } catch {
      // Non-critical — omit uncertainty envelope if it fails
    }

    // ── Step 6: Compute confidence ────────────────────────────────────────────
    const now = Date.now()
    const mostRecentAge = now - Math.max(...events.map((e) => e.timestamp.getTime()))
    let confidence = computeZoneConfidence(mostRecentAge, resolved.length, config.estimation.decayMs)

    // Multi-source confirmation boost: events with >1 source in provenance increase confidence
    const multiSourceCount = events.filter((e) => (e.provenance?.length ?? 1) > 1).length
    if (multiSourceCount > 0) {
      const boost = Math.min(0.15, multiSourceCount * 0.05)
      confidence = Math.min(1, confidence + boost)
      notes.push(`Multi-source confirmation: ${multiSourceCount} event(s) corroborated by multiple sources (+${(boost * 100).toFixed(0)}% confidence)`)
    }

    const affectedAreas = [...new Set(events.map((e) => e.areaName))]

    notes.push(
      `Derived from ${resolved.length} of ${activeEvents.length} active events with resolvable geofences.`,
      'ESTIMATED VISUALIZATION ONLY — not an authoritative threat assessment.'
    )

    const zone: EstimatedZone = {
      id: uuidv4(),
      geometry: simplified,
      uncertaintyGeometry,
      sourceGeofenceIds: resolved
        .map((r) => r.event.geofenceId ?? geofenceIndex.resolveByName(r.event.areaName)?.properties?.id)
        .filter(Boolean) as string[],
      affectedAreas,
      confidence,
      lastEventAt: new Date(Math.max(...events.map((e) => e.timestamp.getTime()))),
      computedAt: new Date(),
      explanation: {
        method,
        activeEventCount: activeEvents.length,
        bufferKm,
        unionedAreaCount: resolved.length,
        trendDetected: !!trend,
        notes,
      },
      trend: trend ?? null,
    }

    return [zone]
  }
}
