import { NormalizedEvent } from '../normalization/schema';
export type DedupResult = {
    action: 'new';
} | {
    action: 'drop';
} | {
    action: 'merge';
    canonicalId: string;
};
/**
 * In-memory deduplication window with cross-source provenance tracking.
 *
 * Keys on areaName+category (without source) so alerts from multiple sources
 * about the same area are merged rather than duplicated. When the same source
 * re-reports within the window the event is dropped entirely.
 */
export declare class DeduplicationCache {
    private cache;
    private windowMs;
    constructor(windowMs?: number);
    check(event: NormalizedEvent): DedupResult;
    private cleanup;
    get size(): number;
}
//# sourceMappingURL=deduplication.d.ts.map