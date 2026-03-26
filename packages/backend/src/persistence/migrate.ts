import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import { Pool } from 'pg'
import { config } from '../config'

async function migrate(): Promise<void> {
  const pool = new Pool(config.db)
  const migrationsDir = path.join(__dirname, 'migrations')

  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8')
    console.log(`Applying migration: ${file}`)
    await pool.query(sql)
    console.log(`Applied: ${file}`)
  }

  await pool.end()
  console.log('Migrations complete')
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
