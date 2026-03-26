"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseIngestionAdapter = void 0;
const events_1 = require("events");
class BaseIngestionAdapter extends events_1.EventEmitter {
    constructor(updateIntervalMs = 5000, type = 'polling', isPrimary = false, reliabilityScore = 0.8) {
        super();
        this.running = false;
        this.status = {
            name: '',
            type,
            healthy: false,
            enabled: false,
            isPrimary,
            reliabilityScore,
            lastSuccess: null,
            lastError: null,
            eventCount: 0,
            errorCount: 0,
            updateIntervalMs,
        };
    }
    getStatus() {
        return { ...this.status, name: this.name };
    }
    emitEvents(events) {
        events.forEach((e) => this.emit('event', e));
        this.status.eventCount += events.length;
        this.status.lastSuccess = new Date();
        this.status.healthy = true;
    }
    handleError(err) {
        const message = err instanceof Error ? err.message : String(err);
        this.status.lastError = message;
        this.status.errorCount++;
        this.status.healthy = false;
        this.emit('error', new Error(message));
    }
}
exports.BaseIngestionAdapter = BaseIngestionAdapter;
//# sourceMappingURL=base.js.map