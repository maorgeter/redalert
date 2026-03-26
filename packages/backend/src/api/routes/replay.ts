import type { FastifyInstance } from 'fastify'
import { ReplayEngine, ReplaySpeed } from '../../replay/engine'
import type { IngestionManager } from '../../ingestion'
import type { Broadcaster } from '../../streaming/broadcaster'
import { NormalizedEvent } from '../../normalization/schema'
import { toDTO } from '../../normalization/schema'
import { v4 as uuidv4 } from 'uuid'

export async function replayRoutes(
  fastify: FastifyInstance,
  opts: { ingestion: IngestionManager; broadcaster: Broadcaster }
): Promise<void> {
  const { ingestion, broadcaster } = opts
  const engine = new ReplayEngine()

  // Forward replay events through the broadcaster
  engine.on('event', (event: NormalizedEvent) => {
    broadcaster.broadcastEvent(event)
  })

  engine.on('state', (state) => {
    // broadcast replay state so UI can update controls
    for (const client of (broadcaster as any).clients as Set<import('ws').WebSocket>) {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ type: 'replay_state', ts: new Date().toISOString(), data: state }))
      }
    }
  })

  /** POST /api/replay/start */
  fastify.post<{
    Body: { speed?: number; eventIds?: string[] }
  }>('/api/replay/start', async (req, reply) => {
    const speed = (req.body.speed as ReplaySpeed) ?? 1
    const allEvents = ingestion.getAllEvents()
    const events = req.body.eventIds
      ? allEvents.filter((e) => req.body.eventIds!.includes(e.id))
      : allEvents

    if (events.length === 0) {
      return reply.status(400).send({ error: 'No events available for replay' })
    }

    const sessionId = uuidv4()
    engine.start(sessionId, events, speed)
    return reply.send({ sessionId, eventCount: events.length })
  })

  /** POST /api/replay/pause */
  fastify.post('/api/replay/pause', async (_req, reply) => {
    engine.pause()
    return reply.send({ status: engine.getState().status })
  })

  /** POST /api/replay/resume */
  fastify.post('/api/replay/resume', async (_req, reply) => {
    engine.resume()
    return reply.send({ status: engine.getState().status })
  })

  /** POST /api/replay/stop */
  fastify.post('/api/replay/stop', async (_req, reply) => {
    await engine.stop()
    return reply.send({ status: 'stopped' })
  })

  /** POST /api/replay/seek */
  fastify.post<{ Body: { index: number } }>('/api/replay/seek', async (req, reply) => {
    engine.seek(req.body.index)
    return reply.send({ index: engine.getState().currentIndex })
  })

  /** POST /api/replay/speed */
  fastify.post<{ Body: { speed: number } }>('/api/replay/speed', async (req, reply) => {
    engine.setSpeed(req.body.speed as ReplaySpeed)
    return reply.send({ speed: engine.getState().speed })
  })

  /** GET /api/replay/state */
  fastify.get('/api/replay/state', async (_req, reply) => {
    return reply.send(engine.getState())
  })

  /** GET /api/replay/events — list available events for replay selection */
  fastify.get('/api/replay/events', async (_req, reply) => {
    const events = ingestion.getAllEvents()
    return reply.send({ events: events.map(toDTO), count: events.length })
  })
}
