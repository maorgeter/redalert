"use strict";
/**
 * Decay functions for zone confidence over time.
 * As events age, their contribution to estimated zones decays.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.exponentialDecay = exponentialDecay;
exports.linearDecay = linearDecay;
exports.computeZoneConfidence = computeZoneConfidence;
exports.zoneOpacity = zoneOpacity;
/**
 * Exponential decay: confidence starts at 1.0 and falls to ~0 by decayMs.
 */
function exponentialDecay(ageMs, halfLifeMs) {
    return Math.exp((-Math.LN2 * ageMs) / halfLifeMs);
}
/**
 * Linear decay: 1.0 at age=0, 0.0 at age=decayMs
 */
function linearDecay(ageMs, decayMs) {
    return Math.max(0, 1 - ageMs / decayMs);
}
/**
 * Overall confidence for a set of events based on:
 * - recency (decayed by most recent event's age)
 * - count (more events → higher confidence)
 */
function computeZoneConfidence(mostRecentEventAgeMs, activeEventCount, decayMs) {
    const recencyScore = exponentialDecay(mostRecentEventAgeMs, decayMs / 2);
    // Count bonus: saturates at ~1.0 for 5+ events
    const countBonus = Math.min(1.0, activeEventCount / 5);
    return Math.min(1.0, recencyScore * 0.7 + countBonus * 0.3);
}
/**
 * Visual opacity for a zone in the UI (0–1)
 */
function zoneOpacity(confidence, status) {
    const base = status === 'active' ? 0.65 : 0.25;
    return base * confidence;
}
//# sourceMappingURL=decay.js.map