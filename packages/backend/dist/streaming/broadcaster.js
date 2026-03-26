"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Broadcaster = void 0;
const ws_1 = __importDefault(require("ws"));
const schema_1 = require("../normalization/schema");
const logger_1 = require("../logger");
function serialize(type, data) {
    return JSON.stringify({ type, ts: new Date().toISOString(), data });
}
class Broadcaster {
    constructor() {
        this.clients = new Set();
    }
    addClient(ws) {
        this.clients.add(ws);
        ws.on('close', () => this.clients.delete(ws));
        ws.on('error', () => this.clients.delete(ws));
        logger_1.logger.debug({ total: this.clients.size }, 'WS client connected');
    }
    sendInit(ws, events, zones, geofencesJson) {
        this.sendTo(ws, serialize('init', {
            events: events.map(schema_1.toDTO),
            zones: this.serializeZones(zones),
            geofences: geofencesJson,
        }));
    }
    broadcastEvent(event) {
        this.broadcast(serialize('event', (0, schema_1.toDTO)(event)));
    }
    broadcastEventExpired(event) {
        this.broadcast(serialize('event:expired', (0, schema_1.toDTO)(event)));
    }
    broadcastZones(zones) {
        this.broadcast(serialize('zones_update', this.serializeZones(zones)));
    }
    broadcastSourceStatus(statuses) {
        this.broadcast(serialize('source_status', statuses));
    }
    broadcastHealth(health) {
        this.broadcast(serialize('health', health));
    }
    sendPong(ws) {
        this.sendTo(ws, serialize('pong', null));
    }
    broadcast(msg) {
        for (const ws of this.clients) {
            if (ws.readyState === ws_1.default.OPEN) {
                ws.send(msg, (err) => {
                    if (err)
                        this.clients.delete(ws);
                });
            }
        }
    }
    sendTo(ws, msg) {
        if (ws.readyState === ws_1.default.OPEN) {
            ws.send(msg);
        }
    }
    serializeZones(zones) {
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
        }));
    }
    get clientCount() {
        return this.clients.size;
    }
}
exports.Broadcaster = Broadcaster;
//# sourceMappingURL=broadcaster.js.map