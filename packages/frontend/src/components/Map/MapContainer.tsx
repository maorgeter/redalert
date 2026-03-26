'use client'
import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useAlertStore } from '@/store/alertStore'
import { useMapStore } from '@/store/mapStore'
import { AlertStatus, AlertType, SEVERITY_HE, CATEGORY_HE, ALERT_TYPE_HE } from '@/types'
import type { AlertEvent } from '@/types'

// ─── RTL text plugin ─────────────────────────────────────────────────────────
// Must be registered once, before any Map is instantiated.
// Without this, MapLibre renders Hebrew/Arabic characters in LTR order (reversed).
// The plugin uses a WASM bidirectional text shaper (ICU-based).
// typeof window guard: Next.js evaluates 'use client' modules on the server too.
if (typeof window !== 'undefined') {
  // Served from public/ — no network dependency, no CDN 404 risk.
  // File: @mapbox/mapbox-gl-rtl-text@0.2.3 (the build MapLibre 4.x expects).
  maplibregl.setRTLTextPlugin(
    '/maplibre-gl-rtl-text.min.js',
    false  // not lazy — load immediately so Hebrew renders on first tile
  ).catch(() => { /* already loaded, or non-critical */ })
}

// ─── Map style ───────────────────────────────────────────────────────────────
// OpenFreeMap liberty: free, vector tiles, ships Noto Sans Regular SDF glyphs
// which cover the Hebrew Unicode block — no API key required.
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

const ISRAEL_CENTER: [number, number] = [34.85, 31.5]
const ISRAEL_ZOOM = 7.5

// ─── Animation constants ─────────────────────────────────────────────────────
const RIPPLE_DURATION_MS = 2200
const RIPPLE_MAX_KM = 55
const RIPPLE_RINGS = 2
const RIPPLE_RING_OFFSET_MS = 600
const FADE_OUT_MS = 2800
const FLASH_MS = 1400
const DASH_STEP_INTERVAL_MS = 55 // ms between marching ants steps

// Marching ants sequence for estimated zone borders (MapLibre technique)
const MARCH_SEQ = [
  [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5],
  [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0],
  [0, 3, 4], [0.5, 3, 3.5], [1, 3, 3], [1.5, 3, 2.5],
  [2, 3, 2], [2.5, 3, 1.5], [3, 3, 1], [3.5, 3, 0.5], [4, 3, 0],
]

const COLORS = {
  // Alert type colours
  redAlert:          '#dc2626',
  redAlertBorder:    '#991b1b',
  warning:           '#ea580c',
  warningBorder:     '#c2410c',
  allClear:          '#16a34a',
  allClearBorder:    '#15803d',
  // Estimation
  estimatedZone:     '#f59e0b',
  estimatedBorder:   '#b45309',
  uncertainty:       '#fcd34d',
  expired:           '#94a3b8',
  geofenceLine:      '#c8d3dd',
  ripple:            '#ef4444',
  // Legacy alias kept for compatibility
  activeAlert:       '#dc2626',
  activeAlertBorder: '#991b1b',
}

// ─── Geometry helpers (no turf dependency) ───────────────────────────────────

function makeCirclePolygon(
  center: [number, number],
  radiusKm: number,
  steps = 40
): GeoJSON.Feature<GeoJSON.Polygon> {
  const R = 6371
  const coords: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI
    const lat1 = (center[1] * Math.PI) / 180
    const d = radiusKm / R
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(a))
    const lng2 =
      (center[0] * Math.PI) / 180 +
      Math.atan2(Math.sin(a) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2))
    coords.push([(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI])
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coords] } }
}

function polygonCentroid(
  feature: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>
): [number, number] | null {
  try {
    const ring =
      feature.geometry.type === 'Polygon'
        ? feature.geometry.coordinates[0]
        : feature.geometry.coordinates[0]?.[0]
    if (!ring?.length) return null
    let sx = 0, sy = 0
    for (const c of ring) { sx += c[0]; sy += c[1] }
    return [sx / ring.length, sy / ring.length]
  } catch { return null }
}

// ─── Hebrew label override ───────────────────────────────────────────────────
// OpenFreeMap liberty ships a single glyph set named 'Noto Sans Regular' which
// already contains the Hebrew Unicode block — 'Noto Sans Hebrew Regular' is NOT
// a separate entry on their glyph server and will cause a 404/fallback.
// The RTL plugin handles the bidi reordering; the font just needs the glyphs.
const HEBREW_FONT_STACK = ['Noto Sans Regular']

function applyHebrewLabels(m: maplibregl.Map): void {
  let updated = 0
  try {
    for (const layer of m.getStyle()?.layers ?? []) {
      if (layer.type !== 'symbol') continue
      try {
        // Read from the style spec directly — more reliable than getLayoutProperty()
        const layout = (layer as maplibregl.SymbolLayerSpecification).layout ?? {}
        if (!('text-field' in layout)) continue

        // Prefer Hebrew name; fall back to the tile's generic name field
        m.setLayoutProperty(layer.id, 'text-field', [
          'coalesce', ['get', 'name:he'], ['get', 'name'],
        ])
        // Noto Sans Regular on OpenFreeMap includes Hebrew glyphs (U+0590–U+05FF)
        m.setLayoutProperty(layer.id, 'text-font', HEBREW_FONT_STACK)
        updated++
      } catch { /* individual layer errors are non-fatal */ }
    }
  } catch { /* non-critical */ }
  console.log(`[MapContainer] applyHebrewLabels: updated ${updated} symbol layers`)
}

// ─── Popup HTML (direction: rtl set in CSS .map-popup) ───────────────────────

function alertTypeColor(alertType: string): string {
  if (alertType === 'red_alert') return '#dc2626'
  if (alertType === 'all_clear') return '#16a34a'
  return '#ea580c'
}

function alertPopupHtml(props: Record<string, string>): string {
  const sev = props.severity?.toLowerCase() ?? 'medium'
  const alertType = props.alertType ?? 'red_alert'
  const alertTypeLabel = ALERT_TYPE_HE[alertType as AlertType] ?? alertType
  const typeColor = alertTypeColor(alertType)

  return `
    <div class="map-popup">
      <div class="popup-header">
        <div class="popup-area-name">${props.areaName ?? ''}</div>
        <div class="popup-live-badge" style="color:${typeColor}">● ${alertTypeLabel}</div>
      </div>
      <div class="popup-body">
        <div class="popup-row">
          <span class="popup-label">סוג התרעה</span>
          <span class="popup-value" style="color:${typeColor};font-weight:700">${alertTypeLabel}</span>
        </div>
        <div class="popup-row">
          <span class="popup-label">חומרה</span>
          <span class="popup-value severity-${sev}">${SEVERITY_HE[props.severity as keyof typeof SEVERITY_HE] ?? props.severity ?? ''}</span>
        </div>
        <div class="popup-row">
          <span class="popup-label">קטגוריה</span>
          <span class="popup-value">${CATEGORY_HE[props.category as keyof typeof CATEGORY_HE] ?? props.category ?? ''}</span>
        </div>
      </div>
    </div>`
}

function zonePopupHtml(props: Record<string, string | number>): string {
  const conf = typeof props.confidence === 'number' ? (props.confidence * 100).toFixed(0) : '—'
  return `
    <div class="map-popup">
      <div class="popup-header">
        <div class="popup-area-name">${props.affectedAreas ?? 'אזור משוער'}</div>
        <div class="popup-est-badge">הערכה בלבד</div>
      </div>
      <div class="popup-body">
        <div class="popup-row">
          <span class="popup-label">ביטחון</span>
          <span class="popup-value">${conf}%</span>
        </div>
        <div class="popup-row">
          <span class="popup-label">שיטה</span>
          <span class="popup-value">${props.method ?? ''}</span>
        </div>
      </div>
      <div class="popup-disclaimer">⚠ אינו הערכת איום רשמית — ויזואליזציה בלבד</div>
    </div>`
}

// ─── Animation state types ───────────────────────────────────────────────────
interface Ripple { id: string; center: [number, number]; startTime: number }

// ─── Component ───────────────────────────────────────────────────────────────
export default function MapContainer() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const popup = useRef<maplibregl.Popup | null>(null)

  // Animation state
  const pulsePhaseRef      = useRef(0)
  const dashStepRef        = useRef(0)
  const lastDashTimeRef    = useRef(0)
  const animFrameRef       = useRef<number | null>(null)
  const ripplesRef         = useRef<Ripple[]>([])
  const rippleClearRef     = useRef(false) // flag: clear ripple source next frame
  const flashTimeRef       = useRef<number | null>(null)
  const fadingStartRef     = useRef<number | null>(null)

  // Keep current store values accessible inside RAF without stale closures
  const geofencesRef = useRef(useAlertStore.getState().geofences)
  const eventsRef    = useRef(useAlertStore.getState().events)
  const prevActiveRef = useRef(new Set<string>()) // IDs of previously active events

  const { geofences, events, estimatedZones } = useAlertStore()
  const { selectGeofence, selectZone, setInspectorOpen, layerVisibility } = useMapStore()

  // Keep refs in sync
  useEffect(() => { geofencesRef.current = geofences }, [geofences])
  useEffect(() => { eventsRef.current = events }, [events])

  // ── Initialize map ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || map.current) return

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center: ISRAEL_CENTER,
      zoom: ISRAEL_ZOOM,
      maxBounds: [[33.0, 28.5], [37.5, 34.5]],
      fadeDuration: 250,
    })

    map.current.addControl(
      new maplibregl.NavigationControl({ showCompass: false }), 'top-left'
    )
    map.current.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')

    popup.current = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: false,
      maxWidth: '300px',
    })

    map.current.on('load', () => {
      applyHebrewLabels(map.current!)
      initSources()
      initLayers()
      setupInteractions()
      startAnimLoop()
    })

    // Re-apply Hebrew labels whenever the style is updated (tile loads, style swap).
    // 'styledata' fires for every style change; the isStyleLoaded() guard prevents
    // running before layers exist, and the inner try/catch makes each layer safe.
    map.current.on('styledata', () => {
      const m = map.current
      if (!m || !m.isStyleLoaded()) return
      applyHebrewLabels(m)
    })

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      map.current?.remove()
      map.current = null
    }
  }, []) // eslint-disable-line

  // ── Data effects ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const m = map.current
    if (!m || !m.isStyleLoaded()) return
    updateGeofencesSource()
  }, [geofences]) // eslint-disable-line

  useEffect(() => {
    const m = map.current
    if (!m || !m.isStyleLoaded()) return
    detectAndAnimateChanges()
    updateAlertSources()
  }, [events]) // eslint-disable-line

  useEffect(() => {
    const m = map.current
    if (!m || !m.isStyleLoaded()) return
    updateZonesSources()
  }, [estimatedZones]) // eslint-disable-line

  useEffect(() => {
    const m = map.current
    if (!m || !m.isStyleLoaded()) return
    const vis = (v: boolean) => (v ? 'visible' : 'none')
    const pairs: [string, boolean][] = [
      ['geofences-fill',       layerVisibility.geofences],
      ['geofences-line',       layerVisibility.geofences],
      ['active-alerts-glow',   layerVisibility.activeAlerts],
      ['active-alerts-fill',   layerVisibility.activeAlerts],
      ['active-alerts-line',   layerVisibility.activeAlerts],
      ['fading-fill',          layerVisibility.activeAlerts],
      ['heatmap-layer',        layerVisibility.activeAlerts],
      ['estimated-zones-fill', layerVisibility.estimatedZones],
      ['estimated-zones-line', layerVisibility.estimatedZones],
      ['uncertainty-fill',     layerVisibility.uncertainty],
    ]
    pairs.forEach(([id, v]) => { if (m.getLayer(id)) m.setLayoutProperty(id, 'visibility', vis(v)) })
  }, [layerVisibility]) // eslint-disable-line

  // ── Source initialisation ─────────────────────────────────────────────────
  const initSources = () => {
    const m = map.current!
    const empty: GeoJSON.GeoJSON = { type: 'FeatureCollection', features: [] }
    m.addSource('geofences',       { type: 'geojson', data: empty })
    m.addSource('active-alerts',   { type: 'geojson', data: empty })
    m.addSource('fading-alerts',   { type: 'geojson', data: empty })
    m.addSource('estimated-zones', { type: 'geojson', data: empty })
    m.addSource('uncertainty-zones', { type: 'geojson', data: empty })
    m.addSource('heatmap-points',  { type: 'geojson', data: empty })
    m.addSource('ripples',         { type: 'geojson', data: empty })
  }

  // ── Layer initialisation ──────────────────────────────────────────────────
  const initLayers = () => {
    const m = map.current!

    // Geofence outlines
    m.addLayer({ id: 'geofences-fill', type: 'fill', source: 'geofences',
      paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.02 } })
    m.addLayer({ id: 'geofences-line', type: 'line', source: 'geofences',
      paint: { 'line-color': COLORS.geofenceLine, 'line-width': 0.6, 'line-opacity': 0.5 } })

    // Fading (recently expired) zones
    m.addLayer({ id: 'fading-fill', type: 'fill', source: 'fading-alerts',
      paint: { 'fill-color': COLORS.expired, 'fill-opacity': 0 } })

    // Uncertainty envelope
    m.addLayer({ id: 'uncertainty-fill', type: 'fill', source: 'uncertainty-zones',
      paint: { 'fill-color': COLORS.uncertainty, 'fill-opacity': 0.07 } })

    // Estimated zone fill (pulsing)
    m.addLayer({ id: 'estimated-zones-fill', type: 'fill', source: 'estimated-zones',
      paint: { 'fill-color': COLORS.estimatedZone, 'fill-opacity': 0.16 } })

    // Estimated zone animated border (marching ants)
    m.addLayer({ id: 'estimated-zones-line', type: 'line', source: 'estimated-zones',
      paint: {
        'line-color': COLORS.estimatedBorder, 'line-width': 2.5,
        'line-dasharray': [4, 3], 'line-opacity': 0.9,
      } })

    // Heatmap for overlapping alerts
    m.addLayer({ id: 'heatmap-layer', type: 'heatmap', source: 'heatmap-points',
      paint: {
        'heatmap-weight': 1,
        'heatmap-intensity': 0.6,
        'heatmap-radius': 45,
        'heatmap-opacity': 0.22,
        'heatmap-color': [
          'interpolate', ['linear'], ['heatmap-density'],
          0,   'rgba(220,38,38,0)',
          0.3, 'rgba(239,68,68,0.3)',
          0.7, 'rgba(220,38,38,0.5)',
          1,   'rgba(185,28,28,0.7)',
        ],
      } })

    // Data-driven fill color by alertType
    const alertFillColor: maplibregl.ExpressionSpecification = [
      'match', ['get', 'alertType'],
      'red_alert', COLORS.redAlert,
      'warning',   COLORS.warning,
      'all_clear', COLORS.allClear,
      COLORS.redAlert,
    ]
    const alertBorderColor: maplibregl.ExpressionSpecification = [
      'match', ['get', 'alertType'],
      'red_alert', COLORS.redAlertBorder,
      'warning',   COLORS.warningBorder,
      'all_clear', COLORS.allClearBorder,
      COLORS.redAlertBorder,
    ]

    // Active alert soft glow — wide, semi-transparent fill; opacity pulsed by RAF loop.
    // fill-blur is NOT a valid MapLibre paint property (removed to fix console error).
    m.addLayer({ id: 'active-alerts-glow', type: 'fill', source: 'active-alerts',
      paint: {
        'fill-color': alertFillColor,
        'fill-opacity': 0.08,
      } })

    // Active alert main fill (pulsing opacity via animation loop)
    m.addLayer({ id: 'active-alerts-fill', type: 'fill', source: 'active-alerts',
      paint: { 'fill-color': alertFillColor, 'fill-opacity': 0.38 } })

    // Active alert border
    m.addLayer({ id: 'active-alerts-line', type: 'line', source: 'active-alerts',
      paint: { 'line-color': alertBorderColor, 'line-width': 2.5, 'line-opacity': 0.95 } })

    // Ripple rings (line only for clean look)
    m.addLayer({ id: 'ripple-line', type: 'line', source: 'ripples',
      paint: {
        'line-color': COLORS.ripple,
        'line-width': 2.5,
        'line-opacity': ['coalesce', ['get', 'opacity'], 0.1],
      } })
  }

  // ── Animation loop ────────────────────────────────────────────────────────
  const startAnimLoop = () => {
    const animate = () => {
      const m = map.current
      if (!m) return

      const now = Date.now()
      pulsePhaseRef.current = (pulsePhaseRef.current + 0.016) % (2 * Math.PI)
      const sin = Math.sin(pulsePhaseRef.current)

      // Flash boost on new alert
      let flashBoost = 0
      if (flashTimeRef.current !== null) {
        const age = now - flashTimeRef.current
        if (age < FLASH_MS) {
          flashBoost = 0.45 * Math.max(0, 1 - age / FLASH_MS)
        } else {
          flashTimeRef.current = null
        }
      }

      // Active alert pulse
      const base = 0.30 + 0.10 * sin
      if (m.getLayer('active-alerts-fill'))
        m.setPaintProperty('active-alerts-fill', 'fill-opacity', Math.min(0.88, base + flashBoost))
      if (m.getLayer('active-alerts-glow'))
        m.setPaintProperty('active-alerts-glow', 'fill-opacity',
          Math.min(0.35, 0.08 + 0.05 * sin + flashBoost * 0.25))

      // Estimated zone pulse (slightly offset phase for organic feel)
      if (m.getLayer('estimated-zones-fill'))
        m.setPaintProperty('estimated-zones-fill', 'fill-opacity', 0.13 + 0.05 * Math.sin(pulsePhaseRef.current + 1))

      // Marching ants on estimated zones
      if (now - lastDashTimeRef.current > DASH_STEP_INTERVAL_MS) {
        lastDashTimeRef.current = now
        dashStepRef.current = (dashStepRef.current + 1) % MARCH_SEQ.length
        if (m.getLayer('estimated-zones-line'))
          m.setPaintProperty('estimated-zones-line', 'line-dasharray', MARCH_SEQ[dashStepRef.current])
      }

      // Fading expired zones
      if (fadingStartRef.current !== null) {
        const elapsed = now - fadingStartRef.current
        const progress = Math.min(1, elapsed / FADE_OUT_MS)
        const opacity = 0.42 * (1 - progress * progress) // ease-in fade
        if (m.getLayer('fading-fill'))
          m.setPaintProperty('fading-fill', 'fill-opacity', opacity)
        if (progress >= 1) {
          fadingStartRef.current = null
          ;(m.getSource('fading-alerts') as maplibregl.GeoJSONSource | undefined)
            ?.setData({ type: 'FeatureCollection', features: [] })
        }
      }

      // Ripple animation
      if (ripplesRef.current.length > 0) {
        const features: GeoJSON.Feature[] = []
        const alive: Ripple[] = []

        for (const ripple of ripplesRef.current) {
          const elapsed = now - ripple.startTime
          if (elapsed >= RIPPLE_DURATION_MS) continue
          alive.push(ripple)

          for (let ring = 0; ring < RIPPLE_RINGS; ring++) {
            const ringElapsed = elapsed - ring * RIPPLE_RING_OFFSET_MS
            if (ringElapsed <= 0) continue
            const progress = Math.min(1, ringElapsed / RIPPLE_DURATION_MS)
            const eased = 1 - (1 - progress) ** 2 // ease-out
            const radius = eased * RIPPLE_MAX_KM
            const opacity = Math.max(0, 0.7 * (1 - progress) ** 1.5)
            if (radius < 0.5 || opacity < 0.01) continue

            const circle = makeCirclePolygon(ripple.center, radius, 40)
            circle.properties = { opacity, ringId: `${ripple.id}-r${ring}` }
            features.push(circle)
          }
        }

        ripplesRef.current = alive
        ;(m.getSource('ripples') as maplibregl.GeoJSONSource | undefined)
          ?.setData({ type: 'FeatureCollection', features })

        if (alive.length === 0) rippleClearRef.current = true
      } else if (rippleClearRef.current) {
        rippleClearRef.current = false
        ;(m.getSource('ripples') as maplibregl.GeoJSONSource | undefined)
          ?.setData({ type: 'FeatureCollection', features: [] })
      }

      animFrameRef.current = requestAnimationFrame(animate)
    }
    animFrameRef.current = requestAnimationFrame(animate)
  }

  // ── Detect new/expired alerts and trigger animations ────────────────────────
  const detectAndAnimateChanges = () => {
    const m = map.current
    if (!m) return
    const gf = geofencesRef.current
    const allEvents = eventsRef.current

    const currentActive = new Set(
      allEvents.filter(e => e.status === AlertStatus.ACTIVE).map(e => e.id)
    )
    const prev = prevActiveRef.current

    // New active alerts
    const newIds = Array.from(currentActive).filter(id => !prev.has(id))
    if (newIds.length > 0 && gf) {
      flashTimeRef.current = Date.now()

      for (const id of newIds.slice(0, 4)) {
        const ev = allEvents.find(e => e.id === id)
        if (!ev) continue
        const feat = findGeofenceFeature(gf, ev.areaName, ev.geofenceId)
        if (!feat) continue
        const center = polygonCentroid(feat as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>)
        if (!center) continue
        ripplesRef.current.push({ id: `${id}-${Date.now()}`, center, startTime: Date.now() })
      }
    }

    // Newly expired alerts → start fade
    const newlyExpired = allEvents.filter(
      e => e.status === AlertStatus.EXPIRED && prev.has(e.id)
    )
    if (newlyExpired.length > 0 && gf) {
      const fadingFeatures: GeoJSON.Feature[] = []
      for (const ev of newlyExpired) {
        const feat = findGeofenceFeature(gf, ev.areaName, ev.geofenceId)
        if (feat) fadingFeatures.push(feat as GeoJSON.Feature)
      }
      if (fadingFeatures.length > 0) {
        ;(m.getSource('fading-alerts') as maplibregl.GeoJSONSource | undefined)
          ?.setData({ type: 'FeatureCollection', features: fadingFeatures })
        fadingStartRef.current = Date.now()
      }
    }

    prevActiveRef.current = currentActive
  }

  // ── Source update helpers ─────────────────────────────────────────────────
  const updateGeofencesSource = () => {
    const m = map.current
    if (!m || !geofences) return
    ;(m.getSource('geofences') as maplibregl.GeoJSONSource | undefined)?.setData(geofences as GeoJSON.GeoJSON)
  }

  /**
   * Find the best geofence feature for an area name.
   * Uses: exact ID → exact nameHe → exact name → Hebrew prefix match → name prefix.
   */
  const findGeofenceFeature = (
    gf: typeof geofencesRef.current,
    areaName: string,
    geofenceId?: string
  ): GeoJSON.Feature | undefined => {
    if (!gf) return undefined
    const lower = areaName.toLowerCase()
    const areaPrefix = lower.split(/\s*[-–]\s+/)[0].trim()

    return gf.features.find(f => {
      if (geofenceId && f.properties?.id === geofenceId) return true
      const nameHe: string = (f.properties as Record<string, string>)?.nameHe ?? ''
      if (nameHe === areaName) return true
      if ((f.properties?.name ?? '').toLowerCase() === lower) return true
      // Prefix match for "תל אביב - מרכז העיר" → "תל אביב - יפו"
      if (areaPrefix && areaPrefix.length >= 3) {
        const hePrefix = nameHe.split(/\s*[-–]\s+/)[0].trim()
        if (areaPrefix === hePrefix) return true
        const enPrefix = (f.properties?.name ?? '').toLowerCase().split(/\s*[-–]\s+/)[0].trim()
        if (areaPrefix === enPrefix) return true
      }
      return false
    }) as GeoJSON.Feature | undefined
  }

  const updateAlertSources = () => {
    const m = map.current
    const gf = geofencesRef.current
    if (!m || !gf) return

    const activeFeatures: GeoJSON.Feature[] = []
    const heatmapPoints: GeoJSON.Feature[] = []

    for (const event of eventsRef.current.filter(e => e.status === AlertStatus.ACTIVE)) {
      const feat = findGeofenceFeature(gf, event.areaName, event.geofenceId)
      if (!feat) continue

      activeFeatures.push({
        ...feat,
        properties: {
          ...feat.properties,
          eventId: event.id,
          areaName: event.areaName,
          severity: event.severity,
          category: event.category,
          alertType: event.alertType ?? AlertType.RED_ALERT,
          status: event.status,
          sourceCount: event.provenance?.length ?? 1,
        },
      } as GeoJSON.Feature)

      const center = polygonCentroid(feat as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>)
      if (center) {
        heatmapPoints.push({
          type: 'Feature',
          properties: { weight: Math.min(1, (event.provenance?.length ?? 1) * 0.5) },
          geometry: { type: 'Point', coordinates: center },
        })
      }
    }

    ;(m.getSource('active-alerts') as maplibregl.GeoJSONSource | undefined)
      ?.setData({ type: 'FeatureCollection', features: activeFeatures })
    ;(m.getSource('heatmap-points') as maplibregl.GeoJSONSource | undefined)
      ?.setData({ type: 'FeatureCollection', features: heatmapPoints })
  }

  const updateZonesSources = () => {
    const m = map.current
    if (!m) return

    ;(m.getSource('estimated-zones') as maplibregl.GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: estimatedZones.map(z => ({
        ...z.geometry,
        properties: {
          zoneId: z.id,
          confidence: z.confidence,
          affectedAreas: z.affectedAreas.join('، '),
          method: z.explanation.method,
        },
      })),
    })

    ;(m.getSource('uncertainty-zones') as maplibregl.GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: estimatedZones
        .filter(z => z.uncertaintyGeometry)
        .map(z => ({ ...z.uncertaintyGeometry!, properties: { zoneId: z.id } })),
    })
  }

  // ── Map interactions ───────────────────────────────────────────────────────
  const setupInteractions = () => {
    const m = map.current!

    // Active alert hover
    m.on('mouseenter', 'active-alerts-fill', (e) => {
      m.getCanvas().style.cursor = 'pointer'
      const p = e.features?.[0]?.properties as Record<string, string> | undefined
      if (p && popup.current) {
        // Ensure alertType is passed through for popup styling
        const props = { ...p, alertType: p.alertType ?? 'red_alert' }
        popup.current.setLngLat(e.lngLat).setHTML(alertPopupHtml(props)).addTo(m)
      }
    })
    m.on('mouseleave', 'active-alerts-fill', () => {
      m.getCanvas().style.cursor = ''
      popup.current?.remove()
    })
    m.on('click', 'active-alerts-fill', (e) => {
      const p = e.features?.[0]?.properties
      if (p?.eventId) { selectGeofence(p.eventId); setInspectorOpen(true) }
    })

    // Estimated zone hover
    m.on('mouseenter', 'estimated-zones-fill', (e) => {
      m.getCanvas().style.cursor = 'help'
      const p = e.features?.[0]?.properties
      if (p && popup.current) {
        popup.current.setLngLat(e.lngLat).setHTML(zonePopupHtml(p as Record<string,string|number>)).addTo(m)
      }
    })
    m.on('mouseleave', 'estimated-zones-fill', () => {
      m.getCanvas().style.cursor = ''
      popup.current?.remove()
    })
    m.on('click', 'estimated-zones-fill', (e) => {
      const p = e.features?.[0]?.properties
      if (p?.zoneId) { selectZone(p.zoneId); setInspectorOpen(true) }
    })
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  )
}
