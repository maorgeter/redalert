import type { FastifyInstance } from 'fastify';
import type { IngestionManager } from '../../ingestion';
import type { Broadcaster } from '../../streaming/broadcaster';
export declare function healthRoutes(fastify: FastifyInstance, opts: {
    ingestion: IngestionManager;
    broadcaster: Broadcaster;
}): Promise<void>;
//# sourceMappingURL=health.d.ts.map