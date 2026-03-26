import type { FastifyInstance } from 'fastify'
import type { EstimationEngine } from '../../estimation/engine'
import type { GeofenceCollection } from '../../geospatial/loader'

export async function zonesRoutes(
  fastify: FastifyInstance,
  opts: { engine: EstimationEngine; geofences: GeofenceCollection }
): Promise<void> {
  const { engine, geofences } = opts

  /** GET /api/zones — current estimated zones */
  fastify.get('/api/zones', async (_req, reply) => {
    const zones = engine.getCurrentZones()
    return reply.send({
      zones: zones.map((z) => ({
        ...z,
        lastEventAt: z.lastEventAt.toISOString(),
        computedAt: z.computedAt.toISOString(),
      })),
      count: zones.length,
      disclaimer:
        'ESTIMATED ZONES: These polygons are derived visualizations from public alert events. ' +
        'They are NOT authoritative threat assessments. Always follow official guidance.',
    })
  })

  /** GET /api/geofences — static geofence boundaries */
  fastify.get('/api/geofences', async (_req, reply) => {
    return reply.send(geofences)
  })
}
