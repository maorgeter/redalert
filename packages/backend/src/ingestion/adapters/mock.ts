/**
 * Simulation ingestion adapter — FOR LOCAL DEVELOPMENT ONLY.
 * Generates synthetic alert events to allow testing without a live OREF connection.
 *
 * This adapter is DISABLED by default (MOCK_INGESTION=false).
 * It is never active in production deployments.
 *
 * Source label: 'simulation' (not 'mock') so the UI can style it distinctly.
 */
import { BaseIngestionAdapter } from './base'
import { Normalizer } from '../../normalization/normalizer'
import { AlertCategory } from '../../normalization/schema'
import { config } from '../../config'
import { logger } from '../../logger'

// Each scenario represents a realistic alert sequence:
// attack events → followed by an Event Ended signal (category 4).
const MOCK_SCENARIOS: Array<{ areas: string[]; category: AlertCategory }[]> = [
  // Scenario A: Rocket barrage from south → event ended
  [
    { areas: ['Sderot', 'Kibbutz Nir Am'],           category: AlertCategory.ROCKETS },
    { areas: ['Ashkelon - South', 'Ashkelon - North'], category: AlertCategory.ROCKETS },
    { areas: ['Ashdod - Center', 'Ashdod - Port'],     category: AlertCategory.ROCKETS },
    { areas: ['Kiryat Gat', 'Kiryat Malachi'],         category: AlertCategory.ROCKETS },
    { areas: ['Rishon LeZion - South', 'Holon'],       category: AlertCategory.ROCKETS },
    { areas: ['Tel Aviv - Yafo'],                       category: AlertCategory.ROCKETS },
    { areas: ['Sderot', 'Kibbutz Nir Am', 'Ashkelon - South', 'Ashkelon - North', 'Ashdod - Center', 'Kiryat Gat', 'Rishon LeZion - South', 'Holon', 'Tel Aviv - Yafo'], category: AlertCategory.EVENT_ENDED },
  ],
  // Scenario B: Northern hostile aircraft → event ended
  [
    { areas: ['Kiryat Shmona', 'Metula'],      category: AlertCategory.HOSTILE_AIRCRAFT },
    { areas: ['Nahariya', 'Akko'],             category: AlertCategory.HOSTILE_AIRCRAFT },
    { areas: ['Haifa - East', 'Haifa - Center'], category: AlertCategory.HOSTILE_AIRCRAFT },
    { areas: ['Kiryat Shmona', 'Metula', 'Nahariya', 'Akko', 'Haifa - East', 'Haifa - Center'], category: AlertCategory.EVENT_ENDED },
  ],
  // Scenario C: Central rockets + hostile aircraft → event ended
  [
    { areas: ['Jerusalem - Center', 'Jerusalem - North'], category: AlertCategory.ROCKETS },
    { areas: ["Beit Shemesh", "Modi'in"],                category: AlertCategory.ROCKETS },
    { areas: ['Tel Aviv - Yafo', 'Ramat Gan'],           category: AlertCategory.HOSTILE_AIRCRAFT },
    { areas: ['Jerusalem - Center', 'Jerusalem - North', "Beit Shemesh", "Modi'in", 'Tel Aviv - Yafo', 'Ramat Gan'], category: AlertCategory.EVENT_ENDED },
  ],
  // Scenario D: Southern rockets → event ended
  [
    { areas: ['Beer Sheba - Center', 'Beer Sheba - North'], category: AlertCategory.ROCKETS },
    { areas: ['Kiryat Gat', 'Kiryat Malachi'],              category: AlertCategory.ROCKETS },
    { areas: ['Beer Sheba - Center', 'Beer Sheba - North', 'Kiryat Gat', 'Kiryat Malachi'], category: AlertCategory.EVENT_ENDED },
  ],
]

export class MockIngestionAdapter extends BaseIngestionAdapter {
  readonly name = 'simulation'
  private timer: NodeJS.Timeout | null = null
  private normalizer = new Normalizer()
  private scenarioIndex = 0
  private stepIndex = 0

  constructor() {
    // manual, isPrimary=false, reliabilityScore=0.5
    super(config.ingestion.mockEventIntervalMs, 'manual', false, 0.5)
  }

  async start(): Promise<void> {
    this.running = true
    this.status.enabled = true
    logger.warn('Simulation adapter started — DEV MODE ONLY, not a real alert source')
    this.scheduleNext()
  }

  async stop(): Promise<void> {
    this.running = false
    this.status.enabled = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private scheduleNext(): void {
    if (!this.running) return
    const jitter = Math.random() * 3000 - 1500
    this.timer = setTimeout(() => this.fireStep(), config.ingestion.mockEventIntervalMs + jitter)
  }

  private fireStep(): void {
    try {
      const scenario = MOCK_SCENARIOS[this.scenarioIndex % MOCK_SCENARIOS.length]
      const step = scenario[this.stepIndex % scenario.length]

      const events = step.areas.map((areaName) =>
        this.normalizer.normalizeMock({
          areaName,
          category: step.category,
          geofenceId: areaName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        })
      )

      // Override source to 'simulation' so UI can identify and label it
      const tagged = events.map((e) => ({ ...e, source: 'simulation' }))
      this.emitEvents(tagged)
      logger.debug({ areas: step.areas }, '[simulation] events fired')

      this.stepIndex++
      if (this.stepIndex >= scenario.length) {
        this.stepIndex = 0
        this.scenarioIndex++
      }
    } catch (err) {
      this.handleError(err)
    } finally {
      this.scheduleNext()
    }
  }
}
