import type { MovementTrend } from '../types';
import type { NormalizedEvent } from '../../normalization/schema';
import type { GeofenceFeature } from '../../geospatial/loader';
/**
 * Detect a movement trend from a sequence of timed geofence centroids.
 *
 * Requirements:
 * - At least 3 events with resolvable geofences
 * - Events must be within a 10-minute window
 * - Consecutive events must be < 100 km apart (no teleportation)
 *
 * Returns null when evidence is insufficient.
 *
 * IMPORTANT: This is a heuristic visualization aid derived entirely from
 * the sequence and timing of public alert events. It does NOT model actual
 * ballistic trajectories, flight paths, or military intelligence.
 */
export declare function detectMovementTrend(recentEvents: NormalizedEvent[], resolveGeofence: (event: NormalizedEvent) => GeofenceFeature | undefined): MovementTrend | null;
//# sourceMappingURL=trend.d.ts.map