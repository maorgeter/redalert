"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const rate_limit_1 = __importDefault(require("@fastify/rate-limit"));
const websocket_1 = __importDefault(require("@fastify/websocket"));
const config_1 = require("./config");
const logger_1 = require("./logger");
const db_1 = require("./persistence/db");
const geospatial_1 = require("./geospatial");
const loader_1 = require("./geospatial/loader");
const ingestion_1 = require("./ingestion");
const engine_1 = require("./estimation/engine");
const broadcaster_1 = require("./streaming/broadcaster");
const api_1 = require("./api");
async function bootstrap() {
    // ── 1. Database (optional — graceful degradation if unavailable) ───────────
    await (0, db_1.initDb)();
    // ── 2. Geospatial ──────────────────────────────────────────────────────────
    (0, geospatial_1.initGeospatial)();
    const geofences = (0, loader_1.loadGeofences)(config_1.config.geofencesPath);
    // ── 3. Ingestion ───────────────────────────────────────────────────────────
    const ingestion = new ingestion_1.IngestionManager();
    ingestion.initialize();
    if (!config_1.config.ingestion.orefEnabled && !config_1.config.ingestion.mockEnabled) {
        logger_1.logger.warn('No ingestion adapters enabled. Set OREF_INGESTION=true or MOCK_INGESTION=true.');
    }
    // ── 4. Estimation engine ───────────────────────────────────────────────────
    const engine = new engine_1.EstimationEngine(() => ingestion.getActiveEvents(), () => ingestion.getRecentEvents(300000));
    // ── 5. WebSocket broadcaster ───────────────────────────────────────────────
    const broadcaster = new broadcaster_1.Broadcaster();
    ingestion.on('event', (event) => broadcaster.broadcastEvent(event));
    ingestion.on('event:expired', (event) => broadcaster.broadcastEventExpired(event));
    engine.on('zones', (zones) => broadcaster.broadcastZones(zones));
    // ── 6. Fastify ─────────────────────────────────────────────────────────────
    const app = (0, fastify_1.default)({ logger: false });
    await app.register(cors_1.default, {
        origin: config_1.config.cors.origin,
        methods: ['GET', 'POST', 'OPTIONS'],
    });
    await app.register(rate_limit_1.default, {
        max: 300,
        timeWindow: '1 minute',
    });
    await app.register(websocket_1.default);
    // ── 7. WebSocket endpoint ──────────────────────────────────────────────────
    app.get('/ws', { websocket: true }, (connection) => {
        const socket = connection.socket;
        broadcaster.addClient(socket);
        broadcaster.sendInit(socket, ingestion.getRecentEvents(300000), engine.getCurrentZones(), geofences);
        socket.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.type === 'ping')
                    broadcaster.sendPong(socket);
            }
            catch {
                // ignore malformed messages
            }
        });
    });
    // ── 8. REST API ────────────────────────────────────────────────────────────
    await (0, api_1.registerApiRoutes)(app, { ingestion, engine, broadcaster, geofences });
    // ── 9. Health broadcast + source status ───────────────────────────────────
    setInterval(() => {
        const adapterStatuses = ingestion.getAdapterStatuses();
        broadcaster.broadcastHealth({
            status: adapterStatuses.every((s) => s.healthy) ? 'ok' : 'degraded',
            uptime: process.uptime(),
            clientCount: broadcaster.clientCount,
            activeEventCount: ingestion.getActiveEvents().length,
            adapterStatuses,
            lastZoneComputedAt: engine.getCurrentZones()[0]?.computedAt.toISOString() ?? null,
        });
        broadcaster.broadcastSourceStatus(adapterStatuses);
    }, 5000);
    // ── 10. Start adapters + estimation ───────────────────────────────────────
    await ingestion.startAll();
    engine.start();
    const address = await app.listen({ port: config_1.config.port, host: '0.0.0.0' });
    logger_1.logger.info({ address, oref: config_1.config.ingestion.orefEnabled, simulation: config_1.config.ingestion.mockEnabled }, 'Dynamic Alert Map backend started');
    // ── Graceful shutdown ──────────────────────────────────────────────────────
    const shutdown = async () => {
        logger_1.logger.info('Shutting down...');
        engine.stop();
        await ingestion.stopAll();
        await app.close();
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}
bootstrap().catch((err) => {
    logger_1.logger.error(err, 'Failed to start server');
    process.exit(1);
});
//# sourceMappingURL=server.js.map