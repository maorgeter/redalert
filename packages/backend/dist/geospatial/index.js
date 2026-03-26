"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpatialIndex = exports.loadGeofences = exports.geofenceIndex = void 0;
exports.initGeospatial = initGeospatial;
const loader_1 = require("./loader");
Object.defineProperty(exports, "loadGeofences", { enumerable: true, get: function () { return loader_1.loadGeofences; } });
const spatial_index_1 = require("./spatial-index");
Object.defineProperty(exports, "SpatialIndex", { enumerable: true, get: function () { return spatial_index_1.SpatialIndex; } });
const config_1 = require("../config");
exports.geofenceIndex = new spatial_index_1.SpatialIndex();
function initGeospatial() {
    const collection = (0, loader_1.loadGeofences)(config_1.config.geofencesPath);
    exports.geofenceIndex.build(collection);
}
//# sourceMappingURL=index.js.map