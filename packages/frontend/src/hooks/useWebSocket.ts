'use client'
import { useEffect } from 'react'
import { getWebSocket } from '@/lib/websocket'
import { useAlertStore } from '@/store/alertStore'
import { useSystemStore } from '@/store/systemStore'
import { ServerMessage, GeofenceFC } from '@/types'

// Derive REST API base from the WS URL env var
const API_BASE = (process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001')
  .replace(/^ws(s?):/, 'http$1:')

export function useWebSocket(): void {
  const {
    addEvent, expireEvent, bulkSetEvents, mergeHistoryEvents,
    setZones, setGeofences, setWsConnected, markInitReceived,
  } = useAlertStore()
  const { setHealth, setAdapterStatuses } = useSystemStore()

  useEffect(() => {
    const ws = getWebSocket()

    const offMessage = ws.onMessage((msg: ServerMessage) => {
      switch (msg.type) {
        case 'init': {
          console.log('[WS] init received — events:', msg.data.events.length)
          bulkSetEvents(msg.data.events)
          setZones(msg.data.zones)
          setGeofences(msg.data.geofences as GeofenceFC)
          markInitReceived()
          // Merge REST history immediately after bulk-set so older DB events
          // are appended without being wiped by a later reconnect init.
          fetch(`${API_BASE}/api/alerts/history`)
            .then((r) => r.json())
            .then(({ alerts }) => { if (Array.isArray(alerts)) mergeHistoryEvents(alerts) })
            .catch(() => { /* non-fatal — WS init data is still shown */ })
          break
        }
        case 'event':
          console.log('[WS] event received:', msg.data.areaName, '| cat:', msg.data.category, '| geofenceId:', msg.data.geofenceId)
          addEvent(msg.data)
          break
        case 'event:expired':
          console.log('[WS] event:expired:', msg.data.areaName)
          expireEvent(msg.data)
          break
        case 'zones_update':
          setZones(msg.data)
          break
        case 'health':
          setHealth(msg.data)
          break
        case 'source_status':
          setAdapterStatuses(msg.data)
          break
      }
    })

    const offStatus = ws.onStatus(setWsConnected)
    ws.connect()

    return () => {
      offMessage()
      offStatus()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
