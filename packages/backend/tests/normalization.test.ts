import { Normalizer } from '../src/normalization/normalizer'
import {
  AlertCategory,
  AlertSeverity,
  AlertStatus,
  AreaType,
} from '../src/normalization/schema'

describe('Normalizer', () => {
  const norm = new Normalizer()

  describe('normalizeMock', () => {
    it('sets correct defaults for a mock alert', () => {
      const result = norm.normalizeMock({ areaName: 'Tel Aviv', category: AlertCategory.ROCKETS })
      expect(result.source).toBe('mock')
      expect(result.status).toBe(AlertStatus.ACTIVE)
      expect(result.areaType).toBe(AreaType.ZONE)
      expect(result.severity).toBe(AlertSeverity.HIGH)
      expect(result.confidence).toBeCloseTo(0.9)
      expect(result.cityNames).toContain('Tel Aviv')
    })

    it('preserves provided id', () => {
      const result = norm.normalizeMock({ id: 'test-123', areaName: 'X', category: AlertCategory.ROCKETS })
      expect(result.id).toBe('test-123')
    })

    it('assigns CRITICAL severity for missile alerts', () => {
      const result = norm.normalizeMock({ areaName: 'Haifa', category: AlertCategory.MISSILE })
      expect(result.severity).toBe(AlertSeverity.CRITICAL)
    })

    it('generates a UUID if id not provided', () => {
      const result = norm.normalizeMock({ areaName: 'X', category: AlertCategory.ROCKETS })
      expect(result.id).toMatch(/^[0-9a-f-]{36}$/)
    })
  })

  describe('normalizeOref', () => {
    const raw = {
      id: '133136285040000000',
      cat: '1',
      title: 'ירי רקטות וטילים',
      data: ['אשדוד - דרום'],
      desc: 'היכנסו למרחב המוגן',
    }

    it('maps cat=1 to ROCKETS category', () => {
      const result = norm.normalizeOref(raw)
      expect(result.category).toBe(AlertCategory.ROCKETS)
      expect(result.source).toBe('oref')
    })

    it('uses provided id', () => {
      const result = norm.normalizeOref(raw)
      expect(result.id).toBe(raw.id)
    })
  })

  describe('normalizeOrefMultiArea', () => {
    const raw = {
      id: 'multi-001',
      cat: '1',
      title: 'ירי רקטות',
      data: ['אשדוד', 'אשקלון', 'שדרות'],
      desc: '',
    }

    it('splits into one event per area', () => {
      const results = norm.normalizeOrefMultiArea(raw)
      expect(results).toHaveLength(3)
      expect(results[0].areaName).toBe('אשדוד')
      expect(results[1].areaName).toBe('אשקלון')
      expect(results[2].areaName).toBe('שדרות')
    })

    it('creates unique ids for multi-area alerts', () => {
      const results = norm.normalizeOrefMultiArea(raw)
      const ids = results.map((r) => r.id)
      const unique = new Set(ids)
      expect(unique.size).toBe(3)
    })
  })

  describe('expire', () => {
    it('sets status to EXPIRED', () => {
      const event = norm.normalizeMock({ areaName: 'X', category: AlertCategory.ROCKETS })
      const expired = norm.expire(event)
      expect(expired.status).toBe(AlertStatus.EXPIRED)
      expect(expired.id).toBe(event.id)
    })
  })

  describe('escalateSeverity', () => {
    it('does not escalate when nearbyCount < 3', () => {
      const event = norm.normalizeMock({ areaName: 'X', category: AlertCategory.ROCKETS })
      const result = norm.escalateSeverity(event, 2)
      expect(result.severity).toBe(event.severity)
    })

    it('escalates from HIGH to CRITICAL when nearbyCount >= 3', () => {
      const event = norm.normalizeMock({ areaName: 'X', category: AlertCategory.ROCKETS })
      expect(event.severity).toBe(AlertSeverity.HIGH)
      const result = norm.escalateSeverity(event, 5)
      expect(result.severity).toBe(AlertSeverity.CRITICAL)
    })
  })
})
