import { AlertCategory, NormalizedEvent } from './schema';
export interface OrefRawAlert {
    id: string;
    cat: string;
    title: string;
    data: string[];
    desc: string;
}
export interface MockRawAlert {
    id?: string;
    areaName: string;
    cityNames?: string[];
    category: AlertCategory;
    timestamp?: string;
    geofenceId?: string;
}
export declare class Normalizer {
    normalizeOref(raw: OrefRawAlert): NormalizedEvent;
    /**
     * When OREF returns multiple areas in a single alert, split into individual
     * events (one per area) to allow per-polygon mapping.
     */
    normalizeOrefMultiArea(raw: OrefRawAlert): NormalizedEvent[];
    normalizeMock(raw: MockRawAlert): NormalizedEvent;
    /** Mark an event as expired */
    expire(event: NormalizedEvent): NormalizedEvent;
    /** Raise severity based on multiple simultaneous nearby events */
    escalateSeverity(event: NormalizedEvent, activeNearbyCount: number): NormalizedEvent;
}
//# sourceMappingURL=normalizer.d.ts.map