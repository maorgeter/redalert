import * as turf from '@turf/turf'
import type { Feature, Polygon, MultiPolygon } from 'geojson'

/**
 * Union an array of polygons into a single polygon/multipolygon.
 * Falls back gracefully for edge cases.
 */
export function unionPolygons(
  polygons: Feature<Polygon | MultiPolygon>[]
): Feature<Polygon | MultiPolygon> | null {
  if (polygons.length === 0) return null
  if (polygons.length === 1) return polygons[0]

  let result: Feature<Polygon | MultiPolygon> = polygons[0]
  for (let i = 1; i < polygons.length; i++) {
    try {
      const merged = turf.union(result, polygons[i])
      if (merged) result = merged
    } catch {
      // If union fails (e.g., invalid geometry), continue with existing result
    }
  }
  return result
}

/**
 * Simplify a polygon for performance.
 * tolerance is in degrees (~0.001° ≈ 111m).
 */
export function simplifyPolygon(
  polygon: Feature<Polygon | MultiPolygon>,
  tolerance = 0.001
): Feature<Polygon | MultiPolygon> {
  try {
    return turf.simplify(polygon, { tolerance, highQuality: false }) as Feature<
      Polygon | MultiPolygon
    >
  } catch {
    return polygon
  }
}
