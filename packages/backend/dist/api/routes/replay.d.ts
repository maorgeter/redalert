import type { FastifyInstance } from 'fastify';
import type { IngestionManager } from '../../ingestion';
import type { Broadcaster } from '../../streaming/broadcaster';
export declare function replayRoutes(fastify: FastifyInstance, opts: {
    ingestion: IngestionManager;
    broadcaster: Broadcaster;
}): Promise<void>;
//# sourceMappingURL=replay.d.ts.map