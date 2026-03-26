import { EventEmitter } from 'events';
import { AdapterStatus } from './adapters/base';
import { NormalizedEvent } from '../normalization/schema';
export declare class IngestionManager extends EventEmitter {
    private adapters;
    private dedup;
    private eventStore;
    private expiryTimer;
    initialize(): void;
    private addAdapter;
    startAll(): Promise<void>;
    stopAll(): Promise<void>;
    enableAdapter(name: string): Promise<boolean>;
    disableAdapter(name: string): Promise<boolean>;
    private handleEvent;
    private expireOldEvents;
    getActiveEvents(): NormalizedEvent[];
    getRecentEvents(limitMs?: number): NormalizedEvent[];
    getAllEvents(): NormalizedEvent[];
    getAdapterStatuses(): AdapterStatus[];
}
//# sourceMappingURL=index.d.ts.map