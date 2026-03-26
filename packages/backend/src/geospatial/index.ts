import { loadGeofences } from './loader'
import { SpatialIndex } from './spatial-index'
import { config } from '../config'

export const geofenceIndex = new SpatialIndex()

export function initGeospatial(): void {
  const collection = loadGeofences(config.geofencesPath)
  geofenceIndex.build(collection)
}

export { loadGeofences, SpatialIndex }
export type { GeofenceCollection, GeofenceFeature } from './loader'
