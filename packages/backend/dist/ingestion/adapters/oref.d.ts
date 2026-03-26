import { BaseIngestionAdapter } from './base';
export declare class OrefIngestionAdapter extends BaseIngestionAdapter {
    readonly name = "oref";
    private timer;
    private normalizer;
    private seenIds;
    constructor();
    start(): Promise<void>;
    stop(): Promise<void>;
    private poll;
    private fetchAndEmit;
}
//# sourceMappingURL=oref.d.ts.map