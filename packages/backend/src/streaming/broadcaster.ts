import WebSocket from 'ws'
import { NormalizedEvent, toDTO, NormalizedEventDTO } from '../normalization/schema'
import type { EstimatedZone } from '../estimation/types'
import type { AdapterStatus } from '../ingestion/adapters/base'
import { logger } from '../logger'

export type ServerMessageType =
  | 'init'
  | 'event'
  | 'event:expired'
  | 'zones_update'
  | 'health'
  | 'source_status'
  | 'pong'
  | 'replay_frame'
  | 'replay_end'
  | 'replay_state'

export interface ServerMessage {
  type: ServerMessageType
  ts: string
  data: unknown
}

export interface ClientMessage {
  type: 'ping' | 'subscribe' | 'inspect' | 'replay_control'
  data?: unknown
}

function serialize(type: ServerMessageType, data: unknown): string {
  return JSON.stringify({ type, ts: new Date().toISOString(), data })
}

export class Broadcaster {
  private clients = new Set<WebSocket>()

  addClient(ws: WebSocket): void {
    this.clients.add(ws)
    ws.on('close', () => this.clients.delete(ws))
    ws.on('error', () => this.clients.delete(ws))
    logger.debug({ total: this.clients.size }, 'WS client connected')
  }

  sendInit(
    ws: WebSocket,
    events: NormalizedEvent[],
    zones: EstimatedZone[],
    geofencesJson: unknown
  ): void {
    this.sendTo(ws, serialize('init', {
      events: events.map(toDTO),
      zones: this.serializeZones(zones),
      geofences: geofencesJson,
    }))
  }

  broadcastEvent(event: NormalizedEvent): void {
    this.broadcast(serialize('event', toDTO(event)))
  }

  broadcastEventExpired(event: NormalizedEvent): void {
    this.broadcast(serialize('event:expired', toDTO(event)))
  }

  broadcastZones(zones: EstimatedZone[]): void {
    this.broadcast(serialize('zones_update', this.serializeZones(zones)))
  }

  broadcastSourceStatus(statuses: AdapterStatus[]): void {
    this.broadcast(serialize('source_status', statuses))
  }

  broadcastHealth(health: HealthPayload): void {
    this.broadcast(serialize('health', health))
  }

  sendPong(ws: WebSocket): void {
    this.sendTo(ws, serialize('pong', null))
  }

  private broadcast(msg: string): void {
    for (const ws of this.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg, (err) => {
          if (err) this.clients.delete(ws)
        })
      }
    }
  }

  private sendTo(ws: WebSocket, msg: string): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg)
    }
  }

  private serializeZones(zones: EstimatedZone[]) {
    return zones.map((z) => ({
      id: z.id,
      geometry: z.geometry,
      uncertaintyGeometry: z.uncertaintyGeometry,
      sourceGeofenceIds: z.sourceGeofenceIds,
      affectedAreas: z.affectedAreas,
      confidence: z.confidence,
      lastEventAt: z.lastEventAt.toISOString(),
      computedAt: z.computedAt.toISOString(),
      explanation: z.explanation,
      trend: z.trend,
    }))
  }

  get clientCount(): number {
    return this.clients.size
  }
}

export interface HealthPayload {
  status: 'ok' | 'degraded'
  uptime: number
  clientCount: number
  activeEventCount: number
  adapterStatuses: AdapterStatus[]
  lastZoneComputedAt: string | null
}
