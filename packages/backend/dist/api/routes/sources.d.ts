import type { FastifyInstance } from 'fastify';
import type { IngestionManager } from '../../ingestion';
import type { Broadcaster } from '../../streaming/broadcaster';
export declare function sourcesRoutes(app: FastifyInstance, opts: {
    ingestion: IngestionManager;
    broadcaster: Broadcaster;
}): Promise<void>;
//# sourceMappingURL=sources.d.ts.map