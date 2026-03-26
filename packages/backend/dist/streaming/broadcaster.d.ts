import WebSocket from 'ws';
import { NormalizedEvent } from '../normalization/schema';
import type { EstimatedZone } from '../estimation/types';
import type { AdapterStatus } from '../ingestion/adapters/base';
export type ServerMessageType = 'init' | 'event' | 'event:expired' | 'zones_update' | 'health' | 'source_status' | 'pong' | 'replay_frame' | 'replay_end' | 'replay_state';
export interface ServerMessage {
    type: ServerMessageType;
    ts: string;
    data: unknown;
}
export interface ClientMessage {
    type: 'ping' | 'subscribe' | 'inspect' | 'replay_control';
    data?: unknown;
}
export declare class Broadcaster {
    private clients;
    addClient(ws: WebSocket): void;
    sendInit(ws: WebSocket, events: NormalizedEvent[], zones: EstimatedZone[], geofencesJson: unknown): void;
    broadcastEvent(event: NormalizedEvent): void;
    broadcastEventExpired(event: NormalizedEvent): void;
    broadcastZones(zones: EstimatedZone[]): void;
    broadcastSourceStatus(statuses: AdapterStatus[]): void;
    broadcastHealth(health: HealthPayload): void;
    sendPong(ws: WebSocket): void;
    private broadcast;
    private sendTo;
    private serializeZones;
    get clientCount(): number;
}
export interface HealthPayload {
    status: 'ok' | 'degraded';
    uptime: number;
    clientCount: number;
    activeEventCount: number;
    adapterStatuses: AdapterStatus[];
    lastZoneComputedAt: string | null;
}
//# sourceMappingURL=broadcaster.d.ts.map