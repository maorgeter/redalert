"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockIngestionAdapter = void 0;
/**
 * Simulation ingestion adapter — FOR LOCAL DEVELOPMENT ONLY.
 * Generates synthetic alert events to allow testing without a live OREF connection.
 *
 * This adapter is DISABLED by default (MOCK_INGESTION=false).
 * It is never active in production deployments.
 *
 * Source label: 'simulation' (not 'mock') so the UI can style it distinctly.
 */
const base_1 = require("./base");
const normalizer_1 = require("../../normalization/normalizer");
const schema_1 = require("../../normalization/schema");
const config_1 = require("../../config");
const logger_1 = require("../../logger");
const MOCK_SCENARIOS = [
    [
        { areas: ['Sderot', 'Kibbutz Nir Am'], category: schema_1.AlertCategory.ROCKETS },
        { areas: ['Ashkelon - South', 'Ashkelon - North'], category: schema_1.AlertCategory.ROCKETS },
        { areas: ['Ashdod - Center', 'Ashdod - Port'], category: schema_1.AlertCategory.ROCKETS },
        { areas: ['Kiryat Gat', 'Kiryat Malachi'], category: schema_1.AlertCategory.ROCKETS },
        { areas: ['Rishon LeZion - South', 'Holon'], category: schema_1.AlertCategory.ROCKETS },
        { areas: ['Tel Aviv - Yafo'], category: schema_1.AlertCategory.ROCKETS },
    ],
    [
        { areas: ['Kiryat Shmona', 'Metula'], category: schema_1.AlertCategory.ROCKETS },
        { areas: ['Nahariya', 'Akko'], category: schema_1.AlertCategory.ROCKETS },
        { areas: ['Haifa - East', 'Haifa - Center'], category: schema_1.AlertCategory.ROCKETS },
    ],
    [
        { areas: ['Jerusalem - Center', 'Jerusalem - North'], category: schema_1.AlertCategory.ROCKETS },
        { areas: ["Beit Shemesh", "Modi'in"], category: schema_1.AlertCategory.ROCKETS },
    ],
    [
        { areas: ['Beer Sheba - Center'], category: schema_1.AlertCategory.ROCKETS },
    ],
];
class MockIngestionAdapter extends base_1.BaseIngestionAdapter {
    constructor() {
        // manual, isPrimary=false, reliabilityScore=0.5
        super(config_1.config.ingestion.mockEventIntervalMs, 'manual', false, 0.5);
        this.name = 'simulation';
        this.timer = null;
        this.normalizer = new normalizer_1.Normalizer();
        this.scenarioIndex = 0;
        this.stepIndex = 0;
    }
    async start() {
        this.running = true;
        this.status.enabled = true;
        logger_1.logger.warn('Simulation adapter started — DEV MODE ONLY, not a real alert source');
        this.scheduleNext();
    }
    async stop() {
        this.running = false;
        this.status.enabled = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }
    scheduleNext() {
        if (!this.running)
            return;
        const jitter = Math.random() * 3000 - 1500;
        this.timer = setTimeout(() => this.fireStep(), config_1.config.ingestion.mockEventIntervalMs + jitter);
    }
    fireStep() {
        try {
            const scenario = MOCK_SCENARIOS[this.scenarioIndex % MOCK_SCENARIOS.length];
            const step = scenario[this.stepIndex % scenario.length];
            const events = step.areas.map((areaName) => this.normalizer.normalizeMock({
                areaName,
                category: step.category,
                geofenceId: areaName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
            }));
            // Override source to 'simulation' so UI can identify and label it
            const tagged = events.map((e) => ({ ...e, source: 'simulation' }));
            this.emitEvents(tagged);
            logger_1.logger.debug({ areas: step.areas }, '[simulation] events fired');
            this.stepIndex++;
            if (this.stepIndex >= scenario.length) {
                this.stepIndex = 0;
                this.scenarioIndex++;
            }
        }
        catch (err) {
            this.handleError(err);
        }
        finally {
            this.scheduleNext();
        }
    }
}
exports.MockIngestionAdapter = MockIngestionAdapter;
//# sourceMappingURL=mock.js.map