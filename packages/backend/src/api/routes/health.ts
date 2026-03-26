import type { FastifyInstance } from 'fastify'
import type { IngestionManager } from '../../ingestion'
import type { Broadcaster } from '../../streaming/broadcaster'
import { isDbAvailable } from '../../persistence/db'

const startTime = Date.now()

export async function healthRoutes(
  fastify: FastifyInstance,
  opts: { ingestion: IngestionManager; broadcaster: Broadcaster }
): Promise<void> {
  const { ingestion, broadcaster } = opts

  fastify.get('/health', async (_req, reply) => {
    const adapterStatuses = ingestion.getAdapterStatuses()
    const allHealthy = adapterStatuses.every((s) => s.healthy)

    return reply.send({
      status: allHealthy ? 'ok' : 'degraded',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      clientCount: broadcaster.clientCount,
      activeEventCount: ingestion.getActiveEvents().length,
      dbAvailable: isDbAvailable(),
      adapterStatuses,
      ts: new Date().toISOString(),
    })
  })

  fastify.get('/health/ready', async (_req, reply) => {
    return reply.status(200).send({ ready: true })
  })
}
