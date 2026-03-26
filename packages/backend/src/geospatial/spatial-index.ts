import * as turf from '@turf/turf'
import type { Feature, Polygon, MultiPolygon } from 'geojson'
import type { GeofenceCollection, GeofenceFeature } from './loader'

/**
 * In-memory spatial index for geofence lookups.
 * Supports lookup by:
 *  - exact ID
 *  - area name (case-insensitive, partial match)
 *  - point containment
 */
export class SpatialIndex {
  private byId = new Map<string, GeofenceFeature>()
  private byName = new Map<string, GeofenceFeature>()  // lowercase name → feature
  private all: GeofenceFeature[] = []

  build(collection: GeofenceCollection): void {
    this.byId.clear()
    this.byName.clear()
    this.all = []

    for (const feature of collection.features as GeofenceFeature[]) {
      const id = feature.properties?.id as string | undefined
      const name = feature.properties?.name as string | undefined
      const nameHe = feature.properties?.nameHe as string | undefined

      if (id) this.byId.set(id, feature)
      if (name) this.byName.set(name.toLowerCase(), feature)
      if (nameHe) this.byName.set(nameHe, feature)
      this.all.push(feature)
    }
  }

  getById(id: string): GeofenceFeature | undefined {
    return this.byId.get(id)
  }

  /**
   * Resolve an area name to its geofence.
   * Tries: exact → suffix-strip → prefix-match → partial → fuzzy.
   *
   * OREF returns district-level Hebrew names (e.g. "תל אביב - מרכז העיר")
   * while geofences use city names (e.g. "תל אביב - יפו").  The prefix-match
   * step handles this by comparing the first segment before the " - " separator.
   */
  resolveByName(areaName: string): GeofenceFeature | undefined {
    const lower = areaName.toLowerCase().trim()

    // 1. Exact
    const exact = this.byName.get(lower)
    if (exact) return exact

    // 2. Strip common directional/area suffixes
    const stripped = lower.replace(/\s*[-–]\s*(center|north|south|east|west|צפון|דרום|מרכז|מזרח|מערב|עיר|כרמל|נמל|נשר|חוף|שפלה)\s*$/i, '').trim()
    if (stripped !== lower) {
      const strippedMatch = this.byName.get(stripped)
      if (strippedMatch) return strippedMatch
    }

    // 3. Prefix match: compare first segment before " - "
    //    e.g. "תל אביב - מרכז העיר" → prefix "תל אביב" matches "תל אביב - יפו"
    const areaPrefix = lower.split(/\s*[-–]\s+/)[0].trim()
    if (areaPrefix && areaPrefix !== lower && areaPrefix.length >= 3) {
      for (const [key, feature] of this.byName.entries()) {
        const keyPrefix = key.split(/\s*[-–]\s+/)[0].trim()
        if (areaPrefix === keyPrefix) return feature
      }
    }

    // 4. Partial: check if any key starts with the area name or vice-versa
    for (const [key, feature] of this.byName.entries()) {
      if (key.startsWith(lower) || lower.startsWith(key)) return feature
    }

    // 5. Fuzzy: check if any key contains the area name or vice-versa
    for (const [key, feature] of this.byName.entries()) {
      if (key.includes(lower) || lower.includes(key)) return feature
    }

    return undefined
  }

  /**
   * Find all geofences that contain the given [lng, lat] point.
   */
  findContaining(lng: number, lat: number): GeofenceFeature[] {
    const pt = turf.point([lng, lat])
    return this.all.filter((f) => {
      try {
        return turf.booleanPointInPolygon(pt, f as Feature<Polygon | MultiPolygon>)
      } catch {
        return false
      }
    })
  }

  getAll(): GeofenceFeature[] {
    return this.all
  }

  get size(): number {
    return this.all.length
  }
}
