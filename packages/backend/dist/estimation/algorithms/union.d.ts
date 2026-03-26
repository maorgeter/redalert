import type { Feature, Polygon, MultiPolygon } from 'geojson';
/**
 * Union an array of polygons into a single polygon/multipolygon.
 * Falls back gracefully for edge cases.
 */
export declare function unionPolygons(polygons: Feature<Polygon | MultiPolygon>[]): Feature<Polygon | MultiPolygon> | null;
/**
 * Simplify a polygon for performance.
 * tolerance is in degrees (~0.001° ≈ 111m).
 */
export declare function simplifyPolygon(polygon: Feature<Polygon | MultiPolygon>, tolerance?: number): Feature<Polygon | MultiPolygon>;
//# sourceMappingURL=union.d.ts.map