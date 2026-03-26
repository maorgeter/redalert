"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EstimationEngine = void 0;
/**
 * Dynamic Estimated Threat Zone Engine
 *
 * DISCLAIMER: All outputs of this engine are ESTIMATED VISUALIZATIONS derived
 * solely from the sequence and timing of publicly available alert events.
 * They do NOT represent actual trajectory predictions, military intelligence,
 * or authoritative threat assessments. Official alert areas are the sole
 * authoritative source. Never rely on this engine for life-safety decisions.
 */
const events_1 = require("events");
const uuid_1 = require("uuid");
const geospatial_1 = require("../geospatial");
const config_1 = require("../config");
const logger_1 = require("../logger");
const union_1 = require("./algorithms/union");
const buffer_1 = require("./algorithms/buffer");
const decay_1 = require("./algorithms/decay");
const trend_1 = require("./algorithms/trend");
class EstimationEngine extends events_1.EventEmitter {
    constructor(getActiveEvents, getRecentEvents) {
        super();
        this.timer = null;
        this.currentZones = [];
        this.getActiveEvents = getActiveEvents;
        this.getRecentEvents = getRecentEvents;
    }
    start() {
        this.timer = setInterval(() => this.recompute(), config_1.config.estimation.recomputeIntervalMs);
        logger_1.logger.info('Estimation engine started');
    }
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    getCurrentZones() {
        return this.currentZones;
    }
    recompute() {
        try {
            const zones = this.computeZones();
            this.currentZones = zones;
            this.emit('zones', zones);
        }
        catch (err) {
            logger_1.logger.error({ err }, 'Estimation engine error during recompute');
        }
    }
    computeZones() {
        const activeEvents = this.getActiveEvents();
        if (activeEvents.length === 0)
            return [];
        // Resolve each active event to its geofence polygon
        const resolved = [];
        for (const event of activeEvents) {
            let gf = event.geofenceId ? geospatial_1.geofenceIndex.getById(event.geofenceId) : undefined;
            if (!gf)
                gf = geospatial_1.geofenceIndex.resolveByName(event.areaName);
            if (!gf)
                continue;
            resolved.push({
                event,
                polygon: gf,
            });
        }
        if (resolved.length === 0)
            return [];
        const polygons = resolved.map((r) => r.polygon);
        const events = resolved.map((r) => r.event);
        // ── Step 1: Union all active geofences ──────────────────────────────────
        const unioned = (0, union_1.unionPolygons)(polygons);
        if (!unioned)
            return [];
        // ── Step 2: Detect movement trend ────────────────────────────────────────
        const recentEvents = this.getRecentEvents();
        const trend = (0, trend_1.detectMovementTrend)(recentEvents, (event) => {
            const gf = event.geofenceId
                ? geospatial_1.geofenceIndex.getById(event.geofenceId)
                : geospatial_1.geofenceIndex.resolveByName(event.areaName);
            return gf;
        });
        // ── Step 3: Buffer (directional if trend detected) ───────────────────────
        const bufferKm = config_1.config.estimation.bufferKm;
        let buffered;
        const notes = [];
        let method = 'buffered_union';
        if (trend && trend.confidence >= 0.5) {
            method = 'trend_weighted';
            buffered = (0, buffer_1.directionalBuffer)(unioned, trend.bearing, bufferKm, bufferKm * 1.5);
            notes.push(`Movement trend detected: bearing ${trend.bearing.toFixed(0)}°, ` +
                `${trend.speedKmPerMin.toFixed(1)} km/min (${trend.evidenceCount} events, ` +
                `confidence ${(trend.confidence * 100).toFixed(0)}%)`);
        }
        else {
            if (resolved.length === 1)
                method = 'single_buffered';
            buffered = (0, buffer_1.bufferPolygon)(unioned, bufferKm);
            notes.push(`Uniform ${bufferKm}km buffer applied around ${resolved.length} active area(s)`);
        }
        // ── Step 4: Simplify for performance ─────────────────────────────────────
        const simplified = (0, union_1.simplifyPolygon)(buffered);
        // ── Step 5: Uncertainty envelope (larger outer buffer) ───────────────────
        let uncertaintyGeometry = null;
        try {
            uncertaintyGeometry = (0, union_1.simplifyPolygon)((0, buffer_1.bufferPolygon)(simplified, bufferKm * config_1.config.estimation.uncertaintyMultiplier));
        }
        catch {
            // Non-critical — omit uncertainty envelope if it fails
        }
        // ── Step 6: Compute confidence ────────────────────────────────────────────
        const now = Date.now();
        const mostRecentAge = now - Math.max(...events.map((e) => e.timestamp.getTime()));
        let confidence = (0, decay_1.computeZoneConfidence)(mostRecentAge, resolved.length, config_1.config.estimation.decayMs);
        // Multi-source confirmation boost: events with >1 source in provenance increase confidence
        const multiSourceCount = events.filter((e) => (e.provenance?.length ?? 1) > 1).length;
        if (multiSourceCount > 0) {
            const boost = Math.min(0.15, multiSourceCount * 0.05);
            confidence = Math.min(1, confidence + boost);
            notes.push(`Multi-source confirmation: ${multiSourceCount} event(s) corroborated by multiple sources (+${(boost * 100).toFixed(0)}% confidence)`);
        }
        const affectedAreas = [...new Set(events.map((e) => e.areaName))];
        notes.push(`Derived from ${resolved.length} of ${activeEvents.length} active events with resolvable geofences.`, 'ESTIMATED VISUALIZATION ONLY — not an authoritative threat assessment.');
        const zone = {
            id: (0, uuid_1.v4)(),
            geometry: simplified,
            uncertaintyGeometry,
            sourceGeofenceIds: resolved
                .map((r) => r.event.geofenceId ?? geospatial_1.geofenceIndex.resolveByName(r.event.areaName)?.properties?.id)
                .filter(Boolean),
            affectedAreas,
            confidence,
            lastEventAt: new Date(Math.max(...events.map((e) => e.timestamp.getTime()))),
            computedAt: new Date(),
            explanation: {
                method,
                activeEventCount: activeEvents.length,
                bufferKm,
                unionedAreaCount: resolved.length,
                trendDetected: !!trend,
                notes,
            },
            trend: trend ?? null,
        };
        return [zone];
    }
}
exports.EstimationEngine = EstimationEngine;
//# sourceMappingURL=engine.js.map