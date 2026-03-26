import type { FastifyInstance } from 'fastify'
import type { IngestionManager } from '../ingestion'
import type { EstimationEngine } from '../estimation/engine'
import type { Broadcaster } from '../streaming/broadcaster'
import type { GeofenceCollection } from '../geospatial/loader'

import { eventsRoutes } from './routes/events'
import { healthRoutes } from './routes/health'
import { zonesRoutes } from './routes/zones'
import { configRoutes } from './routes/config'
import { sourcesRoutes } from './routes/sources'

interface ApiOpts {
  ingestion: IngestionManager
  engine: EstimationEngine
  broadcaster: Broadcaster
  geofences: GeofenceCollection
}

export async function registerApiRoutes(app: FastifyInstance, opts: ApiOpts): Promise<void> {
  await healthRoutes(app, opts)
  await eventsRoutes(app, opts)
  await zonesRoutes(app, opts)
  await configRoutes(app)
  await sourcesRoutes(app, opts)
}
