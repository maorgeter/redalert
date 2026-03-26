import * as turf from '@turf/turf'
import type { Feature, Polygon, MultiPolygon } from 'geojson'

/**
 * Buffer a polygon outward by the given distance in kilometers.
 * Returns the original if buffering fails.
 */
export function bufferPolygon(
  polygon: Feature<Polygon | MultiPolygon>,
  distanceKm: number
): Feature<Polygon | MultiPolygon> {
  try {
    const buffered = turf.buffer(polygon, distanceKm, { units: 'kilometers' })
    if (buffered) return buffered as Feature<Polygon | MultiPolygon>
  } catch {
    // Buffer can fail on degenerate geometries
  }
  return polygon
}

/**
 * Apply directional weighting to a buffer.
 * Extends the polygon more in the direction of movement than perpendicular.
 *
 * Implementation: we buffer asymmetrically by translating the polygon
 * in the trend direction before buffering, creating an elongated zone.
 */
export function directionalBuffer(
  polygon: Feature<Polygon | MultiPolygon>,
  bearingDeg: number,
  baseKm: number,
  extendKm: number
): Feature<Polygon | MultiPolygon> {
  try {
    const center = turf.centroid(polygon)
    // Move centroid toward the trend direction
    const shifted = turf.destination(center, extendKm * 0.5, bearingDeg, {
      units: 'kilometers',
    })

    // Create a convex hull over the original + shifted polygon
    const combined = turf.featureCollection([
      polygon,
      turf.circle(shifted, extendKm, { units: 'kilometers', steps: 32 }),
    ])

    const hull = turf.convex(combined)
    if (hull) {
      return bufferPolygon(hull as Feature<Polygon | MultiPolygon>, baseKm * 0.5)
    }
  } catch {
    // Fall back to simple buffer
  }
  return bufferPolygon(polygon, baseKm)
}
