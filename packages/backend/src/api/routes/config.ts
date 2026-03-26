import type { FastifyInstance } from 'fastify'
import { config } from '../../config'

export async function configRoutes(fastify: FastifyInstance): Promise<void> {
  /** GET /api/config — public runtime configuration */
  fastify.get('/api/config', async (_req, reply) => {
    return reply.send({
      estimation: {
        bufferKm: config.estimation.bufferKm,
        decayMs: config.estimation.decayMs,
        recomputeIntervalMs: config.estimation.recomputeIntervalMs,
      },
      ingestion: {
        mockEnabled: config.ingestion.mockEnabled,
        orefEnabled: config.ingestion.orefEnabled,
      },
    })
  })
}
