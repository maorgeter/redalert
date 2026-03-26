/**
 * Simulation ingestion adapter — FOR LOCAL DEVELOPMENT ONLY.
 * Generates synthetic alert events to allow testing without a live OREF connection.
 *
 * This adapter is DISABLED by default (MOCK_INGESTION=false).
 * It is never active in production deployments.
 *
 * Source label: 'simulation' (not 'mock') so the UI can style it distinctly.
 */
import { BaseIngestionAdapter } from './base';
export declare class MockIngestionAdapter extends BaseIngestionAdapter {
    readonly name = "simulation";
    private timer;
    private normalizer;
    private scenarioIndex;
    private stepIndex;
    constructor();
    start(): Promise<void>;
    stop(): Promise<void>;
    private scheduleNext;
    private fireStep;
}
//# sourceMappingURL=mock.d.ts.map