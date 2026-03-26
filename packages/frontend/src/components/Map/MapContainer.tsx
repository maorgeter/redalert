'use client'
import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useAlertStore } from '@/store/alertStore'
import { useMapStore } from '@/store/mapStore'
import { AlertStatus, AlertType, AlertCategory, SEVERITY_HE, CATEGORY_HE, ALERT_TYPE_HE } from '@/types'
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
const RIPPLE_MAX_KM = 13           // sonar ring max radius in km
const RIPPLE_RINGS = 3              // concurrent rings per node
const SONAR_PERIOD_MS = 2400        // full ring cycle duration
const FADE_OUT_MS = 2800            // expired-zone fade duration
const FLASH_MS = 1400               // new-alert flash boost
const DASH_STEP_INTERVAL_MS = 55    // ms between marching ants steps
const CAT13_SHOW_MS  = 10000        // ms to show category-13 node before fading
const CAT13_FADE_MS  = 2000         // category-13 fade-out duration

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
  // Prefer Hebrew city name stored on the feature; fall back to raw areaName
  const displayName = props.city_he || props.areaName || ''

  return `
    <div class="map-popup">
      <div class="popup-header">
        <div class="popup-area-name">${displayName}</div>
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
interface ClearingNode { id: string; center: [number, number]; cityHe: string; startTime: number }

const ALL_CLEAR_VISIBLE_MS  = 10_000  // total display window for ALL_CLEAR nodes
const ALL_CLEAR_FADE_START_MS = 7_000 // begin fade after this many ms

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
  const clearingNodesRef   = useRef<ClearingNode[]>([])
  const clearingTrackedRef = useRef(new Set<string>()) // ids already managed in clearingNodesRef
  const flashTimeRef       = useRef<number | null>(null)
  const fadingStartRef     = useRef<number | null>(null)
  const hebrewDebounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeNodesRef     = useRef<[number, number][]>([]) // centers of active threat nodes for sonar

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
    // Debounced 150 ms — 'styledata' can fire dozens of times per second during
    // tile loads; coalescing avoids redundant setLayoutProperty calls.
    map.current.on('styledata', () => {
      const m = map.current
      if (!m || !m.isStyleLoaded()) return
      if (hebrewDebounceRef.current) clearTimeout(hebrewDebounceRef.current)
      hebrewDebounceRef.current = setTimeout(() => {
        hebrewDebounceRef.current = null
        if (map.current?.isStyleLoaded()) applyHebrewLabels(map.current)
      }, 150)
    })

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (hebrewDebounceRef.current) clearTimeout(hebrewDebounceRef.current)
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
      ['alert-labels',         layerVisibility.activeAlerts],
      ['alert-node-core',      layerVisibility.activeAlerts],
      ['ripple-line',          layerVisibility.activeAlerts],
      ['clearing-glow',        layerVisibility.activeAlerts],
      ['clearing-core',        layerVisibility.activeAlerts],
      ['clearing-labels',      layerVisibility.activeAlerts],
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
    m.addSource('alert-edges',     { type: 'geojson', data: empty })
    m.addSource('ripples',         { type: 'geojson', data: empty })
    m.addSource('clearing-nodes',  { type: 'geojson', data: empty })
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

    // Data-driven colors by alertType (used for border and glow)
    const alertBorderColor: maplibregl.ExpressionSpecification = [
      'match', ['get', 'alertType'],
      'red_alert', COLORS.redAlertBorder,
      'warning',   COLORS.warningBorder,
      'all_clear', COLORS.allClearBorder,
      COLORS.redAlertBorder,
    ]
    const glowColor: maplibregl.ExpressionSpecification = [
      'match', ['get', 'alertType'],
      'red_alert', COLORS.redAlert,
      'warning',   COLORS.warning,
      'all_clear', COLORS.allClear,
      COLORS.redAlert,
    ]
    const haloColor: maplibregl.ExpressionSpecification = [
      'match', ['get', 'alertType'],
      'red_alert', '#7f1d1d',
      'warning',   '#431407',
      'all_clear', '#14532d',
      '#7f1d1d',
    ]

    // ── Node layers ──────────────────────────────────────────────────────────
    // Large outer glow (pulsing radius/opacity in RAF)
    m.addLayer({ id: 'active-alerts-glow', type: 'circle', source: 'heatmap-points',
      paint: {
        'circle-color': glowColor,
        'circle-radius': 90,
        'circle-blur': 1.4,
        'circle-opacity': 0.15,
        'circle-pitch-alignment': 'map',
      } })

    // Hebrew city name + alert title label at centroid, positioned above the node
    m.addLayer({
      id: 'alert-labels',
      type: 'symbol',
      source: 'heatmap-points',
      layout: {
        'text-field': [
          'case',
          ['all', ['has', 'title_he'], ['!=', ['get', 'title_he'], '']],
          ['concat', ['coalesce', ['get', 'city_he'], ''], ' - ', ['get', 'title_he']],
          ['coalesce', ['get', 'city_he'], ['get', 'city_name'], ''],
        ],
        'text-font': HEBREW_FONT_STACK,
        'text-size': 15,
        'text-anchor': 'bottom',
        'text-offset': [0, -1.4],
        'text-allow-overlap': true,
        'text-ignore-placement': true,
        'text-padding': 0,
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#000000',
        'text-halo-width': 3,
        'text-halo-blur': 0,
        'text-opacity': 1,
      },
    })

    // Small bright core circle — the "node" centre in the embedding aesthetic
    m.addLayer({ id: 'alert-node-core', type: 'circle', source: 'heatmap-points',
      paint: {
        'circle-color': '#ffffff',
        'circle-radius': 5,
        'circle-blur': 0,
        'circle-opacity': 0.95,
        'circle-stroke-color': glowColor,
        'circle-stroke-width': 2.5,
        'circle-stroke-opacity': 1,
        'circle-pitch-alignment': 'map',
      } })

    // ── ALL_CLEAR clearing nodes (green, fade out over 10 s) ─────────────────
    // Outer glow for clearing nodes
    m.addLayer({ id: 'clearing-glow', type: 'circle', source: 'clearing-nodes',
      paint: {
        'circle-color': COLORS.allClear,
        'circle-radius': 90,
        'circle-blur': 1.4,
        'circle-opacity': ['*', ['coalesce', ['get', 'opacity'], 1], 0.22],
        'circle-pitch-alignment': 'map',
      } })

    // Bright core for clearing nodes
    m.addLayer({ id: 'clearing-core', type: 'circle', source: 'clearing-nodes',
      paint: {
        'circle-color': '#ffffff',
        'circle-radius': 5,
        'circle-blur': 0,
        'circle-opacity': ['coalesce', ['get', 'opacity'], 0.95],
        'circle-stroke-color': COLORS.allClear,
        'circle-stroke-width': 2.5,
        'circle-stroke-opacity': ['coalesce', ['get', 'opacity'], 1],
        'circle-pitch-alignment': 'map',
      } })

    // 'יציאה מהמקלט' label for clearing nodes
    m.addLayer({
      id: 'clearing-labels',
      type: 'symbol',
      source: 'clearing-nodes',
      layout: {
        'text-field': 'יציאה מהמקלט',
        'text-font': HEBREW_FONT_STACK,
        'text-size': 15,
        'text-anchor': 'bottom',
        'text-offset': [0, -1.4],
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#000000',
        'text-halo-width': 3,
        'text-halo-blur': 0,
        'text-opacity': ['coalesce', ['get', 'opacity'], 1],
      },
    })

    // Ripple rings (line only for clean look)
    m.addLayer({ id: 'ripple-line', type: 'line', source: 'ripples',
      paint: {
        'line-color': ['coalesce', ['get', 'color'], COLORS.ripple],
        'line-width': 2,
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

      // Active alert pulse — all node layers breathe together
      if (m.getLayer('active-alerts-glow'))
        m.setPaintProperty('active-alerts-glow', 'circle-opacity',
          Math.min(0.55, 0.15 + 0.10 * sin + flashBoost * 0.40))
      if (m.getLayer('alert-labels'))
        m.setPaintProperty('alert-labels', 'text-opacity',
          Math.min(1.0, 0.78 + 0.22 * Math.abs(sin) + flashBoost * 0.22))
      if (m.getLayer('alert-node-core'))
        m.setPaintProperty('alert-node-core', 'circle-opacity',
          Math.min(1.0, 0.85 + 0.15 * Math.abs(sin) + flashBoost * 0.15))

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

      // ── Continuous sonar rings ────────────────────────────────────────────
      // Red rings emanate continuously from active threat nodes;
      // green rings emanate from category-13 clearing nodes (fade-matched).
      {
        const sonarFeatures: GeoJSON.Feature[] = []
        const ringStep = SONAR_PERIOD_MS / RIPPLE_RINGS

        for (const center of activeNodesRef.current) {
          for (let ring = 0; ring < RIPPLE_RINGS; ring++) {
            const phase = (now + ring * ringStep) % SONAR_PERIOD_MS
            const progress = phase / SONAR_PERIOD_MS
            const radius = progress * RIPPLE_MAX_KM
            const opacity = Math.max(0, (1 - progress) ** 1.5 * 0.65)
            if (radius < 0.3 || opacity < 0.01) continue
            const circle = makeCirclePolygon(center, radius, 36)
            circle.properties = { opacity, color: COLORS.ripple }
            sonarFeatures.push(circle)
          }
        }

        for (const node of clearingNodesRef.current) {
          const elapsed = now - node.startTime
          const t = elapsed - ALL_CLEAR_FADE_START_MS
          const nodeFade = t <= 0 ? 1 : Math.max(0, 1 - t / (ALL_CLEAR_VISIBLE_MS - ALL_CLEAR_FADE_START_MS))
          for (let ring = 0; ring < RIPPLE_RINGS; ring++) {
            const phase = (now + ring * ringStep) % SONAR_PERIOD_MS
            const progress = phase / SONAR_PERIOD_MS
            const radius = progress * RIPPLE_MAX_KM
            const opacity = Math.max(0, (1 - progress) ** 1.5 * 0.60 * nodeFade)
            if (radius < 0.3 || opacity < 0.01) continue
            const circle = makeCirclePolygon(node.center, radius, 36)
            circle.properties = { opacity, color: COLORS.allClear }
            sonarFeatures.push(circle)
          }
        }

        ;(m.getSource('ripples') as maplibregl.GeoJSONSource | undefined)
          ?.setData({ type: 'FeatureCollection', features: sonarFeatures })
      }

      // ── Category-13 clearing nodes — green, fade out after 10 s ──────────
      if (clearingNodesRef.current.length > 0) {
        const clearFeatures: GeoJSON.Feature[] = []
        const aliveClearing: ClearingNode[] = []

        for (const node of clearingNodesRef.current) {
          const elapsed = now - node.startTime
          if (elapsed >= ALL_CLEAR_VISIBLE_MS) {
            clearingTrackedRef.current.delete(node.id)
            continue
          }
          aliveClearing.push(node)
          const t = elapsed - ALL_CLEAR_FADE_START_MS
          const opacity = t <= 0
            ? 1.0
            : Math.max(0, 1.0 - t / (ALL_CLEAR_VISIBLE_MS - ALL_CLEAR_FADE_START_MS))
          clearFeatures.push({
            type: 'Feature',
            properties: { opacity, id: node.id },
            geometry: { type: 'Point', coordinates: node.center },
          })
        }

        clearingNodesRef.current = aliveClearing
        ;(m.getSource('clearing-nodes') as maplibregl.GeoJSONSource | undefined)
          ?.setData({ type: 'FeatureCollection', features: clearFeatures })
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
      // Flash only for non-ALL_CLEAR events (actual threats)
      const hasThreat = newIds.some(id => {
        const ev = allEvents.find(e => e.id === id)
        return ev && ev.category !== AlertCategory.EVENT_ENDED && ev.alertType !== AlertType.ALL_CLEAR
      })
      if (hasThreat) flashTimeRef.current = Date.now()

      for (const id of newIds) {
        const ev = allEvents.find(e => e.id === id)
        if (!ev) continue
        const isClearEvent = ev.category === AlertCategory.EVENT_ENDED || ev.alertType === AlertType.ALL_CLEAR
        if (!isClearEvent) continue // continuous sonar handles threat nodes automatically
        const feat = findGeofenceFeature(gf, ev.areaName, ev.geofenceId)
        if (!feat) continue
        const center = polygonCentroid(feat as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>)
        if (!center) continue

        // Category-13 / all-clear: add to clearing nodes for green fade-out
        if (!clearingTrackedRef.current.has(id)) {
          const fProps = feat.properties as Record<string, string> | null
          clearingNodesRef.current.push({
            id,
            center,
            cityHe: fProps?.nameHe ?? ev.areaName,
            startTime: Date.now(),
          })
          clearingTrackedRef.current.add(id)
        }
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
    if (!m || !gf) {
      console.warn('[MapContainer] updateAlertSources: skipping — map ready:', !!m, 'geofences loaded:', !!gf)
      return
    }

    const activeEvents = eventsRef.current.filter(e => e.status === AlertStatus.ACTIVE)
    console.log('[MapContainer] updateAlertSources: active events:', activeEvents.length)

    const activeFeatures: GeoJSON.Feature[] = []
    const heatmapPoints: GeoJSON.Feature[] = []

    for (const event of activeEvents) {
      // Category-13 and all_clear events are handled by clearingNodesRef (green fade-out)
      if (event.category === AlertCategory.EVENT_ENDED || event.alertType === AlertType.ALL_CLEAR) continue

      const feat = findGeofenceFeature(gf, event.areaName, event.geofenceId)
      if (!feat) {
        console.warn('[MapContainer] no geofence match for:', event.areaName, '| geofenceId:', event.geofenceId)
        continue
      }

      const fProps = feat.properties as Record<string, string> | null
      activeFeatures.push({
        ...feat,
        properties: {
          ...feat.properties,
          eventId: event.id,
          areaName: event.areaName,
          city_he: fProps?.nameHe ?? event.areaName,
          severity: event.severity,
          category: event.category,
          alertType: event.alertType ?? AlertType.RED_ALERT,
          status: event.status,
          sourceCount: event.provenance?.length ?? 1,
        },
      } as GeoJSON.Feature)

      const center = polygonCentroid(feat as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>)
      if (center) {
        const props = feat.properties as Record<string, string> | null
        heatmapPoints.push({
          type: 'Feature',
          properties: {
            weight:    Math.min(1, (event.provenance?.length ?? 1) * 0.5) || 0.5,
            city_he:   props?.nameHe   ?? event.areaName,
            city_name: props?.name     ?? event.areaName,
            title_he:  event.title     ?? '',
            alertType: event.alertType ?? AlertType.RED_ALERT,
          },
          geometry: { type: 'Point', coordinates: center },
        })
      }
    }

    // Update active node centers for continuous sonar (excludes cat-13/all-clear)
    activeNodesRef.current = heatmapPoints.map(
      f => (f.geometry as GeoJSON.Point).coordinates as [number, number]
    )

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
          confidence: z.confidence ?? 0,
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

    // Active alert hover / click — on the polygon border and on the label node
    const showAlertPopup = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      m.getCanvas().style.cursor = 'pointer'
      const p = e.features?.[0]?.properties as Record<string, string> | undefined
      if (p && popup.current) {
        popup.current.setLngLat(e.lngLat)
          .setHTML(alertPopupHtml({ ...p, alertType: p.alertType ?? 'red_alert' }))
          .addTo(m)
      }
    }
    const hideAlertPopup = () => {
      m.getCanvas().style.cursor = ''
      popup.current?.remove()
    }
    const clickAlert = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      const p = e.features?.[0]?.properties
      if (p?.eventId) { selectGeofence(p.eventId); setInspectorOpen(true) }
    }

    // Respond to clicks on the node core
    m.on('mouseenter', 'alert-node-core', showAlertPopup)
    m.on('mouseleave', 'alert-node-core', hideAlertPopup)
    m.on('click',      'alert-node-core', clickAlert)

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
