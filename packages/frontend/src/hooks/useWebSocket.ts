'use client'
import { useEffect } from 'react'
import { getWebSocket } from '@/lib/websocket'
import { useAlertStore } from '@/store/alertStore'
import { useSystemStore } from '@/store/systemStore'
import { ServerMessage, GeofenceFC } from '@/types'

export function useWebSocket(): void {
  const { addEvent, expireEvent, bulkSetEvents, setZones, setGeofences, setWsConnected, markInitReceived } =
    useAlertStore()
  const { setHealth, setAdapterStatuses } = useSystemStore()

  useEffect(() => {
    const ws = getWebSocket()

    const offMessage = ws.onMessage((msg: ServerMessage) => {
      switch (msg.type) {
        case 'init':
          bulkSetEvents(msg.data.events)
          setZones(msg.data.zones)
          setGeofences(msg.data.geofences as GeofenceFC)
          markInitReceived()
          break
        case 'event':
          addEvent(msg.data)
          break
        case 'event:expired':
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
