import { z } from 'zod';
export declare enum AlertSeverity {
    LOW = "LOW",
    MEDIUM = "MEDIUM",
    HIGH = "HIGH",
    CRITICAL = "CRITICAL"
}
export declare enum AlertStatus {
    ACTIVE = "ACTIVE",
    EXPIRED = "EXPIRED",
    CANCELLED = "CANCELLED"
}
/**
 * Hebrew alert type taxonomy used by Pikud HaOref (Home Front Command):
 *  - RED_ALERT  → "צבע אדום"   – immediate shelter required (rockets, missiles, hostile aircraft)
 *  - WARNING    → "התרעה"      – other threats (infiltration, chemical, etc.)
 *  - ALL_CLEAR  → "יציאה מהמקלט" – threat ended, can exit shelter
 */
export declare enum AlertType {
    RED_ALERT = "red_alert",
    WARNING = "warning",
    ALL_CLEAR = "all_clear"
}
export declare enum AreaType {
    CITY = "CITY",
    REGION = "REGION",
    DISTRICT = "DISTRICT",
    ZONE = "ZONE"
}
export declare enum AlertCategory {
    ROCKETS = "rockets",
    MISSILE = "missile",
    HOSTILE_AIRCRAFT = "hostile_aircraft",
    INFILTRATION = "infiltration",
    EARTHQUAKE = "earthquake",
    RADIATION = "radiation",
    TSUNAMI = "tsunami",
    CHEMICAL = "chemical",
    UNKNOWN = "unknown"
}
export declare const NormalizedEventSchema: z.ZodObject<{
    id: z.ZodString;
    source: z.ZodString;
    /** All sources that have reported this alert (cross-source provenance tracking) */
    provenance: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    timestamp: z.ZodDate;
    areaName: z.ZodString;
    areaType: z.ZodNativeEnum<typeof AreaType>;
    cityNames: z.ZodArray<z.ZodString, "many">;
    geofenceId: z.ZodOptional<z.ZodString>;
    rawPayload: z.ZodUnknown;
    receivedAt: z.ZodDate;
    updatedAt: z.ZodDate;
    severity: z.ZodNativeEnum<typeof AlertSeverity>;
    confidence: z.ZodNumber;
    status: z.ZodNativeEnum<typeof AlertStatus>;
    category: z.ZodNativeEnum<typeof AlertCategory>;
    alertType: z.ZodDefault<z.ZodNativeEnum<typeof AlertType>>;
    ttlSeconds: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    id: string;
    source: string;
    status: AlertStatus;
    provenance: string[];
    timestamp: Date;
    areaName: string;
    areaType: AreaType;
    cityNames: string[];
    receivedAt: Date;
    updatedAt: Date;
    severity: AlertSeverity;
    confidence: number;
    category: AlertCategory;
    alertType: AlertType;
    ttlSeconds: number;
    geofenceId?: string | undefined;
    rawPayload?: unknown;
}, {
    id: string;
    source: string;
    status: AlertStatus;
    timestamp: Date;
    areaName: string;
    areaType: AreaType;
    cityNames: string[];
    receivedAt: Date;
    updatedAt: Date;
    severity: AlertSeverity;
    confidence: number;
    category: AlertCategory;
    provenance?: string[] | undefined;
    geofenceId?: string | undefined;
    rawPayload?: unknown;
    alertType?: AlertType | undefined;
    ttlSeconds?: number | undefined;
}>;
export type NormalizedEvent = z.infer<typeof NormalizedEventSchema>;
/** Wire format sent over WebSocket and REST */
export interface NormalizedEventDTO {
    id: string;
    source: string;
    provenance: string[];
    timestamp: string;
    areaName: string;
    areaType: string;
    cityNames: string[];
    geofenceId?: string;
    receivedAt: string;
    updatedAt: string;
    severity: AlertSeverity;
    confidence: number;
    status: AlertStatus;
    category: AlertCategory;
    alertType: AlertType;
    ttlSeconds: number;
}
export declare function toDTO(event: NormalizedEvent): NormalizedEventDTO;
export declare const OREF_CATEGORY_MAP: Record<number, AlertCategory>;
export declare const CATEGORY_SEVERITY: Record<AlertCategory, AlertSeverity>;
/** Map alert category to the UI-visible alert type */
export declare const CATEGORY_ALERT_TYPE: Record<AlertCategory, AlertType>;
/**
 * Derive AlertType from the OREF raw title and category.
 * The title field contains the Hebrew alert name sent by Pikud HaOref.
 */
export declare function alertTypeFromOrefTitle(title: string, category: AlertCategory): AlertType;
//# sourceMappingURL=schema.d.ts.map