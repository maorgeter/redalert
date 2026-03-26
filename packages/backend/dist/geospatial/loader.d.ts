import type { FeatureCollection, Feature, Polygon, MultiPolygon, GeoJsonProperties } from 'geojson';
export type GeofenceFeature = Feature<Polygon | MultiPolygon, GeoJsonProperties & {
    id: string;
    name: string;
    nameHe?: string;
    region?: string;
}>;
export type GeofenceCollection = FeatureCollection<Polygon | MultiPolygon, GeoJsonProperties>;
export declare function loadGeofences(filePath: string): GeofenceCollection;
//# sourceMappingURL=loader.d.ts.map