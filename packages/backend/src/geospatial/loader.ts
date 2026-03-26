import * as fs from 'fs'
import * as path from 'path'
import type { FeatureCollection, Feature, Polygon, MultiPolygon, GeoJsonProperties } from 'geojson'
import { logger } from '../logger'

export type GeofenceFeature = Feature<Polygon | MultiPolygon, GeoJsonProperties & {
  id: string
  name: string
  nameHe?: string
  region?: string
}>

export type GeofenceCollection = FeatureCollection<Polygon | MultiPolygon, GeoJsonProperties>

export function loadGeofences(filePath: string): GeofenceCollection {
  const resolved = path.resolve(filePath)
  if (!fs.existsSync(resolved)) {
    logger.warn({ path: resolved }, 'Geofences file not found — using empty collection')
    return { type: 'FeatureCollection', features: [] }
  }

  const raw = fs.readFileSync(resolved, 'utf-8')
  const geojson = JSON.parse(raw) as GeofenceCollection

  if (geojson.type !== 'FeatureCollection') {
    throw new Error('Geofences file must be a GeoJSON FeatureCollection')
  }

  const valid = geojson.features.filter(
    (f) => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')
  )

  logger.info({ count: valid.length }, 'Geofences loaded')
  return { type: 'FeatureCollection', features: valid }
}
