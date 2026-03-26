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
exports.unionPolygons = unionPolygons;
exports.simplifyPolygon = simplifyPolygon;
const turf = __importStar(require("@turf/turf"));
/**
 * Union an array of polygons into a single polygon/multipolygon.
 * Falls back gracefully for edge cases.
 */
function unionPolygons(polygons) {
    if (polygons.length === 0)
        return null;
    if (polygons.length === 1)
        return polygons[0];
    let result = polygons[0];
    for (let i = 1; i < polygons.length; i++) {
        try {
            const merged = turf.union(result, polygons[i]);
            if (merged)
                result = merged;
        }
        catch {
            // If union fails (e.g., invalid geometry), continue with existing result
        }
    }
    return result;
}
/**
 * Simplify a polygon for performance.
 * tolerance is in degrees (~0.001° ≈ 111m).
 */
function simplifyPolygon(polygon, tolerance = 0.001) {
    try {
        return turf.simplify(polygon, { tolerance, highQuality: false });
    }
    catch {
        return polygon;
    }
}
//# sourceMappingURL=union.js.map