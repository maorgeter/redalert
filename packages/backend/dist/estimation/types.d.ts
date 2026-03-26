import type { Feature, Polygon, MultiPolygon } from 'geojson';
export interface EstimatedZone {
    id: string;
    /** The main estimated polygon (union + buffer) */
    geometry: Feature<Polygon | MultiPolygon>;
    /** Larger uncertainty envelope polygon */
    uncertaintyGeometry: Feature<Polygon | MultiPolygon> | null;
    /** IDs of source geofences included in this zone */
    sourceGeofenceIds: string[];
    /** Human-readable area names that contributed to this zone */
    affectedAreas: string[];
    /** 0–1 confidence score */
    confidence: number;
    /** Timestamp of most recent contributing event */
    lastEventAt: Date;
    /** Wall clock time when this zone was computed */
    computedAt: Date;
    /** How this zone was derived — for transparency */
    explanation: ZoneExplanation;
    /** Estimated movement vector if trend is detectable */
    trend: MovementTrend | null;
}
export interface ZoneExplanation {
    method: 'buffered_union' | 'single_buffered' | 'trend_weighted';
    activeEventCount: number;
    bufferKm: number;
    unionedAreaCount: number;
    trendDetected: boolean;
    notes: string[];
}
export interface MovementTrend {
    /** Bearing in degrees (0 = north, 90 = east) */
    bearing: number;
    /** Estimated speed in km/min (from event sequence timing) */
    speedKmPerMin: number;
    /** How many events were used to compute this trend */
    evidenceCount: number;
    /** 0–1 confidence in the trend estimate */
    confidence: number;
}
export interface ZoneComputationInput {
    activeEventCount: number;
    geofenceCount: number;
    bufferKm: number;
}
//# sourceMappingURL=types.d.ts.map