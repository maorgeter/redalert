import type { Feature, Polygon, MultiPolygon } from 'geojson';
/**
 * Buffer a polygon outward by the given distance in kilometers.
 * Returns the original if buffering fails.
 */
export declare function bufferPolygon(polygon: Feature<Polygon | MultiPolygon>, distanceKm: number): Feature<Polygon | MultiPolygon>;
/**
 * Apply directional weighting to a buffer.
 * Extends the polygon more in the direction of movement than perpendicular.
 *
 * Implementation: we buffer asymmetrically by translating the polygon
 * in the trend direction before buffering, creating an elongated zone.
 */
export declare function directionalBuffer(polygon: Feature<Polygon | MultiPolygon>, bearingDeg: number, baseKm: number, extendKm: number): Feature<Polygon | MultiPolygon>;
//# sourceMappingURL=buffer.d.ts.map