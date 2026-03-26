import type { FastifyInstance } from 'fastify'
import type { IngestionManager } from '../../ingestion'
import type { Broadcaster } from '../../streaming/broadcaster'

export async function sourcesRoutes(
  app: FastifyInstance,
  opts: { ingestion: IngestionManager; broadcaster: Broadcaster }
): Promise<void> {
  // List all adapter statuses
  app.get('/api/sources', async (_req, reply) => {
    reply.send(opts.ingestion.getAdapterStatuses())
  })

  // Enable/disable a specific adapter
  app.post<{ Params: { name: string }; Body: { enabled: boolean } }>(
    '/api/sources/:name/toggle',
    async (req, reply) => {
      const { name } = req.params
      const { enabled } = req.body ?? {}
      if (typeof enabled !== 'boolean') {
        return reply.status(400).send({ error: 'Body must contain { enabled: boolean }' })
      }

      const ok = enabled
        ? await opts.ingestion.enableAdapter(name)
        : await opts.ingestion.disableAdapter(name)

      if (!ok) {
        return reply.status(404).send({ error: `No adapter named '${name}'` })
      }

      // Broadcast updated status immediately
      opts.broadcaster.broadcastSourceStatus(opts.ingestion.getAdapterStatuses())
      reply.send({ name, enabled })
    }
  )
}
