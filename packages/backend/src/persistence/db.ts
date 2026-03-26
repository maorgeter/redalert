import { Pool, PoolClient } from 'pg'
import { config } from '../config'
import { logger } from '../logger'

let pool: Pool | null = null
let available = false

export async function initDb(): Promise<void> {
  try {
    pool = new Pool(config.db)
    const client = await pool.connect()
    await client.query('SELECT 1')
    client.release()
    available = true
    logger.info({ host: config.db.host, db: config.db.database }, 'PostgreSQL connected')
  } catch (err) {
    available = false
    logger.warn({ err: (err as Error).message }, 'PostgreSQL unavailable — running without persistence')
    pool = null
  }
}

export function isDbAvailable(): boolean {
  return available
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  if (!pool || !available) return []
  const res = await pool.query(sql, params)
  return res.rows as T[]
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T | null> {
  if (!pool || !available) return null
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
    available = false
  }
}
