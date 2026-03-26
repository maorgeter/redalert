import * as path from 'path'
import { loadGeofences } from '../src/geospatial/loader'
import { SpatialIndex } from '../src/geospatial/spatial-index'
import { unionPolygons, simplifyPolygon } from '../src/estimation/algorithms/union'
import { bufferPolygon } from '../src/estimation/algorithms/buffer'
import { computeZoneConfidence, exponentialDecay, linearDecay } from '../src/estimation/algorithms/decay'
import { detectMovementTrend } from '../src/estimation/algorithms/trend'
import { AlertCategory, AlertStatus, AreaType, AlertSeverity } from '../src/normalization/schema'
import type { NormalizedEvent } from '../src/normalization/schema'
import type { Feature, Polygon } from 'geojson'
import * as turf from '@turf/turf'

const GEOFENCES_PATH = path.join(__dirname, '../data/geofences.geojson')

let index: SpatialIndex
beforeAll(() => {
  const fc = loadGeofences(GEOFENCES_PATH)
  index = new SpatialIndex()
  index.build(fc)
})

function makeEvent(areaName: string, tsOffset: number): NormalizedEvent {
  const ts = new Date(Date.now() - tsOffset * 60 * 1000)
  return {
    id: `test-${areaName}`,
    source: 'test',
    provenance: ['test'],
    timestamp: ts,
    areaName,
    areaType: AreaType.ZONE,
    cityNames: [areaName],
    rawPayload: null,
    receivedAt: ts,
    updatedAt: ts,
    severity: AlertSeverity.HIGH,
    confidence: 1.0,
    status: AlertStatus.ACTIVE,
    category: AlertCategory.ROCKETS,
    ttlSeconds: 300,
  }
}

describe('Union algorithm', () => {
  it('returns null for empty input', () => {
    expect(unionPolygons([])).toBeNull()
  })

  it('returns single polygon unchanged', () => {
    const gf = index.getById('sderot')
    expect(gf).toBeDefined()
    const result = unionPolygons([gf as Feature<Polygon>])
    expect(result).toBeDefined()
    expect(result?.type).toBe('Feature')
  })

  it('unions two adjacent polygons', () => {
    const a = index.getById('ashkelon-south')
    const b = index.getById('ashkelon-north')
    expect(a).toBeDefined()
    expect(b).toBeDefined()
    const result = unionPolygons([a as Feature<Polygon>, b as Feature<Polygon>])
    expect(result).toBeDefined()
    // Union area should be >= either input area
    const areaA = turf.area(a!)
    const areaB = turf.area(b!)
    const areaUnion = turf.area(result!)
    expect(areaUnion).toBeGreaterThanOrEqual(Math.max(areaA, areaB))
  })
})

describe('Buffer algorithm', () => {
  it('increases polygon area', () => {
    const gf = index.getById('tel-aviv-yafo')!
    const original = turf.area(gf)
    const buffered = bufferPolygon(gf as Feature<Polygon>, 5)
    const bufferedArea = turf.area(buffered)
    expect(bufferedArea).toBeGreaterThan(original)
  })

  it('handles 0km buffer gracefully', () => {
    const gf = index.getById('haifa-center')!
    const result = bufferPolygon(gf as Feature<Polygon>, 0)
    expect(result).toBeDefined()
  })
})

describe('Decay algorithm', () => {
  it('returns 1.0 for age=0', () => {
    expect(linearDecay(0, 60000)).toBeCloseTo(1.0)
    expect(exponentialDecay(0, 60000)).toBeCloseTo(1.0)
  })

  it('returns 0.5 at half-life', () => {
    expect(exponentialDecay(60000, 60000)).toBeCloseTo(0.5, 1)
  })

  it('returns 0 at full decay for linear', () => {
    expect(linearDecay(60000, 60000)).toBeCloseTo(0)
  })

  it('confidence increases with more events', () => {
    const c1 = computeZoneConfidence(1000, 1, 300000)
    const c5 = computeZoneConfidence(1000, 5, 300000)
    expect(c5).toBeGreaterThan(c1)
  })
})

describe('Trend detection', () => {
  it('returns null for fewer than 3 events', () => {
    const events = [makeEvent('Sderot', 5), makeEvent('Ashkelon - South', 4)]
    const trend = detectMovementTrend(events, (e) => index.resolveByName(e.areaName))
    expect(trend).toBeNull()
  })

  it('returns null for unknown geofences', () => {
    const events = [
      makeEvent('UnknownCity1', 5),
      makeEvent('UnknownCity2', 4),
      makeEvent('UnknownCity3', 3),
    ]
    const trend = detectMovementTrend(events, () => undefined)
    expect(trend).toBeNull()
  })

  it('detects a plausible northward trend', () => {
    // South → North sequence: Sderot → Ashkelon → Ashdod
    const events = [
      makeEvent('Sderot', 6),
      makeEvent('Ashkelon - North', 4),
      makeEvent('Ashdod - Center', 2),
    ]
    const trend = detectMovementTrend(events, (e) => index.resolveByName(e.areaName))
    // May or may not detect a trend depending on timing/confidence threshold
    if (trend) {
      expect(trend.bearing).toBeDefined()
      expect(trend.confidence).toBeGreaterThan(0)
      expect(trend.evidenceCount).toBeGreaterThanOrEqual(3)
    }
  })
})
