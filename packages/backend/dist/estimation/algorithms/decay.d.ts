/**
 * Decay functions for zone confidence over time.
 * As events age, their contribution to estimated zones decays.
 */
/**
 * Exponential decay: confidence starts at 1.0 and falls to ~0 by decayMs.
 */
export declare function exponentialDecay(ageMs: number, halfLifeMs: number): number;
/**
 * Linear decay: 1.0 at age=0, 0.0 at age=decayMs
 */
export declare function linearDecay(ageMs: number, decayMs: number): number;
/**
 * Overall confidence for a set of events based on:
 * - recency (decayed by most recent event's age)
 * - count (more events → higher confidence)
 */
export declare function computeZoneConfidence(mostRecentEventAgeMs: number, activeEventCount: number, decayMs: number): number;
/**
 * Visual opacity for a zone in the UI (0–1)
 */
export declare function zoneOpacity(confidence: number, status: 'active' | 'decaying'): number;
//# sourceMappingURL=decay.d.ts.map