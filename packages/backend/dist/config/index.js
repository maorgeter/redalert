"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
require("dotenv/config");
exports.config = {
    port: parseInt(process.env.PORT ?? '3001'),
    db: {
        host: process.env.DB_HOST ?? 'localhost',
        port: parseInt(process.env.DB_PORT ?? '5432'),
        database: process.env.DB_NAME ?? 'alertmap',
        user: process.env.DB_USER ?? 'postgres',
        password: process.env.DB_PASSWORD ?? 'postgres',
        max: parseInt(process.env.DB_POOL_SIZE ?? '10'),
    },
    ingestion: {
        // Mock/simulation adapter — disabled by default; only enable for local development
        mockEnabled: process.env.MOCK_INGESTION === 'true',
        // OREF public alert feed — enabled by default
        orefEnabled: process.env.OREF_INGESTION !== 'false',
        pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS ?? '3000'),
        mockEventIntervalMs: parseInt(process.env.MOCK_EVENT_INTERVAL_MS ?? '8000'),
    },
    estimation: {
        bufferKm: parseFloat(process.env.BUFFER_KM ?? '5'),
        decayMs: parseInt(process.env.DECAY_MS ?? '300000'),
        recomputeIntervalMs: parseInt(process.env.RECOMPUTE_INTERVAL_MS ?? '1000'),
        maxTrendEvents: 10,
        minTrendEvents: 3,
        uncertaintyMultiplier: 1.8,
    },
    cors: {
        origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    },
    geofencesPath: process.env.GEOFENCES_PATH ?? './data/geofences.geojson',
};
//# sourceMappingURL=index.js.map