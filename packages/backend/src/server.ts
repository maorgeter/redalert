import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import websocketPlugin, { SocketStream } from '@fastify/websocket'

import { config } from './config'
import { logger } from './logger'
import { initDb } from './persistence/db'
import { initGeospatial } from './geospatial'
import { loadGeofences } from './geospatial/loader'
import { IngestionManager } from './ingestion'
import { EstimationEngine } from './estimation/engine'
import { Broadcaster } from './streaming/broadcaster'
import type { ClientMessage } from './streaming/broadcaster'
import { registerApiRoutes } from './api'

async function bootstrap(): Promise<void> {
  // ── 1. Database (optional — graceful degradation if unavailable) ───────────
  await initDb()

  // ── 2. Geospatial ──────────────────────────────────────────────────────────
  initGeospatial()
  const geofences = loadGeofences(config.geofencesPath)

  // ── 3. Ingestion ───────────────────────────────────────────────────────────
  const ingestion = new IngestionManager()
  ingestion.initialize()

  if (!config.ingestion.orefEnabled && !config.ingestion.mockEnabled) {
    logger.warn('No ingestion adapters enabled. Set OREF_INGESTION=true or MOCK_INGESTION=true.')
  }

  // ── 4. Estimation engine ───────────────────────────────────────────────────
  const engine = new EstimationEngine(
    () => ingestion.getActiveEvents(),
    () => ingestion.getRecentEvents(300_000)
  )

  // ── 5. WebSocket broadcaster ───────────────────────────────────────────────
  const broadcaster = new Broadcaster()

  ingestion.on('event', (event) => broadcaster.broadcastEvent(event))
  ingestion.on('event:expired', (event) => broadcaster.broadcastEventExpired(event))
  engine.on('zones', (zones) => broadcaster.broadcastZones(zones))

  // ── 6. Fastify ─────────────────────────────────────────────────────────────
  const app = Fastify({ logger: false })

  await app.register(cors, {
    origin: config.cors.origin,
    methods: ['GET', 'POST', 'OPTIONS'],
  })

  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
  })

  await app.register(websocketPlugin)

  // ── 7. WebSocket endpoint ──────────────────────────────────────────────────
  app.get('/ws', { websocket: true }, (connection: SocketStream) => {
    const socket = connection.socket
    broadcaster.addClient(socket)

    broadcaster.sendInit(
      socket,
      ingestion.getRecentEvents(300_000),
      engine.getCurrentZones(),
      geofences
    )

    socket.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as ClientMessage
        if (msg.type === 'ping') broadcaster.sendPong(socket)
      } catch {
        // ignore malformed messages
      }
    })
  })

  // ── 8. REST API ────────────────────────────────────────────────────────────
  await registerApiRoutes(app, { ingestion, engine, broadcaster, geofences })

  // ── 9. Health broadcast + source status ───────────────────────────────────
  setInterval(() => {
    const adapterStatuses = ingestion.getAdapterStatuses()
    broadcaster.broadcastHealth({
      status: adapterStatuses.every((s) => s.healthy) ? 'ok' : 'degraded',
      uptime: process.uptime(),
      clientCount: broadcaster.clientCount,
      activeEventCount: ingestion.getActiveEvents().length,
      adapterStatuses,
      lastZoneComputedAt: engine.getCurrentZones()[0]?.computedAt.toISOString() ?? null,
    })
    broadcaster.broadcastSourceStatus(adapterStatuses)
  }, 5000)

  // ── 10. Start adapters + estimation ───────────────────────────────────────
  await ingestion.startAll()
  engine.start()

  const address = await app.listen({ port: config.port, host: '0.0.0.0' })
  logger.info(
    { address, oref: config.ingestion.orefEnabled, simulation: config.ingestion.mockEnabled },
    'Dynamic Alert Map backend started'
  )

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = async () => {
    logger.info('Shutting down...')
    engine.stop()
    await ingestion.stopAll()
    await app.close()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

bootstrap().catch((err) => {
  logger.error(err, 'Failed to start server')
  process.exit(1)
})
