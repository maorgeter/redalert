import * as path from 'path'
import { loadGeofences } from '../src/geospatial/loader'
import { SpatialIndex } from '../src/geospatial/spatial-index'

const GEOFENCES_PATH = path.join(__dirname, '../data/geofences.geojson')

describe('Geospatial', () => {
  let index: SpatialIndex

  beforeAll(() => {
    const collection = loadGeofences(GEOFENCES_PATH)
    index = new SpatialIndex()
    index.build(collection)
  })

  describe('loadGeofences', () => {
    it('loads a FeatureCollection', () => {
      const fc = loadGeofences(GEOFENCES_PATH)
      expect(fc.type).toBe('FeatureCollection')
      expect(fc.features.length).toBeGreaterThan(10)
    })

    it('returns empty collection for missing file', () => {
      const fc = loadGeofences('/nonexistent/path.geojson')
      expect(fc.features).toHaveLength(0)
    })
  })

  describe('SpatialIndex', () => {
    it('indexes features by id', () => {
      const gf = index.getById('tel-aviv-yafo')
      expect(gf).toBeDefined()
      expect(gf?.properties?.name).toBe('Tel Aviv - Yafo')
    })

    it('resolves by exact name', () => {
      const gf = index.resolveByName('Tel Aviv - Yafo')
      expect(gf).toBeDefined()
    })

    it('resolves by partial/normalized name', () => {
      const gf = index.resolveByName('sderot')
      expect(gf).toBeDefined()
      expect(gf?.properties?.name).toBe('Sderot')
    })

    it('resolves area with suffix stripping', () => {
      const gf = index.resolveByName('Haifa - Center')
      expect(gf).toBeDefined()
    })

    it('returns undefined for unknown area', () => {
      const gf = index.resolveByName('NonExistentCityXYZ')
      expect(gf).toBeUndefined()
    })

    it('finds geofences containing a point', () => {
      // Tel Aviv center coordinates
      const results = index.findContaining(34.78, 32.08)
      expect(results.length).toBeGreaterThan(0)
    })

    it('returns empty array for point outside Israel', () => {
      const results = index.findContaining(0, 0)
      expect(results).toHaveLength(0)
    })

    it('has expected size', () => {
      expect(index.size).toBeGreaterThan(15)
    })
  })
})
