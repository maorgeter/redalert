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
exports.SpatialIndex = void 0;
const turf = __importStar(require("@turf/turf"));
/**
 * In-memory spatial index for geofence lookups.
 * Supports lookup by:
 *  - exact ID
 *  - area name (case-insensitive, partial match)
 *  - point containment
 */
class SpatialIndex {
    constructor() {
        this.byId = new Map();
        this.byName = new Map(); // lowercase name → feature
        this.all = [];
    }
    build(collection) {
        this.byId.clear();
        this.byName.clear();
        this.all = [];
        for (const feature of collection.features) {
            const id = feature.properties?.id;
            const name = feature.properties?.name;
            const nameHe = feature.properties?.nameHe;
            if (id)
                this.byId.set(id, feature);
            if (name)
                this.byName.set(name.toLowerCase(), feature);
            if (nameHe)
                this.byName.set(nameHe, feature);
            this.all.push(feature);
        }
    }
    getById(id) {
        return this.byId.get(id);
    }
    /**
     * Resolve an area name to its geofence.
     * Tries: exact → suffix-strip → prefix-match → partial → fuzzy.
     *
     * OREF returns district-level Hebrew names (e.g. "תל אביב - מרכז העיר")
     * while geofences use city names (e.g. "תל אביב - יפו").  The prefix-match
     * step handles this by comparing the first segment before the " - " separator.
     */
    resolveByName(areaName) {
        const lower = areaName.toLowerCase().trim();
        // 1. Exact
        const exact = this.byName.get(lower);
        if (exact)
            return exact;
        // 2. Strip common directional/area suffixes
        const stripped = lower.replace(/\s*[-–]\s*(center|north|south|east|west|צפון|דרום|מרכז|מזרח|מערב|עיר|כרמל|נמל|נשר|חוף|שפלה)\s*$/i, '').trim();
        if (stripped !== lower) {
            const strippedMatch = this.byName.get(stripped);
            if (strippedMatch)
                return strippedMatch;
        }
        // 3. Prefix match: compare first segment before " - "
        //    e.g. "תל אביב - מרכז העיר" → prefix "תל אביב" matches "תל אביב - יפו"
        const areaPrefix = lower.split(/\s*[-–]\s+/)[0].trim();
        if (areaPrefix && areaPrefix !== lower && areaPrefix.length >= 3) {
            for (const [key, feature] of this.byName.entries()) {
                const keyPrefix = key.split(/\s*[-–]\s+/)[0].trim();
                if (areaPrefix === keyPrefix)
                    return feature;
            }
        }
        // 4. Partial: check if any key starts with the area name or vice-versa
        for (const [key, feature] of this.byName.entries()) {
            if (key.startsWith(lower) || lower.startsWith(key))
                return feature;
        }
        // 5. Fuzzy: check if any key contains the area name or vice-versa
        for (const [key, feature] of this.byName.entries()) {
            if (key.includes(lower) || lower.includes(key))
                return feature;
        }
        return undefined;
    }
    /**
     * Find all geofences that contain the given [lng, lat] point.
     */
    findContaining(lng, lat) {
        const pt = turf.point([lng, lat]);
        return this.all.filter((f) => {
            try {
                return turf.booleanPointInPolygon(pt, f);
            }
            catch {
                return false;
            }
        });
    }
    getAll() {
        return this.all;
    }
    get size() {
        return this.all.length;
    }
}
exports.SpatialIndex = SpatialIndex;
//# sourceMappingURL=spatial-index.js.map