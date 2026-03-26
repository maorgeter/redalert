import { create } from 'zustand'

export type MapLayer = 'geofences' | 'activeAlerts' | 'estimatedZones' | 'uncertainty'

interface MapStore {
  // Selected feature for debug inspector
  selectedGeofenceId: string | null
  selectedZoneId: string | null
  inspectorOpen: boolean

  // Layer visibility
  layerVisibility: Record<MapLayer, boolean>

  // Map view state
  center: [number, number]
  zoom: number

  // Pulse animation tick (0–1, cycles for pulse effect)
  pulseTick: number

  // Actions
  selectGeofence: (id: string | null) => void
  selectZone: (id: string | null) => void
  setInspectorOpen: (open: boolean) => void
  toggleLayer: (layer: MapLayer) => void
  setCenter: (center: [number, number]) => void
  setZoom: (zoom: number) => void
  setPulseTick: (tick: number) => void
}

export const useMapStore = create<MapStore>((set) => ({
  selectedGeofenceId: null,
  selectedZoneId: null,
  inspectorOpen: false,

  layerVisibility: {
    geofences: true,
    activeAlerts: true,
    estimatedZones: true,
    uncertainty: true,
  },

  center: [34.85, 31.5], // Israel center
  zoom: 7.5,
  pulseTick: 0,

  selectGeofence: (selectedGeofenceId) => set({ selectedGeofenceId }),
  selectZone: (selectedZoneId) => set({ selectedZoneId }),
  setInspectorOpen: (inspectorOpen) => set({ inspectorOpen }),
  toggleLayer: (layer) =>
    set((state) => ({
      layerVisibility: {
        ...state.layerVisibility,
        [layer]: !state.layerVisibility[layer],
      },
    })),
  setCenter: (center) => set({ center }),
  setZoom: (zoom) => set({ zoom }),
  setPulseTick: (pulseTick) => set({ pulseTick }),
}))
