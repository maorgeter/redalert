"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeduplicationCache = void 0;
/**
 * In-memory deduplication window with cross-source provenance tracking.
 *
 * Keys on areaName+category (without source) so alerts from multiple sources
 * about the same area are merged rather than duplicated. When the same source
 * re-reports within the window the event is dropped entirely.
 */
class DeduplicationCache {
    constructor(windowMs = 30000) {
        this.cache = new Map();
        this.windowMs = windowMs;
        setInterval(() => this.cleanup(), 60000).unref();
    }
    check(event) {
        const areaKey = `${event.areaName}:${event.category}`;
        const now = Date.now();
        const entry = this.cache.get(areaKey);
        if (!entry || entry.expiresAt <= now) {
            // New alert — record it
            this.cache.set(areaKey, {
                canonicalId: event.id,
                sources: new Set([event.source]),
                expiresAt: now + this.windowMs,
            });
            return { action: 'new' };
        }
        // Same alert within window
        if (entry.sources.has(event.source)) {
            // Same source re-reporting — drop
            return { action: 'drop' };
        }
        // Different source reporting same alert — merge provenance
        entry.sources.add(event.source);
        return { action: 'merge', canonicalId: entry.canonicalId };
    }
    cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (entry.expiresAt <= now)
                this.cache.delete(key);
        }
    }
    get size() {
        return this.cache.size;
    }
}
exports.DeduplicationCache = DeduplicationCache;
//# sourceMappingURL=deduplication.js.map