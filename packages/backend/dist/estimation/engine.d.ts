/**
 * Dynamic Estimated Threat Zone Engine
 *
 * DISCLAIMER: All outputs of this engine are ESTIMATED VISUALIZATIONS derived
 * solely from the sequence and timing of publicly available alert events.
 * They do NOT represent actual trajectory predictions, military intelligence,
 * or authoritative threat assessments. Official alert areas are the sole
 * authoritative source. Never rely on this engine for life-safety decisions.
 */
import { EventEmitter } from 'events';
import { NormalizedEvent } from '../normalization/schema';
import type { EstimatedZone } from './types';
export declare class EstimationEngine extends EventEmitter {
    private timer;
    private currentZones;
    private getActiveEvents;
    private getRecentEvents;
    constructor(getActiveEvents: () => NormalizedEvent[], getRecentEvents: () => NormalizedEvent[]);
    start(): void;
    stop(): void;
    getCurrentZones(): EstimatedZone[];
    private recompute;
    private computeZones;
}
//# sourceMappingURL=engine.d.ts.map