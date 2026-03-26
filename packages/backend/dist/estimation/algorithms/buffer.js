"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.bufferPolygon = bufferPolygon;
exports.directionalBuffer = directionalBuffer;
const turf = __importStar(require("@turf/turf"));
/**
 * Buffer a polygon outward by the given distance in kilometers.
 * Returns the original if buffering fails.
 */
function bufferPolygon(polygon, distanceKm) {
    try {
        const buffered = turf.buffer(polygon, distanceKm, { units: 'kilometers' });
        if (buffered)
            return buffered;
    }
    catch {
        // Buffer can fail on degenerate geometries
    }
    return polygon;
}
/**
 * Apply directional weighting to a buffer.
 * Extends the polygon more in the direction of movement than perpendicular.
 *
 * Implementation: we buffer asymmetrically by translating the polygon
 * in the trend direction before buffering, creating an elongated zone.
 */
function directionalBuffer(polygon, bearingDeg, baseKm, extendKm) {
    try {
        const center = turf.centroid(polygon);
        // Move centroid toward the trend direction
        const shifted = turf.destination(center, extendKm * 0.5, bearingDeg, {
            units: 'kilometers',
        });
        // Create a convex hull over the original + shifted polygon
        const combined = turf.featureCollection([
            polygon,
            turf.circle(shifted, extendKm, { units: 'kilometers', steps: 32 }),
        ]);
        const hull = turf.convex(combined);
        if (hull) {
            return bufferPolygon(hull, baseKm * 0.5);
        }
    }
    catch {
        // Fall back to simple buffer
    }
    return bufferPolygon(polygon, baseKm);
}
//# sourceMappingURL=buffer.js.map