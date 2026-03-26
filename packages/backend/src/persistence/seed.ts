import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import { Pool } from 'pg'
import { config } from '../config'
import { v4 as uuidv4 } from 'uuid'

interface MockEventRecord {
  id?: string
  areaName: string
  category: string
  timestamp?: string
  geofenceId?: string
}

async function seed(): Promise<void> {
  const pool = new Pool(config.db)

  const mockPath = path.join(__dirname, '../../data/mock-events.json')
  if (!fs.existsSync(mockPath)) {
    console.log('No mock-events.json found, skipping seed')
    await pool.end()
    return
  }

  const raw = JSON.parse(fs.readFileSync(mockPath, 'utf-8')) as MockEventRecord[]
  let inserted = 0

  for (const r of raw) {
    const id = r.id ?? uuidv4()
    const ts = r.timestamp ? new Date(r.timestamp) : new Date()
    await pool.query(
      `INSERT INTO alert_events
        (id, source, timestamp, area_name, area_type, city_names, geofence_id,
         raw_payload, received_at, updated_at, severity, confidence, status, category)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT DO NOTHING`,
      [
        id, 'seed', ts, r.areaName, 'ZONE', [r.areaName], r.geofenceId ?? null,
        JSON.stringify(r), ts, ts, 'HIGH', 0.9, 'EXPIRED', r.category ?? 'rockets',
      ]
    )
    inserted++
  }

  console.log(`Seeded ${inserted} mock events`)
  await pool.end()
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
