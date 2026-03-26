import 'dotenv/config'

// ── Database config ───────────────────────────────────────────────────────────
// Render (and other PaaS) supply a single DATABASE_URL.
// Individual DB_* vars are used for local / Docker Compose dev.
const _db = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      // Render internal connections don't need SSL; external ones do.
      // rejectUnauthorized: false handles self-signed certs on managed DBs.
      ssl: process.env.DB_SSL === 'false'
        ? (false as const)
        : { rejectUnauthorized: false },
      max: parseInt(process.env.DB_POOL_SIZE ?? '5'),
    }
  : {
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432'),
      database: process.env.DB_NAME ?? 'alertmap',
      user: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      max: parseInt(process.env.DB_POOL_SIZE ?? '10'),
      ssl: false as const,
    }

export const config = {
  port: parseInt(process.env.PORT ?? '3001'),

  db: _db,

  ingestion: {
    // Mock/simulation adapter — disabled by default; only enable for local development
    mockEnabled: process.env.MOCK_INGESTION === 'true',
    // OREF public alert feed — enabled by default
    orefEnabled: process.env.OREF_INGESTION !== 'false',
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS ?? '3000'),
    mockEventIntervalMs: parseInt(process.env.MOCK_EVENT_INTERVAL_MS ?? '8000'),
  },

  estimation: {
    bufferKm: parseFloat(process.env.BUFFER_KM ?? '5'),
    decayMs: parseInt(process.env.DECAY_MS ?? '300000'),
    recomputeIntervalMs: parseInt(process.env.RECOMPUTE_INTERVAL_MS ?? '1000'),
    maxTrendEvents: 10,
    minTrendEvents: 3,
    uncertaintyMultiplier: 1.8,
  },

  cors: {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  },

  geofencesPath: process.env.GEOFENCES_PATH ?? './data/geofences.geojson',
} as const
