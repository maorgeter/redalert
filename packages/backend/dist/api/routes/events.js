"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventsRoutes = eventsRoutes;
const schema_1 = require("../../normalization/schema");
const db_1 = require("../../persistence/db");
async function eventsRoutes(fastify, opts) {
    const { ingestion } = opts;
    /** GET /api/events — recent events (in-memory) */
    fastify.get('/api/events', async (req, reply) => {
        const events = ingestion.getRecentEvents(300000);
        return reply.send({ events: events.map(schema_1.toDTO), count: events.length });
    });
    /** GET /api/events/active */
    fastify.get('/api/events/active', async (req, reply) => {
        const events = ingestion.getActiveEvents();
        return reply.send({ events: events.map(schema_1.toDTO), count: events.length });
    });
    /** GET /api/events/history — from DB if available */
    fastify.get('/api/events/history', async (req, reply) => {
        const limit = Math.min(parseInt(req.query.limit ?? '100'), 500);
        const offset = parseInt(req.query.offset ?? '0');
        if (!(0, db_1.isDbAvailable)()) {
            const all = ingestion.getAllEvents().reverse();
            return reply.send({
                events: all.slice(offset, offset + limit).map(schema_1.toDTO),
                count: all.length,
                source: 'memory',
            });
        }
        const rows = await (0, db_1.query)(`SELECT * FROM alert_events ORDER BY timestamp DESC LIMIT $1 OFFSET $2`, [limit, offset]);
        return reply.send({ events: rows, count: rows.length, source: 'db' });
    });
}
//# sourceMappingURL=events.js.map