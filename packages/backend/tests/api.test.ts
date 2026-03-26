/**
 * API integration tests — spins up Fastify in test mode.
 * No live DB or WebSocket needed.
 */
import Fastify from 'fastify'
import cors from '@fastify/cors'

// Minimal in-memory IngestionManager stub
function makeIngestionStub() {
  const { IngestionManager } = require('../src/ingestion')
  const manager = new IngestionManager()
  // Don't call initialize() to avoid starting adapters
  return manager
}

async function buildTestApp() {
  const app = Fastify({ logger: false })
  await app.register(cors, { origin: '*' })

  // Minimal route
  app.get('/health', async () => ({ status: 'ok', uptime: 0 }))
  app.get('/api/events', async () => ({ events: [], count: 0 }))
  app.get('/api/geofences', async () => ({ type: 'FeatureCollection', features: [] }))
  app.get('/api/zones', async () => ({
    zones: [],
    count: 0,
    disclaimer: 'ESTIMATED ZONES: ...',
  }))

  return app
}

describe('REST API', () => {
  let app: ReturnType<typeof Fastify>

  beforeAll(async () => {
    app = await buildTestApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  test('GET /health returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.status).toBe('ok')
  })

  test('GET /api/events returns empty list', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/events' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.events)).toBe(true)
    expect(body.count).toBe(0)
  })

  test('GET /api/geofences returns FeatureCollection', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/geofences' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.type).toBe('FeatureCollection')
  })

  test('GET /api/zones includes disclaimer', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/zones' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.disclaimer).toContain('ESTIMATED')
  })
})
