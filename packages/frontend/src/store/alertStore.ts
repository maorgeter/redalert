import { create } from 'zustand'
import { AlertEvent, EstimatedZone, AlertStatus, AlertType, GeofenceFC } from '@/types'

interface AlertStore {
  // Events
  events: AlertEvent[]
  activeEvents: AlertEvent[]

  // Zones
  estimatedZones: EstimatedZone[]

  // Geofences
  geofences: GeofenceFC | null

  // Connection state
  wsConnected: boolean

  // Freshness tracking
  lastUpdate: string | null           // legacy, kept for compatibility
  lastEventReceivedAt: string | null  // time of last actual event received
  lastInitAt: string | null           // time of last WebSocket init message

  // Active event counts by type
  activeRedAlerts: number
  activeWarnings: number
  activeCleareds: number

  // Actions
  setGeofences: (fc: GeofenceFC) => void
  addEvent: (event: AlertEvent) => void
  expireEvent: (event: AlertEvent) => void
  bulkSetEvents: (events: AlertEvent[]) => void
  setZones: (zones: EstimatedZone[]) => void
  setWsConnected: (connected: boolean) => void
  markInitReceived: () => void
}

const MAX_EVENTS = 150

function computeTypeCounts(activeEvents: AlertEvent[]) {
  let activeRedAlerts = 0
  let activeWarnings = 0
  let activeCleareds = 0
  for (const e of activeEvents) {
    const t = e.alertType
    if (t === AlertType.RED_ALERT) activeRedAlerts++
    else if (t === AlertType.ALL_CLEAR) activeCleareds++
    else activeWarnings++
  }
  return { activeRedAlerts, activeWarnings, activeCleareds }
}

export const useAlertStore = create<AlertStore>((set, get) => ({
  events: [],
  activeEvents: [],
  estimatedZones: [],
  geofences: null,
  wsConnected: false,
  lastUpdate: null,
  lastEventReceivedAt: null,
  lastInitAt: null,
  activeRedAlerts: 0,
  activeWarnings: 0,
  activeCleareds: 0,

  setGeofences: (fc) => set({ geofences: fc }),

  addEvent: (event) =>
    set((state) => {
      const exists = state.events.findIndex((e) => e.id === event.id)
      let events: AlertEvent[]
      if (exists >= 0) {
        events = state.events.map((e) => (e.id === event.id ? event : e))
      } else {
        events = [event, ...state.events].slice(0, MAX_EVENTS)
      }
      const activeEvents = events.filter((e) => e.status === AlertStatus.ACTIVE)
      const now = new Date().toISOString()
      return {
        events,
        activeEvents,
        lastUpdate: now,
        lastEventReceivedAt: now,
        ...computeTypeCounts(activeEvents),
      }
    }),

  expireEvent: (event) =>
    set((state) => {
      const events = state.events.map((e) =>
        e.id === event.id ? { ...e, status: AlertStatus.EXPIRED } : e
      )
      const activeEvents = events.filter((e) => e.status === AlertStatus.ACTIVE)
      return { events, activeEvents, ...computeTypeCounts(activeEvents) }
    }),

  bulkSetEvents: (events) => {
    const sliced = events.slice(0, MAX_EVENTS)
    const activeEvents = sliced.filter((e) => e.status === AlertStatus.ACTIVE)
    const now = new Date().toISOString()
    set({
      events: sliced,
      activeEvents,
      lastUpdate: now,
      lastEventReceivedAt: now,
      ...computeTypeCounts(activeEvents),
    })
  },

  setZones: (estimatedZones) => set({ estimatedZones }),

  setWsConnected: (wsConnected) => set({ wsConnected }),

  markInitReceived: () => set({ lastInitAt: new Date().toISOString() }),
}))
