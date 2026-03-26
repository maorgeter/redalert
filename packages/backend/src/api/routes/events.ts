import type { FastifyInstance } from 'fastify'
import type { IngestionManager } from '../../ingestion'
import { toDTO } from '../../normalization/schema'
import { query, isDbAvailable } from '../../persistence/db'

export async function eventsRoutes(
  fastify: FastifyInstance,
  opts: { ingestion: IngestionManager }
): Promise<void> {
  const { ingestion } = opts

  /** GET /api/events — recent events (in-memory) */
  fastify.get('/api/events', async (req, reply) => {
    const events = ingestion.getRecentEvents(300_000)
    return reply.send({ events: events.map(toDTO), count: events.length })
  })

  /** GET /api/events/active */
  fastify.get('/api/events/active', async (req, reply) => {
    const events = ingestion.getActiveEvents()
    return reply.send({ events: events.map(toDTO), count: events.length })
  })

  /** GET /api/events/history — from DB if available */
  fastify.get<{ Querystring: { limit?: string; offset?: string } }>(
    '/api/events/history',
    async (req, reply) => {
      const limit = Math.min(parseInt(req.query.limit ?? '100'), 500)
      const offset = parseInt(req.query.offset ?? '0')

      if (!isDbAvailable()) {
        const all = ingestion.getAllEvents().reverse()
        return reply.send({
          events: all.slice(offset, offset + limit).map(toDTO),
          count: all.length,
          source: 'memory',
        })
      }

      const rows = await query(
        `SELECT * FROM alert_events ORDER BY timestamp DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
      )
      return reply.send({ events: rows, count: rows.length, source: 'db' })
    }
  )
}
