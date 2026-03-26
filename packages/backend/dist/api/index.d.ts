import type { FastifyInstance } from 'fastify';
import type { IngestionManager } from '../ingestion';
import type { EstimationEngine } from '../estimation/engine';
import type { Broadcaster } from '../streaming/broadcaster';
import type { GeofenceCollection } from '../geospatial/loader';
interface ApiOpts {
    ingestion: IngestionManager;
    engine: EstimationEngine;
    broadcaster: Broadcaster;
    geofences: GeofenceCollection;
}
export declare function registerApiRoutes(app: FastifyInstance, opts: ApiOpts): Promise<void>;
export {};
//# sourceMappingURL=index.d.ts.map