import type { FastifyInstance } from 'fastify';
import type { EstimationEngine } from '../../estimation/engine';
import type { GeofenceCollection } from '../../geospatial/loader';
export declare function zonesRoutes(fastify: FastifyInstance, opts: {
    engine: EstimationEngine;
    geofences: GeofenceCollection;
}): Promise<void>;
//# sourceMappingURL=zones.d.ts.map