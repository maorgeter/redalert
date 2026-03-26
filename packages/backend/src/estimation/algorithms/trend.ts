import * as turf from '@turf/turf'
import type { Feature, Polygon, MultiPolygon } from 'geojson'
import type { MovementTrend } from '../types'
import type { NormalizedEvent } from '../../normalization/schema'
import type { GeofenceFeature } from '../../geospatial/loader'

interface TimedPoint {
  lng: number
  lat: number
  timestamp: Date
}

/**
 * Detect a movement trend from a sequence of timed geofence centroids.
 *
 * Requirements:
 * - At least 3 events with resolvable geofences
 * - Events must be within a 10-minute window
 * - Consecutive events must be < 100 km apart (no teleportation)
 *
 * Returns null when evidence is insufficient.
 *
 * IMPORTANT: This is a heuristic visualization aid derived entirely from
 * the sequence and timing of public alert events. It does NOT model actual
 * ballistic trajectories, flight paths, or military intelligence.
 */
export function detectMovementTrend(
  recentEvents: NormalizedEvent[],
  resolveGeofence: (event: NormalizedEvent) => GeofenceFeature | undefined
): MovementTrend | null {
  // Sort by timestamp ascending
  const sorted = [...recentEvents].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  )

  // Build timed point sequence
  const points: TimedPoint[] = []
  for (const event of sorted) {
    const gf = resolveGeofence(event)
    if (!gf) continue
    try {
      const center = turf.centroid(gf as Feature<Polygon | MultiPolygon>)
      points.push({
        lng: center.geometry.coordinates[0],
        lat: center.geometry.coordinates[1],
        timestamp: event.timestamp,
      })
    } catch {
      continue
    }
  }

  if (points.length < 3) return null

  // Check time window (must all be within 10 minutes)
  const timeSpanMs = points[points.length - 1].timestamp.getTime() - points[0].timestamp.getTime()
  if (timeSpanMs > 10 * 60 * 1000) return null

  // Calculate pairwise bearings and distances
  const bearings: number[] = []
  const speeds: number[] = []

  for (let i = 1; i < points.length; i++) {
    const from = turf.point([points[i - 1].lng, points[i - 1].lat])
    const to = turf.point([points[i].lng, points[i].lat])

    const dist = turf.distance(from, to, { units: 'kilometers' })
    if (dist > 100) return null // implausible jump

    if (dist < 0.5) continue // same area, skip

    const bearing = turf.bearing(from, to)
    bearings.push(bearing)

    const dt = (points[i].timestamp.getTime() - points[i - 1].timestamp.getTime()) / 1000 / 60
    if (dt > 0) speeds.push(dist / dt)
  }

  if (bearings.length < 2) return null

  // Average bearing (circular mean)
  const avgBearing = circularMean(bearings)
  const avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0

  // Confidence: how consistent are the bearings?
  const variance = bearingVariance(bearings, avgBearing)
  const confidence = Math.max(0, 1 - variance / 180)

  if (confidence < 0.3) return null

  return {
    bearing: avgBearing,
    speedKmPerMin: avgSpeed,
    evidenceCount: points.length,
    confidence,
  }
}

function circularMean(bearings: number[]): number {
  const sinSum = bearings.reduce((s, b) => s + Math.sin((b * Math.PI) / 180), 0)
  const cosSum = bearings.reduce((s, b) => s + Math.cos((b * Math.PI) / 180), 0)
  return (Math.atan2(sinSum / bearings.length, cosSum / bearings.length) * 180) / Math.PI
}

function bearingVariance(bearings: number[], mean: number): number {
  const diffs = bearings.map((b) => {
    let d = Math.abs(b - mean) % 360
    if (d > 180) d = 360 - d
    return d
  })
  return diffs.reduce((a, b) => a + b, 0) / diffs.length
}
