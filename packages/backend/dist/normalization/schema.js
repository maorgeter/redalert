"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CATEGORY_ALERT_TYPE = exports.CATEGORY_SEVERITY = exports.OREF_CATEGORY_MAP = exports.NormalizedEventSchema = exports.AlertCategory = exports.AreaType = exports.AlertType = exports.AlertStatus = exports.AlertSeverity = void 0;
exports.toDTO = toDTO;
exports.alertTypeFromOrefTitle = alertTypeFromOrefTitle;
const zod_1 = require("zod");
var AlertSeverity;
(function (AlertSeverity) {
    AlertSeverity["LOW"] = "LOW";
    AlertSeverity["MEDIUM"] = "MEDIUM";
    AlertSeverity["HIGH"] = "HIGH";
    AlertSeverity["CRITICAL"] = "CRITICAL";
})(AlertSeverity || (exports.AlertSeverity = AlertSeverity = {}));
var AlertStatus;
(function (AlertStatus) {
    AlertStatus["ACTIVE"] = "ACTIVE";
    AlertStatus["EXPIRED"] = "EXPIRED";
    AlertStatus["CANCELLED"] = "CANCELLED";
})(AlertStatus || (exports.AlertStatus = AlertStatus = {}));
/**
 * Hebrew alert type taxonomy used by Pikud HaOref (Home Front Command):
 *  - RED_ALERT  → "צבע אדום"   – immediate shelter required (rockets, missiles, hostile aircraft)
 *  - WARNING    → "התרעה"      – other threats (infiltration, chemical, etc.)
 *  - ALL_CLEAR  → "יציאה מהמקלט" – threat ended, can exit shelter
 */
var AlertType;
(function (AlertType) {
    AlertType["RED_ALERT"] = "red_alert";
    AlertType["WARNING"] = "warning";
    AlertType["ALL_CLEAR"] = "all_clear";
})(AlertType || (exports.AlertType = AlertType = {}));
var AreaType;
(function (AreaType) {
    AreaType["CITY"] = "CITY";
    AreaType["REGION"] = "REGION";
    AreaType["DISTRICT"] = "DISTRICT";
    AreaType["ZONE"] = "ZONE";
})(AreaType || (exports.AreaType = AreaType = {}));
var AlertCategory;
(function (AlertCategory) {
    AlertCategory["ROCKETS"] = "rockets";
    AlertCategory["MISSILE"] = "missile";
    AlertCategory["HOSTILE_AIRCRAFT"] = "hostile_aircraft";
    AlertCategory["INFILTRATION"] = "infiltration";
    AlertCategory["EARTHQUAKE"] = "earthquake";
    AlertCategory["RADIATION"] = "radiation";
    AlertCategory["TSUNAMI"] = "tsunami";
    AlertCategory["CHEMICAL"] = "chemical";
    AlertCategory["UNKNOWN"] = "unknown";
})(AlertCategory || (exports.AlertCategory = AlertCategory = {}));
exports.NormalizedEventSchema = zod_1.z.object({
    id: zod_1.z.string(),
    source: zod_1.z.string(),
    /** All sources that have reported this alert (cross-source provenance tracking) */
    provenance: zod_1.z.array(zod_1.z.string()).default([]),
    timestamp: zod_1.z.date(),
    areaName: zod_1.z.string(),
    areaType: zod_1.z.nativeEnum(AreaType),
    cityNames: zod_1.z.array(zod_1.z.string()),
    geofenceId: zod_1.z.string().optional(),
    rawPayload: zod_1.z.unknown(),
    receivedAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
    severity: zod_1.z.nativeEnum(AlertSeverity),
    confidence: zod_1.z.number().min(0).max(1),
    status: zod_1.z.nativeEnum(AlertStatus),
    category: zod_1.z.nativeEnum(AlertCategory),
    alertType: zod_1.z.nativeEnum(AlertType).default(AlertType.WARNING),
    ttlSeconds: zod_1.z.number().default(300),
});
function toDTO(event) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { rawPayload, ...rest } = event;
    return {
        ...rest,
        timestamp: event.timestamp.toISOString(),
        receivedAt: event.receivedAt.toISOString(),
        updatedAt: event.updatedAt.toISOString(),
        provenance: event.provenance ?? [event.source],
        alertType: event.alertType ?? AlertType.WARNING,
    };
}
// Alert category mapping from OREF category codes
exports.OREF_CATEGORY_MAP = {
    1: AlertCategory.ROCKETS,
    2: AlertCategory.HOSTILE_AIRCRAFT,
    3: AlertCategory.EARTHQUAKE,
    4: AlertCategory.RADIATION,
    5: AlertCategory.INFILTRATION,
    7: AlertCategory.TSUNAMI,
    13: AlertCategory.MISSILE,
    101: AlertCategory.CHEMICAL,
};
exports.CATEGORY_SEVERITY = {
    [AlertCategory.ROCKETS]: AlertSeverity.HIGH,
    [AlertCategory.MISSILE]: AlertSeverity.CRITICAL,
    [AlertCategory.HOSTILE_AIRCRAFT]: AlertSeverity.CRITICAL,
    [AlertCategory.INFILTRATION]: AlertSeverity.CRITICAL,
    [AlertCategory.EARTHQUAKE]: AlertSeverity.HIGH,
    [AlertCategory.RADIATION]: AlertSeverity.HIGH,
    [AlertCategory.TSUNAMI]: AlertSeverity.CRITICAL,
    [AlertCategory.CHEMICAL]: AlertSeverity.HIGH,
    [AlertCategory.UNKNOWN]: AlertSeverity.MEDIUM,
};
/** Map alert category to the UI-visible alert type */
exports.CATEGORY_ALERT_TYPE = {
    [AlertCategory.ROCKETS]: AlertType.RED_ALERT,
    [AlertCategory.MISSILE]: AlertType.RED_ALERT,
    [AlertCategory.HOSTILE_AIRCRAFT]: AlertType.RED_ALERT,
    [AlertCategory.INFILTRATION]: AlertType.WARNING,
    [AlertCategory.EARTHQUAKE]: AlertType.WARNING,
    [AlertCategory.RADIATION]: AlertType.WARNING,
    [AlertCategory.TSUNAMI]: AlertType.WARNING,
    [AlertCategory.CHEMICAL]: AlertType.WARNING,
    [AlertCategory.UNKNOWN]: AlertType.WARNING,
};
/**
 * Derive AlertType from the OREF raw title and category.
 * The title field contains the Hebrew alert name sent by Pikud HaOref.
 */
function alertTypeFromOrefTitle(title, category) {
    // All-clear messages contain these phrases
    if (title.includes('יציאה מהמקלט') ||
        title.includes('ביטול התרעה') ||
        title.includes('ניתן לצאת') ||
        title.includes('all clear')) {
        return AlertType.ALL_CLEAR;
    }
    return exports.CATEGORY_ALERT_TYPE[category] ?? AlertType.WARNING;
}
//# sourceMappingURL=schema.js.map