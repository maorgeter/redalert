"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Normalizer = void 0;
const uuid_1 = require("uuid");
const schema_1 = require("./schema");
class Normalizer {
    normalizeOref(raw) {
        const catCode = parseInt(raw.cat, 10);
        const category = schema_1.OREF_CATEGORY_MAP[catCode] ?? schema_1.AlertCategory.ROCKETS;
        const alertType = (0, schema_1.alertTypeFromOrefTitle)(raw.title ?? '', category);
        const now = new Date();
        return {
            id: raw.id || (0, uuid_1.v4)(),
            source: 'oref',
            provenance: ['oref'],
            timestamp: now,
            areaName: raw.data[0] ?? 'Unknown',
            areaType: schema_1.AreaType.ZONE,
            cityNames: raw.data,
            rawPayload: raw,
            receivedAt: now,
            updatedAt: now,
            severity: schema_1.CATEGORY_SEVERITY[category],
            confidence: 1.0,
            status: alertType === schema_1.AlertType.ALL_CLEAR ? schema_1.AlertStatus.EXPIRED : schema_1.AlertStatus.ACTIVE,
            category,
            alertType,
            ttlSeconds: alertType === schema_1.AlertType.ALL_CLEAR ? 30 : 300,
        };
    }
    /**
     * When OREF returns multiple areas in a single alert, split into individual
     * events (one per area) to allow per-polygon mapping.
     */
    normalizeOrefMultiArea(raw) {
        if (raw.data.length === 0)
            return [];
        const baseId = raw.id || (0, uuid_1.v4)();
        const catCode = parseInt(raw.cat, 10);
        const category = schema_1.OREF_CATEGORY_MAP[catCode] ?? schema_1.AlertCategory.ROCKETS;
        const alertType = (0, schema_1.alertTypeFromOrefTitle)(raw.title ?? '', category);
        const now = new Date();
        return raw.data.map((areaName, i) => ({
            id: raw.data.length === 1 ? baseId : `${baseId}-${i}`,
            source: 'oref',
            provenance: ['oref'],
            timestamp: now,
            areaName,
            areaType: schema_1.AreaType.ZONE,
            cityNames: [areaName],
            rawPayload: raw,
            receivedAt: now,
            updatedAt: now,
            severity: schema_1.CATEGORY_SEVERITY[category],
            confidence: 1.0,
            status: alertType === schema_1.AlertType.ALL_CLEAR ? schema_1.AlertStatus.EXPIRED : schema_1.AlertStatus.ACTIVE,
            category,
            alertType,
            ttlSeconds: alertType === schema_1.AlertType.ALL_CLEAR ? 30 : 300,
        }));
    }
    normalizeMock(raw) {
        const now = new Date();
        const category = raw.category ?? schema_1.AlertCategory.ROCKETS;
        return {
            id: raw.id ?? (0, uuid_1.v4)(),
            source: 'mock',
            provenance: ['simulation'],
            timestamp: raw.timestamp ? new Date(raw.timestamp) : now,
            areaName: raw.areaName,
            areaType: schema_1.AreaType.ZONE,
            cityNames: raw.cityNames ?? [raw.areaName],
            geofenceId: raw.geofenceId,
            rawPayload: raw,
            receivedAt: now,
            updatedAt: now,
            severity: schema_1.CATEGORY_SEVERITY[category],
            confidence: 0.9,
            status: schema_1.AlertStatus.ACTIVE,
            category,
            alertType: schema_1.CATEGORY_ALERT_TYPE[category] ?? schema_1.AlertType.WARNING,
            ttlSeconds: 300,
        };
    }
    /** Mark an event as expired */
    expire(event) {
        return {
            ...event,
            status: schema_1.AlertStatus.EXPIRED,
            updatedAt: new Date(),
        };
    }
    /** Raise severity based on multiple simultaneous nearby events */
    escalateSeverity(event, activeNearbyCount) {
        if (activeNearbyCount < 3)
            return event;
        const escalated = {
            [schema_1.AlertSeverity.LOW]: schema_1.AlertSeverity.MEDIUM,
            [schema_1.AlertSeverity.MEDIUM]: schema_1.AlertSeverity.HIGH,
            [schema_1.AlertSeverity.HIGH]: schema_1.AlertSeverity.CRITICAL,
            [schema_1.AlertSeverity.CRITICAL]: schema_1.AlertSeverity.CRITICAL,
        };
        return { ...event, severity: escalated[event.severity] };
    }
}
exports.Normalizer = Normalizer;
//# sourceMappingURL=normalizer.js.map