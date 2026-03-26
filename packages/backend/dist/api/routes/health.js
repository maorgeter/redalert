"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRoutes = healthRoutes;
const db_1 = require("../../persistence/db");
const startTime = Date.now();
async function healthRoutes(fastify, opts) {
    const { ingestion, broadcaster } = opts;
    fastify.get('/health', async (_req, reply) => {
        const adapterStatuses = ingestion.getAdapterStatuses();
        const allHealthy = adapterStatuses.every((s) => s.healthy);
        return reply.send({
            status: allHealthy ? 'ok' : 'degraded',
            uptime: Math.floor((Date.now() - startTime) / 1000),
            clientCount: broadcaster.clientCount,
            activeEventCount: ingestion.getActiveEvents().length,
            dbAvailable: (0, db_1.isDbAvailable)(),
            adapterStatuses,
            ts: new Date().toISOString(),
        });
    });
    fastify.get('/health/ready', async (_req, reply) => {
        return reply.status(200).send({ ready: true });
    });
}
//# sourceMappingURL=health.js.map