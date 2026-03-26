"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngestionManager = void 0;
const events_1 = require("events");
const mock_1 = require("./adapters/mock");
const oref_1 = require("./adapters/oref");
const deduplication_1 = require("./deduplication");
const schema_1 = require("../normalization/schema");
const geospatial_1 = require("../geospatial");
const config_1 = require("../config");
const logger_1 = require("../logger");
class IngestionManager extends events_1.EventEmitter {
    constructor() {
        super(...arguments);
        this.adapters = [];
        this.dedup = new deduplication_1.DeduplicationCache(30000);
        this.eventStore = [];
        this.expiryTimer = null;
    }
    initialize() {
        if (config_1.config.ingestion.mockEnabled) {
            this.addAdapter(new mock_1.MockIngestionAdapter());
        }
        if (config_1.config.ingestion.orefEnabled) {
            this.addAdapter(new oref_1.OrefIngestionAdapter());
        }
        if (this.adapters.length === 0) {
            logger_1.logger.warn('No ingestion adapters configured — no live data will flow');
        }
        // Expire old events periodically
        this.expiryTimer = setInterval(() => this.expireOldEvents(), 15000);
        this.expiryTimer.unref();
    }
    addAdapter(adapter) {
        adapter.on('event', (event) => this.handleEvent(event));
        adapter.on('error', (err) => {
            logger_1.logger.error({ adapter: adapter.name, err: err.message }, 'Ingestion adapter error');
        });
        this.adapters.push(adapter);
    }
    async startAll() {
        await Promise.all(this.adapters.map((a) => a.start()));
        logger_1.logger.info({ adapters: this.adapters.map((a) => a.name) }, 'All adapters started');
    }
    async stopAll() {
        if (this.expiryTimer)
            clearInterval(this.expiryTimer);
        await Promise.all(this.adapters.map((a) => a.stop()));
    }
    async enableAdapter(name) {
        const adapter = this.adapters.find((a) => a.name === name);
        if (!adapter)
            return false;
        await adapter.start();
        logger_1.logger.info({ adapter: name }, 'Adapter enabled via API');
        return true;
    }
    async disableAdapter(name) {
        const adapter = this.adapters.find((a) => a.name === name);
        if (!adapter)
            return false;
        await adapter.stop();
        logger_1.logger.info({ adapter: name }, 'Adapter disabled via API');
        return true;
    }
    handleEvent(event) {
        // Initialize provenance with the reporting source
        if (!event.provenance || event.provenance.length === 0) {
            event.provenance = [event.source];
        }
        // Resolve geofenceId from spatial index if not already set
        // This is critical: OREF sends Hebrew area names; the spatial index maps them to geofence IDs
        if (!event.geofenceId) {
            const resolved = geospatial_1.geofenceIndex.resolveByName(event.areaName);
            if (resolved?.properties?.id) {
                event.geofenceId = resolved.properties.id;
                logger_1.logger.debug({ areaName: event.areaName, geofenceId: event.geofenceId }, 'Geofence resolved for area');
            }
            else {
                logger_1.logger.warn({ areaName: event.areaName, source: event.source }, 'No geofence match for area name — alert will not render as polygon on map');
            }
        }
        const result = this.dedup.check(event);
        if (result.action === 'drop') {
            logger_1.logger.debug({ id: event.id, area: event.areaName, src: event.source }, 'Duplicate event dropped');
            return;
        }
        if (result.action === 'merge') {
            // Another source confirmed the same alert — add to provenance of canonical event
            const canonical = this.eventStore.find((e) => e.id === result.canonicalId);
            if (canonical) {
                if (!canonical.provenance.includes(event.source)) {
                    canonical.provenance.push(event.source);
                    // Boost confidence slightly for multi-source confirmation
                    canonical.confidence = Math.min(1, canonical.confidence + 0.1);
                    canonical.updatedAt = new Date();
                    logger_1.logger.info({ canonicalId: canonical.id, newSource: event.source, provenance: canonical.provenance }, 'Cross-source alert confirmation — provenance updated');
                    this.emit('event', canonical);
                }
            }
            return;
        }
        // New event
        this.eventStore.push(event);
        if (this.eventStore.length > 200)
            this.eventStore.shift();
        logger_1.logger.info({ id: event.id, area: event.areaName, src: event.source }, 'New alert event');
        this.emit('event', event);
    }
    expireOldEvents() {
        const now = Date.now();
        let expired = 0;
        for (const event of this.eventStore) {
            if (event.status === schema_1.AlertStatus.ACTIVE) {
                const age = now - event.timestamp.getTime();
                if (age > event.ttlSeconds * 1000) {
                    event.status = schema_1.AlertStatus.EXPIRED;
                    event.updatedAt = new Date();
                    expired++;
                    this.emit('event:expired', event);
                }
            }
        }
        if (expired > 0) {
            logger_1.logger.debug({ expired }, 'Events expired');
            this.emit('events:changed');
        }
    }
    getActiveEvents() {
        return this.eventStore.filter((e) => e.status === schema_1.AlertStatus.ACTIVE);
    }
    getRecentEvents(limitMs = 300000) {
        const cutoff = Date.now() - limitMs;
        return this.eventStore.filter((e) => e.receivedAt.getTime() > cutoff);
    }
    getAllEvents() {
        return [...this.eventStore];
    }
    getAdapterStatuses() {
        return this.adapters.map((a) => a.getStatus());
    }
}
exports.IngestionManager = IngestionManager;
//# sourceMappingURL=index.js.map