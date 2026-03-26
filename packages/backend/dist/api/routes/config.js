"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configRoutes = configRoutes;
const config_1 = require("../../config");
async function configRoutes(fastify) {
    /** GET /api/config — public runtime configuration */
    fastify.get('/api/config', async (_req, reply) => {
        return reply.send({
            estimation: {
                bufferKm: config_1.config.estimation.bufferKm,
                decayMs: config_1.config.estimation.decayMs,
                recomputeIntervalMs: config_1.config.estimation.recomputeIntervalMs,
            },
            ingestion: {
                mockEnabled: config_1.config.ingestion.mockEnabled,
                orefEnabled: config_1.config.ingestion.orefEnabled,
            },
        });
    });
}
//# sourceMappingURL=config.js.map