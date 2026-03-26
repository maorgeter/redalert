"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerApiRoutes = registerApiRoutes;
const events_1 = require("./routes/events");
const health_1 = require("./routes/health");
const zones_1 = require("./routes/zones");
const config_1 = require("./routes/config");
const sources_1 = require("./routes/sources");
async function registerApiRoutes(app, opts) {
    await (0, health_1.healthRoutes)(app, opts);
    await (0, events_1.eventsRoutes)(app, opts);
    await (0, zones_1.zonesRoutes)(app, opts);
    await (0, config_1.configRoutes)(app);
    await (0, sources_1.sourcesRoutes)(app, opts);
}
//# sourceMappingURL=index.js.map