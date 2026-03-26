import type { GeofenceCollection, GeofenceFeature } from './loader';
/**
 * In-memory spatial index for geofence lookups.
 * Supports lookup by:
 *  - exact ID
 *  - area name (case-insensitive, partial match)
 *  - point containment
 */
export declare class SpatialIndex {
    private byId;
    private byName;
    private all;
    build(collection: GeofenceCollection): void;
    getById(id: string): GeofenceFeature | undefined;
    /**
     * Resolve an area name to its geofence.
     * Tries: exact → suffix-strip → prefix-match → partial → fuzzy.
     *
     * OREF returns district-level Hebrew names (e.g. "תל אביב - מרכז העיר")
     * while geofences use city names (e.g. "תל אביב - יפו").  The prefix-match
     * step handles this by comparing the first segment before the " - " separator.
     */
    resolveByName(areaName: string): GeofenceFeature | undefined;
    /**
     * Find all geofences that contain the given [lng, lat] point.
     */
    findContaining(lng: number, lat: number): GeofenceFeature[];
    getAll(): GeofenceFeature[];
    get size(): number;
}
//# sourceMappingURL=spatial-index.d.ts.map