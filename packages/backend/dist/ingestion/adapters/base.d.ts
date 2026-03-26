import { EventEmitter } from 'events';
import { NormalizedEvent } from '../../normalization/schema';
export type AdapterType = 'polling' | 'websocket' | 'webhook' | 'manual';
export interface AdapterStatus {
    name: string;
    /** Transport mechanism used by this adapter */
    type: AdapterType;
    healthy: boolean;
    /** Whether the adapter is currently running */
    enabled: boolean;
    /** Whether this is the primary/authoritative source */
    isPrimary: boolean;
    /** Reliability score 0–1 (used to weight event confidence) */
    reliabilityScore: number;
    lastSuccess: Date | null;
    lastError: string | null;
    eventCount: number;
    errorCount: number;
    /** Expected interval between successful polls in ms — used by UI for stale detection */
    updateIntervalMs: number;
}
export declare abstract class BaseIngestionAdapter extends EventEmitter {
    abstract readonly name: string;
    protected running: boolean;
    protected status: AdapterStatus;
    constructor(updateIntervalMs?: number, type?: AdapterType, isPrimary?: boolean, reliabilityScore?: number);
    abstract start(): Promise<void>;
    abstract stop(): Promise<void>;
    getStatus(): AdapterStatus;
    protected emitEvents(events: NormalizedEvent[]): void;
    protected handleError(err: unknown): void;
}
//# sourceMappingURL=base.d.ts.map