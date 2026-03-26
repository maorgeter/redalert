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

  /** GET /api/alerts/history — last 50 alerts for the sidebar history panel */
  fastify.get<{ Querystring: { limit?: string } }>(
    '/api/alerts/history',
    async (req, reply) => {
      const limit = Math.min(parseInt(req.query.limit ?? '50'), 200)

      if (isDbAvailable()) {
        const rows = await query<Record<string, unknown>>(
          `SELECT id, source, timestamp, area_name, area_type, city_names,
                  geofence_id, received_at, updated_at, severity, confidence,
                  status, category, ttl_seconds,
                  COALESCE(alert_type, 'warning') AS alert_type,
                  COALESCE(title, '')             AS title,
                  COALESCE(description, '')       AS description
           FROM alert_events
           ORDER BY timestamp DESC
           LIMIT $1`,
          [limit]
        )
        const alerts = rows.map((r) => ({
          id: r.id,
          source: r.source,
          provenance: [r.source as string],
          timestamp: (r.timestamp as Date).toISOString(),
          areaName: r.area_name,
          areaType: r.area_type,
          cityNames: r.city_names,
          geofenceId: r.geofence_id ?? undefined,
          receivedAt: (r.received_at as Date).toISOString(),
          updatedAt: (r.updated_at as Date).toISOString(),
          severity: r.severity,
          confidence: r.confidence,
          status: r.status,
          category: r.category,
          ttlSeconds: r.ttl_seconds,
          alertType: r.alert_type,
          title: r.title,
          description: r.description,
        }))
        return reply.send({ alerts, count: alerts.length, source: 'db' })
      }

      // Memory fallback — sort newest first
      const all = ingestion
        .getAllEvents()
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, limit)
      return reply.send({ alerts: all.map(toDTO), count: all.length, source: 'memory' })
    }
  )
}
